export type ComedyStyleId =
  | "punchline-first" | "story" | "everyday-pain" | "pop-culture" | "self-deprecating"
  | "observation" | "absurdist" | "punny" | "word-flip" | "relatable-chaos"
  | "brutal-truth" | "playground-insult" | "roast-monologue" | "dark-irony" | "petty-comeback"
  | "confidence-flex" | "mock-advice" | "arrogant-confession" | "sarcastic-proverb" | "ego-trip"
  | "heartfelt-humor" | "memory-flash" | "rom-com" | "cheerful-irony" | "friendship-toast"
  | "love-roast" | "bittersweet-laugh" | "thankful-chaos" | "family-banter" | "flirty-line"
  | "self-improvement-roast" | "fake-guru" | "winners-sarcasm" | "life-lesson" | "hustle-parody"
  | "wisdom-twist" | "cheer-up" | "inner-peace" | "big-dream-roast" | "enlightened-idiot";

export const STYLE_DEFS: Record<ComedyStyleId, string> = {
  // Humorous 1-10
  "punchline-first": "Start with hit, explain after, tight reversal.",
  "story": "Mini scene, quick build, clean laugh.",
  "everyday-pain": "Relatable hassle, small misery, wink.",
  "pop-culture": "One clear reference, not name spam.",
  "self-deprecating": "Speaker takes the loss, charming.",
  "observation": "Noticing pattern, crisp contrast lands.",
  "absurdist": "Strange logic, still tracks, quick twist.",
  "punny": "Wordplay once, no groan stack.",
  "word-flip": "Expectation setup, meaning flips late.",
  "relatable-chaos": "Human mess, controlled punch finish.",
  // Savage 11-20
  "brutal-truth": "Plain hard truth, surgical wording.",
  "playground-insult": "Petty jab, clever not cruel.",
  "roast-monologue": "Stacked tag, one sentence cadence.",
  "dark-irony": "Bleak turn, witty restraint.",
  "petty-comeback": "Score settling, compact sting.",
  "confidence-flex": "Self as prize, playful brag.",
  "mock-advice": "Fake tip, wrong lesson.",
  "arrogant-confession": "Shameless reveal, smug grin.",
  "sarcastic-proverb": "Twisted saying, modern spin.",
  "ego-trip": "Hyperbole about self, crisp.",
  // Sentimental 21-30
  "heartfelt-humor": "Warm note, gentle laugh.",
  "memory-flash": "Nostalgia beat, soft twist.",
  "rom-com": "Playful flirt, hopeful tag.",
  "cheerful-irony": "Sweet tone, sly flip.",
  "friendship-toast": "Affection first, punch second.",
  "love-roast": "Kind tease, caring core.",
  "bittersweet-laugh": "Soft ache, light smile.",
  "thankful-chaos": "Gratitude amid mess, grin.",
  "family-banter": "Household dynamic, loving jab.",
  "flirty-line": "Confident tease, charming close.",
  // Inspirational 31-40
  "self-improvement-roast": "Boost with burn, upbeat.",
  "fake-guru": "Motivation parody, faux wisdom.",
  "winners-sarcasm": "Smug cheer, trophy tone.",
  "life-lesson": "Simple truth, funny turn.",
  "hustle-parody": "Grind culture send-up.",
  "wisdom-twist": "Aphorism, left turn ending.",
  "cheer-up": "Light lift, playful nudge.",
  "inner-peace": "Zen calm, tiny smirk.",
  "big-dream-roast": "Ambition joke, spicy hope.",
  "enlightened-idiot": "Dumb take, weirdly wise."
};

export const STYLES_BY_TONE: Record<string, ComedyStyleId[]> = {
  "Humorous": [
    "punchline-first", "story", "everyday-pain", "pop-culture", "self-deprecating",
    "observation", "absurdist", "punny", "word-flip", "relatable-chaos"
  ],
  "Savage": [
    "brutal-truth", "playground-insult", "roast-monologue", "dark-irony", "petty-comeback",
    "confidence-flex", "mock-advice", "arrogant-confession", "sarcastic-proverb", "ego-trip"
  ],
  "Sentimental": [
    "heartfelt-humor", "memory-flash", "rom-com", "cheerful-irony", "friendship-toast",
    "love-roast", "bittersweet-laugh", "thankful-chaos", "family-banter", "flirty-line"
  ],
  "Inspirational": [
    "self-improvement-roast", "fake-guru", "winners-sarcasm", "life-lesson", "hustle-parody",
    "wisdom-twist", "cheer-up", "inner-peace", "big-dream-roast", "enlightened-idiot"
  ]
};
