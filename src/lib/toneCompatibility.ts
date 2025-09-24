/* ================================
   Universal Tone-Category Compatibility System
   Prevents contradictory combinations + provides fallbacks
   ================================ */

export type ToneId = 'humorous' | 'savage' | 'sentimental' | 'nostalgic' | 'romantic' | 'inspirational' | 'playful' | 'serious';
export type CategoryType = 'celebrations' | 'sports' | 'daily_life' | 'pop_culture';
export type Rating = 'G' | 'PG' | 'PG-13' | 'R';

// Comprehensive subcategory-tone compatibility map
const SUBCATEGORY_COMPATIBILITY: Record<string, ToneId[]> = {
  // Jokes subcategories
  'puns': ['humorous', 'playful', 'nostalgic'],
  'dad-jokes': ['humorous', 'playful', 'sentimental'],
  'roast': ['savage', 'humorous', 'playful'],
  
  // Celebrations subcategories
  'birthday': ['playful', 'humorous', 'savage', 'sentimental'],
  'wedding': ['romantic', 'sentimental', 'playful', 'savage', 'humorous'],
  'engagement': ['romantic', 'playful', 'sentimental'],
  'graduation': ['playful', 'humorous', 'sentimental', 'nostalgic'],
  'baby-shower': ['playful', 'sentimental', 'humorous'],
  'anniversary': ['romantic', 'sentimental', 'nostalgic', 'humorous'],
  'retirement': ['nostalgic', 'sentimental', 'humorous'],
  
  // Sports subcategories
  'basketball': ['humorous', 'savage', 'romantic'],
  'tennis': ['humorous', 'playful'],
  'soccer': ['humorous', 'savage', 'playful'],
  'football': ['savage', 'humorous', 'playful'],
  
  // Work/Daily Life subcategories
  'work': ['savage', 'humorous', 'playful'],
  'dating': ['humorous', 'savage', 'romantic', 'playful'],
  'family': ['sentimental', 'humorous', 'playful'],
  
  // Daily Life subcategories (comprehensive coverage)
  'take-shower': ['sentimental', 'humorous', 'playful', 'nostalgic'],
  'morning-routine': ['humorous', 'sentimental', 'playful'],
  'commute': ['savage', 'humorous', 'sentimental'],
  'cooking': ['humorous', 'playful', 'savage', 'sentimental'],
  'cleaning': ['humorous', 'savage', 'playful'],
  'shopping': ['humorous', 'savage', 'playful'],
  'exercise': ['humorous', 'savage', 'inspirational', 'playful'],
  'sleep': ['sentimental', 'humorous', 'nostalgic', 'playful'],
  'coffee': ['humorous', 'sentimental', 'savage', 'romantic'],
  'laundry': ['humorous', 'savage', 'playful'],
  'phone': ['humorous', 'savage', 'romantic', 'sentimental'],
  'social-media': ['savage', 'humorous', 'playful'],
  'traffic': ['savage', 'humorous', 'playful'],
  'weather': ['humorous', 'sentimental', 'nostalgic', 'playful'],
  'pets': ['sentimental', 'humorous', 'playful', 'romantic'],
  'housework': ['humorous', 'savage', 'playful'],
  
  // Pop Culture subcategories
  'movies': ['humorous', 'savage', 'playful'],
  'music': ['humorous', 'nostalgic', 'playful'],
  'celebrities': ['savage', 'humorous', 'playful']
};

// Safe default content banks per category (never fail)
const DEFAULT_CONTENT: Record<string, string[]> = {
  jokes: [
    "I used to hate puns, but then they groan on me.",
    "Why did the dad joke cross the road? To get to the pun side.",
    "I'm reading a book on anti-gravity. It's impossible to put down.",
    "Parallel lines have so much in common — it's a shame they'll never meet."
  ],
  celebrations: [
    "Here's to more candles, more laughs, and fewer regrets.",
    "Every year older, every year bolder.",
    "Cheers to love, cake, and slightly embarrassing dance moves.",
    "Memories made today will outlast the frosting."
  ],
  sports: [
    "Winning isn't everything — but it sure feels good.",
    "Sports: the only place yelling at strangers is encouraged.",
    "Defense wins championships, offense wins the crowd.",
    "Some play for points, some play for pride."
  ],
  daily_life: [
    "Life's too short for bad coffee and boring conversations.",
    "Some days you're the pigeon, some days you're the statue.",
    "Adulting is just making it up as you go along.",
    "The best part of waking up is going back to sleep."
  ],
  
  // Specific daily-life subcategory fallbacks
  'take-shower': [
    "Every shower is a fresh start, literally and figuratively.",
    "Hot water therapy: cheaper than actual therapy.",
    "Showers: where all the best conversations happen with yourself.",
    "Clean body, clear mind, questionable singing voice."
  ],
  'morning-routine': [
    "Morning routines: the daily battle between who you want to be and who you are.",
    "Coffee first, human second, everything else eventually.",
    "Morning me and evening me are basically different people.",
    "Some mornings are for conquering, others are for surviving."
  ],
  'cooking': [
    "Cooking: where confidence meets reality and both leave disappointed.",
    "Following recipes is just a suggestion, right?",
    "Kitchen disasters make the best stories later.",
    "Burnt offerings: my specialty dish."
  ],
  'commute': [
    "Traffic: nature's way of teaching patience and creativity with curse words.",
    "My commute is basically a daily meditation on why I need a new job.",
    "Public transport: humanity's social experiment gone wrong.",
    "GPS said five minutes, reality said twenty."
  ],
  
  pop_culture: [
    "Reality TV: where common sense goes to die.",
    "Social media: connecting people through shared judgment.",
    "Celebrity news: because regular people aren't dramatic enough.",
    "Streaming services: where your free time goes to disappear."
  ]
};

