import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PollStatusRequest {
  jobId: string;
  provider: 'ideogram' | 'openai';
}

interface PollStatusResponse {
  success: boolean;
  status: 'pending' | 'completed' | 'failed';
  imageData?: string;
  error?: string;
  progress?: number;
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Helper function to convert ArrayBuffer to base64 in chunks
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks
  let binary = '';
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

async function pollIdeogramStatus(jobId: string): Promise<PollStatusResponse> {
  const ideogramApiKey = Deno.env.get('IDEOGRAM_API_KEY');
  if (!ideogramApiKey) {
    return {
      success: false,
      status: 'failed',
      error: 'Ideogram API key not configured'
    };
  }

  try {
    console.log(`Polling Ideogram job status: ${jobId}`);
    
    const response = await fetch(`https://api.ideogram.ai/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Api-Key': ideogramApiKey,
        'Authorization': `Bearer ${ideogramApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Ideogram status check failed: ${response.status} ${response.statusText}`);
      return {
        success: false,
        status: 'failed',
        error: `Status check failed: ${response.status}`
      };
    }

    const data = await response.json();
    console.log('Ideogram job status response:', JSON.stringify(data, null, 2));

    // Handle different status responses from Ideogram
    if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
      // Image is ready, fetch the image data
      if (data.data && data.data.length > 0) {
        const imageResult = data.data[0];
        
        if (imageResult.b64_json) {
          return {
            success: true,
            status: 'completed',
            imageData: `data:image/png;base64,${imageResult.b64_json}`
          };
        } else if (imageResult.url) {
          // Fetch the image from URL and convert to base64
          const imageResponse = await fetch(imageResult.url);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const imageBase64 = arrayBufferToBase64(imageBuffer);
            return {
              success: true,
              status: 'completed',
              imageData: `data:image/png;base64,${imageBase64}`
            };
          }
        }
      }
      
      return {
        success: false,
        status: 'failed',
        error: 'No image data in completed job'
      };
    } else if (data.status === 'PENDING' || data.status === 'IN_PROGRESS') {
      return {
        success: true,
        status: 'pending',
        progress: data.progress || 0
      };
    } else if (data.status === 'FAILED' || data.status === 'ERROR') {
      return {
        success: false,
        status: 'failed',
        error: data.error || 'Job failed'
      };
    } else {
      return {
        success: true,
        status: 'pending',
        progress: 0
      };
    }
  } catch (error) {
    console.error('Error polling Ideogram status:', error);
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown polling error'
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { jobId, provider }: PollStatusRequest = await req.json();

    if (!jobId) {
      return jsonResponse({
        success: false,
        status: 'failed',
        error: 'Job ID is required'
      }, 400);
    }

    console.log(`Polling status for job: ${jobId} (provider: ${provider})`);

    if (provider === 'ideogram') {
      const result = await pollIdeogramStatus(jobId);
      return jsonResponse(result);
    } else {
      return jsonResponse({
        success: false,
        status: 'failed',
        error: 'Unsupported provider'
      }, 400);
    }
  } catch (error) {
    console.error('Error in poll-image-status function:', error);
    return jsonResponse({
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});