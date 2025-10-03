import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  TONE_HINTS, RATING_HINTS, buildHouseRules,
  categoryAdapter, ratingAdapter, batchCheck,
  type TaskObject, type Tone, type Rating
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5-mini"; // canonical id (stop pinning dates)

// Style blurbs for comedian voice variation
const STYLE_BLURBS: Record<string, string[]> = {
  humorous: [
    "Tight setup, quick twist, one vivid noun, out clean",
    "Everyday truth flipped sideways, keep words short and punchy",
    "One image, one turn, then leave",
    "Light jab, happy landing, no apology",
    "Setup in six words, twist in four",
    "Keep it breezy, land one sharp verb",
    "Small problem, big logic, quiet grin",
    "Say the obvious, then the real obvious harder",
    "Build to a wink, not a lecture",
    "End on the funniest word"
  ],
  savage: [
    "Roast with confidence, one ruthless image, smile after impact",
    "Knife in the setup, candy in the tag",
    "Clean hit, no hedge, leave scorch marks",
    "Brutal honesty, one surprise angle, no safety rails",
    "Punch up the stakes, punch down the ego",
    "One insult the crowd repeats later",
    "Say the quiet part loudly and cleanly",
    "Cut the fat, keep the menace",
    "The turn should sting, not explain",
    "Swagger in the rhythm, snap in the ending"
  ],
  sentimental: [
    "Warm truth with one playful spark",
    "Small detail, big heart, gentle turn",
    "Honest memory, soft punchline, grounded voice",
    "Comfort first, chuckle second",
    "Nostalgia without syrup, smile without sparkle dust",
    "Tender image, real flaw, kind twist",
    "Speak like a friend at 2 a.m.",
    "Hopeful line, human mess, tidy finish",
    "Hug in the setup, grin in the tag",
    "Keep it close, keep it real"
  ],
  nostalgic: [
    "One relic detail, one modern twist",
    "Dusty snapshot, fresh punchline",
    "Yesterday's logic meeting today's chaos",
    "Old rule, new problem, laugh",
    "VCR energy, streaming brain",
    "Childhood confidence, adult bill, boom",
    "Retro vibe, present slap, clean exit",
    "Remember it wrong, fix it funny",
    "Warm film grain, crisp turn",
    "Past you advising present you badly"
  ],
  romantic: [
    "Flirt with timing, not adjectives",
    "One charm move, one honest flaw",
    "Compliment with teeth, grin after",
    "Soft setup, sparkling turn",
    "Love note that can take a joke",
    "Tease, praise, land sweet",
    "Keep it human, not greeting card",
    "Real chemistry, little chaos, kiss of truth",
    "Adorable mess, confident punchline",
    "Cute image, honest heartbeat, done"
  ],
  inspirational: [
    "Grit first, glitter later",
    "Small action, loud momentum",
    "Remove excuses with a joke",
    "One rule, one challenge, go",
    "Make the next step feel winnable",
    "Tough love in plain words",
    "Earned optimism, no sparkle dust",
    "Turn fear into a chore list",
    "Quiet courage, sharp verb, finish",
    "Motivation that can carry groceries"
  ],
  playful: [
    "Silly premise, serious commitment",
    "Cartoon energy in real shoes",
    "One goofy verb, one crisp turn",
    "Mischief with manners",
    "Bounce the rhythm, pop the end",
    "Keep stakes low, laughs high",
    "Joy first, logic later",
    "Punchline wearing a party hat",
    "Nonsense that lands somewhere true",
    "Whimsy with steering"
  ],
  serious: [
    "Direct voice, unblinking truth, small grin",
    "Plain words, heavy idea, tidy end",
    "One fact, one consequence, one light",
    "Quiet authority, zero fluff",
    "Respect the moment, allow one human crack",
    "Measured tone, exact verb, closure",
    "Build calm pressure, release politely",
    "No theatrics, just clean gravity",
    "Speak like a mentor who swears rarely",
    "Strong line, soft echo"
  ]
};

function pickStyleBlurb(tone: string): string {
  const blurbs = STYLE_BLURBS[tone] || STYLE_BLURBS.humorous;
  return blurbs[Math.floor(Math.random() * blurbs.length)];
}

