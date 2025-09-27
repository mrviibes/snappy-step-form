import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin"
};

interface GenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  image_dimensions?: "square" | "portrait" | "landscape";
  quality?: "high" | "medium" | "low";
  provider?: "ideogram" | "gemini";
}

interface GenerateImageResponse {
  success: boolean;
  imageData?: string;
  error?: string;
  status?: number;
  details?: string;
  jobId?: string;
  provider?: "ideogram" | "gemini";
  debugInfo?: Record<string, unknown>;
}

// ---------- helpers ----------
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Request timeout after ${ms}ms`));
    }, ms);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) break;
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 800;
      console.warn(`[retry] attempt=${attempt} delay=${Math.round(delay)}ms reason=${lastError.message}`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastError!;
}

// ---------- mappings ----------
const aspectRatioMap: Record<string, string> = { square: "1x1", portrait: "9x16", landscape: "16x9" };
const resolutionMap: Record<string, string> = { square: "1024x1024", landscape: "1536x1024", portrait: "1024x1536" };
const modelMap: Record<string, string> = { high: "V_3", medium: "V_3", low: "V_3_TURBO" };
const legacyModelMap: Record<string, string> = { high: "V_2", medium: "V_2", low: "V_2_TURBO" };
const speedMap: Record<string, string> = { high: "QUALITY", medium: "DEFAULT", low: "TURBO" };

type Provider = "ideogram" | "gemini";

// ---------- status polling for Ideogram V3 ----------
async function pollIdeogramJob(jobId: string) {
  const apiKey = Deno.env.get("IDEOGRAM_API_KEY");
  if (!apiKey) return jsonResponse({ success: false, error: "Server configuration error: IDEOGRAM_API_KEY not set" }, 500);

  try {
    const res = await withRetry(async () => {
      const fetchPromise = fetch(`https://api.ideogram.ai/v1/ideogram-v3/jobs/${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers: { "Api-Key": apiKey }
      });
      return await Promise.race([fetchPromise, timeoutPromise(15000)]);
    }, 3, 800);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return jsonResponse({
        success: false,
        error: `Job status error (${res.status})`,
        status: res.status,
        details: errText?.slice(0, 800) || "No details"
      }, 502);
    }

    const data = await res.json();
    // Expect structure: { status: "pending" | "completed" | "failed", data?: [{url or b64_json}] }
    const status = (data.status || "").toLowerCase();

    if (status === "pending" || status === "running" || status === "queued") {
      return jsonResponse({ success: true, status: "pending", provider: "ideogram", jobId });
    }
    if (status === "failed") {
      return jsonResponse({ success: false, status: "failed", error: "Job failed", details: JSON.stringify(data).slice(0, 800) }, 502);
    }

    // completed
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return jsonResponse({ success: false, error: "No image payload on completed job" }, 502);
    }
    const image = data.data[0];
    let imageData: string | undefined;

    if (image.b64_json) {
      imageData = `data:image/png;base64,${image.b64_json}`;
    } else if (image.url) {
      const imgRes = await withRetry(async () => {
        const fetchPromise = fetch(image.url);
        return await Promise.race([fetchPromise, timeoutPromise(15000)]);
      }, 2, 600);
      if (!imgRes.ok) return jsonResponse({ success: false, error: `Image fetch error (${imgRes.status})` }, 502);
      const buf = await imgRes.arrayBuffer();
      imageData = `data:image/png;base64,${arrayBufferToBase64(buf)}`;
    }

    if (!imageData) return jsonResponse({ success: false, error: "No valid image data on job result" }, 502);

    return jsonResponse({
      success: true,
      status: "completed",
      provider: "ideogram",
      imageData,
      debugInfo: { jobId, timestamp: new Date().toISOString() }
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: "Polling error",
      details: err instanceof Error ? err.message : String(err)
    }, 502);
  }
}

