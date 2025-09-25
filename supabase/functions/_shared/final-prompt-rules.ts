export const final_prompt_rules = `FINAL PROMPT GENERATION RULES

GENERAL
- Text must be displayed exactly as written with no substitutions or missing letters.
- Text placement must match the specified layout with bold, high-contrast typography.
- All visual elements must complement the tone and rating requirements.
- Image style must be consistently applied throughout the generation.
- Ensure excellent readability and professional typography.

STRUCTURE
- Category → Provides broad context for visual scene generation.
- Subcategory → Narrows the specific context and props needed.
- Tone → Determines the mood and energy of the visual elements.
- Rating → Affects content appropriateness and maturity level.
- Text Layout → Specifies exact placement and styling of text overlay.
- Image Dimensions → Determines aspect ratio and composition.
- Visual Recommendation → Additional scene guidance if provided.

PROMPT CONSTRUCTION
- Positive prompts must include mandatory text placement requirements.
- Negative prompts focus on text quality issues and inappropriate content.
- All context elements must be integrated cohesively.
- Style consistency must be maintained throughout.

OUTPUT
- Generate optimized prompts for AI image generation platforms.
- Include specific technical requirements for text rendering.
- Provide comprehensive negative prompts to avoid common issues.`;

// Map layout to text layout descriptions
export const layoutMap: Record<string, string> = {
  "meme-text": "top and bottom text banners",
  "lower-banner": "lower third banner", 
  "side-bar": "side banner layout",
  "badge-callout": "badge callout design",
  "subtle-caption": "subtle caption placement",
  "negative-space": "negative space text layout",
  "open-space": "open space layout"
};

// Map image dimensions to proper format
export const dimensionMap: Record<string, string> = {
  "square": "1:1 aspect ratio",
  "portrait": "9:16 aspect ratio", 
  "landscape": "16:9 aspect ratio", 
  "custom": "1:1 aspect ratio" // Default to square for custom dimensions
};

// Map tone to descriptive words
export const toneMap: Record<string, string> = {
  "humorous": "funny, witty, playful",
  "savage": "aggressive, intense, bold, cutting",
  "sarcastic": "witty, ironic, sharp",
  "wholesome": "warm, positive, uplifting",
  "dark": "edgy, moody, dramatic",
  "inspirational": "motivating, uplifting, powerful"
};

// Map rating to content guidelines
export const ratingMap: Record<string, string> = {
  "G": "family-friendly, innocent, wholesome",
  "PG": "mild content, suitable for general audiences", 
  "PG-13": "moderate content, some mature themes",
  "R": "adult content, intense themes, mature audiences"
};

// Category-specific negative prompts
export const baseNegatives: Record<string, string> = {
  "sports": "blurry motion, incorrect anatomy, floating objects, unnatural poses",
  "celebration": "sad expressions, dark moods, negative emotions",
  "workplace": "unprofessional content, inappropriate behavior",
  "relationships": "toxic behavior, harmful stereotypes",
  "animals": "distorted animals, unnatural animal features"
};

// Rating-specific negative prompts
export const ratingNegatives: Record<string, string> = {
  "G": "violence, adult themes, inappropriate content, mature themes",
  "PG": "explicit violence, strong adult themes, inappropriate language",
  "PG-13": "extreme violence, explicit adult content", 
  "R": "illegal content, extreme graphic violence"
};

// Standard negative prompts for text quality
export const textQualityNegatives = "misspelled text, blurry text, illegible text, cut-off or overlapping text, distorted fonts, poor typography, low contrast";

export function getCategoryNegatives(category: string, rating: string): string {
  const categoryNeg = baseNegatives[category.toLowerCase()] || "";
  const ratingNeg = ratingNegatives[rating] || "";
  
  return [categoryNeg, ratingNeg].filter(Boolean).join(', ');
}