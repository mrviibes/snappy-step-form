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
- Return EXACTLY 4 unique concepts with MAXIMUM VARIETY.
- CRITICAL DIVERSITY RULE: The 4 concepts should explore DIFFERENT comedic angles and visual themes.
  Do NOT make all 4 concepts variations on the same visual motif (e.g., avoid making all 4 about hearts/Valentine's if the caption mentions "love").
- Each concept should take a DIFFERENT approach:
  * Concept 1: Literal interpretation of a specific word/phrase from the caption
  * Concept 2: Visual metaphor or exaggeration of the theme
  * Concept 3: Unexpected/absurd scenario related to the topic
  * Concept 4: Different setting/context exploring another angle
- Each visual must either:
  (a) directly visualize something from the caption text (objects, props, actions mentioned)
  OR
  (b) use symbolic props to exaggerate the caption's theme
- Each must have FIVE labeled lines:

Design: (short title)
Subject: (comedic action/concept, ≤10 words; include one concrete prop or action from caption)
Subject Photo: (photographic description of who/what: physical appearance, expression, pose, action - suitable for photography direction, ≤15 words)
Setting: (basic environment description, ≤10 words; pick a real place: ${scenePlaceHints})
Setting Photo: (detailed environment: lighting, props, atmosphere, spatial details - suitable for photography direction, ≤20 words)

- Do NOT repeat the same place, action, props, OR VISUAL THEME twice.
- Avoid clustering all 4 concepts around one symbolic item (e.g., hearts, clocks, etc.).
- Think beyond obvious symbols: if caption mentions "love," not all visuals need heart-shaped items.
- Vary the comedic approach: mix literal, metaphorical, absurd, and relatable scenarios.
- No abstract concepts; describe shots we can photograph.
- No camera jargon, lens specs, or emoji.
- Subject Photo should describe the PERSON/SUBJECT physically (what they look like, their expression, their pose).
- Setting Photo should describe the ENVIRONMENT in detail (lighting quality, props visible, atmosphere).

Output example:

1. Design: Garden Crawl
   Subject: Jesse stares at a snail inching along a garden path.
   Subject Photo: Jesse, a young man with a bemused curious expression, crouched down looking intently at ground
   Setting: Bright backyard garden with coffee mug on bench.
   Setting Photo: Sunlit garden with vibrant green plants, wooden bench with coffee mug, warm afternoon light filtering through trees

2. Design: Clocked Out
   Subject: Jesse yawns beside a park clock showing noon.
   Subject Photo: Jesse, exhausted expression with wide yawn, hand covering mouth, standing next to old clock
   Setting: Sunny park bench surrounded by pigeons.
   Setting Photo: Public park with green grass, vintage street clock, scattered pigeons, soft natural daylight creating gentle shadows

3. Design: The Eternal Commute
   Subject: Jesse runs after a departing bus with spilled coffee.
   Subject Photo: Jesse in mid-run, frustrated expression, arm outstretched toward bus, coffee cup tipping in other hand
   Setting: Busy downtown street with blurred motion.
   Setting Photo: Urban street scene with moving vehicles, pedestrians in background, motion blur on traffic, harsh city lighting

4. Design: Turtle Time
   Subject: Jesse races a turtle on the sidewalk.
   Subject Photo: Jesse in playful racing stance, competitive grin, looking down at turtle beside feet
   Setting: City plaza in early morning light.
   Setting Photo: Clean modern plaza with smooth concrete, minimal foot traffic, golden hour sunrise creating long shadows
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

    // structure results cleanly with 5 fields
    const visualsOutput = blocks.map(block => {
      const designMatch = block.match(/Design:\s*"?([^"\n]+)"?/i);
      const subjectMatch = block.match(/Subject:\s*([^\n]+)/i);
      const subjectPhotoMatch = block.match(/Subject Photo:\s*([^\n]+)/i);
      const settingMatch = block.match(/Setting:\s*([^\n]+)/i);
      const settingPhotoMatch = block.match(/Setting Photo:\s*([^\n]+)/i);
      return {
        design: designMatch ? clean(designMatch[1]) : "Untitled Concept",
        subject: subjectMatch ? clean(subjectMatch[1]) : "Unclear subject",
        subject_photo: subjectPhotoMatch ? clean(subjectPhotoMatch[1]) : "",
        setting: settingMatch ? clean(settingMatch[1]) : "Generic setting",
        setting_photo: settingPhotoMatch ? clean(settingPhotoMatch[1]) : ""
      };
    });

    console.log("[generate-visuals] Raw AI output:", JSON.stringify(visualsOutput, null, 2));
    console.log("[generate-visuals] Topics:", topics, "Caption keywords:", captionKeywords);

// Filter out only duplicates - trust the AI to generate good concepts
    const filtered = [];
    for (const v of visualsOutput) {
      const isDistinct = !filtered.some(f => conceptsAreTooSimilar(f, v));
      
      if (isDistinct) {
        filtered.push(v);
      } else {
        console.log("[generate-visuals] Filtered out duplicate:", v);
      }
    }

    console.log("[generate-visuals] Filtered concepts count:", filtered.length);

    // Soft pad with improved fallbacks if AI doesn't generate enough
    while (filtered.length < 4) {
      const idx = filtered.length;
      const mainTopic = topics[0] || "person";
      const captionWords = text.split(/\s+/).slice(0, 3).join(" ") || "situation";
      
      filtered.push({
        design: `${mainTopic} Scene ${idx + 1}`,
        subject: `Person reacting to ${captionWords} with exaggerated expression`,
        subject_photo: `A person with surprised expression, animated body language, casual attire`,
        setting: `Simple indoor space with natural props`,
        setting_photo: `Clean well-lit room with soft natural lighting, minimal background clutter, neutral walls`
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
      { design: "Fallback 1", subject: "Subject missing", subject_photo: "A person in a neutral pose", setting: "Generic background", setting_photo: "Simple environment with basic lighting" },
      { design: "Fallback 2", subject: "Subject missing", subject_photo: "A person in a neutral pose", setting: "Generic background", setting_photo: "Simple environment with basic lighting" },
      { design: "Fallback 3", subject: "Subject missing", subject_photo: "A person in a neutral pose", setting: "Generic background", setting_photo: "Simple environment with basic lighting" },
      { design: "Fallback 4", subject: "Subject missing", subject_photo: "A person in a neutral pose", setting: "Generic background", setting_photo: "Simple environment with basic lighting" }
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
