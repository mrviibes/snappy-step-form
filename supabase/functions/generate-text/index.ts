import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  TONE_HINTS, RATING_HINTS,
  buildHouseRules, pickStyleBlurb,
  categoryAdapter, ratingAdapter,
  type TaskObject, type Tone, type Rating
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5-mini"; // canonical id

// Movie anchors map (expand as needed)
const MOVIE_ANCHORS: Record<string, string[]> = {
  "billy madison": ["Billy", "Miss Lippy", "penguin", "O'Doyle", "bus", "dodgeball", "shampoo"],
  "the matrix": ["Neo", "Morpheus", "red pill", "blue pill", "Agent Smith", "bullet time", "Matrix"],
  "star wars": ["lightsaber", "Jedi", "Force", "stormtrooper", "Millennium Falcon", "Darth Vader"]
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
  movieAnchors?: string[];
};

// ---------- Fast single-call generator ----------
function extractJsonObject(resp: any): any | null {
  // 1) direct convenience fields
  const tryParse = (s: unknown) => {
    if (typeof s !== "string") return null;
    const trimmed = s.trim().replace(/^```json\s*|\s*```$/g, "").trim();
    try { return JSON.parse(trimmed); } catch { /* swallow */ }
    const start = trimmed.indexOf("{"), end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try { return JSON.parse(trimmed.slice(start, end + 1)); } catch {}
    }
    return null;
  };

  let obj = tryParse(resp?.text) || tryParse(resp?.output_text);
  if (obj?.lines) return obj;

  // 2) Responses blocks: output[].content[].json or .text
  const out = Array.isArray(resp?.output) ? resp.output : [];
  for (const o of out) {
    const parts = Array.isArray(o?.content) ? o.content : [];
    for (const p of parts) {
      if (p && typeof p.json === "object" && p.json) {
        if (p.json.lines) return p.json;
      }
      obj = tryParse(p?.text) || tryParse(p?.output_text);
      if (obj?.lines) return obj;
    }
    if (typeof o?.content === "string") {
      obj = tryParse(o.content);
      if (obj?.lines) return obj;
    }
  }

  // 3) Chat Completions style: choices[0].message.*
  const choice = Array.isArray(resp?.choices) ? resp.choices[0] : null;
  const msg = choice?.message;

  // NEW: structured outputs land here first
  if (msg?.parsed && typeof msg.parsed === "object" && msg.parsed.lines) {
    return msg.parsed;
  }

  if (typeof msg?.content === "string") {
    obj = tryParse(msg.content);
    if (obj?.lines) return obj;
  }
  if (Array.isArray(msg?.content)) {
    for (const part of msg.content) {
      if (part && typeof part.json === "object" && part.json?.lines) return part.json;
      obj = tryParse(part?.text) || tryParse(part?.output_text);
      if (obj?.lines) return obj;
    }
  }

  // 4) tool_calls[].function.arguments
  const tcs = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
  for (const tc of tcs) {
    const args = tc?.function?.arguments;
    obj = tryParse(args);
    if (obj?.lines) return obj;
  }

  return null;
}

