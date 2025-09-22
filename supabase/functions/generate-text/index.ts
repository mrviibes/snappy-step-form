// supabase/functions/generate-text/index.ts
// Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const CHAT_MODEL = Deno.env.get("VIBE_CHAT_MODEL") || "gpt-4o-mini";

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

    const { lines } = await generateFour(body);
    console.log("Generated lines:", lines);
    
    return json({ options: lines });
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

async function generateFour(p: any) {
  // Parse insert words from the request
  const insertWords = parseInsertWords(p.mandatory_words || '');
  const lines: string[] = [];
  let tries = 0;

  console.log("Generating with params:", {
    category: p.category,
    subcategory: p.subcategory,
    tone: p.tone,
    style: p.style,
    rating: p.rating,
    insertWords
  });

  while (lines.length < 4 && tries < 12) {
    try {
      const sentence = await generateOneLine(p, insertWords);
      const clean = enforceRules(sentence, insertWords, p.rating);
      if (clean && !lines.includes(clean)) {
        lines.push(clean);
        console.log(`Generated line ${lines.length}:`, clean);
      } else {
        console.log("Rejected line:", { sentence, clean, reason: !clean ? 'failed validation' : 'duplicate' });
      }
    } catch (e) {
      console.error(`Generation attempt ${tries + 1} failed:`, e);
    }
    tries++;
  }

  // Pad with fallbacks if needed
  const fallbacks = [
    "Celebrating wildly, because the cake said so and we listened.",
    "Today deserves chaos, confetti, and questionable dance moves.",
    "Making memories that sparkle brighter than your worst decisions.",
    "Here's to another year of magnificent disasters and cake victories."
  ];

  while (lines.length < 4 && fallbacks.length > 0) {
    const fallback = fallbacks.shift()!;
    if (!lines.includes(fallback)) {
      lines.push(fallback);
      console.log("Added fallback:", fallback);
    }
  }

  return { lines };
}

