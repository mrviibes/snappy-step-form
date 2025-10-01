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

/** ---- RULES: Celebration (concise, 60% size) ----
 * Make sure this is present in ../_shared/text-rules.ts
 * If not, paste this export there.
 */
export const celebration_text_rules = `SYSTEM INSTRUCTIONS — SHORT ONE-LINERS FOR CELEBRATIONS

GOAL
Write 4 hilarious, personal one-liners for a special occasion.

RULES
- Exactly 4 lines, 0–120 characters each. One sentence per line, end with punctuation.
- Max 2 punctuation marks per line (. , ? !). No numbering or lists.
- Follow the given Tone and Rating. If Specific Words are provided, use each once per line.
- Focus on the honoree: celebratory, personal, and funny; centered on the occasion.
- No duplicate word pairs across the 4 lines.
- Ratings:
  G → wholesome. 
  PG → censored swears allowed. 
  PG-13 → only "hell" or "damn". 
  R → profanity required in every line (no slurs).`;

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
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,\s]*$/, "") + ".";
}

function ensureEndPunct(s: string): string {
  return /[.!?]$/.test(s) ? s : s + ".";
}

function limitPunctPerLine(s: string): string {
  // Count .,!?,
  const chars = s.split("");
  const allowed = new Set([".", ",", "!", "?"]);
  let count = 0;
  const out = chars.map((ch) => {
    if (!allowed.has(ch)) return ch;
    count++;
    if (count <= 2) return ch;
    return ""; // drop extra punctuation beyond 2
  }).join("");
  return out.replace(/\s{2,}/g, " ").trim();
}

// distribute Specific Words: exactly one per line, cycle through
function distributeSpecificWords(lines: string[], words: string[]): string[] {
  if (!words.length) return lines.map(dedupeSpecific(words));
  const normWords = words.map(w => (w || "").trim()).filter(Boolean);
  return lines.map((line, i) => {
    const target = normWords[i % normWords.length];
    let s = line;

    // Remove all occurrences of any specific word first
    for (const w of normWords) {
      const rx = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
      s = s.replace(rx, "").replace(/\s{2,}/g, " ").trim();
    }

    // Insert target once (try before final punctuation)
    s = s.replace(/[.!?]$/, "");
    if (s.length) s = s + ` ${target}`;
    else s = target;

    s = s.trim();
    s = ensureEndPunct(s);
    s = s.replace(/\s{2,}/g, " ");
    return s;
  });
}

function dedupeSpecific(words: string[]) {
  return (s: string) => {
    let out = s;
    for (const w of words) {
      const rxDup = new RegExp(`\\b(${escapeRegExp(w)})\\b([\\s\\S]*?)\\b\\1\\b`, "i");
      out = out.replace(rxDup, "$1$2"); // drop 2nd occurrence
    }
    return out;
  };
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
    for (let i = 0; i < tokens.length - 1; i++) {
      bigrams.add(tokens[i] + " " + tokens[i + 1]);
    }
    const overlap = [...bigrams].some(b => seen.has(b));
    // Mark these bigrams as seen after decision
    for (const b of bigrams) seen.add(b);

    if (!overlap) return line;
    // Light tweak: append a short, neutral differentiator
    const add = ["today", "tonight", "this year", "right now"][idx % 4];
    let s = line.replace(/\.$/, "") + ` ${add}.`;
    return clampLen(s);
  });
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

    // Select rule block by category (singular + plural)
    const cat = (category || "").toLowerCase();
    let systemPrompt = general_text_rules;
    if (cat.includes("joke")) systemPrompt = joke_text_rules;
    else if (cat.includes("celebration")) systemPrompt = celebration_text_rules;      // singular
    else if (cat.includes("celebrations")) systemPrompt = celebration_text_rules;     // plural routed to same
    else if (cat.includes("daily")) systemPrompt = daily_life_text_rules;
    else if (cat.includes("sport")) systemPrompt = sports_text_rules;
    else if (cat.includes("pop") || cat.includes("culture")) systemPrompt = pop_culture_text_rules;
    else if (cat.includes("misc")) systemPrompt = miscellaneous_text_rules;
    else if (cat.includes("custom") || cat.includes("design")) systemPrompt = custom_design_text_rules;

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
    if (cat === "jokes") {
      userPrompt += ` Never say humor labels (dad-joke, pun, joke/jokes); imply the style only.`;
    }
    if (insertWords.length) {
      userPrompt += ` Each line must naturally include exactly one of: ${insertWords.join(", ")}.`;
    }
    userPrompt += ` One sentence per line, ≤2 punctuation marks, ≤120 characters.`;

    // Call Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]}],
          generationConfig: {
            temperature: 0.7,        // tighter; fewer rambles/clichés
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
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);
      if (fallback.length >= 4) lines = fallback;
    }

    // Keep exactly 4 (pad if needed with themed stubs)
    if (lines.length > 4) lines = lines.slice(0, 4);
    while (lines.length < 4) {
      const add = leaf ? `Celebrating ${leaf} with you.` : `Celebrating you today.`;
      lines.push(add);
    }

    // --- Enforcements ---
    // Distribute Specific Word exactly once per line (cycle), then clean
    const specificWords = (insertWords || []).map(w => (w || "").trim()).filter(Boolean);
    lines = distributeSpecificWords(lines, specificWords).map(s => s.trim());

    // Leaf presence (when concrete)
    lines = lines.map(s => enforceLeafPresence(s, leafTokens));

    // Hard caps: punctuation count, end punctuation, char limit
    lines = lines.map(s => limitPunctPerLine(ensureEndPunct(clampLen(s))));

    // Basic duplicate bigram dampening
    lines = dampenDuplicatePairs(lines);

    // Final: ensure exactly 4 and formatting
    lines = lines.slice(0, 4).map(s => ensureEndPunct(clampLen(s)));

    return new Response(
      JSON.stringify({ options: lines }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-text:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Failed to generate text" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
