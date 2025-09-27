import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { visual_rules, subcategory_contexts } from "../_shared/visual-rules.ts"

// Get model from environment with fallback
const getVisualsModel = () => Deno.env.get('OPENAI_VISUALS_MODEL') || 'gpt-4o-mini';

// Helper function to build OpenAI request body with correct parameters
function buildOpenAIRequest(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { maxTokens: number }
) {
  const body: any = {
    model,
    messages
  };

  // GPT-5 and newer models use max_completion_tokens, older models use max_tokens
  if (model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4')) {
    body.max_completion_tokens = options.maxTokens;
    // These models don't support temperature parameter
  } else {
    body.max_tokens = options.maxTokens;
    body.temperature = 0.8;
  }

  return body;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateVisualsParams {
  category: string
  subcategory: string
  tone: string
  rating: string
  insertWords?: string[]
  composition_modes?: string[]
  image_style: string
  completed_text: string
  count: number
}

interface GenerateVisualsResponse {
  success: boolean
  visuals: { description: string }[]
  model: string
  debug?: {
    lengths: number[]
    validCount: number
  }
  error?: string
}

// Get subcategory context mapping
function getSubcategoryContext(subcategory: string): string {
  return subcategory_contexts[subcategory.toLowerCase()] || 'general scene, background elements, props';
}

async function generateVisuals(params: GenerateVisualsParams): Promise<GenerateVisualsResponse> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not found');
  }

  const model = getVisualsModel();
  
  // Get context elements for the subcategory
  const subcategoryContext = getSubcategoryContext(params.subcategory);
  
  // Build the system prompt
  const insertWords = params.insertWords || [];
  const composition_modes = params.composition_modes || [];
  
  const systemPrompt = `${visual_rules}

INPUTS:
- Category: ${params.category}
- Subcategory: ${params.subcategory} 
- Tone: ${params.tone}
- Rating: ${params.rating}
- Insert Words: ${insertWords.join(', ')}
- Composition Modes: ${composition_modes.join(', ')}
- Image Style: ${params.image_style}
- Completed Text: "${params.completed_text}"

CONTEXT: ${subcategoryContext}

Generate 4 visual scene descriptions for: "${params.completed_text}"
`;

  console.log('🎨 Generating visuals with model:', model);
  console.log('📝 System prompt:', systemPrompt);

  try {
    const requestBody = buildOpenAIRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate 4 visual scene descriptions for: ${params.completed_text}` }
      ],
      { maxTokens: 200 } // Optimal for 4 visual descriptions
    );

    console.log('📤 OpenAI request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('📥 OpenAI response:', JSON.stringify(data, null, 2));

    const generatedText = data.choices[0].message.content;
    console.log('✨ Generated content:', generatedText);

    // Check if content is empty and retry with fallback if needed
    if (!generatedText || generatedText.trim() === '') {
      console.warn('⚠️ GPT-5 returned empty content - falling back to GPT-4o-mini');
      
      // Fallback to GPT-4o-mini
      const fallbackModel = 'gpt-4o-mini';
      const fallbackRequestBody = buildOpenAIRequest(
        fallbackModel,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate 4 visual scene descriptions for: ${params.completed_text}` }
        ],
        { maxTokens: 200 }
      );

      console.log('🔄 Retrying with fallback model:', fallbackModel);

      const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackRequestBody),
      });

      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text();
        console.error('❌ Fallback API error:', fallbackResponse.status, errorText);
        throw new Error(`Fallback API error: ${fallbackResponse.status} ${errorText}`);
      }

      const fallbackData = await fallbackResponse.json();
      const fallbackText = fallbackData.choices[0].message.content;
      
      if (!fallbackText || fallbackText.trim() === '') {
        throw new Error('Both GPT-5 and fallback model returned empty content');
      }
      
      // Use fallback content
      const scenes = fallbackText
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .slice(0, 4);

      console.log('🎬 Fallback scenes:', scenes);

      const lengths = scenes.map((scene: string) => scene.split(' ').length);
      const validCount = lengths.filter((len: number) => len >= 10 && len <= 15).length;

      return {
        success: true,
        visuals: scenes.map((scene: string) => ({ description: scene })),
        model: fallbackModel,
        debug: {
          lengths,
          validCount
        }
      };
    }

    // Parse the response into individual scenes
    const scenes = generatedText
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 4); // Ensure exactly 4

    console.log('🎬 Parsed scenes:', scenes);

    // Calculate debug info
    const lengths = scenes.map((scene: string) => scene.split(' ').length);
    const validCount = lengths.filter((len: number) => len >= 10 && len <= 15).length;

    console.log('📊 Debug info - Lengths:', lengths, 'Valid count:', validCount);

    return {
      success: true,
      visuals: scenes.map((scene: string) => ({ description: scene })),
      model,
      debug: {
        lengths,
        validCount
      }
    };

  } catch (error) {
    console.error('❌ Error in generateVisuals:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: GenerateVisualsParams = await req.json();
    console.log('📨 Received params:', JSON.stringify(params, null, 2));

    const result = await generateVisuals(params);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error in generate-visuals function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      visuals: [],
      model: getVisualsModel()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});