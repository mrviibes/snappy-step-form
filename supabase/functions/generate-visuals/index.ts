import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
  insertWords: string[]
  insertedVisuals: string[]
  visualStyle: string
  finalText: string
  count: number
}

interface GenerateVisualsResponse {
  success: boolean
  visuals: string[]
  model: string
  debug?: {
    lengths: number[]
    validCount: number
  }
  error?: string
}

// Get subcategory context mapping
function getSubcategoryContext(subcategory: string): string {
  const contexts: Record<string, string> = {
    'birthday': 'party table, streamers, confetti, balloons, cake, candles',
    'wedding': 'altar, bouquet, rings, reception hall, dance floor, guests',
    'graduation': 'stage, cap and gown, diploma, ceremony, audience, podium',
    'basketball': 'court, hoop, ball, players, bench, crowd, scoreboard',
    'football': 'field, goalpost, helmet, stadium, fans, sideline',
    'work': 'office, desk, computer, meeting room, colleagues, coffee',
    'dating': 'restaurant, table, flowers, dinner, romantic setting'
  };
  
  return contexts[subcategory.toLowerCase()] || 'general scene, background elements, props';
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
  const systemPrompt = `You are generating exactly 4 visual scene descriptions for AI image generation.

INPUTS:
- Category: ${params.category}
- Subcategory: ${params.subcategory} 
- Tone: ${params.tone}
- Rating: ${params.rating}
- Insert Words: ${params.insertWords.join(', ')}
- Inserted Visuals: ${params.insertedVisuals.join(', ')}
- Visual Style: ${params.visualStyle}
- Final Text: "${params.finalText}"

REQUIREMENTS:
- Generate exactly 4 distinct visual scene descriptions
- Each description must be 10-15 words long
- Each must reflect the ${params.subcategory} context (${subcategoryContext})
- Each must include the insertWords (${params.insertWords.join(', ')}) and insertedVisuals (${params.insertedVisuals.join(', ')})
- If insertWords = ["Jesse"] and insertedVisuals = ["old man yelling"], then Jesse is the old man yelling in each scene
- Each scene should be different (different locations/settings within the subcategory context)
- Keep sentences short, vivid, and concrete
- Do NOT mention the visual style (${params.visualStyle}) in the descriptions - that's applied later

Example format:
Jesse yelling at messy table, guests frozen mid-laugh, balloons drifting upward.

Return ONLY the 4 descriptions, one per line, nothing else.`;

  console.log('🎨 Generating visuals with model:', model);
  console.log('📝 System prompt:', systemPrompt);

  try {
    const requestBody = buildOpenAIRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate 4 visual scene descriptions for: ${params.finalText}` }
      ],
      { maxTokens: 500 }
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
      visuals: scenes,
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