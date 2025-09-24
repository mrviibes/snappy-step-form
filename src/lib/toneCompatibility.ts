/* ================================
   Tone-Category Compatibility System
   Prevents contradictory combinations like "puns + serious"
   ================================ */

export type ToneId = 'humorous' | 'savage' | 'sentimental' | 'nostalgic' | 'romantic' | 'inspirational' | 'playful' | 'serious';
export type CategoryType = 'celebrations' | 'sports' | 'daily_life' | 'pop_culture';

// Define tone-category compatibility matrix
const TONE_CATEGORY_COMPATIBILITY: Record<ToneId, {
  compatible: string[]; // subcategories that work well
  incompatible: string[]; // subcategories that clash
  warning?: string[]; // subcategories that might not work well but aren't forbidden
}> = {
  'humorous': {
    compatible: ['*'], // works with everything
    incompatible: [],
    warning: []
  },
  'savage': {
    compatible: ['*'], 
    incompatible: [],
    warning: ['baby-shower', 'wedding'] // might be too harsh for some celebrations
  },
  'romantic': {
    compatible: ['wedding', 'engagement', 'anniversary', 'valentines'],
    incompatible: ['puns', 'dad-jokes', 'roast'], // romantic puns/roasts are contradictory
    warning: ['work', 'graduation'] // romantic tone might not fit professional/academic contexts
  },
  'playful': {
    compatible: ['*'],
    incompatible: [],
    warning: []
  },
  'inspirational': {
    compatible: ['graduation', 'promotion', 'achievement', 'retirement', 'new-job'],
    incompatible: ['puns', 'dad-jokes'], // inspirational puns don't make sense
    warning: ['roast'] // inspirational roasts are contradictory
  },
  'sentimental': {
    compatible: ['wedding', 'engagement', 'baby-shower', 'graduation', 'birthday', 'anniversary', 'retirement'],
    incompatible: ['puns', 'dad-jokes', 'roast'], // sentimental puns/roasts are contradictory
    warning: ['work'] // might be too soft for workplace humor
  },
  'nostalgic': {
    compatible: ['graduation', 'birthday', 'anniversary', 'retirement', 'reunion'],
    incompatible: ['puns', 'dad-jokes'], // nostalgic puns don't make sense
    warning: ['work'] // workplace nostalgia can be hit or miss
  },
  'serious': {
    compatible: ['graduation', 'promotion', 'achievement', 'new-job', 'retirement'],
    incompatible: ['puns', 'dad-jokes'], // serious puns are contradictory by nature
    warning: ['birthday', 'party'] // serious tone might kill the party vibe
  }
};

// Special subcategory rules that override general compatibility
const SUBCATEGORY_TONE_RULES: Record<string, {
  forbidden: ToneId[];
  recommended: ToneId[];
  explanation?: string;
}> = {
  'puns': {
    forbidden: ['sentimental', 'nostalgic', 'serious'],
    recommended: ['playful', 'humorous', 'savage'],
    explanation: 'Puns are inherently light and wordplay-focused. Serious or emotional tones create contradictions.'
  },
  'dad-jokes': {
    forbidden: ['sentimental', 'nostalgic', 'serious'], 
    recommended: ['playful', 'humorous', 'savage'],
    explanation: 'Dad jokes are meant to be groan-worthy and light. Emotional tones don\'t fit the format.'
  },
  'roast': {
    forbidden: ['sentimental', 'romantic'],
    recommended: ['savage', 'humorous', 'playful'],
    explanation: 'Roasts require sharp, cutting humor. Sentimental tones defeat the purpose.'
  },
  'baby-shower': {
    forbidden: [],
    recommended: ['playful', 'sentimental', 'humorous'],
    explanation: 'Baby celebrations work best with gentle, warm humor.'
  }
};

export interface CompatibilityResult {
  compatible: boolean;
  level: 'compatible' | 'warning' | 'incompatible';
  message?: string;
  recommendedTones?: ToneId[];
}

export function checkToneCompatibility(
  toneId: ToneId, 
  category: CategoryType, 
  subcategory: string
): CompatibilityResult {
  
  // Check specific subcategory rules first
  const subcatRule = SUBCATEGORY_TONE_RULES[subcategory];
  if (subcatRule) {
    if (subcatRule.forbidden.includes(toneId)) {
      return {
        compatible: false,
        level: 'incompatible',
        message: `${toneId} tone doesn't work well with ${subcategory}. ${subcatRule.explanation}`,
        recommendedTones: subcatRule.recommended
      };
    }
  }
  
  // Check general tone compatibility matrix
  const toneRules = TONE_CATEGORY_COMPATIBILITY[toneId];
  if (!toneRules) {
    return { compatible: true, level: 'compatible' };
  }
  
  // If incompatible list includes this subcategory
  if (toneRules.incompatible.includes(subcategory)) {
    return {
      compatible: false,
      level: 'incompatible', 
      message: `${toneId} tone creates contradictions with ${subcategory} content.`,
      recommendedTones: subcatRule?.recommended || ['playful', 'humorous', 'savage']
    };
  }
  
  // If warning list includes this subcategory
  if (toneRules.warning?.includes(subcategory)) {
    return {
      compatible: true,
      level: 'warning',
      message: `${toneId} tone might not be the best fit for ${subcategory}. Consider a different approach.`
    };
  }
  
  // If compatible list includes '*' (everything) or specific subcategory
  if (toneRules.compatible.includes('*') || toneRules.compatible.includes(subcategory)) {
    return { compatible: true, level: 'compatible' };
  }
  
  // Default to compatible if no specific rules found
  return { compatible: true, level: 'compatible' };
}

export function getRecommendedTones(subcategory: string): ToneId[] {
  const subcatRule = SUBCATEGORY_TONE_RULES[subcategory];
  if (subcatRule?.recommended) {
    return subcatRule.recommended;
  }
  
  // Default recommendations based on subcategory type
  const defaultRecommendations: Record<string, ToneId[]> = {
    'wedding': ['sentimental', 'humorous', 'romantic'],
    'birthday': ['playful', 'humorous', 'savage'],
    'graduation': ['nostalgic', 'sentimental', 'humorous'],
    'work': ['savage', 'humorous', 'playful'],
    'puns': ['playful', 'humorous', 'savage'],
    'dad-jokes': ['playful', 'humorous', 'savage']
  };
  
  return defaultRecommendations[subcategory] || ['humorous', 'playful', 'savage'];
}