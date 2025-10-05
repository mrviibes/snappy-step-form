// supabase/functions/generate-text/index.ts
// Stable + Optimized Viibe Text Generator
// Adds POV detection, comedy style rotation, comedian rhythm, and punctuation cleanup.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const API = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

// ---------- Tuning Constants ----------
const TIMEOUT_MS = 18000;      // Main timeout (18s, well under Supabase 60s limit)
const MAIN_TOKENS = 900;        // Initial call token limit
const HEDGE_TOKENS = 1200;      // Hedge/retry token limit
const HEDGE_DELAY_MS = 1500;    // Delay before starting hedge call

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- Types ----------
type Tone =
  | "humorous" | "savage" | "sentimental" | "nostalgic"
  | "romantic" | "inspirational" | "playful" | "serious";
type Rating = "G" | "PG" | "PG-13" | "R";

// ---------- Tone / Rating ----------
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
  G:"Pixar clean, no profanity or adult topics.",
  PG:"Shrek clever, mild words like hell or damn only.",
  "PG-13":"Marvel witty, moderate swearing ok (shit, ass, hell). No F-bombs.",
  R:"Hangover raw, strong profanity allowed (fuck, shit, asshole). Non-graphic adult themes, no slurs."
};

// ---------- Category Hints ----------
const CATEGORY_HINT: Record<string,string> = {
  celebrations:"Party chaos, cake, people being dramatic. Focus on personality and timing.",
  "daily-life":"Relatable small struggles; caffeine, alarms, habits, moods.",
  sports:"Competition, energy, mistakes that build character.",
  "pop-culture":"One anchor from a show, movie, or trend; make it snappy.",
  jokes:"Setup, twist, done. Avoid meta talk about jokes.",
  miscellaneous:"Observational with one vivid detail that lands a thought."
};

// ---------- Comedy style rotation ----------
const COMEDY_STYLES = [
  "Observational humor using everyday irony.",
  "Roast-style humor, sharp but playful.",
  "Surreal humor with strange logic that still makes sense.",
  "Warm, kind humor that still lands a laugh."
];

// ---------- POV Detection ----------
function povHint(inserts: string[]): string {
  if (!inserts?.length) return "Speak directly to the reader using 'you'.";
  if (inserts.includes("I") || inserts.includes("me"))
    return "Write from first person using 'I'.";
  if (inserts.some(w => /^[A-Z]/.test(w)))
    return `Write about ${inserts.join(" and ")} in third person.`;
  return `Write about ${inserts.join(" and ")} as descriptive subjects.`;
}

// ---------- Build system prompt ----------
function buildSystem(
  tone: Tone, rating: Rating,
  category: string, subcategory: string,
  topic: string, inserts: string[]
) {
  const toneWord = TONE_HINT[tone] || "witty";
  const ratingGate = RATING_HINT[rating] || "";
  const insertRule =
    inserts.length === 1
      ? `Include "${inserts[0]}" once in every line, natural placement ok.`
      : inserts.length > 1
      ? `Include each of these at least once across the set: ${inserts.join(", ")}.`
      : "";
  const pov = povHint(inserts);
  const style = COMEDY_STYLES[Math.floor(Math.random() * COMEDY_STYLES.length)];
  const catVoice = CATEGORY_HINT[category] || "";

  // --- new: savage-specific rule ---
  const savageRule =
    tone === "savage"
      ? "Roast the subject or reader with sharp, playful sarcasm. Use attitude, mild profanity if needed (shit, hell, ass). Be honest, not cruel."
      : "";

  return `
Write 4 one-liners for ${category}/${subcategory}. Topic: ${topic}.
Tone: ${toneWord}. Rating: ${ratingGate}.
${insertRule}
${pov}
Comedy style: ${style}
${catVoice}
${savageRule}
Use setup, pivot, and tag like a live comedian. Vary sentence openings so not all lines start the same.
Each line: 75–125 characters, ends with punctuation. Write naturally, not clipped.
If lines are too short, expand them with imagery or emotion.
Do not repeat the topic word in every line. Write like clever card text or a one-liner caption people would actually print.
Avoid ad-style phrasing; sound like a human telling a joke or observation.
No emojis, hashtags, ellipses, colons, semicolons, or em-dashes. Use commas or periods only.
`.trim();
}

