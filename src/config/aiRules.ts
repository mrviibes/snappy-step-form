export interface AIRulesConfig {
  docName: string;
  version: string;
  purpose: string;
  schema: {
    fields: {
      [key: string]: {
        type: string;
        required: boolean;
        enumRef?: string;
        maxItems?: number;
        items?: string;
      };
    };
  };
  lengthRules: {
    minChars: number;
    maxChars: number;
    enforceRange: boolean;
  };
  formattingRules: {
    oneLiner: boolean;
    avoidEmDash: boolean;
    allowedPunctuation: string[];
    punctuationNotes: string;
    mandatoryWordsUsage: string;
    capitalization: string;
    profanityPolicy: {
      [key: string]: string;
    };
  };
  variationRules: {
    setLevelRequirements: {
      minShortLinesLt75: number;
      minLongLinesGt100: number;
      requireQuestion: boolean;
      requireExclamation: boolean;
    };
    lineShapeMix: string[];
    punchlinePlacement: string[];
    randomizeWhenUnspecified: {
      [key: string]: boolean;
    };
  };
  tones: Tone[];
  styles: Style[];
  ratings: Rating[];
  comedianStylePresets: ComedianStyle[];
  validation: {
    rejectIf: string[];
    regexChecks: {
      [key: string]: string;
    };
  };
  generationPipeline: string[];
}

export interface Tone {
  id: string;
  name: string;
  summary: string;
}

export interface Style {
  id: string;
  name: string;
  tag: string;
  description: string;
}

export interface Rating {
  id: string;
  name: string;
  tag: string;
}

export interface ComedianStyle {
  id: string;
  name: string;
  flavor: string;
  notes: string;
}

