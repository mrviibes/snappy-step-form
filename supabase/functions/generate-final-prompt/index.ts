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

  // Get mapped values
  const textLayout = layoutMap[layout] || layout;
  const dimensions = dimensionMap[dimension] || dimension;
  
  // Use first visual scene as "chosen recommended text" or fallback
  const chosenRecommendedText = insertedVisuals[0] || "dynamic scene composition";
  
  console.log('🎨 Mapped values:', { textLayout, dimensions, chosenRecommendedText });

  // Your exact positive prompt template
  const positivePrompt = `MANDATORY: "${finalText}" with ${textLayout}. ${visualStyle} with the ${dimensions}, ${chosenRecommendedText} with ${visualStyle}`;
  
  // Your exact negative prompt
  const negativePrompt = `* extra/missing/misplaced/duplicate text * distorted/low-contrast/overlapping fonts * subtitles, captions, logos, memes * blurry, pixelated, oversaturated, glitch, poor composition`;

  console.log('✅ Generated positive prompt:', positivePrompt);
  console.log('❌ Generated negative prompt:', negativePrompt);

  // Return single template with your format
  const templates: PromptTemplate[] = [
    {
      name: "Ideogram Template",
      description: "Optimized template for Ideogram image generation",
      positive: positivePrompt,
      negative: negativePrompt
    }
  ];

  return templates;
}
