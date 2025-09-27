import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { text_rules, joke_text_rules } from "../_shared/text-rules.ts";

// ============== MODEL ==============
const getTextModel = () => Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

// ============== CORS ==============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============== OPENAI CALL ==============
function buildOpenAIRequest(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; maxTokens: number }
) {
  const body: any = { model, messages };
  if (model.startsWith("gpt-5") || model.startsWith("o3") || model.startsWith("o4")) {
    body.max_completion_tokens = options.maxTokens;
  } else {
    body.max_tokens = options.maxTokens;
    if (options.temperature !== undefined) body.temperature = options.temperature;
  }
  return body;
}

async function callOpenAI(systemPrompt: string, userPrompt: string) {
  let model = getTextModel();
  let maxTokens = model.startsWith("gpt-5") ? 4000 : 240;

  try {
    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const content = d.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content");
    return { content, model: d.model || model };

  } catch {
    model = "gpt-4o-mini";
    const req = buildOpenAIRequest(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { maxTokens: 200, temperature: 0.8 });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const content = d.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty content (fallback)");
    return { content, model };
  }
}


// ============== HTTP ==============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { category, subcategory, tone, rating, insertWords = [] } = payload;

    let systemPrompt = category === "Jokes" ? joke_text_rules : text_rules;
    //if (category) systemPrompt += `\n\nCONTEXT: ${category}`;
   // if (subcategory) systemPrompt += ` > ${subcategory}`;
    //if (tone) systemPrompt += `\nTONE: ${tone}`;
   // if (rating) systemPrompt += `\nRATING: ${rating}`;
    //if (insertWords.length) systemPrompt += `\nINSERT WORDS: ${insertWords.join(", ")}`;
   // systemPrompt += `\n\nReturn exactly 4 sentences, one per line.`;

    // Build dynamic user prompt based on actual selections
    let userPrompt = `Create 4 distinct, ${tone?.toLowerCase() || 'funny'} one-liners`;
    
    if (category && subcategory) {
      userPrompt += ` about ${category.toLowerCase()}/${subcategory.toLowerCase()}`;
    } else if (category) {
      userPrompt += ` about ${category.toLowerCase()}`;
    }
    
    if (insertWords.length > 0) {
      userPrompt += `. CRITICAL: Each line must naturally include ALL of these words: ${insertWords.join(', ')}`;
    }
    
    userPrompt += `. Make them substantial and complete thoughts. No headers, numbers, or formatting - just the one-liners.`;
    
    const { content: raw, model } = await callOpenAI(systemPrompt, userPrompt);

    // Simple line parsing and filtering
    let lines = raw
      .split(/\r?\n+/)
      .map((line: string) => line.replace(/^\d+\.\s*/, ' ').replace(/^-\s*/, ' ').trim())
      .filter(Boolean)
      
      .slice(0, 4);

    const resp = {
      lines: lines.map((line: string, i: number) => ({
        line,
        length: line.length,
        index: i + 1,
        valid: true
      })),
      model,
      count: lines.length,
      rules_used: { id: "fallback", version: 7 }
    };

    return new Response(JSON.stringify(resp), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error('Generate text error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

