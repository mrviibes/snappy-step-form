import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const env = {
      OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") ? "✅ set" : "❌ missing",
    };

    return new Response(
      JSON.stringify(
        {
          success: true,
          message: "generate-text-debug alive",
          method: req.method,
          url: req.url,
          payload: body,
          env,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      ),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: String(e) }, null, 2),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