async function callModelFast(payload: any, SYSTEM: string, apiKey: string, opts?: { maxTokens?: number }): Promise<string[]> {
  const schema = {
    name: "ViibeTextCompactV1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["lines"],
      properties: {
        lines: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: { type: "string", minLength: 28, maxLength: 120, pattern: "[.!?]$" }
        }
      }
    }
  };

  const userJson = {
    tone_hint: payload.tone_hint,
    rating_hint: payload.rating_hint,
    style_hint: pickStyleBlurb(payload.task?.tone || "humorous"),
    task: {
      tone: payload.task?.tone,
      rating: payload.task?.rating,
      category_path: payload.task?.category_path,
      topic: payload.task?.topic,
      insert_words: payload.task?.insert_words,
      insert_word_mode: payload.task?.insert_word_mode,
      avoid_terms: payload.task?.avoid_terms,
      forbidden_terms: payload.task?.forbidden_terms,
      birthday_explicit: payload.task?.birthday_explicit,
      anchors: Array.isArray(payload.task?.anchors) ? payload.task.anchors.slice(0, 8) : []
    }
  };

  const body = {
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(userJson) }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_lines",
          description: "Return exactly 4 caption lines that follow all rules.",
          parameters: schema.schema
        }
      }
    ],
    tool_choice: { type: "function", function: { name: "return_lines" } },
    parallel_tool_calls: false,
    max_completion_tokens: (opts?.maxTokens ?? 1280)
  };

  const resp = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Connection": "keep-alive"
    },
    body: JSON.stringify(body)
  });

  const raw = await resp.text();
  
  if (resp.status === 402) throw new Error("Payment required or credits exhausted");
  if (resp.status === 429) throw new Error("Rate limited, please try again later");
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${raw.slice(0, 500)}`);

  let data: any = null;
  try { data = JSON.parse(raw); } catch { throw new Error("Provider returned non-JSON"); }
  try { console.log("generate-text usage:", data?.usage || null); } catch {}

  const obj = extractJsonObject(data);
  if (!obj?.lines) {
    // provider refusal path if present
    const refusal = data?.choices?.[0]?.message?.refusal
                || data?.incomplete_details?.reason
                || data?.choices?.[0]?.finish_reason;
    if (refusal) {
      throw new Error(`Provider reason: ${String(refusal).slice(0, 300)}`);
    }

    // concise payload hint for the debug panel
    const keys = Object.keys(data || {}).slice(0, 12).join(", ");
    const snippet = JSON.stringify(data).slice(0, 500);
    throw new Error(`No lines found. Keys: ${keys}. Snippet: ${snippet}`);
  }

  const lines: string[] = obj.lines;
  if (!Array.isArray(lines) || lines.length !== 4) throw new Error("Bad line count");
  
  return lines;
}

// ---------- HTTP Handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");


  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
    const body: GeneratePayload = await req.json();

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

    // Anchors for Movies
    let anchors: string[] = Array.isArray(body.movieAnchors) ? body.movieAnchors.filter(Boolean) : [];
    const root = category.toLowerCase();
    const leaf = subcategory.toLowerCase();
    if (!anchors.length && (root === "pop culture" || root === "pop-culture") && leaf === "movies") {
      anchors = MOVIE_ANCHORS[theme.toLowerCase()] || [];
    }

    // Base task & adapters
    const defaults = [category, subcategory, theme]
      .map(s => (s || "").toLowerCase())
      .filter(Boolean)
      .filter(w => w !== "birthday");

    const baseTask: TaskObject = {
      tone, rating, category_path, topic,
      layout: body.layout, style: body.style, dimensions: body.dimensions,
      insert_words, insert_word_mode,
      avoid_terms: [...(body.avoidTerms || []), ...defaults],
      anchors,
      require_anchors: anchors.length > 0
    };

    let task: TaskObject = { ...baseTask, ...categoryAdapter(baseTask), ...ratingAdapter(baseTask) };

    // If birthday is explicit, ensure it's not in avoid_terms
    if (task.birthday_explicit && task.avoid_terms) {
      task.avoid_terms = task.avoid_terms.filter(t => !/(birthday|b-day)/i.test(t));
    }

    // Build system rules (slim & fast)
    const SYSTEM = buildHouseRules(
      TONE_HINTS[tone],
      RATING_HINTS[rating],
      anchors.length ? anchors.slice(0, 8) : undefined
    );

    const userPayload = {
      version: "viibe-text-v3",
      tone_hint: TONE_HINTS[tone],
      rating_hint: RATING_HINTS[rating],
      task
    };

    // Try once, then retry on length error with higher token budget and trimmed anchors
    let lines: string[];
    try {
      lines = await callModelFast(userPayload, SYSTEM, OPENAI_API_KEY, { maxTokens: 1280 });
    } catch (e) {
      const msg = (e as Error)?.message?.toLowerCase() || "";
      if (msg.includes("length")) {
        const trimmedTask = { ...task, anchors: Array.isArray(task.anchors) ? task.anchors.slice(0, 4) : [] };
        const retryPayload = { ...userPayload, task: trimmedTask };
        console.warn("generate-text retry: increasing token budget and trimming anchors");
        lines = await callModelFast(retryPayload, SYSTEM, OPENAI_API_KEY, { maxTokens: 1536 });
      } else {
        throw e;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      options: lines,
      model: MODEL,
      count: lines.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("generate-text error:", err);
    // Always return JSON so UI can show the real cause
    return new Response(JSON.stringify({
      success: false,
      error: (err as Error).message || "failed"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
