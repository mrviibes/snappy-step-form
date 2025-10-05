// supabase/functions/generate-text/index.ts
// Stable + Optimized Viibe Text Generator
// Adds POV detection, comedy style rotation, comedian rhythm, and punctuation cleanup.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const API = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5-mini";

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

// ---------- Category hint ----------
const CATEGORY_HINT: Record<string,string> = {
  celebrations:"Focus on people and the moment; party energy, cake, friends.",
  "daily-life":"Relatable micro-moments; coffee, work, phone logic; small wins.",
  sports:"Competition, rivalry, fan energy; action verbs, scoreboard truth.",
  "pop-culture":"Anchor to a title or trend; paraphrase quotes; stay concise.",
  jokes:"One-line jokes; setup then twist; no meta commentary.",
  miscellaneous:"Universal observation with one vivid detail and a clean turn."
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
  const voice = CATEGORY_HINT[category] || "";

  return `
Write 4 one-liners for ${category}/${subcategory}. Topic: ${topic}.
Tone: ${toneWord}. Rating: ${ratingGate}.
${insertRule}
${pov}
Comedy style: ${style}
${voice}
Use setup, pivot, and tag like a live comedian. Make each line sound spoken, not written.
Each line: 60–120 characters, ends with punctuation, one idea, human rhythm.
No emojis, hashtags, ellipses, colons, semicolons, or em-dashes. Use commas or periods only.
`.trim();
}

// ---------- OpenAI call ----------
async function chatOnce(
  system: string, userObj: any,
  maxTokens = 550, abortMs = 22000
): Promise<{ ok: boolean; lines?: string[]; reason?: string }> {

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort("timeout"), abortMs);

  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userObj) },
        ],
        max_completion_tokens: maxTokens,
      }),
      signal: ctl.signal,
    });
    const raw = await r.text();
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${raw.slice(0,400)}`);
    const data = JSON.parse(raw);
    const finish = data?.choices?.[0]?.finish_reason || "n/a";
    console.log("[generate-text] finish_reason:", finish);

    const content = data?.choices?.[0]?.message?.content || "";
    const lines = content
      .split(/\r?\n+/)
      .map((l:string)=>l.replace(/[\u2013\u2014]/g,",").replace(/[:;]+/g,",").replace(/\s+/g," ").trim())
      .filter(l=>l.length>=60 && l.length<=120)
      .slice(0,4);
    return lines.length===4 ? {ok:true,lines}:{ok:false,reason:finish};
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Fallback ----------
function synth(topic:string,tone:Tone,inserts:string[]=[]){
  const t=topic||"the moment";
  const name=inserts[0]?` ${inserts[0]}`:"";
  const lines=[
    `${t}${name} shows up loud and on brand, reason can clock in later.`,
    `Schedule says no, ${t}${name} says watch me.`,
    `Logic brings lists, ${t}${name} brings glitter and a receipt.`,
    `${t}${name} proves chaos can still look productive.`
  ];
  return lines.map(l=>l.replace(/\s+/g," ").trim().replace(/([^.?!])$/,"$1."));
}

// ---------- HTTP handler ----------
serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  try{
    if(!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

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
      return !Array.isArray(ls)||ls.length<4||ls.some(l=>l.length<60||l.length>120||!/[.!?]$/.test(l));
    }

    const main=chatOnce(SYSTEM,payload,700,22000);
    const hedge=new Promise<{ok:boolean;lines?:string[];reason?:string}>(resolve=>{
      setTimeout(async()=>{
        try{resolve(await chatOnce(SYSTEM,payload,900,22000));}
        catch{resolve({ok:false,reason:"hedge_failed"});}
      },2000);
    });

    let winner:any=await Promise.race([main,hedge]);
    if(!winner.ok){
      const other=(winner===(await main))?await hedge:await main;
      winner=other.ok?other:winner;
    }

    let lines:string[],source="model";
    if(winner.ok&&winner.lines) lines=winner.lines;
    else{
      const STRICT=SYSTEM+"\nSTRICT: Each line must be 60–120 chars with clear wordplay and a twist.";
      const retry=await chatOnce(STRICT,payload,900,22000);
      if(retry.ok&&retry.lines) lines=retry.lines;
      else{lines=synth(topic,tone,inserts);source="synth";}
    }

    if(source==="model"&&invalidSet(lines)){
      const STRICT=SYSTEM+"\nSTRICT: Retry with enforced 60–120 character lines.";
      const retry2=await chatOnce(STRICT,payload,900,22000);
      if(retry2.ok&&retry2.lines&&!invalidSet(retry2.lines)) lines=retry2.lines;
      else{lines=synth(topic,tone,inserts);source="synth";}
    }

    lines=lines.map(l=>l.replace(/[\u2013\u2014]/g,",").replace(/[:;]+/g,",").replace(/\s+/g," ").trim().replace(/([^.?!])$/,"$1."));

    return new Response(JSON.stringify({success:true,options:lines.slice(0,4),model:MODEL,source}),{
      headers:{...cors,"Content-Type":"application/json"}
    });
  }catch(err){
    return new Response(JSON.stringify({success:false,error:String(err)}),{
      status:200,headers:{...cors,"Content-Type":"application/json"}
    });
  }
});
