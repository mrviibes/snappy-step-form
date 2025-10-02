import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  TONE_HINTS, RATING_HINTS, VIIBE_TEXT_SCHEMA,
  categoryAdapter, ratingAdapter, batchCheck,
  type TaskObject, type Tone, type Rating
} from "../_shared/text-rules.ts";

const HOUSE_RULES = `You generate 4 short, punchy lines for image overlays (40–120 chars each).
Return valid JSON matching the schema. No meta-commentary. Follow tone/rating hints exactly.
Use rhetorical devices (misdirection, contrast, escalation, understatement). End each line with punctuation.
If insert_words are provided and mode is "per_line", use each word in a separate line.
If mode is "at_least_one", use at least one insert_word across all lines.
Avoid forbidden_terms and avoid_terms. For birthdays, always mention "birthday" explicitly.`;


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
  async function callModel(inputPayload: any) {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: HOUSE_RULES,
        input: JSON.stringify(inputPayload),
        modalities: ["text"],
        text: {
          format: "json_schema",
          json_schema: VIIBE_TEXT_SCHEMA
        },
        max_output_tokens: 600
      })
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error(`OpenAI API error ${resp.status}:`, body);
      throw new Error(`OpenAI ${resp.status}: ${body}`);
    }
    const data = await resp.json();
    const raw = data.output_text || data.output?.[0]?.content?.[0]?.text || "";
    if (!raw) throw new Error("Empty model response");
    let parsed: { lines: Array<{ text: string; device: string; uses_insert_words: boolean }> };
    try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid JSON from model"); }
    return parsed.lines.map(x => x.text.trim());
  }


  let lines = await callModel(userPayload);

  // Validate batch; if issues, one guided retry
  const issues = batchCheck(lines, task);
  if (issues.length) {
    const fix = { fix_hint: { issues, guidance: "Return JSON again with 4 lines that meet all constraints." }, task };
    lines = await callModel(fix);
  }


// Final check and crop
const finalIssues = batchCheck(lines, task);
if (finalIssues.length) {
lines = lines.slice(0, 4);
} else {
lines = lines.slice(0, 4);
}


return new Response(JSON.stringify({
success: true,
options: lines, // simple array for the frontend
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