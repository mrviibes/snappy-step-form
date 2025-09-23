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
  status?: number;
  details?: string;
}

// Helper function for structured JSON responses
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Helper function for timeout with abort
function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>, 
  maxRetries = 3, 
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) break;
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'POST method required' }, 405);
  }

  let requestBody: GenerateImageRequest;
  
  try {
    requestBody = await req.json();
  } catch (error) {
    console.error('Invalid JSON in request body:', error);
    return jsonResponse({ 
      success: false, 
      error: 'Invalid JSON in request body',
      details: error instanceof Error ? error.message : 'Unknown parsing error'
    }, 400);
  }

  console.log('Image generation request received:', {
    prompt: requestBody.prompt?.substring(0, 100) + '...',
    dimension: requestBody.dimension,
    quality: requestBody.quality,
    hasNegativePrompt: !!requestBody.negativePrompt
  });

  try {
    const ideogramApiKey = Deno.env.get('IDEOGRAM_API_KEY');
    if (!ideogramApiKey) {
      return jsonResponse({
        success: false,
        error: 'Server configuration error: IDEOGRAM_API_KEY not set'
      }, 500);
    }

    // Input validation with detailed error messages
    if (!requestBody.prompt || typeof requestBody.prompt !== 'string') {
      return jsonResponse({
        success: false,
        error: 'Missing or invalid prompt',
        details: 'Prompt must be a non-empty string'
      }, 400);
    }

    if (requestBody.prompt.trim().length < 10) {
      return jsonResponse({
        success: false,
        error: 'Prompt too short',
        details: 'Prompt must be at least 10 characters long'
      }, 400);
    }

    const { prompt, negativePrompt, dimension = 'square', quality = 'high' } = requestBody;

    // Validate dimension
    const validDimensions = ['square', 'portrait', 'landscape'];
    if (!validDimensions.includes(dimension)) {
      return jsonResponse({
        success: false,
        error: 'Invalid dimension',
        details: `Dimension must be one of: ${validDimensions.join(', ')}`
      }, 400);
    }

    // Validate quality
    const validQualities = ['high', 'medium', 'low'];
    if (!validQualities.includes(quality)) {
      return jsonResponse({
        success: false,
        error: 'Invalid quality',
        details: `Quality must be one of: ${validQualities.join(', ')}`
      }, 400);
    }

    // Map dimensions to Ideogram aspect ratios
    const aspectRatioMap: Record<string, string> = {
      square: 'ASPECT_1_1',
      portrait: 'ASPECT_9_16', 
      landscape: 'ASPECT_16_9'
    };

    // Map quality to Ideogram model
    const modelMap: Record<string, string> = {
      high: 'V_2_TURBO',
      medium: 'V_2',
      low: 'V_1_TURBO'
    };

    console.log('Generating image with Ideogram:', { 
      promptLength: prompt.length, 
      dimension, 
      quality,
      aspectRatio: aspectRatioMap[dimension],
      model: modelMap[quality]
    });

    const ideogramRequestBody = {
      image_request: {
        model: modelMap[quality],
        prompt: prompt.trim(),
        negative_prompt: negativePrompt?.trim() || "poor quality, blurry, distorted, watermarks, extra text, spelling errors",
        aspect_ratio: aspectRatioMap[dimension],
        magic_prompt_option: "ON", // Enhance prompts automatically
        seed: Math.floor(Math.random() * 1000000), // Random seed for variety
        style_type: "AUTO" // Let Ideogram choose appropriate style
      }
    };

    console.log('Sending request to Ideogram API...');

    // Use retry wrapper for the API call with 30s timeout per attempt
    const response = await withRetry(async () => {
      const fetchPromise = fetch('https://api.ideogram.ai/generate', {
        method: 'POST',
        headers: {
          'Api-Key': ideogramApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ideogramRequestBody),
      });

      return await Promise.race([
        fetchPromise,
        timeoutPromise(30000) // 30 second timeout per attempt
      ]);
    }, 3, 2000); // 3 retries, 2s base delay

    console.log(`Ideogram API response status: ${response.status}`);

    if (!response.ok) {
      let errorData = '';
      try {
        errorData = await response.text();
      } catch (e) {
        errorData = 'Unable to read error response';
      }

      console.error('Ideogram API error:', {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData.substring(0, 500)
      });
      
      // Map specific error codes to user-friendly messages
      let userMessage = '';
      switch (response.status) {
        case 400:
          userMessage = 'Invalid request parameters. Please check your prompt and settings.';
          break;
        case 401:
          userMessage = 'Authentication failed. API key may be invalid.';
          break;
        case 402:
          userMessage = 'Insufficient credits or billing issue.';
          break;
        case 429:
          userMessage = 'Rate limit exceeded. Please try again in a moment.';
          break;
        case 500:
          userMessage = 'Ideogram server error. Please try again.';
          break;
        default:
          userMessage = `API error (status ${response.status})`;
      }
      
      return jsonResponse({
        success: false,
        error: userMessage,
        status: response.status,
        details: errorData.substring(0, 800) || 'No additional details available'
      }, 502);
    }

    let data: any;
    try {
      data = await response.json();
    } catch (error) {
      console.error('Failed to parse Ideogram response as JSON:', error);
      return jsonResponse({
        success: false,
        error: 'Invalid response format from image API',
        details: 'Response was not valid JSON'
      }, 502);
    }

    console.log('Ideogram response structure:', {
      hasData: !!data.data,
      dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
      dataLength: Array.isArray(data.data) ? data.data.length : 'N/A'
    });
    
    // Validate response structure
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      console.error('Invalid Ideogram response structure:', {
        data: data.data,
        keys: Object.keys(data)
      });
      return jsonResponse({
        success: false,
        error: 'No image data in API response',
        details: 'The image generation API returned an empty or invalid result'
      }, 502);
    }

    // Get the first generated image
    const imageResult = data.data[0];
    if (!imageResult.url && !imageResult.b64_json) {
      console.error('No image URL or base64 data in response:', imageResult);
      return jsonResponse({
        success: false,
        error: 'No image data found',
        details: 'API returned result without image URL or base64 data'
      }, 502);
    }

    let imageData: string;
    
    try {
      if (imageResult.b64_json) {
        // If we have base64 data, use it directly
        imageData = `data:image/png;base64,${imageResult.b64_json}`;
        console.log('Using base64 image data from Ideogram');
      } else if (imageResult.url) {
        console.log('Fetching image from URL:', imageResult.url);
        
        // If we have a URL, fetch and convert to base64 with timeout
        const imageResponse = await withRetry(async () => {
          const fetchPromise = fetch(imageResult.url);
          return await Promise.race([
            fetchPromise,
            timeoutPromise(15000) // 15 second timeout for image download
          ]);
        }, 2, 1000); // 2 retries for image download
        
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        imageData = `data:image/png;base64,${imageBase64}`;
        console.log('Successfully converted image URL to base64');
      } else {
        throw new Error('No valid image data format found in response');
      }
    } catch (error) {
      console.error('Error processing image data:', error);
      return jsonResponse({
        success: false,
        error: 'Failed to process generated image',
        details: error instanceof Error ? error.message : 'Unknown image processing error'
      }, 500);
    }

    console.log('Image generated successfully via Ideogram');

    return jsonResponse({
      success: true,
      imageData
    });

  } catch (error) {
    console.error('Unexpected error in generate-image function:', error);
    
    // Determine if this is a timeout, network, or other error
    let errorType = 'edge_exception';
    let userMessage = 'Failed to generate image';
    
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        errorType = 'timeout';
        userMessage = 'Image generation timed out. Please try again.';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        errorType = 'network_error';
        userMessage = 'Network error during image generation. Please check your connection and try again.';
      } else {
        userMessage = error.message;
      }
    }

    return jsonResponse({
      success: false,
      error: userMessage,
      type: errorType,
      details: error instanceof Error ? error.stack?.substring(0, 500) : 'No additional details'
    }, 500);
  }
});