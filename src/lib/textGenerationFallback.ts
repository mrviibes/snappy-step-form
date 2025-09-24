/* ================================
   Universal Text Generation Fallback
   Never fails - always returns content
   ================================ */

import { prepareScenario, getDefaultContent, ScenarioInput, PreparedScenario, type ToneId, type CategoryType, type Rating } from './toneCompatibility';

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
  
  // Step 1: Prepare scenario with compatibility checks
  const scenarioInput: ScenarioInput = {
    category: input.category,
    subcategory: input.subcategory,
    tone: input.tone,
    rating: input.rating
  };
  
  const prepared = prepareScenario(scenarioInput);
  
  try {
    // Step 2: Try generation with prepared (compatible) settings
    const params = {
      ...input,
      tone: prepared.tone,
      rating: prepared.rating
    };
    
    const result = await generateFunction(params);
    
    // Step 3: Check if we got valid results and normalize format
    if (result && result.length > 0) {
      // Handle both string[] and option object formats
      const isOptionsFormat = typeof result[0] === 'object' && 'line' in result[0];
      
      if (isOptionsFormat) {
        const options = result as Array<{line: string, comedian: string}>;
        return {
          success: true,
          options,
          lines: options.map(opt => opt.line), // Keep legacy format for compatibility
          wasAdjusted: prepared.wasAdjusted,
          adjustmentReason: prepared.adjustmentReason,
          fallbackUsed: false
        };
      } else {
        const lines = result as string[];
        return {
          success: true,
          lines,
          wasAdjusted: prepared.wasAdjusted,
          adjustmentReason: prepared.adjustmentReason,
          fallbackUsed: false
        };
      }
    }
    
    // Step 4: If no results, try with safe playful-humorous fallback
    const safeFallbackParams = {
      ...input,
      tone: 'humorous' as ToneId,
      rating: 'PG' as Rating,
      insertWords: [] // Remove complex insert words that might cause failures
    };
    
    const fallbackResult = await generateFunction(safeFallbackParams);
    
    if (fallbackResult && fallbackResult.length > 0) {
      // Handle both formats for fallback too
      const isOptionsFormat = typeof fallbackResult[0] === 'object' && 'line' in fallbackResult[0];
      
      if (isOptionsFormat) {
        const options = fallbackResult as Array<{line: string, comedian: string}>;
        return {
          success: true,
          options,
          lines: options.map(opt => opt.line),
          wasAdjusted: true,
          adjustmentReason: 'Used safe fallback settings due to generation issues',
          fallbackUsed: true
        };
      } else {
        const lines = fallbackResult as string[];
        return {
          success: true,
          lines,
          wasAdjusted: true,
          adjustmentReason: 'Used safe fallback settings due to generation issues',
          fallbackUsed: true
        };
      }
    }
    
  } catch (error) {
    console.warn('Text generation failed:', error);
  }
  
  // Step 5: Last resort - use subcategory or category-specific default content
  const defaultLines = getDefaultContent(input.category, input.subcategory);
  
  return {
    success: true,
    lines: defaultLines,
    wasAdjusted: true,
    adjustmentReason: 'Used default content bank - generation service unavailable',
    fallbackUsed: true
  };
}

// Wrapper for existing text generation API
export async function generateTextSafely(params: GenerationInput): Promise<GenerationResult> {
  
  // This would be your existing text generation function
  const generateFunction = async (genParams: any) => {
    // Call your existing API here
    const response = await fetch('/api/generate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genParams)
    });
    
    if (!response.ok) {
      throw new Error(`Generation failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.lines || [];
  };
  
  return generateTextWithFallback(params, generateFunction);
}

// Quick check if combination will work before attempting generation
export function willCombinationWork(tone: ToneId, subcategory: string): boolean {
  const scenarioInput: ScenarioInput = {
    category: 'celebrations', // dummy category
    subcategory,
    tone,
    rating: 'PG'
  };
  
  const prepared = prepareScenario(scenarioInput);
  return !prepared.wasAdjusted || prepared.tone === tone;
}