import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Get model from environment with fallback - Using GPT-4o-mini for step #2
const getTextModel = () => Deno.env.get('OPENAI_TEXT_MODEL') || 'gpt-4o-mini';

// Rules cache
let cachedRules: any = null;

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

  // GPT-5 and newer models use max_completion_tokens, older models use max_tokens
  if (model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4')) {
    body.max_completion_tokens = options.maxTokens;
    // These models don't support temperature parameter
  } else {
    body.max_tokens = options.maxTokens;
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
  }

  return body;
}

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Load rules from viibes-rules-v4.json
async function loadRules(rulesId: string, origin?: string): Promise<any> {
  if (cachedRules && cachedRules.id === rulesId) {
    return cachedRules;
  }

  // Try to load from caller origin first
  if (origin) {
    try {
      const rulesUrl = `${origin}/config/${rulesId}.json`;
      console.log(`📋 Loading rules from: ${rulesUrl}`);
      const response = await fetch(rulesUrl);
      if (response.ok) {
        cachedRules = await response.json();
        console.log(`✅ Loaded rules v${cachedRules.version} from origin`);
        return cachedRules;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load rules from origin: ${error}`);
    }
  }

  // Fallback to embedded minimal rules
  console.log('📋 Using fallback embedded rules');
  cachedRules = {
    id: rulesId,
    version: 4,
    length: { min_chars: 50, max_chars: 120 },
    punctuation: {
      ban_em_dash: true,
      replacement: { "—": "," },
      allowed: [".", ",", "?", "!"],
      max_marks_per_line: 2
    },
    tones: {
      "Savage": { rules: ["blunt", "cutting", "roast_style", "no_soft_language"] },
      "Playful": { rules: ["cheeky", "silly", "mischievous", "no_formal"] },
      "Serious": { rules: ["dry", "deadpan", "formal_weight", "no_jokes_except_dry_wit"] }
    },
    ratings: {
      "G": { allow_profanity: false, allow_censored_swears: false, insult_strength: "none" },
      "PG": { allow_profanity: false, allow_censored_swears: true, censored_forms: ["f***", "sh*t", "a**", "b****"], insult_strength: "light_to_medium" },
      "PG-13": { allow_profanity: true, profanity_whitelist: ["hell", "damn"], block_stronger_profanity: true, insult_strength: "medium" },
      "R": { allow_profanity: true, require_profanity: true, profanity_whitelist: ["fuck", "shit", "bastard", "ass", "bullshit", "goddamn"], insult_strength: "heavy" }
    },
    spelling: {
      auto_substitutions: { "you've": "you have" }
    }
  };
  
  return cachedRules;
}

// Build rating-specific profanity instructions
function buildProfanityInstructions(rating: string, rules: any): string {
  const ratingRules = rules.ratings[rating];
  if (!ratingRules) return "";

  switch (rating) {
    case "G":
      return "CRITICAL: NO profanity whatsoever. Keep it completely wholesome.";
    case "PG":
      return `CRITICAL: Only use censored forms if needed: ${ratingRules.censored_forms?.join(', ')}. No uncensored profanity.`;
    case "PG-13":
      return `CRITICAL: Only use these mild words if needed: ${ratingRules.profanity_whitelist?.join(', ')}. Block all stronger profanity.`;
    case "R":
      return `CRITICAL: MUST include at least one of these words: ${ratingRules.profanity_whitelist?.join(', ')}. This is REQUIRED for R rating.`;
    default:
      return "";
  }
}

// Build tone-specific instructions
function buildToneInstructions(tone: string, rules: any): string {
  const toneRules = rules.tones[tone];
  if (!toneRules) return "";

  const ruleDescriptions: { [key: string]: string } = {
    "blunt": "be direct and harsh",
    "cutting": "use sharp, biting language", 
    "roast_style": "mock and criticize mercilessly",
    "no_soft_language": "avoid gentle or polite phrasing",
    "cheeky": "be playfully impudent",
    "silly": "be absurd and ridiculous",
    "mischievous": "be playfully troublesome",
    "no_formal": "avoid formal language",
    "dry": "use understated humor",
    "deadpan": "deliver with serious tone",
    "formal_weight": "use serious, weighty language"
  };

  const instructions = toneRules.rules
    .map((rule: string) => ruleDescriptions[rule] || rule)
    .join(', ');

  return `Tone guidance: ${instructions}.`;
}

// Enforce rules on generated text
function enforceRules(lines: string[], rules: any, rating: string): { lines: string[], enforcement: string[] } {
  const enforcement: string[] = [];
  const ratingRules = rules.ratings[rating];
  const profanityWhitelist = ratingRules?.profanity_whitelist || [];
  const censoredForms = ratingRules?.censored_forms || [];
  
  const processedLines = lines.map((line, index) => {
    let processed = line;
    let lineEnforcement = [];

    // Apply auto substitutions
    if (rules.spelling?.auto_substitutions) {
      for (const [from, to] of Object.entries(rules.spelling.auto_substitutions)) {
        if (processed.includes(from)) {
          processed = processed.replace(new RegExp(from, 'gi'), to as string);
          lineEnforcement.push(`substituted '${from}' -> '${to}'`);
        }
      }
    }

    // Apply punctuation rules
    if (rules.punctuation?.replacement) {
      for (const [from, to] of Object.entries(rules.punctuation.replacement)) {
        if (processed.includes(from)) {
          processed = processed.replace(new RegExp(from, 'g'), to as string);
          lineEnforcement.push(`replaced '${from}' -> '${to}'`);
        }
      }
    }

    // Limit punctuation marks
    if (rules.punctuation?.max_marks_per_line) {
      const punctMarks = processed.match(/[.!?]/g) || [];
      if (punctMarks.length > rules.punctuation.max_marks_per_line) {
        // Keep only the first N punctuation marks
        let count = 0;
        processed = processed.replace(/[.!?]/g, (match) => {
          count++;
          return count <= rules.punctuation.max_marks_per_line ? match : '';
        });
        lineEnforcement.push(`limited punctuation to ${rules.punctuation.max_marks_per_line} marks`);
      }
    }

    // Rating-specific profanity enforcement
    if (rating === "R" && ratingRules?.require_profanity) {
      const hasProfanity = profanityWhitelist.some((word: string) => 
        processed.toLowerCase().includes(word.toLowerCase())
      );
      
      if (!hasProfanity) {
        // Inject mild profanity at the end
        const injectWord = "goddamn";
        processed = processed.replace(/[.!?]?\s*$/, `, ${injectWord} it.`);
        lineEnforcement.push(`injected '${injectWord}' for R rating`);
      }
    }

    // Clean up extra spaces
    processed = processed.replace(/\s+/g, ' ').trim();
    
    if (lineEnforcement.length > 0) {
      enforcement.push(`Line ${index + 1}: ${lineEnforcement.join(', ')}`);
    }

    return processed;
  });

  return { lines: processedLines, enforcement };
}

// Simple text cleanup function
function cleanLine(rawText: string): string {
  let cleaned = rawText.trim();
  
  // Remove common prefixes: numbers, bullets, quotes
  cleaned = cleaned.replace(/^\s*[\d+\-\*•]\s*[\.\)\-]?\s*/, '');
  cleaned = cleaned.replace(/^["'"'`]/, '');
  cleaned = cleaned.replace(/["'"'`]$/, '');
  
  // Remove markdown formatting
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
  cleaned = cleaned.replace(/`(.*?)`/g, '$1');
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Parse lines from AI response
function parseLines(rawResponse: string): string[] {
  let lines = rawResponse.split(/\r?\n/);
  
  // Try other splitting patterns if needed
  if (lines.length < 4) {
    const numberedSplit = rawResponse.split(/(?=\d+[\.\)])/);
    if (numberedSplit.length >= 4) {
      lines = numberedSplit;
    }
  }
  
  const cleanedLines = lines
    .map(line => cleanLine(line))
    .filter(line => line.length >= 35 && line.length <= 140);
  
  return cleanedLines;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<{ content: string; model: string }> {
  let model = getTextModel();
  console.log(`🤖 Using model: ${model}`);
  
  let maxTokens = model.startsWith('gpt-5') ? 4000 : 200; // Very high limit for GPT-5 reasoning + response
  
  // First attempt with GPT-5
  try {
    const requestBody = buildOpenAIRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens }
    );
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 Response Status:', response.status);
    
    const data = await response.json();
    console.log('📄 Response Data:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ API Error:', data.error);
      throw new Error(`OpenAI API Error: ${data.error.message}`);
    }
    
    const content = data.choices?.[0]?.message?.content;
    const actualModel = data.model || model; // Use actual model from response or fallback to requested model
    
    if (!content || content.trim() === '') {
      console.warn('⚠️ GPT-5 returned empty content - falling back to GPT-4o-mini');
      throw new Error('GPT-5 returned empty content');
    }
    
    return { content, model: actualModel };
    
  } catch (error) {
    // Fallback to GPT-4o-mini if GPT-5 fails
    console.log('🔄 Falling back to GPT-4o-mini due to GPT-5 failure');
    model = 'gpt-4o-mini';
    maxTokens = 200;
    
    const requestBody = buildOpenAIRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens, temperature: 0.8 }
    );
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 Fallback Response Status:', response.status);
    
    const data = await response.json();
    console.log('📄 Fallback Response Data:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ Fallback API Error:', data.error);
      throw new Error(`OpenAI API Error: ${data.error.message}`);
    }
    
    const content = data.choices?.[0]?.message?.content;
    const actualModel = data.model || model;
    
    if (!content || content.trim() === '') {
      throw new Error('Both GPT-5 and fallback model returned empty content');
    }
    
    return { content, model: actualModel };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Text generation request:', JSON.stringify(payload, null, 2));

    const { category, subcategory, tone, rating, insertWords, rules_id } = payload;
    
    // Load rules if provided
    let rules = null;
    if (rules_id) {
      const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');
      rules = await loadRules(rules_id, origin);
      console.log(`📋 Using rules: ${rules.id} v${rules.version}`);
    }

    // Build comprehensive prompt using rules
    let systemPrompt = `You are a comedy writer. Generate exactly 4 funny sentences.`;
    
    // Length requirements from rules
    if (rules?.length) {
      systemPrompt += ` Each sentence must be ${rules.length.min_chars}-${rules.length.max_chars} characters.`;
    } else {
      systemPrompt += ` Each sentence must be 50-120 characters.`;
    }
    
    if (category) systemPrompt += ` Topic: ${category}`;
    if (subcategory) systemPrompt += ` > ${subcategory}`;
    
    // Apply tone rules
    if (tone && rules) {
      const toneInstructions = buildToneInstructions(tone, rules);
      if (toneInstructions) systemPrompt += ` ${toneInstructions}`;
    } else if (tone) {
      systemPrompt += ` Tone: ${tone}`;
    }
    
    // Apply rating rules  
    if (rating && rules) {
      const profanityInstructions = buildProfanityInstructions(rating, rules);
      if (profanityInstructions) systemPrompt += ` ${profanityInstructions}`;
    } else if (rating) {
      systemPrompt += ` Rating: ${rating}`;
    }
    
    if (insertWords && insertWords.length > 0) {
      systemPrompt += ` MUST include these words: ${insertWords.join(', ')}`;
    }
    
    systemPrompt += ` Return only the 4 sentences, one per line.`;

    const userPrompt = "Generate 4 funny sentences now.";

    // Call OpenAI
    const { content: rawResponse, model: usedModel } = await callOpenAI(systemPrompt, userPrompt);
    console.log('🎭 Raw AI Response:', rawResponse);

    // Parse and clean lines
    let lines = parseLines(rawResponse);
    console.log('🧹 Cleaned lines:', lines);

    // Apply rules enforcement if rules are loaded
    let enforcement: string[] = [];
    if (rules && rating) {
      const enforced = enforceRules(lines, rules, rating);
      lines = enforced.lines;
      enforcement = enforced.enforcement;
      if (enforcement.length > 0) {
        console.log('⚖️ Rules enforcement:', enforcement);
      }
    }

    // Take first 4 lines or pad if needed
    const finalLines = lines.slice(0, 4);
    
    if (finalLines.length < 4) {
      console.warn(`⚠️ Only generated ${finalLines.length} lines, expected 4`);
    }

    // Get length constraints for validation
    const minLength = rules?.length?.min_chars || 50;
    const maxLength = rules?.length?.max_chars || 120;

    // Format response with debug info and model information
    const response = {
      lines: finalLines.map((line, index) => ({
        line,
        length: line.length,
        index: index + 1,
        valid: line.length >= minLength && line.length <= maxLength
      })),
      model: usedModel,
      count: finalLines.length,
      rules_used: rules ? { id: rules.id, version: rules.version } : null,
      enforcement: enforcement.length > 0 ? enforcement : undefined
    };

    console.log(`✅ Generated ${response.lines.length} text options using model: ${usedModel}`);
    if (rules) {
      console.log(`📋 Applied rules: ${rules.id} v${rules.version}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate-text function:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error)?.message || 'Internal server error',
      debug: (error as Error)?.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});