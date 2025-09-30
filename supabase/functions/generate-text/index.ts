import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  text_rules, 
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

interface GeneratePayload {
  category: string;
  subcategory?: string;
  theme?: string;           // deepest leaf (preferred)
  tone?: string;
  rating?: string;
  insertWords?: string[];   // e.g., ["Jesse"]
}

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

    // Select rule block by category
    const cat = (category || "").toLowerCase();
    let systemPrompt = text_rules;
    if (cat.includes("joke")) systemPrompt = joke_text_rules;
    else if (cat.includes("celebration")) systemPrompt = celebrations_text_rules;
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
      `Write 4 ${tone?.toLowerCase() || "humorous"} one-liners that clearly center on "${leaf || "the selected theme"}".`;
    if (cat === "jokes") {
      userPrompt += ` Never say humor labels (dad-joke, pun, joke/jokes); imply the style only.`;
    }
    if (insertWords.length) {
      userPrompt += ` Each line must naturally include: ${insertWords.join(", ")}.`;
    }
    userPrompt += ` One sentence per line, ≤2 punctuation marks.`;

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

    // Parse raw → lines
    let lines = generatedText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && !/^(output|line|option|\d+[\.\):])/i.test(l))
      .slice(0, 4);

    // --- Enforcements ---

    // Specific word once/line
    const specificWords = insertWords.map(w => (w || "").trim()).filter(Boolean);
    function ensureSpecificWordOnce(s: string): string {
      if (!specificWords.length) return s;
      const low = s.toLowerCase();
      const missing = specificWords.find(w => !low.includes(w.toLowerCase()));
      let out = missing ? (s.replace(/\.$/, "") + `, ${missing}.`) : s;
      // naive de-duplication if repeated
      for (const w of specificWords) {
        const rx = new RegExp(`\\b(${w})\\b([\\s\\S]*?)\\b\\1\\b`, "i");
        out = out.replace(rx, "$1$2"); // drop second occurrence
      }
      return out;
    }

    // Leaf token presence for concrete leaves
    function hasLeafToken(s: string) {
      const low = s.toLowerCase();
      return leafTokens.length ? leafTokens.some(t => low.includes(t)) : true;
    }
    const looksLikeLabel = /joke|pun|one-liner|knock|lightbulb/i.test(leaf);

    // Cliché guard for non-seasonal leaves
    const themeIsSeasonal = /fall|autumn|harvest|pumpkin|leaves?\b/i.test(leaf);
    const seasonalBan = /\b(leaf|leaves|leafy|autumn|fall foliage|pumpkin spice)\b/ig;

    lines = lines.map(l => {
      let s = l.trim();

      // keep focus on concrete leaf
      if (leaf && !looksLikeLabel && !hasLeafToken(s)) {
        const add = leafTokens.find(t => t.length > 3) || leafTokens[0] || "";
        if (add) s = `${s.replace(/\.$/, "")}, ${add}.`;
      }

      // require specific word once
      s = ensureSpecificWordOnce(s);

      // strip seasonal clichés unless leaf is seasonal
      if (!themeIsSeasonal) s = s.replace(seasonalBan, "").replace(/\s{2,}/g, " ").trim();

      // tidy punctuation
      s = s.replace(/\.\.+$/,"").replace(/\s{2,}/g," ");
      if (!/[.!?]$/.test(s)) s += ".";
      return s;
    });

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
