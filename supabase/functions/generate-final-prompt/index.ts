import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  subSubcategory?: string;
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

serve(async (req) => {
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
      error: String((e as Error)?.message || "prompt_generation_failed") 
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
  console.log('🔄 Starting prompt generation with params:', params);
  
  const {
    finalText,
    category,
    subcategory,
    subSubcategory,
    tone,
    textStyle,
    rating,
    insertWords = [],
    visualStyle,
    layout,
    dimension,
    insertedVisuals = []
  } = params;

  // Map layout to text layout descriptions
  const layoutMap: Record<string, string> = {
    "meme-text": "top and bottom text banners",
    "lower-banner": "lower third banner", 
    "side-bar": "side banner layout",
    "badge-callout": "badge callout design",
    "subtle-caption": "subtle caption placement",
    "negative-space": "negative space text layout",
    "open-space": "open space layout"
  };

  // Map dimension to proper format
  const dimensionMap: Record<string, string> = {
    "square": "1:1 aspect ratio",
    "portrait": "9:16 aspect ratio", 
    "landscape": "16:9 aspect ratio"
  };

  // Map tone to descriptive words
  const toneMap: Record<string, string> = {
    "humorous": "funny, witty, playful",
    "savage": "aggressive, intense, bold, cutting",
    "sarcastic": "witty, ironic, sharp",
    "wholesome": "warm, positive, uplifting",
    "dark": "edgy, moody, dramatic",
    "inspirational": "motivating, uplifting, powerful"
  };

  // Map rating to content guidelines
  const ratingMap: Record<string, string> = {
    "G": "family-friendly, innocent, wholesome",
    "PG": "mild content, suitable for general audiences", 
    "PG-13": "moderate content, some mature themes",
    "R": "adult content, intense themes, mature audiences"
  };

  // Build category context
  const categoryContext = [category, subcategory, subSubcategory].filter(Boolean).join(' ');
  
  // Get mapped values
  const textLayout = layoutMap[layout] || layout;
  const dimensions = dimensionMap[dimension] || dimension;
  const toneDescriptor = toneMap[tone.toLowerCase()] || tone.toLowerCase();
  const ratingGuideline = ratingMap[rating] || "appropriate for general audiences";
  
  // Use first visual scene as context or create category-based scene
  const visualScene = insertedVisuals[0] || `${categoryContext} scene`;
  
  // Build emphasis for specific words
  const wordEmphasis = insertWords.length > 0 
    ? ` Pay special attention to prominently featuring these key words: ${insertWords.join(', ')}.`
    : '';

  console.log('🎨 Mapped values:', { 
    textLayout, 
    dimensions, 
    toneDescriptor, 
    ratingGuideline,
    categoryContext,
    visualScene,
    wordEmphasis
  });

  // Enhanced positive prompt with ALL context
  const positivePrompt = `Create a ${visualStyle} style ${categoryContext} image with ${dimensions}. The scene should be ${toneDescriptor} and ${ratingGuideline}. MANDATORY TEXT: "${finalText}" must be prominently displayed using ${textLayout} placement with bold, high-contrast typography. The image should feature a ${visualScene} that complements the ${tone} tone.${wordEmphasis} Ensure excellent readability, professional typography, and visual appeal that matches the ${visualStyle} aesthetic.`;
  
  // Enhanced negative prompt with category-specific exclusions
  const categoryNegatives = getCategoryNegatives(category, rating);
  const negativePrompt = `blurry text, illegible text, cut-off text, overlapping text, distorted fonts, low contrast text, missing text, extra text, duplicate text, subtitles, watermarks, logos, poor typography, pixelated text, compressed text, unreadable fonts, text outside frame, misaligned text, poor composition, low quality, overexposed, underexposed, ${categoryNegatives}`;

  console.log('✅ Generated positive prompt:', positivePrompt);
  console.log('❌ Generated negative prompt:', negativePrompt);

  // Return enhanced template
  const templates: PromptTemplate[] = [
    {
      name: "Ideogram Template",
      description: `Optimized ${categoryContext} template with ${tone} tone for ${rating} content`,
      positive: positivePrompt,
      negative: negativePrompt
    }
  ];

  return templates;
}

function getCategoryNegatives(category: string, rating: string): string {
  const baseNegatives: Record<string, string> = {
    "sports": "blurry motion, incorrect anatomy, floating objects, unnatural poses",
    "celebration": "sad expressions, dark moods, negative emotions",
    "workplace": "unprofessional content, inappropriate behavior",
    "relationships": "toxic behavior, harmful stereotypes",
    "animals": "distorted animals, unnatural animal features"
  };

  const ratingNegatives: Record<string, string> = {
    "G": "violence, adult themes, inappropriate content, mature themes",
    "PG": "explicit violence, strong adult themes, inappropriate language",
    "PG-13": "extreme violence, explicit adult content", 
    "R": "illegal content, extreme graphic violence"
  };

  const categoryNeg = baseNegatives[category.toLowerCase()] || "";
  const ratingNeg = ratingNegatives[rating] || "";
  
  return [categoryNeg, ratingNeg].filter(Boolean).join(', ');
}
