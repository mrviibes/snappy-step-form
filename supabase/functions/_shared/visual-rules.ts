export const visual_rules = `VISUAL GENERATION RULES

GENERAL
- All visuals must clearly support the completed_text.
- Insert words (e.g., names, phrases) must appear in the text overlay if required, not forced into objects.
- Visuals must match the humor baseline and tone context.
- Use the selected style, dimension, and layout exactly as specified.

STRUCTURE
- Category → Broad context for the scene (e.g., Celebrations, Sports, Pop Culture).
- Subcategory → Narrows the scene (e.g., Engagement, Birthday, Wedding).
- Tone → Determines energy of the visuals (Savage = bold, edgy; Sentimental = warm, soft).
- Rating → Affects maturity of visual jokes (G = family-safe; R = raw, adult themes).
- InsertWords → Only applied to on-image text banners, never literal props.

STYLE
- realistic → Photographic look, sharp detail.
- caricature → Exaggerated features, comedic distortion.
- anime → Stylized, bright, character-driven.
- pop_art → Bold, colorful, flat stylization.
- 3d_render → High-detail, cinematic rendering.
- illustrated → Hand-drawn or painted feel.

DIMENSION
- square (1:1) → Balanced memes, general use.
- portrait (9:16) → Mobile/tall poster formats.
- landscape (16:9) → Meme banners, cinematic.

LAYOUT
- minimalist → Clean, few props, negative space for text.
- badge_callout → Strong text callouts with graphical framing.
- meme_text → Top and bottom banners.
- lower_banner → Single text bar at bottom.
- side_bar → Vertical text block.
- caption → Small text line at bottom.

COMPOSITION MODES
- Always respect the list provided (e.g., minimalist, chaotic, surreal).
- Minimalist → Clean props, empty background, sharp focus on subject.
- Chaotic → Overstuffed with exaggerated props and detail.
- Surreal → Weird, dreamlike juxtapositions.

REQUIREMENTS
- Generate exactly 4 distinct visual scene descriptions.
- Each description must be 7–12 words long, no fewer, no more.
- Each must reflect the subcategory context with appropriate props.
- All insertWords must appear in every description.
- Each must include the composition_modes.
- Each scene must use a unique setting and unique props. 
  Do NOT reuse the same props across outputs.
- Visuals must also reflect the selected tone through mood, exaggeration, or props.
- Sentences must be short, vivid, and concrete.
- Do NOT mention the image style in the descriptions.

OUTPUT
- Always return 4 visual concepts per request.
- Each concept must be distinct (different props, scene framing, or mood).
- No duplicate object arrangements across the 4 outputs.
- Return ONLY the 4 scene descriptions, one per line, nothing else.`;

export const subcategory_contexts: Record<string, string> = {
  'birthday': 'party table, streamers, confetti, balloons, cake, candles',
  'wedding': 'altar, bouquet, rings, reception hall, dance floor, guests',
  'graduation': 'stage, cap and gown, diploma, ceremony, audience, podium',
  'basketball': 'court, hoop, ball, players, bench, crowd, scoreboard',
  'football': 'field, goalpost, helmet, stadium, fans, sideline',
  'work': 'office, desk, computer, meeting room, colleagues, coffee',
  'dating': 'restaurant, table, flowers, dinner, romantic setting'
};