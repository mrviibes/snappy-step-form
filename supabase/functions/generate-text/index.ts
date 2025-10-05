// supabase/functions/generate-text/index.ts
// Lean Step-2 generator: one small call + a tiny hedge, movie-style ratings, category hints,
// insert-word policy, no em-dashes, humor priority.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const API = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5-mini";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Types ----------
type Tone = "humorous"|"savage"|"sentimental"|"nostalgic"|"romantic"|"inspirational"|"playful"|"serious";
type Rating = "G"|"PG"|"PG-13"|"R";

// ---------- Tone/Rating hints ----------
const TONE_HINT: Record<Tone,string> = {
  humorous:"funny, witty, punchy",
  savage:"blunt, cutting, roast-style",
  sentimental:"warm, affectionate, heartfelt",
  nostalgic:"reflective, lightly playful",
  romantic:"affectionate, charming",
  inspirational:"uplifting, bold",
  playful:"silly, cheeky, fun",
  serious:"direct, weighty, minimal humor"
};
const RATING_HINT: Record<Rating,string> = {
  G:"Pixar-clean; no profanity; no sexual terms; no drugs",
  PG:"Shrek-clean; mild language only (hell/damn); no sex mentions; no drugs",
  "PG-13":"Marvel/Friends; edgy ok; alcohol+cannabis ok; NO f-bomb",
  R:"Hangover/Superbad; strong profanity allowed; non-graphic adult themes; no slurs; no illegal how-to"
};

// ---------- Category adapter ----------
type Category = "celebrations"|"daily-life"|"sports"|"pop-culture"|"jokes"|"miscellaneous";
const CATEGORY_HINT: Record<Category,string> = {
  "celebrations":"Focus on the person and the moment; party energy, cake, friends; clear occasion.",
  "daily-life":"Relatable micro-moments: routines, coffee/work/phone logic; small wins & annoyances.",
  "sports":"Competition, effort, rivalry, fan energy; strong action verbs; scoreboard truth.",
  "pop-culture":"One anchor from the selected title/trend; paraphrase short quotes; no long quotes.",
  "jokes":"Actual one-line jokes; setup then twist in the same sentence; no meta about jokes.",
  "miscellaneous":"Universal observation with one vivid detail and a clean turn."
};

function jokesFormatHint(subcat: string): string {
  const s = (subcat || "").toLowerCase();
  if (s.includes("puns"))   return "Direct wordplay on the topic; do not say 'this is a pun'.";
  if (s.includes("knock"))  return "One-line knock-knock essence without call-and-response.";
  if (s.includes("riddle")) return "Pose the question then answer in the same sentence, short & clever.";
  if (s.includes("dad"))    return "Corny but clean; groan-worthy with a tidy turn.";
  return "One-line joke. Setup then twist. No meta about setups or punchlines.";
}

// ---------- Humor priority ----------
function humorPriority(tone: Tone, rating: Rating) {
  const safeTones = new Set(["sentimental","serious","romantic"]);
  const gentle = new Set(["G","PG"]);
  const mostlyFunny = !(safeTones.has(tone) && gentle.has(rating));
  return mostlyFunny
    ? "Humor priority: ~90% lines must be hilarious, witty, or sharply funny. Use contrast, misdirection, or absurd logic. Keep it natural, not forced."
    : "Gentle/wholesome tone. A light smile or clever turn is fine, but no overt jokes.";
}

