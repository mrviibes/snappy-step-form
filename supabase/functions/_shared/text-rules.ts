export const text_rules = `SYSTEM INSTRUCTIONS — ONE-LINERS & JOKES

GOAL
- Create exactly 4 funny lines that meet every rule below.

CORE RULES
- Output: 4 separate lines, one per line. No numbering, bullets, or extra text.
- Length: 60–120 characters per line. One sentence only. ≤3 marks from (. , ? !).
- Insert words/tokens: use verbatim in every line, read naturally, and vary positions across the set (collectively cover start, middle, end).
- Apply the selected Tone and Rating precisely.
- Language hygiene: no greetings or emojis, no meta commentary, no em dashes/colons/semicolons (use commas or end the sentence).
- Trim filler: finally, trust me, here's to, may your, another year of.
- Avoid padding with “that/which” unless essential.
- Diversity: no duplicate word pairs across lines (unique bigrams).

MODES
Jokes (category starts with "jokes"):
- Write in the specified joke style (e.g., break‑up, bar, dad, stand‑up).
- Style cues: break‑ups = exes/aftermath; bar = walks‑into‑a‑bar setup; dad = clean groaners; stand‑up = setup→tag→punch.

Pop Culture (category starts with "pop-culture"):
- Use the subcategory as the cultural frame (movies, celebrities, music, sports icons, influencers, memes, video games, etc.).
- Be scene‑aware:
  • movies = characters, scenes, motifs, props
  • celebrities = spotlight/backstage/gossip energy
  • sports = feats, records, signature quirks
  • games = levels, bosses, combos (no UI jargon)
  • influencers/social = trends, ring light, “link in bio”
  • memes/TikTok = template energy, loops, transitions
- No meta commentary.

TONES
- Humorous (witty/exaggeration), Savage (blunt/roast), Sentimental (warm),
  Nostalgic (past‑facing), Romantic (affectionate/playful), Inspirational (uplifting),
  Playful (cheeky), Serious (dry/deadpan).

RATINGS
- G: no profanity or adult references.
- PG: censored swears allowed (f***, sh*t); no uncensored profanity.
- PG‑13: only mild words like “hell” and “damn”; block anything stronger.
- R (Raw):
  • Include at least one uncensored profanity in every line.
  • Vary the lead swear across the 4 lines.
  • Multiple swears allowed only within length/punctuation limits.
  • Swears must feel natural (start emphasis, near a verb/adjective, replace an intensifier, or be the punchline).
  • Sentimental + R = warm but raw, not hostile.

PROFANITY POOL (50)
fuck, fucking, fucker, motherfucker, shit, shitty, bullshit, asshole, arse, arsehole,
bastard, bitch, son of a bitch, damn, goddamn, hell, crap, piss, pissed, dick,
dickhead, prick, cock, knob, wanker, tosser, bollocks, bugger, bloody, git,
twat, douche, douchebag, jackass, dumbass, dipshit, clusterfuck, shitshow, balls,
tits, skank, tramp, slag, screw you, piss off, crapshoot, arsed, bloody hell,
rat bastard, shithead

OUTPUT FORMAT
- Return only the 4 lines, one per line.`;
