// supabase/functions/generate-text/index.ts
// Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODELS = {
  primary: Deno.env.get("VIBE_PRIMARY_MODEL") || "gpt-5",
  backup: Deno.env.get("VIBE_BACKUP_MODEL") || "gpt-5-mini",
};
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  try {
    console.log("Request received:", req.method);
    
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ error: "POST only" }, 405);
    }

    let body: any = {};
    try {
      body = await req.json();
      console.log("Request body:", body);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const n = clamp(body.num_variations ?? 4, 1, 8);
    console.log("Generating", n, "lines");

    const result = await generateNLines(body, n);
    console.log("Generated result:", { model: result.modelUsed, count: result.lines.length });
    
    return json({ model: result.modelUsed, options: result.lines });
  } catch (e) {
    console.error("Top-level error:", e);
    return json({ error: String(e?.message || e || "generation_failed") }, 500);
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders,
  });
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

function parseMandatoryWords(input: string) {
  if (!input?.trim()) return { simple: [], structured: null };
  
  const trimmed = input.trim();
  
  // Check if it looks like structured mini-JSON (contains brackets or braces)
  if (/[\[\]{}:]/.test(trimmed)) {
    try {
      // Try to parse as mini-JSON structure
      const structured = parseStructuredInput(trimmed);
      return { simple: [], structured };
    } catch (e) {
      console.log("Failed to parse as structured, falling back to simple:", e);
      // Fall back to simple parsing
      return { simple: trimmed.split(',').map(w => w.trim()).filter(Boolean), structured: null };
    }
  }
  
  // Simple comma-separated words
  return { simple: trimmed.split(',').map(w => w.trim()).filter(Boolean), structured: null };
}

function parseStructuredInput(input: string) {
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  const result: any = {};
  
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, valueStr] = line.split(':', 2).map(s => s.trim());
      
      // Handle arrays like [item1, item2, item3]
      if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
        const items = valueStr.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
        result[key] = items;
      }
      // Handle objects like { word: [syn1, syn2] }
      else if (valueStr.startsWith('{') && valueStr.endsWith('}')) {
        // Simple parsing for synonym format
        const match = valueStr.match(/{\s*(\w+):\s*\[([^\]]+)\]\s*}/);
        if (match) {
          result[key] = { [match[1]]: match[2].split(',').map(s => s.trim()) };
        }
      }
      // Handle quoted strings
      else if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || 
               (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
        result[key] = valueStr.slice(1, -1);
      }
      // Handle plain values
      else {
        result[key] = valueStr;
      }
    }
  }
  
  return result;
}

function buildEnhancedPrompt(p: any, n: number) {
  const parsed = parseMandatoryWords(p.mandatory_words || '');
  let constraints = '';
  
  if (parsed.structured) {
    const s = parsed.structured;
    constraints = `
Enhanced constraints:
${s.name ? `- MUST include name: ${s.name}` : ''}
${s.names ? `- MUST include names: ${s.names.join(', ')}` : ''}
${s.team ? `- MUST include team: ${s.team}` : ''}
${s.all ? `- MUST include ALL: ${s.all.join(', ')}` : ''}
${s.any ? `- MUST use at least ONE from: ${s.any.join(', ')}` : ''}
${s.ban ? `- NEVER use these words: ${s.ban.join(', ')}` : ''}
${s.context ? `- Setting context: ${s.context}` : ''}
${s.inside ? `- Include inside reference: ${s.inside}` : ''}
${s.emphasize ? `- Emphasize this once: ${s.emphasize}` : ''}
${s.syn ? `- Use synonyms for: ${Object.keys(s.syn).map(k => `${k} (options: ${s.syn[k].join(', ')})`).join('; ')}` : ''}`;
  } else if (parsed.simple.length > 0) {
    constraints = `- MUST include these words naturally: ${parsed.simple.join(', ')}`;
  }

  return `
Write ${n} distinct one-liners for a celebration text generator.

Rules:
- Each line 40 to 140 characters inclusive.
- Exactly one sentence per line.
- No em dash.
- Category: ${p.category || "General"}${p.subcategory ? `, Subcategory: ${p.subcategory}` : ""}.
- Tone: ${p.tone}. Style: ${p.style}. Rating: ${p.rating}.
${p.comedian_style ? `- In the spirit of ${p.comedian_style} without naming them.` : ''}
${constraints}

Output format:
Return exactly ${n} items separated by the delimiter "|||".
No numbering, no bullets, no extra commentary, no blank lines.
`;
}

