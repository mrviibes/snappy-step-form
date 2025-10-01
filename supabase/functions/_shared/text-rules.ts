// ================== TEXT RULES (ALL CATEGORIES) ==================

export const general_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS

GOAL
Write 4 funny, punchy, human-sounding distinct one-liners.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- FOCUS: Center every line on the MOST SPECIFIC SELECTED THEME (leaf). If the theme is a concrete subject (e.g., "Corgi", "espresso"), you may name it directly and the line must clearly be about it.
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- No meta-writing about writing jokes.
- Avoid clichés/greeting-card phrasing unless the leaf theme explicitly requires them.
- COMMA HYGIENE: no leading commas, no double commas, space after commas.
- PROFANITY INTEGRATION (R only): integrate naturally inside the sentence (prefer after the honoree's name), never tacked on at the end.

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
- R (Raw, Unfiltered) → profanity required in every line; varied; no slurs or hate speech; integrate naturally (never final word).`;

export const celebration_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR CELEBRATIONS

GOAL
Write 4 hilarious, personal one-liners for a special occasion.

RULES
- Exactly 4 lines, 0–120 characters each. One sentence per line, end with punctuation.
- Max 2 punctuation marks per line (. , ? !). No numbering or lists.
- Follow the given Tone and Rating. If Specific Words are provided, use each once per line.
- Focus on the honoree: make it celebratory, personal, and funny.
- No duplicate word pairs across the 4 lines.
- Keep lines witty, playful, and occasion-centered (birthday, wedding, anniversary, graduation).
- COMMA HYGIENE: no leading commas, no double commas, space after commas.
- PROFANITY INTEGRATION (R only): weave inside the sentence (prefer after the honoree's name), never tacked on at the end.
- Ratings guide language:
  G → wholesome.
  PG → censored swears allowed.
  PG-13 → only “hell” or “damn”.
  R → profanity required in every line (no slurs).`;

export const joke_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- LABEL POLICY: Never use the words "joke" / "jokes" or say the humor label (e.g., "dad-joke", "pun"). Imply the style through wording only.
- FOCUS: Center every line on the MOST SPECIFIC SELECTED THEME (leaf). If the theme is a concrete subject (e.g., "Corgi", "espresso"), you may name it directly; if the theme is a style label (e.g., "dad-jokes"), never name the label—only imply it.
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- Avoid clichés/greeting-card phrasing unless the leaf theme explicitly requires them.
- COMMA HYGIENE: no leading commas, no double commas, space after commas.
- PROFANITY INTEGRATION (R only): integrate naturally inside the sentence, never final word.

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
- G / PG / PG-13 / R (same rules as above).`;

export const celebrations_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR CELEBRATIONS

GOAL
Write 4 celebratory, personal, heartfelt one-liners for special occasions.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- Follow the selected Tone and Rating. Use any required insert words naturally (names, ages, etc.).
- FOCUS: Make the recipient/honoree feel special. Center on the specific celebration (birthday, wedding, anniversary, graduation, etc.).
- PERSONAL CONNECTION: Use warm, congratulatory language. Make it feel like it's FOR them.
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- Emphasize milestones, achievements, and joy.
- Avoid clichés/greeting-card phrasing unless the celebration explicitly calls for them.
- COMMA HYGIENE + PROFANITY INTEGRATION: same as above.

TONES
- Humorous / Savage / Sentimental / Nostalgic / Romantic / Inspirational / Playful / Serious

RATINGS
- (same as text_rules)`;

// The rest of your category rules remain unchanged.
export const daily_life_text_rules = `SYSTEM INSTRUCTIONS: SHORT ONE-LINERS FOR DAILY LIFE

GOAL
Write 4 relatable, universal one-liners about everyday experiences.

HARD CONSTRAINTS
- Output exactly 4 one-liners (0–120 characters). One sentence per line, end with punctuation.
- ≤2 punctuation marks per line (. , ? !). No lists, headers, or numbering.
- Follow the selected Tone and Rating. Use any required insert words naturally.
- FOCUS: Center on the specific daily routine, moment, or situation (morning coffee, Monday blues, commute, housework, etc.).
- RELATABILITY: Make it feel like "we've all been there."
- If Specific Words are provided, include exactly one per line (once, not repeated).
- No duplicate word pairs across the 4 outputs.
- Avoid clichés unless the leaf is itself a cliché trope being referenced.
- COMMA HYGIENE + PROFANITY INTEGRATION: same as above.

TONES/RATINGS
- (same as text_rules)`;

// … sports_text_rules, pop_culture_text_rules, miscellaneous_text_rules, custom_design_text_rules remain the same content you pasted, plus the final line:
 // “COMMA HYGIENE + PROFANITY INTEGRATION: same as above.”
