import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  TONE_HINTS, RATING_HINTS,
  buildHouseRules,
  categoryAdapter, ratingAdapter,
  type TaskObject, type Tone, type Rating
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

// Minimal anchors map (expand as needed)
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

// ---------- helpers ----------
function tryParseJson(s: unknown) {
  if (typeof s !== "string") return null;
  const trimmed = s.trim().replace(/^```json\s*|\s*```$/g, "").trim();
  try { return JSON.parse(trimmed); } catch { /* try slice */ }
  const start = trimmed.indexOf("{"), end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch {}
  }
  return null;
}

function extractLinesFromChat(data: any): string[] | null {
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const msg = choice?.message;

  // Structured outputs: the parsed object is here
  if (msg?.parsed && typeof msg.parsed === "object" && Array.isArray(msg.parsed.lines)) {
    return msg.parsed.lines;
  }

  // Fallback: content string that contains JSON
  if (typeof msg?.content === "string") {
    const obj = tryParseJson(msg.content);
    if (obj?.lines && Array.isArray(obj.lines)) return obj.lines;
  }

  // Last resort: tool_calls (if the model ignored response_format, rare)
  const tcs = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
  for (const tc of tcs) {
    const obj = tryParseJson(tc?.function?.arguments);
    if (obj?.lines && Array.isArray(obj.lines)) return obj.lines;
  }

  return null;
}

async function callOpenAIOnce(SYSTEM: string, userJson: unknown, apiKey: string, maxTokens = 256) {
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
          items: { type: "string", minLength: 18, maxLength: 120, pattern: "[.!?]$" }
        }
      }
    }
  };

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(userJson) }
    ],
    response_format: { type: "json_schema", json_schema: schema },
    max_tokens: maxTokens
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), 25000); // return before UI's 30s guardrail

  let resp: Response;
  try {
    resp = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = await resp.text();

  if (resp.status === 402) throw new Error("Payment required or credits exhausted");
  if (resp.status === 429) throw new Error("Rate limited, please try again later");
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${raw.slice(0, 600)}`);

  let data: any = null;
  try { data = JSON.parse(raw); } catch { throw new Error("Provider returned non-JSON"); }

  const lines = extractLinesFromChat(data);
  if (lines && Array.isArray(lines) && lines.length === 4) return { lines, data };

  // Surface real cause if any
  const reason =
    data?.choices?.[0]?.message?.refusal ||
    data?.incomplete_details?.reason ||
    data?.choices?.[0]?.finish_reason;
  if (reason) throw new Error(`Provider reason: ${String(reason)}`);

  throw new Error(`No lines found. Keys: ${Object.keys(data || {}).slice(0, 12).join(", ")}`);
}

// ---------- HTTP handler ----------
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
    const insert_words = (Array.isArray(body.insertWords) ? body.insertWords : []).slice(0, 2);
    const insert_word_mode = body.insertWordMode || "per_line";

    // Anchors for Movies (only if needed)
    let anchors: string[] = Array.isArray(body.movieAnchors) ? body.movieAnchors.filter(Boolean) : [];
    const root = category.toLowerCase();
    const leaf = subcategory.toLowerCase();
    if (!anchors.length && (root === "pop culture" || root === "pop-culture") && leaf === "movies") {
      anchors = MOVIE_ANCHORS[theme.toLowerCase()] || [];
    }

    // Base task & adapters
    const baseTask: TaskObject = {
      tone, rating, category_path, topic,
      layout: body.layout, style: body.style, dimensions: body.dimensions,
      insert_words, insert_word_mode,
      avoid_terms: [...(body.avoidTerms || [])],
      anchors,
      require_anchors: anchors.length > 0
    };

    let task: TaskObject = { ...baseTask, ...categoryAdapter(baseTask), ...ratingAdapter(baseTask) };

    // If "birthday required", make sure it's not accidentally in avoid_terms
    if (task.birthday_explicit && task.avoid_terms) {
      task.avoid_terms = task.avoid_terms.filter(t => !/(birthday|b-day)/i.test(t));
    }

    // Minimal system message: let the model do the heavy lifting
    const SYSTEM = buildHouseRules(
      TONE_HINTS[tone],
      RATING_HINTS[rating],
      anchors.length ? anchors.slice(0, 6) : undefined // keep it small for speed
    );

    const userPayload = {
      version: "viibe-text",
      tone_hint: TONE_HINTS[tone],
      rating_hint: RATING_HINTS[rating],
      task
    };

    // single fast call (256 tokens). This avoids the "length" trims we saw at 160.
    const { lines } = await callOpenAIOnce(SYSTEM, userPayload, OPENAI_API_KEY, 2048);

    return new Response(JSON.stringify({
      success: true,
      options: lines,
      model: MODEL,
      count: lines.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("generate-text error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: (err as Error).message || "failed"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
