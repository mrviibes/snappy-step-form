import { aiRulesConfig } from '@/config/aiRules';

export interface TextGenerationParams {
  tone: string;
  category?: string;
  subcategory?: string;
  specificWords?: string[];
  style?: string;
  rating?: string;
}

export class PromptBuilder {
  private config = aiRulesConfig;

  /**
   * Build a sophisticated prompt based on the AI rules configuration
   */
  buildPrompt(params: TextGenerationParams): string {
    const { tone, category, subcategory, specificWords = [], style = 'generic', rating = 'g' } = params;

    // Get configuration objects
    const toneConfig = this.config.tones.find(t => t.id === tone);
    const styleConfig = this.config.styles.find(s => s.id === style);
    const ratingConfig = this.config.ratings.find(r => r.id === rating);

    // Build the core prompt
    let prompt = this.buildCorePrompt(toneConfig, styleConfig, ratingConfig);
    
    // Add context if provided
    if (category) {
      prompt += this.buildContextSection(category, subcategory);
    }

    // Add mandatory words constraint
    if (specificWords.length > 0) {
      prompt += this.buildMandatoryWordsSection(specificWords);
    }

    // Add length and formatting constraints
    prompt += this.buildConstraintsSection(rating);

    // Add variation requirements
    prompt += this.buildVariationSection();

    // Add final instructions
    prompt += this.buildFinalInstructions();

    return prompt;
  }

  private buildCorePrompt(toneConfig: any, styleConfig: any, ratingConfig: any): string {
    const toneName = toneConfig?.name || 'Humorous';
    const toneDesc = toneConfig?.summary || 'funny, witty, light';
    const styleDesc = styleConfig?.description || 'Neutral wording, straightforward delivery.';
    const ratingTag = ratingConfig?.tag || 'clean';

    return `Generate 4 different short text options with a ${toneName} tone (${toneDesc}). Style: ${styleDesc} Content rating: ${ratingTag}.`;
  }

  private buildContextSection(category: string, subcategory?: string): string {
    let context = ` Context: ${category}`;
    if (subcategory) {
      context += ` - ${subcategory}`;
    }
    context += '.';
    return context;
  }

  private buildMandatoryWordsSection(specificWords: string[]): string {
    return ` CRITICAL: Each option must naturally include ALL of these words: ${specificWords.join(', ')}.`;
  }

  private buildConstraintsSection(rating: string): string {
    const lengthRules = this.config.lengthRules;
    const profanityRule = this.config.formattingRules.profanityPolicy[rating.toUpperCase()] || 'no profanity';
    
    return ` LENGTH: Each must be ${lengthRules.minChars}-${lengthRules.maxChars} characters. CONTENT: ${profanityRule}. FORMAT: One-liners only, no em-dashes (—), natural punctuation.`;
  }

  private buildVariationSection(): string {
    return ` VARIATION REQUIRED: Mix of short punchy lines (<75 chars), longer observations (>100 chars), include at least one question and one exclamation across the 4 options.`;
  }

  private buildFinalInstructions(): string {
    return ` Return exactly 4 options, one per line, no numbering, no extra formatting. Each should feel naturally human and distinctly different.`;
  }

  /**
   * Validate generated text against AI rules
   */
  validateGeneratedText(text: string, params: TextGenerationParams): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const { specificWords = [], rating = 'g' } = params;

    // Length validation
    if (text.length < this.config.lengthRules.minChars) {
      errors.push(`Text too short: ${text.length} < ${this.config.lengthRules.minChars} characters`);
    }
    if (text.length > this.config.lengthRules.maxChars) {
      errors.push(`Text too long: ${text.length} > ${this.config.lengthRules.maxChars} characters`);
    }

    // Em-dash check
    if (this.config.validation.regexChecks.containsEmDash && new RegExp(this.config.validation.regexChecks.containsEmDash).test(text)) {
      errors.push('Contains em-dash (—) which is not allowed');
    }

    // Mandatory words check
    const missingWords = specificWords.filter(word => 
      !text.toLowerCase().includes(word.toLowerCase())
    );
    if (missingWords.length > 0) {
      errors.push(`Missing mandatory words: ${missingWords.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get variation requirements for the current generation
   */
  getVariationRequirements(): {
    lineShape: string;
    punchlinePlacement: string;
  } {
    const shapes = this.config.variationRules.lineShapeMix;
    const placements = this.config.variationRules.punchlinePlacement;
    
    return {
      lineShape: shapes[Math.floor(Math.random() * shapes.length)],
      punchlinePlacement: placements[Math.floor(Math.random() * placements.length)]
    };
  }
}

// Export singleton instance
export const promptBuilder = new PromptBuilder();