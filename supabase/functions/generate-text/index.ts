import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  TONE_HINTS, RATING_HINTS,
  categoryAdapter, ratingAdapter, batchCheck,
  type TaskObject, type Tone, type Rating
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5-mini-2025-08-07";

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
          items: { type: "string", minLength: 40, maxLength: 140, pattern: "[.!?]$" }
      }
    },
    additionalProperties: false
  }
} as const;

// Global cache to remember if tools actually work for this model
let supportsTools: boolean | null = null;

const SYS_TOOL = "Call return_lines exactly once via tool. Output only via tool. 4 lines, 40–140 chars, each ends with punctuation.";
const SYS_JSON = "Return only JSON matching the schema. No prose.";

function logBody(label: string, body: unknown) {
  try {
    const s = JSON.stringify(body);
    console.log(`[${label}] ${s.slice(0, 2000)}`); // log first 2k chars to avoid spam
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

// Helper to extract and validate tool output from Responses API
function pickLines(data: any): string[] | null {
  const output = Array.isArray(data?.output) ? data.output : [];
  const tool = output.find((o: any) => o?.type === "tool_call" && o?.tool_name === "return_lines");
  
  if (!tool?.tool_arguments) return null;
  
  const args = typeof tool.tool_arguments === "string" 
    ? JSON.parse(tool.tool_arguments) 
    : tool.tool_arguments;
  
  const lines = args?.lines;
  const valid = Array.isArray(lines) && 
    lines.length === 4 && 
    lines.every((l: any) => 
      typeof l === "string" && 
      l.length >= 40 && 
      l.length <= 140 && 
      /[.!?]$/.test(l)
    );
  
  return valid ? lines : null;
}

async function openaiRequest(body: Record<string, unknown>, apiKey: string) {
  logBody("OPENAI_REQ", body);
  
  const resp = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await resp.text();
  console.log(`[OPENAI_RES_${resp.status}] ${text.slice(0, 2000)}`);
  
  let data: any = null;
  try { 
    data = JSON.parse(text); 
  } catch { 
    /* leave text for debugging */ 
  }

  // Handle rate limits and payment issues explicitly
  if (resp.status === 402) {
    return { ok: false as const, code: 402, error: "Payment required or credits exhausted" };
  }
  if (resp.status === 429) {
    return { ok: false as const, code: 429, error: "Rate limited, please try again later" };
  }

  if (!resp.ok) {
    const msg = data?.error?.message || `OpenAI error ${resp.status}`;
    return { ok: false as const, code: resp.status, error: msg, raw: data ?? text };
  }

  return { ok: true as const, data: data ?? text };
}

function pickLinesFromJson(data: any): string[] | null {
  try {
    const text = data?.output_text; // Responses API returns JSON in output_text field
    if (!text) return null;
    
    const obj = JSON.parse(text);
    const lines = obj?.lines;
    
    const valid = Array.isArray(lines) && 
      lines.length === 4 && 
      lines.every((l: any) => 
        typeof l === "string" && 
        l.length >= 40 && 
        l.length <= 140 && 
        /[.!?]$/.test(l)
      );
    
    return valid ? lines : null;
  } catch {
    return null;
  }
}

// Capability probe: can this model emit a tool_call at all?
async function probeToolsOnce(apiKey: string): Promise<boolean> {
  if (supportsTools !== null) return supportsTools;
  
  const body = {
    model: MODEL,
    input: [
      { role: "system", content: SYS_TOOL },
      { role: "user", content: "{\"task\":\"Probe: say four neutral lines about coffee.\"}" }
    ],
    tools: [RETURN_LINES_TOOL],
    tool_choice: "required",
    max_output_tokens: 256
  };
  
  const r = await openaiRequest(body, apiKey);
  if (!r.ok) { 
    supportsTools = false; 
    return supportsTools; 
  }
  
  const lines = pickLines(r.data);
  supportsTools = !!lines;
  console.log(`[PROBE] supportsTools=${supportsTools}`);
  return supportsTools;
}

async function callToolPath(userJson: any, apiKey: string) {
  const body = {
    model: MODEL,
    input: [
      { role: "system", content: SYS_TOOL },
      { role: "user", content: JSON.stringify(userJson) }
    ],
    tools: [RETURN_LINES_TOOL],
    tool_choice: "required",
    max_output_tokens: 512
  };
  
  const r = await openaiRequest(body, apiKey);
  if (!r.ok) return r;
  
  const lines = pickLines(r.data);
  if (lines) {
    const inc = r.data?.incomplete_details?.reason === "max_output_tokens" ? "tool_ok_incomplete" : null;
    return { ok: true as const, lines, path: "tool", warning: inc };
  }
  
  return { ok: false as const, code: 500, error: "No tool output" };
}

function extractJsonObject(resp: any): any | null {
  // 1) Direct convenience field (often present)
  const candidates: string[] = [];
  if (typeof resp?.output_text === "string") candidates.push(resp.output_text);

  // 2) Walk the output array
  const out = Array.isArray(resp?.output) ? resp.output : [];
  for (const o of out) {
    // Some SDKs shove text straight on content as a string
    if (typeof o?.content === "string") candidates.push(o.content);

    // Newer shapes: content is an array of parts
    const parts = Array.isArray(o?.content) ? o.content : [];
    for (const p of parts) {
      // If OpenAI already parsed JSON for you (rare but nice)
      if (p && typeof p.json === "object" && p.json !== null) return p.json;

      // Typical case: text field holds the JSON string
      if (typeof p?.text === "string") candidates.push(p.text);

      // Legacy/helpers: sometimes the key is "output_text"
      if (typeof p?.output_text === "string") candidates.push(p.output_text);
    }
  }

  // Try to parse each candidate, being polite about code fences
  for (const raw of candidates) {
    const trimmed = raw.trim().replace(/^```json\s*|\s*```$/g, "").trim();
    try { return JSON.parse(trimmed); } catch {}
    // last-ditch: grab the first {...} block
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const slice = trimmed.slice(start, end + 1);
      try { return JSON.parse(slice); } catch {}
    }
  }
  return null;
}

async function callJsonPath(userJson: any, apiKey: string) {
  const body = {
    model: MODEL,
    input: [
      { role: "system", content: "Return ONLY JSON that matches the schema. No prose, no markdown, no code fences." },
      { role: "user", content: JSON.stringify(userJson) }
    ],
    reasoning: {
      effort: "low"
    },
    text: {
      format: {
        name: "return_lines_payload",
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["lines"],
          properties: {
            lines: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: { type: "string", minLength: 40, maxLength: 140, pattern: "[.!?]$" }
            }
          }
        },
        strict: true
      }
    },
    max_output_tokens: 1024
  };
  
  const r = await openaiRequest(body, apiKey);
  if (!r.ok) return r;

  const obj = extractJsonObject(r.data);
  if (!obj) return { ok: false as const, code: 500, error: "JSON schema fallback parse failed (no JSON found)" };

  const lines = obj?.lines;
  const valid = Array.isArray(lines) &&
    lines.length === 4 &&
    lines.every((l: any) => typeof l === "string" && l.length >= 40 && l.length <= 140 && /[.!?]$/.test(l));

  return valid
    ? { ok: true as const, lines, path: "json_schema" }
    : { ok: false as const, code: 422, error: "JSON present but failed line shape checks" };
}

