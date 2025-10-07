// supabase/functions/generate-visuals/index.ts
// 3.5 Turbo | returns four short visual recommendations with Design, Subject, Setting

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const API = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-3.5-turbo";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// prompt builder
function sysPrompt(args: {
  topics: string[];
  text: string;
  visuals: string[];
  composition: string;
}) {
  const topicText = args.topics.filter(Boolean).join(", ") || "unspecified";
  const visualHints = args.visuals.filter(Boolean).join(", ") || "none";

  return `
You are an imaginative art director creating four completely distinct visual design ideas for a meme or short cinematic poster.

Topics: ${topicText}
Caption text: "${args.text}"
Required visual elements: ${visualHints}
Composition: ${args.composition}

Rules:
- Generate EXACTLY 4 unique concepts.
- Each must have a DIFFERENT creative approach.
  Use these lenses in order:
  1. Emotional / human moment.
  2. Environmental / cinematic composition.
  3. Comedic / exaggerated or ironic framing.
  4. Symbolic / metaphorical representation.
- Each idea MUST have three labeled parts:

Design: (short catchy creative title)
Subject: (who/what is shown, ≤10 words, distinct for each)
Setting: (where it happens, ≤10 words, distinct for each)

- Keep them short, clear, and visual — no camera jargon or style words.
- Do NOT repeat similar scenes or verbs (no "Jesse reading a book" four times).
- Make each concept feel visually unique and story-driven.

Output format example:

1. Design: "Bookmarked Love"
   Subject: Jesse bookmarks a page in a romance novel.
   Setting: Cozy bedroom lit by afternoon sun.

2. Design: "Cover to Cover"
   Subject: Jesse and a friend laugh over romance book titles.
   Setting: Vintage bookstore with warm lighting.

3. Design: "Plot Twist"
   Subject: Jesse hides a romance novel behind a sports magazine.
   Setting: Public library with bright daylight.

4. Design: "Between the Lines"
   Subject: Close-up of a folded page forming a heart.
   Setting: Modern coffee shop, soft focus background.
`.trim();
}

// Check if two subjects are too similar
function tooSimilar(a: string, b: string): boolean {
  const aTokens = a.toLowerCase().split(/\s+/);
  const bTokens = b.toLowerCase().split(/\s+/);
  const overlap = aTokens.filter(t => bTokens.includes(t)).length;
  return overlap / Math.min(aTokens.length, bTokens.length) > 0.6;
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();

    const topics: string[] = Array.isArray(body.topics) ? body.topics.filter(Boolean).slice(0,3) : [];
    const text: string = String(body.text || "");
    const visuals: string[] = Array.isArray(body.optional_visuals) ? body.optional_visuals.filter(Boolean).slice(0,8) : [];
    const composition: string = String(body.composition || "Normal");

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
        temperature: 0.9,
        top_p: 0.92,
        max_tokens: 380
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
        design: designMatch ? clean(designMatch[1]) : "Untitled Concept",
        subject: subjectMatch ? clean(subjectMatch[1]) : "Unclear subject",
        setting: settingMatch ? clean(settingMatch[1]) : "Generic setting"
      };
    });

    // Filter out near-duplicates
    const finalVisuals = [];
    for (const v of visualsOutput) {
      if (!finalVisuals.some(f => tooSimilar(f.subject, v.subject))) {
        finalVisuals.push(v);
      }
    }

    // Pad if needed
    while (finalVisuals.length < 4) {
      const idx = finalVisuals.length;
      const topic = topics[idx % Math.max(1, topics.length)] || "subject";
      const visual = visuals[idx % Math.max(1, visuals.length)] || "scene";
      finalVisuals.push({
        design: `Concept ${idx + 1}`,
        subject: `${topic} interacts with ${visual}.`,
        setting: "Generic background"
      });
    }

    return new Response(JSON.stringify({
      success: true,
      model: MODEL,
      visuals: finalVisuals.slice(0, 4)
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

const clean = (s: string) => s.replace(/^[\s>*-]+\s*/, "").trim();
