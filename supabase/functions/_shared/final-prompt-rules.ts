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

// Gemini likes compact, positive-only instructions (no negatives).
export const final_prompt_rules_gemini = `FINAL PROMPT GENERATION RULES (GEMINI)

- Keep prompts compact (<80 words).
- Text overlay must follow the chosen layout’s typography rules.
- If layout = meme-text: split mandatory text at first comma (top=before, bottom=after).
- Briefly describe scene: category/subcategory, style, aspect ratio, tone/rating, 1–3 clear props.
- Boost look: bright key light, vivid saturation, crisp focus, cinematic contrast.`;

// ===== LAYOUT MAP (descriptions only; typography is layout-aware) =====
export const layoutMap: Record<string, string> = {
  "meme-text": "top and bottom text directly on image; high-contrast; no background panels; 6–8% safe padding from edges",
  "lower-banner": "single line near bottom; centered; no filled banner; 5–7% margin above bottom edge",
  "side-bar": "vertical stack near left/right edge; aligned baseline; no filled panel; 6–8% side margin",
  "badge-callout": "short floating callout; compact line-length; minimal 1–2 px outline; no filled background",
  "subtle-caption": "small centered caption near bottom; restrained weight; 5–7% padding",
  "negative-space": "place text in a clean open area of the image; avoid busy detail around caption; maintain ~10–15% whitespace buffer"
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

// Helper: combine base + rating negatives
export function getCategoryNegatives(category: string, rating: string): string {
  const categoryKey = (category || "").toLowerCase();
  const categoryNeg = baseNegatives[categoryKey] || "";
  const ratingNeg = ratingNegatives[rating] || "";
  return [categoryNeg, ratingNeg].filter(Boolean).join(", ");
}

// ===== TYPOGRAPHY MAP (layout-aware rules) =====
function getTypographySpec(layout: keyof typeof layoutMap) {
  switch (layout) {
    case "negative-space":
      return "modern sans-serif, mixed case, high contrast; subtle 1–2 px outline or soft shadow only; place in open area; generous 10–15% padding; no filled banners";
    case "subtle-caption":
      return "clean sans-serif, mixed case, medium weight; high contrast; slight letter-spacing; no background; 5–7% padding";
    case "badge-callout":
      return "compact sans-serif, ALL CAPS allowed; thin 1–2 px outline; no filled shape; tight line-length";
    case "side-bar":
      return "stacked sans-serif, ALL CAPS; consistent line height; 6–8% side padding; no filled panel";
    case "lower-banner":
      return "centered sans-serif, ALL CAPS; thin outline; no banner fill; margin above bottom edge";
    case "meme-text":
    default:
      return "ALL CAPS white with thin black outline, top and bottom; no background panels; 6–8% safe padding";
  }
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

  // Layout sentence with layout-aware typography (no redundant “Scene:” boilerplate)
  const layoutSentence = isMeme
    ? `Top text "${split.top}" and bottom text "${split.bottom}" must follow meme layout: ${getTypographySpec("meme-text")}.`
    : `MANDATORY TEXT: "${mandatoryText}" must follow ${text_layout} layout: ${getTypographySpec(text_layout)}.`;

  // Compact, production-ready positive prompt
  const positivePrompt = [
    layoutSentence,
    `Spell the text exactly as written.`,
    `Create a ${image_style} ${subcategory || category} image with ${dimensionMap[image_dimensions]}.`,
    `Mood: ${toneMap[tone]}, ${ratingMap[rating]}.`,
    `Use ${composition_modes.join(", ") || "balanced"} composition that prioritizes caption readability.`,
    `Visuals: ${visualScene}.`,
    `Look: bright key light, vivid saturation, crisp focus, cinematic contrast.`
  ].join(" ");

  // Negatives: add layout-specific blocks to stop banner hallucinations, clutter, extra UI
  const layoutNegatives =
    text_layout === "meme-text"
      ? "filled banners, gradient panels behind text, top/bottom bars"
      : "filled banners, stickers, speech bubbles behind text";

  const negatives = [
    textQualityNegatives,
    layoutNegatives,
    getCategoryNegatives(category, rating),
    composition_modes.includes("minimalist") ? "visual clutter, excessive props, busy backgrounds" : ""
  ].filter(Boolean).join(", ");

  return { positivePrompt, negativePrompt: negatives };
}
