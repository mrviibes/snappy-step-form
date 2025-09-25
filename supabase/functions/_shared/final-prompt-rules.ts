Yes. Update the rules and add a builder that **auto-splits meme text** and **standardizes meme styling**. Use this drop-in TypeScript.

```ts
// ===== RULES =====
export const final_prompt_rules = `FINAL PROMPT GENERATION RULES

GENERAL
- Text must be displayed exactly as written with no substitutions or missing letters.
- Respect the selected Text Layout; use bold, high-contrast typography.
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
- Positive prompt must include: mandatory text, layout rules, style, aspect ratio, tone/rating, scene/props, readability.
- Negative prompt must block text quality issues and rating/category violations.
- Maintain style consistency.

OUTPUT
- Return a single Positive Prompt string and a single Negative Prompt string ready for the image API.`;

// ===== LAYOUT MAP (descriptions only) =====
export const layoutMap: Record<string, string> = {
  "meme-text": "top and bottom text banners",
  "lower-banner": "lower third banner",
  "side-bar": "side banner layout",
  "badge-callout": "badge callout design",
  "subtle-caption": "subtle caption placement",
  "negative-space": "negative space text layout",
  "open-space": "open space layout"
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

// ===== CATEGORY NEGATIVES (use plural 'celebrations' to match your data) =====
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
  // split at first comma; fallback to midpoint split if no comma
  const idx = mandatoryText.indexOf(",");
  if (idx > -1) {
    return {
      top: mandatoryText.slice(0, idx).trim(),
      bottom: mandatoryText.slice(idx + 1).trim()
    };
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
  composition_modes: string[]; // e.g., ["minimalist"]
  visualScene: string; // short scene guidance
}) {
  const {
    mandatoryText,
    category,
    subcategory,
    tone,
    rating,
    text_layout,
    image_style,
    image_dimensions,
    composition_modes,
    visualScene
  } = opts;

  // Meme styling & split
  const isMeme = text_layout === "meme-text";
  const split = isMeme ? splitMemeText(mandatoryText) : { top: "", bottom: "" };

  // Positive prompt
  const layoutSentence = isMeme
    ? `Top banner must display "${split.top}" and bottom banner must display "${split.bottom}" in bold, ALL-CAPS, white meme font with strong black outline.`
    : `MANDATORY TEXT: "${mandatoryText}" must be prominently displayed using ${layoutMap[text_layout]} with bold, high-contrast typography.`;

  const positivePrompt = [
    // text rules
    layoutSentence,
    `Text must be spelled exactly as written, with no substitutions or missing letters.`,
    // scene + style
    `Create a ${image_style} style ${category} ${subcategory} image with ${dimensionMap[image_dimensions]}.`,
    `The scene should be ${toneMap[tone]}, ${ratingMap[rating]}.`,
    `Use ${composition_modes.join(", ")} composition that complements the tone and prioritizes text readability.`,
    // visuals
    `Visuals: ${visualScene}.`,
    // final quality line
    `Ensure excellent readability, professional typography, vivid colors, sharp details, and a realistic meme aesthetic.`
  ].join(" ");

  // Negative prompt
  const negatives = [
    textQualityNegatives,
    getCategoryNegatives(category, rating),
    composition_modes.includes("minimalist") ? "visual clutter, excessive props, busy backgrounds" : ""
  ]
    .filter(Boolean)
    .join(", ");

  return { positivePrompt, negativePrompt: negatives };
}
```


