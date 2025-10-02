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
