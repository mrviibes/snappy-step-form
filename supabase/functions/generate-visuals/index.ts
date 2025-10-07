// supabase/functions/generate-visuals/index.ts
// 3.5 Turbo, topic-first. Returns exactly four lines, ≤10 words each.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const API = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-3.5-turbo";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function sysPrompt(args: {
  topics: string[];
  text: string;
  visuals: string[];
  composition: string;
}) {
  const topicText = args.topics.filter(Boolean).join(", ") || "unspecified";
  const extras = args.visuals.filter(Boolean).join(", ") || "none";

  return `
You are an art director. Generate exactly 4 ultra-brief scene descriptions.

Topics: ${topicText}
Caption text: "${args.text}"
Optional visuals to include: ${extras}
Composition: ${args.composition}

Rules:
- Output 4 separate lines, numbered 1-4.
- Each line is at most 10 words.
- Describe only what is visible and happening.
- Include topics and optional visuals naturally.
- Apply composition:
  Normal = balanced framing
  Big-Head = oversized head emphasis
  Close-Up = tight emotional crop
  Goofy = playful exaggeration
  Zoomed = wide dynamic scene
  Surreal = dreamlike oddities
- Do not mention style, camera, lens, lighting, or quality.
- No quotes, hashtags, or emojis. Commas and periods allowed.
`.trim();
}

const clean = (s: string) =>
  s.replace(/^[\s>*-]+\s*/, "").replace(/^\d+\.\s*/, "").trim();

const isTenWordsOrLess = (s: string) => s.split(/\s+/).filter(Boolean).length <= 10;

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();

    const topics: string[] = Array.isArray(body.topics) ? body.topics.filter(Boolean).slice(0, 3) : [];
    const text: string = String(body.text || "");
    const optional_visuals: string[] = Array.isArray(body.optional_visuals) ? body.optional_visuals.filter(Boolean).slice(0, 8) : [];
    const composition: string = String(body.composition || "Normal");

    console.log("[generate-visuals] Request:", { topics, text, optional_visuals, composition });

    const messages = [
      { role: "system", content: sysPrompt({ topics, text, visuals: optional_visuals, composition }) },
      { role: "user", content: "Generate now." }
    ];

    const r = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.7, max_tokens: 140 })
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("[generate-visuals] API error:", err);
      return new Response(JSON.stringify({ success: false, error: err }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    console.log("[generate-visuals] Raw response:", content);

    let lines = content.split(/\r?\n+/).map(clean).filter(Boolean);

    lines = lines
      .map(s => s.replace(/^"+|"+$/g, ""))
      .filter(isTenWordsOrLess)
      .slice(0, 4);

    console.log("[generate-visuals] Valid lines:", lines.length);

    // pad if model under-delivers
    while (lines.length < 4) {
      const base = topics[lines.length % Math.max(1, topics.length)] || "subject";
      const extra = optional_visuals[lines.length % Math.max(1, optional_visuals.length)] || "scene";
      lines.push(`${base} interacts with ${extra}.`);
    }

    console.log("[generate-visuals] Final outputs:", lines.slice(0, 4));

    return new Response(JSON.stringify({ success: true, model: MODEL, visuals: lines.slice(0, 4) }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[generate-visuals] error:", err);
    const fallback = [
      "Subject reacts to scene, playful moment.",
      "Wide view, action around subject.",
      "Close-up emotion, key prop included.",
      "Surreal twist hints at topic."
    ];
    return new Response(JSON.stringify({ success: true, model: MODEL, visuals: fallback, source: "synth-error" }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
