import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// Centralized OpenAI Model Configuration
const OPENAI_MODELS = {
  text: 'gpt-5',
  visuals: 'gpt-4o-mini',
  images: 'gpt-image-1'
} as const;

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

  // GPT-5 uses max_completion_tokens, older models use max_tokens
  if (model === 'gpt-5') {
    body.max_completion_tokens = options.maxTokens;
    // GPT-5 doesn't support temperature parameter
  } else {
    body.max_tokens = options.maxTokens;
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
  }

  return body;
}

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Master Rules Configuration
const MASTER_CONFIG = {
  // Global Rules
  length_min: 50,
  length_max: 120,
  max_punctuation_per_line: 2,
  forbidden_punctuation: /[;…]|(?:^|[^.])\.\.(?:[^.]|$)|[–—]/
};

// Rating language gates
const SWEARS_MILD = /\b(hell|damn|crap)\b/i;
const SWEARS_STRONG = /\b(fuck(?:ing)?|shit|asshole|bastard|douche)\b/i;
const SLURS = /\b(?:placeholder_slur)\b/i; // Server-side only


// Normalize category/subcategory keys like "celebrations > wedding" -> "wedding"
function normKey(input?: string): string {
  if (!input) return '';
  const last = String(input).split('>').pop()!.trim().toLowerCase();
  // Simple aliasing map if needed in future
  const aliases: Record<string, string> = {
    'weddings': 'wedding',
  };
  return aliases[last] || last;
}