// ---------- Robust line extractor ----------
function extractFourLines(content: string): string[] {
  const clean = (l: string) => 
    l.replace(/[\u2013\u2014]/g, ",")
     .replace(/[:;]+/g, ",")
     .replace(/\s+/g, " ")
     .trim();

  // Strategy 1: Primary - split by newlines, accept 40-140 chars
  let lines = content
    .split(/\r?\n+/)
    .map(clean)
    .filter(l => l.length >= 40 && l.length <= 140)
    .slice(0, 4);
  
  if (lines.length === 4) return lines;

  // Strategy 2: Bullets/numbers - split on "1)", "2.", "- ", etc.
  const bulletPattern = /(?:^\s*|\n\s*)(?:\d+[\.)]\s*|[-•]\s*)/;
  if (bulletPattern.test(content)) {
    lines = content
      .split(bulletPattern)
      .map(clean)
      .filter(l => l.length >= 40 && l.length <= 140)
      .slice(0, 4);
    
    if (lines.length === 4) return lines;
  }

  // Strategy 3: Sentence fallback - split on ". " and rejoin
  const sentences = content
    .split(/\.\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  lines = [];
  for (const sent of sentences) {
    const cleaned = clean(sent);
    if (cleaned.length >= 40 && cleaned.length <= 140) {
      lines.push(cleaned);
      if (lines.length === 4) break;
    }
  }

  return lines;
}

