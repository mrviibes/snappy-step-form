import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const CHAT_MODEL = "gpt-4o-mini";

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "vary": "Origin"
};

interface FinalPromptRequest {
  finalText: string;
  category: string;
  subcategory?: string;
  subSubcategory?: string;
  tone: string;
  textStyle: string;
  rating: string;
  insertWords?: string[];
  comedianStyle?: string;
  visualStyle: string;
  layout: string;
  dimension: string;
  insertedVisuals?: string[];
}

interface FinalPromptResponse {
  success: boolean;
  positivePrompt?: string;
  negativePrompt?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  if (req.method !== "POST") {
    return json({ success: false, error: "POST only" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    console.log("Request received:", body);
    
    // Validate required fields
    if (!body.finalText || !body.visualStyle || !body.layout || !body.dimension) {
      return json({ 
        success: false, 
        error: "Missing required fields: finalText, visualStyle, layout, dimension" 
      }, 400);
    }
    
    const prompts = await generatePrompts(body);
    console.log("Generated prompts:", prompts);
    
    return json({ 
      success: true, 
      positivePrompt: prompts.positive,
      negativePrompt: prompts.negative
    });
  } catch (e) {
    console.error("Generation error:", e);
    return json({ 
      success: false, 
      error: String(e?.message || "prompt_generation_failed") 
    }, 500);
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders,
  });
}

async function generatePrompts(params: FinalPromptRequest): Promise<{positive: string, negative: string}> {
  const {
    finalText,
    category,
    subcategory,
    subSubcategory,
    tone,
    textStyle,
    rating,
    insertWords = [],
    comedianStyle,
    visualStyle,
    layout,
    dimension,
    insertedVisuals = []
  } = params;

  // Build context for the prompt
  const categoryPath = [category, subcategory, subSubcategory].filter(Boolean).join(' > ');
  const insertWordsText = insertWords.length > 0 ? insertWords.join(', ') : 'none';
  const visualElements = insertedVisuals.length > 0 ? insertedVisuals.join(', ') : 'none';

  // Visual style mappings
  const visualStyleGuides: Record<string, {positive: string[], negative: string[]}> = {
    "Realistic": {
      positive: ["photorealistic", "high quality photography", "natural lighting", "detailed textures"],
      negative: ["cartoon", "anime", "illustration", "vector art", "flat design", "abstract"]
    },
    "Design": {
      positive: ["modern graphic design", "clean typography", "minimalist", "professional design", "sleek"],
      negative: ["photorealistic", "cluttered", "amateur design", "busy background"]
    },
    "3D Render": {
      positive: ["3D rendered", "volumetric lighting", "high quality 3D", "realistic materials", "depth"],
      negative: ["2D", "flat", "hand-drawn", "sketchy", "low poly unless stylized"]
    },
    "Anime": {
      positive: ["anime style", "manga illustration", "cel-shaded", "vibrant colors", "Japanese art style"],
      negative: ["photorealistic", "western cartoon", "3D render", "realistic proportions"]
    },
    "General": {
      positive: ["artistic", "creative", "well-composed", "balanced"],
      negative: ["poor quality", "blurry", "distorted"]
    },
    "Auto": {
      positive: ["high quality", "well-composed", "appropriate style"],
      negative: ["poor quality", "distorted", "inappropriate style"]
    }
  };

  // Layout positioning guides
  const layoutGuides: Record<string, string> = {
    "meme-text": "text overlays at top and bottom of image",
    "lower-banner": "text banner at bottom of image", 
    "side-bar": "text sidebar on left or right side",
    "badge-callout": "text in decorative badge or callout bubble",
    "subtle-caption": "subtle text overlay integrated into scene",
    "negative-space": "text placed in empty/negative space areas"
  };

  // Tone influences
  const toneGuides: Record<string, {mood: string, avoid: string}> = {
    "Sentimental": { mood: "warm, heartfelt, gentle, emotional", avoid: "cold, harsh, sarcastic" },
    "Humorous": { mood: "playful, fun, lighthearted, cheerful", avoid: "serious, dramatic, somber" },
    "Playful": { mood: "energetic, fun, vibrant, joyful", avoid: "formal, stiff, boring" },
    "Savage": { mood: "bold, edgy, confident, striking", avoid: "cute, innocent, overly sweet" },
    "Weird": { mood: "quirky, unusual, surreal, creative", avoid: "conventional, boring, predictable" }
  };

  // Rating considerations
  const ratingGuides: Record<string, {allow: string, avoid: string}> = {
    "G": { allow: "family-friendly, wholesome, innocent", avoid: "suggestive, dark themes, adult content" },
    "PG": { allow: "mild themes, gentle humor", avoid: "explicit content, strong themes" },
    "PG-13": { allow: "moderate themes, some edge", avoid: "explicit content, extreme themes" },
    "R": { allow: "mature themes, edgy content", avoid: "extremely graphic content" }
  };

  const styleGuide = visualStyleGuides[visualStyle] || visualStyleGuides["Auto"];
  const layoutGuide = layoutGuides[layout] || "text overlay";
  const toneGuide = toneGuides[tone] || { mood: "appropriate", avoid: "inappropriate" };
  const ratingGuide = ratingGuides[rating] || { allow: "appropriate content", avoid: "inappropriate content" };

  // Dimension specifications
  const dimensionSpecs: Record<string, string> = {
    "Square": "1:1 aspect ratio, square composition",
    "Portrait": "vertical orientation, 9:16 or 4:5 aspect ratio",
    "Landscape": "horizontal orientation, 16:9 or 3:2 aspect ratio"
  };

  const system = `You are a text-to-image prompt generator for Ideogram AI. Create precise positive and negative prompts.

Rules:
- Positive prompt: describe what to include, emphasizing visual style, composition, and text placement
- Negative prompt: describe what to avoid, preventing style conflicts and unwanted elements
- Always specify text overlay requirements clearly
- Consider tone, rating, and visual style compatibility
- Keep prompts under 500 characters each
- Be specific about visual elements and composition

Output format: JSON with "positive" and "negative" keys only.`;

  const user = `Generate Ideogram prompts for:

Text to display: "${finalText}"
Category: ${categoryPath}
Tone: ${tone} (${toneGuide.mood})
Visual Style: ${visualStyle}
Layout: ${layout} (${layoutGuide})
Dimension: ${dimension} (${dimensionSpecs[dimension] || "standard composition"})
Rating: ${rating} (${ratingGuide.allow})
Visual elements to include: ${visualElements}

Style requirements:
- Include: ${styleGuide.positive.join(', ')}
- Avoid: ${styleGuide.negative.join(', ')}

Composition:
- ${dimensionSpecs[dimension]}
- ${layoutGuide}
- Mood: ${toneGuide.mood}

Create prompts that ensure the text "${finalText}" is clearly displayed as ${layoutGuide}.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from OpenAI");
  }

  try {
    // Parse JSON response
    const parsed = JSON.parse(content);
    
    if (!parsed.positive || !parsed.negative) {
      throw new Error("Invalid response format");
    }

    return {
      positive: parsed.positive,
      negative: parsed.negative
    };
  } catch (parseError) {
    console.error("Failed to parse OpenAI response:", content);
    
    // Fallback: create structured prompts manually
    const positive = `${styleGuide.positive.join(', ')}, ${dimensionSpecs[dimension]}, ${layoutGuide} showing "${finalText}", ${toneGuide.mood} mood, ${visualElements !== 'none' ? `include ${visualElements},` : ''} high quality, well-composed`;
    
    const negative = `${styleGuide.negative.join(', ')}, ${toneGuide.avoid}, ${ratingGuide.avoid}, poor quality, blurry, distorted, extra text, watermarks`;

    return { positive, negative };
  }
}