// Tool schema (short & overlay-safe)
const RETURN_LINES_TOOL = {
  type: "function",
  name: "return_lines",
  description: "Return the final 4 lines for the UI.",
  parameters: {
    type: "object",
    required: ["lines"],
    properties: {
      lines: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: { type: "string", minLength: 28, maxLength: 140, pattern: "[.!?]$" }
      }
    },
    additionalProperties: false
  }
} as const;

let supportsTools: boolean | null = null;

function logBody(label: string, body: unknown) {
  try {
    const s = JSON.stringify(body);
    console.log(`[${label}] ${s.slice(0, 2000)}`);
  } catch {
    console.log(`[${label}] <unserializable>`);
  }
}

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

// ---------- OpenAI request wrapper ----------
async function openaiRequest(body: Record<string, unknown>, apiKey: string) {
  logBody("OPENAI_REQ", body);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), 45000);

  let resp: Response;
  try {
    resp = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timeoutId);
    const aborted = (e as any)?.name === "AbortError" || String(e).includes("abort");
    const msg = aborted ? "Upstream model timeout (45s)" : `Upstream request failed: ${e instanceof Error ? e.message : String(e)}`;
    console.error("OPENAI_FETCH_ERROR:", e);
    return { ok: false as const, code: 504, error: msg };
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await resp.text();
  console.log(`[OPENAI_RES_${resp.status}] ${text.slice(0, 2000)}`);

  let data: any = null;
  try { data = JSON.parse(text); } catch {}

  if (resp.status === 402) return { ok: false as const, code: 402, error: "Payment required or credits exhausted" };
  if (resp.status === 429) return { ok: false as const, code: 429, error: "Rate limited, please try again later" };

  if (!resp.ok) {
    const msg = data?.error?.message || `OpenAI error ${resp.status}`;
    return { ok: false as const, code: resp.status, error: msg, raw: data ?? text };
  }

  return { ok: true as const, data: data ?? text };
}

// ---------- Tool path helpers ----------
function pickLinesFromTool(data: any): string[] | null {
  const output = Array.isArray(data?.output) ? data.output : [];
  const tool = output.find((o: any) => o?.type === "tool_call" && o?.tool_name === "return_lines");
  if (!tool?.tool_arguments) return null;

  const args = typeof tool.tool_arguments === "string"
    ? JSON.parse(tool.tool_arguments)
    : tool.tool_arguments;

  const lines = args?.lines;
  const valid = Array.isArray(lines) &&
    lines.length === 4 &&
    lines.every((l: any) => typeof l === "string" && l.length >= 28 && l.length <= 140 && /[.!?]$/.test(l));

  return valid ? lines : null;
}

async function probeToolsOnce(apiKey: string, SYSTEM: string): Promise<boolean> {
  if (supportsTools !== null) return supportsTools;

  const body = {
    model: MODEL,
    input: [
      { role: "system", content: SYSTEM + "\nCall return_lines exactly once via tool." },
      { role: "user", content: "{\"topic\":\"Probe: neutral coffee lines.\"}" }
    ],
    tools: [RETURN_LINES_TOOL],
    tool_choice: "required",
    max_output_tokens: 256
  };
  const r = await openaiRequest(body, apiKey);
  if (!r.ok) { supportsTools = false; return false; }

  supportsTools = !!pickLinesFromTool(r.data);
  console.log(`[PROBE] supportsTools=${supportsTools}`);
  return supportsTools!;
}

async function callToolPath(userJson: any, SYSTEM: string, apiKey: string) {
  const body = {
    model: MODEL,
    input: [
      { role: "system", content: SYSTEM + "\nCall return_lines exactly once via tool." },
      { role: "user", content: JSON.stringify(userJson) }
    ],
    tools: [RETURN_LINES_TOOL],
    tool_choice: "required",
    max_output_tokens: 512
  };
  const r = await openaiRequest(body, apiKey);
  if (!r.ok) return r;

  const lines = pickLinesFromTool(r.data);
  if (lines) {
    const inc = r.data?.incomplete_details?.reason === "max_output_tokens" ? "tool_ok_incomplete" : null;
    return { ok: true as const, lines, path: "tool", warning: inc };
  }
  return { ok: false as const, code: 500, error: "No tool output" };
}

