// ================== TEXT RULES (ALL CATEGORIES) ==================

export const general_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS

GOAL
Write 4 funny, punchy, human-sounding distinct one-liners.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤3 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "INSERT WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the selected Tone and Rating. If Insert Words are provided, include exactly one per line and place it naturally (not tacked on).
- INSERT WORD FLOW: prefer after the first comma or subject; allow possessive (“Name’s”); never start with a comma or end on the name.
- FOCUS: Center every line on the MOST SPECIFIC SELECTED THEME provided. If the theme is a concrete subject (e.g., "Corgi", "espresso"), you may name it directly and the line must clearly be about it.
- No duplicate word pairs across the 4 outputs.
- No meta-writing about writing jokes.
- Avoid clichés/greeting-card phrasing unless the theme explicitly requires them.
- R PROFANITY (when Rating = R): integrate naturally inside the sentence (prefer after the honoree's name), never as the final word.

TONES
- Humorous / Savage / Sentimental / Nostalgic / Romantic / Inspirational / Playful / Serious.

RATINGS
- Ratings guide (language + topics):
  G  → wholesome; no profanity; gentle themes.
  PG → mild words fully spelled (heck, dang, mess, nonsense); kid-safe humor; no sexual content.
  PG-13 → allow “hell”/“damn”; mild innuendo/romance; no explicit sex or graphic content; no “goddamn”.
  R  → strong profanity required; adult themes (sex, booze, chaos); no slurs; no sexual violence; not graphic.`;

export const celebration_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR CELEBRATIONS

GOAL
Write 4 hilarious, personal one-liners for a special occasion that read naturally—smooth, human, not clunky.

RULES
- Exactly 4 lines, 0–120 characters each. One sentence per line, end with punctuation.
- Max 3 punctuation marks per line (. , ? !). No numbering, lists, or em/en dashes (— / –).
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "INSERT WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the given Tone and Rating. If Insert Words are provided, include exactly one per line and place it naturally (not tacked on).
- INSERT WORD FLOW: prefer after the first comma or subject; allow possessive (“Name’s”); never start with a comma or end on the name.
- Focus on the honoree: make it celebratory, personal, and funny.
- No duplicate word pairs across the 4 lines.
- Keep lines witty, playful, and occasion-centered (birthday, wedding, anniversary, graduation).
- R PROFANITY (when Rating = R): weave inside the sentence (prefer after the honoree's name), never as the last word.
- Ratings guide (language + topics):
  G  → all-ages; wholesome; no profanity or sexual content; gentle stakes only.
  PG → mild words (heck, dang); light peril/slapstick; chaste affection; kid-safe.
  PG-13 → “hell”/“damn” ok; edgier teasing; mild innuendo/romance; non-graphic violence; no explicit sex/nudity; no graphic gore; no “goddamn”.
  R  → strong profanity required; adult themes (sex, booze, chaos); stronger but non-graphic violence; no slurs or hate; no sexual violence.`;

export const daily_life_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR DAILY LIFE

GOAL
Write 4 relatable, universal one-liners about everyday experiences.

HARD CONSTRAINTS
- Same base constraints as general_text_rules (inherit all).
- Category focus: specific daily routine, moment, or situation (coffee, commute, chores).
- RELATABILITY: make it feel like “we’ve all been there.”
- R PROFANITY: integrate naturally after subject/name or mid-sentence (e.g., "Coffee, you beautiful fucking miracle"); never end sentences with profanity.`;

export const sports_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR SPORTS

GOAL
Write 4 action-packed, competitive one-liners about sports and athletics.

HARD CONSTRAINTS
- Same base constraints as general_text_rules (inherit all).
- Focus: specific sport, position, moment, or achievement.
- Energy: high-tempo verbs, competitive tone; use sport terms naturally.
- R PROFANITY: integrate naturally after athlete's name or action verb (e.g., "Jordan's fucking unstoppable on the court"); never end sentences with profanity.`;

export const joke_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR JOKES

GOAL
Write 4 sharp one-liners with clear punchlines.

HARD CONSTRAINTS
- Same base constraints as general_text_rules (inherit all).
- Structure: setup → punch; surprise lands at the end.
- Label policy: never say the humor type; imply it.
- R PROFANITY: integrate naturally for emphasis (e.g., "That's a fucking brilliant punchline"); never end sentences with profanity.

JOKE GUIDE
- Dad Jokes: groan-worthy, wholesome puns.
- Puns: wordplay on double meanings/sound-alikes.
- Knock-Knock: follow format if space allows.
- One-Liners: crisp, self-contained.
- Anti-Jokes: literal, expectation-subverting.`;

export const pop_culture_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR POP CULTURE

GOAL
Write 4 clever, culturally-aware one-liners about movies, music, celebrities, or trends.

HARD CONSTRAINTS
- Same base constraints as general_text_rules (inherit all).
- Focus: one clear subject; keep references recognizable.
- R PROFANITY: integrate naturally (e.g., "That movie was fucking incredible"); never end sentences with profanity.`;

export const miscellaneous_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR MISCELLANEOUS TOPICS

GOAL
Write 4 universally relatable one-liners about animals, food, professions, or other varied subjects.

HARD CONSTRAINTS
- Same base constraints as general_text_rules (inherit all).
- Focus: the most specific subject; keep it authentic to the topic.
- R PROFANITY: integrate naturally for emphasis (e.g., "Dogs are fucking loyal companions"); never end sentences with profanity.`;

export const custom_design_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR CUSTOM/USER-DEFINED TOPICS

GOAL
Write 4 flexible, adaptable one-liners for any user-defined theme.

HARD CONSTRAINTS
- Same base constraints as general_text_rules (inherit all).
- Focus: the most specific user theme; if unclear, default to relatable, human experiences.
- R PROFANITY: integrate naturally for user's theme (e.g., "This wedding is fucking beautiful"); never end sentences with profanity.`;

// ======= Minimal tone tags for prompting (3–4 words each) =======
export const TONE_TAGS: Record<string, string> = {
  humorous:      "funny, witty, light",
  savage:        "harsh, blunt, cutting",
  sentimental:   "warm, heartfelt, tender",
  nostalgic:     "reflective, old-times, wistful",
  romantic:      "loving, passionate, sweet",
  inspirational: "motivating, uplifting, bold",
  playful:       "silly, cheeky, fun",
  serious:       "formal, direct, weighty"
};
