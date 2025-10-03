// v2025-06-03: Responses API with json_schema, honest errors, dry-run bypass
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type Tone = "humorous" | "savage" | "sentimental" | "nostalgic" | "romantic" | "inspirational" | "playful" | "serious";
type Rating = "G" | "PG" | "PG-13" | "R";

interface TaskObject {
  tone: Tone;
  rating: Rating;
  category_path: string[];
  topic: string;
  insert_words?: string[];
  insert_word_mode?: "per_line" | "at_least_one";
  birthday_explicit?: boolean;
  anchors?: string[];
  require_anchors?: boolean;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RESP_URL = "https://api.openai.com/v1/responses";
const RESP_MODEL = "gpt-5-2025-08-07";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const TONE_HINTS: Record<string, string> = {
  humorous: "funny, witty, punchy",
  savage: "blunt, cutting, roast-style",
  sentimental: "warm, affectionate, heartfelt",
  nostalgic: "reflective, past references, lightly playful",
  romantic: "affectionate, playful, charming",
  inspirational: "uplifting, bold, clever",
  playful: "silly, cheeky, fun",
  serious: "formal, direct, weighty; minimal humor",
};

const RATING_HINTS: Record<string, string> = {
  G: "no profanity; no sexual terms; no drugs",
  PG: "mild language OK; no sex mentions; no drugs",
  "PG-13": "non-graphic sex mentions OK; alcohol + cannabis OK; NO f-bomb",
  R: "adult non-graphic sex OK; strong profanity OK; no slurs; no illegal how-to",
};

function houseRules(tone: Tone, rating: Rating, anchors?: string[]) {
  const a = anchors?.length ? `Anchors: ${anchors.slice(0, 6).join(", ")}` : "";
  return [
    "Write 4 on-image captions.",
    "Each 28–120 chars; end with . ! or ?",
    `Tone: ${TONE_HINTS[tone] || "funny, witty, punchy"}`,
    `Rating: ${RATING_HINTS[rating] || "PG"}`,
    "Comedy: specificity, contrast, quick twist. One idea per line.",
    "PG-13: no f-bomb. R: profanity allowed, not last word.",
    a,
  ].filter(Boolean).join("\n");
}

function err(status: number, message: string, details?: unknown) {
  return new Response(JSON.stringify({ success: false, error: message, details: details ?? null }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (s: string, w: string) => new RegExp(`\\b${esc(w)}(?:'s)?\\b`, "i").test(s);

function validate(lines: string[], task: TaskObject) {
  const problems: string[] = [];
  if (!Array.isArray(lines) || lines.length !== 4) problems.push("needs_4_lines");
  for (const s of lines || []) {
    if (s.length < 28 || s.length > 120) problems.push("bad_length");
    if (!/[.!?]$/.test(s)) problems.push("no_end_punctuation");
    if (task.birthday_explicit && !/\bbirthday|b-day\b/i.test(s)) problems.push("missing_birthday");
    if (task.require_anchors && task.anchors?.length) {
      const ok = task.anchors.some(a => new RegExp(`\\b${esc(a)}\\b`, "i").test(s));
      if (!ok) problems.push("missing_anchor");
    }
  }
  if (task.insert_words?.length && task.insert_word_mode === "at_least_one") {
    const seen = task.insert_words.some(w => lines.some(l => hasWord(l, w)));
    if (!seen) problems.push("missing_insert_word");
  }
  return problems.length ? problems : null;
}

async function callResponsesAPI(system: string, userObj: unknown, maxTokens = 640) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
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
          items: { type: "string", minLength: 28, maxLength: 120, pattern: "[.!?]$" },
        },
      },
    },
  };
  const body = {
    model: RESP_MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(userObj) },
    ],
    max_output_tokens: maxTokens,
    text: {
      format: {
        type: "json_schema",
        name: schema.name,
        json_schema: {
          strict: schema.strict,
          schema: schema.schema
        }
      }
    },
  };

  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort("timeout"), 45_000);
  let r: Response;
  try {
    r = await fetch(RESP_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(tid);
  }

  const raw = await r.text();
  if (r.status === 402) throw new Error("Payment required or credits exhausted");
  if (r.status === 429) throw new Error("Rate limited");
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${raw.slice(0, 800)}`);

  const data = JSON.parse(raw);

  if (data.output_parsed?.lines && Array.isArray(data.output_parsed.lines)) {
    return data.output_parsed.lines as string[];
  }
  const blocks = data.output?.[0]?.content || [];
  const text = blocks.find((b: any) => b.type === "output_text")?.text ?? "";
  try {
    const obj = JSON.parse(text);
    if (obj?.lines && Array.isArray(obj.lines)) return obj.lines as string[];
  } catch {}

  throw new Error("No lines parsed from Responses API");
}

// Canned safe lines to keep UI usable if provider fails
const SAFE_LINES = [
  "Birthday chaos coordinator, report for cake duty.",
  "Survived another lap, unlocks extra sprinkles.",
  "Age is just experience points, spend recklessly.",
  "Make a wish, then pretend it was the plan.",
];

// ============ HTTP HANDLER ============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // DRY-RUN BYPASS: call with ?dry=1 to prove wiring without model/key
    const url = new URL(req.url);
    if (url.searchParams.get("dry") === "1") {
      return new Response(JSON.stringify({ success: true, options: SAFE_LINES, model: "dry-run" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const category = String(body.category || "").trim();
    const subcategory = String(body.subcategory || "").trim();
    const tone: Tone = (body.tone || "humorous") as Tone;
    const rating: Rating = (body.rating || "PG") as Rating;
    const insert_words: string[] = Array.isArray(body.insertWords) ? body.insertWords.slice(0, 2) : [];

    const task: TaskObject = {
      tone,
      rating,
      category_path: [category, subcategory].filter(Boolean),
      topic: subcategory || category || "topic",
      insert_words,
      insert_word_mode: (body.insertWordMode || "per_line") as "per_line" | "at_least_one",
      birthday_explicit: category.toLowerCase() === "celebrations" && /birthday/i.test(subcategory),
      anchors: undefined,
      require_anchors: false,
    };

    const SYSTEM = houseRules(task.tone, task.rating, task.anchors);
    const userPayload = { version: "viibe-text", tone_hint: TONE_HINTS[tone], rating_hint: RATING_HINTS[rating], task };

    let lines: string[];
    try {
      lines = await callResponsesAPI(SYSTEM, userPayload, 640);
    } catch (e) {
      // Surface readable error, but fail soft with SAFE_LINES for the UI
      const msg = e instanceof Error ? e.message : String(e);
      console.error("AI error:", msg);
      return err(502, msg);
    }

    const v = validate(lines, task);
    if (v) {
      // one strict retry
      const strict = SYSTEM + "\nCRITICAL: Every line must include required tokens and end punctuation. Length 28–120.";
      try {
        lines = await callResponsesAPI(strict, userPayload, 768);
      } catch (e2) {
        return err(422, "Validation failed after retry", { problems: v, info: String(e2) });
      }
      const v2 = validate(lines, task);
      if (v2) return err(422, "Validation failed after retry", { problems: v2, lines });
    }

    return new Response(JSON.stringify({ success: true, options: lines, model: RESP_MODEL, count: lines.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /timeout/i.test(msg) ? 408 : /OpenAI\s4\d\d/.test(msg) ? 502 : 500;
    return err(status, msg || "Unexpected error");
  }
});
