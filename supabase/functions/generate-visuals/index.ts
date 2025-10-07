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
  subjectScene: string;
}) {
  const topicText = args.topics.filter(Boolean).join(", ") || "unspecified";
  const visualHints = args.visuals.filter(Boolean).join(", ") || "none";
  const scene = args.subjectScene && args.subjectScene.trim()
    ? args.subjectScene
    : "a real person in a relatable environment";

  const scenePlaceHints = "street, park, café, living room, kitchen, bookstore, office, beach, rooftop, studio, stage, parade, city square, bar, club, gallery, balcony, yard, backyard";

  return `
You are an art director creating four truly distinct visual concepts for a short poster/meme.

Topics: ${topicText}
Caption text: "${args.text}"
Subject Scene (must guide all outputs): ${scene}
Required visual elements: ${visualHints}
Composition: ${args.composition}

Strict rules:
- Return EXACTLY 4 unique concepts.
- Each must use the given Subject Scene and feel like a film still or editorial image.
- Each must have THREE labeled lines:

Design: (short title)
Subject: (who/what is shown, ≤10 words; include one concrete prop or action)
Setting: (where it happens, ≤10 words; pick a real place such as: ${scenePlaceHints})

- Do NOT repeat the same place or action twice.
- No abstract or monochrome-only ideas; avoid wordplay lists; describe a shot we could stage.
- No camera or lens jargon. No emoji. No quotes around the fields.

Output example:

1. Design: Sunrise Confetti
   Subject: Jesse laughs with friends, holding a small pride flag.
   Setting: City street at sunrise with streamers.

2. Design: Window Display
   Subject: Jesse points at a colorful banner in a shop window.
   Setting: Boutique storefront with bright posters.

3. Design: Rooftop Toast
   Subject: Jesse raises a cup as confetti falls.
   Setting: Rooftop terrace with city skyline.

4. Design: Coffee & Color
   Subject: Jesse smiles at a café table with a colorful scarf.
   Setting: Cozy café window with soft focus.
`.trim();
}

// Check if two subjects are too similar
function tooSimilar(a: string, b: string): boolean {
  const aTokens = a.toLowerCase().split(/\s+/);
  const bTokens = b.toLowerCase().split(/\s+/);
  const overlap = aTokens.filter(t => bTokens.includes(t)).length;
  return overlap / Math.min(aTokens.length, bTokens.length) > 0.6;
}

// Enforce concrete places
const PLACE_WORDS = [
  "street", "park", "café", "cafe", "living room", "kitchen", "bookstore", "library", "office", 
  "beach", "rooftop", "studio", "stage", "parade", "square", "balcony", "yard", "backyard", 
  "bar", "club", "gallery", "storefront", "window", "terrace", "bedroom", "dressing room"
];

function hasRealPlace(s: string): boolean {
  const t = s.toLowerCase();
  return PLACE_WORDS.some(w => t.includes(w));
}

// Enforce concrete subjects (verbs or props)
function hasConcreteSubject(s: string): boolean {
  return /\b(holding|laughing|dancing|reading|walking|singing|hugging|high-five|posing|mixing|cooking|painting|typing|points|raises|smiles|celebrates)\b/i.test(s)
      || /\b(flag|cake|banner|sign|book|balloons|confetti|coffee|phone|bag|mic|camera|cup|scarf|poster)\b/i.test(s);
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();

    const topics: string[] = Array.isArray(body.topics) ? body.topics.filter(Boolean).slice(0,3) : [];
    const text: string = String(body.text || "");
    const visuals: string[] = Array.isArray(body.optional_visuals) ? body.optional_visuals.filter(Boolean).slice(0,8) : [];
    const composition: string = String(body.composition || "Normal");
    const subjectScene: string = typeof body.subjectScene === "string" ? body.subjectScene : "";

    const messages = [
      { role: "system", content: sysPrompt({ topics, text, visuals, composition, subjectScene }) },
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

    // Filter out near-duplicates AND enforce concrete scenes
    const filtered = [];
    for (const v of visualsOutput) {
      if (!filtered.some(f => tooSimilar(f.subject, v.subject)) 
          && hasConcreteSubject(v.subject) 
          && hasRealPlace(v.setting)) {
        filtered.push(v);
      }
    }

    // Soft pad with concrete fallbacks if filtering shrinks the list
    while (filtered.length < 4) {
      const idx = filtered.length;
      filtered.push({
        design: `Concept ${idx + 1}`,
        subject: "Person smiles with friends, holding a colorful item.",
        setting: "City street at sunset with warm lighting."
      });
    }

    const finalVisuals = filtered.slice(0, 4);

    return new Response(JSON.stringify({
      success: true,
      model: MODEL,
      visuals: finalVisuals
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
