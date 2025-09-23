import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  dimension?: 'square' | 'portrait' | 'landscape';
  quality?: 'high' | 'medium' | 'low';
}

interface GenerateImageResponse {
  success: boolean;
  imageData?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ideogramApiKey = Deno.env.get('IDEOGRAM_API_KEY');
    if (!ideogramApiKey) {
      throw new Error('IDEOGRAM_API_KEY is not set');
    }

    const { prompt, negativePrompt, dimension = 'square', quality = 'high' }: GenerateImageRequest = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prompt is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Map dimensions to Ideogram aspect ratios
    const aspectRatioMap = {
      square: 'ASPECT_1_1',
      portrait: 'ASPECT_9_16', 
      landscape: 'ASPECT_16_9'
    };

    // Map quality to Ideogram model
    const modelMap = {
      high: 'V_2_TURBO',
      medium: 'V_2',
      low: 'V_1_TURBO'
    };

    console.log('Generating image with Ideogram:', { prompt: prompt.slice(0, 100), dimension, quality });

    const requestBody = {
      image_request: {
        model: modelMap[quality],
        prompt: prompt,
        negative_prompt: negativePrompt || "poor quality, blurry, distorted, watermarks, extra text, spelling errors",
        aspect_ratio: aspectRatioMap[dimension],
        magic_prompt_option: "ON", // Enhance prompts automatically
        seed: Math.floor(Math.random() * 1000000), // Random seed for variety
        style_type: "AUTO" // Let Ideogram choose appropriate style
      }
    };

    const response = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ideogramApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Ideogram API error:', response.status, errorData);
      
      // Return detailed error information
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Ideogram API error: ${response.status}`,
          details: errorData.slice(0, 800),
          status: response.status
        }),
        { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Ideogram response structure:', Object.keys(data));
    
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      console.error('Invalid Ideogram response structure:', data);
      throw new Error('Invalid response from Ideogram API - no image data');
    }

    // Get the first generated image
    const imageResult = data.data[0];
    if (!imageResult.url && !imageResult.b64_json) {
      console.error('No image URL or base64 data in response:', imageResult);
      throw new Error('No image data in Ideogram response');
    }

    let imageData: string;
    
    if (imageResult.b64_json) {
      // If we have base64 data, use it directly
      imageData = `data:image/png;base64,${imageResult.b64_json}`;
    } else if (imageResult.url) {
      // If we have a URL, fetch and convert to base64
      const imageResponse = await fetch(imageResult.url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from URL: ${imageResponse.status}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      imageData = `data:image/png;base64,${imageBase64}`;
    } else {
      throw new Error('No valid image data format found');
    }

    console.log('Image generated successfully via Ideogram');

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-image function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to generate image',
        type: 'edge_exception'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});