// ---------- Reformat helper ----------
async function reformatToFourLines(raw: string): Promise<string[] | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort("timeout"), 15000);

  try {
    console.log("[generate-text] attempting reformat of raw output");
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { 
            role: "system", 
            content: "Rewrite the given text into exactly 4 one-liners. Each line: 60-120 characters, one per line, no emojis/hashtags/colons/semicolons/em-dashes. End each with punctuation (. ! ?)."
          },
          { role: "user", content: raw }
        ],
        max_tokens: 300,
      }),
      signal: ctl.signal,
    });
    
    const responseText = await r.text();
    if (!r.ok) {
      console.warn("[generate-text] reformat failed:", r.status);
      return null;
    }

    const data = JSON.parse(responseText);
    const content = data?.choices?.[0]?.message?.content || "";
    const lines = extractFourLines(content);
    
    console.log("[generate-text] reformat yielded:", lines.length, "lines");
    return lines.length === 4 ? lines : null;
  } catch (err) {
    console.warn("[generate-text] reformat error:", String(err));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- OpenAI call ----------
async function chatOnce(
  system: string, userObj: any,
  maxTokens = 550, abortMs = TIMEOUT_MS
): Promise<{ ok: boolean; lines?: string[]; reason?: string; raw?: string }> {

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort("timeout"), abortMs);

  try {
    console.log("[generate-text] sending request to AI gateway…");
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userObj) },
        ],
        max_tokens: maxTokens,
      }),
      signal: ctl.signal,
    });
    const raw = await r.text();
    console.log("[generate-text] status:", r.status, "response length:", raw.length, "chars");
    if (!r.ok) throw new Error(`AI gateway ${r.status}: ${raw.slice(0,400)}`);
    const data = JSON.parse(raw);
    const finish = data?.choices?.[0]?.finish_reason || "n/a";
    console.log("[generate-text] finish_reason:", finish);

    const content = data?.choices?.[0]?.message?.content || "";
    
    // Try strict parse first (50-130 chars)
    const strictLines = content
      .split(/\r?\n+/)
      .map((l:string)=>l.replace(/[\u2013\u2014]/g,",").replace(/[:;]+/g,",").replace(/\s+/g," ").trim())
      .filter((l:string)=>l.length>=50 && l.length<=130)
      .slice(0,4);
    
    if (strictLines.length === 4) {
      console.log("[generate-text] strict parse: 4 lines ✓");
      return { ok: true, lines: strictLines };
    }

    // Try relaxed extraction
    const relaxedLines = extractFourLines(content);
    if (relaxedLines.length === 4) {
      console.log("[generate-text] relaxed parse: 4 lines ✓");
      return { ok: true, lines: relaxedLines };
    }

    console.log("[generate-text] parsing failed, returning raw for reformat");
    return { ok: false, reason: finish, raw: content };
  } catch (err) {
    if (err.name === 'AbortError' || err === 'timeout') {
      console.warn(`[generate-text] AI call aborted after ${abortMs}ms`);
      return { ok: false, reason: "timeout" };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Fallback ----------
function synth(topic:string,tone:Tone,inserts:string[]=[]){
  const set = [
    "Love wins again and the catering survived.",
    "Two rings, one group chat forever changed.",
    "The champagne’s judging no one tonight.",
    "Here’s to promises that age better than haircuts."
  ];
  return set.map(l => l.trim().replace(/([^.?!])$/, "$1"));
}

// ---------- HTTP handler ----------
serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  try{
    if(!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const b=await req.json();
    const category=String(b.category||"").trim();
    const subcat=String(b.subcategory||"").trim();
    const theme=String(b.theme||"").trim();
    const tone=(b.tone||"humorous") as Tone;
    const rating=(b.rating||"PG") as Rating;
    const inserts=Array.isArray(b.insertWords)?b.insertWords.filter(Boolean).slice(0,2):[];
    const topic=(theme||subcat||category||"topic").replace(/[-_]/g," ").trim();

    const SYSTEM=buildSystem(tone,rating,category,subcat,topic,inserts);
    const payload={tone,rating,category,subcategory:subcat,topic,insertWords:inserts};

    function invalidSet(ls:string[]){
      return !Array.isArray(ls)||ls.length<4||ls.some(l=>l.length<50||l.length>130||!/[.!?]$/.test(l));
    }

    const main=chatOnce(SYSTEM,payload,MAIN_TOKENS,TIMEOUT_MS);
    const hedge=new Promise<{ok:boolean;lines?:string[];reason?:string}>(resolve=>{
      setTimeout(async()=>{
        try{resolve(await chatOnce(SYSTEM,payload,HEDGE_TOKENS,TIMEOUT_MS + 5000));}
        catch{resolve({ok:false,reason:"hedge_failed"});}
      },HEDGE_DELAY_MS);
    });

    let winner:any=await Promise.race([main,hedge]);
    if(!winner.ok){
      const other=(winner===(await main))?await hedge:await main;
      winner=other.ok?other:winner;
    }

    let lines:string[],source="model",fallbackReason="";
    
    if(winner.ok&&winner.lines) {
      lines=winner.lines;
      console.log("[generate-text] chosen_source: primary_model");
    } else if (winner.raw) {
      // Try reformat if we have raw content
      console.log("[generate-text] attempting reformat on winner.raw");
      const reformatted = await reformatToFourLines(winner.raw);
      if (reformatted && reformatted.length === 4) {
        lines = reformatted;
        source = "model";
        console.log("[generate-text] chosen_source: reformatted");
      } else {
        // Fallback to strict retry
        const STRICT=SYSTEM+"\nSTRICT: Each line must be 75–125 chars with clear wordplay and a twist.";
        const retry=await chatOnce(STRICT,payload,HEDGE_TOKENS,TIMEOUT_MS + 5000);
        if(retry.ok&&retry.lines) {
          lines=retry.lines;
          console.log("[generate-text] chosen_source: strict_retry");
        } else if (retry.raw) {
          const retryReformat = await reformatToFourLines(retry.raw);
          if (retryReformat && retryReformat.length === 4) {
            lines = retryReformat;
            source = "model";
            console.log("[generate-text] chosen_source: retry_reformatted");
          } else {
            lines=synth(topic,tone,inserts);
            source="synth";
            fallbackReason=`model_failed:${retry.reason || winner.reason || 'unknown'}`;
            console.log("[generate-text] chosen_source: synth");
          }
        } else {
          lines=synth(topic,tone,inserts);
          source="synth";
          fallbackReason=`model_failed:${retry.reason || winner.reason || 'unknown'}`;
          console.log("[generate-text] chosen_source: synth");
        }
      }
    } else {
      lines=synth(topic,tone,inserts);
      source="synth";
      fallbackReason=`model_failed:${winner.reason || 'unknown'}`;
      console.log("[generate-text] chosen_source: synth");
    }

    if(false && source==="model"&&invalidSet(lines)){
      const STRICT=SYSTEM+"\nSTRICT: Retry with enforced 75–125 character lines.";
      const retry2=await chatOnce(STRICT,payload,HEDGE_TOKENS,TIMEOUT_MS + 5000);
      if(retry2.ok&&retry2.lines&&!invalidSet(retry2.lines)) lines=retry2.lines;
      else{lines=synth(topic,tone,inserts);source="synth";fallbackReason="invalid_set";}
    }

    lines=lines.map(l=>l.replace(/[\u2013\u2014]/g,",").replace(/[:;]+/g,",").replace(/\s+/g," ").trim().replace(/([^.?!])$/,"$1."));

    if(source === "model"){
      console.log("✅ Using AI-generated lines");
    } else {
      console.warn("⚠️ Using synth fallback. Reason:", fallbackReason);
    }

    return new Response(JSON.stringify({success:true,options:lines.slice(0,4),model:MODEL,source}),{
      headers:{...cors,"Content-Type":"application/json"}
    });
  }catch(err){
    const isTimeout = String(err).includes('timeout') || String(err).includes('AbortError');
    return new Response(JSON.stringify({success:false,error:String(err),status:isTimeout?504:500}),{
      status:isTimeout?504:500,headers:{...cors,"Content-Type":"application/json"}
    });
  }
});
