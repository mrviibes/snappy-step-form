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

  // Self-test endpoint
  const url = new URL(req.url);
  if (url.searchParams.get("selftest") === "1") {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const sample = {
      version: "viibe-text-v3",
      tone_hint: TONE_HINTS.humorous,
      rating_hint: RATING_HINTS["PG-13"],
      task: {
        tone: "humorous" as Tone,
        rating: "PG-13" as Rating,
        category_path: ["celebrations", "birthday"],
        topic: "Birthday",
        insert_words: ["Jesse"],
        insert_word_mode: "per_line" as const,
        avoid_terms: ["special day", "trip around the sun"]
      }
    };
    
    try {
      async function callModelTest(inputPayload: any) {
        const resp = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5-mini",
            instructions: HOUSE_RULES,
            input: JSON.stringify(inputPayload),
            text: {
              format: {
                type: "json_schema",
                name: VIIBE_TEXT_SCHEMA.name,
                schema: VIIBE_TEXT_SCHEMA.schema,
                strict: VIIBE_TEXT_SCHEMA.strict
              }
            },
            max_output_tokens: 600
          })
        });
        if (!resp.ok) {
          const body = await resp.text();
          throw new Error(`OpenAI ${resp.status}: ${body}`);
        }
        const data = await resp.json();
        const raw = data.output_text || data.output?.[0]?.content?.[0]?.text || "";
        if (!raw) throw new Error("Empty model response");
        const parsed = JSON.parse(raw);
        return parsed.lines.map((x: any) => String(x.text || "").trim());
      }

      const lines = await callModelTest(sample);
      return new Response(JSON.stringify({ ok: true, lines }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }

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
  const defaults = [category, subcategory, theme]
    .map(s => (s || "").toLowerCase())
    .filter(Boolean)
    .filter(w => w !== "birthday"); // don't block what we require

  const baseTask: TaskObject = {
    tone, rating, category_path, topic,
    layout: body.layout, style: body.style, dimensions: body.dimensions,
    insert_words, insert_word_mode,
    avoid_terms: [...(body.avoidTerms || []), ...defaults]
  };


  const task: TaskObject = { ...baseTask, ...categoryAdapter(baseTask), ...ratingAdapter(baseTask) };

  // Safety: remove birthday from avoid_terms if birthday_explicit is required
  if (task.birthday_explicit && task.avoid_terms) {
    task.avoid_terms = task.avoid_terms.filter(t => !/(birthday|b-day)/i.test(t));
  }

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
        text: {
          format: {
            type: "json_schema",
            name: VIIBE_TEXT_SCHEMA.name,
            schema: VIIBE_TEXT_SCHEMA.schema,
            strict: VIIBE_TEXT_SCHEMA.strict
          }
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
    // Prefer structured output if provided by Responses API
    let parsed: { lines: Array<{ text: string; device: string; uses_insert_words: boolean }> } | null = null;

    if (data.output_parsed) {
      parsed = data.output_parsed;
    } else {
      const raw = data.output_text || data.output?.[0]?.content?.[0]?.text || "";
      if (!raw) throw new Error("Empty model response");
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Invalid JSON from model");
      }
    }

    if (!parsed?.lines?.length) throw new Error("No lines returned");
    return parsed.lines.map((x: any) => String(x.text || "").trim());
  }


  // Fallback function without structured outputs (insurance against API changes)
  async function callModelLoose(inputPayload: any) {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: HOUSE_RULES + "\nReturn ONLY JSON matching { lines: [{ text, device, uses_insert_words }] }. No extra text.",
        input: JSON.stringify(inputPayload),
        max_output_tokens: 600
      })
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`OpenAI ${resp.status}: ${body}`);
    }
    const data = await resp.json();
    const raw = data.output_text || data.output?.[0]?.content?.[0]?.text || "";
    if (!raw) throw new Error("Empty model response");
    const parsed = JSON.parse(raw);
    return parsed.lines.map((x: any) => String(x.text || "").trim());
  }

  function wantsSchemaFallback(msg: string) {
    return /format|json_schema|response_format|unsupported parameter/i.test(msg || "");
  }

  let lines: string[];
  try {
    lines = await callModel(userPayload);
  } catch (e: any) {
    if (wantsSchemaFallback(e?.message || "")) {
      console.log("Schema error detected, retrying without structured outputs");
      lines = await callModelLoose(userPayload);
    } else {
      throw e;
    }
  }

  // Validate batch; if issues, one guided retry
  const issues = batchCheck(lines, task);
  if (issues.length) {
    const fix = { fix_hint: { issues, guidance: "Return JSON again with 4 lines that meet all constraints." }, task };
    try {
      lines = await callModel(fix);
    } catch (e: any) {
      if (wantsSchemaFallback(e?.message || "")) {
        lines = await callModelLoose(fix);
      } else {
        throw e;
      }
    }
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