// ---------- Build system prompt ----------
function buildSystem(
  tone: Tone,
  rating: Rating,
  category: string,
  subcategory: string,
  topic: string,
  inserts: string[]
) {
  const catKey = (category || "miscellaneous").toLowerCase() as Category;
  const catHint = CATEGORY_HINT[catKey] || CATEGORY_HINT["miscellaneous"];
  const jokesHint = catKey === "jokes" ? jokesFormatHint(subcategory) : "";

  const birthdayNudge =
    /celebrations/i.test(category) && /birthday/i.test(subcategory || topic)
      ? "Include the word 'birthday' once somewhere in the set."
      : "";

  const insertsHint = inserts.length
    ? `INSERT WORDS POLICY
- Provided words: ${inserts.join(", ")}
- If a single word, include it once in EVERY line.
- If multiple, include each at least once across the 4 lines.
- Vary position (start/middle/end). Do not start all lines with it.
- Natural forms allowed (possessive/plural).`
    : "";

  return [
    "GOAL\nWrite 4 original, punchy on-image captions.",
    "FORMAT\n- Exactly 4 lines\n- Each 28–120 chars\n- Each ends with . ! or ?\n- Return ONLY JSON: { \"lines\": [\"...\",\"...\",\"...\",\"...\"] }",
    "STYLE\n- Human cadence, quick twist, one idea per line\n- One concrete visual detail per line\n- Vary rhythm; avoid repetitive openings\n- No emojis, hashtags, ellipses, or meta\n- Never use em-dashes (— or –); use commas or periods instead",
    `TONE: ${TONE_HINT[tone]}`,
    `RATING (movie-style): ${RATING_HINT[rating]}`,
    humorPriority(tone, rating),
    `CATEGORY: ${category}  |  SUBCATEGORY: ${subcategory}`,
    `CATEGORY HINT: ${catHint}`,
    jokesHint,
    birthdayNudge,
    insertsHint,
    `TOPIC/CONTEXT: ${topic}`
  ].filter(Boolean).join("\n\n");
}

// ---------- JSON parsing helpers ----------
function parseJsonBlock(s?: string|null) {
  if (!s) return null;
  const t = s.trim().replace(/^```json\s*|\s*```$/g,"").trim();
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a !== -1 && b > a) { try { return JSON.parse(t.slice(a,b+1)); } catch {} }
  return null;
}
function pickLinesFromChat(data: any): string[] | null {
  const ch = Array.isArray(data?.choices) ? data.choices[0] : null;
  const msg = ch?.message;
  if (msg?.parsed && Array.isArray(msg.parsed.lines)) return msg.parsed.lines;  // structured outputs
  if (typeof msg?.content === "string") {
    const obj = parseJsonBlock(msg.content);
    if (obj?.lines && Array.isArray(obj.lines)) return obj.lines;
  }
  const tcs = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
  for (const tc of tcs) {
    const obj = parseJsonBlock(tc?.function?.arguments);
    if (obj?.lines && Array.isArray(obj.lines)) return obj.lines;
  }
  return null;
}