// ---------- JSON path helpers ----------
function extractRawText(resp: any): string {
  if (typeof resp?.text === "string" && resp.text.trim()) return resp.text;
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text;
  const out = Array.isArray(resp?.output) ? resp.output : [];
  const parts: string[] = [];
  for (const o of out) {
    const c = Array.isArray(o?.content) ? o.content : [];
    for (const p of c) if (typeof p?.text === "string" && p.text.trim()) parts.push(p.text);
  }
  if (parts.length) return parts.join("\n");
  const cc = resp?.choices?.[0]?.message?.content;
  return typeof cc === "string" ? cc : "";
}

function extractJsonObject(resp: any): any | null {
  const candidates: string[] = [];
  // direct helpers
  if (typeof resp?.text === "string") candidates.push(resp.text);
  if (typeof resp?.output_text === "string") candidates.push(resp.output_text);

  const out = Array.isArray(resp?.output) ? resp.output : [];
  for (const o of out) {
    if (typeof o?.content === "string") candidates.push(o.content);
    const parts = Array.isArray(o?.content) ? o.content : [];
    for (const p of parts) {
      if (p && typeof p.json === "object" && p.json !== null) return p.json;
      if (typeof p?.text === "string") candidates.push(p.text);
      if (typeof p?.output_text === "string") candidates.push(p.output_text);
    }
  }

  for (const raw of candidates) {
    const trimmed = String(raw).trim().replace(/^```json\s*|\s*```$/g, "").trim();
    try { return JSON.parse(trimmed); } catch {}
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const slice = trimmed.slice(start, end + 1);
      try { return JSON.parse(slice); } catch {}
    }
  }
  return null;
}

async function callJsonPath(userJson: any, SYSTEM: string, apiKey: string, nested = true, maxOut = 900) {
  const base = {
    model: MODEL,
    input: [
      { role: "system", content: SYSTEM + "\nReturn ONLY JSON that matches the schema. No prose." },
      { role: "user", content: JSON.stringify(userJson) }
    ],
    max_output_tokens: maxOut as number
  } as any;

  base.text = nested
    ? { format: { type: "json_schema", json_schema: {
          name: "ViibeTextCompactV1",
          schema: { type:"object", additionalProperties:false, required:["lines"], properties:{ lines: { type:"array", minItems:4, maxItems:4, items:{ type:"string", minLength:28, maxLength:140, pattern:"[.!?]$" } } } },
          strict: true
        }}}
    : { format: { type: "json_schema",
          name: "ViibeTextCompactV1",
          schema: { type:"object", additionalProperties:false, required:["lines"], properties:{ lines: { type:"array", minItems:4, maxItems:4, items:{ type:"string", minLength:28, maxLength:140, pattern:"[.!?]$" } } } },
          strict: true
        }};

  const r = await openaiRequest(base, apiKey);
  if (!r.ok) return r;

  // If provider says incomplete due to tokens, bubble up for a bump
  if (r.data?.status && r.data.status !== "completed" && r.data?.incomplete_details?.reason === "max_output_tokens") {
    return { ok: false as const, code: 206, error: "incomplete:max_output_tokens" };
  }

  const obj = extractJsonObject(r.data);
  if (!obj) return { ok: false as const, code: 500, error: "JSON schema parse failed (no JSON found)" };

  const lines = obj?.lines;
  const valid = Array.isArray(lines) && lines.length === 4 &&
    lines.every((l: any) => typeof l === "string" && l.length >= 28 && l.length <= 140 && /[.!?]$/.test(l));

  return valid
    ? { ok: true as const, lines, path: nested ? "json_schema_nested" : "json_schema_flat" }
    : { ok: false as const, code: 422, error: "JSON present but failed line shape checks" };
}

