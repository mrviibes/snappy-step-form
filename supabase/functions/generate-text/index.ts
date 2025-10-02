import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  HOUSE_RULES,
  VIIBE_TEXT_SCHEMA,
  TONE_HINTS,
  RATING_HINTS,
  categoryAdapter,
  ratingAdapter,
  batchCheck,
  type TaskObject, type Tone, type Rating
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GeneratePayload = {
  category: string;
  subcategory?: string;
  theme?: string;
  tone?: Tone;
  rating?: Rating;
  insertWords?: string[];
  gender?: "male"|"female"|"neutral";
  layout?: "Meme Text" | "Badge Text" | "Open Space" | "In Scene";
  style?: "Auto" | "Realistic" | "General" | "Design" | "3D Render" | "Anime";
  dimensions?: "Square" | "Landscape" | "Portrait" | "Custom";
  insertWordMode?: "per_line" | "at_least_one";
  avoidTerms?: string[];
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: GeneratePayload = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    // Normalize inputs
    const category = (body.category || "").trim();
    const subcategory = (body.subcategory || "").trim();
    const theme = (body.theme || "").trim();
    const category_path = [category, subcategory].filter(Boolean);
    const topic = (theme || subcategory || category || "topic").trim();

    const tone: Tone = (body.tone || "humorous");
    const rating: Rating = (body.rating || "PG");
    const insert_words = (body.insertWords || []).slice(0, 2);
    const insert_word_mode = body.insertWordMode || "per_line";

    // Build base task and adapt
    const baseTask: TaskObject = {
      tone, rating, category_path, topic,
      layout: body.layout, style: body.style, dimensions: body.dimensions,
      insert_words, insert_word_mode,
      avoid_terms: [
        ...(body.avoidTerms || []),
        category.toLowerCase(), subcategory.toLowerCase(), theme.toLowerCase()
      ].filter(Boolean)
    };

    const task: TaskObject = { ...baseTask, ...categoryAdapter(baseTask), ...ratingAdapter(baseTask) };

    // Compose minimal user payload
    const userPayload = {
      version: "viibe-text-v3",
      tone_hint: TONE_HINTS[tone],
      rating_hint: RATING_HINTS[rating],
      task
    };

    // ---- Call OpenAI Responses API with Structured Outputs ----
    async function callModel(input: any, temp = 0.9) {
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5-mini",
          input: [
            { role: "system", content: HOUSE_RULES },
            { role: "user", content: JSON.stringify(input) }
          ],
          response_format: { type: "json_schema", json_schema: VIIBE_TEXT_SCHEMA },
          temperature: temp,
          top_p: 0.95,
          max_output_tokens: 600
        })
      });
      if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
      const data = await resp.json();
      const raw = data.output_text || data.output?.[0]?.content?.[0]?.text || "";
      if (!raw) throw new Error("Empty model response");
      let parsed: { lines: Array<{ text: string; device: string; uses_insert_words: boolean }> };
      try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid JSON from model"); }
      return parsed.lines.map(x => x.text.trim());
    }

    let lines = await callModel(userPayload, 0.9);

    // Validate batch; if issues, one guided retry
    const issues = batchCheck(lines, task);
    if (issues.length) {
      const fix = { fix_hint: { issues, guidance: "Return JSON again with 4 lines that meet all constraints." }, task };
      lines = await callModel(fix, 0.7);
    }

    // Final check and crop
    const finalIssues = batchCheck(lines, task);
    if (finalIssues.length) {
      // still return best-effort rather than implode; take first 4 sanitized lines
      lines = lines.slice(0, 4);
    } else {
      lines = lines.slice(0, 4);
    }

    return new Response(JSON.stringify({
      success: true,
      options: lines,           // simple array for your frontend
      model: "gpt-5-mini",
      count: lines.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("generate-text error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message || "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
