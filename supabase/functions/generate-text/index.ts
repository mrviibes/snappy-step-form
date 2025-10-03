import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  TONE_HINTS, RATING_HINTS,
  buildHouseRules, categoryAdapter, ratingAdapter,
  type TaskObject, type Tone, type Rating
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Primary (Responses API). If you insist on a gateway, keep it Chat-Completions-compatible.
const RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const RESPONSES_MODEL   = "gpt-5-2025-08-07";

// Optional gateway fallback (Chat Completions shape)
const GATEWAY_URL   = Deno.env.get("LOVABLE_API_URL") || "";
const GATEWAY_KEY   = Deno.env.get("LOVABLE_API_KEY") || "";
const GATEWAY_MODEL = Deno.env.get("LOVABLE_MODEL") || "google/gemini-2.5-flash";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");

type GeneratePayload = {
  category: string;
  subcategory?: string;
  theme?: string;
  tone?: Tone;
  rating?: Rating;
  insertWords?: string[];
  gender?: "male"|"female"|"neutral";
  layout?: string;
  style?: string;
  dimensions?: string;
  insertWordMode?: "per_line" | "at_least_one";
  avoidTerms?: string[];
  movieAnchors?: string[];
};

// ---------- utils ----------
function err(status: number, message: string, details?: unknown) {
  return new Response(JSON.stringify({ success: false, error: message, details: details ?? null }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function hasAny(list?: string[]) { return !!(list && list.length); }
function containsWord(s: string, w: string) { return new RegExp(`\\b${esc(w)}(?:'s)?\\b`, "i").test(s); }

function validate(lines: string[], task: TaskObject) {
  const problems: string[] = [];
  if (!Array.isArray(lines) || lines.length !== 4) problems.push("needs_4_lines");
  for (const s of lines || []) {
    if (s.length < 28 || s.length > 120) problems.push("bad_length");
    if (!/[.!?]$/.test(s)) problems.push("no_end_punct");
    if (task.birthday_explicit && !/\bbirthday|b-day\b/i.test(s)) problems.push("missing_birthday");
    if (task.require_anchors && hasAny(task.anchors)) {
      const hit = task.anchors!.some(a => new RegExp(`\\b${esc(a)}\\b`, "i").test(s));
      if (!hit) problems.push("missing_anchor");
    }
  }
  if (task.insert_words?.length && task.insert_word_mode === "at_least_one") {
    const ok = task.insert_words.some(w => lines.some(l => containsWord(l, w)));
    if (!ok) problems.push("missing_insert_word");
  }
  return problems.length === 0 ? null : problems;
}

// ---------- OpenAI Responses API call ----------
async function callResponsesAPI(SYSTEM: string, userJson: unknown, maxTokens = 640) {
  console.log("[callResponsesAPI] Starting call with maxTokens:", maxTokens);
  if (!OPENAI_KEY) {
    console.error("[callResponsesAPI] OPENAI_API_KEY is not configured!");
    throw new Error("OPENAI_API_KEY not configured");
  }

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
    model: RESPONSES_MODEL,
    input: [
      { role: "system", content: SYSTEM },
      { role: "user",   content: JSON.stringify(userJson) }
    ],
    max_output_tokens: maxTokens,
    text: {
      format: {
        type: "json_schema",
        name: "ViibeTextCompactV1",
        json_schema: schema
      }
    }
  };

  const ctl = new AbortController();
  const tId = setTimeout(() => ctl.abort("timeout"), 45_000);

  let resp: Response;
  try {
    resp = await fetch(RESPONSES_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: ctl.signal
    });
  } finally { clearTimeout(tId); }

  const raw = await resp.text();
  console.log("[callResponsesAPI] Received response, status:", resp.status);
  
  if (resp.status === 402) {
    console.error("[callResponsesAPI] Payment required (402)");
    throw new Error("Payment required or credits exhausted");
  }
  if (resp.status === 429) {
    console.error("[callResponsesAPI] Rate limited (429)");
    throw new Error("Rate limited");
  }
  if (!resp.ok) {
    console.error("[callResponsesAPI] OpenAI error response:", raw.slice(0, 800));
    throw new Error(`OpenAI ${resp.status}: ${raw.slice(0, 800)}`);
  }

  const data = JSON.parse(raw);

  // Preferred: parsed
  if (data.output_parsed?.lines && Array.isArray(data.output_parsed.lines)) {
    return data.output_parsed.lines as string[];
  }

  // Fallback: first output_text contains JSON
  const blocks = data.output?.[0]?.content || [];
  const text = blocks.find((b: any) => b.type === "output_text")?.text ?? "";
  if (text) {
    try {
      const obj = JSON.parse(text);
      if (obj?.lines && Array.isArray(obj.lines)) return obj.lines;
    } catch {}
  }

  throw new Error("No lines parsed from Responses API");
}

// ---------- Optional: Gateway (Chat Completions shape) ----------
async function callGateway(SYSTEM: string, userJson: unknown, maxTokens = 512) {
  console.log("[callGateway] Starting gateway call with maxTokens:", maxTokens);
  if (!GATEWAY_URL || !GATEWAY_KEY) {
    console.error("[callGateway] Gateway not configured (URL or KEY missing)");
    throw new Error("Gateway not configured");
  }

  const body = {
    model: GATEWAY_MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user",   content: JSON.stringify(userJson) }
    ],
    max_tokens: maxTokens,
    tools: [{
      type: "function",
      function: {
        name: "return_lines",
        description: "Return exactly 4 lines, 28–120 chars each, end with . ! or ?",
        parameters: {
          type: "object",
          required: ["lines"],
          properties: {
            lines: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } }
          }
        }
      }
    }],
    tool_choice: { type: "function", function: { name: "return_lines" } }
  };

  const ctl = new AbortController();
  const tId = setTimeout(() => ctl.abort("timeout"), 45_000);

  let resp: Response;
  try {
    resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GATEWAY_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: ctl.signal
    });
  } finally { clearTimeout(tId); }

  const raw = await resp.text();
  console.log("[callGateway] Received response, status:", resp.status);
  
  if (resp.status === 402) {
    console.error("[callGateway] Payment required (402)");
    throw new Error("Payment required or credits exhausted");
  }
  if (resp.status === 429) {
    console.error("[callGateway] Rate limited (429)");
    throw new Error("Rate limited");
  }
  if (!resp.ok) {
    console.error("[callGateway] Gateway error response:", raw.slice(0, 400));
    throw new Error(`Gateway ${resp.status}: ${raw.slice(0, 400)}`);
  }

  const data = JSON.parse(raw);
  const tool = data.choices?.[0]?.message?.tool_calls?.[0];
  if (tool?.function?.arguments) {
    const args = JSON.parse(tool.function.arguments);
    if (Array.isArray(args?.lines)) {
      return args.lines.map((s: string) => /[.!?]$/.test(s) ? s : s.trim() + ".");
    }
  }

  // fallback: try plain content parse
  const content = data.choices?.[0]?.message?.content || "";
  const m = content.match(/```json\s*([\s\S]*?)```/);
  if (m) {
    const obj = JSON.parse(m[1]);
    if (Array.isArray(obj?.lines)) return obj.lines;
  }
  throw new Error("No lines parsed from gateway");
}

