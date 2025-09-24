/* ================================
   Universal Text Generation Fallback
   Never fails - always returns content
   ================================ */

// Types moved inline since toneCompatibility was removed
export type ToneId = 'humorous' | 'savage' | 'roast' | 'playful' | 'wholesome' | 'motivational' | 'romantic' | 'dark' | 'random';
export type CategoryType = 'celebrations' | 'daily-life' | 'sports' | 'pop-culture' | 'jokes';
export type Rating = 'G' | 'PG' | 'PG-13' | 'R';

export interface GenerationInput {
  category: CategoryType;
  subcategory: string;
  tone: ToneId;
  rating: Rating;
  insertWords?: string[];
  style?: string;
}

export interface GenerationResult {
  success: boolean;
  lines?: string[]; // Legacy format
  options?: Array<{ line: string; comedian: string }>; // New format with comedian attribution
  wasAdjusted: boolean;
  adjustmentReason?: string;
  fallbackUsed: boolean;
}

// Main text generation with universal fallback
export async function generateTextWithFallback(
  input: GenerationInput,
  generateFunction: (params: any) => Promise<string[] | Array<{line: string, comedian: string}>>
): Promise<GenerationResult> {
  
  try {
    // Try generation with original settings
    const result = await generateFunction(input);
    
    if (result && result.length > 0) {
      // Check if result has comedian attribution (new format)
      if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' && 'line' in result[0]) {
        return {
          success: true,
          options: result as Array<{line: string, comedian: string}>,
          wasAdjusted: false,
          fallbackUsed: false
        };
      } else {
        // Legacy string array format
        return {
          success: true,
          lines: result as string[],
          wasAdjusted: false,
          fallbackUsed: false
        };
      }
    }
    
  } catch (error) {
    console.warn('Text generation failed:', error);
  }
  
  // Fallback: Try with safe defaults (humorous, PG)
  try {
    const fallbackParams = {
      ...input,
      tone: 'humorous' as ToneId,
      rating: 'PG' as Rating
    };
    
    const fallbackResult = await generateFunction(fallbackParams);
    
    if (fallbackResult && fallbackResult.length > 0) {
      // Check format again
      if (Array.isArray(fallbackResult) && fallbackResult.length > 0 && typeof fallbackResult[0] === 'object' && 'line' in fallbackResult[0]) {
        return {
          success: true,
          options: fallbackResult as Array<{line: string, comedian: string}>,
          wasAdjusted: true,
          adjustmentReason: 'Used safe fallback settings (humorous, PG)',
          fallbackUsed: true
        };
      } else {
        return {
          success: true,
          lines: fallbackResult as string[],
          wasAdjusted: true,
          adjustmentReason: 'Used safe fallback settings (humorous, PG)',
          fallbackUsed: true
        };
      }
    }
    
  } catch (error) {
    console.warn('Fallback generation also failed:', error);
  }
  
  // Last resort - use simple default content
  const defaultLines = getSimpleDefaultContent(input.category, input.subcategory);
  
  return {
    success: true,
    lines: defaultLines,
    wasAdjusted: true,
    adjustmentReason: 'Used default content bank - generation service unavailable',
    fallbackUsed: true
  };
}

// Simple default content generator
function getSimpleDefaultContent(category: CategoryType, subcategory: string): string[] {
  const defaults = {
    celebrations: ['Celebrate good times!', 'Time to party!', 'Let\'s make it memorable!'],
    'daily-life': ['Life is good!', 'Every day is a gift!', 'Making the most of it!'],
    sports: ['Game on!', 'Victory is sweet!', 'Champions never quit!'],
    'pop-culture': ['That\'s entertainment!', 'Pop culture rocks!', 'Trending now!'], 
    jokes: ['Ha ha ha!', 'That\'s funny!', 'Comedy gold!']
  };
  
  return defaults[category] || ['Great content!', 'Awesome!', 'Perfect!'];
}

// Wrapper function for API calls
export async function generateTextSafely(params: GenerationInput): Promise<GenerationResult> {
  const generateFunction = async (apiParams: any) => {
    const response = await fetch('/api/generate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiParams)
    });
    const data = await response.json();
    return data.lines || [];
  };
  
  return generateTextWithFallback(params, generateFunction);
}

// Quick check function (simplified without compatibility logic)
export function willCombinationWork(tone: ToneId, subcategory: string): boolean {
  // Without tone compatibility, all combinations are considered valid
  return true;
}