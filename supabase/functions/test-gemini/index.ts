import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    
    if (!googleApiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'GOOGLE_AI_API_KEY not set',
        hasKey: false
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Test simple Gemini API call
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Generate a simple test image of a red apple"
          }]
        }]
      }),
    });

    const responseText = await response.text();
    
    return new Response(JSON.stringify({ 
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      hasKey: true,
      response: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : '')
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});