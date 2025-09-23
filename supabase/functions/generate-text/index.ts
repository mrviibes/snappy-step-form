import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Master Rules Configuration
const MASTER_CONFIG = {
  // Global Rules
  length_min: 50,
  length_max: 120,
  max_punctuation_per_line: 2,
  forbidden_punctuation: /[;…]|(?:^|[^.])\.\.(?:[^.]|$)|[–—]/,
  
  // Category Lexicons
  lexicons: {
    wedding: ["vows","rings","altar","reception","dance floor","bouquet","honeymoon","bride","groom","cake","toast","in-laws"],
    engagement: ["ring","proposal","fiancé","fiancée","yes","forever"],
    birthday: ["birthday","cake","candles","party","balloons","frosting","gift"],
    graduation: ["cap","gown","diploma","tassel","stage","ceremony"],
    work: ["meeting","boss","deadline","office","email","printer","coffee","slides","calendar"],
    school: ["exam","homework","teacher","class","test","grade","study"],
    soccer: ["goal","field","referee","fans","stadium","match","cup"],
    basketball: ["hoop","court","dribble","dunk","buzzer","playoffs"],
    baseball: ["bat","ball","base","inning","pitcher","glove","strike"],
    hockey: ["puck","ice","rink","goalie","stick","net","season"],
    music: ["song","lyrics","concert","stage","band","playlist"],
    movies: ["movie","film","screen","popcorn","theater","trailer"],
    tv: ["show","series","episode","streaming","channel","binge"]
  },
  
  // Rating Definitions
  ratings: {
    G: { forbidden_words: [], allow_innuendo: false, description: "wholesome/playful" },
    PG: { forbidden_words: [], allow_innuendo: false, description: "light sarcasm, safe ironic" },
    "PG-13": { forbidden_words: [], allow_innuendo: true, description: "edgy, ironic, sharp" },
    R: { forbidden_words: [], allow_innuendo: true, description: "savage, raw, unfiltered" }
  }
};

// Rating language gates
const SWEARS_MILD = /\b(hell|damn|crap)\b/i;
const SWEARS_STRONG = /\b(fuck(?:ing)?|shit|asshole|bastard|douche)\b/i;
const SLURS = /\b(?:placeholder_slur)\b/i; // Server-side only

// Comedian styles with enhanced flavors for master rules
const COMEDIAN_STYLES = [
  { name: "Seinfeld", flavor: "observational, everyday absurdity, what's the deal with..." },
  { name: "Carlin", flavor: "cynical wordplay, social commentary, seven words you can't say" },
  { name: "Wright", flavor: "deadpan surreal one-liners, I haven't slept for ten days" },
  { name: "Hedberg", flavor: "absurd stream of consciousness, I used to do drugs" },
  { name: "Rivers", flavor: "self-deprecating sharp wit, can we talk?" },
  { name: "Mulaney", flavor: "storytelling relatable chaos, new in town" },
  { name: "Chappelle", flavor: "provocative social satire, I'm rich!" },
  { name: "Hart", flavor: "animated physical comedy, you gonna learn today" }
];

// Normalize category/subcategory keys like "celebrations > wedding" -> "wedding"
function normKey(input?: string): string {
  if (!input) return '';
  const last = String(input).split('>').pop()!.trim().toLowerCase();
  // Simple aliasing map if needed in future
  const aliases: Record<string, string> = {
    'weddings': 'wedding',
  };
  return aliases[last] || last;
}

function getLexiconFor(input?: string): string[] {
  const key = normKey(input);
  return MASTER_CONFIG.lexicons[key as keyof typeof MASTER_CONFIG.lexicons] || [];
}

