// Shared visual generation rules and subcategory contexts
// No side-effects. Imported by edge functions.

export const visual_rules = `
OUTPUT FORMAT
- Return only visual scene descriptions, one per line.
- Each line MUST be 7–12 words. No quotes, no numbering.
- Present tense, concrete imagery; no storylines, no dialogue.
- No hashtags, lens/camera jargon, or art-tech terms unless explicitly requested (e.g., “anime”, “3D”).

CONTENT RULES
- If insert words are provided, include them naturally (never as a list).
- If specific visuals are provided (e.g., a place name or brand), feature them clearly in the scene.
- If composition modes are provided, hint them subtly (e.g., “close-up”, “negative space”, “rule of thirds”).
- Keep content brand-safe for the given rating.
- Complement the main text; do not repeat the caption verbatim. Do not invent extra in-image text unless the layout implies signage.

STYLE GATES
- If Style = "realistic": use natural proportions and materials; avoid cartoon, 3D, cel-shaded, comic, toon, emoji-sticker or exaggerated graphic motifs.
- If Style = "illustrated" or "3D": stylization allowed; keep forms readable and clean.

BALANCE
- Prefer clear subjects, simple backgrounds, and breathable negative space to support typography.
`;

export const subcategory_contexts: Record<string, string> = {
  // Generic fallback
  default:
    "Create universally understandable visuals that enhance the main text. Prefer simple, bold compositions with clear subjects and backgrounds. Avoid clutter and accidental in-image text. Keep captions implicit, not literal.",

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

  birthday:
    "Warm celebratory visuals (balloons, confetti, cake) with a clear focal point.",
  sports:
    "Dynamic motion and dramatic angles; separation from background; no clutter.",
  fashion:
    "Clean styling and strong silhouettes; tasteful lighting; editorial feel.",
  nature:
    "Organic textures and atmospheric depth; maintain clarity for overlays."
};
