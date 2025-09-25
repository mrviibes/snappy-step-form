import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Get model from environment with fallback
const getVisualsModel = () => Deno.env.get('OPENAI_VISUALS_MODEL') || 'gpt-5-2025-08-07';

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
  const insertWords = params.insertWords || [];
  const composition_modes = params.composition_modes || [];
  
  /*const systemPrompt = `You are generating exactly 4 visual scene descriptions for AI image generation.

INPUTS:
- Category: ${params.category}
- Subcategory: ${params.subcategory} 
- Tone: ${params.tone}
- Rating: ${params.rating}
- Insert Words: ${insertWords.join(', ')}
- Composition Modes: ${composition_modes.join(', ')}
- Image Style: ${params.image_style}
- Completed Text: "${params.completed_text}"

REQUIREMENTS:
- Generate exactly 4 distinct visual scene descriptions
- Each description must be 10-15 words long
- Each must reflect the ${params.subcategory} context (${subcategoryContext})
- Each must include the insertWords (${insertWords.join(', ')}) and composition_modes (${composition_modes.join(', ')})
- If insertWords = ["example"] and composition_modes = ["old man yelling"], then use the example in the old man yelling scene
- Each scene should be different (different locations/settings within the subcategory context)
- Keep sentences short, vivid, and concrete
- Do NOT mention the image style (${params.image_style}) in the descriptions - that's applied later

Example format:
Character yelling at messy table, guests frozen mid-laugh, balloons drifting upward.

Return ONLY the 4 descriptions, one per line, nothing else.`;*/

  const systemPrompt = `VISUAL GENERATION RULES

GENERAL
- All visuals must clearly support the completed_text.
- Insert words (e.g., names, phrases) must appear in the text overlay if required, not forced into objects.
- Visuals must match the humor baseline and tone context.
- Use the selected style, dimension, and layout exactly as specified.

STRUCTURE
- Category → Broad context for the scene (e.g., Celebrations, Sports, Pop Culture).
- Subcategory → Narrows the scene (e.g., Engagement, Birthday, Wedding).
- Tone → Determines energy of the visuals (Savage = bold, edgy; Sentimental = warm, soft).
- Rating → Affects maturity of visual jokes (G = family-safe; R = raw, adult themes).
- InsertWords → Only applied to on-image text banners, never literal props.

STYLE
- realistic → Photographic look, sharp detail.
- caricature → Exaggerated features, comedic distortion.
- anime → Stylized, bright, character-driven.
- pop_art → Bold, colorful, flat stylization.
- 3d_render → High-detail, cinematic rendering.
- illustrated → Hand-drawn or painted feel.

DIMENSION
- square (1:1) → Balanced memes, general use.
- portrait (9:16) → Mobile/tall poster formats.
- landscape (16:9) → Meme banners, cinematic.

LAYOUT
- minimalist → Clean, few props, negative space for text.
- badge_callout → Strong text callouts with graphical framing.
- meme_text → Top and bottom banners.
- lower_banner → Single text bar at bottom.
- side_bar → Vertical text block.
- caption → Small text line at bottom.

COMPOSITION MODES
- Always respect the list provided (e.g., minimalist, chaotic, surreal).
- Minimalist → Clean props, empty background, sharp focus on subject.
- Chaotic → Overstuffed with exaggerated props and detail.
- Surreal → Weird, dreamlike juxtapositions.

OUTPUT
- Always return 4 visual concepts per request.
- Each concept must be distinct (different props, scene framing, or mood).
- No duplicate object arrangements across the 4 outputs.`;

  console.log('🎨 Generating visuals with model:', model);
  console.log('📝 System prompt:', systemPrompt);

  try {
    const requestBody = buildOpenAIRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate 4 visual scene descriptions for: ${params.completed_text}` }
      ],
      { maxTokens: 4000 } // Very high limit for GPT-5 reasoning + response
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