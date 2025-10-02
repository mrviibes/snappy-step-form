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

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  // Self-test endpoint
  const url = new URL(req.url);
  if (url.searchParams.get("selftest") === "1") {
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
      const lines = await callModelResilient(sample, OPENAI_API_KEY);
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


  // ---- Resilient OpenAI caller (tries both schema shapes) ----
  async function callModelResilient(inputPayload: any, apiKey: string): Promise<string[]> {
    const baseBody = {
      model: "gpt-5-mini",
      instructions: HOUSE_RULES,
      input: JSON.stringify(inputPayload),
      max_output_tokens: 600
    };

    // Helper to make the actual API call
    async function call(body: any, shape: string) {
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${text}`);
      
      const data = JSON.parse(text);
      let parsed: any = null;

      if (data.output_parsed) {
        parsed = data.output_parsed;
      } else {
        // Try extracting text from multiple possible locations
        let raw = data.output_text || "";
        if (!raw) {
          // Try scanning all content items
          const contentTexts = (data.output ?? [])
            .flatMap((o: any) => o.content ?? [])
            .map((c: any) => c.text)
            .filter(Boolean);
          raw = contentTexts.join("");
        }
        
        if (!raw) {
          console.error("Empty model response. Available keys:", Object.keys(data));
          throw new Error(`Empty model response (keys: ${Object.keys(data).join(", ")})`);
        }
        
        // Safe JSON parsing with code fence stripping
        try {
          parsed = JSON.parse(raw);
        } catch {
          // Strip code fences and retry
          const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
          parsed = JSON.parse(stripped);
        }
      }

      if (!parsed?.lines?.length) throw new Error("No lines returned");
      const lines = parsed.lines.map((x: any) => String(x.text || "").trim());
      console.log(`✓ Shape ${shape} succeeded`);
      return lines;
    }

    // Shape A: nested json_schema
    const bodyA = {
      ...baseBody,
      text: {
        format: {
          type: "json_schema",
          json_schema: VIIBE_TEXT_SCHEMA
        }
      }
    };

    // Shape B: flattened fields
    const bodyB = {
      ...baseBody,
      text: {
        format: {
          type: "json_schema",
          name: VIIBE_TEXT_SCHEMA.name,
          schema: VIIBE_TEXT_SCHEMA.schema,
          strict: VIIBE_TEXT_SCHEMA.strict
        }
      }
    };

    // Try Shape A first
    try {
      return await call(bodyA, "A");
    } catch (e: any) {
      const msg = String(e?.message || "");
      const wantsB = /format\.name|missing required parameter.+format\.name|json_schema.+unsupported|unknown parameter.+json_schema/i.test(msg);
      if (!wantsB) throw e;
      console.log("Shape A failed, trying Shape B");
    }

    // Try Shape B
    try {
      return await call(bodyB, "B");
    } catch (e: any) {
      const msg = String(e?.message || "");
      const wantsLoose = /(format|json_schema|response_format|unsupported parameter|unknown parameter|Empty model response|No lines returned)/i.test(msg);
      if (!wantsLoose) throw e;
      console.log("Shape B failed, trying loose mode");
    }

    // Final fallback: loose mode (no schema)
    const bodyLoose = {
      ...baseBody,
      instructions: HOUSE_RULES + "\nReturn ONLY JSON matching { lines: [{ text, device, uses_insert_words }] }. No extra text."
    };
    return await call(bodyLoose, "Loose");
  }

  let lines = await callModelResilient(userPayload, OPENAI_API_KEY);

  // Validate batch; if issues, one guided retry
  const issues = batchCheck(lines, task);
  if (issues.length) {
    const fix = { fix_hint: { issues, guidance: "Return JSON again with 4 lines that meet all constraints." }, task };
    lines = await callModelResilient(fix, OPENAI_API_KEY);
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