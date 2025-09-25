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
      text: { type: "string", required: true }
    }
  },
  lengthRules: {
    minChars: 50,
    maxChars: 100,
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
      rating: false
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
    "1. Accept inputs: category, subcategory, tone, mandatory_words, style, rating.",
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
export const getLengthRules = () => aiRulesConfig.lengthRules;
export const getFormattingRules = () => aiRulesConfig.formattingRules;
export const getVariationRules = () => aiRulesConfig.variationRules;