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
const MODEL = "gpt-5-mini";

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
        items: { type: "string", maxLength: 140 }
      }
    },
    additionalProperties: false
  }
} as const;

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
  const resp = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  // Handle rate limits and payment issues explicitly
  if (resp.status === 402) {
    return { ok: false as const, code: 402, error: "Payment required or credits exhausted" };
  }
  if (resp.status === 429) {
    return { ok: false as const, code: 429, error: "Rate limited, please try again later" };
  }

  let data: any = null;
  try { 
    data = await resp.json(); 
  } catch { 
    /* ignore parse errors */ 
  }

  if (!resp.ok) {
    const msg = data?.error?.message || `OpenAI error ${resp.status}`;
    return { ok: false as const, code: resp.status, error: msg, raw: data };
  }

  return { ok: true as const, data };
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

async function callOpenAI(payload: any, apiKey: string, isRetry = false): Promise<string[]> {
  // Minimal system prompt
  const systemPrompt = isRetry 
    ? "Immediately call return_lines with 4 strings. No text."
    : "Call the function once. Return exactly 4 lines via tool only. Each 40–120 chars, end with punctuation. No other output.";

  // Cap task length based on retry
  const taskMaxLen = isRetry ? 280 : 400;
  const userMessage = JSON.stringify({
    version: payload.version ?? "v1",
    tone_hint: payload.tone_hint ?? null,
    rating_hint: payload.rating_hint ?? null,
    insert_words: payload.task?.insert_words ?? [],
    insert_word_mode: payload.task?.insert_word_mode ?? "per_line",
    avoid_terms: payload.task?.avoid_terms ?? [],
    forbidden_terms: payload.task?.forbidden_terms ?? [],
    birthday_explicit: payload.task?.birthday_explicit ?? false,
    task: (payload.task?.topic ?? "").slice(0, taskMaxLen)
  });

  const input = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ];

  // PHASE 1: Try tool calling
  const toolBody = {
    model: MODEL,
    input,
    tools: [RETURN_LINES_TOOL],
    tool_choice: "required",
    max_output_tokens: isRetry ? 256 : 512
    // Do NOT send: temperature, top_p, parallel_tool_calls, response_format
  };

  const toolResult = await openaiRequest(toolBody, apiKey);
  
  // Handle errors from tool call
  if (!toolResult.ok) {
    throw new Error(`OpenAI ${toolResult.code}: ${toolResult.error}`);
  }

  // Try to extract tool output
  const linesFromTool = pickLines(toolResult.data);
  
  if (linesFromTool) {
    // Success! Check if incomplete but still valid
    if (toolResult.data?.incomplete_details?.reason === "max_output_tokens") {
      console.log("⚠️ Model hit token limit but tool output is valid");
    }
    return linesFromTool;
  }

  // PHASE 2: Tool didn't fire - try strict JSON schema fallback
  console.log("No tool output, trying JSON schema fallback...");
  
  const jsonBody = {
    model: MODEL,
    input,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "return_lines_payload",
        schema: {
          type: "object",
          required: ["lines"],
          additionalProperties: false,
          properties: {
            lines: { 
              type: "array", 
              minItems: 4, 
              maxItems: 4, 
              items: { type: "string", maxLength: 140 } 
            }
          }
        },
        strict: true
      }
    },
    max_output_tokens: isRetry ? 256 : 512
  };

  const jsonResult = await openaiRequest(jsonBody, apiKey);
  
  if (!jsonResult.ok) {
    throw new Error(`OpenAI JSON fallback ${jsonResult.code}: ${jsonResult.error}`);
  }

  const linesFromJson = pickLinesFromJson(jsonResult.data);
  
  if (linesFromJson) {
    console.log("✅ JSON schema fallback succeeded");
    return linesFromJson;
  }

  // PHASE 3: If we're not already retrying, do ONE retry with tighter prompt
  if (!isRetry) {
    console.log("Both tool and JSON failed, retrying with minimal prompt...");
    return callOpenAI(payload, apiKey, true);
  }

  // Failed all attempts
  throw new Error("No valid output from model after tool, JSON fallback, and retry");
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
      const lines = await callOpenAI(sample, OPENAI_API_KEY);
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

    let lines = await callOpenAI(userPayload, OPENAI_API_KEY);

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
      lines = await callOpenAI(fix, OPENAI_API_KEY);
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
      model: "gpt-5-mini",
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
