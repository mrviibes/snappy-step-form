import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { text_rules } from "../_shared/text-rules.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============== TYPES ==============
interface Token {
  text: string;
  role: string;
}

// ============== CONSTANTS ==============
const META = /^(note:|important:|reminder:|system:|ai:|assistant:|user:|human:)/i;
const LENGTH_BUCKETS = [68, 85, 105, 118]; // tweakable targets

// ============== UTILITIES ==============
function stripLeadingNumber(line: string): string {
  return line.replace(/^\d+\.\s*/, '').trim();
}

function parseLines(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !META.test(line));
}

function dedupeFuzzy(lines: string[], threshold: number): string[] {
  const unique: string[] = [];
  
  for (const line of lines) {
    let isDuplicate = false;
    for (const existing of unique) {
      const similarity = calculateSimilarity(line, existing);
      if (similarity > threshold) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      unique.push(line);
    }
  }
  
  return unique;
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}

async function callOpenAI(systemPrompt: string, userPrompt: string) {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OpenAI API key not found');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return { content: data.choices[0]?.message?.content || '' };
}

// ====== Length variety helpers ======
function softTrimAtWordBoundary(s: string, target: number) {
  if (s.length <= target) return s;
  let cut = s.slice(0, target);
  cut = cut.replace(/\s+\S*$/,"").trim();
  if (!/[.?!]$/.test(cut)) cut += ".";
  return cut;
}

function smartExpand(
  s: string,
  tokens: {text:string; role:string}[],
  tone: string
) {
  const endPunct = /[.?!]$/;
  const base = s.replace(endPunct, "");
  const t = tokens[0]?.text ?? "";

  const tailsPool: string[] = [
    `with ${t ? t + " present" : "suspicious confidence"}`,
    "like silence had it coming",
    "in a room already low on patience",
    "which somehow wasn't even the finale",
    "just when quiet thought it was safe",
    "with timing only a calendar could love"
  ];
  if (/savage/i.test(tone)) {
    tailsPool.push(
      "like a public service announcement for groans",
      "with the efficiency of a friendly menace"
    );
  } else if (/playful/i.test(tone)) {
    tailsPool.push(
      "like confetti nobody ordered",
      "with a grin that sponsors itself"
    );
  }
  const tail = " " + tailsPool[Math.floor(Math.random()*tailsPool.length)];
  const out = base + ", " + tail.trim();
  return endPunct.test(s) ? out + s.slice(s.length-1) : out + ".";
}

function normalizeToBucket(
  s: string,
  target: number,
  tokens: {text:string; role:string}[],
  tone: string,
  rules: any
) {
  let out = s;
  if (out.length < Math.max(60, target - 8)) {
    out = smartExpand(out, tokens, tone);
  }
  if (out.length > target + 6) {
    out = softTrimAtWordBoundary(out, Math.min(target, (rules.length?.max_chars ?? 120)));
  }
  return out;
}

