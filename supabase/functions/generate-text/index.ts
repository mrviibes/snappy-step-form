import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { text_rules } from "../_shared/text-rules.ts";

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

// ============== ENFORCEMENT ==============
function enforceRules(
  lines: string[],
  rules: any,
  rating: string,
  insertWords: string[] = []
) {
  const minLen = rules.length?.min_chars ?? 70;
  const maxLen = rules.length?.max_chars ?? 120;

  let processed = lines.map((raw) => {
    let t = raw.trim();
    
    // Basic cleanup
    t = t.replace(/—/g, ",").replace(/:/g, ".").replace(/;/g, ".");
    t = t.replace(/[:;…]/g, ",").replace(/["""']/g, "'");
    
    // Ensure proper ending
    if (!/[.?!]$/.test(t)) t = `${t}.`;
    
    // Basic length enforcement
    if (t.length > maxLen) t = t.slice(0, maxLen).trim();
    if (t.length < minLen && t.length > 0) {
      const padding = " and that's the truth";
      t = t + padding.slice(0, minLen - t.length);
    }
    
    return t;
  });

  // Filter by length
  processed = processed.filter(l => l.length >= minLen && l.length <= maxLen);

  return { lines: processed.slice(0, 4), enforcement: [] };
}

