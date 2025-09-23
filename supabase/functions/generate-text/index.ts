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
    babyshower: ["baby","shower","diaper","bottle","crib","stroller","nursery","onesie","pacifier","bassinet","pregnant","expecting","newborn","infant"],
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
      babyshower: /\b(expecting|baby shower|mom to be|little one|bundle of joy|due date|gender reveal)\b/i,
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
  
  // OPTIONAL: Check insert words only if they exist
  if (Array.isArray(scenario.insertWords) && scenario.insertWords.length > 0) {
    for (const tag of scenario.insertWords) {
      const base = tag.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = tag.includes(" ") 
        ? base.replace(/\s+/g, "\\s+")
        : `${base}(?:s|es|ed|ing)?`;
      const re = new RegExp(`(^|\\W)${pattern}(?=\\W|$)`, "i");
      const reAll = new RegExp(`(^|\\W)${pattern}(?=\\W|$)`, "ig");
      
      if (!re.test(text) || ((text.match(reAll) || []).length !== 1)) {
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
    
// =============== TONE-SPECIFIC SEED TEMPLATES ===============

// Enhanced insert word instruction builder
function buildInsertWordInstruction(insertWords: string[]): string {
  if (!insertWords || insertWords.length === 0) {
    return "No specific words required. Focus on natural category-specific humor.";
  }
  
  if (insertWords.length === 1) {
    return `Include "${insertWords[0]}" exactly once per line in natural phrasing.`;
  }
  
  if (insertWords.length === 2) {
    return `Include both "${insertWords[0]}" and "${insertWords[1]}" exactly once per line in natural phrasing. Each line must contain both words.`;
  }
  
  return `Include all these words exactly once per line in natural phrasing: ${insertWords.map(w => `"${w}"`).join(', ')}. Each line must contain all the specified words.`;
}

const TONE_SEED_TEMPLATES = {
  'playful': (subcategory: string, config: any, insertWords: string[], rating: string, tone: string) => `
Write 4 playful one-sentence jokes for a ${subcategory} celebration.
Each must be EXACTLY one sentence, 55-115 characters total, punchy and quotable.
Use at most 2 punctuation marks per line. NO em dashes, semicolons, or ellipses.
Include ${subcategory} context with words like: ${getLexiconFor(subcategory).slice(0, 5).join(', ')}.
${buildInsertWordInstruction(insertWords)}
${getRatingGuidance(rating, tone)}
Keep them short, crisp, and memorable. No rambling or complex clauses.
Return each line on a separate line with no numbering or formatting.`,

  'romantic': (subcategory: string, config: any, insertWords: string[], rating: string, tone: string) => `
Write 4 romantic one-sentence lines for a ${subcategory} celebration.
Each line must be ${config.lengthMin}–${config.lengthMax} characters, exactly one sentence, heartfelt but concise.
Use at most ${config.maxPunct} punctuation marks. Do not use em dashes, semicolons, or ellipses.
Tie each line clearly to ${subcategory} context.
${buildInsertWordInstruction(insertWords)}
${getRatingGuidance(rating, tone)}
Return each line on a separate line with no numbering or formatting.`,

  'sentimental': (subcategory: string, config: any, insertWords: string[], rating: string, tone: string) => `
Write 4 sentimental one-sentence lines for a ${subcategory} celebration.
Each line must be ${config.lengthMin}–${config.lengthMax} characters, exactly one sentence, emotional but NOT wordy.
CRITICAL: No rambling, no flowery language that creates long sentences.
Use at most ${config.maxPunct} punctuation marks. Do not use em dashes, semicolons, or ellipses.
Use simple, direct emotional statements tied to ${subcategory} context.
${buildInsertWordInstruction(insertWords)}
${getRatingGuidance(rating, tone)}
Return each line on a separate line with no numbering or formatting.`,

  'nostalgic': (subcategory: string, config: any, insertWords: string[], rating: string, tone: string) => `
Write 4 nostalgic one-sentence lines for a ${subcategory} celebration.
Each line must be ${config.lengthMin}–${config.lengthMax} characters, exactly one sentence, reflective but concise.
Use at most ${config.maxPunct} punctuation marks. Do not use em dashes, semicolons, or ellipses.
Tie each line clearly to ${subcategory} context with memories or reflections.
${buildInsertWordInstruction(insertWords)}
${getRatingGuidance(rating, tone)}
Return each line on a separate line with no numbering or formatting.`,

  'sarcastic': (subcategory: string, config: any, insertWords: string[], rating: string, tone: string) => `
Write 4 sarcastic one-sentence jokes for a ${subcategory} celebration.
Each line must be ${config.lengthMin}–${config.lengthMax} characters, exactly one sentence, witty but punchy.
Use at most ${config.maxPunct} punctuation marks. Do not use em dashes, semicolons, or ellipses.
Tie each line clearly to ${subcategory} context with ironic humor.
${buildInsertWordInstruction(insertWords)}
${getRatingGuidance(rating, tone)}
Return each line on a separate line with no numbering or formatting.`,

  'savage': (subcategory: string, config: any, insertWords: string[], rating: string, tone: string) => `
Write 4 savage one-sentence roasts for a ${subcategory} celebration.
Each line must be ${config.lengthMin}–${config.lengthMax} characters, exactly one sentence, brutal but clever.
Use at most ${config.maxPunct} punctuation marks. Do not use em dashes, semicolons, or ellipses.
Tie each line clearly to ${subcategory} context with cutting humor.
${buildInsertWordInstruction(insertWords)}
${getRatingGuidance(rating, tone)}
REMEMBER: Rating ${rating} determines language limits - savage tone must work within ${rating} constraints.
Return each line on a separate line with no numbering or formatting.`,

  'witty': (subcategory: string, config: any, insertWords: string[], rating: string, tone: string) => `
Write 4 witty one-sentence jokes for a ${subcategory} celebration.
Each line must be ${config.lengthMin}–${config.lengthMax} characters, exactly one sentence, clever but concise.
Use at most ${config.maxPunct} punctuation marks. Do not use em dashes, semicolons, or ellipses.
Tie each line clearly to ${subcategory} context with smart wordplay.
${buildInsertWordInstruction(insertWords)}
${getRatingGuidance(rating, tone)}
Return each line on a separate line with no numbering or formatting.`,

  'dry': (subcategory: string, config: any, insertWords: string[], rating: string, tone: string) => `
Write 4 dry humor one-sentence jokes for a ${subcategory} celebration.
Each line must be ${config.lengthMin}–${config.lengthMax} characters, exactly one sentence, deadpan but tight.
Use at most ${config.maxPunct} punctuation marks. Do not use em dashes, semicolons, or ellipses.
Tie each line clearly to ${subcategory} context with understated humor.
${buildInsertWordInstruction(insertWords)}
${getRatingGuidance(rating, tone)}
Return each line on a separate line with no numbering or formatting.`
}

// Get comedian pool based on tone and rating (rating always overrides tone)
function getComedianPool(tone: string, rating: string, style: string = 'Generic'): string[] {
  // Load the tone-style-rating matrix
  const toneStyleMap = {
    "Humorous": {
      "Generic":   { "G":"CLEAN",        "PG":"PG_EDGE",     "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" },
      "Sarcastic": { "G":"PG_EDGE",      "PG":"PG_EDGE",     "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" },
      "Wholesome": { "G":"CLEAN",        "PG":"CLEAN",       "PG-13":"PG_EDGE",     "R":"CLEAN" },
      "Weird":     { "G":"WEIRD_DRY",    "PG":"WEIRD_DRY",   "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" }
    },
    "Savage": {
      "Generic":   { "G":"PG_EDGE",      "PG":"PG_EDGE",     "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" },
      "Sarcastic": { "G":"PG_EDGE",      "PG":"PG_EDGE",     "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" },
      "Wholesome": { "G":"CLEAN",        "PG":"PG_EDGE",     "PG-13":"PG13_SAVAGE", "R":"CLEAN" },
      "Weird":     { "G":"WEIRD_DRY",    "PG":"WEIRD_DRY",   "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" }
    },
    "Playful": {
      "Generic":   { "G":"CLEAN",        "PG":"PG_EDGE",     "PG-13":"PG_EDGE",     "R":"R_EXPLICIT" },
      "Sarcastic": { "G":"PG_EDGE",      "PG":"PG_EDGE",     "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" },
      "Wholesome": { "G":"CLEAN",        "PG":"CLEAN",       "PG-13":"PG_EDGE",     "R":"CLEAN" },
      "Weird":     { "G":"WEIRD_DRY",    "PG":"WEIRD_DRY",   "PG-13":"PG_EDGE",     "R":"R_EXPLICIT" }
    },
    "Sentimental": {
      "Generic":   { "G":"ROMANTIC_WARM","PG":"ROMANTIC_WARM","PG-13":"PG_EDGE",     "R":"ROMANTIC_SARCASTIC" },
      "Sarcastic": { "G":"PG_EDGE",      "PG":"PG_EDGE",     "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" },
      "Wholesome": { "G":"ROMANTIC_WARM","PG":"ROMANTIC_WARM","PG-13":"PG_EDGE",     "R":"ROMANTIC_WARM" },
      "Weird":     { "G":"WEIRD_DRY",    "PG":"WEIRD_DRY",   "PG-13":"PG_EDGE",     "R":"R_EXPLICIT" }
    },
    "Romantic": {
      "Generic":   { "G":"ROMANTIC_WARM","PG":"ROMANTIC_WARM","PG-13":"PG_EDGE",     "R":"ROMANTIC_SARCASTIC" },
      "Sarcastic": { "G":"PG_EDGE",      "PG":"PG_EDGE",     "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" },
      "Wholesome": { "G":"ROMANTIC_WARM","PG":"ROMANTIC_WARM","PG-13":"PG_EDGE",     "R":"ROMANTIC_WARM" },
      "Weird":     { "G":"WEIRD_DRY",    "PG":"WEIRD_DRY",   "PG-13":"PG_EDGE",     "R":"R_EXPLICIT" }
    },
    "Serious": {
      "Generic":   { "G":"CLEAN",        "PG":"CLEAN",       "PG-13":"PG_EDGE",     "R":"R_EXPLICIT" },
      "Sarcastic": { "G":"PG_EDGE",      "PG":"PG_EDGE",     "PG-13":"PG13_SAVAGE", "R":"R_EXPLICIT" },
      "Wholesome": { "G":"CLEAN",        "PG":"CLEAN",       "PG-13":"PG_EDGE",     "R":"CLEAN" },
      "Weird":     { "G":"WEIRD_DRY",    "PG":"WEIRD_DRY",   "PG-13":"PG_EDGE",     "R":"R_EXPLICIT" }
    }
  };

  const comedianPools = {
    "CLEAN": ["Jim Gaffigan","Brian Regan","Ellen DeGeneres","Jerry Seinfeld","John Mulaney"],
    "PG_EDGE": ["Sarah Silverman","Kevin Hart","Patton Oswalt","Ali Wong","Aziz Ansari"],
    "PG13_SAVAGE": ["Bill Burr","Joan Rivers","Ricky Gervais","Chris Rock","Louis C.K."],
    "R_EXPLICIT": ["George Carlin","Bill Burr","Joan Rivers","Sarah Silverman","Ricky Gervais","Louis C.K.","Ali Wong"],
    "ROMANTIC_WARM": ["Jim Gaffigan","Ellen DeGeneres","John Mulaney"],
    "ROMANTIC_SARCASTIC": ["Ali Wong","Sarah Silverman","Bill Burr"],
    "WEIRD_DRY": ["Mitch Hedberg","Steven Wright","Norm Macdonald"],
    "NERDY_STORY": ["Patton Oswalt","John Mulaney","Hasan Minhaj"]
  };

  // Get the pool key based on tone, style, and rating
  const toneMap = toneStyleMap[tone] || toneStyleMap["Playful"];
  const styleMap = toneMap[style] || toneMap["Generic"];
  const poolKey = styleMap[rating] || styleMap["PG"];
  
  return comedianPools[poolKey] || comedianPools["CLEAN"];
}

// Enhanced rating enforcement guidance - rating ALWAYS overrides tone
function getRatingGuidance(rating: string, tone: string): string {
  const guidance = {
    'G': `Family-safe, wholesome humor. NO swearing or edge content. Even if tone is "${tone}", keep it clean and gentle.`,
    'PG': `Light sarcasm and irony allowed. Gentle roasting OK. Words like "hell" or "damn" permitted. Tone "${tone}" must stay within PG bounds.`,
    'PG-13': `Edgy sarcasm, sharper wit allowed. Mild swears permitted (hell, damn, crap). Tone "${tone}" can be more aggressive but no F-bombs.`,
    'R': `SAVAGE and EXPLICIT required. Must include strong language (fuck, shit, asshole, bastard). Raw, unfiltered comedy. At least 2 lines should have profanity. Tone "${tone}" can be fully unleashed.`
  };
  return `RATING ${rating} OVERRIDES ALL: ${guidance[rating] || guidance['PG']}`;
}

// Rating enforcement guidance with enhanced R-level requirements
function getRatingGuidance_Legacy(rating: string): string {
  const guidance = {
    'G': 'Family-safe, wholesome humor. No swearing or edge.',
    'PG': 'Light sarcasm and irony. Gentle roasting. Words like "hell" or "damn" allowed.',
    'PG-13': 'Edgy sarcasm, sharper wit. Mild swears allowed (hell, damn, crap).',
    'R': 'SAVAGE and EXPLICIT. Must include strong language (fuck, shit, asshole, bastard). Raw, unfiltered comedy. At least 2 lines should have profanity.'
  }
  return `Rating ${rating}: ${guidance[rating] || guidance['PG']}`
}

// Build tone-specific seed prompt with RATING OVERRIDES TONE logic
function buildToneSpecificSeed(tone: string, subcategory: string, config: any, insertWords: string[] = [], rating: string = 'PG'): string {
  const normalizedTone = tone.toLowerCase().replace(/\s+/g, '')
  const seedTemplate = TONE_SEED_TEMPLATES[normalizedTone] || TONE_SEED_TEMPLATES['playful']
  
  return seedTemplate(subcategory, config, insertWords, rating, tone)
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
    
    // Use tone-specific seed template for strict one-sentence enforcement
    const instructions = buildToneSpecificSeed(
      payload.tone || 'playful',
      subcategory, 
      config,
      payload.insertWords || [],
      payload.rating || 'PG'
    );
    
    // Add category context for better anchoring
    const contextWords = getLexiconFor(subcategory);
    const contextHint = contextWords.length > 0 
      ? `\nUse ${subcategory} words like: ${contextWords.slice(0, 4).join(', ')}`
      : '';
      
    const userPrompt = `${instructions}${contextHint}

EXAMPLES of valid single-sentence ${subcategory} lines:
${subcategory === 'birthday' ? 
  `The cake had so many candles the smoke alarm joined the party.
The balloons popped faster than my birthday wish left my lips.
Another year older means another year of pretending to like cake.
The frosting survived longer than my diet did at this party.` :
subcategory === 'wedding' ? 
  `The cake toppled before vows ended but everyone called it tradition.
Uncle Bob hit the dance floor like it was a second wedding vow.
The bouquet sailed farther than the bride ever planned to throw.
The DJ shouted toast time and half the guests raised cake instead.` :
  `Generate ${subcategory}-specific one-sentence lines that are punchy and contextual.`}

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
      
      // Take first 4 lines and validate each with tone-specific validation
      const lines = cleanedLines.slice(0, 4);
      const candidates = [];
      const detailedFailures = [];
      
      // ALWAYS pick comedians based on tone+rating combination - never fall back to "AI Assist"
      const comedianPool = getComedianPool(payload.tone || 'Playful', payload.rating || 'PG', 'Generic');
      const selectedComedians = comedianPool.sort(() => 0.5 - Math.random()).slice(0, 4);
      
      for (let i = 0; i < 4; i++) {
        const line = lines[i];
        
        // Enhanced validation with tone-specific parameters
        const validation = debugValidateLine(line, {
          insertWords: payload.insertWords || [],
          lengthMin: config.lengthMin,
          lengthMax: config.lengthMax,
          maxPunct: config.maxPunct,
          subcategory,
          tone: payload.tone
        });
        
        if (validation.ok) {
          candidates.push({
            line: line,
            comedian: selectedComedians[i] || selectedComedians[0] // Always use a comedian, never "AI Assist"
          });
          console.log(`✅ Line ${i+1} PASSED (${payload.tone}): "${line.substring(0, 60)}..."`);
        } else {
          detailedFailures.push({
            index: i,
            line: line.substring(0, 80) + '...',
            reason: validation.reason,
            details: validation.details,
            fullLine: line,
            tone: payload.tone
          });
          console.log(`❌ Line ${i+1} FAILED (${validation.reason}) for ${payload.tone} tone: "${line.substring(0, 60)}..."`);
          if (validation.details) {
            console.log(`   Details:`, validation.details);
          }
        }
      }
      
      console.log(`📊 Attempt ${attempt + 1}: Got ${candidates.length} valid out of 4 lines using ${payload.tone} tone`);
      
      // Success condition: exactly 4 valid lines
      if (candidates.length === 4) {
        console.log(`🎉 All lines passed validation for ${payload.tone} tone! Returning 4 valid lines.`);
        return candidates;
      }
      
      // If this is our last attempt, check if we have any valid lines to return
      if (attempt === maxRetries - 1) {
        // If we have at least 1-2 valid lines, return them with an explanation
        if (candidates.length >= 1) {
          console.log(`🔄 Returning ${candidates.length} partial results instead of complete failure`);
          
          // Pad with simplified versions if we have some but not 4
          while (candidates.length < 4) {
            // Generate a simple fallback line
            const fallbackComedian = selectedComedians[candidates.length] || selectedComedians[0];
            const fallbackLine = subcategory === 'wedding' 
              ? "Wedding bells rang louder than my objections." 
              : subcategory === 'birthday'
              ? "Another year older and still avoiding the scale."
              : "Life happens one awkward moment at a time.";
            
            candidates.push({
              line: fallbackLine,
              comedian: fallbackComedian
            });
          }
          
          return candidates;
        }
        
        const toneAdvice = {
          'sentimental': 'Try "playful" or "witty" tone for shorter, punchier lines',
          'nostalgic': 'Try "playful" or "dry" tone for more concise humor', 
          'romantic': 'Try "witty" or "playful" tone for less wordy output',
          'playful': 'Try "witty" or "dry" tone for more structured humor'
        };
        
        const suggestion = toneAdvice[payload.tone?.toLowerCase()] || 'Try a different tone like "playful" or "witty"';
        
        const errorDetails = {
          validLines: candidates.length,
          totalRequested: 4,
          tone: payload.tone,
          suggestion,
          detailedFailures
        };
        
        console.log(`💥 Final attempt failed for ${payload.tone} tone. Suggestion: ${suggestion}`);
        console.log(`🔍 Full debug info:`, JSON.stringify(errorDetails, null, 2));
        
        throw new Error(`insufficient_valid_lines:${JSON.stringify(errorDetails)}`);
      }
      
      // Continue to next attempt with more relaxed config
      console.log(`⏳ Waiting ${300 + attempt * 100}ms before retry with relaxed config...`);
      await new Promise(resolve => setTimeout(resolve, 300 + attempt * 100));
      
    } catch (error) {
      console.error(`💥 Generation attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
    
    // Wait before retry with jitter
    if (attempt < maxRetries - 1) {
      const delay = 1000 + Math.random() * 2000; // 1-3 second jitter
      console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`no_valid_batch_after_${maxRetries}_retries`);
}
    const contextWords = getLexiconFor(subcategory);
    const contextHint = contextWords.length > 0 
      ? `\nUse ${subcategory} words like: ${contextWords.slice(0, 4).join(', ')}`
      : '';
      
    const userPrompt = `${instructions}${contextHint}

EXAMPLES of valid single-sentence ${subcategory} lines:
${subcategory === 'birthday' ? 
  `The cake had so many candles the smoke alarm joined the party.
The balloons popped faster than my birthday wish left my lips.
Another year older means another year of pretending to like cake.
The frosting survived longer than my diet did at this party.` :
subcategory === 'wedding' ? 
  `The cake toppled before vows ended but everyone called it tradition.
Uncle Bob hit the dance floor like it was a second wedding vow.
The bouquet sailed farther than the bride ever planned to throw.
The DJ shouted toast time and half the guests raised cake instead.` :
  `Generate ${subcategory}-specific one-sentence lines that are punchy and contextual.`}

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
      
      // Take first 4 lines and validate each with tone-specific validation
      const lines = cleanedLines.slice(0, 4);
      const candidates = [];
      const detailedFailures = [];
      
      // ALWAYS pick comedians based on tone+rating combination - never fall back to "AI Assist"
      const comedianPool = getComedianPool(payload.tone || 'Playful', payload.rating || 'PG', 'Generic');
      const selectedComedians = comedianPool.sort(() => 0.5 - Math.random()).slice(0, 4);
      
      for (let i = 0; i < 4; i++) {
        const line = lines[i];
        
        // Enhanced validation with tone-specific parameters
        const validation = debugValidateLine(line, {
          insertWords: payload.insertWords || [],
          lengthMin: config.lengthMin,
          lengthMax: config.lengthMax,
          maxPunct: config.maxPunct,
          subcategory,
          tone: payload.tone
        });
        
        if (validation.ok) {
          candidates.push({
            line: line,
            comedian: selectedComedians[i] || selectedComedians[0] // Always use a comedian, never "AI Assist"
          });
          console.log(`✅ Line ${i+1} PASSED (${payload.tone}): "${line.substring(0, 60)}..."`);
        } else {
          detailedFailures.push({
            index: i,
            line: line.substring(0, 80) + '...',
            reason: validation.reason,
            details: validation.details,
            fullLine: line,
            tone: payload.tone
          });
          console.log(`❌ Line ${i+1} FAILED (${validation.reason}) for ${payload.tone} tone: "${line.substring(0, 60)}..."`);
          if (validation.details) {
            console.log(`   Details:`, validation.details);
          }
        }
      }
      
      console.log(`📊 Attempt ${attempt + 1}: Got ${candidates.length} valid out of 4 lines using ${payload.tone} tone`);
      
      // Success condition: exactly 4 valid lines
      if (candidates.length === 4) {
        console.log(`🎉 All lines passed validation for ${payload.tone} tone! Returning 4 valid lines.`);
        return candidates;
      }
      
      // RETRY LOGIC: If we have partial success (2-3 valid lines), try regenerating just the failed ones
      if (candidates.length >= 2 && attempt < maxRetries - 1) {
        console.log(`🔄 Partial success: ${candidates.length}/4 lines valid. Trying to regenerate failed lines...`);
        
        const failedIndices = detailedFailures.map(f => f.index);
        const needToGenerate = 4 - candidates.length;
        
        try {
          // Generate replacement lines with more specific prompting
          const retryPrompt = `${instructions}

CRITICAL: Previous attempt produced some valid lines but others failed. 
Generate exactly ${needToGenerate} more lines that avoid these common failures:
${detailedFailures.map(f => `- ${f.reason}: "${f.line}"`).join('\n')}

Focus on:
- Exactly one sentence per line
- ${config.lengthMin}-${config.lengthMax} characters
- Maximum ${config.maxPunct} punctuation marks
- Clear ${subcategory} context
${payload.insertWords?.length > 0 ? `- Include ALL these words exactly once per line: ${payload.insertWords.join(', ')}` : ''}

Generate ${needToGenerate} replacement lines:`;

          const retryResponse = await callOpenAI(systemPrompt, retryPrompt);
          const retryLines = parseAndCleanLines(retryResponse);
          
          console.log(`🔧 Retry generated ${retryLines.length} replacement lines`);
          
          // Validate retry lines
          let retrySuccesses = 0;
          for (let i = 0; i < Math.min(retryLines.length, needToGenerate); i++) {
            const line = retryLines[i];
            const validation = debugValidateLine(line, {
              insertWords: payload.insertWords || [],
              lengthMin: config.lengthMin,
              lengthMax: config.lengthMax,
              maxPunct: config.maxPunct,
              subcategory,
              tone: payload.tone
            });
            
            if (validation.ok) {
              candidates.push({
                line: line,
                comedian: selectedComedians[retrySuccesses] || selectedComedians[0] // Always use comedian
              });
              retrySuccesses++;
              console.log(`✅ Retry line ${i+1} PASSED: "${line.substring(0, 60)}..."`);
              
              // Check if we now have 4 valid lines
              if (candidates.length === 4) {
                console.log(`🎉 Retry successful! Now have 4 valid lines.`);
                return candidates;
              }
            } else {
              console.log(`❌ Retry line ${i+1} FAILED (${validation.reason}): "${line.substring(0, 60)}..."`);
            }
          }
          
          console.log(`📊 After retry: ${candidates.length}/4 lines valid (gained ${retrySuccesses})`);
        } catch (retryError) {
          console.log(`💥 Retry generation failed:`, retryError.message);
        }
      }
      
      // If this is our last attempt, provide tone-specific guidance
      if (attempt === maxRetries - 1) {
        const toneAdvice = {
          'sentimental': 'Try "playful" or "witty" tone for shorter, punchier lines',
          'nostalgic': 'Try "playful" or "dry" tone for more concise humor', 
          'romantic': 'Try "witty" or "playful" tone for less wordy output',
          'playful': 'Try "witty" or "dry" tone for more structured humor'
        };
        
        const suggestion = toneAdvice[payload.tone?.toLowerCase()] || 'Try a different tone like "playful" or "witty"';
        
        const errorDetails = {
          validLines: candidates.length,
          totalRequested: 4,
          tone: payload.tone,
          suggestion,
          detailedFailures,
          lastAttemptConfig: config,
          allLines: lines.map((line, i) => ({
            index: i,
            line: line.substring(0, 100) + (line.length > 100 ? '...' : ''),
            length: line.length,
            tone: payload.tone
          }))
        };
        
        console.log(`💥 Final attempt failed for ${payload.tone} tone. Suggestion: ${suggestion}`);
        console.log(`🔍 Full debug info:`, JSON.stringify(errorDetails, null, 2));
        
        throw new Error(`validation_failed:${JSON.stringify(errorDetails)}`);
      }
      
      // Continue to next attempt with more relaxed config
      console.log(`⏳ Waiting ${300 + attempt * 100}ms before retry with relaxed config...`);
      await new Promise(resolve => setTimeout(resolve, 300 + attempt * 100));
      
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
    
    // Robust schema normalization - handle multiple field names and types
    if (!payload.rating) payload.rating = 'PG';
    
    // Handle insertWords/insertTags field name variations and type coercion
    let insertWords: string[] = [];
    if (payload.insertWords) {
      insertWords = Array.isArray(payload.insertWords) 
        ? payload.insertWords.filter(Boolean) 
        : [payload.insertWords].filter(Boolean);
    } else if (payload.insertTags) {
      insertWords = Array.isArray(payload.insertTags) 
        ? payload.insertTags.filter(Boolean) 
        : [payload.insertTags].filter(Boolean);
    }
    payload.insertWords = insertWords; // Normalize to insertWords
    const nonce = generateNonce();
    const subcategory = payload.subcategory || payload.category;
    
    // Enhanced system prompt with RATING OVERRIDES TONE emphasis
    const systemPrompt = `You are a master comedy writer following strict Step-2 Text Generation Rules.

MASTER RULES (CRITICAL - NO EXCEPTIONS):
1. Structure: Exactly ONE sentence, 50-120 characters total
2. Insert Tags: If provided, use each tag ONCE per line with natural inflections (plurls, past tense OK)
3. Category Anchoring (LOOSENED): Each line must relate to ${subcategory} using direct keywords OR cultural cues. At batch level, at least 2 of 4 lines should contain direct category keywords.
4. RATING ALWAYS OVERRIDES TONE: ${payload.rating} rating limits supersede ${payload.tone} tone preferences
5. Punctuation: Max 2 marks per line. NO em dashes (—), semicolons (;), or ellipses (…)
6. Quality: Sharp, quotable, stand-up quality humor - no greeting card fluff
7. Variety: Vary line length and structure within each set of 4
8. Comedian Persona: Write in the voice of ${getComedianPool(payload.tone || 'Playful', payload.rating || 'PG')[0]} - NEVER generic "AI Assist" style

Category Keywords Available: ${getLexiconFor(subcategory).join(', ') || 'general'}
Cultural Context: ${subcategory} celebrations, traditions, emotions, and experiences

Rating Guidelines (THESE OVERRIDE TONE):
- G: Family-safe, wholesome, playful - even "Savage" tone must be gentle
- PG: Light sarcasm, safe irony - tone can be edgier but clean
- PG-13: Edgy sarcasm, mild swears allowed (hell, damn) - tone can be sharp
- R: SAVAGE AND EXPLICIT required. Strong profanity MANDATORY (fuck, shit, asshole). At least 2/4 lines must contain explicit language. Raw, unfiltered edge.

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
      let statusCode = 200; // Always return 200 for structured error responses
      let debugInfo = null;
      
      if (generationError.message.includes('insufficient_valid_lines:') || generationError.message.includes('validation_failed:')) {
        try {
          const errorData = JSON.parse(generationError.message.replace(/^(insufficient_valid_lines|validation_failed):/, ''));
          debugInfo = errorData;
          
          // Create specific user-friendly messages based on failure patterns
          const commonFailures = errorData.detailedFailures || errorData.failures || [];
          const failureReasons = commonFailures.map(f => f.reason);
          
          // Analyze specific failure patterns for better user guidance
          if (failureReasons.some(r => r.includes('multiple_sentences'))) {
            userMessage = `Generated text was too wordy (multiple sentences). Try "${payload.tone}" with shorter, punchier phrasing.`;
          } else if (failureReasons.some(r => r.includes('length_out_of_bounds'))) {
            userMessage = `Generated text exceeded 120 character limit. "${payload.tone}" tone tends to be longer - try "playful" or "witty" instead.`;
          } else if (failureReasons.some(r => r.includes('punct_invalid'))) {
            userMessage = `Generated text had too much punctuation (>2 marks). "${payload.tone}" tone creates complex sentences - try simpler tones.`;
          } else if (failureReasons.some(r => r.includes('category_anchor_missing'))) {
            userMessage = `Could not create ${subcategory}-specific content. Try a more general category or different tone.`;
          } else if (failureReasons.some(r => r.includes('forbidden_punctuation'))) {
            userMessage = `Generated text used forbidden punctuation (semicolons, em-dashes). Please try again.`;
          } else if (failureReasons.some(r => r.includes('insert_not_once'))) {
            const missingTag = failureReasons.find(r => r.includes('insert_not_once'))?.split(':')[1];
            userMessage = `Could not naturally include "${missingTag}" in ${subcategory} context. Try different category or remove specific words.`;
          } else {
            const validCount = errorData.validLines || 0;
            userMessage = `Generated ${validCount} of 4 valid lines. Main issue: ${failureReasons[0]?.replace(/_/g, ' ') || 'formatting problems'}`;
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