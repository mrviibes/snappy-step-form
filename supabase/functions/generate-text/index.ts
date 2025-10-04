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
const RESP_MODEL = Deno.env.get("LOVABLE_MODEL") || "gpt-5-mini";
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

function houseRules(tone: Tone, rating: Rating, task: TaskObject) {
  const tone_hint = TONE_HINTS[tone] || "funny, witty, punchy";
  const rating_hint = RATING_HINTS[rating] || "PG";
  const a = task.anchors?.length ? `Anchors: ${task.anchors.slice(0, 6).join(", ")}` : "";
  
  const isBirthday = task.category_path[0]?.toLowerCase() === "celebrations" 
    && /birthday/i.test(task.category_path[1] || "");
  
  const cueHint = isBirthday 
    ? "Write for a birthday card vibe. Use concrete cues across MOST lines (cake, candles, make-a-wish, turning [age], party, balloons, gifts) without repeating 'birthday' every time."
    : "";

  // Comedy Contract: Humor requirements based on tone
  const warmTones = ["sentimental", "romantic", "inspirational"];
  const comedyRule = warmTones.includes(tone)
    ? "Primary tone is warm/affectionate, but every line still needs a sprinkle of humor or a clever twist — a wink, one absurd detail, or playful language."
    : tone === "serious"
    ? "Minimal humor; focus on weight and clarity."
    : "Every line MUST be hilarious. Strong punchlines, absurd turns, or witty exaggerations. No plain compliments or bland Hallmark filler.";

  return [
    "Write 4 on-image captions for birthday cards.",
    "Each 70–120 chars (target 85–110); end with . ! or ?",
    `Tone: ${tone_hint}`,
    `Rating: ${rating_hint}`,
    comedyRule,
    "One distinct idea per line. No duplicates.",
    "PG-13: no f-bomb. R: profanity allowed, not last word.",
    cueHint,
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

function topicalityProblems(
  lines: string[],
  task: TaskObject,
  opts: { minCuedLines?: number } = { minCuedLines: 2 }
) {
  const problems: string[] = [];
  
  // Basic checks (updated to 70 char minimum)
  if (!Array.isArray(lines) || lines.length !== 4) problems.push("needs_4_lines");
  for (const s of lines || []) {
    if (s.length < 70 || s.length > 120) problems.push("bad_length");
    if (!/[.!?]$/.test(s)) problems.push("no_end_punctuation");
  }
  
  // Birthday topicality: 2 of 4 lines need cues
  const isBirthday = task.category_path[0]?.toLowerCase() === "celebrations" 
    && /birthday/i.test(task.category_path[1] || "");
  
  if (isBirthday) {
    const CUES = [
      "birthday", "b-day", "cake", "candles", "make a wish", "wish", "party",
      "balloon", "balloons", "confetti", "gift", "gifts", "present", "presents",
      "frosting", "icing", "sprinkles", "blow out", "turning", "another year",
      "age", "years young", "card", "banner", "celebrate", "celebration"
    ];
    const cueHit = (s: string) => CUES.some(
      c => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s)
    );
    
    const cuedCount = lines.reduce((n, l) => n + (cueHit(l) ? 1 : 0), 0);
    const need = Math.max(0, (opts.minCuedLines ?? 2) - cuedCount);
    if (need > 0) problems.push(`needs_more_birthday_cues:${need}`);
  }
  
  // Insert words (name): must appear in at least 1 line
  if (task.insert_words?.length && task.insert_word_mode === "at_least_one") {
    const seen = task.insert_words.some(w => lines.some(l => hasWord(l, w)));
    if (!seen) problems.push("missing_insert_word");
  }
  
  // Deduplication check
  const norm = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|and|or|but|with|for|to|of|on|in|your)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  for (const l of lines) {
    const k = norm(l);
    if (seen.has(k)) { problems.push("near_duplicate"); break; }
    seen.add(k);
  }
  
  return problems.length ? problems : null;
}

function comedyProblems(lines: string[], tone: Tone) {
  // Humor markers that indicate comedy/playfulness
  const HUMOR_MARKERS = [
    /\b(cake|candles|sprinkles?|frosting|icing|wish|party|balloon|confetti)\b/i,
    /\b(old|age|wrinkle|chaos|disaster|duty|report|xp|level\s*up|unlock)\b/i,
    /\b(biohazard|backup|plausible|deniability|coordinator|reckless)\b/i,
    /\b(pretend|suppose|allegedly|technically|basically)\b/i,
    /[±∞]/,  // math symbols used humorously
  ];
  
  const hasHumor = (line: string) => HUMOR_MARKERS.some(marker => marker.test(line));
  const humorCount = lines.filter(hasHumor).length;
  
  const warmTones = ["sentimental", "romantic", "inspirational"];
  const isWarm = warmTones.includes(tone);
  
  const problems: string[] = [];
  
  if (isWarm) {
    // Warm tones: at least 50% (2 of 4) lines need humor markers
    if (humorCount < 2) {
      problems.push(`warm_needs_humor_sprinkle:${humorCount}/4_have_markers`);
    }
  } else if (tone !== "serious") {
    // Default tones (humorous/savage/playful): 100% need humor
    if (humorCount < 4) {
      problems.push(`not_funny_enough:${humorCount}/4_have_markers`);
    }
  }
  
  return problems.length ? problems : null;
}

