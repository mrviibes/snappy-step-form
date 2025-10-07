// supabase/functions/generate-visuals/index.ts
// 3.5 Turbo, returns four visual recommendations with Design, Subject, Setting

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
  const visualHints = args.visuals.filter(Boolean).join(", ") || "none";

  return `
You are an art director creating four visual design ideas.

Topics: ${topicText}
Caption text: "${args.text}"
Required visual elements: ${visualHints}
Composition: ${args.composition}

Rules:
- Generate exactly 4 distinct visual design ideas.
- Each idea must include ALL provided visual elements naturally.
- Each idea must have three labeled parts:

Design: (creative short title)
Subject: (who/what is shown, ≤10 words)
Setting: (where or environment, ≤10 words)

- Keep each line concise, clear, and visual.
- No quotes, emojis, camera info, lighting, or style adjectives.
Output format example:

1. Design: "Birthday Chaos"
   Subject: Jesse blows candles while balloons explode.
   Setting: Crowded party table indoors.

2. ...
`.trim();
}

const clean = (s: string) => s.replace(/^[\s>*-]+\s*/, "").trim();

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();

    const topics: string[] = Array.isArray(body.topics) ? body.topics.filter(Boolean).slice(0,3) : [];
    const text: string = String(body.text || "");
    const visuals: string[] = Array.isArray(body.optional_visuals) ? body.optional_visuals.filter(Boolean).slice(0,8) : [];
    const composition: string = String(body.composition || "Normal");

    console.log("[generate-visuals] Request:", { topics, text, visuals, composition });

    const messages = [
      { role: "system", content: sysPrompt({ topics, text, visuals, composition }) },
      { role: "user", content: "Generate 4 labeled visual concepts now." }
    ];

    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.8,
        max_tokens: 350
      })
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("[generate-visuals] API error:", err);
      return new Response(JSON.stringify({ success: false, error: err }), { 
        status: 500, 
        headers: { ...cors, "Content-Type": "application/json" } 
      });
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    console.log("[generate-visuals] Raw response:", content);

    // split results by design label
    const blocks = content
      .split(/\n\s*\d+\.\s*/g)
      .map(b => b.trim())
      .filter(Boolean)
      .slice(0, 4);

    // structure results cleanly
    const visualsOutput = blocks.map(block => {
      const designMatch = block.match(/Design:\s*"?([^"\n]+)"?/i);
      const subjectMatch = block.match(/Subject:\s*([^\n]+)/i);
      const settingMatch = block.match(/Setting:\s*([^\n]+)/i);
      return {
        design: designMatch ? designMatch[1].trim() : "Untitled Concept",
        subject: subjectMatch ? subjectMatch[1].trim() : "Unclear subject",
        setting: settingMatch ? settingMatch[1].trim() : "Generic setting"
      };
    });

    // Pad if needed
    while (visualsOutput.length < 4) {
      const idx = visualsOutput.length;
      const topic = topics[idx % Math.max(1, topics.length)] || "subject";
      const visual = visuals[idx % Math.max(1, visuals.length)] || "scene";
      visualsOutput.push({
        design: `Concept ${idx + 1}`,
        subject: `${topic} interacts with ${visual}.`,
        setting: "Generic background"
      });
    }

    console.log("[generate-visuals] Final outputs:", visualsOutput.slice(0, 4));

    return new Response(JSON.stringify({
      success: true,
      model: MODEL,
      visuals: visualsOutput.slice(0, 4)
    }), { 
      headers: { ...cors, "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("[generate-visuals] error:", err);
    const fallback = [
      { design: "Fallback 1", subject: "Subject missing", setting: "Generic background" },
      { design: "Fallback 2", subject: "Subject missing", setting: "Generic background" },
      { design: "Fallback 3", subject: "Subject missing", setting: "Generic background" },
      { design: "Fallback 4", subject: "Subject missing", setting: "Generic background" }
    ];
    return new Response(JSON.stringify({ 
      success: true, 
      model: MODEL, 
      visuals: fallback, 
      source: "synth-error" 
    }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
