// ===== RULES =====
export const final_prompt_rules_ideogram = `FINAL PROMPT GENERATION RULES

GENERAL
- Text must be displayed exactly as written with no substitutions or missing letters.
- Respect the selected Text Layout. Use ALL CAPS white text with a thin black outline directly on the image. No solid background banners. Add safe padding from edges.
- All visual elements must complement Tone and Rating.
- Keep readability primary; professional typography only.

STRUCTURE
- Category → broad scene context.
- Subcategory → specific occasion/setting and props.
- Tone → mood/energy reflected by props and framing.
- Rating → maturity boundaries for visuals and copy.
- Text Layout → exact placement and style rules.
- Image Dimensions → aspect ratio and composition bounds.
- Visual Recommendation → optional scene guidance.

PROMPT CONSTRUCTION
- Positive prompt must include: mandatory text, layout rules (no backgrounds, outline text, padding), style, aspect ratio, tone/rating, scene/props, readability.
- Negative prompt must block text quality issues and rating/category violations.
- Maintain style consistency.

OUTPUT
- Return a single Positive Prompt string and a single Negative Prompt string ready for the image API.`;

// Gemini wants short, positive-only instructions (no negatives).
export const final_prompt_rules_gemini = `FINAL PROMPT GENERATION RULES (GEMINI)

- Keep prompts compact. Prefer <80 words.
- Text overlay: ALL CAPS white, thin black outline, directly on image. No solid background banners. Add slight padding from top/bottom edges.
- If layout = meme-text: split mandatory text at first comma → top=before, bottom=after.
- Describe scene briefly: category/subcategory, style, aspect ratio, tone, rating, 1–3 concrete props.
- Boost look: bright key light, vivid saturation, crisp focus, cinematic contrast.`;

// ===== LAYOUT MAP (descriptions only) =====
export const layoutMap: Record<string, string> = {
  "meme-text": "top and bottom text directly on image; ALL CAPS white with thin black outline; no background; pad from edges",
  "lower-banner": "single line near bottom edge; ALL CAPS white with thin black outline; no background; margin above edge",
  "side-bar": "vertical stack along left/right edge; ALL CAPS white with thin black outline; no background; margin from edge",
  "badge-callout": "short floating callout; ALL CAPS white with thin black outline; minimal outline only; no filled background",
  "subtle-caption": "small centered caption near bottom; ALL CAPS white with thin black outline; no background; padding",
  "negative-space": "place text in open area of image; ALL CAPS white with thin black outline; no background"
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
  "misspelled text, gibberish text, blurry text, illegible text, cut-off text, overlapping text, distorted fonts, poor typography, low contrast, broken words, duplicate words, uneven spacing";

export function getCategoryNegatives(category: string, rating: string): string {
  const categoryKey = (category || "").toLowerCase();
  const categoryNeg = baseNegatives[categoryKey] || "";
  const ratingNeg = ratingNegatives[rating] || "";
  return [categoryNeg, ratingNeg].filter(Boolean).join(", ");
}

// ===== MEME-TEXT SPLIT (TOP/BOTTOM) =====
function splitMemeText(mandatoryText: string) {
  const idx = mandatoryText.indexOf(",");
  if (idx > -1) {
    return { top: mandatoryText.slice(0, idx).trim(), bottom: mandatoryText.slice(idx + 1).trim() };
  }
  const mid = Math.floor(mandatoryText.length / 2);
  return { top: mandatoryText.slice(0, mid).trim(), bottom: mandatoryText.slice(mid).trim() };
}

// ===== PROMPT BUILDER =====
export function buildTextImagePrompts(opts: {
  mandatoryText: string;
  category: string;
  subcategory: string;
  tone: keyof typeof toneMap;
  rating: keyof typeof ratingMap;
  text_layout: keyof typeof layoutMap;
  image_style: "realistic" | "caricature" | "anime" | "pop_art" | "3d_render" | "illustrated";
  image_dimensions: keyof typeof dimensionMap;
  composition_modes: string[];
  visualScene: string;
}) {
  const {
    mandatoryText, category, subcategory, tone, rating,
    text_layout, image_style, image_dimensions, composition_modes, visualScene
  } = opts;

  const isMeme = text_layout === "meme-text";
  const split = isMeme ? splitMemeText(mandatoryText) : { top: "", bottom: "" };

  // Layout sentence with no-background typography + padding
  const layoutSentence = isMeme
    ? `Top text "${split.top}" and bottom text "${split.bottom}" must be ALL CAPS white with a thin black outline, placed directly on the image with safe padding from edges. No solid background banners.`
    : `MANDATORY TEXT: "${mandatoryText}" must follow ${layoutMap[text_layout]} — ALL CAPS white with a thin black outline, directly on the image, no background panels, include safe padding.`;

  const positivePrompt = [
    layoutSentence,
    `Text must be spelled exactly as written, with no substitutions or missing letters.`,
    `Create a ${image_style} style ${category} ${subcategory} image with ${dimensionMap[image_dimensions]}.`,
    `The scene should be ${toneMap[tone]}, ${ratingMap[rating]}.`,
    `Use ${composition_modes.join(", ")} composition that complements the tone and prioritizes text readability.`,
    `Visuals: ${visualScene}.`,
    `Ensure excellent readability, professional typography, vivid colors, sharp details, and a punchy meme aesthetic.`
  ].join(" ");

  const negatives = [
    textQualityNegatives,
    getCategoryNegatives(category, rating),
    composition_modes.includes("minimalist") ? "visual clutter, excessive props, busy backgrounds" : ""
  ].filter(Boolean).join(", ");

  return { positivePrompt, negativePrompt: negatives };
}
