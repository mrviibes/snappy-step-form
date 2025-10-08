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

// Extract imageable keywords from caption text
function extractCaptionKeywords(text: string): string[] {
  // Match concrete nouns, objects, or symbolic words (not articles/pronouns)
  const words = text.match(/\b[a-z]{4,15}\b/gi) || [];
  const stopwords = new Set(["that", "this", "with", "from", "have", "been", "were", "what", "when", "where", "more", "than", "very", "just", "only", "even", "also", "would", "could", "should"]);
  return words.filter(w => !stopwords.has(w.toLowerCase())).slice(0, 5);
}

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

  const scenePlaceHints = "street, park, café, living room, kitchen, bookstore, office, beach, rooftop, studio, stage, parade, city square, bar, club, gallery, balcony, yard, backyard, garden, sidewalk, plaza";

  // Extract keywords from caption to ground the visuals
  const captionKeywords = extractCaptionKeywords(args.text);
  const keywordHint = captionKeywords.length > 0 
    ? `Caption keywords to visualize: ${captionKeywords.join(", ")}`
    : "";

  return `
You are an art director creating four truly distinct visual concepts for a comedic editorial poster/meme.

Topics: ${topicText}
Caption text: "${args.text}"
${keywordHint}
Subject Scene (must guide all outputs): ${scene}
Required visual elements: ${visualHints}
Composition: ${args.composition}

Strict rules:
- Return EXACTLY 4 unique concepts.
- Each visual must either:
  (a) directly visualize something from the caption text (objects, props, actions mentioned)
  OR
  (b) use symbolic props to exaggerate the caption's theme
- At least ONE concept must include a literal object or metaphor from the caption.
- Each must have THREE labeled lines:

Design: (short title)
Subject: (who/what is shown, ≤10 words; include one concrete prop or action from caption)
Setting: (where it happens, ≤10 words; pick a real place: ${scenePlaceHints})

- Do NOT repeat the same place, action, or props twice.
- No abstract concepts; describe shots we can photograph.
- No camera jargon, lens specs, or emoji.

Output example:

1. Design: Garden Crawl
   Subject: Jesse stares at a snail inching along a garden path.
   Setting: Bright backyard garden with coffee mug on bench.

2. Design: Clocked Out
   Subject: Jesse yawns beside a park clock showing noon.
   Setting: Sunny park bench surrounded by pigeons.

3. Design: The Eternal Commute
   Subject: Jesse runs after a departing bus with spilled coffee.
   Setting: Busy downtown street with blurred motion.

4. Design: Turtle Time
   Subject: Jesse races a turtle on the sidewalk.
   Setting: City plaza in early morning light.
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
  return /\b(holding|laughing|dancing|reading|walking|singing|hugging|high-five|posing|mixing|cooking|painting|typing|points|raises|smiles|celebrates|stares|yawns|runs|races|watches|sips|waits|skiing|waterskiing|surfing|swimming|jumping|falling|balancing|riding|skating|climbing|swinging|loses|flips|tricks)\b/i.test(s)
      || /\b(flag|cake|banner|sign|book|balloons|confetti|coffee|phone|bag|mic|camera|cup|scarf|poster|snail|clock|turtle|watch|calendar|garden|bus|traffic|skateboard|skis|surfboard|water|snow|ramp|rails|tricks|squirrel|balance|deck|wheels)\b/i.test(s);
}

// Check if two concepts are too similar (by setting OR subject)
function conceptsAreTooSimilar(a: any, b: any): boolean {
  const settingMatch = a.setting.toLowerCase() === b.setting.toLowerCase();
  const subjectSimilar = tooSimilar(a.subject, b.subject);
  return settingMatch || subjectSimilar;
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();

    const topics: string[] = Array.isArray(body.topics) ? body.topics.filter(Boolean).slice(0,3) : [];
    const text: string = String(body.text || "");
    let visuals: string[] = Array.isArray(body.optional_visuals) ? body.optional_visuals.filter(Boolean).slice(0,8) : [];
    const composition: string = String(body.composition || "Normal");
    const subjectScene: string = typeof body.subjectScene === "string" ? body.subjectScene : "";

    // Auto-extract keywords from caption and add to visuals
    const captionKeywords = extractCaptionKeywords(text);
    visuals = [...new Set([...visuals, ...captionKeywords])].slice(0, 10);

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

    console.log("[generate-visuals] Raw AI output:", JSON.stringify(visualsOutput, null, 2));
    console.log("[generate-visuals] Topics:", topics, "Caption keywords:", captionKeywords);

    // Filter out duplicates and enforce concrete scenes with diversity
    const filtered = [];
    for (const v of visualsOutput) {
      const isDistinct = !filtered.some(f => conceptsAreTooSimilar(f, v));
      const isValid = hasConcreteSubject(v.subject) || hasRealPlace(v.setting); // Changed && to ||
      
      if (isDistinct && isValid) {
        filtered.push(v);
      } else {
        console.log("[generate-visuals] Filtered out:", v, "- concrete:", hasConcreteSubject(v.subject), "place:", hasRealPlace(v.setting));
      }
    }

    console.log("[generate-visuals] Filtered concepts count:", filtered.length);

    // Soft pad with thematic concrete fallbacks if filtering shrinks the list
    while (filtered.length < 4) {
      const idx = filtered.length;
      const mainTopic = topics[0] || "Person";
      const action = topics[1] || "performs action";
      const modifier = topics[2] || "";
      
      filtered.push({
        design: `${mainTopic} ${action} Scene ${idx + 1}`,
        subject: `${mainTopic} ${action} ${modifier} in an exaggerated way`.trim(),
        setting: `Outdoor location with props related to ${action}`
      });
      console.log("[generate-visuals] Added fallback concept:", filtered[filtered.length - 1]);
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