function singleLinePromptEnhanced(p: any) {
  const parsed = parseMandatoryWords(p.mandatory_words || '');
  
  // Build explicit insert words constraints
  let insertConstraints = '';
  if (parsed.structured) {
    const s = parsed.structured;
    const mustInclude = [
      ...(s.name ? [s.name] : []),
      ...(s.names || []),
      ...(s.team ? [s.team] : []),
      ...(s.all || [])
    ];
    
    if (mustInclude.length > 0) {
      insertConstraints = `CRITICAL: You MUST include these exact words naturally in the sentence: ${mustInclude.join(', ')}`;
    }
    if (s.any && s.any.length > 0) {
      insertConstraints += `\nMUST use at least ONE of these: ${s.any.join(', ')}`;
    }
    if (s.ban && s.ban.length > 0) {
      insertConstraints += `\nNEVER use these words: ${s.ban.join(', ')}`;
    }
    if (s.context) {
      insertConstraints += `\nSetting/context: ${s.context}`;
    }
  } else if (parsed.simple.length > 0) {
    insertConstraints = `CRITICAL: You MUST include these exact words naturally in the sentence: ${parsed.simple.join(', ')}`;
  }

  // Style examples based on style selection
  const styleExamples = {
    'sarcastic': '(dry wit, eye-rolling humor, backhanded compliments)',
    'weird': '(absurd, surreal, unexpected comparisons, odd phrasing)',
    'wholesome': '(heartwarming, family-friendly, positive)',
    'savage': '(brutally honest, cutting, no-holds-barred)',
    'generic': '(straightforward, standard celebration language)'
  };

  // Rating guidelines
  const ratingGuidelines = {
    'G': '(completely clean, family-friendly)',
    'PG': '(mild humor, very light innuendo allowed)', 
    'PG-13': '(moderate adult humor, light profanity, suggestive content allowed)',
    'R': '(explicit humor allowed, strong language, adult themes)'
  };

  const styleGuide = styleExamples[p.style?.toLowerCase()] || '';
  const ratingGuide = ratingGuidelines[p.rating] || '';

  return `Write ONE celebration one-liner. EXACTLY one sentence only.

CATEGORY: ${p.category || "General"}${p.subcategory ? ` > ${p.subcategory}` : ""}
TONE: ${p.tone} (be genuinely ${p.tone} in your response)
STYLE: ${p.style} ${styleGuide}
RATING: ${p.rating} ${ratingGuide}
${p.comedian_style ? `COMEDY STYLE: In the spirit of ${p.comedian_style} without naming them` : ''}

${insertConstraints}

TECHNICAL REQUIREMENTS:
- Length: 40-140 characters EXACTLY
- ONE sentence only, no line breaks
- No em dash (—)
- Must end with punctuation (. ! or ?)
- Output ONLY the sentence, no quotes, no extra text

EXAMPLES for context:
- Weird + R-rated: "Jesse, your cake is screaming and the candles are plotting revenge tonight."
- Sarcastic + PG-13: "Another year older, Jesse—at least the cake won't judge your life choices."
- Humorous + R: "Happy birthday Jesse, may your hangover outshine every damn candle."

Generate the sentence now:`;
}

function validateConstraints(text: string, mandatoryWords: string): boolean {
  if (!mandatoryWords?.trim()) return true;
  
  const parsed = parseMandatoryWords(mandatoryWords);
  const lowerText = text.toLowerCase();
  
  if (parsed.structured) {
    const s = parsed.structured;
    
    // Check BAN words first
    if (s.ban) {
      for (const banned of s.ban) {
        if (lowerText.includes(banned.toLowerCase())) {
          console.log(`Rejected: contains banned word "${banned}"`);
          return false;
        }
      }
    }
    
    // Check MUST include (names, all)
    const mustInclude = [
      ...(s.name ? [s.name] : []),
      ...(s.names || []),
      ...(s.team ? [s.team] : []),
      ...(s.all || [])
    ];
    
    for (const required of mustInclude) {
      if (!lowerText.includes(required.toLowerCase())) {
        console.log(`Rejected: missing required word/phrase "${required}"`);
        return false;
      }
    }
    
    // Check ANY-of groups
    if (s.any && s.any.length > 0) {
      const hasAny = s.any.some(word => lowerText.includes(word.toLowerCase()));
      if (!hasAny) {
        console.log(`Rejected: missing at least one from ANY group: ${s.any.join(', ')}`);
        return false;
      }
    }
    
    return true;
  } else {
    // Simple validation - all words must be present
    return parsed.simple.every(word => lowerText.includes(word.toLowerCase()));
  }
}