// ---------- One small call (abort @22s) ----------
async function chatOnce(system: string, userObj: unknown, maxTokens = 256, abortMs = 22000) {
  const schema = {
    name: "ViibeTextV1",
    strict: true,
    schema: {
      type:"object",
      additionalProperties:false,
      required:["lines"],
      properties:{ lines:{
        type:"array", minItems:4, maxItems:4,
        items:{ type:"string", minLength:28, maxLength:120, pattern:"[.!?]$" }
      }}
    }
  };
  const body = {
    model: MODEL,
    messages: [
      { role:"system", content: system },
      { role:"user",   content: JSON.stringify(userObj) }
    ],
    response_format: { type:"json_schema", json_schema: schema },
    max_completion_tokens: maxTokens
  };

  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort("timeout"), abortMs);
  try {
    const r = await fetch(API, {
      method:"POST",
      headers:{ "Authorization":`Bearer ${OPENAI_API_KEY}`, "Content-Type":"application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal
    });
    const raw = await r.text();
    if (r.status === 402) throw new Error("Payment required or credits exhausted");
    if (r.status === 429) throw new Error("Rate limited, try again");
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${raw.slice(0,600)}`);
    const data = JSON.parse(raw);
    const lines = pickLinesFromChat(data);
    if (lines && lines.length===4) return lines;
    const reason = data?.choices?.[0]?.message?.refusal
      || data?.incomplete_details?.reason
      || data?.choices?.[0]?.finish_reason;
    if (reason) throw new Error(String(reason));
    throw new Error("no_lines");
  } finally { clearTimeout(timer); }
}

// ---------- Insert-word safety check ----------
function validateInsertWords(lines: string[], inserts: string[]): boolean {
  if (!inserts.length) return true;
  
  const allText = lines.join(" ").toLowerCase();
  
  if (inserts.length === 1) {
    // Single word must appear in ALL lines
    const word = inserts[0].toLowerCase();
    return lines.every(line => {
      const text = line.toLowerCase();
      // Check for word and common variants (plural, possessive)
      return text.includes(word) || 
             text.includes(word + "s") || 
             text.includes(word + "'s");
    });
  } else {
    // Multiple words: each must appear at least once across all lines
    return inserts.every(word => {
      const w = word.toLowerCase();
      return allText.includes(w) || 
             allText.includes(w + "s") || 
             allText.includes(w + "'s");
    });
  }
}

// ---------- Last-resort fallback (can't fail) ----------
function synth(topic: string, tone: Tone, inserts: string[]): string[] {
  const base = tone==="savage" ? "sharp" : tone==="sentimental" ? "warm" : "witty";
  const t = topic || "the moment";
  const name = inserts.length ? inserts[0] : "";
  const s = (x:string)=> x.replace(/[\u2013\u2014]/g, ",").trim().replace(/\s+/g," ")
                          .replace(/([^.?!])$/,"$1.");
  
  if (name) {
    // Include name in all lines if single insert word
    if (inserts.length === 1) {
      return [
        s(`${name}: ${base} and memorable about ${t}.`),
        s(`${name}, say less, laugh more.`),
        s(`${name} makes ${t} interesting.`),
        s(`Keep it punchy, ${name}.`)
      ];
    }
    // Multiple insert words
    return [
      s(`${name}: ${base} and memorable.`),
      s(`Say less about ${inserts.slice(1).join(", ")}.`),
      s(`${t}, but actually interesting.`),
      s(`Keep it punchy, keep it human.`)
    ];
  }
  
  return [
    s(`${t}: ${base} and memorable.`),
    s(`Say less, laugh more about ${t}.`),
    s(`${t}, but actually interesting.`),
    s(`Keep it punchy, keep it human on ${t}.`)
  ];
}

// ---------- HTTP handler ----------
serve(async (req) => {
  if (req.method==="OPTIONS") return new Response(null,{headers:cors});
  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const b = await req.json();
    const category = String(b.category||"").trim();
    const subcat   = String(b.subcategory||"").trim();
    const theme    = String(b.theme||"").trim();
    const tone     = (b.tone||"humorous") as Tone;
    const rating   = (b.rating||"PG") as Rating;
    const inserts  = Array.isArray(b.insertWords) ? b.insertWords.filter(Boolean).slice(0,2) : [];
    const topic    = theme || subcat || category || "topic";

    console.log(`[generate-text] Request: ${category}/${subcat}, tone:${tone}, rating:${rating}, inserts:${inserts.join(",")}`);

    const SYSTEM = buildSystem(tone, rating, category, subcat, topic, inserts);
    const userPayload = { tone, rating, category, subcategory: subcat, topic, insertWords: inserts };

    // Hedge: main call now; after 2s start a second with a slightly bigger cap.
    const main = chatOnce(SYSTEM, userPayload, 256, 22000);
    const hedge = new Promise<string[]>(resolve=>{
      setTimeout(async()=>{
        try { resolve(await chatOnce(SYSTEM, userPayload, 320, 22000)); }
        catch { /* ignore; main may succeed */ }
      }, 2000);
    });

    let lines = await Promise.race([main, hedge]) as string[] | undefined;
    
    // Em-dash cleanup + trim
    if (lines) {
      lines = lines.map(l =>
        l.replace(/[\u2013\u2014]/g, ",").replace(/\s+/g," ").trim()
      );
      
      // Insert-word safety check
      if (!validateInsertWords(lines, inserts)) {
        console.log(`⚠️ Insert-word validation failed, using synth fallback`);
        lines = synth(topic, tone, inserts);
      }
    } else {
      console.log(`⚠️ No lines from AI, using synth fallback`);
      lines = synth(topic, tone, inserts);
    }

    console.log(`✅ Returning ${lines.length} lines`);

    return new Response(JSON.stringify({ success:true, options: lines.slice(0,4), model: MODEL }), {
      headers:{...cors,"Content-Type":"application/json"}
    });
  } catch (err) {
    console.error(`❌ Error:`, err);
    // Never 502 — always return JSON the UI can show
    return new Response(JSON.stringify({ success:false, error:String(err) }), {
      status:200, headers:{...cors,"Content-Type":"application/json"}
    });
  }
});