// ---------- handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[generate-text] Function invoked");
  
  // Log API key configuration status (without revealing actual keys)
  console.log("[generate-text] API Keys configured:", {
    openai: !!OPENAI_KEY,
    gateway_url: !!GATEWAY_URL,
    gateway_key: !!GATEWAY_KEY
  });

  try {
    const body: GeneratePayload = await req.json();
    console.log("[generate-text] Request payload:", {
      category: body.category,
      subcategory: body.subcategory,
      tone: body.tone,
      rating: body.rating,
      hasInsertWords: !!body.insertWords?.length,
      hasMovieAnchors: !!body.movieAnchors?.length
    });

    const category = (body.category || "").trim();
    const subcategory = (body.subcategory || "").trim();
    const theme = (body.theme || "").trim();
    const category_path = [category, subcategory].filter(Boolean);
    const topic = (theme || subcategory || category || "topic").trim();

    const tone: Tone = (body.tone || "humorous");
    const rating: Rating = (body.rating || "PG");
    const insert_words = (Array.isArray(body.insertWords) ? body.insertWords : []).slice(0, 2);
    const insert_word_mode = body.insertWordMode || "per_line";

    // Movies anchors if ever needed
    let anchors: string[] = Array.isArray(body.movieAnchors) ? body.movieAnchors.filter(Boolean) : [];

    const baseTask: TaskObject = {
      tone, rating, category_path, topic,
      layout: body.layout, style: body.style, dimensions: body.dimensions,
      insert_words, insert_word_mode,
      avoid_terms: [...(body.avoidTerms || [])],
      anchors,
      require_anchors: anchors.length > 0
    };
    let task: TaskObject = { ...baseTask, ...categoryAdapter(baseTask), ...ratingAdapter(baseTask) };

    if (task.birthday_explicit && task.avoid_terms) {
      task.avoid_terms = task.avoid_terms.filter(t => !/(birthday|b-day)/i.test(t));
    }

    const SYSTEM = buildHouseRules(
      TONE_HINTS[tone],
      RATING_HINTS[rating],
      anchors.length ? anchors.slice(0, 6) : undefined
    );

    const userPayload = {
      version: "viibe-text",
      tone_hint: TONE_HINTS[tone],
      rating_hint: RATING_HINTS[rating],
      task
    };

    let lines: string[] | null = null;
    let lastErr: unknown = null;

    // Try Responses API first
    console.log("[generate-text] Attempting OpenAI Responses API call...");
    try {
      lines = await callResponsesAPI(SYSTEM, userPayload, 640);
      console.log("[generate-text] OpenAI Responses API success, received", lines?.length, "lines");
    } catch (e) {
      console.error("[generate-text] OpenAI Responses API failed:", e instanceof Error ? e.message : String(e));
      lastErr = e;
      // Fallback to gateway if configured
      if (GATEWAY_URL && GATEWAY_KEY) {
        console.log("[generate-text] Attempting gateway fallback...");
        try {
          lines = await callGateway(SYSTEM, userPayload, 768);
          console.log("[generate-text] Gateway fallback success, received", lines?.length, "lines");
        } catch (gatewayErr) {
          console.error("[generate-text] Gateway fallback also failed:", gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr));
          throw gatewayErr;
        }
      } else {
        console.log("[generate-text] No gateway configured, re-throwing OpenAI error");
        throw e;
      }
    }

    // Validate and retry once with stricter rules if needed
    const v1 = validate(lines!, task);
    if (v1) {
      console.log("[generate-text] Initial validation failed, problems:", v1);
      const strictSystem = SYSTEM + "\nCRITICAL: Every line must include end punctuation, length 28–120, "
        + (task.birthday_explicit ? "must include 'birthday' or 'b-day', " : "")
        + (task.insert_words?.length ? `at least one line must include one of: ${task.insert_words.join(", ")}, ` : "")
        + "no instructions, no slurs.";
      console.log("[generate-text] Retrying with stricter system prompt...");
      try {
        const retryLines = OPENAI_KEY
          ? await callResponsesAPI(strictSystem, userPayload, 768)
          : await callGateway(strictSystem, userPayload, 896);
        const v2 = validate(retryLines, task);
        if (v2) {
          console.error("[generate-text] Retry validation also failed, problems:", v2);
          return err(422, "Generated text failed validation after retry", { problems: v2, retryLines });
        }
        console.log("[generate-text] Retry validation passed");
        lines = retryLines;
      } catch (retryErr) {
        console.error("[generate-text] Retry attempt failed:", retryErr instanceof Error ? retryErr.message : String(retryErr));
        return err(500, "Retry failed", { error: String(retryErr) });
      }
    } else {
      console.log("[generate-text] Initial validation passed");
    }

    console.log("[generate-text] Returning successful response with", lines!.length, "lines");
    return new Response(JSON.stringify({
      success: true,
      options: lines,
      model: OPENAI_KEY ? RESPONSES_MODEL : GATEWAY_MODEL,
      count: lines!.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /timeout/i.test(msg) ? 408
                : /Payment required/i.test(msg) ? 402
                : /Rate limited/i.test(msg) ? 429
                : /OpenAI 4\d\d|Gateway 4\d\d/.test(msg) ? 502
                : 500;
    console.error("[generate-text] Final error handler caught:", {
      message: msg,
      status,
      stack: e instanceof Error ? e.stack : undefined
    });
    return err(status, msg || "Unexpected error");
  }
});
