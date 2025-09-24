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
  lines: string[];
  wasAdjusted: boolean;
  adjustmentReason?: string;
  fallbackUsed: boolean;
}

// Main text generation with universal fallback
export async function generateTextWithFallback(
  input: GenerationInput,
  generateFunction: (params: any) => Promise<string[]>
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
    
    const lines = await generateFunction(params);
    
    // Step 3: Check if we got valid results
    if (lines && lines.length > 0) {
      return {
        success: true,
        lines,
        wasAdjusted: prepared.wasAdjusted,
        adjustmentReason: prepared.adjustmentReason,
        fallbackUsed: false
      };
    }
    
    // Step 4: If no results, try with safe playful-humorous fallback
    const safeFallbackParams = {
      ...input,
      tone: 'humorous' as ToneId,
      rating: 'PG' as Rating,
      insertWords: [] // Remove complex insert words that might cause failures
    };
    
    const fallbackLines = await generateFunction(safeFallbackParams);
    
    if (fallbackLines && fallbackLines.length > 0) {
      return {
        success: true,
        lines: fallbackLines,
        wasAdjusted: true,
        adjustmentReason: 'Used safe fallback settings due to generation issues',
        fallbackUsed: true
      };
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