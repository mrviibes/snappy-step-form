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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const AI_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

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
function errorResponse(status: number, message: string, details?: any) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    details: details ?? null
  }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function hasAnyAnchor(s: string, anchors?: string[]): boolean {
  if (!anchors?.length) return true;
  return anchors.some(a => {
    const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, "i").test(s);
  });
}

function validLines(lines: string[], task: TaskObject): boolean {
  return lines.length === 4 && lines.every(s =>
    s.length >= 28 &&
    s.length <= 120 &&
    /[.!?]$/.test(s) &&
    (!task.birthday_explicit || /birthday|b-day/i.test(s)) &&
    hasAnyAnchor(s, task.require_anchors ? task.anchors : undefined)
  );
}



function buildStricterSystemPrompt(
  baseSystem: string, 
  task: TaskObject, 
  failedValidation: string[]
): string {
  const extras: string[] = [];
  
  if (failedValidation.includes("missing_birthday_keyword")) {
    extras.push("CRITICAL: Every line MUST include the word 'birthday' or 'b-day'.");
  }
  
  if (failedValidation.includes("missing_anchor") && task.anchors) {
    extras.push(`CRITICAL: At least one line MUST include one of: ${task.anchors.slice(0, 6).join(", ")}`);
  }
  
  if (failedValidation.includes("missing_insert_word") && task.insert_words) {
    extras.push(`CRITICAL: At least one line MUST include one of: ${task.insert_words.join(", ")}`);
  }
  
  if (extras.length === 0) return baseSystem;
  
  return baseSystem + "\n\n" + extras.join("\n");
}

async function callAIOnce(system: string, userObj: unknown, apiKey: string, maxTokens = 512): Promise<string[]> {
  const reqId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(userObj) }
    ],
    max_tokens: maxTokens,
    tools: [
      {
        type: "function",
        function: {
          name: "return_lines",
          description: "Return exactly 4 text lines for the viibe, each 28-120 characters ending with . ! or ?",
          parameters: {
            type: "object",
            required: ["lines"],
            properties: {
              lines: {
                type: "array",
                minItems: 4,
                maxItems: 4,
                items: {
                  type: "string",
                  description: "A single line of text, 28-120 chars, ending with . ! or ?"
                }
              }
            }
          }
        }
      }
    ],
    tool_choice: { type: "function", function: { name: "return_lines" } }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), 45000);

  let resp: Response;
  try {
    resp = await fetch(AI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = await resp.text();
  const elapsed = Date.now() - startTime;

  if (resp.status === 402) {
    console.error(`[${reqId}] 402 Payment Required (${elapsed}ms)`);
    throw new Error("Payment required or credits exhausted");
  }
  if (resp.status === 429) {
    console.error(`[${reqId}] 429 Rate Limited (${elapsed}ms)`);
    throw new Error("Rate limited");
  }
  if (!resp.ok) {
    console.error(`[${reqId}] AI API ${resp.status} (${elapsed}ms): ${raw.slice(0, 400)}`);
    throw new Error(`AI provider error ${resp.status}`);
  }

  const data = JSON.parse(raw);

  // Primary: extract from tool call
  const toolCalls = data.choices?.[0]?.message?.tool_calls;
  if (toolCalls?.length > 0) {
    try {
      const args = JSON.parse(toolCalls[0].function.arguments);
      if (args?.lines && Array.isArray(args.lines)) {
        console.log(`[${reqId}] Tool call success (${elapsed}ms)`);
        return args.lines.map((line: string) => {
          const trimmed = line.trim();
          if (!/[.!?]$/.test(trimmed)) return trimmed + '.';
          return trimmed;
        });
      }
    } catch (e) {
      console.warn(`[${reqId}] Tool call parse failed:`, e);
    }
  }

  // Fallback A: check for JSON block in content
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[1]);
      if (obj?.lines && Array.isArray(obj.lines)) {
        console.log(`[${reqId}] JSON block fallback (${elapsed}ms)`);
        return obj.lines.map((line: string) => {
          const trimmed = line.trim();
          if (!/[.!?]$/.test(trimmed)) return trimmed + '.';
          return trimmed;
        });
      }
    } catch {}
  }

  // Fallback B: split raw text and validate
  if (content) {
    const candidates = content
      .split(/\n+/)
      .map(s => s.replace(/^\d+\.\s*/, '').trim())
      .filter(s => s.length >= 28 && s.length <= 120 && /[.!?]$/.test(s));
    
    if (candidates.length >= 4) {
      console.log(`[${reqId}] Text split fallback (${elapsed}ms)`);
      return candidates.slice(0, 4);
    }
  }

  console.error(`[${reqId}] No valid lines extracted (${elapsed}ms), response shape:`, {
    hasToolCalls: !!toolCalls,
    hasContent: !!content,
    contentPreview: content.slice(0, 200)
  });
  throw new Error("Could not extract valid lines from AI response");
}

