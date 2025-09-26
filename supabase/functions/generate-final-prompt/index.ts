import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  final_prompt_rules_ideogram, 
  final_prompt_rules_gemini, 
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
  console.log('🔄 Starting Gemini 2.5 prompt generation with params:', params);
  
  const {
    completed_text,
    category,
    subcategory,
    tone,
    rating,
    image_style,
    text_layout,
    image_dimensions,
    composition_modes = [],
    visual_recommendation
  } = params;

  // Handle meme-text splitting logic
  let textFormatted = completed_text;
  if (text_layout === 'meme-text') {
    const commaIndex = completed_text.indexOf(',');
    if (commaIndex !== -1) {
      const topText = completed_text.substring(0, commaIndex).trim();
      const bottomText = completed_text.substring(commaIndex + 1).trim();
      textFormatted = `Top text = ${topText}\nBottom text = ${bottomText}`;
    }
  }

  // Build category context
  const categoryContext = [category, subcategory].filter(Boolean).join('/');
  
  // Get composition mode (use first one or empty string)
  const composition_mode = composition_modes[0] || '';
  
  // Build visual recommendation text
  const visualText = visual_recommendation ? `Visuals: ${visual_recommendation}.` : '';

  console.log('🎨 Building Gemini 2.5 prompt with:', { 
    textFormatted,
    text_layout,
    categoryContext,
    composition_mode,
    visualText
  });

  // New Gemini 2.5 prompt structure
  const geminiPrompt = `MANDATORY TEXT: "${completed_text}"

Layout: ${text_layout}.${text_layout === 'meme-text' ? `
${textFormatted}.` : ''}

Typography: ALL CAPS, bold, white text with thin black outline, directly over image.
Do not use black background banners.
Add padding so top text sits slightly below top edge, bottom text sits slightly above bottom edge.

Scene: ${categoryContext}, ${image_style}, ${image_dimensions}, tone = ${tone}, rating = ${rating}.${composition_mode ? `
Composition: ${composition_mode}.` : ''}${visual_recommendation ? `
${visualText}` : ''}

Look: bright key light, high saturation, crisp focus, strong contrast, vivid colors.`;

  console.log('✅ Generated Gemini 2.5 prompt:', geminiPrompt);

  // Return Gemini template
  const templates: PromptTemplate[] = [
    {
      name: "Gemini 2.5 Template",
      description: `Optimized ${categoryContext} template with ${tone} tone for ${rating} content`,
      positive: geminiPrompt,
      negative: textQualityNegatives
    }
  ];

  return templates;
}

// getCategoryNegatives function is now imported from shared rules
