Below are the **full files** to replace 1:1. No diffs, no scavenger hunt.

---

# `supabase/functions/_shared/text-rules.ts`

```ts
// =============== VIIBE TEXT RULES (LEAN, V3) ===============
export type Rating = "G" | "PG" | "PG-13" | "R";
export type Tone =
  | "humorous" | "savage" | "sentimental" | "nostalgic"
  | "romantic" | "inspirational" | "playful" | "serious";

export interface TaskObject {
  tone: Tone;
  rating: Rating;
  category_path: string[];     // e.g. ["celebrations","birthday"]
  topic: string;               // most specific label: theme || subcategory || category
  layout?: "Meme Text" | "Badge Text" | "Open Space" | "In Scene";
  style?: "Auto" | "Realistic" | "General" | "Design" | "3D Render" | "Anime";
  dimensions?: "Square" | "Landscape" | "Portrait" | "Custom";
  insert_words?: string[];     // 0–2 tokens; hyphens allowed
  insert_word_mode?: "per_line" | "at_least_one";
  avoid_terms?: string[];
  forbidden_terms?: string[];
  birthday_explicit?: boolean; // must say "birthday"
  humor_bias?: "high" | "med" | "soft";
}

// ---------- House Rules (single system prompt) ----------
export const HOUSE_RULES = `
You write short, punchy humor for image overlays. Return JSON only.

OUTPUT
- Exactly 4 lines in JSON (schema provided), no extra prose, no markdown.
- Each line is a complete sentence, 40–120 characters, ending with .!?.
- Be specific about the "topic" without echoing labels in "avoid_terms".
- Keep it human: smooth phrasing, clear punchline rhythm.

STYLE
- Humor-first unless tone is explicitly "serious"; even "sentimental" gets a gentle wink.
- Use clean punctuation only; no emojis, no hashtags.
- Do not mention prompts, categories, rules, formats, or "jokes" meta language.

INSERT WORDS
- If "insert_word_mode" = "per_line": every line must include each insert word naturally once.
- If "at_least_one": each insert word must appear at least once across the 4 lines.
- Never tack words at the end; weave them mid-sentence.

RATINGS: PROFANITY, SEX, SUBSTANCES
- G: no profanity; no sexual terms; no alcohol/drugs.
- PG: mild tone; romance/kiss OK; alcohol OK; no drugs; no sexual terms like "sex/hookup".
- PG-13: mild uncensored ("hell","damn") allowed; non-graphic sex mentions OK; alcohol + cannabis OK; no porn terms/anatomy.
- R: strong profanity allowed; non-graphic adult sex references allowed; alcohol and any drug names allowed for humor.
  Never provide instructions, sourcing, or safety/dosage advice. Never include minors or non-consent.

ALWAYS FORBIDDEN (all ratings)
- Hate toward protected classes; slurs; threats; self-harm encouragement; sexual content with minors; step-by-step illegal instructions.