// Robust text cleanup function to handle common model formatting quirks
function robustCleanup(rawText: string): string {
  let cleaned = rawText.trim();
  
  // Remove common prefixes: numbers, bullets, quotes
  cleaned = cleaned.replace(/^\s*[\d+\-\*•]\s*[\.\)\-]?\s*/, ''); // "1. ", "- ", "* ", etc.
  cleaned = cleaned.replace(/^["'"'`]/, ''); // Opening quotes
  cleaned = cleaned.replace(/["'"'`]$/, ''); // Closing quotes
  
  // Remove markdown formatting
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // **bold**
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1'); // *italic*
  cleaned = cleaned.replace(/__(.*?)__/g, '$1'); // __underline__
  cleaned = cleaned.replace(/`(.*?)`/g, '$1'); // `code`
  
  // Remove common prefixes that models add
  cleaned = cleaned.replace(/^(Here's|Here is|Line \d+:|Joke \d+:)\s*/i, '');
  cleaned = cleaned.replace(/^(Wedding joke|Birthday joke|Celebration joke):\s*/i, '');
  
  // Clean up extra punctuation at start/end
  cleaned = cleaned.replace(/^[,;:\-\s]+/, '');
  cleaned = cleaned.replace(/[,;:\-\s]+$/, '');
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Enhanced line parsing with robust cleanup - now handles all common formatting issues
function parseAndCleanLines(rawResponse: string): string[] {
  // Step 1: Multiple splitting strategies
  let lines = rawResponse.split(/\r?\n/);
  
  // If we didn't get enough lines, try other splitting patterns
  if (lines.length < 4) {
    // Try splitting by numbered patterns like "1.", "2.", etc.
    const numberedSplit = rawResponse.split(/(?=\d+[\.\)])/);
    if (numberedSplit.length >= 4) {
      lines = numberedSplit;
    }
    
    // Try splitting by bullet points or dashes
    if (lines.length < 4) {
      const bulletSplit = rawResponse.split(/(?=[-•*]\s)/);
      if (bulletSplit.length >= 4) {
        lines = bulletSplit;
      }
    }
  }
  
  // Step 2: Enhanced cleanup for each line
  const cleanedLines = lines
    .map(line => {
      let cleaned = line.trim();
      if (!cleaned) return '';
      
      // Remove list markers (numbers, bullets, dashes)
      cleaned = cleaned.replace(/^\s*[-*•]\s*/, '');
      cleaned = cleaned.replace(/^\s*\d+[.)\]:]\s*/, '');
      
      // Remove surrounding quotes
      cleaned = cleaned.replace(/^["""'''`](.+)["""'''`]$/, '$1');
      
      // Remove markdown formatting
      cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // bold
      cleaned = cleaned.replace(/\*(.*?)\*/g, '$1'); // italic
      cleaned = cleaned.replace(/`(.*?)`/g, '$1'); // code
      
      // Apply robust cleanup
      return robustCleanup(cleaned);
    })
    .filter(line => line.length > 0)
    .filter(line => line.length >= 20); // Must be substantial content
  
  return cleanedLines;
}

function debugValidateLine(line: string, scenario: any): { ok: boolean; reason?: string; details?: any } {
  const text = line.trim();
  
  // Detailed validation with specific failure reasons
  const validation = {
    length: text.length >= 50 && text.length <= 120,
    lengthActual: text.length,
    punctuation: (text.match(/[.!?,:"]/g) || []).length <= 2,
    punctuationCount: (text.match(/[.!?,:"]/g) || []).length,
    forbiddenPunct: !(/[;…]|(?:^|[^.])\.\.(?:[^.]|$)|[–—]/.test(text)),
    forbiddenFound: text.match(/[;…–—]/) || text.match(/(?:^|[^.])\.\.(?:[^.]|$)/),
    placeholder: !/\b(NAME|USER|PLACEHOLDER|friend)\b/i.test(text),
    placeholderFound: text.match(/\b(NAME|USER|PLACEHOLDER|friend)\b/i),
    categoryAnchor: false,
    sentences: text.split(/[.!?]+/).filter(s => s.trim()).length === 1
  };
  
  // Simplified category check - we can skip lexicon validation since it's removed
  validation.categoryAnchor = true;
  
  // Return first failure found
  if (!validation.length) {
    return { 
      ok: false, 
      reason: "length_out_of_bounds", 
      details: { actual: validation.lengthActual, expected: "50-120", text: text.substring(0, 50) + "..." }
    };
  }
  
  if (!validation.punctuation) {
    return { 
      ok: false, 
      reason: "punct_invalid", 
      details: { actual: validation.punctuationCount, expected: "≤2", text: text.substring(0, 50) + "..." }
    };
  }
  
  if (!validation.forbiddenPunct) {
    return { 
      ok: false, 
      reason: "forbidden_punctuation", 
      details: { found: validation.forbiddenFound?.[0], text: text.substring(0, 50) + "..." }
    };
  }
  
  if (!validation.placeholder) {
    return { 
      ok: false, 
      reason: "placeholder_leak", 
      details: { found: validation.placeholderFound?.[0], text: text.substring(0, 50) + "..." }
    };
  }
  
  if (!validation.categoryAnchor) {
    return { 
      ok: false, 
      reason: "category_anchor_missing", 
      details: { text: text.substring(0, 50) + "..." }
    };
  }
  
  if (!validation.sentences) {
    return { 
      ok: false, 
      reason: "multiple_sentences", 
      details: { text: text.substring(0, 50) + "..." }
    };
  }
  
  // OPTIONAL: Check insert words only if they exist
  if (Array.isArray(scenario.insertWords) && scenario.insertWords.length > 0) {
    for (const tag of scenario.insertWords) {
      // Case-insensitive insert checking with flexible pattern matching
      const hasInsertOnce = (text: string, insert: string): boolean => {
        const esc = (s:string) => s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        const pattern = insert.trim().split(/\s+/).map(esc).join("[\\s\\p{P}]*");
        const one = new RegExp(`(^|\\W)${pattern}(?=\\W|$)`,"iu");
        const all = new RegExp(`(^|\\W)${pattern}(?=\\W|$)`,"igu");
        const hits = (text.match(all) || []).length;
        return one.test(text) && hits === 1;
      };
      
      if (!hasInsertOnce(text, tag)) {
        return { 
          ok: false, 
          reason: `insert_not_once:${tag}`, 
          details: { tag, text: text.substring(0, 50) + "..." }
        };
      }
    }
  }
  
  return { ok: true };
}

function validateBatch(lines: string[], scenario: any): { ok: boolean; details?: any } {
  if (!Array.isArray(lines) || lines.length !== 4) {
    return { ok: false, details: "batch_must_have_4_lines" };
  }
  
  const failures = [];
  const lengths = [];
  let directAnchors = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const validation = debugValidateLine(line, scenario);
    
    if (!validation.ok) {
      failures.push({ index: i, reason: validation.reason });
    }
    
    lengths.push(line.length);
  }
  
  if (failures.length) {
    return { ok: false, details: { failures } };
  }
  
  // Rhythm variety check
  const hasShort = lengths.some(len => len < 70);
  const hasLong = lengths.some(len => len >= 100);
  if (!hasShort || !hasLong) {
    return { ok: false, details: "rhythm_variety_missing" };
  }
  
  // Structural variety check for R-rated content
  if (scenario.rating === 'R') {
    const profanityCount = lines.filter(line => SWEARS_STRONG.test(line)).length;
    if (profanityCount < 2) {
      return { ok: false, details: "r_rating_insufficient_profanity" };
    }
  }

  // Structure variety check - prevent repetitive patterns  
  const structures = lines.map(line => {
    if (line.includes(' but ')) return 'contrast';
    if (line.includes('?')) return 'question';
    if (line.match(/\b(like|than)\b/)) return 'comparison';
    if (line.match(/\b(when|while|after|before)\b/)) return 'temporal';
    return 'statement';
  });

  const uniqueStructures = [...new Set(structures)];
  if (uniqueStructures.length < 3) {
    return { ok: false, details: "structure_variety_missing" };
  }
  
  // Batch anchoring check
  if (directAnchors < 2) {
    return { ok: false, details: "insufficient_direct_anchors" };
  }
  
  return { ok: true };
}

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Helper: classify insert word position
function getInsertPos(line: string, insertWord: string): string {
  const words = line.toLowerCase().split(/\W+/);
  const idx = words.indexOf(insertWord.toLowerCase());
  if (idx === -1) return "none";
  const ratio = (idx + 1) / words.length;
  if (ratio <= 0.33) return "front";
  if (ratio >= 0.67) return "end";
  return "middle";
}

// Helper: classify joke structure
function classifyStructure(line: string): string {
  if (line.trim().endsWith("?")) return "question";
  if (line.toLowerCase().startsWith("knock knock")) return "knock";
  if (line.toLowerCase().includes("like a") || line.toLowerCase().includes("as if"))
    return "metaphor";
  if (line.length < 75) return "quip";
  return "narrative";
}

// Helper: detect dominant topic words
function extractTopicWord(line: string, insertWords: string[]): string | null {
  const tokens = line.toLowerCase().split(/\W+/).filter(t => t.length > 3);
  const skip = new Set((insertWords || []).map(w => w.toLowerCase()));
  // Skip common words and return first substantial topic word
  const commonWords = new Set(['that', 'with', 'they', 'were', 'been', 'have', 'this', 'will', 'your', 'from', 'just', 'like', 'more', 'some', 'time', 'very', 'when', 'come', 'here', 'how', 'also', 'its', 'our', 'out', 'many', 'then', 'them', 'these', 'now', 'look', 'only', 'come', 'think', 'also', 'back', 'after', 'use', 'her', 'can', 'out', 'than', 'way', 'she', 'may', 'what', 'say', 'each', 'which', 'their', 'said', 'make', 'can', 'over', 'think', 'where', 'much', 'take', 'how', 'little', 'good', 'want', 'too', 'old', 'any', 'my', 'other', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
  
  return tokens.find(t => !skip.has(t) && !commonWords.has(t)) || null;
}

function generateHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  });
}

async function checkUniqueness(candidates: string[], userId?: string): Promise<string[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const hashes = await Promise.all(candidates.map(generateHash));
  
  // Check against existing hashes
  const { data: existing } = await supabase
    .from('gen_history')
    .select('text_hash')
    .in('text_hash', hashes);
    
  const existingHashes = new Set(existing?.map(row => row.text_hash) || []);
  
  return candidates.filter((_, index) => !existingHashes.has(hashes[index]));
}

function ensurePlacementSpread(lines: string[], insertWords: string[]): string[] {
  if (!insertWords || insertWords.length === 0) return lines;
  
  const firstWord = insertWords[0].toLowerCase();
  const positions: { front: string[]; middle: string[]; end: string[] } = { front: [], middle: [], end: [] };
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const wordIndex = lowerLine.indexOf(firstWord);
    
    if (wordIndex === -1) continue;
    
    const position = wordIndex < line.length * 0.3 ? 'front' :
                    wordIndex > line.length * 0.7 ? 'end' : 'middle';
    
    positions[position].push(line);
  }
  
  // Try to get one from each position
  const result: string[] = [];
  (['front', 'middle', 'end'] as const).forEach(pos => {
    if (positions[pos].length > 0) {
      result.push(positions[pos][0]);
    }
  });
  
  // Fill remaining slots
  const remaining = lines.filter(line => !result.includes(line));
  while (result.length < 4 && remaining.length > 0) {
    const next = remaining.shift();
    if (next) result.push(next);
  }
  
  return result.slice(0, 4);
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  console.log(`🤖 Making OpenAI API call with model: ${OPENAI_MODELS.text}`);
  
  const requestBody = buildOpenAIRequest(
    OPENAI_MODELS.text,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { maxTokens: 150 }
  );
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  console.log('📡 OpenAI Response Status:', response.status);
  
  const data = await response.json();
  console.log('📄 OpenAI Response Data:', JSON.stringify(data, null, 2));
  
  // Handle content moderation errors
  if (data.error) {
    console.error('❌ OpenAI API Error:', data.error);
    if (data.error.code === 'content_policy_violation' || data.error.message?.includes('content policy')) {
      throw new Error('CONTENT_MODERATION_BLOCKED');
    }
    throw new Error(`OpenAI API Error: ${data.error.message}`);
  }
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('❌ Invalid OpenAI response structure:', data);
    throw new Error('Invalid response from OpenAI API');
  }
  
  return data.choices[0].message.content;
}

async function saveToHistory(lines: string[], payload: any) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const records = await Promise.all(lines.map(async (line) => ({
    user_id: payload.userId || null,
    category: payload.category,
    tone: payload.tone,
    style: payload.style,
    rating: payload.rating,
    insert_words: payload.insertWords || [],
    text_out: line,
    text_hash: await generateHash(line)
  })));
  
  await supabase.from('gen_history').insert(records);
}

// Generate exactly 4 valid lines with slot-retry mechanism
async function generateValidBatch(systemPrompt: string, payload: any, subcategory: string, nonce: string, maxRetries = 3): Promise<Array<{line: string, comedian: string}>> {
  const timeoutMs = 25000; // 25 second hard timeout
  const startTime = Date.now();
  const totalNeeded = 4;
  let validLines: Array<{line: string, comedian: string}> = [];
  
  // Use generic AI assistant label for all generated lines
  
  // Retry ladder with progressive relaxation
  const retryConfigs = [
    { lengthMin: 50, lengthMax: 120, maxPunct: 2 }, // Strict
    { lengthMin: 45, lengthMax: 125, maxPunct: 2 }, // Slightly relaxed
    { lengthMin: 40, lengthMax: 130, maxPunct: 3 }  // More relaxed
  ];
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('generation_timeout_exceeded');
    }
    
    const slotsNeeded = totalNeeded - validLines.length;
    if (slotsNeeded === 0) {
      console.log(`🎉 All 4 slots filled! Returning complete set.`);
      return validLines;
    }
    
    console.log(`🎯 Attempt ${attempt + 1}: Need ${slotsNeeded} more slots for ${subcategory}`);
    const config = retryConfigs[attempt] || retryConfigs[retryConfigs.length - 1];
    
    try {
      const userPrompt = `Generate ${slotsNeeded * 2} humorous one-liners for ${payload.category || 'celebration'}.
      
Constraints:
- Each line: ${config.lengthMin}–${config.lengthMax} characters, exactly one sentence
- Max ${config.maxPunct} punctuation marks per line
- Include these words naturally: ${(payload.insertWords || []).join(', ')}
- Tone: ${payload.tone || 'humorous'}
- Rating: ${payload.rating || 'PG'}
- Style: ${payload.style || 'generic'}

Return only the lines, one per line, no formatting or numbering.`;

      const rawResponse = await callOpenAI(systemPrompt, userPrompt);
      const candidateLines = parseAndCleanLines(rawResponse);
      
      // Validate each candidate
      for (let i = 0; i < candidateLines.length && validLines.length < totalNeeded; i++) {
        const line = candidateLines[i];
        const validation = debugValidateLine(line, {
          category: payload.category,
          subcategory: payload.subcategory,
          insertWords: payload.insertWords || [],
          rating: payload.rating || 'PG'
        });
        
        if (validation.ok) {
          validLines.push({
            line: line,
            comedian: "AI Assist"
          });
        }
      }
      
    } catch (error) {
      console.error(`Generation attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }
  
  // If we still don't have enough, return what we have
  if (validLines.length === 0) {
    throw new Error('Failed to generate any valid lines');
  }
  
  return validLines;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Generation request:', payload);
    
    const nonce = generateNonce();
    const subcategory = payload.subcategory || payload.category || 'celebration';
    
    const systemPrompt = `You write stand-up style one-liners.

Constraints:
- Exactly ONE sentence, 50–120 characters.
- Include Insert Words naturally if provided; vary their placement (front, middle, end).
- Do not always start lines with Insert Words - mix up the positioning.
- No em dash (—). Use commas, periods, ellipses, or short sentences.
- Keep punctuation light; avoid stuffing marks.
- Stay relevant to the category context while avoiding overused cliché phrases.
- Use creative twists on category-relevant topics rather than completely unrelated subjects.
- Do not invent personal details like age, job, or milestones unless provided in Insert Words.
- Vary rhythm and structure; do not repeat the same shape in one set.
- Each line should focus on different topics/objects to avoid repetition.
- Output only the sentence. No explanations.
Nonce: ${nonce}`;

    // Generate valid batch
    const validOptions = await generateValidBatch(systemPrompt, payload, subcategory, nonce);
    
    // Check uniqueness
    const lines = validOptions.map(opt => opt.line);
    const uniqueLines = await checkUniqueness(lines, payload.userId);
    
    // Filter options to only unique ones
    const uniqueOptions = validOptions.filter(opt => uniqueLines.includes(opt.line));
    
    // Ensure placement spread for insert words
    let finalOptions = uniqueOptions;
    if (payload.insertWords && payload.insertWords.length > 0) {
      const spreadLines = ensurePlacementSpread(uniqueLines, payload.insertWords);
      finalOptions = validOptions.filter(opt => spreadLines.includes(opt.line));
    }
    
    // Take up to 4 options
    const resultOptions = finalOptions.slice(0, 4);
    
    // Save to history
    if (resultOptions.length > 0) {
      await saveToHistory(resultOptions.map(opt => opt.line), payload);
    }
    
    console.log(`Generated ${resultOptions.length} valid options for ${subcategory}`);
    
    return new Response(JSON.stringify(resultOptions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in generate-text function:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error)?.message || 'Internal server error',
      details: (error as Error)?.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});