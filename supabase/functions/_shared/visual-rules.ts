// Visual generation rules and subcategory contexts
export const visual_rules = `VISUAL GENERATION RULES

GOAL
- Generate exactly 4 concise scene descriptions for a meme image.
- Each line must be 7–12 words.

GENERAL
- Describe only the visual scene (no text overlays or camera jargon).
- Support the completed_text thematically with clear, concrete imagery.
- Insert words must appear verbatim in every description (use naturally).
- Reflect the selected tone via mood, props, or exaggeration.
- Respect the provided composition modes in each line.
- Keep language vivid and simple; no run-ons.

STRUCTURE
- Category → broad scene context (e.g., Celebrations, Sports, Daily Life).
- Subcategory → tighter setting and default props (e.g., Birthday, Basketball).
- Tone → energy/mood (Savage=edgy/harsh, Sentimental=warm/gentle, Playful=cheeky).
- Rating → maturity boundary for gag (G=family-safe … R=adult).
- Composition Modes → minimalist, exaggerated, chaotic, surreal (must be mentioned).
- Image Style → applied by renderer; DO NOT mention in lines.

REQUIREMENTS
- Return 4 lines, each 7–12 words.
- All insert words must be present in every line.
- Mention at least one composition mode per line.
- Use unique settings/props per line; no repeated lists.
- Be concrete and visual; avoid abstract phrases and meta commentary.
- Do NOT mention image style, lenses, camera, or typography.

OUTPUT
- Return ONLY the 4 scene descriptions, one per line, nothing else.`;

// Default subcategory contexts (expand as needed)
export const subcategory_contexts: Record<string, string> = {
  birthday:   "party table, balloons, confetti, cake, candles, guests",
  coffee:     "cafe counter, steaming cups, pastries, cozy seating, morning light",
  work:       "desk, computer, meeting room glass, whiteboard, coworkers, office plants",
  relationship:"restaurant table, shared dessert, city lights, linked hands, playful looks",
  food:       "kitchen island, sizzling pan, chopping board, spices, plated dishes",
  travel:     "suitcase, airport gate, window views, street vendors, scenic overlook",
  fitness:    "weights, treadmill, sweat towel, outdoor trail, sporty outfit",
  technology: "screens, cables, neon UI, keyboards, smart devices, notifications",
  nature:     "forest path, river stones, mountain haze, sun shafts, wildflowers",
  default:    "general scene, background props, atmospheric details, contextual elements"
};
