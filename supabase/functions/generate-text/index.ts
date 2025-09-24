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
    nascar: ["pit stop","laps","draft","checkered flag","burnout","infield","tailgate","pit crew","V8","pit lane","speedway","qualifying"],
    music: ["song","lyrics","concert","stage","band","playlist"],
    movies: ["movie","film","screen","popcorn","theater","trailer"],
    tv: ["show","series","episode","streaming","channel","binge"],
    "dad-jokes": ["pun","groan","eye roll","lawn","grill","thermostat","cargo shorts","socks","sandals","minivan","coupon","garage","toolbox"]
  },
  
  // Rating Definitions
  ratings: {
    G: { forbidden_words: [], allow_innuendo: false, description: "wholesome/playful" },
    PG: { forbidden_words: [], allow_innuendo: false, description: "light sarcasm, safe ironic" },
    "PG-13": { forbidden_words: [], allow_innuendo: true, description: "edgy, ironic, sharp" },
    R: { forbidden_words: [], allow_innuendo: true, description: "savage, raw, unfiltered" }
  }
};

// Structure templates for variety
const STRUCTURE_TEMPLATES = {
  BLUNT_ROAST: "Short roast with a twist",
  ABSURD_METAPHOR: "Weird comparison taken too far",
  OBSERVATIONAL: "Everyday life lens on the topic",
  RHETORICAL_QUESTION: "Question setup, punch in the question",
  SHORT_QUIP: "Punchy 55–75 chars",
  STORY_MICRO: "Tiny narrative → punch",
  SURPRISE_OBJECT: "Inanimate object has agency"
};

// Category-relevant topic seeds for creative twists
const TOPIC_SEEDS_BY_CATEGORY = {
  birthday: ["birthday cake", "candles", "party hats", "gift wrapping", "age", "wishes", "celebration", "friends", "family", "getting older"],
  wedding: ["marriage", "commitment", "romance", "partnership", "love", "ceremony", "reception", "couple", "vows", "future together"],
  anniversary: ["memories", "years together", "milestones", "relationship", "time", "growth", "partnership", "shared experiences", "commitment", "celebration"],
  graduation: ["achievement", "education", "future", "accomplishment", "learning", "school", "career", "success", "knowledge", "new chapter"],
  retirement: ["career", "work life", "freedom", "time", "experience", "wisdom", "leisure", "accomplishments", "new phase", "relaxation"],
  promotion: ["success", "recognition", "advancement", "hard work", "achievement", "career growth", "responsibility", "leadership", "opportunity", "progress"]
};

// Fallback general seeds for unlisted categories
const GENERAL_TOPIC_SEEDS = [
  "neighbors", "thermostat", "raccoons", "parking meter",
  "elevator", "leaf blower", "night shift", "robot vacuum", "playlist",
  "leftovers", "inbox", "lawn flamingo", "group chat", "souvenir mug",
  "houseplant", "delivery driver", "smoke alarm", "self-checkout", "weather app"
];

// Rating language gates
const SWEARS_MILD = /\b(hell|damn|crap)\b/i;
const SWEARS_STRONG = /\b(fuck(?:ing)?|shit|asshole|bastard|douche)\b/i;
const SLURS = /\b(?:placeholder_slur)\b/i; // Server-side only


// Category-specific ban lists (off-topic words to avoid)
const CATEGORY_BAN_LISTS = {
  wedding: ["wifi","wi-fi","pizza","monday","spreadsheet","deadline","zoom","traffic","taxes","office","email","login","password"],
  birthday: [],
  sports: ["winner", "champion", "team", "victory", "score", "game", "field"],
  cooking: ["recipe", "ingredients", "delicious", "taste", "flavor", "kitchen"],
  technology: ["computer", "internet", "digital", "online", "click", "download"]
};

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

function pickCategoryRelevantSeeds(category: string, count: number): string[] {
  const categoryKey = category.toLowerCase().split(' > ')[0];
  const categorySeeds = (TOPIC_SEEDS_BY_CATEGORY as any)[categoryKey] || GENERAL_TOPIC_SEEDS;
  const shuffled = [...categorySeeds].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function pickStructureTemplates(count: number): string[] {
  const templates = Object.keys(STRUCTURE_TEMPLATES);
  const shuffled = [...templates].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}


function getBanList(category: string): string[] {
  const categoryKey = category.toLowerCase().split(' > ')[0];
  return (CATEGORY_BAN_LISTS as any)[categoryKey] || [];
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
  
  // Handle content moderation errors
  if (data.error) {
    if (data.error.code === 'content_policy_violation' || data.error.message?.includes('content policy')) {
      throw new Error('CONTENT_MODERATION_BLOCKED');
    }
    throw new Error(`OpenAI API Error: ${data.error.message}`);
  }
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
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