// ---------- Orchestrator ----------
async function callModelSmart(payload: any, SYSTEM: string, apiKey: string): Promise<string[]> {
  // Build user JSON with full task, not just topic
  const userJson = {
    tone_hint: payload.tone_hint ?? null,
    rating_hint: payload.rating_hint ?? null,
    task: {
      tone: payload.task?.tone,
      rating: payload.task?.rating,
      category_path: payload.task?.category_path,
      topic: payload.task?.topic,
      insert_words: payload.task?.insert_words,
      insert_word_mode: payload.task?.insert_word_mode,
      avoid_terms: payload.task?.avoid_terms,
      forbidden_terms: payload.task?.forbidden_terms,
      birthday_explicit: payload.task?.birthday_explicit
    },
    fix_hint: payload.fix_hint ?? null
  };

  // Probe tools once
  const toolsOK = await probeToolsOnce(apiKey, SYSTEM).catch(() => false);

  if (toolsOK) {
    const r1 = await callToolPath(userJson, SYSTEM, apiKey);
    if (r1.ok) return r1.lines;

    // fall through to JSON schema path if tools fail
    console.log("Tool path failed, switching to JSON schema...");
  }

  // JSON schema nested → if format/name drama, try flat → if tokens short, bump once
  let r = await callJsonPath(userJson, SYSTEM, apiKey, true, 2000);
  if (!r.ok) {
    if (r.code === 206) { // incomplete due to max_output_tokens
      r = await callJsonPath(userJson, SYSTEM, apiKey, true, 2500);
    } else if (/format\.name|json_schema.+unsupported|unknown parameter.+json_schema/i.test(String(r.error))) {
      r = await callJsonPath(userJson, SYSTEM, apiKey, false, 900);
    }
  }
  if (!r.ok) {
    if (r.code === 206) r = await callJsonPath(userJson, SYSTEM, apiKey, false, 2500);
    if (!r.ok) throw new Error(`JSON schema path failed: ${r.error}`);
  }

  return r.lines;
}

// ---------- HTTP Handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  // Self-test
  const url = new URL(req.url);
  if (url.searchParams.get("selftest") === "1") {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
    const tone: Tone = "humorous";
    const rating: Rating = "PG-13";
    const styleBlurb = pickStyleBlurb(tone);
    const SYSTEM = buildHouseRules(TONE_HINTS[tone], RATING_HINTS[rating]) + `\n\nCOMEDIAN STYLE HINT: ${styleBlurb}`;

    const sampleTask: TaskObject = {
      tone, rating,
      category_path: ["celebrations","birthday"],
      topic: "Birthday",
      insert_words: ["Jesse"],
      insert_word_mode: "per_line"
    };

    try {
      const lines = await callModelSmart({
        version: "viibe-text-v3",
        tone_hint: TONE_HINTS[tone],
        rating_hint: RATING_HINTS[rating],
        task: sampleTask
      }, SYSTEM, OPENAI_API_KEY);

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

    // Base task & adapters
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

    let task: TaskObject = { ...baseTask, ...categoryAdapter(baseTask), ...ratingAdapter(baseTask) };

    // If birthday is explicit, ensure it's not in avoid_terms
    if (task.birthday_explicit && task.avoid_terms) {
      task.avoid_terms = task.avoid_terms.filter(t => !/(birthday|b-day)/i.test(t));
    }

    // Build system rules for this tone/rating
    const styleBlurb = pickStyleBlurb(tone);
    const SYSTEM = buildHouseRules(TONE_HINTS[tone], RATING_HINTS[rating]) + `\n\nCOMEDIAN STYLE HINT: ${styleBlurb}`;

    const userPayload = {
      version: "viibe-text-v3",
      tone_hint: TONE_HINTS[tone],
      rating_hint: RATING_HINTS[rating],
      task
    };

    // Generate
    let lines = await callModelSmart(userPayload, SYSTEM, OPENAI_API_KEY);

    // Validate & guided retry
    const issues = batchCheck(lines, task);
    if (issues.length) {
      console.log("Validation issues, retrying with guidance:", issues);
      const fix = { fix_hint: { issues, guidance: "Return 4 lines that meet all constraints." }, task };
      lines = await callModelSmart(fix, SYSTEM, OPENAI_API_KEY);
    }

    // Final crop
    lines = lines.slice(0, 4);

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
