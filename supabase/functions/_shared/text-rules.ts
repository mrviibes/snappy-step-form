// Visual generation rules and subcategory contexts
export const visual_rules = `VISUAL GENERATION RULES

GOAL
- Generate exactly 4 concise scene descriptions for a meme image.
- Each line must be 7–12 words.

GENERAL
- Describe only the visual scene; no on-image text or camera jargon.
- Tie scenes to the completed_text theme with concrete, prop-level details.
- Insert words/tokens must appear verbatim in every description, used naturally.
- Reflect the selected tone via mood, props, expressions, or exaggeration.
- Mention at least one composition mode in each line (minimalist, exaggerated, chaotic, surreal).
- Use vivid, simple language; no run-ons, no meta commentary.

CATEGORY AWARENESS
- If category starts with "jokes": scene must visually support the joke style.
- If category starts with "pop-culture": use the subcategory as the cultural frame
  (movies=characters/props/scenes, celebrities=red carpet/paparazzi/backstage, sports icons=stadiums/gear, influencers=social setups, video games=HUD-less props, etc.).
- Otherwise: follow subcategory context hints from provided defaults.

VARIETY
- Across 4 lines:
  - 2 LITERAL → directly visualize the core idea in completed_text.
  - 2 CREATIVE → alternate setting/props that still reinforce the same gag/tone.
- All 4 must include insert words, composition mode, and distinct settings/props.

RATING GUARDRAILS
- G/PG: family-safe props; no alcohol/drugs/adult content.
- PG-13: mild edge allowed; no gore or explicit sexual visuals.
- R: adult humor props allowed; no explicit nudity or graphic violence.

REQUIREMENTS
- Return 4 lines, each 7–12 words.
- All insert words/tokens appear in every line, naturally.
- At least one composition mode named per line (minimalist/exaggerated/chaotic/surreal).
- Use unique settings/props per line; avoid repeating the same list.
- Do NOT mention lenses, cameras, typography, watermarks, or file formats.
- Do NOT include quotes from media; depict references visually instead.

OUTPUT
- Return ONLY the 4 scene descriptions, one per line, nothing else.`;


// Default subcategory contexts (expanded for Pop Culture + common sets)
// Keys should match your app's subcategory slugs.
export const subcategory_contexts: Record<string, string> = {
  // Everyday / General
  birthday:     "party table, balloons, confetti, cake, candles, guests",
  coffee:       "cafe counter, steaming mugs, pastries, cozy seating, morning light",
  work:         "desk, laptop, meeting glass wall, whiteboard notes, office plants",
  relationship: "restaurant booth, shared dessert, city lights, playful glances, split bill",
  food:         "kitchen island, sizzling pan, chopping board, spices, plated dishes",
  travel:       "suitcase, airport gate, departures board, street vendors, scenic overlook",
  fitness:      "gym rack, dumbbells, treadmill, sweat towel, trail run, headband",
  technology:   "monitors, neon UI glow, keyboards, notifications, tangled cables",
  nature:       "forest path, river stones, mountain haze, sun shafts, wildflowers",
  default:      "general scene, background props, ambient details, contextual elements",

  // Jokes (visual scaffolds)
  "break-up-jokes":   "packed boxes, torn photo frames, doorstep, friends consoling, ice cream tub",
  "bar-jokes":        "neon bar sign, stools, sticky counter, pint glasses, jukebox",
  "dad-jokes":        "suburban grill, apron, toolbox, lawn, smug grin, eye-rolls",
  "stand-up-comedy":  "brick wall stage, mic stand, stool, small crowd, spotlight",

  // Pop Culture: Movies/TV/Media
  movies:       "marquee, ticket booth, theater seats, popcorn, iconic prop nods",
  "tv-shows":   "living room set, couch, remote, episode poster, streaming overlay removed",
  music:        "stage riser, mic, headphones, vinyl crate, setlist, studio foam",
  celebrities:  "red carpet, flash bulbs, velvet rope, autograph pen, glam team",
  fashion:      "runway, garment rack, lookbook, mirrors, tailor chalk, garment bags",
  memes:        "reaction faces, templateable poses, absurd props, low-stakes chaos, empty captions area",
  "video-games":"console controller, arcade cabinet, health bar implied props, loot chest, respawn point signage",
  "sports-icons":"stadium lights, trophy case, jerseys, locker room bench, scoreboards",
  streaming:    "couch binge, auto-play hint, snack pile, blanket fort, buffering wheel gag",
  "tiktok-trends":"ring light, phone on tripod, quick-change outfits, transition hand, caption bubble space",
  "youtube-culture":"studio desk, softbox glow, thumbnail wall, play button plaque, comment bubbles implied",
  comics:       "speech bubble-shaped props (blank), panel frames, capes, utility belts, onomatopoeia signs",
  anime:        "school rooftop fence, cherry blossoms, energy aura, bento, dramatic speed lines prop",
  "awards-shows":"gold statue, envelope, teleprompter, orchestra pit, backstage curtain",
  "internet-challenges":"countdown timer, obstacle props, taped markers, hype crowd, fail mats",
  podcasts:     "boom mics, pop filters, waveform screen, comfy chairs, coffee mugs",
  "celebrity-gossip":"tabloid rack, blurry long-lens prop, tea cup, rumor board, red string",
  influencers:  "ring light, PR boxes, branded backdrop, selfie stick, affiliate QR card",
  fandoms:      "merch wall, fan signs, cosplay accessories, midnight lineup, collectible shelves",
  "reality-tv": "confessional chair, lower-third style card (blank), villa pool, rose tray, elimination board",
  "social-media-drama":"notification storm, quote-tweet arrows, reply chains, blocked icon, DM door",
  "stand-up":   "club stage, mic cable, drink stool, crowd silhouettes, brick wall",
  "dance-trends":"studio mirror, tape marks, sneaker scuffs, portable speaker, choreography counts",
  "tech-gadgets":"shiny device pedestal, unboxing table, cable spaghetti, spec sheet prop, update progress",
  "streaming-music":"playlist cards (blank), headphones, equalizer lights, queue markers, album wall",
  "fictional-characters":"costume silhouettes, prop replicas, portal doorway, catchphrase sign blank, theme colors",

  // Sports specifics (optional granularity)
  basketball:   "hardwood court, hoop, shot clock, bench towels, squeaky soles",
  soccer:       "goal net, corner flag, boots, scarf crowd, scoreboard",
  golf:         "tee box, fairway, cart, pin flag, clubhouse patio",
};
