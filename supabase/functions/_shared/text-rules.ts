// =============== VIIBE TEXT RULES (LEAN, V4) ===============

export type Tone =
  | "humorous" | "savage" | "sentimental" | "nostalgic"
  | "romantic" | "inspirational" | "playful" | "serious";

export type Rating = "G" | "PG" | "PG-13" | "R";

export interface TaskObject {
  tone: Tone;
  rating: Rating;
  category_path: string[];
  topic: string;
  layout?: string;
  style?: string;
  dimensions?: string;
  insert_words?: string[];
  insert_word_mode?: "per_line" | "at_least_one";
  avoid_terms?: string[];
  forbidden_terms?: string[];
  birthday_explicit?: boolean;
  humor_bias?: string;
}

// Tone & rating hints used in the House Rules
export const TONE_HINTS: Record<Tone, string> = {
  humorous:      "funny, witty, punchy",
  savage:        "blunt, cutting, roast-style",
  sentimental:   "warm, affectionate, heartfelt (still a wink)",
  nostalgic:     "reflective, past references, lightly playful",
  romantic:      "affectionate, playful, charming",
  inspirational: "uplifting, bold, clever",
  playful:       "silly, cheeky, fun",
  serious:       "formal, direct, weighty; minimal humor"
};

export const RATING_HINTS: Record<Rating, string> = {
  G:       "no profanity; no sexual terms; no drugs; gentle tone",
  PG:      "mild language allowed (hell/damn); kiss/romance OK; alcohol OK; no drugs; no sex mentions",
  "PG-13": "non-graphic sex mentions OK; alcohol + cannabis OK; NO f-bomb; no porn/anatomy terms",
  R:       "adult non-graphic sex OK; alcohol + any drug names OK; strong profanity OK; no slurs; no illegal how-to"
};

// ---------- House Rules builder: comedy craft + theatre ratings ----------
export function buildHouseRules(tone_hint: string, rating_hint: string) {
  return [
    // Voice + medium
    "You write short, hilarious, punchy humor for on-image captions (overlay text).",
    "Return exactly 4 lines (each 28-140 chars), each a complete sentence ending with . ! or ?",
    "Be specific to the provided topic. No meta about prompts or jokes. No emojis/hashtags/lists/dialogue labels.",

    // Steering
    `TONE: ${tone_hint}`,
    `RATING: ${rating_hint}`,

    // Theatre gates
    "THEATRE RATINGS:",
    "- G: no profanity or sexual terms; no drugs; gentle humor only.",
    "- PG: mild language only (hell/damn OK); kiss/romance OK; alcohol OK; no drugs; no sex mentions.",
    "- PG-13: non-graphic sex mentions OK; alcohol + cannabis OK; NO f-bomb; no porn/anatomy.",
    "- R: adult non-graphic sex OK; alcohol + any drug names OK; strong profanity allowed; no slurs; no illegal 'how-to'.",

    // Comedy craft
    "COMEDY PLAYBOOK (pick ≥2 per line): misdirection, contrast, absurd escalation, rule-of-three, sharp specificity, wordplay, understatement.",
    "SPECIFICITY: include at least one concrete, topic-relevant detail (object, action, or scenario) per line.",
    "CADENCE: front-load or land the twist cleanly; avoid meandering setups.",
    "BAN BLAND: no 'Congrats on your special day', 'Here’s a joke', 'another trip around the sun', 'live laugh love', 'you got this'.",
    "ACTIVE voice; vivid nouns/verbs; avoid clichés.",

    // R spice policy
    "R PROFANITY POLICY: if tone is Savage or Humorous, include at least one strong profanity per line (max two), inside the sentence (not the last word).",

    // Inserts & guardrails
    "INSERT WORDS: if provided, weave naturally (per_line = every line).",
    "ALWAYS FORBIDDEN: slurs; minors/non-consent; self-harm; pornographic detail; illegal how-to."
  ].join("\\n");
}

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

// ---------- Structured Outputs schema (compact, strings only) ----------
export const VIIBE_TEXT_SCHEMA = {
  name: "ViibeTextCompactV1",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      lines: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: { type: "string", maxLength: 140 }
      }
    },
    required: ["lines"]
  },
  strict: true
} as const;

// ---------- Profanity & blandness checks ----------
const RX_FBOMB   = /\bfuck(?:ing|er|ed|s)?\b/i;
const RX_STRONG  = /\b(fuck(?:ing|er|ed|s)?|shit(?:ty|head|ting)?|bullshit|asshole|bastard|goddamn)\b/i;
const RX_MILD    = /\b(hell|damn)\b/i;

