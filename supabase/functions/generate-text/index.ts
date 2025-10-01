import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  general_text_rules,
  celebration_text_rules,
  joke_text_rules,
  daily_life_text_rules,
  sports_text_rules,
  pop_culture_text_rules,
  miscellaneous_text_rules,
  custom_design_text_rules,
  TONE_TAGS,
  RATING_TAGS
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Types ----------
interface GeneratePayload {
  category: string;
  subcategory?: string;
  theme?: string;
  tone?: string;     // e.g., "humorous"
  rating?: string;   // G | PG | PG-13 | R
  insertWords?: string[]; // e.g., ["Jesse"]
}

// ---------- Tiny helpers (keep it light) ----------
const MAX_LEN = 120;

function trimLine(s = ""): string {
  return s.replace(/\s+/g, " ").trim();
}
function endPunct(s = ""): string {
  return /[.!?]$/.test(s) ? s : s + ".";
}
function capLen(s = "", n = MAX_LEN): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(" ");
  return (i > 40 ? cut.slice(0, i) : cut).replace(/[,\s]*$/, "") + ".";
}
function ensureInsertOnce(s: string, word: string): string {
  if (!word) return s;
  const rx = new RegExp(`\\b${escapeRE(word)}\\b`, "i");
  const possRx = new RegExp(`\\b${escapeRE(word)}'s\\b`, "i");
  const has = rx.test(s) || possRx.test(s);
  if (has) return s;
  // Prefer after the first comma or after first token
  if (s.includes(",")) return s.replace(",", `, ${word},`);
  const j = s.indexOf(" ");
  return (j > 0) ? s.slice(0, j) + " " + word + s.slice(j) : `${word} ${s}`;
}
function escapeRE(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Very light rating normalization (we let the model do most thinking)
function normalizeByRating(s: string, rating: string): string {
  let out = s;

  // Fix asterisk/space-mangled strong words when R (don’t add new swears)
  if (rating === "R") {
    out = out
      .replace(/\bf\*\*k(ing|er|ed|s)?\b/gi, "fuck$1")
      .replace(/\bs\*\*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
      .replace(/\bbull\*\*t\b/gi, "bullshit")
      .replace(/\bf\s*k(ing|er|ed|s)?\b/gi, "fuck$1")
      .replace(/\bs\s*t(ting|ty|face(?:d)?|s|ted)?\b/gi, "shit$1")
      .replace(/\bbull\s*shit\b/gi, "bullshit")
      .replace(/\b(fuck|shit|bullshit)[.!?]\s*$/i, "$1, champ"); // not last word vibe
    return out;
  }

  // PG-13: remove stronger words; allow hell/damn; ban goddamn
  if (rating === "PG-13") {
    out = out
      .replace(/\bgod[-\s]?damn(ed|ing)?\b/gi, "")
      .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "")
      .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "")
      .replace(/\bbullshit\b/gi, "");
    return out.replace(/\s{2,}/g, " ").trim();
  }

  // PG: map strong words to mild fully spelled
  if (rating === "PG") {
    out = out
      .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "heck")
      .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "mess")
      .replace(/\bbullshit\b/gi, "nonsense");
    // remove medium insults
    out = out.replace(/\b(bastard|asshole|prick|dick|douche|crap)\b/gi, "");
    return out.replace(/\s{2,}/g, " ").trim();
  }

  // G: remove any profanity
  out = out
    .replace(/\bfuck(?:ing|er|ed|s)?\b/gi, "")
    .replace(/\bshit(?:ting|ty|face(?:d)?|s|ted)?\b/gi, "")
    .replace(/\bbullshit\b/gi, "")
    .replace(/\b(hell|damn|bastard|asshole|prick|dick|douche|crap)\b/gi, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function toFour(lines: string[], fallback: string): string[] {
  let L = lines.map(trimLine).filter(Boolean);
  if (L.length > 4) L = L.slice(0, 4);
  while (L.length < 4) L.push(fallback);
  return L;
}

// ---------- Server ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload: GeneratePayload = await req.json();
    const { category, subcategory, theme, tone = "", rating = "G", insertWords = [] } = payload;

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // Select minimal system rules by category
    const cat = (category || "").toLowerCase().trim();
    let systemPrompt = general_text_rules;
    if (cat === "celebrations") systemPrompt = celebration_text_rules;
    else if (cat === "jokes") systemPrompt = joke_text_rules;
    else if (cat === "daily-life" || cat === "daily life") systemPrompt = daily_life_text_rules;
    else if (cat === "sports") systemPrompt = sports_text_rules;
    else if (cat === "pop-culture" || cat === "pop culture") systemPrompt = pop_culture_text_rules;
    else if (cat === "miscellaneous") systemPrompt = miscellaneous_text_rules;
    else if (cat === "custom" || cat === "custom-design") systemPrompt = custom_design_text_rules;

    // Tiny tags the model actually uses
    const toneTag   = TONE_TAGS[(tone || "").toLowerCase()] || "clear, natural, human";
    const ratingTag = RATING_TAGS[(rating || "").toUpperCase()] || "follow content rating appropriately";

    const leaf = (theme || subcategory || "").trim() || "the selected theme";

    // Minimal user prompt: let the model think
    let userPrompt =
`Write 4 distinct one-liners about "${leaf}".
Tone: ${toneTag}. Rating: ${ratingTag}.
Constraints: 1 sentence per line; natural flow; exactly one Insert Word per line if provided; avoid clichés; keep each line specific and different.`;

    if (insertWords.length) {
      userPrompt += ` Insert Words: ${insertWords.join(", ")}. Place naturally (allow possessive), not at the very end.`;
    }

    // Call model
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]}],
          generationConfig: { temperature: 0.9, maxOutputTokens: 300 }
        })
      }
    );

    if (!res.ok) {
      const t = await res.text();
      console.error("Gemini error:", res.status, t);
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse to lines, keep it simple
    let lines = text.split("\n").map(trimLine).filter(Boolean);
    // strip accidental labels or bullets
    lines = lines.filter(l => !/^\s*(tone|rating|insert|options?|line|^\d+[\.\)]\s+)/i.test(l));

    // Ensure 4
    const fallback = `Celebrating ${leaf}.`;
    lines = toFour(lines, fallback);

    // Insert word once per line, naturally
    const name = (insertWords[0] || "").trim();
    if (name) lines = lines.map(l => ensureInsertOnce(l, name));

    // Light rating normalization
    const R = (rating || "G").toUpperCase();
    lines = lines.map(l => normalizeByRating(l, R));

    // Final tidy
    lines = lines.map(l => endPunct(capLen(trimLine(l))));

    return new Response(JSON.stringify({ options: lines }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("generate-text error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