// ---------- main handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Polling endpoint: GET /status?jobId=...
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname === "/status") {
    const jobId = url.searchParams.get("jobId");
    if (!jobId) return jsonResponse({ success: false, error: "Missing jobId" }, 400);
    return await pollIdeogramJob(jobId);
  }

  if (req.method !== "POST") return jsonResponse({ success: false, error: "POST method required" }, 405);

  let requestBody: GenerateImageRequest;
  try {
    requestBody = await req.json();
  } catch (e) {
    return jsonResponse({ success: false, error: "Invalid JSON in request body", details: e instanceof Error ? e.message : "Unknown parsing error" }, 400);
  }

  const provider: Provider = requestBody.provider || "ideogram";
  const image_dimensions = requestBody.image_dimensions || "square";
  const quality = requestBody.quality || "high";
  const prompt = (requestBody.prompt || "").trim();
  const negativePrompt = (requestBody.negativePrompt || "").trim();

  console.log("Image generation request:", {
    provider,
    dims: image_dimensions,
    quality,
    promptPreview: prompt.slice(0, 120)
  });

  try {
    // Check keys
    if (provider === "ideogram") {
      if (!Deno.env.get("IDEOGRAM_API_KEY")) {
        return jsonResponse({ success: false, error: "Server configuration error: IDEOGRAM_API_KEY not set" }, 500);
      }
    } else {
      if (!Deno.env.get("GOOGLE_AI_API_KEY")) {
        return jsonResponse({ success: false, error: "Server configuration error: GOOGLE_AI_API_KEY not set" }, 500);
      }
    }

    // Validate inputs
    if (!prompt) return jsonResponse({ success: false, error: "Missing or invalid prompt", details: "Prompt must be a non-empty string" }, 400);
    if (prompt.length < 10) return jsonResponse({ success: false, error: "Prompt too short", details: "Prompt must be at least 10 characters long" }, 400);

    if (!["square", "portrait", "landscape"].includes(image_dimensions))
      return jsonResponse({ success: false, error: "Invalid image dimensions", details: "Must be square | portrait | landscape" }, 400);

    if (!["high", "medium", "low"].includes(quality))
      return jsonResponse({ success: false, error: "Invalid quality", details: "Must be high | medium | low" }, 400);

    let response: Response;

    if (provider === "gemini") {
      // Gemini 2.5 Flash Image
      const googleApiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
      const gBody = { contents: [{ parts: [{ text: prompt }] }] };

      response = await withRetry(async () => {
        const fetchPromise = fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${googleApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gBody)
        });
        return await Promise.race([fetchPromise, timeoutPromise(30000)]);
      }, 3, 1200);

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return jsonResponse({
          success: false,
          error: `Gemini API error (${response.status})`,
          status: response.status,
          details: errText.slice(0, 800) || "No details"
        }, 502);
      }

      const data = await response.json().catch(() => ({}));
      const candidates = data?.candidates || [];
      const parts = candidates?.[0]?.content?.parts || [];
      const part = parts.find((p: any) => (p.inlineData && p.inlineData.data) || (p.inline_data && p.inline_data.data));

      if (!part) return jsonResponse({ success: false, error: "No image data found in Gemini response" }, 502);

      const b64 = part.inlineData?.data || part.inline_data?.data;
      if (!b64) return jsonResponse({ success: false, error: "Gemini inline data was empty" }, 502);

      const imageData = `data:image/png;base64,${b64}`;
      return jsonResponse({
        success: true,
        imageData,
        debugInfo: {
          provider: "gemini",
          model: "gemini-2.5-flash-image",
          imageDimensions: `${image_dimensions} (${resolutionMap[image_dimensions]})`,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Provider: Ideogram V3
    const apiKey = Deno.env.get("IDEOGRAM_API_KEY")!;
    const form = new FormData();
    form.append("prompt", prompt);
    if (negativePrompt) form.append("negative_prompt", negativePrompt);
    form.append("aspect_ratio", aspectRatioMap[image_dimensions]);
    form.append("rendering_speed", speedMap[quality]);
    form.append("magic_prompt", "OFF");
    form.append("style_type", "GENERAL");
    form.append("num_images", "1");

    response = await withRetry(async () => {
      const fetchPromise = fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
        method: "POST",
        headers: { "Api-Key": apiKey },
        body: form
      });
      return await Promise.race([fetchPromise, timeoutPromise(30000)]);
    }, 3, 1000);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return jsonResponse({
        success: false,
        error: `Ideogram API error (${response.status})`,
        status: response.status,
        details: errText.slice(0, 800) || "No details"
      }, 502);
    }

    const data = await response.json().catch(() => ({}));

    // V3 returns job for async
    if (data.job_id || data.id) {
      const jobId = data.job_id || data.id;
      return jsonResponse({
        success: true,
        provider: "ideogram",
        status: "pending",
        jobId,
        debugInfo: {
          endpoint: "v1/ideogram-v3/generate",
          aspectRatio: aspectRatioMap[image_dimensions],
          renderingSpeed: speedMap[quality],
          model: modelMap[quality],
          resolution: resolutionMap[image_dimensions],
          timestamp: new Date().toISOString()
        }
      });
    }

    // Some responses may be sync-like
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return jsonResponse({ success: false, error: "No image data in Ideogram response" }, 502);
    }

    const first = data.data[0];
    let imageData: string | undefined;

    if (first.b64_json) {
      imageData = `data:image/png;base64,${first.b64_json}`;
    } else if (first.url) {
      const imgRes = await withRetry(async () => {
        const fetchPromise = fetch(first.url);
        return await Promise.race([fetchPromise, timeoutPromise(15000)]);
      }, 2, 700);
      if (!imgRes.ok) return jsonResponse({ success: false, error: `Image fetch error (${imgRes.status})` }, 502);
      const buf = await imgRes.arrayBuffer();
      imageData = `data:image/png;base64,${arrayBufferToBase64(buf)}`;
    }

    if (!imageData) return jsonResponse({ success: false, error: "No valid image data format found" }, 502);

    return jsonResponse({
      success: true,
      imageData,
      debugInfo: {
        provider: "ideogram",
        endpoint: "v1/ideogram-v3/generate",
        aspectRatio: aspectRatioMap[image_dimensions],
        renderingSpeed: speedMap[quality],
        model: modelMap[quality],
        resolution: resolutionMap[image_dimensions],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    let errorType = "edge_exception";
    let userMessage = "Failed to generate image";
    if (error instanceof Error) {
      if (/timeout/i.test(error.message)) { errorType = "timeout"; userMessage = "Image generation timed out. Please try again."; }
      else if (/network|fetch/i.test(error.message)) { errorType = "network_error"; userMessage = "Network error during image generation. Please try again."; }
      else { userMessage = error.message; }
    }
    return jsonResponse({
      success: false,
      error: userMessage,
      type: errorType,
      details: error instanceof Error ? error.stack?.slice(0, 500) : "No additional details"
    }, 500);
  }
});
