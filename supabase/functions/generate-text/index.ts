import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// We only need the title for the LLM; post-processing enforces everything else.
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
- Length 60–120 characters per line. Aim for varied lengths (e.g., near 65, 85, 105, 120).
- One sentence per line, and it MUST end with a period, question mark, or exclamation.
- Max 3 punctuation marks total (. , ? !).
- No greetings (e.g., "Happy birthday,"). No emojis.
- No em dashes, colons, semicolons. Replace with commas or end the sentence.
- Remove filler: finally, trust me, here's to, may your, another year of.
- Avoid padding with "that/which" unless essential.
- No duplicate word pairs across the 4 outputs (unique bigrams across lines).
- Apply the selected Tone and Rating precisely.
- Do not use Q&A scaffolds such as "Why did...", "What do you call...", or "Did you hear...".

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
- Profanity may not appear directly adjacent to a token; keep at least one other word between them.

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
  if (weights && weights.length !== items.length) throw new Error("Weights length must match items length");
  if (!weights) return items[Math.floor(Math.random() * items.length)];
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// ---------- Post-process helpers ----------
const STRONG_SWEARS = /(fuck(?:er|ing)?|shit(?:ty)?|bastard|ass(?!ert)|arse|bullshit|prick|dick|cock|piss|wank|crap|motherfucker|goddamn|tits|skank|slag|twat)/gi;
const QNA_START = /^(why did|what do you call|did you hear|someone said|his buddy said|scott asked)/i;
const GREETING = /^happy birthday[,!\s]/i;

function normalizeRating(r?: string): "G"|"PG"|"PG-13"|"R" {
  const k = (r || "").toUpperCase().replace(/\s+/g, "");
  if (k === "G") return "G";
  if (k === "PG") return "PG";
  if (k === "PG-13" || k === "PG13") return "PG-13";
  if (k === "R") return "R";
  return "PG-13";
}

function endPunct(s: string) { s = s.trim(); if (!/[.?!]$/.test(s)) s += "."; return s; }
function punctFix(s: string) {
  return s
    .replace(/\s+([,?!])/g, "$1")            // no space before , ? !
    .replace(/([,?!])([A-Za-z])/g, "$1 $2")  // space after , ? !
    .replace(/([.?!])[.?!]+$/g, "$1");       // collapse multiple end marks
}

function countPunc(s: string) {
  const m = s.match(/[.,?!]/g); return m ? m.length : 0;
}

function oneSentenceOnly(s: string) {
  const parts = s.split(/[.?!]/).filter(Boolean);
  if (parts.length <= 1) return s;
  return parts[0].trim() + ".";
}

function varyInsertPositions(lines: string[], token: string) {
  const targets = ["start", "middle", "end", "any"].sort(() => Math.random() - 0.5);
  return lines.map((l, i) => {
    const t = targets[i % targets.length];
    if (new RegExp("\\b" + token + "\\b", "i").test(l)) return l;
    if (t === "start") return (token + ", " + l).replace(/\s+/g, " ");
    if (t === "end") return l.replace(/[.?!]\s*$/, "") + ", " + token + ".";
    // middle
    const words = l.replace(/[.?!]\s*$/, "").split(" ");
    const idx = Math.max(1, Math.min(words.length - 2, Math.floor(words.length / 2)));
    words.splice(idx, 0, token);
    return endPunct(words.join(" "));
  });
}

const LENGTH_BUCKETS = [68, 85, 105, 118];
function normalizeLength(l: string, target: number) {
  let s = l.trim();
  if (s.length > target + 6) {
    s = s.slice(0, target).replace(/\s+\S*$/, "").trim();
  } else if (s.length < Math.max(60, target - 8)) {
    const tails = [
      "which feels exactly right today",
      "and somehow that was the highlight",
      "and the room politely agreed",
      "which tracks, given the evidence",
    ];
    s = s.replace(/[.?!]\s*$/, "");
    s += ", " + tails[Math.floor(Math.random() * tails.length)] + ".";
  }
  return endPunct(s);
}

function enforceRating(s: string, rating: "G"|"PG"|"PG-13"|"R") {
  if (rating === "R") return s;
  if (rating === "PG-13") {
    return s.replace(STRONG_SWEARS, "damn").replace(/\bshitshow\b/gi, "mess");
  }
  if (rating === "PG") {
    return s.replace(STRONG_SWEARS, (m) => {
      if (/fuck/i.test(m)) return "f***";
      if (/shit/i.test(m)) return "sh*t";
      return "d***";
    });
  }
  // G
  return s.replace(STRONG_SWEARS, "").replace(/\s+/g, " ").trim();
}

// Prevent profanity adjacent to tokens: inserts a soft buffer word or moves token
function deAdjacentProfanity(s: string, tokens: string[]) {
  let out = s;
  for (const t of tokens) {
    const re1 = new RegExp(`\\b${t}\\b\\s+(fuck|shit|damn|hell)`, "i");
    const re2 = new RegExp(`\\b(fuck|shit|damn|hell)\\s+${t}\\b`, "i");
    if (re1.test(out)) out = out.replace(re1, `${t} really $1`);
    if (re2.test(out)) out = out.replace(re2, `$1, ${t}`);
  }
  return out;
}

