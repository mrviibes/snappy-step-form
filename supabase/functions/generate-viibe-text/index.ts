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

// Enhanced validator to catch specific issues
function validateFourPack(lines: string[], insertWords: string[] = [], category: string = ""): boolean {
  const seenPositions = new Set<string>();
  const seenStructures = new Set<string>();
  const seenTopics = new Set<string>();

  // Extract category base word to avoid literal usage
  const categoryWords = category.toLowerCase().split(/[>\s]+/).map(w => w.trim()).filter(Boolean);
  const insertWordsLower = insertWords.map(w => w.toLowerCase());

  for (const line of lines) {
    // 1. Basic validation (length, em dash, punctuation) - made more lenient
    if (line.length < 30 || line.length > 150) return false;
    if (line.includes('—')) return false;
    
    const punctCount = (line.match(/[,.!?]/g) || []).length;
    if (punctCount > 5) return false;

    // 2. Insert words present if required - made more lenient
    if (insertWords.length > 0) {
      const hasAnyInsertWord = insertWords.some(word => 
        line.toLowerCase().includes(word.toLowerCase())
      );
      if (!hasAnyInsertWord) return false;
    }

    // 3. Check for fabricated personal details (ages, milestones)
    if (/turned?\s+\d+|just\s+turned|\d+\s+years?\s+old|\d+th\s+birthday/i.test(line)) {
      // Only allow if the number/age is in insert words
      const ageMatches = line.match(/\d+/g) || [];
      const hasValidAge = ageMatches.some(age => 
        insertWords.some(word => word.includes(age))
      );
      if (!hasValidAge) return false;
    }

    // 4. Check for literal category usage (unless in insert words)
    for (const categoryWord of categoryWords) {
      if (categoryWord.length > 3 && line.toLowerCase().includes(categoryWord)) {
        if (!insertWordsLower.some(iw => iw.includes(categoryWord))) {
          return false; // Using literal category word without it being in insert words
        }
      }
    }

    // 5. Track insert word placement
    if (insertWords.length > 0) {
      const pos = getInsertPos(line, insertWords[0]); // check first insert word
      seenPositions.add(pos);
    }

    // 6. Track joke structure
    const struct = classifyStructure(line);
    seenStructures.add(struct);

    // 7. Track topic words to prevent repetition
    const topic = extractTopicWord(line, insertWords);
    if (topic) {
      if (seenTopics.has(topic)) return false; // reject duplicate topics
      seenTopics.add(topic);
    }
  }

  // Ensure variety across the pack - made more lenient
  // Allow packs with less variety if we have good content
  if (lines.length >= 4) {
    // Only require variety for full packs, and be more lenient
    if (insertWords.length > 0 && seenPositions.size < 1) return false; // need at least 1 position
    if (seenStructures.size < 1) return false; // need at least 1 structure
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
- Include Insert Words naturally if provided; vary their placement (front, middle, end).
- Do not always start lines with Insert Words - mix up the positioning.
- No em dash (—). Use commas, periods, ellipses, or short sentences.
- Keep punctuation light; avoid stuffing marks.
- Do not use literal category words (e.g., "birthday", "wedding") unless they appear in Insert Words.
- Use category context for vibe/imagery, not literal repetition.
- Do not invent personal details like age, job, or milestones unless provided in Insert Words.
- Vary rhythm and structure; do not repeat the same shape in one set.
- Each line should focus on different topics/objects to avoid repetition.
- Output only the sentence. No explanations.
Nonce: ${nonce}`;

    const candidates = [];
    
    // Generate 12 candidates with enforced variety
    const candidateBatches = [];
    
    // Force different structure templates and topics for variety
    for (let batch = 0; batch < 3; batch++) {
      const batchCandidates = [];
      const usedStructures = [];
      const usedTopics = [];
      
      for (let i = 0; i < 4; i++) {
        const comedian = comedians[i % comedians.length];
        const structure = structures[i];
        const seedIndex = (batch * 4 + i) % seeds.length;
        const topicSeed = seeds[seedIndex];
        
        // Ensure different placement for insert words
        let placementHint = '';
        if (payload.insertWords && payload.insertWords.length > 0) {
          const placements = ['at the beginning', 'in the middle', 'at the end', 'naturally woven in'];
          placementHint = `Place "${payload.insertWords[0]}" ${placements[i % 4]}.`;
        }
        
        const userPrompt = `Category: ${payload.category}
Tone: ${payload.tone}
Style: ${payload.style}
Rating: ${payload.rating}
Insert Words: ${(payload.insertWords || []).join(', ')}
Comedian Style: ${comedian.name} – ${comedian.flavor}
Structure: ${structure} — follow this structure exactly.
Topic seed: ${topicSeed} (use this concept creatively, avoid category clichés)
${placementHint}

Important rules:
- DO NOT use literal category words unless they appear in Insert Words
- DO NOT invent personal details like ages, jobs, or milestones
- Focus on ${topicSeed} rather than obvious ${payload.category.split(' > ')[0]} references
- Make this structurally different from typical category humor
- Vary insert word placement - not always at the start`;

        try {
          const response = await callOpenAI(systemPrompt, userPrompt);
          const normalized = normalizeFirstLine(response);
          if (normalized) batchCandidates.push(normalized);
        } catch (error) {
          console.error(`Failed to generate candidate ${batch}-${i}:`, error);
        }
      }
      
      candidateBatches.push(batchCandidates);
    }
    
    // Flatten all candidates
    const allCandidates = candidateBatches.flat();
    console.log(`Generated ${allCandidates.length} raw candidates`);
    
    // Try to find valid 4-packs using the comprehensive validator
    let bestFourPack = [];
    let attempts = 0;
    const maxAttempts = 10;
    
    while (bestFourPack.length < 4 && attempts < maxAttempts) {
      // Try different combinations of candidates
      const shuffled = [...allCandidates].sort(() => 0.5 - Math.random());
      
      // Test groups of 4 candidates
      for (let i = 0; i <= shuffled.length - 4; i++) {
        const testGroup = shuffled.slice(i, i + 4);
        
        if (validateFourPack(testGroup, payload.insertWords || [], payload.category)) {
          bestFourPack = testGroup;
          break;
        }
      }
      
      attempts++;
      if (bestFourPack.length === 0 && attempts < maxAttempts) {
        // Generate more candidates if needed
        console.log(`Attempt ${attempts}: No valid 4-pack found, generating more candidates`);
        
        for (let i = 0; i < 4; i++) {
          const comedian = comedians[i % comedians.length];
          const structure = structures[i % structures.length];
          const topicSeed = seeds[i % seeds.length];
          
          const userPrompt = `Category: ${payload.category}
Tone: ${payload.tone}
Style: ${payload.style}
Rating: ${payload.rating}
Insert Words: ${(payload.insertWords || []).join(', ')}
Comedian Style: ${comedian.name} – ${comedian.flavor}
Structure: ${structure} — be very different from typical ${payload.category.split(' > ')[0]} jokes.
Topic: Focus on ${topicSeed}, avoid clichés.`;

          try {
            const response = await callOpenAI(systemPrompt, userPrompt);
            const normalized = normalizeFirstLine(response);
            if (normalized) allCandidates.push(normalized);
          } catch (error) {
            console.error(`Failed to generate additional candidate:`, error);
          }
        }
      }
    }
    
    console.log(`Found 4-pack after ${attempts} attempts: ${bestFourPack.length} candidates`);
    
    // Check uniqueness for the best 4-pack
    let final = bestFourPack;
    if (final.length === 4) {
      final = await checkUniqueness(final, payload.userId);
      console.log(`${final.length} candidates after uniqueness check`);
    }
    
    // If we don't have enough after uniqueness check, fill with simple fallbacks
    while (final.length < 4) {
      const fallbackIndex = 4 - final.length;
      const insertWord = payload.insertWords?.[0] || 'Life';
      const fallbacks = [
        `${insertWord} happened, and here we are.`,
        `Another day, another ${payload.category.split(' > ')[0].toLowerCase()}.`,
        `${insertWord} keeps it interesting, always.`,
        `Well, ${insertWord} certainly made an impression.`
      ];
      
      const fallback = fallbacks[fallbackIndex - 1];
      if (!final.includes(fallback)) {
        final.push(fallback);
      } else {
        final.push(`${insertWord} strikes again.`);
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