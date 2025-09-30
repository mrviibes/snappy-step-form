import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { text_rules, joke_text_rules } from "../_shared/text-rules.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeneratePayload {
  category: string;
  subcategory?: string;
  theme?: string;
  tone?: string;
  rating?: string;
  insertWords?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: GeneratePayload = await req.json();
    console.log('Received payload:', payload);
    
    const { category, subcategory, tone, rating, insertWords = [], theme } = payload;
    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

    if (!GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    // Compute leaf focus token(s)
    const leaf = (theme || subcategory || "").trim();
    const leafTokens = leaf
      .toLowerCase()
      .split(/[^\p{L}\p{N}''-]+/u)
      .filter(w => w.length > 2);

    // Build system prompt
    let systemPrompt = category === "Jokes" ? joke_text_rules : text_rules;
    
    systemPrompt += `
CONTEXT
- CATEGORY: ${category || "n/a"}
- SUBCATEGORY: ${subcategory || "n/a"}
- THEME (LEAF FOCUS): ${leaf || "n/a"}`;

    systemPrompt += `

CRITICAL FORMAT: Return exactly 4 separate lines. Each line must be a complete sentence ending with punctuation. Use newline characters between each line. Do not write paragraphs or combine multiple sentences on one line.`;

    // Build userPrompt
    let userPrompt = `Write 4 ${tone?.toLowerCase() || "humorous"} one-liners that clearly center on "${leaf || "the selected theme"}".`;
    if (category?.toLowerCase() === "jokes") {
      userPrompt += ` Never say humor labels (dad-joke, pun, joke/jokes); imply the style only.`;
    }
    if (insertWords.length) {
      userPrompt += ` Each line must naturally include: ${insertWords.join(", ")}.`;
    }
    userPrompt += ` One sentence per line, ≤2 punctuation marks.`;

    console.log('Calling Gemini API...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\n${userPrompt}`
            }]
          }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 500,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Gemini response received');
    
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse lines
    let lines = generatedText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/^(output|line|option|\d+[\.\):])/i.test(l))
      .slice(0, 4);

    console.log('Parsed lines:', lines);

    // Enforce focus for concrete leaves
    function hasLeafToken(s: string) {
      const low = s.toLowerCase();
      return leafTokens.length ? leafTokens.some(t => low.includes(t)) : true;
    }

    const looksLikeLabel = /joke|pun|one-liner|knock|lightbulb/i.test(leaf);
    if (leaf && !looksLikeLabel) {
      lines = lines.map(l => (hasLeafToken(l) ? l : (() => {
        const add = leafTokens.find(t => t.length > 3) || leafTokens[0] || "";
        return add ? `${l.replace(/\.$/,"")}, ${add}.` : l;
      })()));
    }

    return new Response(
      JSON.stringify({ options: lines }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-text:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate text' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
