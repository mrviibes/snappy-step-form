// ===== RULES =====
export const final_prompt_rules_ideogram = `FINAL PROMPT GENERATION RULES (v15)

GENERAL
- Render the mandatory text exactly as written (no substitutions, no missing letters).
- Respect the selected Text Layout. If "auto", choose the cleanest negative-space (priority: Clean Stage > Center Emphasis > Edge Tuck > Floating Caption > Diagonal Flow > Minimal Overlay).
- Readability first: professional typography, high contrast, no clutter.

TYPOGRAPHY POLICY (applies to every layout)
- Text must occupy ~22–28% of total image area (not a thin caption).
- Integrated directly on scene; no filled panels/bars, no speech bubbles, no stickers.
- High contrast via lighting, color or slight background blur (not boxes).
- Font family vibe: modern rounded or geometric sans-serif; clean kerning; even line spacing.
- Exact spelling only; no duplicates; no extra text beyond the mandatory copy.

STRUCTURE
- Category → broad scene context.
- Subcategory → guides props/setting but never named in output.
- Tone → mood/energy reflected by props and framing.
- Rating → maturity limits for visuals and copy.
- Text Layout → placement/typography rules (layout-dependent).
- Dimensions → aspect ratio.
- Visual Recommendation → optional scene guidance.

PROMPT CONSTRUCTION
- Positive prompt must include: mandatory text, layout rules (placement/typography/padding), style, aspect ratio, tone/rating, scene/props, readability.
- Negative prompt must block text errors and enforce rating/category limits.
- Keep visual style consistent.

OUTPUT
- Return ONE Positive Prompt string and ONE Negative Prompt string, ready for the image API.`;


// ===== GEMINI RULES =====
export const final_prompt_rules_gemini = `FINAL PROMPT GENERATION RULES (GEMINI)
- Keep prompts compact (<70 words).
- Text overlay must follow the chosen layout’s typography rules (or auto negative-space).
- If layout = meme-text: split mandatory text at first comma (top=before, bottom=after).
- Briefly describe scene: category/subcategory style (never name the label), aspect ratio, tone/rating, 1–3 props.
- Use bright key light, vivid saturation, crisp focus, cinematic contrast.
- Enforce Typography Policy: area 22–28%, no panels/bubbles, professional spacing.`;


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
