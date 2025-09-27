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

// ============== BACKFILL TO 4 ==============
async function backfillLines(
  missing: number,
  systemPrompt: string,
  accepted: string[],
  tone: string,
  rating: string,
  insertWords: string[]
) {
  const block = accepted.map((l,i)=>`${i+1}. ${l}`).join("\n");
  const user = `We still need ${missing} additional one-liners that satisfy ALL constraints.
Do not repeat word pairs used in:
${block}
Tone=${tone}; Rating=${rating}; Insert words=${insertWords.join(", ")}.
CRITICAL: Each new line must be EXACTLY 70-120 characters long - count carefully! Make them complete, substantial thoughts.
Return exactly ${missing} new lines, one per line.`;
  const { content } = await callOpenAI(systemPrompt, user);
  
  // Simple line parsing
  return content
    .split(/\r?\n+/)
      .map((line: string) => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim())
    .filter(Boolean)
    .slice(0, missing);
}

// ============== HTTP ==============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { category, subcategory, tone, rating, insertWords = [] } = payload;

    let systemPrompt = text_rules;
    if (category)    systemPrompt += `\n\nCONTEXT: ${category}`;
    if (subcategory) systemPrompt += ` > ${subcategory}`;
    if (tone)        systemPrompt += `\nTONE: ${tone}`;
    if (rating)      systemPrompt += `\nRATING: ${rating}`;
    if (insertWords.length) systemPrompt += `\nINSERT WORDS: ${insertWords.join(", ")}`;
    systemPrompt += `\n\nReturn exactly 4 sentences, one per line.`;

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
    
    userPrompt += `. CRITICAL: Each line must be EXACTLY between 70-120 characters long - count carefully! Make them substantial and complete thoughts. No headers, numbers, or formatting - just the one-liners.`;
    const { content: raw, model } = await callOpenAI(systemPrompt, userPrompt);

    let candidates = raw
      .split(/\r?\n+/)
      .map((line: string) => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim())
      .filter(Boolean);

    const fallbackRules = { length:{min_chars:70,max_chars:120}, punctuation:{max_marks_per_sentence:2,ban_em_dash:true,replacement:{"—":",",":":".",";":"."}}, max_sentences:1 };
    const enforced = enforceRules(candidates, fallbackRules, rating || "PG-13", insertWords);
    let lines = enforced.lines;

    let tries = 0;
    while (lines.length < 4 && tries < 2) {
      const need = 4 - lines.length;
      const more = await backfillLines(need, systemPrompt, lines, tone || "", rating || "PG-13", insertWords);
      const enforcedMore = enforceRules(more, fallbackRules, rating || "PG-13", insertWords);
      lines = [...lines, ...enforcedMore.lines];
      tries++;
    }
    lines = lines.slice(0, 4);

    const minL = 70;
    const maxL = 120;

    const resp = {
      lines: lines.map((line, i) => ({
        line,
        length: line.length,
        index: i + 1,
        valid: line.length >= minL && line.length <= maxL
      })),
      model,
      count: lines.length,
      rules_used: { id: "fallback", version: 7 }
    };

    return new Response(JSON.stringify(resp), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});