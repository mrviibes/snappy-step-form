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
const MODEL = "gpt-5-mini";

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
function parseJsonBlock(s: string | undefined | null) {
  if (!s) return null;
  const t = s.trim().replace(/^```json\s*|\s*```$/g, "").trim();
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a !== -1 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return null;
}

function pickLinesFromChat(data: any): string[] | null {
  const ch = Array.isArray(data?.choices) ? data.choices[0] : null;
  const msg = ch?.message;

  // Structured outputs place object here
  if (msg?.parsed && Array.isArray(msg.parsed.lines)) return msg.parsed.lines;

  // Textual JSON fallback
  if (typeof msg?.content === "string") {
    const obj = parseJsonBlock(msg.content);
    if (obj?.lines && Array.isArray(obj.lines)) return obj.lines;
  }

  // Last-resort: tool_calls.arguments (rare with response_format)
  const tcs = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
  for (const tc of tcs) {
    const obj = parseJsonBlock(tc?.function?.arguments);
    if (obj?.lines && Array.isArray(obj.lines)) return obj.lines;
  }
  return null;
}

async function callOnceChatJSON(system: string, userObj: unknown, apiKey: string, maxTokens = 256, abortMs = 22000) {
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

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(userObj) }
    ],
    response_format: { type: "json_schema", json_schema: schema },
    max_completion_tokens: maxTokens
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort("timeout"), abortMs);

  try {
    const r = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const raw = await r.text();
    if (r.status === 402) throw new Error("Payment required or credits exhausted");
    if (r.status === 429) throw new Error("Rate limited, please try again later");
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${raw.slice(0, 600)}`);

    const data = JSON.parse(raw);
    const lines = pickLinesFromChat(data);
    if (lines && lines.length === 4) return lines;

    const reason = data?.choices?.[0]?.message?.refusal
      || data?.incomplete_details?.reason
      || data?.choices?.[0]?.finish_reason;
    if (reason) throw new Error(`Provider reason: ${String(reason)}`);

    throw new Error("No lines returned");
  } finally {
    clearTimeout(t);
  }
}

// ---------- hedged request orchestrator ----------
async function callFastWithHedge(system: string, userObj: unknown, apiKey: string) {
  // Primary starts now
  const p1 = callOnceChatJSON(system, userObj, apiKey, 256, 22000);

  // Hedge fires after 3s with slightly larger budget to beat tail latency
  const p2 = new Promise<string[]>((resolve, reject) => {
    const timer = setTimeout(async () => {
      try { resolve(await callOnceChatJSON(system, userObj, apiKey, 320, 22000)); }
      catch (e) { reject(e); }
    }, 3000);
    // If p1 wins, cancel hedge timer
    p1.finally(() => clearTimeout(timer));
  });

  // Whichever returns first wins
  try {
    return await Promise.race([p1, p2]);
  } catch (e1) {
    // If primary failed instantly, await hedge result too
    try { return await p2; }
    catch (e2) { throw e1; }
  }
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

    const lines = await callFastWithHedge(SYSTEM, userPayload, OPENAI_API_KEY);

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