export const aiRulesConfig: AIRulesConfig = {
  docName: "AI Rules – Step #2 Text Generation",
  version: "1.0.0",
  purpose: "Define constraints and presets for generating short-form celebration text that feels human and varied.",
  schema: {
    fields: {
      category: { type: "string", required: true },
      subcategory: { type: "string", required: false },
      tone: { type: "string", enumRef: "tones", required: true },
      mandatoryWords: { type: "array", items: "string", required: false, maxItems: 6 },
      style: { type: "string", enumRef: "styles", required: true },
      rating: { type: "string", enumRef: "ratings", required: true },
      comedianStyle: { type: "string", required: false },
      text: { type: "string", required: true }
    }
  },
  lengthRules: {
    minChars: 60,
    maxChars: 120,
    enforceRange: true
  },
  formattingRules: {
    oneLiner: true,
    avoidEmDash: true,
    allowedPunctuation: [".", ",", "!", "?", ":", ";", "'", "\"", "…"],
    punctuationNotes: "Ellipses allowed sparingly. No emoji unless rating >= \"PG\".",
    mandatoryWordsUsage: "All provided mandatory_words must appear naturally in the text.",
    capitalization: "Sentence case or natural human variations. No ALL CAPS lines.",
    profanityPolicy: {
      G: "no profanity",
      PG: "none or extremely mild euphemisms",
      "PG-13": "mild swears and innuendo allowed",
      R: "explicit language and adult themes allowed"
    }
  },
  variationRules: {
    setLevelRequirements: {
      minShortLinesLt75: 1,
      minLongLinesGt100: 1,
      requireQuestion: true,
      requireExclamation: true
    },
    lineShapeMix: [
      "short_punch",
      "mid_observation",
      "long_ramble",
      "question_form",
      "exclamation_tag"
    ],
    punchlinePlacement: ["front", "middle", "end"],
    randomizeWhenUnspecified: {
      tone: false,
      style: false,
      rating: false,
      comedianStyle: true
    }
  },
  tones: [
    { id: "humorous", name: "Humorous", summary: "Funny, witty, light" },
    { id: "savage", name: "Savage", summary: "Harsh, blunt, cutting" },
    { id: "sentimental", name: "Sentimental", summary: "Warm, heartfelt, tender" },
    { id: "nostalgic", name: "Nostalgic", summary: "Reflective, old-times, wistful" },
    { id: "romantic", name: "Romantic", summary: "Loving, passionate, sweet" },
    { id: "inspirational", name: "Inspirational", summary: "Motivating, uplifting, bold" },
    { id: "playful", name: "Playful", summary: "Silly, cheeky, fun" },
    { id: "serious", name: "Serious", summary: "Formal, direct, weighty" }
  ],
  styles: [
    { id: "generic", name: "Generic", tag: "plain", description: "Neutral wording, straightforward delivery." },
    { id: "sarcastic", name: "Sarcastic", tag: "ironic", description: "Dry, cutting, eye-roll vibe." },
    { id: "wholesome", name: "Wholesome", tag: "kind", description: "Warm, supportive, feel-good." },
    { id: "weird", name: "Weird", tag: "absurd", description: "Surreal, playful oddity." }
  ],
  ratings: [
    { id: "g", name: "G", tag: "clean" },
    { id: "pg", name: "PG", tag: "mild" },
    { id: "pg-13", name: "PG-13", tag: "edgy" },
    { id: "r", name: "R", tag: "explicit" }
  ],
  comedianStylePresets: [
    { id: "richard-pryor", name: "Richard Pryor", flavor: "raw confessional", notes: "raw, confessional storytelling" },
    { id: "george-carlin", name: "George Carlin", flavor: "sharp satirical", notes: "sharp, satirical, anti-establishment" },
    { id: "joan-rivers", name: "Joan Rivers", flavor: "biting roast", notes: "biting, fearless roast style" },
    { id: "eddie-murphy", name: "Eddie Murphy", flavor: "high-energy impressions", notes: "high-energy, character impressions" },
    { id: "robin-williams", name: "Robin Williams", flavor: "manic improv", notes: "manic, surreal improvisation" },
    { id: "jerry-seinfeld", name: "Jerry Seinfeld", flavor: "clean observational", notes: "clean observational minutiae" },
    { id: "chris-rock", name: "Chris Rock", flavor: "punchy commentary", notes: "punchy, social commentary" },
    { id: "dave-chappelle", name: "Dave Chappelle", flavor: "thoughtful edge", notes: "thoughtful, edgy narrative riffs" },
    { id: "bill-burr", name: "Bill Burr", flavor: "ranting cynicism", notes: "ranting, blunt cynicism" },
    { id: "louis-ck", name: "Louis C.K.", flavor: "dark self-deprecating", notes: "dark, self-deprecating honesty" },
    { id: "kevin-hart", name: "Kevin Hart", flavor: "animated storytelling", notes: "animated, personal storytelling" },
    { id: "ali-wong", name: "Ali Wong", flavor: "raunchy candor", notes: "raunchy, feminist candor" },
    { id: "sarah-silverman", name: "Sarah Silverman", flavor: "deadpan taboo", notes: "deadpan, ironic taboo-poking" },
    { id: "amy-schumer", name: "Amy Schumer", flavor: "edgy relatability", notes: "self-aware, edgy relatability" },
    { id: "tiffany-haddish", name: "Tiffany Haddish", flavor: "outrageous energy", notes: "bold, outrageous energy" },
    { id: "jim-gaffigan", name: "Jim Gaffigan", flavor: "clean domestic", notes: "clean, food/family obsession" },
    { id: "brian-regan", name: "Brian Regan", flavor: "clean goofy", notes: "clean, physical, goofy" },
    { id: "john-mulaney", name: "John Mulaney", flavor: "polished story", notes: "polished, clever storytelling" },
    { id: "bo-burnham", name: "Bo Burnham", flavor: "meta satire", notes: "meta, musical satire" },
    { id: "hannah-gadsby", name: "Hannah Gadsby", flavor: "subversive storytelling", notes: "vulnerable, subversive storytelling" },
    { id: "hasan-minhaj", name: "Hasan Minhaj", flavor: "cultural storytelling", notes: "cultural/political storytelling" },
    { id: "russell-peters", name: "Russell Peters", flavor: "cultural riffing", notes: "cultural riffing, accents" },
    { id: "aziz-ansari", name: "Aziz Ansari", flavor: "modern life takes", notes: "fast-paced, modern life takes" },
    { id: "patton-oswalt", name: "Patton Oswalt", flavor: "nerdy wit", notes: "nerdy, sharp wit storytelling" },
    { id: "norm-macdonald", name: "Norm Macdonald", flavor: "absurd deadpan", notes: "absurd, slow-burn deadpan" },
    { id: "mitch-hedberg", name: "Mitch Hedberg", flavor: "surreal one-liner", notes: "surreal, stoner one-liners" },
    { id: "steven-wright", name: "Steven Wright", flavor: "ultra-dry absurd", notes: "ultra-dry, absurd one-liners" },
    { id: "ellen-degeneres", name: "Ellen DeGeneres", flavor: "relatable light", notes: "relatable, observational, light" },
    { id: "chelsea-handler", name: "Chelsea Handler", flavor: "brash honesty", notes: "brash, self-aware honesty" },
    { id: "ricky-gervais", name: "Ricky Gervais", flavor: "irreverent roast", notes: "mocking, irreverent roast" }
  ],
  validation: {
    rejectIf: [
      "text.length < length_rules.min_chars",
      "text.length > length_rules.max_chars",
      "contains_em_dash",
      "missing_mandatory_word",
      "rating_violates_profanity_policy"
    ],
    regexChecks: {
      containsEmDash: "[\\u2014]"
    }
  },
  generationPipeline: [
    "1. Accept inputs: category, subcategory, tone, mandatory_words, style, rating, optional comedian_style.",
    "2. Select line_shape and punchline_placement based on variation_rules.",
    "3. Compose draft honoring tone, style, rating.",
    "4. Insert all mandatory_words naturally.",
    "5. Enforce length_rules with targeted trims or expansions.",
    "6. Run formatting_rules and profanity policy for the selected rating.",
    "7. Final validate against validation.reject_if.",
    "8. If failed, recompose with different line_shape or punchline_placement and retry."
  ]
};

// Helper functions to get configuration data
export const getTones = () => aiRulesConfig.tones;
export const getStyles = () => aiRulesConfig.styles;
export const getRatings = () => aiRulesConfig.ratings;
export const getComedianStyles = () => aiRulesConfig.comedianStylePresets;
export const getLengthRules = () => aiRulesConfig.lengthRules;
export const getFormattingRules = () => aiRulesConfig.formattingRules;
export const getVariationRules = () => aiRulesConfig.variationRules;

// Random comedian selector for when comedian style should be randomized
export const getRandomComedianStyle = () => {
  const styles = aiRulesConfig.comedianStylePresets;
  const randomIndex = Math.floor(Math.random() * styles.length);
  return styles[randomIndex];
};