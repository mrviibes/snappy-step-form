import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Get model from environment with fallback - Using GPT-4o-mini for step #2
const getTextModel = () => Deno.env.get('OPENAI_TEXT_MODEL') || 'gpt-4o-mini';

// Helper function to build OpenAI request body with correct parameters
function buildOpenAIRequest(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; maxTokens: number }
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
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
  }

  return body;
}

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple text cleanup function
function cleanLine(rawText: string): string {
  let cleaned = rawText.trim();
  
  // Remove common prefixes: numbers, bullets, quotes
  cleaned = cleaned.replace(/^\s*[\d+\-\*•]\s*[\.\)\-]?\s*/, '');
  cleaned = cleaned.replace(/^["'"'`]/, '');
  cleaned = cleaned.replace(/["'"'`]$/, '');
  
  // Remove markdown formatting
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
  cleaned = cleaned.replace(/`(.*?)`/g, '$1');
  
  // Replace em dashes with commas (post-processing filter)
  cleaned = cleaned.replace(/—/g, ',');
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Parse lines from AI response
function parseLines(rawResponse: string): string[] {
  let lines = rawResponse.split(/\r?\n/);
  
  // Try other splitting patterns if needed
  if (lines.length < 4) {
    const numberedSplit = rawResponse.split(/(?=\d+[\.\)])/);
    if (numberedSplit.length >= 4) {
      lines = numberedSplit;
    }
  }
  
  const cleanedLines = lines
    .map(line => cleanLine(line))
    .filter(line => line.length >= 35 && line.length <= 140);
  
  return cleanedLines;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<{ content: string; model: string }> {
  let model = getTextModel();
  console.log(`🤖 Using model: ${model}`);
  
  let maxTokens = model.startsWith('gpt-5') ? 4000 : 200; // Very high limit for GPT-5 reasoning + response
  
  // First attempt with GPT-5
  try {
    const requestBody = buildOpenAIRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens }
    );
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 Response Status:', response.status);
    
    const data = await response.json();
    console.log('📄 Response Data:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ API Error:', data.error);
      throw new Error(`OpenAI API Error: ${data.error.message}`);
    }
    
    const content = data.choices?.[0]?.message?.content;
    const actualModel = data.model || model; // Use actual model from response or fallback to requested model
    
    if (!content || content.trim() === '') {
      console.warn('⚠️ GPT-5 returned empty content - falling back to GPT-4o-mini');
      throw new Error('GPT-5 returned empty content');
    }
    
    return { content, model: actualModel };
    
  } catch (error) {
    // Fallback to GPT-4o-mini if GPT-5 fails
    console.log('🔄 Falling back to GPT-4o-mini due to GPT-5 failure');
    model = 'gpt-4o-mini';
    maxTokens = 200;
    
    const requestBody = buildOpenAIRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens, temperature: 0.8 }
    );
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 Fallback Response Status:', response.status);
    
    const data = await response.json();
    console.log('📄 Fallback Response Data:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ Fallback API Error:', data.error);
      throw new Error(`OpenAI API Error: ${data.error.message}`);
    }
    
    const content = data.choices?.[0]?.message?.content;
    const actualModel = data.model || model;
    
    if (!content || content.trim() === '') {
      throw new Error('Both GPT-5 and fallback model returned empty content');
    }
    
    return { content, model: actualModel };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Text generation request:', JSON.stringify(payload, null, 2));

    const { category, subcategory, tone, rating, insertWords } = payload;

    // Build simple prompt
    let systemPrompt = `You are a comedy writer. Generate exactly 4 funny sentences between 40-120 characters each.`;
    
    if (category) systemPrompt += ` Topic: ${category}`;
    if (subcategory) systemPrompt += ` > ${subcategory}`;
    if (tone) systemPrompt += ` Tone: ${tone}`;
    if (rating) systemPrompt += ` Rating: ${rating}`;
    if (insertWords && insertWords.length > 0) {
      systemPrompt += ` Include these words: ${insertWords.join(', ')}`;
    }
    
    systemPrompt += ` Return only the 4 sentences, one per line.`;

    const userPrompt = "Generate 4 funny sentences now.";

    // Call OpenAI
    const { content: rawResponse, model: usedModel } = await callOpenAI(systemPrompt, userPrompt);
    console.log('🎭 Raw AI Response:', rawResponse);

    // Parse and clean lines
    const lines = parseLines(rawResponse);
    console.log('🧹 Cleaned lines:', lines);

    // Take first 4 lines or pad if needed
    const finalLines = lines.slice(0, 4);
    
    if (finalLines.length < 4) {
      console.warn(`⚠️ Only generated ${finalLines.length} lines, expected 4`);
    }

    // Format response with debug info and model information
    const response = {
      lines: finalLines.map((line, index) => ({
        line,
        length: line.length,
        index: index + 1,
        valid: line.length >= 40 && line.length <= 120
      })),
      model: usedModel,
      count: finalLines.length
    };

    console.log(`✅ Generated ${response.lines.length} text options using model: ${usedModel}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate-text function:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error)?.message || 'Internal server error',
      debug: (error as Error)?.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});