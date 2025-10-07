// ===== RULES (compact, aligned to ≤80 / ≤10) =====
export const final_prompt_rules_ideogram = `FINAL PROMPT GENERATION RULES (v17)

GENERAL
- Render mandatory text exactly; no substitutes or missing letters.
- Respect selected Text Layout; if "auto", prefer clean negative space.
- Readability first: pro typography, high contrast, no clutter.

TYPOGRAPHY POLICY
- Minimum text coverage by layout:
  - Badge-Callout ≥ 25% of image area
  - Meme (top/bottom) ≥ 20%
  - Caption (bottom) ≥ 15%
  - Negative-Space ≥ 22%
  - Integrated-in-Scene ≥ 22%
  - Dynamic-Overlay ≥ 18%
- Use modern rounded/geometric sans-serif; clean kerning; even spacing.
- Integrated on-scene; no filled panels/bars or speech bubbles.
- Contrast via lighting/color or subtle background blur (not boxes).
- Exact spelling only; no duplicates or extra text.

STRUCTURE
- Category: broad context. Subcategory: props/setting (never named).
- Tone: mood/energy. Rating: maturity limits. Layout: placement rules.
- Dimensions: aspect ratio. Visual Recommendation: optional scene guide.

PROMPT CONSTRUCTION
- Positive (≤80 words): include mandatory text, layout rules, style, aspect, tone/rating, scene/props, readability, and minimum coverage.
- Negative (≤10 words): block text errors and enforce rating/category.

OUTPUT
- Return ONE Positive string + ONE Negative string, ready for API.`;

// ===== GEMINI RULES (compact) =====
export const final_prompt_rules_gemini = `FINAL PROMPT GENERATION RULES (GEMINI v17)
- Positive prompt ≤80 words.
- Text overlay follows chosen layout or auto negative-space.
- If layout = meme-text: split at first comma (top/bottom).
- Brief scene: category/subcategory style (label not named), aspect, tone/rating, 1–3 props.
- Bright key light, vivid saturation, crisp focus, cinematic contrast.
- Typography policy: see minimum coverage by layout above; no panels/bubbles.`;

// ===== LAYOUT MAP (updated six layouts) =====
export const layoutMap: Record<string, string> = {
  "meme-text": "bold top/bottom meme placement; high-contrast; minimum 20% text coverage; 6–8% padding; line-break at first comma",
  "badge-callout": "compact floating callout; thin outline; minimum 25% text coverage; no background fill",
  "negative-space": "text in clean open area; avoid busy detail; minimum 22% text coverage; 10–15% whitespace buffer",
  "caption": "single strong bottom caption; centered; minimum 15% text coverage; restrained weight; 5–7% margin above edge",
  "integrated-in-scene": "text designed as part of the environment (poster/sign/wall/jersey), natural and legible; minimum 22% coverage",
  "dynamic-overlay": "diagonal/angled overlay aligned to composition lines; crisp editorial vibe; minimum 18% coverage"
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
  savage: "bold, edgy, confident, cutting",
  sentimental: "warm, heartfelt, tender, emotional",
  nostalgic: "reflective, old-times, wistful, reminiscent"
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
  "misspelled words, warped letters, distorted characters, oversized text, text covering faces";

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
