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
    tone,
    textStyle,
    rating,
    visualStyle,
    layout,
    dimension,
    insertedVisuals = []
  } = params;

  // Visual style mappings for Ideogram
  const visualStyleGuides: Record<string, {positive: string[], negative: string[]}> = {
    "realistic": {
      positive: ["photorealistic", "high quality photography", "natural lighting", "detailed textures", "real world"],
      negative: ["cartoon", "anime", "illustration", "vector art", "flat design", "abstract", "CGI", "3D render"]
    },
    "design": {
      positive: ["modern graphic design", "clean typography", "minimalist design", "professional layout", "sleek"],
      negative: ["photorealistic", "cluttered", "amateur design", "busy background", "realistic textures"]
    },
    "3d": {
      positive: ["3D rendered", "volumetric lighting", "high quality 3D", "realistic materials", "depth", "ray traced"],
      negative: ["2D", "flat", "hand-drawn", "sketchy", "photograph", "anime style"]
    },
    "anime": {
      positive: ["anime style", "manga illustration", "cel-shaded", "vibrant colors", "Japanese art style"],
      negative: ["photorealistic", "western cartoon", "3D render", "realistic proportions", "photograph"]
    },
    "general": {
      positive: ["artistic", "creative", "well-composed", "balanced", "high quality"],
      negative: ["poor quality", "blurry", "distorted", "amateur"]
    },
    "auto": {
      positive: ["high quality", "well-composed", "appropriate style", "professional"],
      negative: ["poor quality", "distorted", "inappropriate style", "amateur"]
    }
  };

  // Layout positioning guides with mandatory instructions and exact constraints
  const layoutGuides: Record<string, {description: string, constraints: string, mandatoryInstruction: string}> = {
    "meme-text": {
      description: "bold text overlays at top and bottom of image",
      constraints: "Layout: top and bottom text banners, text_overlay_max_fraction: 0.25, bold_readable_font",
      mandatoryInstruction: "Render exact overlay text in bold banners at the top and bottom of the image"
    },
    "lower-banner": {
      description: "clean text banner at bottom of image", 
      constraints: "Layout: lower third banner, text_overlay_max_fraction: 0.20, clean_typography",
      mandatoryInstruction: "Render exact overlay text in a lower third banner at the bottom of the image"
    },
    "side-bar": {
      description: "elegant text sidebar on left or right side",
      constraints: "Layout: side panel overlay, text_overlay_max_fraction: 0.25, vertical_text_option",
      mandatoryInstruction: "Render exact overlay text in an elegant sidebar panel on the left or right side"
    },
    "badge-callout": {
      description: "text in decorative badge or callout bubble",
      constraints: "Layout: decorative badge overlay, text_overlay_max_fraction: 0.15, badge_design, decorative_frame",
      mandatoryInstruction: "Render exact overlay text in a decorative badge or callout bubble"
    },
    "subtle-caption": {
      description: "subtle text overlay integrated naturally into scene",
      constraints: "Layout: natural integration caption, text_overlay_max_fraction: 0.20, subtle_placement",
      mandatoryInstruction: "Render exact overlay text as a subtle caption naturally integrated into the scene"
    },
    "negative-space": {
      description: "text placed strategically in empty/negative space areas",
      constraints: "Layout: strategic negative space placement, text_overlay_max_fraction: 0.25, smart_positioning",
      mandatoryInstruction: "Render exact overlay text strategically placed in empty/negative space areas"
    }
  };

  // Tone influences for mood
  const toneGuides: Record<string, {mood: string, avoid: string}> = {
    "sentimental": { mood: "warm, heartfelt, gentle, emotional, soft lighting", avoid: "cold, harsh, sarcastic, dark" },
    "humorous": { mood: "playful, fun, lighthearted, cheerful, bright", avoid: "serious, dramatic, somber, dark" },
    "playful": { mood: "energetic, fun, vibrant, joyful, colorful", avoid: "formal, stiff, boring, monochrome" },
    "savage": { mood: "bold, edgy, confident, striking, dramatic", avoid: "cute, innocent, overly sweet, soft" },
    "weird": { mood: "quirky, unusual, surreal, creative, unexpected", avoid: "conventional, boring, predictable, normal" }
  };

  // Dimension specifications
  const dimensionSpecs: Record<string, string> = {
    "square": "1:1 aspect ratio, centered composition",
    "portrait": "vertical 9:16 or 4:5 aspect ratio, portrait orientation",
    "landscape": "horizontal 16:9 or 3:2 aspect ratio, landscape orientation"
  };

  const styleGuide = visualStyleGuides[visualStyle.toLowerCase()] || visualStyleGuides["auto"];
  const layoutGuide = layoutGuides[layout.toLowerCase()] || layoutGuides["lower-banner"];
  const toneGuide = toneGuides[tone.toLowerCase()] || { mood: "appropriate", avoid: "inappropriate" };
  const dimensionSpec = dimensionSpecs[dimension.toLowerCase()] || dimensionSpecs["square"];
  const visualElements = insertedVisuals.length > 0 ? insertedVisuals.join(', ') : '';

  // Enhanced negative prompt elements for text safety
  const textNegatives = [
    "extra text", "watermarks", "spelling errors", "duplicate text", 
    "missing text", "misplaced text", "distorted font", "unreadable text",
    "text artifacts", "garbled text", "partial text", "cut-off text"
  ];

  // Generate 4 distinct templates with front-loaded text instructions
  const templates: PromptTemplate[] = [
    {
      name: "Cinematic",
      description: "Dramatic, movie-like composition with professional lighting",
      positive: `MANDATORY: ${layoutGuide.mandatoryInstruction}. Text must read: "${finalText}". Use bold, highly readable font. ${layoutGuide.constraints}. No duplicate text, spelling must be perfect.
—
${dimensionSpec}, cinematic composition, ${styleGuide.positive.join(', ')}, dramatic lighting, professional quality, ${toneGuide.mood} atmosphere, ${visualElements ? `include ${visualElements},` : ''} high production value, movie-like quality, professional cinematography`,
      negative: `${styleGuide.negative.join(', ')}, ${toneGuide.avoid}, ${textNegatives.join(', ')}, amateur quality, poor lighting, cluttered composition, low resolution, unprofessional`
    },
    {
      name: "Close-up",
      description: "Intimate, detailed focus on key elements with shallow depth",
      positive: `MANDATORY: ${layoutGuide.mandatoryInstruction}. Text must read: "${finalText}". Use bold, highly readable font. ${layoutGuide.constraints}. No duplicate text, spelling must be perfect.
—
${dimensionSpec}, close-up detailed composition, ${styleGuide.positive.join(', ')}, shallow depth of field, focus on main subject, ${toneGuide.mood} mood, ${visualElements ? `featuring ${visualElements},` : ''} macro detail, intimate perspective, sharp focus, detailed textures`,
      negative: `${styleGuide.negative.join(', ')}, ${toneGuide.avoid}, ${textNegatives.join(', ')}, wide angle, busy background, distracted focus, blurry details, poor focus, out of focus`
    },
    {
      name: "Crowd Reaction", 
      description: "Dynamic scene showing people or environment reacting to the message",
      positive: `MANDATORY: ${layoutGuide.mandatoryInstruction}. Text must read: "${finalText}". Use bold, highly readable font. ${layoutGuide.constraints}. No duplicate text, spelling must be perfect.
—
${dimensionSpec}, dynamic crowd scene, ${styleGuide.positive.join(', ')}, people reacting, energetic atmosphere, ${toneGuide.mood} energy, ${visualElements ? `with ${visualElements},` : ''} social interaction, lively scene, group dynamics, engaging composition`,
      negative: `${styleGuide.negative.join(', ')}, ${toneGuide.avoid}, ${textNegatives.join(', ')}, static scene, lonely, empty, antisocial, boring composition, lifeless, dull atmosphere`
    },
    {
      name: "Minimalist",
      description: "Clean, simple design focusing on essential elements only", 
      positive: `MANDATORY: ${layoutGuide.mandatoryInstruction}. Text must read: "${finalText}". Use clean, readable typography. ${layoutGuide.constraints}. No duplicate text, spelling must be perfect.
—
${dimensionSpec}, minimalist composition, ${styleGuide.positive.join(', ')}, clean simple design, plenty of white space, ${toneGuide.mood} simplicity, ${visualElements ? `minimal ${visualElements},` : ''} elegant simplicity, uncluttered, balanced composition, modern aesthetics`,
      negative: `${styleGuide.negative.join(', ')}, ${toneGuide.avoid}, ${textNegatives.join(', ')}, cluttered, busy, complex, overwhelming, chaotic, too many elements, messy layout`
    }
  ];

  return templates;
}