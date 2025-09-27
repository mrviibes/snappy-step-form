// Shared visual generation rules and subcategory contexts
// This file purposefully contains no side-effects (no servers).
// It is imported by other edge functions (e.g., generate-visuals).

export const visual_rules = `
OUTPUT FORMAT
- Return only visual scene descriptions, one per line.
- Each line MUST be 7–12 words. No quotes.
- No hashtags, camera jargon, or explicit art terms unless provided (e.g., "anime", "3D").
- Use present tense and concrete imagery; no storylines.
- If insert words are provided, naturally include them in the scene.
- If composition modes are provided, subtly reflect them (e.g., "rule of thirds", "close-up", "negative space").
- Keep it brand-safe given the rating.
- Avoid duplicating the input text verbatim; describe the visual scene that complements it.
`;

export const subcategory_contexts: Record<string, string> = {
  // Generic fallback
  default:
    "Create universally understandable visuals that enhance the main text. Prefer simple, bold compositions with clear subjects and backgrounds. Avoid clutter and text in the image. Keep captions implicit, not literal.",

  // Common templates used in the app (best-effort guesses)
  meme:
    "Bold, punchy concepts with strong focal subjects. High contrast, readable at a glance. Humor or irony welcome when tone allows.",
  "meme layout":
    "Clear, central subject with visual punch; space around subject to avoid text collisions. Use simple backgrounds for readability.",
  "text layout":
    "Design for strong text overlay areas: negative space, clean backgrounds, simple shapes that guide the eye.",
  "negative space":
    "Large empty areas to place text; minimalistic subject and simplified background elements.",
  "badge callout":
    "Circular or rounded badge moments; central object framed by subtle shapes and rays; keep edges clean for cropping.",
  "open space":
    "Wide, open compositions with breathable margins; sky, walls, or gradients that keep the scene uncluttered.",
  "subtle caption":
    "Calm, understated imagery with soft lighting; room to add a small caption without crowding the subject.",
  "side bar":
    "Subject anchored to one side, generous negative space on the other; maintain balance and clear hierarchy.",
  "text only":
    "Abstract or texture-forward scenes that pair nicely with typography; avoid competing elements.",
  birthday:
    "Warm, celebratory visuals (balloons, confetti, cake) with clear focal points and cheerful colors.",
  sports:
    "Dynamic motion, dramatic angles, clear subject separation; energy and intensity without clutter.",
  fashion:
    "Clean styling, strong silhouettes, tasteful lighting; avoid busy backgrounds; editorial feel.",
  nature:
    "Organic textures, soft gradients, and atmospheric depth; maintain clarity for overlays.",
};