function parseInsertWords(input: string): string[] {
  if (!input?.trim()) return [];
  
  // Handle both simple comma-separated and structured input
  if (input.includes(':') || input.includes('[')) {
    // Try to extract simple words from structured input
    const words: string[] = [];
    const nameMatch = input.match(/name:\s*([^,\n]+)/i);
    if (nameMatch) words.push(nameMatch[1].trim());
    
    const allMatch = input.match(/all:\s*\[([^\]]+)\]/i);
    if (allMatch) {
      const allWords = allMatch[1].split(',').map(w => w.trim().replace(/['"]/g, ''));
      words.push(...allWords);
    }
    
    return words.filter(Boolean);
  }
  
  // Simple comma-separated
  return input.split(',').map(w => w.trim()).filter(Boolean);
}

function buildSystemPrompt(p: any, nonce: string): string {
  const comedianHints = [
    "Richard Pryor – raw confessional",
    "George Carlin – sharp satirical", 
    "Joan Rivers – biting roast",
    "Bill Burr – ranting cynicism",
    "Ali Wong – raunchy candor",
    "Sarah Silverman – deadpan taboo",
    "Mitch Hedberg – surreal one-liners",
    "Steven Wright – ultra-dry absurd"
  ];
  
  const randomComedian = comedianHints[Math.floor(Math.random() * comedianHints.length)];
  
  return `You write one-liner jokes for a celebration generator.

HARD RULES:
- Exactly ONE sentence only
- 60–120 characters total
- No em dash (—)
- End with . ! or ?
- Include insert words NATURALLY if provided

CONTEXT:
- Category: ${p.category || "celebrations"}${p.subcategory ? ` > ${p.subcategory}` : ""}
- Tone: ${p.tone || "Humorous"} (be genuinely ${p.tone})
- Style: ${p.style || "Generic"} ${getStyleHint(p.style)}
- Rating: ${p.rating || "PG"} ${getRatingHint(p.rating)}
- Insert words: ${parseInsertWords(p.mandatory_words || '').join(', ') || 'none'}
- Comedian flavor: ${randomComedian}

Output ONLY the sentence. No quotes, no explanation.
Nonce: ${nonce}`;
}

function getStyleHint(style: string): string {
  const hints = {
    'weird': '(absurd, surreal, unexpected comparisons)',
    'sarcastic': '(dry wit, ironic bite, eye-rolling)',
    'wholesome': '(heartwarming, kind, positive)',
    'savage': '(brutally honest, cutting, no-holds-barred)',
    'generic': '(straightforward celebration language)'
  };
  return hints[style?.toLowerCase()] || '';
}

function getRatingHint(rating: string): string {
  const hints = {
    'g': '(completely clean, family-friendly)',
    'pg': '(mild humor, very light language)',
    'pg-13': '(moderate adult humor, light profanity allowed)',
    'r': '(explicit humor allowed, strong language, adult themes)'
  };
  return hints[rating?.toLowerCase()] || '';
}

function buildUserPrompt(p: any): string {
  const styleExamples = {
    'weird': [
      "The cake blinked first, which is rude but also impressive.",
      "Confetti whispers secrets only the balloons can hear today."
    ],
    'sarcastic': [
      "Another birthday, same human, bigger frosting to hide evidence.",
      "Make a wish; the candles are judging your life choices anyway."
    ],
    'wholesome': [
      "May today be gentle, bright, and full of laughing crumbs.",
      "You're loved loudly, even when the candles whisper softly."
    ],
    'savage': [
      "Another year closer to death, but at least there's cake.",
      "Congrats on surviving another trip around the sun, barely."
    ],
    'generic': [
      "Let the cake be loud and the smiles be even louder.",
      "May joy arrive early and stay well past midnight tonight."
    ]
  };
  
  const examples = styleExamples[p.style?.toLowerCase()] || styleExamples.generic;
  const sample = examples[Math.floor(Math.random() * examples.length)];
  
  return `Write one new line in this style:

Example: "${sample}"

Remember: one sentence, 60–120 chars, no em dash, include insert words naturally if given.`;
}

async function generateOneLine(p: any, insertWords: string[]): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const nonce = Math.random().toString(36).slice(2);

  try {
    const payload = {
      model: CHAT_MODEL,
      temperature: 0.95,  // High creativity
      top_p: 0.9,         // Good diversity
      max_tokens: 120,
      messages: [
        { role: "system", content: buildSystemPrompt(p, nonce) },
        { role: "user", content: buildUserPrompt(p) }
      ]
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`openai_${response.status}_${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return (data?.choices?.[0]?.message?.content || "").trim();
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      throw new Error("timeout_or_network_error");
    }
    throw e;
  }
}

function enforceRules(s: string, insertWords: string[], rating: string = 'PG'): string | null {
  if (!s) return null;
  
  // Take first non-empty line if model misbehaves
  s = s.split(/\r?\n/).map(x => x.trim()).find(Boolean) || "";
  
  // Strip quotes/bullets/numbering
  s = s.replace(/^["'`]/, "").replace(/["'`]$/, "")
       .replace(/^[•*\-]\s*/, "").replace(/^\d+[\.)]\s*/, "");
  
  const len = [...s].length;
  if (len < 60 || len > 120) return null;
  if (/\u2014/.test(s)) return null; // no em dash
  
  // Check insert words are included
  const hasAllWords = insertWords.every(word => 
    new RegExp(`\\b${escapeRegex(word)}\\b`, "i").test(s)
  );
  if (!hasAllWords) return null;
  
  // Rating-based profanity filtering
  const mild = /\b(hell|damn|crap)\b/i.test(s);
  const explicit = /\b(fuck|shit|asshole|bastard|bitch)\b/i.test(s);
  
  if (rating?.toLowerCase() === "g" && (mild || explicit)) return null;
  if (rating?.toLowerCase() === "pg" && explicit) return null;
  // PG-13 allows mild, R allows explicit
  
  // Ensure proper punctuation
  if (!/[.!?]$/.test(s)) s += ".";
  
  return s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}