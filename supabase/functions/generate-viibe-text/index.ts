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

// Topic seeds to avoid clichés
const TOPIC_SEEDS = [
  "neighbors", "Wi-Fi", "thermostat", "raccoons", "parking meter",
  "elevator", "leaf blower", "night shift", "robot vacuum", "playlist",
  "leftovers", "inbox", "lawn flamingo", "group chat", "souvenir mug",
  "houseplant", "delivery driver", "smoke alarm", "self-checkout", "weather app"
];

// Category-specific ban lists (clichés to avoid unless in insert words)
const CATEGORY_BAN_LISTS = {
  birthday: ["cake", "candles", "party", "celebrate", "wish", "blow", "frosting"],
  wedding: ["dress", "rings", "altar", "vows", "forever", "dance", "bouquet"],
  sports: ["winner", "champion", "team", "victory", "score", "game", "field"],
  cooking: ["recipe", "ingredients", "delicious", "taste", "flavor", "kitchen"],
  technology: ["computer", "internet", "digital", "online", "click", "download"]
};

// Comedian styles with flavors
const COMEDIAN_STYLES = [
  { name: "Seinfeld", flavor: "observational, everyday absurdity" },
  { name: "Carlin", flavor: "cynical, wordplay master" },
  { name: "Wright", flavor: "deadpan, surreal one-liners" },
  { name: "Hedberg", flavor: "absurd, stream of consciousness" },
  { name: "Rivers", flavor: "self-deprecating, sharp wit" },
  { name: "Mulaney", flavor: "storytelling, relatable chaos" }
];

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15);
}

function pickRandomSeeds(count: number): string[] {
  const shuffled = [...TOPIC_SEEDS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function pickStructureTemplates(count: number): string[] {
  const templates = Object.keys(STRUCTURE_TEMPLATES);
  const shuffled = [...templates].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function pickComedians(count: number): any[] {
  const shuffled = [...COMEDIAN_STYLES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getBanList(category: string): string[] {
  const categoryKey = category.toLowerCase().split(' > ')[0];
  return CATEGORY_BAN_LISTS[categoryKey] || [];
}

function validateLine(line: string, payload: any): boolean {
  // Length check
  if (line.length < 50 || line.length > 120) return false;
  
  // No em dash
  if (line.includes('—')) return false;
  
  // Punctuation density check (max 3)
  const punctCount = (line.match(/[.,!?;:]/g) || []).length;
  if (punctCount > 3) return false;
  
  // Insert words check
  if (payload.insertWords && payload.insertWords.length > 0) {
    const hasAnyInsertWord = payload.insertWords.some(word => 
      line.toLowerCase().includes(word.toLowerCase())
    );
    if (!hasAnyInsertWord) return false;
  }
  
  // Ban list check (only if words aren't in insert words)
  const banList = getBanList(payload.category);
  const insertWordsLower = (payload.insertWords || []).map(w => w.toLowerCase());
  
  for (const bannedWord of banList) {
    if (line.toLowerCase().includes(bannedWord) && 
        !insertWordsLower.includes(bannedWord)) {
      return false;
    }
  }
  
  return true;
}

function normalizeFirstLine(text: string): string {
  return text.split('\n')[0].trim().replace(/^["']|["']$/g, '');
}

function generateHash(text: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  });
}

async function checkUniqueness(candidates: string[], userId?: string) {
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
  const positions = { front: [], middle: [], end: [] };
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const wordIndex = lowerLine.indexOf(firstWord);
    
    if (wordIndex === -1) continue;
    
    const position = wordIndex < line.length * 0.3 ? 'front' :
                    wordIndex > line.length * 0.7 ? 'end' : 'middle';
    
    positions[position].push(line);
  }
  
  // Try to get one from each position
  const result = [];
  ['front', 'middle', 'end'].forEach(pos => {
    if (positions[pos].length > 0) {
      result.push(positions[pos][0]);
    }
  });
  
  // Fill remaining slots
  const remaining = lines.filter(line => !result.includes(line));
  while (result.length < 4 && remaining.length > 0) {
    result.push(remaining.shift());
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Generation request:', payload);
    
    const nonce = generateNonce();
    const seeds = pickRandomSeeds(2);
    const structures = pickStructureTemplates(4);
    const comedians = pickComedians(4);
    
    const systemPrompt = `You write stand-up style one-liners.

Constraints:
- Exactly ONE sentence, 50–120 characters.
- Include Insert Words naturally if provided; they need not be adjacent.
- No em dash (—). Use commas, periods, ellipses, or short sentences.
- Keep punctuation light; avoid stuffing marks.
- Avoid category clichés unless Insert Words require them.
- Vary rhythm and structure; do not repeat the same shape in one set.
- Output only the sentence. No explanations.
Nonce: ${nonce}`;

    const candidates = [];
    
    // Generate 12 candidates with variety
    for (let i = 0; i < 12; i++) {
      const comedian = comedians[i % comedians.length];
      const structure = structures[i % structures.length];
      const seed1 = seeds[0];
      const seed2 = seeds[1];
      
      const userPrompt = `Category: ${payload.category}
Tone: ${payload.tone}
Style: ${payload.style}
Rating: ${payload.rating}
Insert Words: ${(payload.insertWords || []).join(', ')}
Comedian Style: ${comedian.name} – ${comedian.flavor}
Structure: ${structure} — follow its vibe.
Topic seeds: ${seed1}, ${seed2} (optional; do not overuse)`;

      try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        const normalized = normalizeFirstLine(response);
        if (normalized) candidates.push(normalized);
      } catch (error) {
        console.error(`Failed to generate candidate ${i}:`, error);
      }
    }
    
    console.log(`Generated ${candidates.length} raw candidates`);
    
    // Validate candidates
    const validated = candidates.filter(line => validateLine(line, payload));
    console.log(`${validated.length} candidates passed validation`);
    
    // Remove duplicates within this batch
    const uniqueLocal = [...new Set(validated)];
    console.log(`${uniqueLocal.length} candidates after local dedup`);
    
    // Check against history
    const uniqueGlobal = await checkUniqueness(uniqueLocal, payload.userId);
    console.log(`${uniqueGlobal.length} candidates after uniqueness check`);
    
    // Ensure placement spread and pick 4
    let final = ensurePlacementSpread(uniqueGlobal, payload.insertWords || []);
    
    // If we don't have enough, fill with fallbacks
    while (final.length < 4) {
      const fallback = `${payload.insertWords?.[0] || 'Life'} happened, and here we are.`;
      if (!final.includes(fallback)) {
        final.push(fallback);
      } else {
        final.push(`Another day, another ${payload.category.split(' > ')[0].toLowerCase()}.`);
        break;
      }
    }
    
    final = final.slice(0, 4);
    
    // Save to history
    await saveToHistory(final, payload);
    
    console.log('Final generated lines:', final);
    
    return new Response(JSON.stringify({ options: final }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in generate-viibe-text function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});