async function callOpenAI(model: string, input: string) {
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 15000); // 15s max

  try {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: 160,
      }),
      signal: ctl.signal
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`openai_${resp.status}_${txt.slice(0, 200)}`);
    }

    const data = await resp.json();
    const text = data?.output_text?.trim() || "";
    return text;
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      throw new Error("timeout_or_network_error");
    }
    throw e;
  }
}

async function generateNLines(p: any, n: number) {
  const lines: string[] = [];
  let modelUsed = MODELS.primary;
  let attempts = 0;
  const maxAttempts = 6; // Reasonable limit

  while (lines.length < n && attempts < maxAttempts) {
    const prompt = singleLinePromptEnhanced(p);
    try {
      const raw = await callOpenAI(modelUsed, prompt);
      console.log("RAW OUTPUT:", raw);
      
      const normalized = normalizeOne(raw);
      const enforced = enforce(normalized, p.rating);
      const passesConstraints = enforced && validateConstraints(enforced, p.mandatory_words);
      
      if (enforced && passesConstraints && !lines.includes(enforced)) {
        lines.push(enforced);
        console.log(`Generated line ${lines.length}:`, enforced);
      } else {
        console.log("Rejected line:", { 
          raw, 
          normalized, 
          enforced, 
          passesConstraints,
          reason: !enforced ? 'failed enforce' : !passesConstraints ? 'failed constraints' : 'duplicate'
        });
      }
    } catch (e) {
      console.error(`OpenAI call failed (attempt ${attempts + 1}):`, e);
      // If primary fails, switch to backup
      if (modelUsed === MODELS.primary) { 
        modelUsed = MODELS.backup; 
        console.log("Switching to backup model:", MODELS.backup);
      }
      // Add small delay before retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    attempts++;
  }

  // Add fallback lines if we didn't get enough
  const fallbacks = [
    "Celebrating life's special moments, one smile at a time!",
    "Today deserves extra joy and maybe a little cake too.",
    "Making memories that sparkle brighter than any candle.",
    "Here's to another year of awesome adventures ahead!"
  ];

  while (lines.length < n && fallbacks.length > 0) {
    const fallback = fallbacks.shift()!;
    if (!lines.includes(fallback)) {
      lines.push(fallback);
      console.log("Added fallback line:", fallback);
    }
  }

  console.log(`Final result: ${lines.length} lines generated`);
  return { modelUsed, lines };
}

function singleLinePrompt(p: any) {
  const must = (p.mandatory_words || []).slice(0, 6).join(", ");
  return `
Write ONE single-sentence one-liner (exactly one sentence) for a celebration text generator.

Rules:
- Length 40 to 140 characters inclusive.
- ONE sentence only. No lists, no paragraphs.
- No em dash.
- Include these words naturally if present: ${must || "none"}.
- Category: ${p.category || "General"}${p.subcategory ? `, Subcategory: ${p.subcategory}` : ""}.
- Tone: ${p.tone}. Style: ${p.style}. Rating: ${p.rating}.
${p.comedian_style ? `- In the spirit of ${p.comedian_style} without naming them.` : ""}

Output exactly the sentence only. No numbering. No quotes. No extra words.
`;
}

function normalizeOne(raw: string) {
  const first = raw.split(/\r?\n/).map(s => s.trim()).find(Boolean) || "";
  return first
    .replace(/^["'`]/, "")
    .replace(/["'`]$/, "")
    .replace(/^[•*-]\s*/, "")
    .replace(/^\d+[\.)]\s*/, "");
}

function enforce(s: string, rating: string = 'G') {
  const len = [...s].length;
  if (len < 40 || len > 140) return null;   // length check
  if (/\u2014/.test(s)) return null;        // ban em dash
  if (!/[.!?]$/.test(s)) s += ".";          // ensure punctuation
  
  // Rating-based content filtering - be more permissive for higher ratings
  if (rating === 'G') {
    // Very strict for G rating
    const strictProfanity = /\b(damn|hell|shit|fuck|ass|bitch|bastard|crap)\b/i;
    if (strictProfanity.test(s)) return null;
  } else if (rating === 'PG') {
    // Allow mild language for PG
    const strongProfanity = /\b(shit|fuck|bitch|bastard)\b/i;
    if (strongProfanity.test(s)) return null;
  } else if (rating === 'PG-13') {
    // Allow moderate language for PG-13
    const extremeProfanity = /\b(fuck)\b/i;
    if (extremeProfanity.test(s)) return null;
  }
  // R rating allows everything through
  
  return s;
}