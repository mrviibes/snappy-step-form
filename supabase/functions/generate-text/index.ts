import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  general_text_rules,
  celebration_text_rules,
  joke_text_rules, 
  celebrations_text_rules, 
  daily_life_text_rules, 
  sports_text_rules, 
  pop_culture_text_rules, 
  miscellaneous_text_rules,
  custom_design_text_rules
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** ---- Celebration rules block lives in ../_shared/text-rules.ts ---- */

// ---------------- Types ----------------
interface GeneratePayload {
  category: string;
  subcategory?: string;
  theme?: string;           // deepest leaf (preferred)
  tone?: string;
  rating?: string;
  insertWords?: string[];   // e.g., ["Jesse"]
}

// ---------------- Helpers (post-processing guards) ----------------
const MAX_LEN = 120;

function clampLen(s: string, n = MAX_LEN): string {
  if ((s || "").length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,\s]*$/, "") + ".";
}

function ensureEndPunct(s: string): string {
  return /[.!?]$/.test(s) ? s : s + ".";
}

// Remove duplicate commas, leading commas, enforce space after comma
function tidyCommas(s: string): string {
  let out = s.replace(/^\s*,\s*/g, "");          // leading comma
  out = out.replace(/,\s*,+/g, ", ");            // double+ commas
  out = out.replace(/,\s*/g, ", ");              // space after comma
  out = out.replace(/\s+,/g, ",");               // no space before comma
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

// limit . , ? ! to two total
function limitPunctPerLine(s: string): string {
  const allowed = new Set([".", ",", "!", "?"]);
  let count = 0, out = "";
  for (const ch of s) {
    if (allowed.has(ch)) {
      count++;
      if (count <= 2) out += ch;
      continue;
    }
    out += ch;
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

// Insert a specific word once, placed mid-sentence when possible
function placeWordNaturally(line: string, word: string): string {
  if (!word) return line;
  // remove existing instances
  const rx = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
  let s = line.replace(rx, "").replace(/\s{2,}/g, " ").trim();

  // try to insert after first comma; else after first word
  const hasComma = s.includes(",");
  if (hasComma) {
    return s.replace(",", `, ${word},`).replace(/,,/g, ",");
  }
  const firstSpace = s.indexOf(" ");
  if (firstSpace > 0) {
    s = s.slice(0, firstSpace) + " " + word + s.slice(firstSpace);
  } else {
    s = word + " " + s;
  }
  return s;
}

// distribute Specific Words: exactly one per line, placed naturally
function distributeSpecificWords(lines: string[], words: string[]): string[] {
  if (!words.length) return lines;
  const norm = words.map(w => (w || "").trim()).filter(Boolean);
  return lines.map((line, i) => {
    const placed = placeWordNaturally(line, norm[i % norm.length]);
    const cleaned = ensureEndPunct(tidyCommas(placed));
    return cleaned;
  });
}

function enforceLeafPresence(s: string, leafTokens: string[]): string {
  if (!leafTokens.length) return s;
  const low = s.toLowerCase();
  const present = leafTokens.some(t => low.includes(t));
  if (present) return s;
  const add = leafTokens.find(t => t.length > 3) || leafTokens[0];
  return add ? s.replace(/\.$/, "") + `, ${add}.` : s;
}

// Basic duplicate bigram dampener across lines
function dampenDuplicatePairs(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.map((line, idx) => {
    const tokens = line.toLowerCase().replace(/[^a-z0-9\s’'-]/gi, "").split(/\s+/).filter(Boolean);
    const bigrams = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) bigrams.add(tokens[i] + " " + tokens[i + 1]);
    const overlap = [...bigrams].some(b => seen.has(b));
    for (const b of bigrams) seen.add(b);
    if (!overlap) return line;
    const add = ["today", "tonight", "this year", "right now"][idx % 4];
    let s = line.replace(/\.$/, "") + ` ${add}.`;
    return clampLen(s);
  });
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -------- Rating enforcement (hard, with natural weaving) --------
const R_WORDS = ["fuck","fucking","shit","bullshit"]; // no slurs
const PG13_ALLOWED = ["hell","damn"];
const PG_CENSOR = [/fuck/gi,/shit/gi,/bullshit/gi,/fucking/gi];

function containsAny(s: string, list: string[]) {
  const low = s.toLowerCase();
  return list.some(w => low.includes(w));
}

// For R: weave profanity after a known name if present; else after first comma; else after first word.
function weaveProfanity(line: string, names: string[]): string {
  const hasProf = containsAny(line, R_WORDS);
  if (hasProf) return line;

  // try after a provided name (e.g., Jesse)
  for (const name of names) {
    const rx = new RegExp(`\\b(${escapeRegExp(name)})\\b(?!\\s+fuck|\\s+fucking)`, "i");
    if (rx.test(line)) {
      return line.replace(rx, `$1 fuck`);
    }
  }
  // else after first comma
  if (line.includes(",")) return line.replace(",", ", you lucky fuck,").replace(/,,/g, ",");
  // else after first word
  const i = line.indexOf(" ");
  return i > 0 ? line.slice(0, i) + " fuck" + line.slice(i) : line + " fuck";
}

function censorPG(s: string) {
  let out = s;
  for (const rx of PG_CENSOR) out = out.replace(rx, (m) => m[0] + "**" + (m.length > 1 ? m.slice(-1) : ""));
  return out;
}

function enforceRatingLine(s: string, rating: string, names: string[]): string {
  let line = s.trim();

  if (/^R$/i.test(rating)) {
    line = weaveProfanity(line, names);
  } else if (/^PG-?13$/i.test(rating)) {
    line = censorPG(line);
    for (const w of R_WORDS) {
      const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
      line = line.replace(rx, "");
    }
    line = line.replace(/\s{2,}/g," ").trim();
  } else if (/^PG$/i.test(rating)) {
    line = censorPG(line);
  } else if (/^G$/i.test(rating)) {
    for (const w of [...R_WORDS, ...PG13_ALLOWED]) {
      const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
      line = line.replace(rx, "");
    }
    line = line.replace(/\s{2,}/g," ").trim();
  }

  // punctuation + comma hygiene + length + final period
  line = tidyCommas(line);
  line = limitPunctPerLine(line);
  line = clampLen(line);
  line = ensureEndPunct(line);
  return line;
}

// -------------- Server --------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: GeneratePayload = await req.json();
    const { category, subcategory, tone, rating, insertWords = [], theme } = payload;
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // Compute leaf focus tokens
    const leaf = (theme || subcategory || "").trim();
    const leafTokens = leaf
      .toLowerCase()
      .split(/[^\p{L}\p{N}’'-]+/u)
      .filter(w => w.length > 2);

    // Select rule block by category (singular + plural) and expose which is used
    const cat = (category || "").toLowerCase();
    let used_rules = "general_text_rules";
    let systemPrompt = general_text_rules;

    if (/\bjoke(s)?\b/.test(cat)) {
      systemPrompt = joke_text_rules; used_rules = "joke_text_rules";
    } else if (/\bcelebration(s)?\b/.test(cat)) {
      systemPrompt = celebration_text_rules; used_rules = "celebration_text_rules";
    } else if (/\bdaily\b/.test(cat)) {
      systemPrompt = daily_life_text_rules; used_rules = "daily_life_text_rules";
    } else if (/\bsport(s)?\b/.test(cat)) {
      systemPrompt = sports_text_rules; used_rules = "sports_text_rules";
    } else if (/\b(pop|culture|pop[-\s]?culture)\b/.test(cat)) {
      systemPrompt = pop_culture_text_rules; used_rules = "pop_culture_text_rules";
    } else if (/\bmisc\b/.test(cat)) {
      systemPrompt = miscellaneous_text_rules; used_rules = "miscellaneous_text_rules";
    } else if (/\b(custom|design)\b/.test(cat)) {
      systemPrompt = custom_design_text_rules; used_rules = "custom_design_text_rules";
    }

    // Context + format
    systemPrompt += `
CONTEXT
- CATEGORY: ${category || "n/a"}
- SUBCATEGORY: ${subcategory || "n/a"}
- THEME (LEAF FOCUS): ${leaf || "n/a"}

CRITICAL FORMAT: Return exactly 4 separate lines. Each line must be a complete sentence ending with punctuation. Use newline characters between each line. Do not write paragraphs or combine multiple sentences on one line.`;

    // User prompt (short, strict)
    let userPrompt =
      `Write 4 ${(tone || "Humorous")} one-liners that clearly center on "${leaf || "the selected theme"}".`;
    if (/\bjokes?\b/i.test(cat)) {
      userPrompt += ` Never say humor labels (dad-joke, pun, joke/jokes); imply the style only.`;
    }
    if (insertWords.length) {
      userPrompt += ` Each line must naturally include exactly one of: ${insertWords.join(", ")}.`;
    }
    userPrompt += ` One sentence per line, ≤2 punctuation marks, ≤120 characters.`;
    userPrompt += ` Keep lines celebratory and FOR the honoree; witty, concrete, occasion-specific.`;

    // Call Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]}],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse raw → lines (exactly 4)
    let lines = generatedText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && !/^(output|line|option|\d+[\.\):])/i.test(l));

    // If the model returned paragraphs, split on bullets or sentences
    if (lines.length < 4) {
      const fallback = generatedText
        .replace(/\r/g," ")
        .replace(/\n/g," ")
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 10);
      lines = fallback.slice(0, 4);
    }

    // Pad to exactly 4 if needed
    while (lines.length < 4) {
      lines.push(`${leaf || "Today"} is unforgettable.`);
    }
    lines = lines.slice(0, 4);

    // Post-process: apply all guards
    lines = lines.map(line => {
      let s = line.trim();
      s = tidyCommas(s);
      s = limitPunctPerLine(s);
      s = clampLen(s);
      s = enforceLeafPresence(s, leafTokens);
      s = enforceRatingLine(s, rating || "G", insertWords);
      return s;
    });

    // Distribute specific words naturally (if provided)
    if (insertWords.length) {
      lines = distributeSpecificWords(lines, insertWords);
    }

    // Dampen duplicate bigrams
    lines = dampenDuplicatePairs(lines);

    // Final cleanup
    lines = lines.map(s => ensureEndPunct(tidyCommas(s.trim())));

    return new Response(
      JSON.stringify({ 
        lines, 
        used_rules,
        debug: { category, subcategory, theme, tone, rating, insertWords }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-text:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
