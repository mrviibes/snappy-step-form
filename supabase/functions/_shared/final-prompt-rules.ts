// ===== RULES (compact, aligned to ≤50 / ≤10) =====
export const final_prompt_rules_ideogram = `FINAL PROMPT GENERATION RULES (v16)

GENERAL
- Render mandatory text exactly; no substitutes or missing letters.
- Respect selected Text Layout; if "auto", prefer clean negative space.
- Readability first: pro typography, high contrast, no clutter.

TYPOGRAPHY POLICY
- Text ~22–28% of image area (not a thin caption).
- Integrated on-scene; no filled panels/bars, bubbles, stickers.
- Contrast via lighting/color or subtle background blur (not boxes).
- Modern rounded/geometric sans-serif; clean kerning; even spacing.
- Exact spelling only; no duplicates or extra text.

STRUCTURE
- Category: broad context. Subcategory: props/setting (never named).
- Tone: mood/energy. Rating: maturity limits. Layout: placement rules.
- Dimensions: aspect ratio. Visual Recommendation: optional scene guide.

PROMPT CONSTRUCTION
- Positive (≤50 words): include mandatory text, layout rules, style, aspect, tone/rating, scene/props, readability.
- Negative (≤10 words): block text errors and enforce rating/category.

OUTPUT
- Return ONE Positive string + ONE Negative string, ready for API.`;

// ===== GEMINI RULES (compact) =====
export const final_prompt_rules_gemini = `FINAL PROMPT GENERATION RULES (GEMINI v16)
- Positive prompt ≤50 words.
- Text overlay follows chosen layout or auto negative-space.
- If layout = meme-text: split at first comma (top/bottom).
- Brief scene: category/subcategory style (label not named), aspect, tone/rating, 1–3 props.
- Bright key light, vivid saturation, crisp focus, cinematic contrast.
- Typography policy: 22–28% area, no panels/bubbles, pro spacing.`;

// ===== LAYOUT MAP (updated six layouts) =====
export const layoutMap: Record<string, string> = {
  "meme-text": "bold top/bottom meme placement; high-contrast; no panels; 6–8% padding; line-break at first comma; area 22–28%",
  "badge-callout": "compact floating callout; minimal 1–2 px outline; no background fill",
  "negative-space": "text in clean open area; avoid busy detail; 10–15% whitespace buffer; area 22–28%",
  "caption": "single strong bottom caption; centered; restrained weight; 5–7% margin above edge",
  "integrated-in-scene": "text designed as part of the environment (poster/sign/wall/jersey), natural and believable; preserve legibility",
  "dynamic-overlay": "diagonal/angled overlay aligned to composition lines; crisp editorial vibe"
};

// ===== SHORT LAYOUT TAGS (for minimal prompts/UI) =====
export const layoutTagShort: Record<string, string> = {
  "meme-text": "Meme Text",
  "badge-callout": "Badge Callout",
  "negative-space": "Negative Space",
  "caption": "Caption",
  "integrated-in-scene": "Integrated In-Scene Text",
  "dynamic-overlay": "Dynamic Overlay"
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
  animals: "distorted animals, unnatural features"
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

// ===== TEXT FAILURE NEGATIVES =====
export const textFailureNegatives =
  "missing text, tiny caption text, black bars, filled panels, speech bubbles, low contrast text, warped letters, cramped padding, duplicate words, thin caption strip";

// ===== Helper =====
export function getCategoryNegatives(category: string, rating: string): string {
  const categoryKey = (category || "").toLowerCase();
  const categoryNeg = baseNegatives[categoryKey] || "";
  const ratingNeg = ratingNegatives[rating] || "";
  return [categoryNeg, ratingNeg].filter(Boolean).join(", ");
}