// Bigram de-dup across 4 lines
function bigramSet(s: string) {
  const w = s.toLowerCase().replace(/[^\w\s']/g,"").split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i=0;i<w.length-1;i++) set.add(`${w[i]} ${w[i+1]}`);
  return set;
}
function bigramOverlap(a: string, b: string) {
  const A = bigramSet(a), B = bigramSet(b);
  const inter = [...A].filter(x => B.has(x)).length;
  return inter / Math.max(1, Math.min(A.size, B.size));
}
function dedupeFuzzy(lines: string[], threshold = 0.6) {
  const out: string[] = [];
  for (const l of lines) {
    if (!out.some(x => bigramOverlap(l, x) >= threshold)) out.push(l);
  }
  return out;
}

// ---------- HTTP ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();

    const {
      category,
      subcategory,
      tone,
      rating,
      tokens,
      customText,
      specificWords,
      specific_words
    } = payload ?? {};

    // Merge tokens with specificWords variants (exact spelling preserved)
    const uiWords = Array.isArray(specificWords) ? specificWords
                  : typeof specificWords === "string" ? [specificWords]
                  : Array.isArray(specific_words) ? specific_words
                  : typeof specific_words === "string" ? [specific_words]
                  : [];
    const baseTokens: string[] = Array.isArray(tokens) ? tokens : [];
    const mergedTokens = Array.from(new Set([...baseTokens, ...uiWords]
      .filter(Boolean)
      .map((w) => String(w).trim())));

    // If custom text provided, return it verbatim (max 4)
    if (customText && String(customText).trim()) {
      const lines = String(customText).split("\n").map((s) => s.trim()).filter(Boolean).slice(0,4);
      return new Response(JSON.stringify({ candidates: lines, success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build prompt for LLM (rules live server-side; we still hint the context)
    let prompt = text_rules;
    if (category) {
      prompt += "\n\nCATEGORY: " + category;
      if (subcategory) prompt += " > " + subcategory;
    }
    if (tone) prompt += "\n\nTONE: " + tone;
    const normRating = normalizeRating(rating);
    prompt += "\n\nRATING: " + normRating;
    if (mergedTokens.length) prompt += "\n\nTOKENS TO INCLUDE: " + mergedTokens.join(", ");

    // subtle birthday nudge
    const isBirthday = (category || "").toLowerCase().startsWith("celebrations") && /birthday/i.test(subcategory || "");
    if (isBirthday) {
      prompt += "\n\nHUMOR NUDGE — BIRTHDAY\n- Prefer oddly-specific birthday props (cake collapse, fire-hazard candles, sagging balloons, confetti cleanup, wish inflation).\n- Avoid cliché \"trip around the sun\" or bodily function jokes.\n- One sentence only; land the punch in the last 3–6 words.";
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY not configured");

    async function callOnce(): Promise<string[]> {
      const completion = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + openaiApiKey },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 800,
          messages: [
            { role: "system", content: "You are a witty copywriter. Follow the provided rules exactly and output exactly 4 lines, one sentence per line, no numbering or bullets." },
            { role: "user", content: prompt }
          ]
        })
      });
      if (!completion.ok) {
        const t = await completion.text().catch(() => "");
        throw new Error("OpenAI API error: " + completion.status + " " + t.slice(0,300));
      }
      const data = await completion.json();
      const raw = data?.choices?.[0]?.message?.content ?? "";
      return String(raw)
        .split("\n")
        .map((l: string) => l.trim().replace(/^[-•*]\s*/, "")) // drop bullets
        .filter((l: string) => l && !/^\d+\.?\s/.test(l) && !GREETING.test(l)) // drop numbering & greetings
        .slice(0, 4);
    }

    // Generate
    let lines = await callOnce();

    // --------- Post-process enforcement ----------
    const tokenList = mergedTokens.map((t: string) => String(t).trim()).filter(Boolean);
    const primaryToken = tokenList[0];

    lines = lines.map((l: string) => l.trim())
      .filter((l: string) => !QNA_START.test(l))     // drop Q&A scaffolds
      .map(oneSentenceOnly)
      .map(punctFix)
      .map(endPunct)
      .map((l: string) => enforceRating(l, normRating))
      .map((l: string) => deAdjacentProfanity(l, tokenList)) // no swear next to tokens
      .map((l: string) => {
        // ensure tokens in every line
        if (tokenList.length) {
          for (const tok of tokenList) {
            const re = new RegExp("\\b" + tok + "\\b", "i");
            if (!re.test(l)) {
              const words = l.replace(/[.?!]\s*$/, "").split(" ");
              const idx = Math.max(1, Math.min(words.length - 2, Math.floor(words.length / 2)));
              words.splice(idx, 0, tok);
              l = endPunct(words.join(" "));
            }
          }
        }
        // punctuation budget
        if (countPunc(l) > 3) {
          let kept = 0;
          l = l.replace(/[.,?!]/g, (m) => (++kept <= 3 ? m : ""));
        }
        return l;
      });

    // token position variety if one token
    if (primaryToken && lines.length) lines = varyInsertPositions(lines, primaryToken);

    // length variety buckets
    const idxs = [0,1,2,3].sort(() => Math.random() - 0.5);
    lines = lines.map((l, i) => normalizeLength(l, LENGTH_BUCKETS[idxs[i % LENGTH_BUCKETS.length]]));

    // de-dup near-copies
    lines = dedupeFuzzy(lines, 0.6);

    // If we lost lines (dropped Q&A or dupes), regenerate once to backfill
    if (lines.length < 4) {
      const more = await callOnce();
      const needed = 4 - lines.length;
      lines = [...lines, ...more.slice(0, needed)].slice(0,4);
      lines = lines.map(oneSentenceOnly).map(punctFix).map(endPunct).map((l) => enforceRating(l, normRating));
      if (primaryToken) lines = varyInsertPositions(lines, primaryToken);
    }

    const linesOut = lines.map((l) => ({ line: l }));

    return new Response(JSON.stringify({
      success: true,
      lines: linesOut,
      model: "openai:gpt-4o-mini",
      count: linesOut.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in generate-text function:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
