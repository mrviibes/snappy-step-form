// supabase/functions/generate-text/index.ts
// Lean Step-2 generator: one small call + tiny hedge, movie-style ratings, category hints,
// insert-word policy, humor priority, no em-dashes. Always returns 200 JSON.

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
type Tone   = "humorous"|"savage"|"sentimental"|"nostalgic"|"romantic"|"inspirational"|"playful"|"serious";
type Rating = "G"|"PG"|"PG-13"|"R";
type Category = "celebrations"|"daily-life"|"sports"|"pop-culture"|"jokes"|"miscellaneous";

// ---------- Tone/Rating (movie-style) ----------
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

// ---------- Category hint ----------
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
- Provided: ${inserts.join(", ")}
- If one word, include it once in EVERY line.
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

// ---------- JSON helpers ----------
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
async function chatOnce(
  system: string,
  userObj: unknown,
  maxTokens = 320,
  abortMs = 22000
): Promise<{ ok: boolean; lines?: string[]; reason?: string }> {
  function parseLinesFromText(text: string): string[] {
    if (!text) return [];
    // Split by newlines, strip bullets/numbers, trim
    const raw = text
      .split(/\r?\n+/)
      .map((l) => l.replace(/^\s*[-*•\d\.)]+\s*/, "").trim())
      .filter(Boolean);
    // Ensure punctuation at end; keep between 28-160 chars roughly
    const cleaned = raw.map((l) => l.replace(/[\u2013\u2014]/g, ",").replace(/\s+/g, " ").trim())
      .map((l) => (/[.!?]$/.test(l) ? l : l + "."))
      .filter((l) => l.length >= 28 && l.length <= 160);
    return cleaned.slice(0, 4);
  }

  async function call(cap: number) {
    const body = {
      model: MODEL,
      // IMPORTANT: GPT-5 family does not support temperature/top_p in Chat Completions
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userObj) },
      ],
      max_completion_tokens: cap,
    } as const;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort("timeout"), abortMs);
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      const raw = await r.text();
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ${raw.slice(0, 600)}`);
      const data = JSON.parse(raw);
      const finish = data?.choices?.[0]?.finish_reason || data?.incomplete_details?.reason || "n/a";
      console.log("[generate-text] finish_reason:", finish);

      const msg = data?.choices?.[0]?.message;
      const content = typeof msg?.content === "string" ? msg.content : "";
      let lines = parseLinesFromText(content);

      // Fallback to any structured JSON the model might have returned
      if (lines.length < 4) {
        const fromParsed = (msg?.parsed && Array.isArray(msg.parsed.lines)) ? msg.parsed.lines as string[] : undefined;
        if (fromParsed && fromParsed.length === 4) lines = fromParsed;
      }

      if (lines.length === 4) return { ok: true, lines };
      const reason = finish || "no_lines";
      return { ok: false, reason: String(reason) };
    } finally {
      clearTimeout(timer);
    }
  }

  // Primary attempt
  let res = await call(maxTokens);
  if (res.ok) return res;

  // If the model stopped early (commonly "length"), retry once with higher cap
  if (res.reason === "length") {
    console.log("🔄 Retrying due to length with +160 tokens (no schema)");
    const second = await call(maxTokens + 160); // e.g., 320→480
    if (second.ok) return second;
    return second;
  }

  return res; // not length → bubble reason
}

// ---------- Last-resort fallback (can't fail) ----------
function synth(topic: string, tone: Tone): string[] {
  const t = topic || "the moment";
  const funny = [
    `${t} doesn't need context, it needs commitment.`,
    `Schedule says no, ${t} says do it anyway.`,
    `You brought logic; ${t} brought glitter.`,
    `${t}: short plan, long story.`,
  ];
  const warm = [
    `${t} shows up small and still matters.`,
    `A quiet ${t} is still a win.`,
    `Keep ${t} simple and kind.`,
    `Let ${t} be enough today.`,
  ];
  const set = (tone === "sentimental" || tone === "serious" || tone === "romantic") ? warm : funny;
  return set.map((x) => x.replace(/[\u2013\u2014]/g, ",").replace(/([^.?!])$/, "$1."));
}

// ---------- HTTP handler ----------
serve(async (req) => {
  if (req.method==="OPTIONS") return new Response(null,{headers:cors});
  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const b = await req.json();
    console.log("📥 Request received:", JSON.stringify(b, null, 2));
    const category = String(b.category||"").trim();
    const subcat   = String(b.subcategory||"").trim();
    const theme    = String(b.theme||"").trim();
    const tone     = (b.tone||"humorous") as Tone;
    const rating   = (b.rating||"PG") as Rating;
    const inserts  = Array.isArray(b.insertWords) ? b.insertWords.filter(Boolean).slice(0,2) : [];
    const topic    = theme || subcat || category || "topic";
    console.log("🎯 Parsed params:", { category, subcat, theme, tone, rating, inserts, topic });

    const SYSTEM = buildSystem(tone, rating, category, subcat, topic, inserts);
    const userPayload = { tone, rating, category, subcategory: subcat, topic, insertWords: inserts };

    // Primary: 320 tokens
    const main = chatOnce(SYSTEM, userPayload, 320, 22000);

    // Hedge after 2s: 480 tokens (higher cap to beat tail latency)
    const hedge = new Promise<{ ok: boolean; lines?: string[]; reason?: string }>((resolve) => {
      setTimeout(async () => {
        try {
          resolve(await chatOnce(SYSTEM, userPayload, 480, 22000));
        } catch {
          resolve({ ok: false, reason: "hedge_failed" });
        }
      }, 2000);
    });

    let winner = await Promise.race([main, hedge]);

    if (!winner.ok) {
      // If the first to complete failed, await the other result once
      const other = (winner === (await main)) ? await hedge : await main;
      winner = other.ok ? other : winner;
    }

    let lines: string[], source = "model";
    if (winner.ok && winner.lines) {
      console.log("✅ Using AI-generated lines");
      lines = winner.lines;
    } else {
      console.log("⚠️ Using synth fallback. Reason:", winner.reason);
      lines = synth(topic, tone);
      source = "synth";
    }

    // Cleanup em/en dashes + whitespace + ensure punctuation
    lines = lines.map((l) =>
      l.replace(/[\u2013\u2014]/g, ",").replace(/\s+/g, " ").replace(/([^.?!])$/, "$1.").trim()
    );

    return new Response(JSON.stringify({ success: true, options: lines.slice(0, 4), model: MODEL, source }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success:false, error:String(err) }), {
      status:200, headers:{...cors,"Content-Type":"application/json"}
    });
  }
});
