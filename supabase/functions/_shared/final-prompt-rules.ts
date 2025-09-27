// ===== RULES =====
export const final_prompt_rules_ideogram = `FINAL PROMPT GENERATION RULES (v12)

GENERAL
- Render the mandatory text exactly as written (no substitutions, no missing letters).
- Respect the selected Text Layout. Typography must match the layout spec (see layout map).
- All visual choices must fit the selected Tone and Rating.
- Readability is primary; use professional typography only.

STRUCTURE
- Category → broad scene context.
- Subcategory → specific occasion/setting and props.
- Tone → mood/energy reflected by props and framing.
- Rating → maturity boundaries for visuals and copy.
- Text Layout → placement and typography rules (layout-dependent).
- Image Dimensions → aspect ratio and composition bounds.
- Visual Recommendation → optional scene guidance.

PROMPT CONSTRUCTION
- Positive prompt must include: mandatory text, layout rules (placement, typography, padding), style, aspect ratio, tone/rating, scene/props, readability.
- Negative prompt must block text quality issues and rating/category violations.
- Maintain consistent visual style.

OUTPUT
- Return ONE Positive Prompt string and ONE Negative Prompt string, ready for the image API.`;

// Gemini rules (still compact)
export const final_prompt_rules_gemini = `FINAL PROMPT GENERATION RULES (GEMINI)
- Keep prompts compact (<80 words).
- Text overlay must follow the chosen layout’s typography rules.
- If layout = meme-text: split mandatory text at first comma (top=before, bottom=after).
- Briefly describe scene: category/subcategory, style, aspect ratio, tone/rating, 1–3 clear props.
- Boost look: bright key light, vivid saturation, crisp focus, cinematic contrast.`;

// ===== LAYOUT MAP (descriptive) =====
export const layoutMap: Record<string, string> = {
  "meme-text": "top and bottom text directly on image; high-contrast; no background panels; 6–8% safe padding from edges",
  "lower-banner": "single line near bottom; centered; no filled banner; 5–7% margin above bottom edge",
  "side-bar": "vertical stack near left/right edge; aligned baseline; no filled panel; 6–8% side margin",
  "badge-callout": "short floating callout; compact line-length; minimal 1–2 px outline; no filled background",
  "subtle-caption": "small centered caption near bottom; restrained weight; 5–7% padding",
  "negative-space": "place text in a clean open area of the image; avoid busy detail around caption; maintain ~10–15% whitespace buffer"
};

// ===== SHORT LAYOUT TAGS (for minimal prompts) =====
export const layoutTagShort: Record<string, string> = {
  "negative-space": "clean modern text, open area",
  "meme-text": "bold top/bottom meme text",
  "lower-banner": "strong bottom banner caption",
  "side-bar": "vertical side stacked text",
  "badge-callout": "floating stylish text badge",
  "subtle-caption": "small understated corner caption"
};

// ===== DIMENSIONS =====
export const dimensionMap: Record<string, string> = {
  square: "1:1 aspect ratio",
  portrait: "9:16 aspect ratio",
  landscape: "16:9 aspect ratio",
  custom: "1:1 aspect ratio"
};

// ===== TONES =====
export const toneMap: Record<string, string> = {
  humorous: "funny, witty, playful",
  savage: "aggressive, intense, bold, cutting",
  sarcastic: "witty, ironic, sharp",
  wholesome: "warm, positive, uplifting",
  dark: "edgy, moody, dramatic",
  inspirational: "motivating, uplifting, powerful"
};

// ===== RATINGS =====
export const ratingMap: Record<string, string> = {
  G: "family-friendly, innocent, wholesome",
  PG: "mild content, suitable for general audiences",
  "PG-13": "moderate content, some mature themes",
  R: "adult content, intense themes, mature audiences"
};

// ===== CATEGORY NEGATIVES =====
export const baseNegatives: Record<string, string> = {
  sports: "blurry motion, incorrect anatomy, floating objects, unnatural poses",
  celebrations: "sad expressions, dark moods, negative emotions, cluttered composition",
  workplace: "unprofessional content, inappropriate behavior",
  relationships: "toxic behavior, harmful stereotypes",
  animals: "distorted animals, unnatural animal features"
};

// ===== RATING NEGATIVES =====
export const ratingNegatives: Record<string, string> = {
  G: "violence, adult themes, inappropriate content, mature themes",
  PG: "explicit violence, strong adult themes, inappropriate language",
  "PG-13": "extreme violence, explicit adult content",
  R: "illegal content, extreme graphic violence"
};

// ===== TEXT QUALITY NEGATIVES =====
export const textQualityNegatives =
  "misspelled text, gibberish text, blurry text, illegible text, cut-off text, overlapping text, distorted fonts, poor typography, low contrast, broken words, duplicate words, uneven spacing, extra watermarks, extra logos, extra UI";

// Helper
export function getCategoryNegatives(category: string, rating: string): string {
  const categoryKey = (category || "").toLowerCase();
  const categoryNeg = baseNegatives[categoryKey] || "";
  const ratingNeg = ratingNegatives[rating] || "";
  return [categoryNeg, ratingNeg].filter(Boolean).join(", ");
}