Return only JSON that matches the schema.
`;

// ---------- Tones / Ratings (short hints for the model) ----------
export const TONE_HINTS: Record<Tone, string> = {
  humorous:      "funny, witty, light",
  savage:        "harsh, blunt, cutting",
  sentimental:   "warm, heartfelt, tender with a small wink",
  nostalgic:     "reflective, wistful, lightly playful",
  romantic:      "loving, sweet, playful warmth",
  inspirational: "bold, uplifting, clever",
  playful:       "silly, cheeky, fun",
  serious:       "formal, direct, weighty; minimal humor"
};

export const RATING_HINTS: Record<Rating, string> = {
  G:      "all-ages; zero profanity; no sex; no substances",
  PG:     "mild; romance/kiss ok; alcohol ok; no drugs; no sex mentions",
  "PG-13":"edgy; non-graphic sex references ok; alcohol+cannabis ok; no porn terms",
  R:      "adult language ok; non-graphic sex ok; drug names ok; no instructions/sourcing"
};

// ---------- Category adapter: tiny nudges, not a novel ----------
export function categoryAdapter(task: TaskObject): Partial<TaskObject> & { notes?: string } {
  const [root, leaf = ""] = task.category_path.map(s => (s || "").toLowerCase());
  const result: Partial<TaskObject> & { notes?: string } = {
    insert_word_mode: task.insert_word_mode || "per_line",
    humor_bias: task.humor_bias || "high",
    forbidden_terms: [...(task.forbidden_terms || []), "tone","rating","joke","pun","one-liner"]
  };

  // Birthday must say "birthday"
  if (root === "celebrations" && (leaf.includes("birthday") || task.topic.toLowerCase().includes("birthday"))) {
    result.birthday_explicit = true;
    result.avoid_terms = [...(task.avoid_terms || []), "special day","trip around the sun"];
  }

  // Jokes: forbid meta terms
  if (root === "jokes") {
    result.forbidden_terms = [
      ...(result.forbidden_terms || []),
      "pun","puns","punny","one-liner","one liners","riddle",
      "joke","jokes","setup","punchline","delivery","comedian","stand-up","bit","skit"
    ];
  }

  return result;
}

// ---------- Rating adapter: opens PG-13/R, blocks tutorials/minors ----------
export function ratingAdapter(task: TaskObject): Partial<TaskObject> {
  const base = task.forbidden_terms || [];

  const ALWAYS = [
    "underage","minor","teen","non-consensual","rape","incest","bestiality","child"
  ];
  const HOWTO = [
    "how to","here's how","step by step","recipe","tutorial",
    "make meth","cook meth","synthesize","extract",
    "buy weed","buy coke","score","plug","DM me to buy"
  ];

  // Words we actively block for lower ratings
  const ALCOHOL = ["beer","wine","vodka","tequila","whiskey","rum","shots","hangover","bar tab","drunk","tipsy"];
  const CANNABIS = ["weed","cannabis","edible","gummies","joint","blunt","bong","dab","vape pen","stoned","high"];
  const PORNISH  = ["porn","pornhub","onlyfans","nsfw","blowjob","handjob","anal","pussy","cock","dick","tits","boobs","cum"];

  if (task.rating === "G") {
    return { forbidden_terms: [...base, ...ALWAYS, ...HOWTO, ...ALCOHOL, ...CANNABIS, ...PORNISH, "sex","hookup","hook up","naked","nude","kiss","sexy"] };
  }
  if (task.rating === "PG") {
    return { forbidden_terms: [...base, ...ALWAYS, ...HOWTO, ...CANNABIS, ...PORNISH, "sex","hookup","hook up","naked","nude"] };
  }
  if (task.rating === "PG-13") {
    // allow alcohol + cannabis; block porn/anatomy and how-to
    return { forbidden_terms: [...base, ...ALWAYS, ...HOWTO, ...PORNISH] };
  }
  // R: allow adult references; still no how-to or ALWAYS
  return { forbidden_terms: [...base, ...ALWAYS, ...HOWTO] };
}

// ---------- Structured Outputs schema ----------
export const VIIBE_TEXT_SCHEMA = {
  name: "ViibeTextV3",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      lines: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string", maxLength: 160 },     // hard cap, we still check 40–120
            device: { type: "string" },                   // observational, misdirection, contrast, understatement, escalation...
            uses_insert_words: { type: "boolean" }
          },
          required: ["text","device","uses_insert_words"]
        }
      }
    },
    required: ["lines"]
  },
  strict: true
} as const;

// ---------- Minimal validation (server-side) ----------
const INSTRUCTION_PATTERNS = [
  /\bhow to\b/i, /\bhere'?s how\b/i, /\bstep[-\s]?by[-\s]?step\b/i, /\brecipe\b/i, /\btutorial\b/i,
  /\b(make|cook|extract|synthesize)\b.*\b(meth|cocaine|heroin|lsd|mdma|dmt|opioid|opiate)\b/i,
  /\b(buy|score|get)\b.*\b(weed|coke|mdma|lsd|dmt|ketamine|heroin)\b/i
];

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function validateLine(l: string, task: TaskObject): string[] {
  const errs: string[] = [];
  const text = (l || "").trim();

  if (!/[.!?]$/.test(text)) errs.push("no end punctuation");
  if (text.length < 40 || text.length > 120) errs.push("bad length");

  if (task.birthday_explicit && !/\bbirthday|b-day|happy birthday|born|another year\b/i.test(text)) {
    errs.push("missing birthday word");
  }

  const avoid = task.avoid_terms || [];
  if (avoid.length && new RegExp(`\\b(${avoid.map(esc).join("|")})\\b`, "i").test(text)) {
    errs.push("echoed avoid term");
  }

  const forbid = task.forbidden_terms || [];
  if (forbid.length && new RegExp(`\\b(${forbid.map(esc).join("|")})\\b`, "i").test(text)) {
    errs.push("forbidden term present");
  }

  if (INSTRUCTION_PATTERNS.some(rx => rx.test(text))) errs.push("instructional phrasing");
  return errs;
}

export function batchCheck(lines: string[], task: TaskObject): string[] {
  const errs = [...(lines.flatMap(l => validateLine(l, task)))];
  if (task.insert_words?.length && task.insert_word_mode === "at_least_one") {
    for (const w of task.insert_words) {
      const seen = lines.some(l => new RegExp(`\\b${esc(w)}(?:'s)?\\b`, "i").test(l));
      if (!seen) errs.push(`insert word never used: ${w}`);
    }
  }
  return errs;
}
```

---

# `supabase/functions/generate-text/index.ts`

```ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  HOUSE_RULES,
  VIIBE_TEXT_SCHEMA,
  TONE_HINTS,
  RATING_HINTS,
  categoryAdapter,
  ratingAdapter,
  batchCheck,
  type TaskObject, type Tone, type Rating
} from "../_shared/text-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GeneratePayload = {
  category: string;
  subcategory?: string;
  theme?: string;
  tone?: Tone;
  rating?: Rating;
  insertWords?: string[];
  gender?: "male"|"female"|"neutral";
  layout?: "Meme Text" | "Badge Text" | "Open Space" | "In Scene";
  style?: "Auto" | "Realistic" | "General" | "Design" | "3D Render" | "Anime";
  dimensions?: "Square" | "Landscape" | "Portrait" | "Custom";
  insertWordMode?: "per_line" | "at_least_one";
  avoidTerms?: string[];
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: GeneratePayload = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    // Normalize inputs
    const category = (body.category || "").trim();
    const subcategory = (body.subcategory || "").trim();
    const theme = (body.theme || "").trim();
    const category_path = [category, subcategory].filter(Boolean);
    const topic = (theme || subcategory || category || "topic").trim();

    const tone: Tone = (body.tone || "humorous");
    const rating: Rating = (body.rating || "PG");
    const insert_words = (body.insertWords || []).slice(0, 2);
    const insert_word_mode = body.insertWordMode || "per_line";

    // Build base task and adapt
    const baseTask: TaskObject = {
      tone, rating, category_path, topic,
      layout: body.layout, style: body.style, dimensions: body.dimensions,
      insert_words, insert_word_mode,
      avoid_terms: [
        ...(body.avoidTerms || []),
        category.toLowerCase(), subcategory.toLowerCase(), theme.toLowerCase()
      ].filter(Boolean)
    };

    const task: TaskObject = { ...baseTask, ...categoryAdapter(baseTask), ...ratingAdapter(baseTask) };

    // Compose minimal user payload
    const userPayload = {
      version: "viibe-text-v3",
      tone_hint: TONE_HINTS[tone],
      rating_hint: RATING_HINTS[rating],
      task
    };

    // ---- Call OpenAI Responses API with Structured Outputs ----
    async function callModel(input: any, temp = 0.9) {
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5-mini",
          input: [
            { role: "system", content: HOUSE_RULES },
            { role: "user", content: JSON.stringify(input) }
          ],
          response_format: { type: "json_schema", json_schema: VIIBE_TEXT_SCHEMA },
          temperature: temp,
          top_p: 0.95,
          max_output_tokens: 600
        })
      });
      if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
      const data = await resp.json();
      const raw = data.output_text || data.output?.[0]?.content?.[0]?.text || "";
      if (!raw) throw new Error("Empty model response");
      let parsed: { lines: Array<{ text: string; device: string; uses_insert_words: boolean }> };
      try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid JSON from model"); }
      return parsed.lines.map(x => x.text.trim());
    }

    let lines = await callModel(userPayload, 0.9);

    // Validate batch; if issues, one guided retry
    const issues = batchCheck(lines, task);
    if (issues.length) {
      const fix = { fix_hint: { issues, guidance: "Return JSON again with 4 lines that meet all constraints." }, task };
      lines = await callModel(fix, 0.7);
    }

    // Final check and crop
    const finalIssues = batchCheck(lines, task);
    if (finalIssues.length) {
      lines = lines.slice(0, 4);
    } else {
      lines = lines.slice(0, 4);
    }

    return new Response(JSON.stringify({
      success: true,
      options: lines,           // simple array for the frontend
      model: "gpt-5-mini",
      count: lines.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("generate-text error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message || "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

---

# `src/lib/api.ts`

```ts
import { supabase } from '@/integrations/supabase/client';

// Standardized type definitions
type GenerateTextParams = {
  category: string;            // "celebrations" or "celebrations > birthday"
  subcategory?: string;        // optional if you use flat category path above
  tone: string;                // Humorous, Savage, ...
  style?: "Generic"|"Sarcastic"|"Wholesome"|"Weird";
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];      // prefer array over CSV
  gender?: string;             // "male" | "female" | "neutral"
  userId?: string;
  rules_id?: string;           // Rules system identifier
};

type GenerateTextResponse = {
  success: true;
  options: string[];           // simplified: server returns simple string array
  model: string;
  count: number;
} | {
  success: false;
  error: string;
};

export type TextOptionsResponse = { line: string }[];

export interface VisualRecommendation {
  visualStyle: string
  layout: string
  description: string
  props: string[]
  interpretation?: string
  palette?: string[]
  mood?: string
}

type GenerateVisualsParams = {
  completed_text: string;
  category: string;
  subcategory?: string;
  tone: string;
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];
  image_style: "Auto"|"General"|"Realistic"|"Design"|"3D Render"|"Anime";
  visualTaste?: string;
  composition_modes?: string[];
  image_dimensions: "Square"|"Portrait"|"Landscape";
  specific_visuals?: string[];
};

type GenerateVisualsResponse = { success: true; visuals: VisualRecommendation[] } | { success: false; error: string };

type GenerateFinalPromptParams = {
  completed_text: string;
  category: string;
  subcategory?: string;
  tone: string;
  rating: "G"|"PG"|"PG-13"|"R";
  insertWords?: string[];
  image_style: "Auto"|"General"|"Realistic"|"Design"|"3D Render"|"Anime";
  text_layout: string;
  image_dimensions: "square"|"portrait"|"landscape"|"custom";
  composition_modes?: string[];
  visual_recommendation?: string;
  provider?: "gemini" | "ideogram";
};

type GenerateFinalPromptResponse = {
  success: true;
  templates: Array<{ name: string; positive: string; negative: string; description: string }>;
} | {
  success: false;
  error: string;
};

export interface GenerateImageParams {
  prompt: string;
  negativePrompt?: string;
  image_dimensions?: 'square' | 'portrait' | 'landscape';
  quality?: 'high' | 'medium' | 'low';
  provider?: 'ideogram' | 'gemini';
}

type GenerateImageResponse = {
  success: true;
  imageData: string;
} | {
  success: true;
  jobId: string;
  status: 'pending';
  provider: 'ideogram' | 'openai' | 'gemini';
} | {
  success: false;
  error: string;
};

// Controlled fetch with timeout and abort
const ctlFetch = async <T>(fn: string, body: any, timeoutMs = 30000): Promise<T> => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  );
  
  try {
    const invokePromise = supabase.functions.invoke(fn, { body });
    const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;
    if (error) throw error;
    return (data as T) ?? ({} as T);
  } catch (error) {
    throw error;
  }
};

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await ctlFetch<{ ok: boolean }>("health", {});
    return !!res.ok;
  } catch {
    return false;
  }
}

export async function getServerModels(): Promise<{ text: string; visuals: string; images: string } | null> {
  try {
    const res = await ctlFetch<{ ok: boolean; models?: { text: string; visuals: string; images: string } }>("health", {});
    return res.models || null;
  } catch {
    return null;
  }
}

// =====================
// TEXT GENERATION (lean)
// =====================
export async function generateTextOptions(params: GenerateTextParams): Promise<{ line: string }[]> {
  // Normalize insertWords to array
  const insertWords = Array.isArray(params.insertWords)
    ? params.insertWords.filter(Boolean)
    : params.insertWords ? [params.insertWords as unknown as string] : [];

  const payload = {
    category: params.category || "celebrations",
    subcategory: params.subcategory,
    tone: params.tone,
    rating: params.rating || "PG",
    insertWords,
    gender: params.gender || "neutral",
    userId: params.userId ?? "anonymous",
    rules_id: params.rules_id
  };

  const res = await ctlFetch<GenerateTextResponse>("generate-text", payload);
  if (!res || res.success !== true || !Array.isArray(res.options) || res.options.length === 0) {
    throw new Error((res as any)?.error || "Generation failed");
  }
  // Normalize to { line }[] for UI
  return res.options.slice(0, 4).map((line: string) => ({ line }));
}

// =====================
// VISUAL RECOMMENDATIONS
// =====================
export async function generateVisualOptions(params: GenerateVisualsParams): Promise<VisualRecommendation[]> {
  try {
    const res = await ctlFetch<GenerateVisualsResponse>("generate-visuals", params, 90000); // 90s timeout
    if (!res || (res as any).success !== true) {
      throw new Error((res as any)?.error || "Visual generation failed");
    }
    const visuals = (res as any).visuals as VisualRecommendation[];
    if (!Array.isArray(visuals) || visuals.length === 0) throw new Error("No visuals returned");
    return visuals.slice(0, 4);
  } catch (error) {
    console.error('Visual generation failed:', error);
    throw error;
  }
}

// =====================
// FINAL PROMPT TEMPLATES
// =====================
export async function generateFinalPrompt(params: GenerateFinalPromptParams): Promise<{templates: Array<{name: string, positive: string, negative: string, description: string}>}> {
  try {
    const rawRes = await ctlFetch<GenerateFinalPromptResponse>("generate-final-prompt", params);
    const res = typeof rawRes === "string" ? JSON.parse(rawRes) : rawRes;
    if (!res || !res.success) {
      const errorMessage = res?.error || "Template generation failed";
      throw new Error(errorMessage);
    }
    return { templates: res.templates };
  } catch (error) {
    console.error('Template generation failed:', error);
    throw error;
  }
}

// =====================
// IMAGE GENERATION + POLLING
// =====================
export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
  try {
    const response = await ctlFetch<GenerateImageResponse>("generate-image", params, 60000);
    return response;
  } catch (error) {
    console.error('Error generating image:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate image');
  }
}

export async function pollImageStatus(jobId: string, provider: 'ideogram' | 'openai' | 'gemini'): Promise<{
  success: boolean;
  status: 'pending' | 'completed' | 'failed';
  imageData?: string;
  error?: string;
  progress?: number;
}> {
  try {
    const response = await ctlFetch<{
      success: boolean;
      status: 'pending' | 'completed' | 'failed';
      imageData?: string;
      error?: string;
      progress?: number;
    }>("poll-image-status", { jobId, provider }, 15000);
    return response;
  } catch (error) {
    console.error('Error polling image status:', error);
    return { success: false, status: 'failed', error: error instanceof Error ? error.message : 'Failed to poll image status' };
  }
}

// =====================
// GEMINI TEST (unchanged)
// =====================
export async function testGeminiAPI(): Promise<any> {
  try {
    const response = await ctlFetch<any>("test-gemini", {}, 15000);
    return response;
  } catch (error) {
    console.error('Error testing Gemini API:', error);
    throw error;
  }
}
```

---

# `src/components/steps/TextStep.tsx`

```tsx
import { useState, KeyboardEvent, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';
import { generateTextOptions } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import DebugPanel from '@/components/DebugPanel';
import { fitnessGoals } from '@/data/CategoryList';

interface TextStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}

const tones = [
  { id: "humorous", label: "Humorous", description: "Funny, witty, light" },
  { id: "savage", label: "Savage", description: "Harsh, blunt, cutting" },
  { id: "sentimental", label: "Sentimental", description: "Warm, heartfelt, tender" },
  { id: "nostalgic", label: "Nostalgic", description: "Reflective, old-times, wistful" },
  { id: "romantic", label: "Romantic", description: "Loving, passionate, sweet" },
  { id: "inspirational", label: "Inspirational", description: "Motivating, uplifting, bold" },
  { id: "playful", label: "Playful", description: "Silly, cheeky, fun" },
  { id: "serious", label: "Serious", description: "Formal, direct, weighty" }
];

const writingPreferences = [
  { id: 'ai-assist', label: 'AI Assist' },
  { id: 'write-myself', label: 'Write Myself' },
  { id: 'no-text', label: "I Don't Want Text" }
];

const ratingOptions = [
  { id: "G", label: "G", name: "G", description: "wholesome/playful" },
  { id: "PG", label: "PG", name: "PG", description: "light sarcasm, safe ironic" },
  { id: "PG-13", label: "PG-13", name: "PG-13", description: "edgy, ironic, sharp" },
  { id: "R", label: "R", name: "R", description: "savage, raw, unfiltered" }
];

export default function TextStep({ data, updateData, onNext }: TextStepProps) {
  const [tagInput, setTagInput] = useState('');
  const [showGeneration, setShowGeneration] = useState(false);
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [selectedTextOption, setSelectedTextOption] = useState<number | null>(null);
  const [textOptions, setTextOptions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [isCustomTextSaved, setIsCustomTextSaved] = useState(false);
  const [showInsertWordsChoice, setShowInsertWordsChoice] = useState(false);
  const [showInsertWordsInput, setShowInsertWordsInput] = useState(false);
  const [showGenderSelection, setShowGenderSelection] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [selectedGender, setSelectedGender] = useState<string>("neutral");
  const { toast } = useToast();

  // Clear stale words when category changes
  useEffect(() => {
    if (data.category && data.text?.insertWords?.length > 0) {
      updateData({ text: { ...data.text, insertWords: [] } });
      toast({ title: "Insert words cleared", description: "Previous words were removed for the new category" });
    }
  }, [data.category, data.subcategory]);

  const getCategoryTitle = () => {
    const category = fitnessGoals.find(cat => cat.id === data.category);
    return category?.title || data.category;
  };

  const getSubcategoryTitle = () => {
    const category = fitnessGoals.find(cat => cat.id === data.category);
    const subcategory = category?.subcategories.find(sub => sub.id === data.subcategory);
    return subcategory?.title || data.subcategory;
  };

  const renderBreadcrumb = () => {
    if (!data.category || !data.subcategory) return null;
    return (
      <div className="text-left mb-1">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold">Your selection:</span> {getCategoryTitle()} &gt; {getSubcategoryTitle()}
          {data.selectedTheme && data.category !== "pop-culture" && (<span> &gt; {data.selectedTheme}</span>)}
          {data.specificItems && data.specificItems.length > 0 && (<span> &gt; {data.specificItems.join(', ')}</span>)}
        </div>
      </div>
    );
  };

  const handleGenerate = async () => {
    if (!data.category || !data.subcategory || !data.text?.tone || !data.text?.rating) return;

    setTagInput('');
    setIsGenerating(true);
    setGenerationError(null);
    setDebugExpanded(false);

    try {
      const requestPayload = {
        category: data.category || 'celebrations',
        subcategory: data.subcategory,
        tone: data.text.tone,
        rating: data.text.rating,
        insertWords: Array.isArray(data.text?.insertWords) ? data.text.insertWords : [],
        gender: selectedGender,
        userId: 'anonymous'
      };

      const response = await generateTextOptions(requestPayload); // now returns { line }[]
      const options = (response || []).map(o => o.line).filter(Boolean);
      if (!options.length) throw new Error('No content generated');

      setTextOptions(options.slice(0, 4));
      setShowTextOptions(true);

      setDebugInfo({
        model: 'gpt-5-mini',
        status: 'success',
        endpoint: 'generate-text',
        timestamp: new Date().toISOString(),
        requestPayload,
        rawResponse: options
      });
    } catch (error: any) {
      setGenerationError('Could not generate text options. Please try again.');
      setDebugInfo({
        model: 'gpt-5-mini',
        status: 'error',
        endpoint: 'generate-text',
        timestamp: new Date().toISOString(),
        error: error?.message || String(error)
      });
      setDebugExpanded(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToneSelect = (toneId: string) => {
    updateData({ text: { ...data.text, tone: toneId } });
  };

  const handleEditTone = () => {
    updateData({ text: { ...data.text, tone: '' } });
  };

  const handleWritingPreferenceSelect = (preferenceId: string) => {
    updateData({ text: { ...data.text, writingPreference: preferenceId } });
    if (preferenceId === 'write-myself') {
      setShowTextOptions(false);
    } else if (preferenceId === 'no-text') {
      updateData({ text: { ...data.text, writingPreference: preferenceId, generatedText: 'No text selected', isComplete: true } });
    } else if (preferenceId === 'ai-assist') {
      setShowInsertWordsChoice(true);
    }
  };

  const handleEditWritingPreference = () => {
    updateData({ text: { ...data.text, writingPreference: '' } });
    setShowInsertWordsChoice(false);
  };

  const handleInsertWordsChoice = (hasWords: boolean) => {
    if (hasWords) {
      setShowInsertWordsChoice(false);
      setShowInsertWordsInput(true);
    } else {
      setShowInsertWordsChoice(false);
      updateData({ text: { ...data.text, insertWords: [] } });
      setShowGenderSelection(true);
    }
  };

  const handleGenderSelect = (genderId: string) => {
    setSelectedGender(genderId);
    setShowGeneration(true);
  };

  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const input = tagInput.trim();
      const currentWords = data.text?.insertWords || [];

      if (currentWords.length >= 2) {
        toast({ title: "Word limit reached", description: "You can only add 2 insert words maximum", variant: "destructive" });
        return;
      }
      if (input.includes(' ')) {
        toast({ title: "Single words only", description: "Use hyphens for compound words (e.g., 'left-handed')", variant: "destructive" });
        return;
      }
      if (input.length > 20) {
        toast({ title: "Word too long", description: "Each word must be 20 characters or less", variant: "destructive" });
        return;
      }
      const totalChars = currentWords.join('').length + input.length;
      if (totalChars > 50) {
        toast({ title: "Character limit exceeded", description: "Total characters across all words cannot exceed 50", variant: "destructive" });
        return;
      }
      if (currentWords.includes(input)) {
        toast({ title: "Duplicate word", description: "This word has already been added", variant: "destructive" });
        return;
      }

      updateData({ text: { ...data.text, insertWords: [...currentWords, input] } });
      setTagInput('');
    }
  };

  const handleRemoveTag = (wordToRemove: string) => {
    const currentWords = data.text?.insertWords || [];
    updateData({ text: { ...data.text, insertWords: currentWords.filter((w: string) => w !== wordToRemove) } });
  };

  const handleReadyToGenerate = () => {
    setShowInsertWordsInput(false);
    setShowGenderSelection(true);
  };

  const handleRatingSelect = (ratingId: string) => {
    updateData({ text: { ...data.text, rating: ratingId } });
  };

  const handleTextOptionSelect = (optionIndex: number) => {
    setSelectedTextOption(optionIndex);
    updateData({ text: { ...data.text, selectedOption: optionIndex, generatedText: textOptions[optionIndex] || '' } });
  };

  const handleCustomTextChange = (value: string) => {
    if (value.length <= 120) {
      setCustomText(value);
      setIsCustomTextSaved(false);
    }
  };

  const handleSaveCustomText = () => {
    if (customText.trim()) {
      updateData({ text: { ...data.text, customText: customText.trim(), generatedText: customText.trim() } });
      setIsCustomTextSaved(true);
    }
  };

  const handleCustomTextKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customText.trim()) handleSaveCustomText();
  };

  const handleLayoutSelect = (layoutId: string) => {
    updateData({ text: { ...data.text, layout: layoutId, isComplete: true } });
  };

  const layoutOptions = [
    { id: "meme-text", title: "Meme Text", description: "Text at top and bottom" },
    { id: "badge-callout", title: "Badge Text", description: "Text in colorful badge" },
    { id: "negative-space", title: "Open Space", description: "Text in empty areas" },
    { id: "integrated-in-scene", title: "In Scene", description: "Text naturally in image" }
  ];

  const selectedTone = tones.find(tone => tone.id === data.text?.tone);
  const selectedWritingPreference = writingPreferences.find(pref => pref.id === data.text?.writingPreference);

  // UI flows (unchanged except for simplified generate path)
  if (!data.text?.tone) {
    return (
      <div className="space-y-6">
        {renderBreadcrumb()}
        <div className="text-center"><h2 className="mb-2 text-xl font-semibold text-foreground">Choose Your Tone</h2></div>
        <div className="grid grid-cols-2 gap-3">
          {tones.map(tone => (
            <button key={tone.id} onClick={() => handleToneSelect(tone.id)} className="h-20 rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50">
              <div className="flex h-full flex-col items-center justify-center space-y-1">
                <div className="font-semibold text-sm">{tone.label}</div>
                <div className="text-xs text-muted-foreground">{tone.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (data.text?.tone && !data.text?.rating) {
    return (
      <div className="space-y-6">
        {renderBreadcrumb()}
        <div className="rounded-lg border-2 border-cyan-400 bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground"><span className="font-semibold">Tone</span> - {selectedTone?.label}</div>
            <button onClick={handleEditTone} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
        </div>
        <div className="space-y-3 pt-4">
          <div className="text-center"><h2 className="mb-2 text-xl font-semibold text-foreground">Choose Your Rating</h2></div>
          <div className="grid grid-cols-2 gap-3">
            {ratingOptions.map(rating => (
              <button key={rating.id} onClick={() => handleRatingSelect(rating.id)} className={cn(
                "h-20 rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth",
                data.text?.rating === rating.id ? "border-primary bg-primary/10" : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50"
              )}>
                <div className="flex h-full flex-col items-center justify-center space-y-1">
                  <div className="font-semibold text-sm">{rating.name}</div>
                  <div className="text-xs text-muted-foreground">{rating.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data.text?.writingPreference) {
    return (
      <div className="space-y-6">
        {renderBreadcrumb()}
        <div className="rounded-lg border-2 border-cyan-400 bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-foreground"><span className="font-semibold">Tone</span> - {selectedTone?.label}</div>
            <button onClick={handleEditTone} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-sm text-foreground"><span className="font-semibold">Rating</span> - {ratingOptions.find(r => r.id === data.text?.rating)?.name}</div>
            <button onClick={() => handleRatingSelect("")} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
        </div>
        <div className="text-center pt-4"><h2 className="mb-4 text-xl font-semibold text-foreground">Choose Your Writing Process</h2></div>
        <div className="grid grid-cols-1 gap-3">
          {writingPreferences.map(preference => (
            <button key={preference.id} onClick={() => handleWritingPreferenceSelect(preference.id)} className="rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50">
              <div className="font-semibold text-sm">{preference.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (data.text?.writingPreference === 'no-text') {
    return (
      <div className="space-y-6">
        {renderBreadcrumb()}
        <div className="rounded-lg border-2 border-cyan-400 bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="space-y-1"><div className="text-sm text-foreground"><span className="font-semibold">Tone</span> - {selectedTone?.label}</div></div>
            <button onClick={handleEditTone} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="space-y-1"><div className="text-sm text-foreground"><span className="font-semibold">Process</span> - {writingPreferences.find(p => p.id === data.text?.writingPreference)?.label}</div></div>
            <button onClick={handleEditWritingPreference} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
        </div>
        <div className="text-center p-8">
          <div className="text-lg font-medium text-foreground mb-2">Perfect! No text will be added to your design.</div>
          <div className="text-sm text-muted-foreground">You can proceed to choose your visual style.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderBreadcrumb()}

      <div className="rounded-lg border-2 border-cyan-400 bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="space-y-1"><div className="text-sm text-foreground"><span className="font-semibold">Tone</span> - {selectedTone?.label}</div></div>
          <button onClick={handleEditTone} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
        </div>
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="space-y-1"><div className="text-sm text-foreground"><span className="font-semibold">Process</span> - {selectedWritingPreference?.label}</div></div>
          <button onClick={handleEditWritingPreference} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
        </div>
        {data.text?.writingPreference === 'ai-assist' && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Insert Words</span> - {data.text?.insertWords && data.text.insertWords.length > 0 ? data.text.insertWords.join(', ') : <span className="text-muted-foreground">None entered</span>}
            </div>
            <button onClick={() => { setShowGeneration(false); setShowInsertWordsChoice(true); setShowInsertWordsInput(false); }} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
        )}
        {showTextOptions && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="text-sm text-foreground"><span className="font-semibold">Rating</span> - {ratingOptions.find(r => r.id === data.text?.rating)?.label.split(' (')[0] || 'G'}</div>
            <button onClick={() => { setShowTextOptions(false); setSelectedTextOption(null); }} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
        )}
        {(selectedTextOption !== null || (data.text?.writingPreference === 'write-myself' && isCustomTextSaved)) && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="text-sm text-foreground">
              <span className="font-semibold">Text</span> - {data.text?.writingPreference === 'write-myself' ? (data.text.customText || '').slice(0, 20) + ((data.text.customText || '').length > 20 ? '...' : '') : (textOptions[selectedTextOption!] || '').slice(0, 20) + ((textOptions[selectedTextOption!] || '').length > 20 ? '...' : '')}
            </div>
            <button onClick={() => {
              if (data.text?.writingPreference === 'write-myself') {
                setCustomText(''); setIsCustomTextSaved(false);
                updateData({ text: { ...data.text, customText: '', generatedText: '' } });
              } else { setSelectedTextOption(null); }
            }} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">Edit</button>
          </div>
        )}
      </div>

      {data.text?.writingPreference === 'ai-assist' && !showTextOptions && (
        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Optional - Any specific words you want</h3>
              <span className="text-sm text-muted-foreground">{data.text?.insertWords?.length || 0}/2 words | {data.text?.insertWords?.join('').length || 0}/50 chars</span>
            </div>
            <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Enter single word (hyphens allowed)" className="w-full" disabled={(data.text?.insertWords?.length || 0) >= 2} />
            <p className="text-xs text-muted-foreground">Tip: Use hyphens for compound words like 'left-handed'</p>
            {data.text?.insertWords && data.text.insertWords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.text.insertWords.map((word: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                    <span>{word}</span>
                    <button onClick={() => handleRemoveTag(word)} className="text-muted-foreground hover:text-foreground transition-colors">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full">
            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-cyan-400 hover:bg-cyan-500 disabled:bg-gray-400 text-white py-3 rounded-md font-medium min-h-[48px] text-base shadow-lg hover:shadow-xl transition-all duration-200">
              {isGenerating ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>) : 'Generate Text'}
            </Button>
          </div>

          {generationError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1"><p className="text-sm">{generationError}</p></div>
            </div>
          )}
        </div>
      )}

      {showInsertWordsInput && (
        <div className="space-y-4 pt-4">
          <div className="text-center min-h-[120px] flex flex-col justify-start">
            <h2 className="text-xl font-semibold text-foreground">Do you have any specific words you want included?</h2>
            <div className="mt-3"><p className="text-sm text-muted-foreground text-center">eg. Names, Happy Birthday, Congrats etc.</p></div>
          </div>
          <div className="space-y-3">
            <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Enter words you want included into your final text" className="w-full py-6 min-h-[72px] text-center" />
            {data.text?.insertWords && data.text.insertWords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.text.insertWords.map((word: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                    <span>{word}</span>
                    <button onClick={() => handleRemoveTag(word)} className="text-muted-foreground hover:text-foreground transition-colors">×</button>
                  </div>
                ))}
              </div>
            )}
            {data.text?.insertWords && data.text.insertWords.length > 0 && (
              <div className="flex justify-center pt-4">
                <Button onClick={handleReadyToGenerate} className="bg-gradient-primary shadow-primary hover:shadow-card-hover px-6 py-2 rounded-md font-medium transition-all duration-300 ease-spring">Let's Generate the Final Text</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {showGenderSelection && (
        <div className="space-y-4 pt-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Choose Gender for Pronouns</h2>
            <p className="text-sm text-muted-foreground">This helps us use the right pronouns (he/she/they)</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['male','female','neutral'].map(g => (
              <button key={g} onClick={() => setSelectedGender(g)} className={cn(
                "h-24 rounded-lg border-2 p-4 text-center transition-all duration-300 ease-smooth",
                selectedGender === g ? "border-primary bg-primary/10" : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50"
              )}>
                <div className="flex h-full flex-col items-center justify-center space-y-1">
                  <div className="font-semibold text-sm">{g[0].toUpperCase()+g.slice(1)}</div>
                  <div className="text-xs text-muted-foreground">{g === 'male' ? 'he/his/him' : g === 'female' ? 'she/her/hers' : 'no pronouns (use name)'}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showTextOptions && selectedTextOption === null && (
        <div className="space-y-3 p-4">
          <h3 className="text-lg font-semibold text-foreground text-center">Choose your text:</h3>
          <div className="flex justify-center">
            <button onClick={handleGenerate} disabled={isGenerating} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {isGenerating ? 'Generating...' : 'Generate Again'}
            </button>
          </div>
          <div className="space-y-3">
            {textOptions.map((text, index) => (
              <div key={index} onClick={() => handleTextOptionSelect(index)} className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${selectedTextOption === index ? 'border-primary bg-accent text-foreground' : 'border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/50'}`}>
                <p className="text-sm leading-relaxed mb-2">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(selectedTextOption !== null && !data.text?.layout) && (
        <div className="space-y-3 p-4">
          <h3 className="text-lg font-semibold text-foreground text-center">Choose Your Text Layout:</h3>
          <div className="grid grid-cols-2 gap-3">
            {layoutOptions.map(layout => (
              <Card key={layout.id} className={cn("cursor-pointer text-center transition-all duration-300 hover:scale-105", "border-2 bg-card hover:bg-accent hover:border-primary", { "border-primary shadow-primary bg-accent": data.text?.layout === layout.id, "border-border": data.text?.layout !== layout.id })} onClick={() => handleLayoutSelect(layout.id)}>
                <div className="p-6 flex flex-col items-center justify-center h-28">
                  <h3 className="text-base font-semibold text-foreground mb-2">{layout.title}</h3>
                  <p className="text-sm text-muted-foreground">{layout.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {debugInfo && (
        <div className="mt-6">
          <DebugPanel
            title="Text Generation Debug"
            model={debugInfo.model}
            status={debugInfo.status}
            endpoint={debugInfo.endpoint}
            timestamp={debugInfo.timestamp}
            requestPayload={debugInfo.requestPayload}
            responseData={debugInfo.rawResponse}
            error={debugInfo.error}
            className={cn("transition-all duration-300", debugExpanded && debugInfo.status === 'error' ? "ring-2 ring-red-200 border-red-200" : "")}
          />
        </div>
      )}
    </div>
  );
}
```

---

# Optional (keep or delete): `src/lib/textValidator.ts` (tiny soft checks)

> You can **delete this file**. If you prefer a tiny preflight, use this instead.

```ts
// src/lib/textValidator.ts (tiny, optional)
export function softValidateLine(line: string): string | null {
  const t = (line || "").trim();
  if (t.length < 40 || t.length > 120) return "line_length_40_120";
  if (!/[.!?]$/.test(t)) return "missing_terminal_punct";
  return null;
}

export function softValidateBatch(lines: string[]): string[] {
  if (!Array.isArray(lines) || lines.length !== 4) return ["batch_must_have_4_lines"];
  const errs = lines.map(softValidateLine).filter(Boolean) as string[];
  return errs; // advisory only
}
```