async function callModelSmart(payload: any, apiKey: string): Promise<string[]> {
  const toolsOK = await probeToolsOnce(apiKey).catch(() => false);

  // Build user JSON from payload
  const userJson = {
    version: payload.version ?? "v1",
    tone_hint: payload.tone_hint ?? null,
    rating_hint: payload.rating_hint ?? null,
    insert_words: payload.task?.insert_words ?? [],
    insert_word_mode: payload.task?.insert_word_mode ?? "per_line",
    avoid_terms: payload.task?.avoid_terms ?? [],
    forbidden_terms: payload.task?.forbidden_terms ?? [],
    birthday_explicit: payload.task?.birthday_explicit ?? false,
    task: (payload.task?.topic ?? "").slice(0, 600),
    fix_hint: payload.fix_hint ?? null
  };

  if (toolsOK) {
    // Try tool path first
    const r1 = await callToolPath(userJson, apiKey);
    if (r1.ok) return r1.lines;
    
    // Single retry with shorter task
    userJson.task = String(userJson.task).slice(0, 280);
    const r2 = await callToolPath(userJson, apiKey);
    if (r2.ok) return r2.lines;
    
    // Fallback to JSON
    console.log("Tool path failed twice, falling back to JSON schema...");
    const r3 = await callJsonPath(userJson, apiKey);
    if (r3.ok) {
      console.log("✅ JSON schema fallback succeeded");
      return r3.lines;
    }
    
    throw new Error(`All paths failed: ${r3.error}`);
  } else {
    // Go straight to JSON path for this model
    console.log("Model doesn't support tools, using JSON schema directly");
    let r = await callJsonPath(userJson, apiKey);
    if (!r.ok && r.code === 422) {
      console.log("Shape check failed, retrying with fix_hint...");
      userJson.fix_hint = {
        issues: [
          "Line shape checks failed: Return exactly 4 strings, each 40–140 chars and end with . ! or ?"
        ],
        guidance: "Output only valid JSON: { \"lines\": [ ... ] } with 4 strings. No extra text."
      };
      r = await callJsonPath(userJson, apiKey);
    }
    if (!r.ok) {
      throw new Error(`JSON schema path failed: ${r.error}`);
    }
    console.log("✅ JSON schema succeeded");
    return r.lines;
  }
}

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
      const lines = await callModelSmart(sample, OPENAI_API_KEY);
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

    let lines = await callModelSmart(userPayload, OPENAI_API_KEY);

    // Validate batch; if issues, one guided retry
    const issues = batchCheck(lines, task);
    if (issues.length) {
      console.log("Validation issues found, retrying with guidance:", issues);
      const fix = { 
        fix_hint: { 
          issues, 
          guidance: "Return 4 lines that meet all constraints." 
        }, 
        task 
      };
      lines = await callModelSmart(fix, OPENAI_API_KEY);
    }

    // Final check and crop
    const finalIssues = batchCheck(lines, task);
    if (finalIssues.length) {
      console.warn("Final validation issues:", finalIssues);
      lines = lines.slice(0, 4);
    } else {
      lines = lines.slice(0, 4);
    }

    return new Response(JSON.stringify({
      success: true,
      options: lines,
      model: "gpt-5-mini-2025-08-07",
      count: lines.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("generate-text error:", err);
    // Return 200 with error in body so frontend can display it
    return new Response(JSON.stringify({ 
      success: false, 
      error: (err as Error).message || "failed" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
