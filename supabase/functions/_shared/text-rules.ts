// ================== TEXT RULES (ALL CATEGORIES) ==================

export const general_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS

GOAL
Write 4 funny, punchy, human-sounding distinct one-liners.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "SPECIFIC WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- FOCUS: Center every line on the MOST SPECIFIC SELECTED THEME (leaf). If the theme is a concrete subject (e.g., "Corgi", "espresso"), you may name it directly and the line must clearly be about it.
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- No meta-writing about writing jokes.
- Avoid clichés/greeting-card phrasing unless the leaf theme explicitly requires them.
- R PROFANITY (when Rating = R): integrate naturally inside the sentence (prefer after the honoree's name), never as the final word.

TONES
- Humorous → witty wordplay, exaggeration. Punchline lands fast with surprise.
- Savage → blunt roast, no soft language. Punchline stings, not explained.
- Sentimental → warm, affectionate, even if raw. Punchline resolves clearly.
- Nostalgic → references the past; avoids modern slang. Punchline ties to memory.
- Romantic → affectionate, playful, no meanness. Punchline feels charming.
- Inspirational → uplifting, no irony. Punchline elevates the message.
- Playful → cheeky, silly, not formal. Punchline quick and mischievous.
- Serious → dry, deadpan, formal. Punchline understated and concise.

RATINGS
- G → no profanity or adult references.
- PG → censored swears allowed (f**k, s**t). No uncensored profanity.
- PG-13 → only "hell" and "damn" allowed; replace stronger profanity; no slurs or hate speech.
- R (Raw, Unfiltered) → profanity required in every line; varied; no slurs or hate speech; can be roast or celebratory hype; Sentimental+R mixes warmth with raw language.`;

export const celebration_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR CELEBRATIONS

GOAL
Write 4 hilarious, personal one-liners for a special occasion that read naturally—smooth, human, not clunky.

RULES
- Exactly 4 lines, 0–120 characters each. One sentence per line, end with punctuation.
- Max 2 punctuation marks per line (. , ? !). No numbering, lists, or em/en dashes (— / –).
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "SPECIFIC WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the given Tone and Rating. If Specific Words are provided, use each once per line.
- Focus on the honoree: make it celebratory, personal, and funny.
- No duplicate word pairs across the 4 lines.
- Keep lines witty, playful, and occasion-centered (birthday, wedding, anniversary, graduation).
- R PROFANITY (when Rating = R): weave inside the sentence (prefer after the honoree's name), never as the last word.
- Ratings guide language:
  G → wholesome.
  PG → censored swears allowed.
  PG-13 → only "hell" or "damn".
  R → profanity required in every line (no slurs).`;

export const daily_life_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR DAILY LIFE

GOAL
Write 4 relatable, universal one-liners about everyday experiences.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "SPECIFIC WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- FOCUS: Center on the specific daily routine, moment, or situation (morning coffee, Monday blues, commute, housework, etc.).
- RELATABILITY: Make it feel like "we've all been there."
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- Avoid clichés unless the leaf is itself a cliché trope being referenced.
- R PROFANITY (when Rating = R): integrate naturally inside the sentence, never as the final word.

TONES/RATINGS
- (same as general_text_rules)`;

export const sports_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR SPORTS

GOAL
Write 4 action-packed, competitive one-liners about sports and athletics.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "SPECIFIC WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- FOCUS: Center on the specific sport, position, moment, or athletic achievement.
- ENERGY: Keep it high-energy, competitive, and action-oriented.
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- Use sport-specific terminology naturally when appropriate.
- R PROFANITY (when Rating = R): integrate naturally inside the sentence, never as the final word.

TONES/RATINGS
- (same as general_text_rules)`;

export const joke_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR JOKES

GOAL
Write 4 hilarious, well-structured jokes with clear setups and punchlines.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "SPECIFIC WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- FOCUS: Center on the specific joke type (dad jokes, puns, knock-knock, one-liners, anti-jokes, etc.).
- STRUCTURE: Setup → Punchline. The surprise or twist should land at the end.
- WORDPLAY: For puns and dad jokes, emphasize wordplay and double meanings.
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- Avoid explaining the joke; let the punchline speak for itself.
- R PROFANITY (when Rating = R): integrate naturally inside the sentence, never as the final word.

JOKE-SPECIFIC GUIDANCE
- Dad Jokes → groan-worthy puns, wholesome, family-friendly setup-punchline.
- Puns → clever wordplay on double meanings or similar sounds.
- Knock-Knock → follow format: "Knock knock. Who's there? X. X who? Punchline." (if space allows).
- One-Liners → sharp, concise, standalone wit with immediate impact.
- Anti-Jokes → subvert expectations with literal or mundane punchlines.

TONES/RATINGS
- (same as general_text_rules)`;

export const pop_culture_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR POP CULTURE

GOAL
Write 4 clever, culturally-aware one-liners about movies, music, celebrities, or trends.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "SPECIFIC WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- FOCUS: Center on the specific pop culture subject (movie, song, celebrity, TV show, meme, trend, etc.).
- REFERENCES: Use recognizable cultural touchpoints; balance timely with timeless.
- FAN LANGUAGE: Can use fandom-specific language if appropriate to the theme.
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- Avoid overly niche references unless the leaf theme is that specific.
- R PROFANITY (when Rating = R): integrate naturally inside the sentence, never as the final word.

TONES/RATINGS
- (same as general_text_rules)`;

export const miscellaneous_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR MISCELLANEOUS TOPICS

GOAL
Write 4 universally relatable one-liners about animals, food, professions, or other varied subjects.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "SPECIFIC WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- FOCUS: Center on the most specific subject (e.g., "Golden Retriever" not just "dogs", "espresso" not just "coffee").
- ADAPTABILITY: Adjust tone/approach based on subject matter:
  Animals → playful, observational about behavior/traits.
  Food → sensory, experiential, cravings, or cooking mishaps.
  Professions → observational, insider humor, workplace dynamics.
  Other → follow the natural vibe of the specific topic.
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- Make it feel authentic to the subject matter.
- R PROFANITY (when Rating = R): integrate naturally inside the sentence, never as the final word.

TONES/RATINGS
- (same as general_text_rules)`;

export const custom_design_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR CUSTOM/USER-DEFINED TOPICS

GOAL
Write 4 flexible, adaptable one-liners for any user-defined theme or custom category.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- LABEL POLICY: never output labels or headers (e.g., "TONE:", "RATING:", "SPECIFIC WORDS:").
- COMMA HYGIENE: no leading commas, no double commas, exactly one space after commas.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- FOCUS: Center every line on the MOST SPECIFIC USER-PROVIDED THEME. If unclear, default to relatable, human experiences.
- FLEXIBILITY: Since this is a catch-all, prioritize user intent and adapt style to match the subject.
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- Avoid generic filler; make every line specific to the user's chosen theme.
- R PROFANITY (when Rating = R): integrate naturally inside the sentence, never as the final word.

TONES/RATINGS
- (same as general_text_rules)`;
