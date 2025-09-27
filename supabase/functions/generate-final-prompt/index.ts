import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  final_prompt_rules, 
  layoutMap, 
  dimensionMap, 
  toneMap, 
  ratingMap, 
  textQualityNegatives,
  getCategoryNegatives 
} from "../_shared/final-prompt-rules.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "vary": "Origin"
};

interface FinalPromptRequest {
  completed_text: string;
  category: string;
  subcategory?: string;
  tone: string;
  rating: string;
  insertWords?: string[];
  image_style: string;
  text_layout: string;
  image_dimensions: string;
  composition_modes?: string[];
  visual_recommendation?: string;
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
    if (!body.completed_text || !body.image_style || !body.text_layout || !body.image_dimensions) {
      return json({ 
        success: false, 
        error: "Missing required fields: completed_text, image_style, text_layout, image_dimensions" 
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
    completed_text,
    category,
    subcategory,
    tone,
    rating,
    insertWords = [],
    image_style,
    text_layout,
    image_dimensions,
    composition_modes = [],
    visual_recommendation
  } = params;

  // Build category context
  const categoryContext = [category, subcategory].filter(Boolean).join(' ');
  
  // Get mapped values from imported rules
  const textLayout = layoutMap[text_layout] || text_layout;
  const dimensions = dimensionMap[image_dimensions] || image_dimensions;
  const toneDescriptor = toneMap[tone.toLowerCase()] || tone.toLowerCase();
  const ratingGuideline = ratingMap[rating] || "appropriate for general audiences";
  
  // Use first visual scene as context or create category-based scene
  const visualScene = composition_modes[0] || `${categoryContext} scene`;

  // Build visual recommendation text
  const visualRecommendationText = visual_recommendation ? `${visual_recommendation} ` : '';

  console.log('🎨 Mapped values:', { 
    textLayout, 
    dimensions, 
    toneDescriptor, 
    ratingGuideline,
    categoryContext,
    visualScene
  });

  // Enhanced positive prompt with ALL context
  const positivePrompt = `MANDATORY TEXT: "${completed_text}" must be prominently displayed using ${textLayout} placement with bold, high-contrast typography. Text must be spelled exactly as written, with no substitutions or missing letters. Create a ${image_style} style ${categoryContext} image with ${dimensions} and scene should be ${toneDescriptor} and ${ratingGuideline}. The image should feature a ${visualScene} that complements the ${tone} tone. ${visualRecommendationText} Ensure excellent readability, professional typography, and visual appeal that matches the ${image_style} aesthetic.`;
  
  // Simple negative prompt using imported text quality negatives
  const negativePrompt = textQualityNegatives;

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

// getCategoryNegatives function is now imported from shared rules
