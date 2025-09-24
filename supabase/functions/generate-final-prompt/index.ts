import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

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
  tone: string;
  textStyle: string;
  rating: string;
  insertWords?: string[];
  visualStyle: string;
  layout: string;
  dimension: string;
  insertedVisuals?: string[];
}

interface PromptTemplate {
  name: string;
  positive: string;
  negative: string;
  description: string;
}

interface FinalPromptResponse {
  success: boolean;
  templates?: PromptTemplate[];
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
    
    const templates = await generatePromptTemplates(body);
    console.log("Generated templates:", templates.length);
    
    return json({ 
      success: true, 
      templates 
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

async function generatePromptTemplates(params: FinalPromptRequest): Promise<PromptTemplate[]> {
  const {
    finalText,
    category,
    subcategory,
    tone,
    textStyle,
    rating,
    visualStyle,
    layout,
    dimension,
    insertedVisuals = [],
    insertWords = []
  } = params;

  // Extract category context props for better scene description
  const categoryProps = extractCategoryProps(category, subcategory, finalText, insertWords);
  
  // Visual style mappings (same as before but cleaner)
  const visualStyleGuides: Record<string, {positive: string[], negative: string[]}> = {
    "realistic": {
      positive: ["photorealistic", "natural lighting", "detailed textures"],
      negative: ["cartoon", "anime", "illustration", "CGI", "3D render"]
    },
    "design": {
      positive: ["modern graphic design", "clean typography", "professional layout"],
      negative: ["photorealistic", "cluttered", "realistic textures"]
    },
    "3d render": {
      positive: ["3D rendered", "volumetric lighting", "realistic materials"],
      negative: ["2D", "flat", "hand-drawn", "photograph"]
    },
    "3d-render": {
      positive: ["3D rendered", "volumetric lighting", "realistic materials"],
      negative: ["2D", "flat", "hand-drawn", "photograph"]
    },
    "anime": {
      positive: ["anime style", "cel-shaded", "vibrant colors"],
      negative: ["photorealistic", "3D render", "realistic proportions"]
    },
    "general": {
      positive: ["artistic", "well-composed", "balanced"],
      negative: ["poor quality", "blurry", "distorted"]
    },
    "auto": {
      positive: ["high quality", "appropriate style", "professional"],
      negative: ["poor quality", "distorted", "amateur"]
    }
  };

  // Layout mappings with better text control
  const layoutMap: Record<string, string> = {
    "meme-text": "top and bottom text banners",
    "lower-banner": "lower third banner at bottom, text only in margin", 
    "side-bar": "left sidebar banner, text only in margin, not over props",
    "badge-callout": "decorative badge or callout bubble with clear background",
    "subtle-caption": "single caption strip below subject",
    "negative-space": "text in empty space areas with high contrast"
  };

  // Dimension specs
  const dimensionMap: Record<string, string> = {
    "square": "square 1:1 aspect ratio",
    "portrait": "portrait 9:16 aspect ratio", 
    "landscape": "landscape 16:9 aspect ratio"
  };

  // Tone to mood mapping
  const toneMap: Record<string, string> = {
    "humorous": "playful mood, bright cheerful atmosphere",
    "playful": "energetic fun, vibrant joyful colors",
    "sarcastic": "subtle ironic mood, clever visual puns",
    "savage": "bold edgy mood, dramatic lighting",
    "sentimental": "warm heartfelt mood, soft golden lighting",
    "nostalgic": "dreamy nostalgic mood, vintage color grading",
    "witty": "sophisticated mood, clever composition"
  };

  const styleGuide = visualStyleGuides[visualStyle.toLowerCase()] || visualStyleGuides["auto"];
  const layoutDesc = layoutMap[layout.toLowerCase()] || "lower third text banner";
  const dimensionDesc = dimensionMap[dimension.toLowerCase()] || "square aspect ratio";
  const moodDesc = toneMap[tone.toLowerCase()] || "appropriate mood";

  // Enhanced negative prompt with overlay text safety
  const enhancedNegatives = [
    ...styleGuide.negative,
    "extra text", "missing text", "misplaced text", "duplicate text", 
    "distorted font", "low contrast text", "text overlapping props", 
    "watermarks", "low resolution", "cluttered background", "amateur quality", "poor composition"
  ];

  // Generate 4 templates with improved structure
  const templates: PromptTemplate[] = [
    {
      name: "Cinematic Wide",
      description: "Dramatic wide shot showing full context with cinematic lighting",
      positive: buildOptimizedPrompt({
        finalText,
        layoutDesc,
        dimensionDesc,
        styleDesc: styleGuide.positive.join(", "),
        variation: "cinematic",
        categoryContext: getCategoryContext(categoryProps, "wide shot"),
        moodDesc
      }),
      negative: enhancedNegatives.join(", ")
    },
    {
      name: "Close-up Detail", 
      description: "Intimate detail shot focusing on key props with shallow depth",
      positive: buildOptimizedPrompt({
        finalText,
        layoutDesc, 
        dimensionDesc,
        styleDesc: styleGuide.positive.join(", "),
        variation: "close-up",
        categoryContext: getCategoryContext(categoryProps, "close-up detail"),
        moodDesc
      }),
      negative: enhancedNegatives.join(", ")
    },
    {
      name: "Crowd Reaction",
      description: "Group scene showing people reacting to the situation", 
      positive: buildOptimizedPrompt({
        finalText,
        layoutDesc,
        dimensionDesc, 
        styleDesc: styleGuide.positive.join(", "),
        variation: "crowd reaction",
        categoryContext: getCategoryContext(categoryProps, "group scene"),
        moodDesc
      }),
      negative: enhancedNegatives.join(", ")
    },
    {
      name: "Minimalist Clean",
      description: "Simple clean composition with essential elements only",
      positive: buildOptimizedPrompt({
        finalText,
        layoutDesc,
        dimensionDesc,
        styleDesc: styleGuide.positive.join(", "), 
        variation: "minimalist",
        categoryContext: getCategoryContext(categoryProps, "clean simple"),
        moodDesc
      }),
      negative: enhancedNegatives.join(", ")
    }
  ];

  return templates;
}

// Extract props from category and text context
function extractCategoryProps(category: string, subcategory?: string, finalText?: string, insertWords: string[] = []): string[] {
  const categoryLexicons: Record<string, string[]> = {
    "nascar": ["beer", "cup", "track", "fans", "pit crew", "infield", "stands", "cars", "flags", "tailgate", "garage", "helmet"],
    "sports": ["field", "game", "players", "crowd", "stadium", "competition"],
    "birthday": ["cake", "candles", "balloons", "party", "gifts", "celebration"],
    "wedding": ["rings", "dress", "altar", "bouquet", "reception", "guests"],
    "work": ["office", "desk", "computer", "meeting", "coffee", "colleagues"],
    "dating": ["restaurant", "dinner", "conversation", "couple", "romance"]
  };

  const key = (subcategory || category).toLowerCase();
  const baseProps = categoryLexicons[key] || categoryLexicons["general"] || [];
  
  // Add insert words and text-extracted props
  const textWords = finalText?.toLowerCase().split(/\W+/).filter(w => w.length > 3) || [];
  const relevantTextProps = textWords.filter(word => 
    baseProps.some(prop => prop.includes(word) || word.includes(prop))
  );

  return [
    ...insertWords.filter(Boolean),
    ...relevantTextProps.slice(0, 3),
    ...baseProps.slice(0, 4)
  ].filter((prop, index, arr) => arr.indexOf(prop) === index).slice(0, 6);
}

// Get category-specific context description
function getCategoryContext(props: string[], variation: string): string {
  if (props.length === 0) return `${variation}`;
  
  const mainProps = props.slice(0, 3).join(", ");
  const contexts: Record<string, string> = {
    "wide shot": `wide shot with ${mainProps} visible in scene`,
    "close-up detail": `close-up focusing on ${mainProps}`,
    "group scene": `group scene with people and ${mainProps}`,
    "clean simple": `simple composition featuring ${mainProps}`
  };
  
  return contexts[variation] || `${variation} with ${mainProps}`;
}

// Enhanced overlay manager for better text placement
function buildOverlayBlock(text: string, layoutDesc: string, maxCharsPerLine = 35) {
  let clean = text.trim().replace(/\s+/g, " ");
  const words = clean.split(" ");
  let lines: string[] = [];
  let current = "";

  for (const w of words) {
    if ((current + " " + w).trim().length > maxCharsPerLine) {
      lines.push(current.trim());
      current = w;
    } else {
      current += " " + w;
    }
  }
  if (current) lines.push(current.trim());

  const wrappedText = lines.join("\\n");

  const overlayContract = `MANDATORY: Place exact overlay text once in ${layoutDesc}.
Text: "${wrappedText}"
Bold, highly readable font, high contrast, no duplicate text, spelling must be perfect.
Text must occupy ≤25% of frame.`.trim();

  const overlayBans = `extra text, missing text, misplaced text, duplicate text, distorted font,
low contrast text, text overlapping props, watermarks, cluttered background`.trim();

  return { overlayContract, overlayBans };
}

// Build optimized prompt with enhanced overlay management
function buildOptimizedPrompt(opts: {
  finalText: string;
  layoutDesc: string; 
  dimensionDesc: string;
  styleDesc: string;
  variation: string;
  categoryContext: string;
  moodDesc: string;
}): string {
  const { finalText, layoutDesc, dimensionDesc, styleDesc, variation, categoryContext, moodDesc } = opts;
  
  const { overlayContract, overlayBans } = buildOverlayBlock(finalText, layoutDesc);
  
  const positivePrompt = `${overlayContract}

${dimensionDesc}, ${styleDesc}, ${variation} composition.
Scene: ${categoryContext}.
${moodDesc}, professional quality, detailed textures, natural lighting.`.trim();

  return positivePrompt;
}