// ============== ENFORCEMENT (main pipeline) ==============
function enforceRules(
  lines: string[],
  rules: any,
  rating: string,
  insertTokens: Token[] = [],
  tone: string = ""
) {
  const enforcement: string[] = [];
  const minLen = rules.length?.min_chars ?? 60;
  const maxLen = rules.length?.max_chars ?? 120;

  let processed = lines
    .map((raw) => stripLeadingNumber(raw.trim()))
    .filter((l) => l && !META.test(l))
    .map((t) => t.replace(/["`]+/g, "").replace(/\s+/g, " ").trim());

  // Insert tokens into each line
  processed = processed.map(line => {
    let result = line;
    for (const token of insertTokens) {
      if (!result.toLowerCase().includes(token.text.toLowerCase())) {
        result = `${result} ${token.text}`.trim();
      }
    }
    return result;
  });

  // Length variety normalization (apply AFTER rating-specific edits, BEFORE dedupe)
  const idxs = [0,1,2,3].sort(()=>Math.random()-0.5);
  processed = processed.map((ln, i) => {
    const bucket = LENGTH_BUCKETS[idxs[i % LENGTH_BUCKETS.length]];
    return normalizeToBucket(ln, bucket, insertTokens, tone, rules);
  });

  // Dedupe & return
  let unique = dedupeFuzzy(processed, 0.6);
  if (unique.length < 4) unique = dedupeFuzzy(processed, 0.8);
  if (unique.length === 0) unique = processed.slice(0, 4);
  return { lines: unique, enforcement };
}

// ============== BACKFILL ==============
async function backfillLines(
  missing: number,
  systemPrompt: string,
  accepted: string[],
  tone: string,
  rating: string,
  tokens: Token[],
  category?: string,
  subcategory?: string
) {
  const block = accepted.map((l,i)=>`${i+1}. ${l}`).join("\n");
  const jokeMode = typeof category === "string" && /^jokes/i.test(category);
  const styleHint = jokeMode && subcategory ? ` in the style '${subcategory}'` : "";
  const tokenHint = tokens.length ? "\nTOKENS: " + tokens.map(t => `${t.role}=${t.text}`).join(" | ") : "";
  const user = `We still need ${missing} additional ${jokeMode ? "jokes" : "one-liners"}${styleHint} that satisfy ALL constraints.${tokenHint}
Do not repeat word pairs used in:
${block}
Tone=${tone}; Rating=${rating}.
Aim for varied lengths within 60–120 characters (e.g., some near 65, 85, 105, 120).
Return exactly ${missing} new lines, one per line.`;

  const { content } = await callOpenAI(systemPrompt, user);
  return parseLines(content);
}

// ============== HTTP ==============
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      category, 
      subcategory, 
      tone = "humorous", 
      rating = "PG-13", 
      tokens = [], 
      customText 
    } = await req.json();

    console.log('Generate text request:', { category, subcategory, tone, rating, tokens, customText });

    // Basic validation
    const rules = {
      length: { min_chars: 60, max_chars: 120 },
      format: { max_punctuation: 3 }
    };

    // Generate initial candidates using AI
    const systemPrompt = text_rules;
    const tokenHint = tokens.length ? "\nTOKENS: " + tokens.map((t: Token) => `${t.role}=${t.text}`).join(" | ") : "";
    const jokeMode = typeof category === "string" && /^jokes/i.test(category);
    const styleHint = jokeMode && subcategory ? ` in the style '${subcategory}'` : "";
    
    const userPrompt = `Generate 4 ${jokeMode ? 'jokes' : 'one-liners'}${styleHint}.${tokenHint}
Tone=${tone}; Rating=${rating}.
Category: ${category || 'general'}
${customText ? `Custom context: ${customText}` : ''}`;

    const { content } = await callOpenAI(systemPrompt, userPrompt);
    const candidates = parseLines(content);

    console.log('Raw candidates:', candidates);

    // Enforce rules (pass tone into enforceRules)
    let { lines, enforcement } = enforceRules(
      candidates,
      rules,
      rating || "PG-13",
      tokens,
      tone || ""
    );

    console.log('Enforced lines:', lines);

    // Backfill if needed
    const targetCount = 4;
    if (lines.length < targetCount) {
      const missing = targetCount - lines.length;
      console.log(`Backfilling ${missing} lines`);
      
      const moreCandidates = await backfillLines(
        missing,
        systemPrompt,
        lines,
        tone,
        rating || "PG-13",
        tokens,
        category,
        subcategory
      );

      const enforcedMore = enforceRules(moreCandidates, rules, rating || "PG-13", tokens, tone || "");
      lines = [...lines, ...enforcedMore.lines].slice(0, targetCount);
    }

    // Ensure we have exactly 4 lines
    while (lines.length < 4) {
      lines.push(`${customText || category || 'celebration'} brings joy and laughter.`);
    }
    lines = lines.slice(0, 4);

    return new Response(
      JSON.stringify({
        success: true,
        lines,
        enforcement,
        metadata: {
          category,
          subcategory,
          tone,
          rating,
          tokens: tokens.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Generate text error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        lines: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});