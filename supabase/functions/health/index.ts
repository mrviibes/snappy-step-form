import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    
    if (!openAiKey) {
      return Response.json(
        { ok: false, error: 'No OpenAI API key configured' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Test a minimal API call to verify the key works
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
      },
    })

    if (!response.ok) {
      return Response.json(
        { ok: false, error: 'OpenAI API key invalid' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Get active models from environment
    const models = {
      text: Deno.env.get('OPENAI_TEXT_MODEL') || 'gpt-5-mini-2025-08-07',
      visuals: Deno.env.get('OPENAI_VISUALS_MODEL') || 'gpt-5-mini-2025-08-07',
      images: Deno.env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-1'
    };

    return Response.json(
      { ok: true, models },
      { headers: corsHeaders }
    )

  } catch (error) {
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 500, headers: corsHeaders }
    )
  }
})