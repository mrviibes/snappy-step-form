import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
  forbidden_punctuation: /[;…]|(?:^|[^.])\.\.(?:[^.]|$)|[–—]/,
  
  // Category Lexicons
  lexicons: {
    wedding: ["vows","rings","altar","reception","dance floor","bouquet","honeymoon","bride","groom","cake","toast","in-laws"],
    engagement: ["ring","proposal","fiancé","fiancée","yes","forever"],
    birthday: ["birthday","cake","candles","party","balloons","frosting","gift"],
    graduation: ["cap","gown","diploma","tassel","stage","ceremony"],
    work: ["meeting","boss","deadline","office","email","printer","coffee","slides","calendar"],
    school: ["exam","homework","teacher","class","test","grade","study"],
    soccer: ["goal","field","referee","fans","stadium","match","cup"],
    basketball: ["hoop","court","dribble","dunk","buzzer","playoffs"],
    baseball: ["bat","ball","base","inning","pitcher","glove","strike"],
    hockey: ["puck","ice","rink","goalie","stick","net","season"],
    music: ["song","lyrics","concert","stage","band","playlist"],
    movies: ["movie","film","screen","popcorn","theater","trailer"],
    tv: ["show","series","episode","streaming","channel","binge"]
  },
  
  // Rating Definitions
  ratings: {
    G: { forbidden_words: [], allow_innuendo: false, description: "wholesome/playful" },
    PG: { forbidden_words: [], allow_innuendo: false, description: "light sarcasm, safe ironic" },
    "PG-13": { forbidden_words: [], allow_innuendo: true, description: "edgy, ironic, sharp" },
    R: { forbidden_words: [], allow_innuendo: true, description: "savage, raw, unfiltered" }
  }
};

// Rating language gates
const SWEARS_MILD = /\b(hell|damn|crap)\b/i;
const SWEARS_STRONG = /\b(fuck(?:ing)?|shit|asshole|bastard|douche)\b/i;
const SLURS = /\b(?:placeholder_slur)\b/i; // Server-side only

// Comedian styles with enhanced flavors for master rules
const COMEDIAN_STYLES = [
  { name: "Seinfeld", flavor: "observational, everyday absurdity, what's the deal with..." },
  { name: "Carlin", flavor: "cynical wordplay, social commentary, seven words you can't say" },
  { name: "Wright", flavor: "deadpan surreal one-liners, I haven't slept for ten days" },
  { name: "Hedberg", flavor: "absurd stream of consciousness, I used to do drugs" },
  { name: "Rivers", flavor: "self-deprecating sharp wit, can we talk?" },
  { name: "Mulaney", flavor: "storytelling relatable chaos, new in town" },
  { name: "Chappelle", flavor: "provocative social satire, I'm rich!" },
  { name: "Hart", flavor: "animated physical comedy, you gonna learn today" }
];

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

function getLexiconFor(input?: string): string[] {
  const key = normKey(input);
  return MASTER_CONFIG.lexicons[key as keyof typeof MASTER_CONFIG.lexicons] || [];
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

// Enhanced line parsing with robust cleanup
function parseAndCleanLines(rawResponse: string): string[] {
  // First split by lines
  let lines = rawResponse.split(/\r?\n/);
  
  // If we didn't get enough lines, try splitting by other patterns
  if (lines.length < 4) {
    // Try splitting by numbered patterns like "1.", "2.", etc.
    const numberedSplit = rawResponse.split(/(?=\d+[\.\)])/);
    if (numberedSplit.length >= 4) {
      lines = numberedSplit;
    }
  }
  
  // Clean each line and filter out empty ones
  const cleanedLines = lines
    .map(line => robustCleanup(line))
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
  
  // Category anchoring check
  const key = normKey(scenario.subcategory || scenario.category);
  const lexicon = MASTER_CONFIG.lexicons[key as keyof typeof MASTER_CONFIG.lexicons] || [];
  validation.categoryAnchor = lexicon.some(w => 
    new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "i").test(text)
  );
  
  // If no direct anchor, check contextual cues
  if (!validation.categoryAnchor) {
    const contextCues: Record<string, RegExp> = {
      wedding: /\b(bride|groom|best man|maid of honor|altar|reception|first dance|in laws)\b/i,
      birthday: /\b(happy birthday|blow out|turning \d+|party hat|surprise party|age|years old)\b/i,
      graduation: /\b(graduat|commencement|walk the stage|diploma|degree)\b/i
    };
    validation.categoryAnchor = contextCues[key]?.test(text) || false;
  }
  
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
      details: { category: key, lexicon: lexicon.slice(0, 5), text: text.substring(0, 50) + "..." }
    };
  }
  
  if (!validation.sentences) {
    return { 
      ok: false, 
      reason: "multiple_sentences", 
      details: { text: text.substring(0, 50) + "..." }
    };
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
    const validation = validateMasterRules(line, scenario);
    
    if (!validation.ok) {
      failures.push({ index: i, reason: validation.reason });
    }
    
    lengths.push(line.length);
    
    // Count direct lexicon hits
  const key = normKey(scenario.subcategory || scenario.category);
  const lexicon = MASTER_CONFIG.lexicons[key as keyof typeof MASTER_CONFIG.lexicons] || [];
  if (lexicon.some(w => new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "i").test(line))) {
    directAnchors++;
  }
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
  
  // Batch anchoring check
  if (directAnchors < 2) {
    return { ok: false, details: "insufficient_direct_anchors" };
  }
  
  return { ok: true };
}

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15);
}

