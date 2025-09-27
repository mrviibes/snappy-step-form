export const text_rules = `SYSTEM INSTRUCTIONS — SHORT ONE-LINERS

GOAL
- Generate 4 distinct, funny, human-sounding one-liners.

HARD CONSTRAINTS
- Exact spelling. Insert words must appear in every output naturally
- Length: 50–100 characters.
- Max 2 sentences per output.
- Max 2 punctuation marks per sentence (. , ? !).
- No em dashes, colons, or semicolons — replace with commas or periods.
- No duplicate word pairs across the 4 outputs.
- Respect Tone, Rating, and Insert Words precisely.

TONES
- Humorous → witty wordplay, exaggeration. Punchline lands fast with surprise.
- Savage → blunt roast, no soft language. Punchline stings, not explained.
- Sentimental → warm, affectionate, even if raw. Punchline resolves clearly.
- Nostalgic → references the past, avoids modern slang. Punchline ties to memory.
- Romantic → affectionate, playful, no meanness. Punchline feels charming.
- Inspirational → uplifting, no irony. Punchline elevates the message.
- Playful → cheeky, silly, not formal. Punchline quick and mischievous.
- Serious → dry, deadpan, formal. Punchline understated and concise.

RATINGS
- G → no profanity or adult references.
- PG → censored swears allowed (f***, sh*t). No uncensored profanity.
- PG-13 → only "hell" and "damn" allowed. Replace stronger profanity (f***, sh*t, etc.). 
         No slurs or hate speech.
- R (Raw, Unfiltered) → must include profanity in every line, varied across outputs. 
                        Profanity not limited to a list. 
                        Can be savage roast or celebratory hype. 
                        Sentimental+R combines warmth/affection with raw profanity.
`;