const BLAND_OPENERS = /^(congrats|congratulations|happy|here's|here is|let me|today we|we love|so yeah|in this|when you|sometimes|another|on your|to be honest)\b/i;
const BLAND_PHRASES = /\b(special day|best life|live laugh love|another trip around the sun|making memories|you got this|so proud of you|follow your dreams)\b/i;

const STOPWORDS = new Set(["the","a","an","and","or","but","to","of","for","with","on","in","at","it","is","are","was","were","this","that","your","you","i"]);
function hasConcreteWord(line: string): boolean {
  const words = line.toLowerCase().replace(/[^a-z0-9\s']/g," ").split(/\s+/).filter(Boolean);
  return words.some(w => w.length >= 5 && !STOPWORDS.has(w));
}

// ---------- “how-to” patterns ----------
const INSTRUCTION_PATTERNS = [
  /\bhow to\b/i, /\bhere'?s how\b/i, /\bstep[-\s]?by[-\s]?step\b/i, /\brecipe\b/i, /\btutorial\b/i,
  /\b(make|cook|extract|synthesize)\b.*\b(meth|cocaine|heroin|lsd|mdma|dmt|opioid|opiate)\b/i,
  /\b(buy|score|get)\b.*\b(weed|coke|mdma|lsd|dmt|ketamine|heroin)\b/i
];

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ---------- Validation (line + batch) ----------
export function validateLine(l: string, task: TaskObject): string[] {
  const errs: string[] = [];
  const text = (l || "").trim();

  // Base structure
  if (!/[.!?]$/.test(text)) errs.push("no_end_punctuation");
  if (text.length < 28 || text.length > 140) errs.push("bad_length");

  // Birthday explicit
  if (task.birthday_explicit && !/\bbirthday|b-day|happy birthday|born|another year\b/i.test(text)) {
    errs.push("missing_birthday_word");
  }

  // Avoid/forbidden terms
  const avoid = task.avoid_terms || [];
  if (avoid.length && new RegExp(`\\b(${avoid.map(esc).join("|")})\\b`, "i").test(text)) errs.push("echoed_avoid_term");
  const forbid = task.forbidden_terms || [];
  if (forbid.length && new RegExp(`\\b(${forbid.map(esc).join("|")})\\b`, "i").test(text)) errs.push("forbidden_term_present");

  // No how-to illegal content
  if (INSTRUCTION_PATTERNS.some(rx => rx.test(text))) errs.push("instructional_phrasing");

  // Ratings enforcement (movie-style)
  const toneIsSpicy = /^(savage|humorous|playful)$/i.test(task.tone || "");
  const strongCount = (text.match(RX_STRONG) || []).length;
  const fCount      = (text.match(RX_FBOMB) || []).length;

  if (task.rating === "G") {
    if (RX_MILD.test(text) || RX_STRONG.test(text)) errs.push("profanity_not_allowed_G");
  }
  if (task.rating === "PG") {
    if (RX_STRONG.test(text)) errs.push("strong_profanity_not_allowed_PG");
  }
  if (task.rating === "PG-13") {
    if (fCount > 0) errs.push("f_bomb_not_allowed_PG13");
  }
  if (task.rating === "R") {
    if (toneIsSpicy && strongCount < 1) errs.push("needs_strong_profanity_R");
    if (strongCount > 2) errs.push("too_much_profanity_R");
    if (/\b(fuck(?:ing|er|ed|s)?|shit|bullshit|asshole|bastard|goddamn)[.!?]$/i.test(text)) {
      errs.push("profanity_as_last_word_R");
    }
  }

  // Blandness + specificity
  if (BLAND_OPENERS.test(text)) errs.push("bland_opener");
  if (BLAND_PHRASES.test(text)) errs.push("bland_phrase");
  if (!hasConcreteWord(text))   errs.push("needs_specific_detail");

  // Comedy device proxy: require some tension marker for spicy tones
  if (toneIsSpicy && !/[?!]/.test(text) && !/(but|yet|except|until|though|still)\b/i.test(text)) {
    errs.push("needs_device_tension");
  }

  return errs;
}

export function batchCheck(lines: string[], task: TaskObject): string[] {
  const errs = [...(lines.flatMap(l => validateLine(l, task)))];
  if (task.insert_words?.length && task.insert_word_mode === "at_least_one") {
    for (const w of task.insert_words) {
      const seen = lines.some(l => new RegExp(`\\b${esc(w)}(?:'s)?\\b`, "i").test(l));
      if (!seen) errs.push(`insert_word_never_used:${w}`);
    }
  }
  return errs;
}