export interface CompatibilityResult {
  compatible: boolean;
  level: 'compatible' | 'warning' | 'incompatible';
  message?: string;
  recommendedTones?: ToneId[];
}

// Get recommended tones for a subcategory
export function getRecommendedTones(subcategory: string): ToneId[] {
  const validTones = SUBCATEGORY_COMPATIBILITY[subcategory];
  if (validTones) {
    return validTones;
  }
  
  // Default safe recommendations
  return ['humorous', 'playful', 'savage'];
}

// Legacy compatibility check function (for existing UI)
export function checkToneCompatibility(
  toneId: ToneId, 
  category: CategoryType, 
  subcategory: string
): CompatibilityResult {
  const validTones = SUBCATEGORY_COMPATIBILITY[subcategory];
  
  if (validTones && !validTones.includes(toneId)) {
    return {
      compatible: false,
      level: 'incompatible',
      message: `${toneId} tone doesn't work well with ${subcategory}. Try ${validTones.join(', ')} instead.`,
      recommendedTones: validTones
    };
  }
  
  return { compatible: true, level: 'compatible' };
}

// Rating override logic - Rating always wins
function applyRatingOverride(tone: ToneId, rating: Rating): ToneId {
  if (rating === 'G' && tone === 'savage') return 'humorous'; // soften savage
  if (rating === 'G' && tone === 'romantic') return 'sentimental'; // keep it wholesome
  if (rating === 'R' && tone === 'sentimental') return 'savage'; // spice it up
  if (rating === 'PG' && tone === 'savage') return 'humorous'; // mild roast only
  return tone;
}

export interface ScenarioInput {
  category: CategoryType;
  subcategory: string;
  tone: ToneId;
  rating: Rating;
}

export interface PreparedScenario {
  tone: ToneId;
  rating: Rating;
  wasAdjusted: boolean;
  adjustmentReason?: string;
}

// Universal fallback - ensures valid tone/category combos
export function prepareScenario(input: ScenarioInput): PreparedScenario {
  const key = input.subcategory;
  const validTones = SUBCATEGORY_COMPATIBILITY[key];
  
  let tone = input.tone;
  let wasAdjusted = false;
  let adjustmentReason = '';
  
  // Check if tone is valid for this subcategory
  if (validTones && !validTones.includes(input.tone)) {
    tone = validTones[0]; // fallback to first valid tone
    wasAdjusted = true;
    adjustmentReason = `Tone adjusted from ${input.tone} to ${tone} to fit ${input.subcategory}`;
  } else if (!validTones) {
    // Unknown subcategory - use safe default
    tone = 'humorous';
    wasAdjusted = true;
    adjustmentReason = `Using safe default tone for ${input.subcategory}`;
  }
  
  // Apply rating override
  const originalTone = tone;
  tone = applyRatingOverride(tone, input.rating);
  if (originalTone !== tone) {
    wasAdjusted = true;
    adjustmentReason = adjustmentReason || `Tone adjusted from ${originalTone} to ${tone} for ${input.rating} rating`;
  }
  
  return {
    tone,
    rating: input.rating,
    wasAdjusted,
    adjustmentReason: wasAdjusted ? adjustmentReason : undefined
  };
}

// Get safe fallback content when generation fails completely
export function getDefaultContent(category: CategoryType, subcategory?: string): string[] {
  // Try subcategory-specific defaults first
  if (subcategory && DEFAULT_CONTENT[subcategory]) {
    return DEFAULT_CONTENT[subcategory];
  }
  
  // Fall back to category defaults
  return DEFAULT_CONTENT[category] || DEFAULT_CONTENT.jokes;
}

// Check if a tone-subcategory combo is valid
export function isValidCombination(tone: ToneId, subcategory: string): boolean {
  const validTones = SUBCATEGORY_COMPATIBILITY[subcategory];
  return !validTones || validTones.includes(tone);
}