function validateMasterRules(line: string, scenario: any): { ok: boolean; reason?: string } {
  const text = line.trim();
  
  // 1. Length check
  if (text.length < MASTER_CONFIG.length_min || text.length > MASTER_CONFIG.length_max) {
    return { ok: false, reason: "length_out_of_bounds" };
  }
  
  // 2. Punctuation checks
  const punctCount = (text.match(/[.!?,:"]/g) || []).length;
  if (punctCount > MASTER_CONFIG.max_punctuation_per_line) {
    return { ok: false, reason: "too_much_punctuation" };
  }
  
  if (MASTER_CONFIG.forbidden_punctuation.test(text)) {
    return { ok: false, reason: "forbidden_punctuation" };
  }
  
  // 3. Insert tag validation (once each, flexible)
  if (scenario.insertWords?.length) {
    for (const tag of scenario.insertWords) {
      const base = tag.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = tag.includes(" ") 
        ? base.replace(/\s+/g, "\\s+")
        : `${base}(?:s|es|ed|ing)?`;
      const re = new RegExp(`(^|\\W)${pattern}(?=\\W|$)`, "i");
      const reAll = new RegExp(`(^|\\W)${pattern}(?=\\W|$)`, "ig");
      
      if (!re.test(text) || ((text.match(reAll) || []).length !== 1)) {
        return { ok: false, reason: `insert_not_once:${tag}` };
      }
    }
  }
  
  // 4. Category anchoring
  const subcategoryRaw = scenario.subcategory || scenario.category;
  const key = normKey(subcategoryRaw);
  const lexicon = MASTER_CONFIG.lexicons[key as keyof typeof MASTER_CONFIG.lexicons] || [];
  const hasDirectAnchor = lexicon.some(w => 
    new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "i").test(text)
  );
  
  if (!hasDirectAnchor) {
    // Check contextual cues
    const contextCues: Record<string, RegExp> = {
      wedding: /\b(bride|groom|best man|maid of honor|altar|reception|first dance|in laws|rings|bouquet|vows|toast|cake)\b/i,
      birthday: /\b(happy birthday|blow out|turning \d+|party hat|surprise party)\b/i,
      graduation: /\b(graduat|commencement|walk the stage)\b/i
    };
    
    const hasContextAnchor = contextCues[key]?.test(text);
    if (!hasContextAnchor) {
      return { ok: false, reason: "category_anchor_missing" };
    }
  }
  
  // 5. Rating compliance
  if (SLURS.test(text)) return { ok: false, reason: "slur_violation" };
  
  switch (scenario.rating?.toUpperCase()) {
    case "G":
      if (SWEARS_MILD.test(text) || SWEARS_STRONG.test(text)) {
        return { ok: false, reason: "rating_violation_G" };
      }
      break;
    case "PG":
      if (SWEARS_STRONG.test(text)) {
        return { ok: false, reason: "rating_violation_PG" };
      }
      break;
    case "PG-13":
      if (SWEARS_STRONG.test(text)) {
        return { ok: false, reason: "rating_violation_PG13" };
      }
      break;
    case "R":
      // R allows strong language, just no slurs
      break;
  }
  
  // 6. Basic cleanliness
  if (/\b(NAME|USER|PLACEHOLDER|friend)\b/i.test(text)) {
    return { ok: false, reason: "placeholder_leak" };
  }
  
  return { ok: true };
}

function validateBatch(lines: string[], scenario: any): { ok: boolean; details?: any } {
  if (!Array.isArray(lines) || lines.length !== 4) {
    return { ok: false, details: "batch_must_have_4_lines" };
  }
  
  const failures = [];
  const lengths = [];
  let directAnchors = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const validation = validateMasterRules(line, scenario);
    
    if (!validation.ok) {
      failures.push({ index: i, reason: validation.reason });
    }
    
    lengths.push(line.length);
    
    // Count direct lexicon hits
  const key = normKey(scenario.subcategory || scenario.category);
  const lexicon = MASTER_CONFIG.lexicons[key as keyof typeof MASTER_CONFIG.lexicons] || [];
  if (lexicon.some(w => new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "i").test(line))) {
    directAnchors++;
  }
  }
  
  if (failures.length) {
    return { ok: false, details: { failures } };
  }
  
  // Rhythm variety check
  const hasShort = lengths.some(len => len < 70);
  const hasLong = lengths.some(len => len >= 100);
  if (!hasShort || !hasLong) {
    return { ok: false, details: "rhythm_variety_missing" };
  }
  
  // Batch anchoring check
  if (directAnchors < 2) {
    return { ok: false, details: "insufficient_direct_anchors" };
  }
  
  return { ok: true };
}

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15);
}