function pickComedians(count: number): any[] {
  const shuffled = [...COMEDIAN_STYLES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const temperature = 0.9 + Math.random() * 0.15; // 0.9 to 1.05
  const topP = 0.85 + Math.random() * 0.1; // 0.85 to 0.95
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      top_p: topP,
      max_tokens: 150
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// Generate exactly 4 valid lines with detailed debugging
async function generateValidBatch(systemPrompt: string, payload: any, subcategory: string, nonce: string, maxRetries = 3): Promise<Array<{line: string, comedian: string}>> {
  const timeoutMs = 25000; // 25 second hard timeout
  const startTime = Date.now();
  
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
    
    console.log(`🎯 Generation attempt ${attempt + 1}: Requesting exactly 4 lines for ${subcategory}`);
    const config = retryConfigs[attempt] || retryConfigs[retryConfigs.length - 1];
    
    // Enhanced prompt with clearer formatting requirements
    let instructions = `Write exactly 4 one-sentence ${subcategory} jokes. Each line must be between ${config.lengthMin}-${config.lengthMax} characters. Use at most ${config.maxPunct} punctuation marks per line. No semicolons, em dashes, or ellipses allowed.`;
    
    // Add specific context requirements
    const contextWords = getLexiconFor(subcategory);
    if (contextWords.length > 0) {
      instructions += ` Each joke must include ${subcategory} context using words like: ${contextWords.slice(0, 6).join(', ')}.`;
    }
    
    if (payload.insertWords?.length > 0) {
      const insertTag = payload.insertWords[0];
      instructions += ` Include the name "${insertTag}" exactly once per line, naturally integrated.`;
    }
    
    instructions += ` Tone: ${payload.tone}. Rating: ${payload.rating}.
    
CRITICAL FORMATTING RULES:
- Return exactly 4 lines
- One joke per line
- No numbers, bullets, or markdown
- No quotes around jokes
- No extra text or explanations
- Just the jokes, separated by line breaks`;
    
    const userPrompt = `${instructions}

Examples of valid ${subcategory} jokes:
${subcategory === 'birthday' ? 
  `The cake had so many candles the smoke alarm joined the party.
Nothing says birthday like frosting on your face before noon.
Balloons popped faster than my birthday wish left my lips.
The party peaked when grandma stole the first slice of cake.` :
  `Use specific ${subcategory} words and situations
Keep jokes short, punchy, and contextually relevant`}

Generate exactly 4 lines:`;

    try {
      const rawResponse = await callOpenAI(systemPrompt, userPrompt);
      
      // Use robust parsing and cleanup
      const cleanedLines = parseAndCleanLines(rawResponse);
      
      console.log(`📝 Raw response gave ${cleanedLines.length} clean lines after parsing`);
      console.log(`🧹 Sample cleaned lines:`, cleanedLines.slice(0, 2).map(l => `"${l.substring(0, 60)}..."`));
      
      if (cleanedLines.length < 4) {
        console.log(`❌ Only got ${cleanedLines.length} clean lines, need 4. Retrying...`);
        continue;
      }
      
      // Take first 4 lines and validate each
      const lines = cleanedLines.slice(0, 4);
      const candidates = [];
      const detailedFailures = [];
      const comedians = pickComedians(4);
      
      for (let i = 0; i < 4; i++) {
        const line = lines[i];
        const comedian = comedians[i];
        
        const validation = debugValidateLine(line, payload);
        
        if (validation.ok) {
          candidates.push({
            line: line,
            comedian: comedian.name
          });
          console.log(`✅ Line ${i+1} PASSED: "${line.substring(0, 60)}..."`);
        } else {
          detailedFailures.push({
            index: i,
            line: line.substring(0, 80) + '...',
            reason: validation.reason,
            details: validation.details,
            fullLine: line
          });
          console.log(`❌ Line ${i+1} FAILED (${validation.reason}): "${line.substring(0, 60)}..."`);
          if (validation.details) {
            console.log(`   Details:`, validation.details);
          }
        }
      }
      
      console.log(`📊 Attempt ${attempt + 1}: Got ${candidates.length} valid out of 4 lines`);
      
      // If we have exactly 4 valid lines, check batch validation
      if (candidates.length === 4) {
        const batchValidation = validateBatch(candidates.map(c => c.line), payload);
        
        if (batchValidation.ok) {
          console.log(`🎉 Batch validation PASSED! Returning 4 valid lines.`);
          return candidates;
        } else {
          console.log(`❌ Batch validation failed:`, batchValidation.details);
          detailedFailures.push({
            index: -1,
            reason: 'batch_validation_failed',
            details: batchValidation.details
          });
        }
      }
      
      // If this is our last attempt, provide detailed error information
      if (attempt === maxRetries - 1) {
        const errorDetails = {
          validLines: candidates.length,
          totalRequested: 4,
          detailedFailures,
          lastAttemptConfig: config,
          allLines: lines.map((line, i) => ({
            index: i,
            line: line.substring(0, 100) + (line.length > 100 ? '...' : ''),
            length: line.length
          }))
        };
        console.log(`💥 Final attempt failed. Full debug info:`, JSON.stringify(errorDetails, null, 2));
        throw new Error(`insufficient_valid_lines:${JSON.stringify(errorDetails)}`);
      }
      
    } catch (error) {
      console.error(`💥 Generation attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
    
    // Wait before retry with jitter
    if (attempt < maxRetries - 1) {
      const delay = 300 + Math.random() * 500;
      console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw new Error(`no_valid_batch_after_${maxRetries}_retries`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Add request timeout protection
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('request_timeout')), 30000); // 30 second total timeout
  });

  try {
    const payload = await req.json();
    console.log('Master Rules Generation Request:', payload);
    
    // Defaults and normalization
    if (!payload.rating) payload.rating = 'PG';
    const nonce = generateNonce();
    const subcategory = payload.subcategory || payload.category;
    
    // Enhanced system prompt with master rules
    const systemPrompt = `You are a master comedy writer following strict Step-2 Text Generation Rules.

MASTER RULES (CRITICAL - NO EXCEPTIONS):
1. Structure: Exactly ONE sentence, 50-120 characters total
2. Insert Tags: If provided, use each tag ONCE per line with natural inflections (plurals, past tense OK)
3. Category Anchoring: Each line must clearly relate to ${subcategory} using direct keywords or contextual cues
4. Rating Control: ${payload.rating} = ${MASTER_CONFIG.ratings[payload.rating]?.description}
5. Punctuation: Max 2 marks per line. NO em dashes (—), semicolons (;), or ellipses (…)
6. Quality: Sharp, quotable, stand-up quality humor - no greeting card fluff
7. Variety: Vary line length and structure within each set of 4

Category Keywords Available: ${getLexiconFor(subcategory).join(', ') || 'general'}

Rating Guidelines:
- G: Family-safe, wholesome, playful
- PG: Light sarcasm, safe irony
- PG-13: Edgy sarcasm, mild swears allowed (hell, damn)
- R: Savage, explicit swears allowed (fuck, shit), no slurs

FORBIDDEN: Placeholder words (friend, NAME, USER), em dashes, generic filler
OUTPUT: Only the joke line, nothing else.

Nonce: ${nonce}`;

    try {
      // Race between generation and timeout
      const validLines = await Promise.race([
        generateValidBatch(systemPrompt, payload, subcategory, nonce),
        timeoutPromise
      ]);
      
      return new Response(JSON.stringify({
        success: true,
        options: validLines
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (generationError) {
      console.error('🚨 Generation failed after all retries:', generationError);
      
      // Parse detailed error information if available
      let userMessage = 'Text generation failed';
      let statusCode = 422;
      let debugInfo = null;
      
      if (generationError.message.includes('insufficient_valid_lines:')) {
        try {
          const errorData = JSON.parse(generationError.message.replace('insufficient_valid_lines:', ''));
          debugInfo = errorData;
          
          // Create user-friendly message based on failure patterns
          const commonFailures = errorData.detailedFailures || errorData.failures || [];
          const failureReasons = commonFailures.map(f => f.reason);
          
          if (failureReasons.includes('length_out_of_bounds')) {
            userMessage = `Generated text was too long. Try a simpler tone or shorter ${subcategory} jokes.`;
          } else if (failureReasons.includes('category_anchor_missing')) {
            userMessage = `Could not create ${subcategory}-specific jokes. Try different settings or a more general category.`;
          } else if (failureReasons.includes('forbidden_punctuation')) {
            userMessage = `Generated text had formatting issues. Please try again.`;
          } else if (failureReasons.includes('punct_invalid')) {
            userMessage = `Generated text was too complex. Try a simpler tone or different category.`;
          } else {
            userMessage = `Generated ${errorData.validLines || 0} of 4 valid lines. Try adjusting tone or category settings.`;
          }
        } catch (parseError) {
          console.error('Failed to parse error details:', parseError);
        }
      } else if (generationError.message === 'request_timeout' || generationError.message === 'generation_timeout_exceeded') {
        userMessage = 'Generation timed out. Try again with simpler requirements.';
        statusCode = 408;
      } else if (generationError.message.includes('no_valid_batch')) {
        userMessage = 'Could not generate valid jokes with current settings. Try different tone, rating, or category.';
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: userMessage,
        details: {
          category: payload.category,
          subcategory: subcategory,
          tone: payload.tone,
          rating: payload.rating,
          insertWords: payload.insertWords,
          reason: generationError.message.split(':')[0], // Remove JSON details for user
          troubleshooting: 'Try different settings: simpler tone, different category, or no insert words',
          debugInfo: debugInfo // Include detailed debug info for development
        }
      }), {
        status: 200, // Always return 200 for structured error responses
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error('Master Rules Generation Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'System error occurred. Please try again.',
      details: { reason: error.message }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});