// ---------- hedged request orchestrator ----------
async function callFastWithHedge(system: string, userObj: unknown, apiKey: string): Promise<string[]> {
  // Primary starts now
  const p1 = callAIOnce(system, userObj, apiKey, 512).catch(e => {
    console.error("Primary request failed:", e);
    throw e;
  });

  // Hedge fires after 3s with slightly larger budget to beat tail latency
  const p2 = new Promise<string[]>((resolve, reject) => {
    const timer = setTimeout(async () => {
      try { 
        resolve(await callAIOnce(system, userObj, apiKey, 768)); 
      } catch (e) { 
        console.error("Hedge request failed:", e);
        reject(e); 
      }
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

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    // First attempt with standard prompt
    let lines: string[];
    try {
      lines = await callFastWithHedge(SYSTEM, userPayload, LOVABLE_API_KEY);
    } catch (err) {
      console.error("First attempt failed:", err);
      
      // Check specific error types for better status codes
      const errMsg = (err as Error).message || "";
      if (errMsg.includes("Payment required") || errMsg.includes("credits exhausted")) {
        return errorResponse(402, "Payment required or credits exhausted", { error: errMsg });
      }
      if (errMsg.includes("Rate limited")) {
        return errorResponse(429, "Rate limited, please try again later", { error: errMsg });
      }
      if (errMsg.includes("timeout")) {
        return errorResponse(408, "Request timeout", { error: errMsg });
      }
      
      return errorResponse(502, "AI provider error", { error: errMsg });
    }

    // Validate the generated lines
    if (!validLines(lines, task)) {
      console.warn("Validation failed on first attempt, retrying with stricter prompt");
      
      // Retry once with stricter prompt
      const stricterSystem = buildStricterSystemPrompt(SYSTEM, task, ["validation_failed"]);
      const stricterUserPayload = {
        ...userPayload,
        retry: true,
        strict_requirements: {
          birthday_required: task.birthday_explicit,
          anchors_required: task.require_anchors ? task.anchors?.slice(0, 6) : undefined,
          insert_words_required: task.insert_word_mode === "at_least_one" ? task.insert_words : undefined
        }
      };
      
      try {
        lines = await callAIOnce(stricterSystem, stricterUserPayload, LOVABLE_API_KEY, 896);
        
        // Validate again
        if (!validLines(lines, task)) {
          console.error("Validation failed on retry");
          return errorResponse(422, "Generated text does not meet requirements after retry", {
            lines,
            requirements: {
              birthday: task.birthday_explicit,
              anchors: task.require_anchors ? task.anchors?.slice(0, 6) : undefined
            }
          });
        }
      } catch (retryErr) {
        console.error("Retry attempt failed:", retryErr);
        const retryMsg = (retryErr as Error).message || "";
        return errorResponse(500, "Failed to generate valid text after retry", { error: retryMsg });
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
    const errMsg = (err as Error).message || "Unknown error";
    
    // Return appropriate status based on error type
    if (/timeout/i.test(errMsg)) {
      return errorResponse(408, errMsg);
    }
    return errorResponse(500, "Unexpected error", { error: errMsg });
  }
});
