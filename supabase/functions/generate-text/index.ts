import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const text_rules = `SYSTEM INSTRUCTIONS — ONE-LINERS & JOKES

GOAL
- Generate 4 distinct outputs that satisfy all constraints below.
- If category starts with "jokes", write 4 jokes in the requested joke style.
- If category starts with "pop-culture", write 4 context-aware one-liners or quips in that subcategory style.
- Otherwise, write 4 humorous one-liners.

GLOBAL HARD CONSTRAINTS
- Return exactly 4 lines, one per line. No numbering, bullets, or explanations.
- Each "insert word" or token must appear exactly as provided in every line, naturally placed.
- Vary token positions across the 4 outputs (collectively cover start, middle, end).
- Length 60–120 characters per line.
- One sentence per line. Max 3 punctuation marks total (. , ? !).
- No greetings (e.g., "Happy birthday,"). No emojis.
- No em dashes, colons, semicolons. Replace with commas or end the sentence.
- Remove filler: finally, trust me, here's to, may your, another year of.
- Avoid padding with "that/which" unless essential.
- No duplicate word pairs across the 4 outputs (unique bigrams across lines).
- Apply the selected Tone and Rating precisely.

JOKE MODE (applies when category starts with "jokes")
- Use the subcategory as the joke style (e.g., break-up-jokes, bar-jokes, dad-jokes, stand-up-comedy).
- Write jokes in that style, not general quips and not explanations.
- Style intent examples:
  • break-up-jokes → exes, endings, moving on, aftermath
  • bar-jokes → "walks into a bar" setups or barroom scenarios
  • dad-jokes → groaners, clean wordplay, silly puns
  • roasts/stand-up-comedy → performance tone, setup→tag→punch
- Do not include any prefaces like "Here are jokes" or "As requested".

POP-CULTURE MODE (applies when category starts with "pop-culture")
- Use the subcategory as the cultural frame (movies, celebrities, music, sports icons, memes, influencers, etc).
- Write lines that feel aware of that space:
  • movies → mention characters, scenes, motifs, or props
  • celebrities → gossip tone, red carpet, scandals, fan takes
  • sports icons → highlight feats, records, quirks
  • video games → levels, bosses, combos, grinding
  • influencers/social → trends, hashtags, drama, "link in bio"
  • memes/TikTok → templates, loops, trends, viral vibe
- Do not narrate instructions. No "here are 4 lines".
- Reference tokens (e.g. "Billy Madison") with scene- or persona-level detail.

ROLE-AWARE TOKENS
- Tokens are given as text with roles (person, group, character, venue, city, event, timeslot, topic, brand, catchphrase, callback, meme, title).
- Use ALL tokens naturally, exactly as written, in EVERY line.
- Placement should fit the role:
  • person/character → subject or tag after a clause
  • title=movie/show/song → scene-aware mention, not generic
  • celebrity → gossip/spotlight framing
  • venue/city/timeslot → opener tag, parenthetical, or setting mid-clause
  • topic/brand/meme → mid-setup or punch
  • callback/catchphrase → punchline or echo tag
- Vary token positions across the 4 outputs; do not always cluster them.

TONES
- Humorous → witty wordplay and exaggeration.
- Savage → blunt roast, no soft language.
- Sentimental → warm and affectionate, even if raw.
- Nostalgic → references to the past; avoid modern slang.
- Romantic → affectionate and playful, no meanness.
- Inspirational → uplifting, no negativity or irony.
- Playful → cheeky and silly, not formal.
- Serious → dry, deadpan wit with formal weight.

RATINGS
- G → no profanity or adult references.
- PG → censored swears allowed (f***, sh*t), no uncensored profanity.
- PG-13 → allow only mild words like "hell" and "damn"; block anything stronger.
- R (Raw, Unfiltered) →
  - Every line must include at least one uncensored profanity.
  - Profanity must vary across the 4 outputs (different lead swear per line).
  - Profanity may appear more than once per line only if still within 60–120 chars and ≤3 punctuation.
  - Profanity should feel natural, not bolted beside a token. Prefer varied placements:
      • start for emphasis
      • mid-clause before/after a verb or adjective
      • replace a bland intensifier (really/very/super/so/pretty)
      • end as the punchline
  - Sentimental + R must combine warmth/affection with raw profanity, not hostility.

PROFANITY POOL (50)
fuck, fucking, fucker, motherfucker, shit, shitty, bullshit, asshole, arse, arsehole,
bastard, bitch, son of a bitch, damn, goddamn, hell, crap, piss, pissed, dick,
dickhead, prick, cock, knob, wanker, tosser, bollocks, bugger, bloody, git,
twat, douche, douchebag, jackass, dumbass, dipshit, clusterfuck, shitshow, balls,
tits, skank, tramp, slag, screw you, piss off, crapshoot, arsed, bloody hell,
rat bastard, shithead

OUTPUT FORMAT
- Return exactly 4 lines, one per line, no numbering, no bullets, no meta text.
`;

function choice<T>(items: readonly T[], weights?: readonly number[]): T {
  if (weights && weights.length !== items.length) {
    throw new Error("Weights array must have same length as items array");
  }
  
  if (!weights) {
    return items[Math.floor(Math.random() * items.length)];
  }
  
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  return items[items.length - 1];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, subcategory, tone, rating, tokens, customText } = await req.json();
    
    console.log('Generate text request:', {
      category,
      subcategory,
      tone,
      rating,
      tokens,
      customText
    });

    // If custom text is provided, return it directly
    if (customText && customText.trim()) {
      const lines = customText.split('\n').filter((line: string) => line.trim()).slice(0, 4);
      return new Response(JSON.stringify({ 
        candidates: lines,
        success: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the prompt
    let prompt = text_rules;
    
    if (category) {
      prompt += `\n\nCATEGORY: ${category}`;
      if (subcategory) {
        prompt += ` > ${subcategory}`;
      }
    }
    
    if (tone) {
      prompt += `\n\nTONE: ${tone}`;
    }
    
    if (rating) {
      prompt += `\n\nRATING: ${rating}`;
    }
    
    if (tokens && tokens.length > 0) {
      prompt += `\n\nTOKENS TO INCLUDE: ${tokens.join(', ')}`;
    }

    // Call OpenAI API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        messages: [
          { role: 'system', content: 'You are a witty copywriter. Follow the provided rules exactly and output exactly 4 lines, one sentence per line, no numbering or bullets.' },
          { role: 'user', content: prompt }
        ]
      }),
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      console.error('OpenAI API error:', completion.status, errorText);
      throw new Error(`OpenAI API error: ${completion.status}`);
    }

    const data = await completion.json();
    const generatedText: string = data?.choices?.[0]?.message?.content ?? '';
    
    // Split into lines and clean up
    const rawCandidates = generatedText
      .split('\n')
      .map((line: string) => line.trim().replace(/^[-•*]\s*/, '')) // remove bullets
      .filter((line: string) => line && !line.match(/^\d+\.?\s/)) // Remove numbering
      .slice(0, 4);

    console.log('Raw candidates:', rawCandidates);

    const linesOut = rawCandidates.map((l: string) => ({ line: l }));

    return new Response(JSON.stringify({ 
      success: true,
      lines: linesOut,
      model: 'openai:gpt-4o-mini',
      count: linesOut.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-text function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});