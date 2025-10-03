import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    // Dumb liveness check
    const ok = true;
    return new Response(JSON.stringify({ ok, service: "healthz", ts: Date.now() }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers });
  }
});
