// Shared visual generation rules and subcategory contexts
// No side-effects. Imported by other edge functions (e.g., generate-visuals).

export const visual_rules = `
OUTPUT FORMAT
- Return exactly 4 visual scene concepts, one per line.
- Each concept is ONE sentence, maximum 15 words. No quotes, numbers, or bullet symbols.
- Use present tense and concrete imagery; no dialogue or narrative setups.

MUST INCLUDE (IN EVERY LINE)
- The caption’s *idea* (implied; do not restate the caption text verbatim).
- The provided input visuals (e.g., “old man drinking and crying”) woven in naturally.
- The selected tone reflected through word choice.
- Exactly ONE composition-mode cue (see cue list). If multiple modes are provided, rotate them across lines.

LANGUAGE RULES
- No hashtags, lens/camera jargon, technical brand names, or art-tech terms unless explicitly requested (e.g., "anime", "3D").
- Do not invent additional in-image text (signage/labels) unless the layout implies signage.
- Avoid repeated phrasing; each line must be distinct.

STYLE GATES
- If Style = "realistic": natural proportions/materials; avoid cartoon, 3D, cel-shaded, comic, toon, emoji-sticker, or exaggerated graphic motifs.
- If Style = "illustrated" or "3D": stylization allowed; keep forms readable and clean; avoid illegible clutter.

SAFETY / RATING
- Keep brand-safe for the specified rating.

COMPOSITION-MODE CUES (use one short cue per line)
- base_realistic → natural proportions, clean perspective
- exaggerated_props → oversized props, playful scale
- tiny_head → intentionally small head, clean neck
- object_head → object for head, bold silhouette
- surreal_scale → miniature or giant subject, consistent shadows
- very_close → close-up framing, shallow depth of field

BALANCE
- Prefer clear subjects, simple backgrounds, and breathable negative space to support typography.
`;

// Reusable cue map for programmatic insertion or validation.
// Example: append ", ${composition_mode_cues[mode]}" if the model omits a cue.
export const composition_mode_cues: Record<string, string> = {
  base_realistic: "natural proportions, clean perspective",
  exaggerated_props: "oversized props, playful scale",
  tiny_head: "intentionally small head, clean neck",
  object_head: "object for head, bold silhouette",
  surreal_scale: "miniature or giant subject, consistent shadows",
  very_close: "close-up framing, shallow depth of field"
};

// Context hints used by the visuals generator to bias scenes toward usable layouts.
// Keep short and directive; they’re concatenated into the system prompt.
export const subcategory_contexts: Record<string, string> = {
  // Generic fallback
  default:
    "Create universally understandable visuals that enhance the main text. Prefer simple, bold compositions with clear subjects and backgrounds. Avoid clutter and accidental in-image text. Keep captions implicit, not literal.",

  // Layout intents
  meme:
    "Bold, punchy concepts with strong focal subjects. High contrast, readable at a glance. Humor or irony welcome when tone allows.",
  "meme layout":
    "Central subject with visual punch; leave room around edges for text. Simple backgrounds for readability.",
  "text layout":
    "Design for strong text overlay areas: negative space and simple shapes that guide the eye.",
  "negative space":
    "Large open areas to place text; minimalistic subject and simplified background.",
  "badge callout":
    "Compact central object framed by soft shapes or rays; edges clean for cropping.",
  "open space":
    "Wide compositions with breathable margins; sky, walls, or gradients preferred.",
  "subtle caption":
    "Calm, understated imagery with soft lighting; room for a small caption.",
  "side bar":
    "Subject anchored to one side with generous negative space opposite; clear hierarchy.",
  "text only":
    "Abstract or texture-led scenes that pair well with typography; avoid competing elements.",

  // Frequent categories
  birthday:
    "Warm celebratory visuals (balloons, confetti, cake) with a clear focal point. Guests nearby, friendly energy.",
  wedding:
    "Joyful, elegant celebration; tasteful decor, floral elements, toasts and candid laughter; keep clutter low.",
  sports:
    "Dynamic motion and dramatic angles; separation from background; no clutter; clear sense of action.",
  fashion:
    "Clean styling and strong silhouettes; tasteful lighting; editorial feel; simple backdrops.",
  nature:
    "Organic textures and atmospheric depth; maintain clarity for overlays; avoid busy undergrowth.",

  // Retail/venue common case (useful for dispensary/storefront scenes)
  retail:
    "Clear storefront or counter context, legible shelving shapes, clean lighting, open sightlines; avoid dense signage."
};
