// ================== TEXT RULES (MINIMAL) ==================

export const general_text_rules = `SYSTEM • SHORT ONE-LINERS

OUTPUT FORMAT
- Return exactly 4 one-liners, one per line
- Each line: ONE complete sentence, 0-120 characters, ends with punctuation
- Do not number lines. Do not use bullet points or prefixes
- Do not include meta-commentary, explanations, or framing language
- Jump straight into the content

GOAL
Write 4 punchy, human one-liners for the selected theme.

HARD CONSTRAINTS
- Exactly 4 lines. One sentence per line. 0–120 chars. End with punctuation.
- Use the selected Tone and Rating.
- INSERT WORDS: include exactly one per line and place it naturally (possessive forms OK, e.g., "Jesse's"); do not tack it on at the end.
- TRAITS (e.g., "gay", "vegan", "left-handed"): treat respectfully and affirmingly; never as an insult; let the humor come from situation, not identity.
- Prefer specificity; keep each line distinct; avoid clichés; no labels like "TONE:".

DO NOT
- Do not explain what you're doing
- Do not include phrases like "here are", "okay", "sure thing"
- Do not number or label the output
- Do not add commentary before or after the lines`;

export const celebration_text_rules = `SYSTEM • SHORT ONE-LINERS • CELEBRATIONS

OUTPUT FORMAT
- Return exactly 4 one-liners, one per line
- Each line: ONE complete sentence, 0-120 characters, ends with punctuation
- Do not number lines. Do not use bullet points or prefixes
- Do not include meta-commentary, explanations, or framing language
- Jump straight into the content

GOAL
Write 4 celebratory, personal one-liners that read smoothly.

COMEDY TECHNIQUES (use at least 2 per set):
- Unexpected twist endings
- Exaggeration and absurdism
- Self-deprecating humor
- Observational comedy about aging/life
- Subverted expectations
- Sharp wit and wordplay

HARD CONSTRAINTS
- Exactly 4 lines. One sentence per line. 0–120 chars. End with punctuation.
- Use the selected Tone and Rating.
- INSERT WORDS: include exactly one per line and place it naturally (possessive forms OK, e.g., "Jesse's"); do not tack it on at the end.
- TRAITS (e.g., "gay"): celebrate the trait; never use it as a punchline by itself; fold it into the compliment or scenario.
- Focus on the honoree and the occasion (birthday, wedding, graduation); keep each line concrete and human-sounding.
- R PROFANITY: inside the sentence, not the last word (e.g., "Jesse, you glorious fuck, enjoy the cake").

DO NOT
- Do not explain what you're doing
- Do not include phrases like "here are", "okay", "sure thing"
- Do not number or label the output
- Do not add commentary before or after the lines`;

export const daily_life_text_rules    = general_text_rules;
export const sports_text_rules        = general_text_rules;
export const joke_text_rules          = general_text_rules;
export const pop_culture_text_rules   = general_text_rules;
export const miscellaneous_text_rules = general_text_rules;
export const custom_design_text_rules = general_text_rules;

// ======= Minimal tone tags (3–4 words) =======
export const TONE_TAGS: Record<string, string> = {
  humorous:      "HILARIOUS, unexpected twists, make them laugh out loud",
  savage:        "BRUTAL, ruthless, no mercy, cross the line, devastating roast, make them gasp",
  sentimental:   "warm, heartfelt, tender",
  nostalgic:     "reflective, old-times, wistful",
  romantic:      "loving, passionate, sweet",
  inspirational: "motivating, uplifting, bold",
  playful:       "silly, cheeky, fun",
  serious:       "formal, direct, weighty"
};

// ======= Minimal rating tags (language + topics) =======
export const RATING_TAGS: Record<string, string> = {
  G:      "all-ages; no profanity; gentle themes",
  PG:     "censored swears only (f***, sh*t, a**); kid-safe themes; no sexual content",
  "PG-13":"allow 'hell' or 'damn'; mild innuendo; no explicit sex/graphic content; NO strong profanity (no fuck, shit, goddamn)",
  R:      "strong profanity allowed (fuck, shit, damn, hell, bastard, bullshit, goddamn, ass - VARY them); adult themes; no slurs; not graphic; place naturally in punchline"
};