async function callResponsesAPI(system: string, userObj: unknown, maxTokens = 1024, attempt = 0) {
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
          items: { type: "string", minLength: 70, maxLength: 120, pattern: "[.!?]$" },
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
        schema: schema.schema,
        strict: true
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

  // Handle incomplete due to token cap: single retry with higher limit
  if (data?.status === "incomplete" && data?.incomplete_details?.reason === "max_output_tokens" && attempt < 1) {
    console.warn(`Responses API incomplete (max_output_tokens) at ${maxTokens}, retrying with 1536`);
    return await callResponsesAPI(system, userObj, Math.max(1536, (maxTokens || 0) + 512), attempt + 1);
  }

  // Try output_parsed first (structured output)
  if (data.output_parsed?.lines && Array.isArray(data.output_parsed.lines)) {
    return data.output_parsed.lines as string[];
  }

  // Try content blocks with json_schema parsed
  const blocks = data.output?.[0]?.content || [];
  for (const block of blocks) {
    if (block.type === "json_schema" && block.parsed?.lines && Array.isArray(block.parsed.lines)) {
      return block.parsed.lines as string[];
    }
    if (block.type === "output_json" && block.json?.lines && Array.isArray(block.json.lines)) {
      return block.json.lines as string[];
    }
  }

  // Try parsing text block as JSON
  const textBlock = blocks.find((b: any) => b.type === "output_text")?.text ?? "";
  if (textBlock) {
    try {
      const obj = JSON.parse(textBlock);
      if (obj?.lines && Array.isArray(obj.lines)) return obj.lines as string[];
    } catch {}
  }

  // Last resort: deep scan for valid lines array (updated to 70 char minimum)
  const deepScan = (obj: any): string[] | null => {
    if (Array.isArray(obj) && obj.length === 4 && obj.every((s) => typeof s === "string" && s.length >= 70 && s.length <= 120 && /[.!?]$/.test(s))) {
      return obj;
    }
    if (obj && typeof obj === "object") {
      for (const val of Object.values(obj)) {
        const found = deepScan(val);
        if (found) return found;
      }
    }
    return null;
  };
  const found = deepScan(data);
  if (found) return found;

  console.error("Parse miss. Response snippet:", JSON.stringify(data).slice(0, 500));
  throw new Error("Parse miss: no output_parsed or json_schema parsed block.");
}

// Canned safe lines to keep UI usable if provider fails (70+ chars, funny)
const SAFE_LINES = [
  "Birthday chaos coordinator, report for cake duty before the frosting becomes a biohazard.",
  "Level up unlocked: age +1, wisdom ±0, cake intake +∞. Party mode enabled.",
  "Survived another lap around the sun, unlocks extra sprinkles and plausible deniability.",
  "Make a wish, blow out the candles, then pretend it was all part of the plan.",
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

    const SYSTEM = houseRules(task.tone, task.rating, task);
    const userPayload = { version: "viibe-text", tone_hint: TONE_HINTS[tone], rating_hint: RATING_HINTS[rating], task };

    let lines: string[];
    try {
      lines = await callResponsesAPI(SYSTEM, userPayload, 1024);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("AI error:", msg);
      const payload = { success: true, options: SAFE_LINES, model: RESP_MODEL, fallback: "safe_lines", error: msg };
      return new Response(JSON.stringify(payload), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const v = topicalityProblems(lines, task, { minCuedLines: 2 });
    if (v) {
      // one strict retry with higher token budget
      const strict = SYSTEM + "\nCRITICAL: At least 2 of the 4 lines must include clear birthday-card cues (cake, candles, wish, age, party, balloons, gifts). Every line must be distinct. Length 70–120.";
      try {
        lines = await callResponsesAPI(strict, userPayload, 1536);
      } catch (e2) {
        const payload = { success: true, options: SAFE_LINES, model: RESP_MODEL, fallback: "safe_lines", error: "Validation retry failed", details: { problems: v, info: String(e2) } };
        return new Response(JSON.stringify(payload), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      const v2 = topicalityProblems(lines, task, { minCuedLines: 2 });
      if (v2) {
        const payload = { success: true, options: SAFE_LINES, model: RESP_MODEL, fallback: "safe_lines", error: "Validation failed after retry", details: { problems: v2, lines } };
        return new Response(JSON.stringify(payload), { headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    // Comedy validation: check humor markers
    const comedyIssues = comedyProblems(lines, task.tone);
    if (comedyIssues) {
      console.warn("Comedy check failed:", comedyIssues);
      const STRICT_COMEDY = SYSTEM + "\nCRITICAL: Every line must include humor (absurd, sarcastic, witty exaggeration, or playful twist). Use concrete imagery (cake, chaos, unlocks, duty, biohazard, recklessly, pretend, etc.). No bland Hallmark filler.";
      try {
        lines = await callResponsesAPI(STRICT_COMEDY, userPayload, 1536);
      } catch (e3) {
        console.error("Comedy retry failed:", e3);
        // Fall through with existing lines
      }
      // Final comedy check (no additional retry)
      const c2 = comedyProblems(lines, task.tone);
      if (c2) {
        console.warn("Comedy still weak after retry:", c2, "lines:", lines);
      }
    }

    return new Response(JSON.stringify({ success: true, options: lines, model: RESP_MODEL, count: lines.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-text fatal error:", msg);
    const payload = { success: true, options: SAFE_LINES, model: RESP_MODEL, fallback: "safe_lines", error: msg };
    return new Response(JSON.stringify(payload), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