function pickComedians(count: number): any[] {
  const shuffled = [...COMEDIAN_STYLES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const temperature = 0.9 + Math.random() * 0.15; // 0.9 to 1.05
  const topP = 0.85 + Math.random() * 0.1; // 0.85 to 0.95
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      top_p: topP,
      max_tokens: 150
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// Retry generation with timeout protection and retry ladder
async function generateValidBatch(systemPrompt: string, payload: any, subcategory: string, nonce: string, maxRetries = 3): Promise<Array<{line: string, comedian: string}>> {
  const comedians = pickComedians(4);
  const timeoutMs = 25000; // 25 second hard timeout
  const startTime = Date.now();
  
  // Retry ladder with progressive relaxation
  const retryConfigs = [
    { candidates: 8, lengthMin: 50, lengthMax: 120, maxPunct: 2 }, // Strict
    { candidates: 12, lengthMin: 45, lengthMax: 125, maxPunct: 2 }, // Slightly relaxed
    { candidates: 16, lengthMin: 40, lengthMax: 130, maxPunct: 3 }  // More relaxed
  ];
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('generation_timeout_exceeded');
    }
    
    console.log(`Generation attempt ${attempt + 1}:`);
    const config = retryConfigs[attempt] || retryConfigs[retryConfigs.length - 1];
    const candidates = [];
    const validationErrors = [];
    
    // Generate candidates with timeout protection
    for (let i = 0; i < config.candidates; i++) {
      if (Date.now() - startTime > timeoutMs) {
        console.log('Timeout during candidate generation');
        break;
      }
      
      const comedian = comedians[i % comedians.length];
      
      // Improved insert tag prompting
      let instructions = `Write 1 ${payload.rating}-rated ${subcategory} joke. Tone: ${payload.tone}. Keep it ${config.lengthMin}-${config.lengthMax} characters. Exactly one sentence. At most ${config.maxPunct} punctuation marks. No em dashes, semicolons, or ellipses.`;
      
      if (payload.insertWords?.length > 0) {
        const insertTag = payload.insertWords[0];
        instructions += ` Include the name "${insertTag}" exactly once anywhere in the line, naturally integrated. Do not duplicate or skip the name.`;
      }
      
      instructions += ` Tie each joke to ${subcategory} context by keyword or situation.`;
      
      const userPrompt = `${instructions}

Comedian Style: ${comedian.name} – ${comedian.flavor}

Examples of good ${subcategory} context integration:
- Use keywords like: ${getLexiconFor(subcategory).slice(0, 5).join(', ') || 'relevant terms'}
- Reference situations specific to ${subcategory}

Generate ONE line only:`;

      try {
        const rawResponse = await callOpenAI(systemPrompt, userPrompt);
        const cleaned = rawResponse.split('\n')[0].trim().replace(/^["']|["']$/g, '');
        
        // Progressive validation - use config params
        const isValidLength = cleaned.length >= config.lengthMin && cleaned.length <= config.lengthMax;
        const punctCount = (cleaned.match(/[.!?,:"]/g) || []).length;
        const isValidPunct = punctCount <= config.maxPunct;
        
        if (isValidLength && isValidPunct) {
          const validation = validateMasterRules(cleaned, payload);
          if (validation.ok) {
            candidates.push({
              line: cleaned,
              comedian: comedian.name
            });
          } else {
            validationErrors.push({
              line: cleaned,
              reason: validation.reason,
              length: cleaned.length
            });
          }
        } else {
          validationErrors.push({
            line: cleaned,
            reason: !isValidLength ? 'length_invalid' : 'punct_invalid',
            length: cleaned.length
          });
        }
      } catch (error) {
        console.error(`Generation ${i} failed:`, error);
      }
    }
    
    console.log(`Attempt ${attempt + 1}: Got ${candidates.length} valid candidates out of ${config.candidates}`);
    
    // Return partial success if we have at least some valid lines
    if (candidates.length >= 4) {
      const selected = candidates.slice(0, 4);
      const batchValidation = validateBatch(selected.map(c => c.line), payload);
      
      if (batchValidation.ok) {
        return selected;
      } else {
        console.log(`Batch validation failed:`, batchValidation.details);
      }
    } else if (attempt === maxRetries - 1 && candidates.length > 0) {
      // On final attempt, return what we have if it's something
      console.log(`Final attempt: returning ${candidates.length} partial candidates`);
      return candidates.slice(0, Math.min(4, candidates.length));
    }
    
    // Log detailed errors for debugging
    if (validationErrors.length > 0) {
      const errorSummary = validationErrors.slice(0, 3).map(e => 
        `"${e.line.substring(0, 30)}..." (${e.reason}, len:${e.length})`
      );
      console.log(`Validation errors sample:`, errorSummary);
    }
    
    // Wait before retry with jitter
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    }
  }
  
  throw new Error(`no_valid_lines_after_${maxRetries}_retries`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Add request timeout protection
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('request_timeout')), 30000); // 30 second total timeout
  });

  try {
    const payload = await req.json();
    console.log('Master Rules Generation Request:', payload);
    
    // Defaults and normalization
    if (!payload.rating) payload.rating = 'PG';
    const nonce = generateNonce();
    const subcategory = payload.subcategory || payload.category;
    
    // Enhanced system prompt with master rules
    const systemPrompt = `You are a master comedy writer following strict Step-2 Text Generation Rules.

MASTER RULES (CRITICAL - NO EXCEPTIONS):
1. Structure: Exactly ONE sentence, 50-120 characters total
2. Insert Tags: If provided, use each tag ONCE per line with natural inflections (plurals, past tense OK)
3. Category Anchoring: Each line must clearly relate to ${subcategory} using direct keywords or contextual cues
4. Rating Control: ${payload.rating} = ${MASTER_CONFIG.ratings[payload.rating]?.description}
5. Punctuation: Max 2 marks per line. NO em dashes (—), semicolons (;), or ellipses (…)
6. Quality: Sharp, quotable, stand-up quality humor - no greeting card fluff
7. Variety: Vary line length and structure within each set of 4

Category Keywords Available: ${getLexiconFor(subcategory).join(', ') || 'general'}

Rating Guidelines:
- G: Family-safe, wholesome, playful
- PG: Light sarcasm, safe irony
- PG-13: Edgy sarcasm, mild swears allowed (hell, damn)
- R: Savage, explicit swears allowed (fuck, shit), no slurs

FORBIDDEN: Placeholder words (friend, NAME, USER), em dashes, generic filler
OUTPUT: Only the joke line, nothing else.

Nonce: ${nonce}`;

    try {
      // Race between generation and timeout
      const validLines = await Promise.race([
        generateValidBatch(systemPrompt, payload, subcategory, nonce),
        timeoutPromise
      ]);
      
      return new Response(JSON.stringify({
        success: true,
        options: validLines
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (generationError) {
      console.error('Generation failed after all retries:', generationError);
      
      // Provide user-friendly error messages
      let userMessage = 'Text generation failed';
      let statusCode = 422;
      
      if (generationError.message === 'request_timeout' || generationError.message === 'generation_timeout_exceeded') {
        userMessage = 'Generation timed out. Try again with simpler requirements or different insert words.';
        statusCode = 408;
      } else if (generationError.message.includes('no_valid_lines')) {
        userMessage = 'Could not generate valid text with current requirements. Try changing the tone, rating, or insert words.';
      } else if (generationError.message.includes('category_anchor_missing')) {
        userMessage = `Unable to create ${subcategory} jokes with current settings. Try different insert words or tone.`;
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: userMessage,
        details: {
          category: payload.category,
          subcategory: subcategory,
          tone: payload.tone,
          rating: payload.rating,
          insertWords: payload.insertWords,
          reason: generationError.message,
          troubleshooting: 'Try different insert words, simpler tone, or different category'
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error('Master Rules Generation Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'System error occurred. Please try again.',
      details: { reason: error.message }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});