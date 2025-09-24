import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// =============== STEP-3 VISUAL CONCEPT GENERATION SYSTEM ===============

// The 6 Core Visual Variation Modes (official Step-3 specification)
const VISUAL_MODES = {
  'cinematic': {
    name: 'Cinematic',
    description: 'Wide scene, dramatic framing, big environment',
    focus: 'movie still showing full context, multiple props, environmental storytelling',
    cameraAngle: 'wide shot, establishing shot, dramatic perspective'
  },
  'close-up': {
    name: 'Close-up', 
    description: 'Focused detail shot, shallow depth of field',
    focus: 'intimate view of props or small character groups, detailed textures',
    cameraAngle: 'macro lens, shallow focus, detail emphasis'
  },
  'crowd-reaction': {
    name: 'Crowd Reaction',
    description: 'Group focus showing people reacting to the joke scenario',
    focus: 'social response, expressions, applause, chaos, audience perspective', 
    cameraAngle: 'medium wide, group shot, reaction coverage'
  },
  'minimalist': {
    name: 'Minimalist',
    description: 'Clean, sparse composition with single prop or symbol',
    focus: 'negative space, strong lighting, essential elements only',
    cameraAngle: 'simple framing, isolated subject, clean background'
  },
  'exaggerated-proportions': {
    name: 'Exaggerated Proportions',
    description: 'Comically oversized or distorted elements for cartoon effect',
    focus: 'big heads, tiny bodies, warped props, caricature style distortion',
    cameraAngle: 'emphasizing proportion contrast, visual comedy through scale'
  },
  'goofy-absurd': {
    name: 'Goofy Absurd', 
    description: 'Pure silliness and slapstick comedy energy',
    focus: 'mid-fail moments, props in wrong places, chaotic silly energy',
    cameraAngle: 'capturing peak absurdity, maximum comedic timing'
  }
}

// Enhanced visual style definitions with mood integration
const visualStyles = {
  'realistic': {
    name: 'Realistic',
    description: 'Photorealistic images with natural lighting and authentic details',
    banned: ['cartoon', 'anime', 'illustration', 'drawing', 'sketch'],
    moodKeywords: {
      'G': 'warm natural lighting, family-friendly atmosphere',
      'PG': 'bright realistic lighting, cheerful environment', 
      'PG-13': 'dynamic lighting, energetic realistic scene',
      'R': 'dramatic realistic lighting, bold contrast'
    }
  },
  'anime': {
    name: 'Anime',
    description: 'Japanese animation style with expressive characters and vibrant colors',
    banned: ['photorealistic', 'realistic', 'photograph'],
    moodKeywords: {
      'G': 'soft anime style, pastel colors, wholesome expressions',
      'PG': 'bright anime style, cheerful character expressions',
      'PG-13': 'dynamic anime style, bold expressions, vibrant colors', 
      'R': 'edgy anime style, dramatic shadows, intense expressions'
    }
  },
  '3d-render': {
    name: '3D Render', 
    description: 'Computer-generated 3D models with crisp lighting and textures',
    banned: ['flat', '2d', 'hand-drawn'],
    moodKeywords: {
      'G': 'soft 3D lighting, rounded friendly shapes',
      'PG': 'clean 3D rendering, balanced lighting',
      'PG-13': 'dynamic 3D lighting, sharp details',
      'R': 'dramatic 3D shadows, high contrast rendering'
    }
  },
  'design': {
    name: 'Design',
    description: 'Clean graphic design with typography and geometric elements',
    banned: ['cluttered', 'chaotic', 'realistic'],
    moodKeywords: {
      'G': 'clean design, soft gradients, friendly typography',
      'PG': 'balanced design layout, clear visual hierarchy', 
      'PG-13': 'bold design elements, strong visual contrast',
      'R': 'edgy design, dramatic typography, high impact'
    }
  },
  'general': {
    name: 'General',
    description: 'Flexible artistic style that adapts to content needs', 
    banned: [],
    moodKeywords: {
      'G': 'soft artistic style, warm friendly mood',
      'PG': 'balanced artistic approach, pleasant atmosphere',
      'PG-13': 'dynamic artistic style, energetic mood',
      'R': 'bold artistic interpretation, dramatic mood'
    }
  }
}

// Category-specific lexicons for prop extraction
const CATEGORY_LEXICONS = {
  'birthday': ['cake', 'candles', 'balloons', 'party', 'gift', 'frosting', 'celebration', 'wish', 'age'],
  'wedding': ['dress', 'rings', 'altar', 'bouquet', 'vows', 'reception', 'dance', 'cake', 'guests'],
  'graduation': ['cap', 'gown', 'diploma', 'stage', 'ceremony', 'degree', 'school', 'achievement'],
  'sports': ['ball', 'field', 'game', 'player', 'team', 'score', 'competition', 'victory'],
  'nascar': ['pit stop', 'laps', 'draft', 'checkered flag', 'burnout', 'infield', 'tailgate', 'pit crew', 'V8', 'pit lane', 'speedway', 'qualifying', 'car', 'track', 'helmet', 'beer', 'cup', 'stands', 'garage', 'trophy', 'race', 'driver', 'fan', 'crowd'],
  'work': ['office', 'desk', 'computer', 'meeting', 'boss', 'deadline', 'project', 'coffee'],
  'dating': ['restaurant', 'flowers', 'dinner', 'conversation', 'date', 'romance', 'couple'],
  'general': ['people', 'situation', 'moment', 'scene', 'action', 'reaction', 'environment']
}

// Enhanced tone to visual mood mapping
const TONE_TO_MOOD = {
  'Humorous': 'bright playful energy, warm comedic lighting, cheerful atmosphere',
  'Sarcastic': 'slightly muted colors with ironic contrast, subtle eyeroll energy',
  'Witty': 'sophisticated lighting, clever visual puns, smart composition',
  'Playful': 'vibrant energetic colors, bouncy dynamic movement, joyful chaos',
  'Dry': 'understated neutral tones, subtle deadpan expressions, minimal drama',
  'Sentimental': 'warm golden hour lighting, soft emotional glow, nostalgic mood',
  'Nostalgic': 'vintage color grading, dreamy soft focus, memory-like quality'
}

// Layout types
const layouts = [
  'open-space',
  'meme-text', 
  'lower-banner',
  'side-bar',
  'badge-callout',
  'subtle-caption',
  'negative-space'
]

// Rating to visual boldness mapping
const ratingToBoldness = {
  'G': 'clean and family-friendly with soft colors',
  'PG': 'moderately vibrant with balanced contrast',
  'PG-13': 'bold colors and dynamic composition',
  'R': 'high contrast, edgy styling, dramatic lighting'
}

// Tone to palette mapping
const toneToPalette = {
  'Humorous': 'bright, playful colors with warm tones',
  'Sarcastic': 'muted colors with unexpected accent pops',
  'Witty': 'sophisticated color palette with clever contrasts',
  'Playful': 'vibrant, energetic colors with high saturation',
  'Dry': 'understated, neutral tones with subtle highlights'
}

interface GenerateVisualsParams {
  finalText: string
  category: string
  subcategory?: string
  subSubcategory?: string
  tone: string
  textStyle: string
  rating: string
  insertWords?: string[]
  visualStyle: string
  visualTaste?: string
  customVisuals?: string[]
  dimension?: string
}

interface VisualRecommendation {
  visualStyle: string
  layout: string
  description: string
  props: string[]
  interpretation?: string
  palette?: string[]
  mood?: string
}

interface GenerateVisualsResponse {
  success: boolean
  visuals: VisualRecommendation[]
  model: string
  error?: string
}

// ============= VIIBE GENERATOR STEP-3 IMPLEMENTATION (SIMPLIFIED) =============

// Prop extractor - simplified and more reliable
function extractProps(text: string, max = 8): string[] {
  // naive noun/verb tokenization that works well enough
  const words = text
    .toLowerCase()
    .replace(/["""'']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const STOP = new Set([
    "the","a","an","and","or","but","if","then","so","to","of","in","on","for",
    "with","at","by","as","it","is","was","are","be","this","that","these","those",
    "i","you","he","she","they","we","me","him","her","them","my","your","his","her","their",
    "why","did","get","got","do","does","didn","t","than"
  ]);

  // crude POS-ish pick based on suffixes and length
  const candidates = words.filter(w => w.length > 2 && !STOP.has(w));
  const uniq: string[] = [];
  for (const w of candidates) {
    if (!uniq.includes(w)) uniq.push(w);
  }
  return uniq.slice(0, max);
}

// Style-aware negative builder
const STYLE_BANS: Record<string, string[]> = {
  'Realistic': ["cartoon","anime","illustration","vector","cgi","3d render"],
  'Design': ["photoreal","realistic photo","realistic photography","cgi","3d render"],
  '3D Render': ["hand drawn","sketch","anime","manga","vector","flat illustration"],
  'Anime': ["photoreal","realistic photo","3d render","cgi","live action"],
  'General': [],
  'Auto': []
};

function buildNegatives(style: string): string {
  const bans = STYLE_BANS[style] || [];
  const textSafety = [
    "extra text","missing text","misplaced text","duplicate text",
    "distorted font","low contrast text","text overlapping props",
    "watermarks","low resolution","cluttered background","poor composition"
  ];
  return [...bans, ...textSafety].join(", ");
}

// Visual concepts builder
type Variation = "Cinematic" | "Close-up" | "Crowd" | "Minimalist" | "Exaggerated" | "Goofy";

function pick<T>(arr: T[], n: number): T[] {
  const out: T[] = [];
  for (const x of arr) if (out.length < n) out.push(x);
  return out;
}

function dedupeWords(...lists: string[][]): string[][] {
  const seen = new Set<string>();
  return lists.map(list => list.filter(w => !seen.has(w) && seen.add(w)));
}

function buildVisualConcepts(
  text: string,
  style: string,
  dimension: "Square" | "Portrait" | "Landscape",
  category: string
): { variation: Variation; description: string }[] {
  // 1) extract props
  const props = extractProps(text);
  
  // ensure at least some anchors for common joke cases
  const fallbackAnchors: Record<string, string[]> = {
    "jokes": ["road","sign","wordplay","crossing","stage","audience"],
    "celebrations": ["cake","candles","balloons","party"],
    "graduation": ["cap","gown","diploma","ceremony"],
    "wedding": ["rings","vows","altar","reception"],
    "sports": ["field","game","player","team"],
    "work": ["office","desk","meeting","computer"]
  };
  
  const categoryKey = category.split(':')[0] || category.toLowerCase();
  const bank = props.length ? props : (fallbackAnchors[categoryKey] || ["stage","audience","sign"]);
  
  const [a, b, c, d, e, f] = dedupeWords(
    pick(bank, 2), 
    pick(bank.slice(2), 2), 
    pick(bank.slice(4), 2), 
    pick(bank.slice(6), 2), 
    pick(bank.slice(8), 1), 
    pick(bank.slice(9), 1)
  );

  // 2) compose variation descriptions with different prop focus
  const concepts: { variation: Variation; description: string }[] = [
    {
      variation: "Cinematic",
      description: `Wide ${dimension.toLowerCase()} scene, ${a.join(" and ")} visible, playful humor, cinematic framing.`
    },
    {
      variation: "Close-up",
      description: `Close-up of ${b.join(" and ")}, shallow focus, detailed textures, intimate view.`
    },
    {
      variation: "Crowd",
      description: `Group reaction to ${c.join(" and ")}, candid laughter, expressive faces, lively atmosphere.`
    },
    {
      variation: "Minimalist",
      description: `Minimal composition with a single ${d[0] || bank[0]}, clean background, strong lighting, negative space.`
    },
    {
      variation: "Exaggerated",
      description: `Comically oversized ${e[0] || bank[1]} beside a tiny ${f[0] || bank[2]}, absurd scale, playful gag.`
    },
    {
      variation: "Goofy",
      description: `Slapstick moment involving ${a[0] || bank[0]}, chaotic but funny energy, quick action beat.`
    }
  ];

  // 3) filter to 4 by default, or keep 6 if you want the extended set
  return concepts.slice(0, 6);
}

// Build final image prompts
function buildFinalImagePrompts(
  text: string,
  style: "Realistic"|"Design"|"3D Render"|"Anime"|"General"|"Auto",
  dimension: "Square"|"Portrait"|"Landscape",
  categoryKey: string
): VisualRecommendation[] {
  const concepts = buildVisualConcepts(text, style, dimension, categoryKey);
  const negatives = buildNegatives(style);

  const aspect = dimension === "Square" ? "1:1" : dimension === "Portrait" ? "9:16" : "16:9";

  return concepts.map((c, index) => ({
    visualStyle: style,
    layout: layouts[index % layouts.length],
    description: `${dimension.toLowerCase()} ${style.toLowerCase()} style. ${c.description}`,
    props: extractProps(text).slice(0, 3),
    interpretation: c.variation.toLowerCase().replace(' ', '-'),
    mood: 'humorous',
    palette: ['vibrant'],
    negativePrompt: negatives,
    aspect
  }));
}

// Style variation synonyms to prevent repetition
const STYLE_SYNONYMS = {
  lighting: ["cool dusk light", "harsh top light", "soft porch glow", "garage fluorescent", "dramatic shadows", "warm golden hour"],
  mood: ["deadpan humor", "awkward comedy", "backyard fail energy", "sarcastic vibe", "chaotic moment", "peak embarrassment"]
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Enhanced visual concept builder that reflects actual joke content
function buildSpecificVisualPrompt(params: GenerateVisualsParams): { system: string; user: string } {
  const { finalText, category, subcategory, visualStyle, rating } = params
  
  const selectedStyle = visualStyles[visualStyle.toLowerCase().replace(/\s+/g, '-')] || visualStyles['general']
  const elements = extractVisualElements(finalText, category, params.insertWords)
  
  // Extract specific failure/action context from the joke
  const jokeContext = extractJokeContext(finalText, elements)
  
  const system = `Create 6 SPECIFIC visual descriptions for image generation (25-35 words each).

CRITICAL RULES:
- Text reflects specific joke content: "${finalText}"
- Style: ${selectedStyle.name}
- Extract actual props, actions, and failures from the text
- NO generic "celebration" or "cheerful atmosphere" - be specific to the joke scenario
- Each mode must show different aspects of the same joke situation

FORMAT: JSON with "visuals" array containing objects with "description", "interpretation", "layout", "visualStyle", "props".`

  const concepts = buildSixVariedConcepts(jokeContext, elements, selectedStyle)
  
  const user = `Generate 6 visual concepts for joke: "${finalText}"

Use these specific concepts (avoid generic celebration language):

${concepts.map((concept, i) => `${i + 1}. ${concept.name.toUpperCase()}: ${concept.prompt}`).join('\n')}

Each description must reflect the specific joke scenario, not generic ${category} imagery.`

  return { system, user }
}

// Extract specific context from joke content
function extractJokeContext(text: string, elements: any): any {
  const lowerText = text.toLowerCase()
  
  // Detect failure/success scenarios
  const failureWords = ['failed', 'fail', 'wrong', 'burnt', 'charred', 'ruined', 'disaster', 'mess', 'broke', 'crashed', 'spilled']
  const isFailure = failureWords.some(word => lowerText.includes(word))
  
  // Detect specific objects and their states
  const objects = elements.nouns.slice(0, 3)
  const actions = elements.verbs.slice(0, 2)
  const setting = elements.settings[0] || 'scene'
  const people = elements.people[0] || 'person'
  
  // Extract emotional context
  const emotions = ['embarrassed', 'proud', 'confused', 'shocked', 'mortified', 'amused']
  const detectedEmotion = emotions.find(emotion => lowerText.includes(emotion)) || (isFailure ? 'embarrassed' : 'amused')
  
  return {
    originalText: text, // Pass original text for new prop extraction
    isFailure,
    mainObject: objects[0] || 'item',
    secondObject: objects[1] || null,
    action: actions[0] || 'situation',
    setting,
    people,
    emotion: detectedEmotion,
    props: [...objects, ...actions].slice(0, 4)
  }
}

// Template-based visual concept builder that distributes props across variations
function buildJokeAwareVisualConcepts(jokeText: string, extractedProps: string[], visualStyle: string): any[] {
  const propPool = [...extractedProps];
  const concepts = [];
  
  // Template definitions that use different props to ensure variety
  const templates = [
    {
      name: 'Cinematic Wide',
      mode: 'cinematic',
      buildPrompt: (props: string[]) => {
        const setting = props.find(p => ['road', 'office', 'restaurant', 'park', 'field', 'kitchen', 'room'].some(s => p.includes(s))) || props[0] || 'scene';
        const subject = props.find(p => ['dad', 'person', 'character', 'people'].some(s => p.includes(s))) || 'character';
        const action = props.find(p => p.includes('ing') || ['cross', 'walk', 'run', 'drive'].includes(p)) || 'moving';
        return `Wide shot of ${setting}, ${subject} ${action}, dramatic framing, ${visualStyle.toLowerCase()} style, humorous mood`;
      }
    },
    {
      name: 'Close-up Detail',
      mode: 'close-up', 
      buildPrompt: (props: string[]) => {
        const object = props.find(p => !['dad', 'person', 'people', 'character'].includes(p)) || props[1] || 'object';
        const context = props.find(p => p !== object) || 'detail';
        return `Close-up of ${object} with ${context}, shallow focus, ${visualStyle.toLowerCase()} style, detailed textures`;
      }
    },
    {
      name: 'Group Reaction',
      mode: 'crowd-reaction',
      buildPrompt: (props: string[]) => {
        const focusElement = props[0] || 'scene';
        return `Group of people reacting to ${focusElement}, laughing and surprised expressions, ${visualStyle.toLowerCase()} style, candid social moment`;
      }
    },
    {
      name: 'Minimalist Clean',
      mode: 'minimalist',
      buildPrompt: (props: string[]) => {
        const symbol = props.find(p => !['people', 'person', 'character'].includes(p)) || props[0] || 'element';
        return `Minimalist composition featuring ${symbol}, clean background, strong lighting, ${visualStyle.toLowerCase()} style, negative space`;
      }
    },
    {
      name: 'Exaggerated Proportions',
      mode: 'exaggerated-proportions',
      buildPrompt: (props: string[]) => {
        const mainProp = props[0] || 'element';
        const secondProp = props[1] || 'object';
        return `Comically oversized ${mainProp}, tiny ${secondProp}, exaggerated cartoon proportions, ${visualStyle.toLowerCase()} style, absurd scale humor`;
      }
    },
    {
      name: 'Goofy Absurd',
      mode: 'goofy-absurd',
      buildPrompt: (props: string[]) => {
        const mainProp = props[0] || 'element';
        const action = props.find(p => p.includes('ing') || ['cross', 'walk', 'run'].includes(p)) || 'action';
        return `Slapstick scene with ${mainProp} during ${action}, chaotic comedy, ${visualStyle.toLowerCase()} style, peak absurd moment`;
      }
    }
  ];
  
  // Distribute props across templates to ensure variety
  templates.forEach((template, index) => {
    // Give each template different props from the pool
    const templateProps = propPool.splice(0, Math.min(3, propPool.length));
    if (templateProps.length === 0) templateProps.push('element', 'scene'); // Fallback
    
    concepts.push({
      name: template.name,
      mode: template.mode,
      prompt: template.buildPrompt(templateProps),
      usedProps: templateProps
    });
    
    // Replenish pool if we're running low
    if (propPool.length < 2 && extractedProps.length > 0) {
      propPool.push(...extractedProps.filter(p => !templateProps.includes(p)).slice(0, 2));
    }
  });
  
  return concepts;
}

// Extract joke-specific props
function extractJokeProps(jokeText: string): string[] {
  return extractProps(jokeText, 8);
}

// Extract visual elements from text
function extractVisualElements(text: string, category: string, insertWords?: string[]): any {
  const props = extractProps(text);
  const words = text.toLowerCase().split(/\s+/);
  
  // Simple categorization
  const nouns = props.filter(p => !p.includes('ing') && p.length > 2);
  const verbs = props.filter(p => p.includes('ing') || ['cross', 'walk', 'run', 'drive', 'grill', 'cook'].includes(p));
  const settings = words.filter(w => ['road', 'office', 'restaurant', 'park', 'field', 'kitchen', 'room', 'stage'].includes(w));
  const people = words.filter(w => ['dad', 'person', 'people', 'character', 'man', 'woman'].includes(w));
  
  return {
    nouns,
    verbs,
    settings,
    people,
    allProps: props,
    mood: ['humorous'],
    actions: verbs
  };
}

// Updated buildSixVariedConcepts to use the new joke-aware approach
function buildSixVariedConcepts(context: any, elements: any, style: any) {
  // Extract the original joke text from context if available
  const jokeText = context.originalText || '';
  
  // Use the new joke-aware system if we have joke text
  if (jokeText) {
    const extractedProps = extractJokeProps(jokeText);
    const styleName = style.name || 'realistic';
    return buildJokeAwareVisualConcepts(jokeText, extractedProps, styleName);
  }
  
  // Fallback to improved version of original logic
  const { mainObject, action, setting, people, emotion, isFailure, props } = context;
  
  // Distribute different props across each concept to avoid repetition
  const availableProps = [...props];
  
  return [
    {
      name: 'Cinematic Wide',
      prompt: `Wide shot of ${setting || 'scene'} with ${availableProps[0] || mainObject}, ${people} ${action || 'in action'}, dramatic framing, ${style.name?.toLowerCase()} style`
    },
    {
      name: 'Close-up Detail', 
      prompt: `Close-up of ${availableProps[1] || mainObject} with detailed textures, shallow focus, ${style.name?.toLowerCase()} style`
    },
    {
      name: 'Crowd Reaction',
      prompt: `Group of people reacting to ${availableProps[2] || action}, surprised expressions, candid social moment, ${style.name?.toLowerCase()} style`
    },
    {
      name: 'Minimalist Clean',
      prompt: `Single ${availableProps[0] || mainObject} on clean background, strong lighting, negative space, ${style.name?.toLowerCase()} style`
    },
    {
      name: 'Exaggerated Proportions',
      prompt: `Comically oversized ${availableProps[1] || mainObject}, tiny ${availableProps[3] || people}, cartoon proportions, ${style.name?.toLowerCase()} style`
    },
    {
      name: 'Goofy Absurd',
      prompt: `Slapstick scene with ${availableProps[2] || mainObject} and ${action}, chaotic comedy, ${style.name?.toLowerCase()} style`
    }
  ];
}

// Enhanced visual prompt builder using Step-3 template approach with joke element integration
function buildEnhancedVisualPrompt(params: GenerateVisualsParams): { system: string; user: string } {
  const { 
    finalText, 
    category, 
    subcategory, 
    tone, 
    rating, 
    insertWords = [], 
    visualStyle,
    dimension = 'square'
  } = params
  
  const selectedStyle = visualStyles[visualStyle.toLowerCase().replace(/\s+/g, '-')] || visualStyles['general']
  const { nouns, verbs, settings, people, allProps, mood, actions } = extractVisualElements(finalText, category, insertWords)
  const visualMood = TONE_TO_MOOD[tone] || 'balanced mood and lighting'
  const styleMood = selectedStyle.moodKeywords?.[rating] || 'appropriate mood for rating'
  
  const bannedTerms = selectedStyle.banned.length > 0 
    ? `CRITICAL: NEVER use these conflicting styles: ${selectedStyle.banned.join(', ')}`
    : ''

  // Build contextual prop/action combinations from the actual text
  const mainProps = nouns.slice(0, 3).join(', ') || 'main elements'
  const mainActions = verbs.slice(0, 2).join(', ') || 'action'
  const mainSetting = settings[0] || category.split('>').pop()?.trim() || 'setting'
  const mainPeople = people.slice(0, 2).join(', ') || 'people'
  
  // Create joke-specific visual concepts for each mode
  const jokeElements = {
    props: nouns.slice(0, 4),
    actions: verbs.slice(0, 3), 
    setting: settings[0] || mainSetting,
    people: people.slice(0, 2),
    mood: mood.slice(0, 2)
  }

  const system = `You are a Step-3 Visual Concept Generator that creates exactly 6 visual interpretations by extracting elements directly from the Step-2 joke text.

CRITICAL JOKE ELEMENT EXTRACTION from "${finalText}":
- NOUNS (props to show): ${jokeElements.props.join(', ') || 'extracted from context'}
- VERBS (actions happening): ${jokeElements.actions.join(', ') || 'extracted from context'}  
- SETTING (where it happens): ${jokeElements.setting}
- PEOPLE (who's involved): ${jokeElements.people.join(', ') || 'extracted from context'}
- MOOD (emotional context): ${jokeElements.mood.join(', ') || 'humorous'}

THE 6 OFFICIAL VISUAL MODES must integrate these joke elements:

1. CINEMATIC (Wide): Wide shot of [joke setting] with [joke props] visible, [joke people] doing [joke actions], dramatic framing that captures the full joke scenario

2. CLOSE-UP (Detail): Intimate close-up of [main joke prop] while [joke action] is happening, shallow focus emphasizing the humor element from the text

3. CROWD REACTION (Group): [Joke people] and others reacting to [joke scenario], group expressions responding to the specific humor in the text

4. MINIMALIST (Simple): Single [main joke prop] representing the core humor from "${finalText}", clean background, symbolic of the joke's punchline

5. EXAGGERATED (Cartoon): [Joke props] comically oversized, [joke people] with exaggerated proportions, emphasizing the absurdity of [joke actions]

6. GOOFY (Absurd): [Joke people] mid-[joke actions] with [joke props] in ridiculous positions, capturing peak comedic chaos from the joke scenario

Style: ${selectedStyle.name} - ${selectedStyle.description}
${bannedTerms}
Mood: ${visualMood}
Rating guidance: ${styleMood}

MANDATORY REQUIREMENTS:
- Each description must reference specific elements from: "${finalText}"
- NO generic "celebration" or "basketball players" - use the actual joke elements
- Include the extracted props: ${jokeElements.props.join(', ')}
- Show the extracted actions: ${jokeElements.actions.join(', ')}
- Feature the extracted people: ${jokeElements.people.join(', ')}
- Set in the extracted setting: ${jokeElements.setting}

OUTPUT FORMAT (JSON only):
{
  "visuals": [
    {
      "visualStyle": "${selectedStyle.name}",
      "layout": "layout-type",
      "description": "20-35 word description using SPECIFIC joke elements, NOT generic concepts", 
      "props": ["specific", "elements", "from", "joke", "text"],
      "interpretation": "cinematic/close-up/crowd-reaction/minimalist/exaggerated-proportions/goofy-absurd",
      "mood": "mood reflecting the specific joke context"
    }
  ]
}`

  const user = `STEP-2 JOKE TEXT: "${finalText}"

EXTRACTED JOKE ELEMENTS TO USE:
- Props (nouns): ${jokeElements.props.join(', ')}
- Actions (verbs): ${jokeElements.actions.join(', ')}
- Setting: ${jokeElements.setting}  
- People: ${jokeElements.people.join(', ')}
- Insert words: ${insertWords.join(', ') || 'none'}

Generate 6 visual concepts that DIRECTLY integrate these joke elements:

1. CINEMATIC (Wide shot):
   Wide shot of ${jokeElements.setting} with ${jokeElements.props.join(' and ')} visible, ${jokeElements.people.join(' and ')} ${jokeElements.actions.join(' and ')}, dramatic ${selectedStyle.name.toLowerCase()} lighting capturing the full joke scenario

2. CLOSE-UP (Detail focus): 
   Close-up of ${jokeElements.props[0] || 'main element'} while ${jokeElements.actions[0] || 'action'} happens, ${selectedStyle.name.toLowerCase()} style, shallow focus on the humor element from the joke

3. CROWD REACTION (Group scene):
   ${jokeElements.people.join(' and ')} and others reacting to ${jokeElements.actions.join(' and ')} involving ${jokeElements.props.join(' and ')}, group expressions responding to the specific joke context

4. MINIMALIST (Simple composition):
   Single ${jokeElements.props[0] || 'main prop'} on clean background symbolizing "${finalText}" humor, negative space, ${selectedStyle.name.toLowerCase()} aesthetic focusing on the joke's core element

5. EXAGGERATED PROPORTIONS (Cartoon scale):
   ${jokeElements.props.join(' and ')} comically oversized, ${jokeElements.people.join(' and ')} tiny by comparison, emphasizing absurdity of ${jokeElements.actions.join(' and ')}, cartoon proportions

6. GOOFY ABSURD (Slapstick chaos):
   ${jokeElements.people.join(' and ')} mid-${jokeElements.actions.join(' and ')} with ${jokeElements.props.join(' and ')} in ridiculous positions, peak comedy chaos from "${finalText}", maximum silliness

CRITICAL INTEGRATION REQUIREMENTS:
- Use EXACT elements from: "${finalText}"
- Props to include: ${jokeElements.props.join(', ')}
- Actions to show: ${jokeElements.actions.join(', ')}
- Setting context: ${jokeElements.setting}
- People involved: ${jokeElements.people.join(', ')}
- Each 20-35 words capturing the specific joke scenario
- ${selectedStyle.name.toLowerCase()} visual style
- NEVER default to generic sports/celebration concepts
- Every description must reflect the actual joke content and humor`

  return { system, user }
}

// Enhanced validation for 6-mode visual system
function validateVisualRec(rec: any, expectedStyle: string, textProps: string[]): VisualRecommendation | null {
  if (!rec || typeof rec !== 'object') return null
  
  const { visualStyle, layout, description, props = [], interpretation, cameraAngle } = rec
  
  // Validate required fields
  if (!visualStyle || !layout || !description || !interpretation) return null
  if (typeof description !== 'string') return null
  
  // Validate description length (20-40 words for Step-3)
  const wordCount = description.trim().split(/\s+/).length
  if (wordCount < 20 || wordCount > 40) {
    console.log(`Visual rejected: ${wordCount} words (need 20-40). Description: ${description.substring(0, 50)}`)
    return null
  }
  
  // Validate layout exists
  if (!layouts.includes(layout)) return null
  
  // Validate visual style matches expected
  if (visualStyle !== expectedStyle) return null
  
  // Validate interpretation matches 6 official modes
  const validInterpretations = ['cinematic', 'close-up', 'crowd-reaction', 'minimalist', 'exaggerated-proportions', 'goofy-absurd']
  if (!validInterpretations.includes(interpretation)) return null
  
  // Check if description anchors to text props (flexible matching)
  const lowercaseDesc = description.toLowerCase()
  const hasTextAnchor = textProps.length === 0 || textProps.some(prop => 
    prop.length > 2 && (
      lowercaseDesc.includes(prop.toLowerCase()) ||
      lowercaseDesc.includes(prop.toLowerCase().substring(0, Math.min(4, prop.length))) ||
      // Check for word variants (plural, etc.)
      lowercaseDesc.includes(prop.toLowerCase() + 's') ||
      lowercaseDesc.includes(prop.toLowerCase() + 'ed') ||
      lowercaseDesc.includes(prop.toLowerCase() + 'ing')
    )
  )
  
  if (!hasTextAnchor) {
    console.log(`Visual rejected: no text anchoring. Props: ${textProps.join(', ')}, Description: ${description.substring(0, 80)}`)
    return null
  }
  
  return {
    visualStyle,
    layout,
    description: description.trim(),
    props: Array.isArray(props) ? props.filter(p => typeof p === 'string').slice(0, 5) : [],
    interpretation,
    mood: TONE_TO_MOOD[interpretation] || undefined,
    ...(cameraAngle && { cameraAngle })
  }
}

// =============== TIMEOUT & RETRY SYSTEM ===============

// Timeout wrapper to prevent hanging requests
async function withTimeout<T>(promise: Promise<T>, ms: number = 20000): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout_exceeded')), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

// Call OpenAI API with clean response
async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1000
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Enhanced OpenAI call with timeout and retry
async function callOpenAIWithRetry(systemPrompt: string, userPrompt: string, maxRetries: number = 3): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🎯 Visual API attempt ${attempt + 1}/${maxRetries}`);
      
      // Reduced timeout for faster failure and retry
      const result = await withTimeout(callOpenAI(systemPrompt, userPrompt), 12000); // 12s timeout
      
      if (result && result.trim().length > 10) {
        console.log(`✅ Visual API succeeded on attempt ${attempt + 1}`);
        return result;
      }
      
      throw new Error('Empty or invalid response from API');
      
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      const errorMessage = error.message;
      
      console.log(`❌ Visual API attempt ${attempt + 1} failed: ${errorMessage}`);
      
      if (isLastAttempt) {
        // Don't throw timeout errors - let the caller handle gracefully
        if (errorMessage === 'timeout_exceeded') {
          console.log('💡 All attempts timed out, caller will use fallbacks');
        }
        throw error;
      }
      
      // Faster retry with reduced delay
      const delay = 200 + Math.random() * 300 + (attempt * 500);
      console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('All visual generation attempts failed');
}

// Call OpenAI API with timeout and retry logic
async function callOpenAIWithTimeout(systemPrompt: string, userPrompt: string): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

// Save to visual history
async function saveToVisualHistory(visuals: VisualRecommendation[], payload: any, userId?: string) {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabase.from('visual_history').insert({
      final_text: payload.finalText,
      category: payload.category,
      subcategory: payload.subcategory,
      tone: payload.tone,
      text_style: payload.textStyle,
      rating: payload.rating,
      insert_words: payload.insertWords || [],
      visual_style: payload.visualStyle,
      visual_taste: payload.visualTaste || 'balanced',
      custom_visuals: payload.customVisuals || [],
      dimension: payload.dimension || 'square',
      generated_visuals: visuals,
      user_id: userId, // Add user_id for proper RLS
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to save to visual history:', error)
  }
}

// Enhanced visual generation with timeout and retry
async function generateVisuals(params: GenerateVisualsParams): Promise<VisualRecommendation[]> {
  console.log('🎨 Starting visual generation with timeout protection...');
  console.log('📝 Input params:', { text: params.finalText.substring(0, 50) + '...', style: params.visualStyle, category: params.category });
  
  const expectedStyle = visualStyles[params.visualStyle.toLowerCase().replace(/\s+/g, '-')]?.name || 'General'
  const { allProps } = extractVisualElements(params.finalText, params.category, params.insertWords)
  
  try {
    // Use specific content-aware prompt for better visual concepts
    const { system, user } = buildSpecificVisualPrompt(params)
    
    // Call OpenAI with timeout and retry
    const rawResponse = await callOpenAIWithRetry(system, user, 2)
    console.log(`🎯 Got response:`, rawResponse.substring(0, 200) + '...')
    
    // Parse JSON response with error handling
    let parsed
    try {
      // Extract and clean JSON
      let jsonText = rawResponse.trim()
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }
      
      // Clean common JSON issues
      jsonText = jsonText.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}')
      parsed = JSON.parse(jsonText)
      
    } catch (parseError) {
      console.error('❌ JSON parse failed:', parseError.message)
      console.log('📄 Raw response:', rawResponse.substring(0, 500))
      // Don't throw - fall back to emergency visuals
      console.log('🚨 JSON parsing failed, using emergency fallback visuals...')
      return createFallbackVisuals(params, expectedStyle, allProps)
    }
    
    // Validate and process visuals
    if (!parsed.visuals || !Array.isArray(parsed.visuals)) {
      console.log('🚨 Invalid response structure, using emergency fallback visuals...')
      return createFallbackVisuals(params, expectedStyle, allProps)
    }
    
    console.log(`🔍 Processing ${parsed.visuals.length} visual candidates...`)
    
    const validVisuals: VisualRecommendation[] = []
    const usedInterpretations = new Set<string>()
    
    // Process each visual with relaxed validation for speed
    for (const [index, rec] of parsed.visuals.entries()) {
      try {
        const validated = validateVisualRec(rec, expectedStyle, allProps)
        if (validated && !usedInterpretations.has(validated.interpretation)) {
          validVisuals.push(validated)
          usedInterpretations.add(validated.interpretation)
          console.log(`✅ Visual ${index + 1}: ${validated.interpretation} - "${validated.description.substring(0, 40)}..."`)
        } else {
          console.log(`❌ Visual ${index + 1} rejected: ${validated ? 'duplicate mode' : 'invalid format'}`)
        }
      } catch (validationError) {
        console.log(`❌ Visual ${index + 1} validation failed:`, validationError.message)
      }
    }
    
    // Return results (even if not perfect 6, but ensure we have at least something)
    if (validVisuals.length >= 2) {
      console.log(`🎉 Generated ${validVisuals.length} valid visuals with modes: [${[...usedInterpretations].join(', ')}]`)
      
      // If we have some but not enough, fill with fallbacks
      if (validVisuals.length < 6) {
        const fallbacks = createFallbackVisuals(params, expectedStyle, allProps)
        const remainingSlots = 6 - validVisuals.length
        validVisuals.push(...fallbacks.slice(0, remainingSlots))
        console.log(`🔧 Topped up with ${remainingSlots} fallback visuals`)
      }
      
      return validVisuals.slice(0, 6)
    }
    
    // If we got fewer than 2 valid visuals, use fallbacks
    console.log(`🚨 Only got ${validVisuals.length} valid visuals, using emergency fallback visuals...`)
    return createFallbackVisuals(params, expectedStyle, allProps)
    
  } catch (error) {
    console.error('💥 Visual generation failed:', error.message)
    
    // Always return fallback visuals instead of throwing
    console.log('🚨 Using emergency fallback visuals...')
    return createFallbackVisuals(params, expectedStyle, allProps)
  }
}

// Fast fallback visual generation
function createFallbackVisuals(params: GenerateVisualsParams, expectedStyle: string, props: string[]): VisualRecommendation[] {
  const modes = ['cinematic', 'close-up', 'crowd-reaction', 'minimalist', 'exaggerated-proportions', 'goofy-absurd']
  const primaryProp = props[0] || params.category || 'celebration'
  const moodKeywords = TONE_TO_MOOD[params.tone] || 'cheerful mood'
  
  return modes.slice(0, 6).map((mode, index) => {
    let description = ''
    
    switch (mode) {
      case 'cinematic':
        description = `Wide ${expectedStyle.toLowerCase()} shot of ${primaryProp} celebration, dramatic lighting, full scene visible, ${moodKeywords}`
        break
      case 'close-up': 
        description = `Detailed ${expectedStyle.toLowerCase()} close-up of ${primaryProp}, shallow focus, intimate view, warm lighting`
        break
      case 'crowd-reaction':
        description = `Group celebrating ${primaryProp} moment, people smiling and reacting, ${expectedStyle.toLowerCase()} style, joyful expressions`
        break
      case 'minimalist':
        description = `Simple ${expectedStyle.toLowerCase()} composition of ${primaryProp}, clean background, minimal elements, elegant lighting`
        break
      case 'exaggerated-proportions':
        description = `Oversized ${primaryProp} with cartoon proportions, ${expectedStyle.toLowerCase()} style, visual comedy through scale`
        break
      case 'goofy-absurd':
        description = `Silly ${primaryProp} arrangement, maximum comedy chaos, ${expectedStyle.toLowerCase()} style, pure absurd energy`
        break
    }
    
    return {
      visualStyle: expectedStyle,
      layout: layouts[index % layouts.length],
      description,
      props: props.slice(0, 3),
      interpretation: mode,
      mood: moodKeywords
    }
  })
}

// Enhanced visual generation with 6-mode validation
async function generateVisualRecommendations(params: GenerateVisualsParams): Promise<VisualRecommendation[]> {
  const { system, user } = buildVisualPrompt(params)
  const expectedStyle = visualStyles[params.visualStyle.toLowerCase().replace(/\s+/g, '-')]?.name || 'General'
  const { allProps } = extractVisualElements(params.finalText, params.category, params.insertWords)
  
  console.log('Generating 6-mode visuals with params:', params)
  console.log('Extracted props:', allProps)
  
  let attempts = 0
  const maxAttempts = 3
  
  while (attempts < maxAttempts) {
    attempts++
    
    try {
      const rawResponse = await callOpenAIWithTimeout(system, user)
      console.log(`Visual generation attempt ${attempts}:`, rawResponse.substring(0, 300))
      
      // Parse JSON response
      let parsed
      try {
        // Extract JSON from response - handle multiple formats
        let jsonText = rawResponse
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonText = jsonMatch[0]
        }
        
        // Clean up common JSON issues
        jsonText = jsonText.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}')
        
        parsed = JSON.parse(jsonText)
      } catch (e) {
        console.error('JSON parse error:', e.message)
        console.error('Raw response:', rawResponse.substring(0, 500))
        continue
      }
      
      // Validate visuals array
      if (!parsed.visuals || !Array.isArray(parsed.visuals)) {
        console.error('Invalid visuals array in response')
        continue
      }
      
      // Validate each visual recommendation
      const validVisuals: VisualRecommendation[] = []
      const usedInterpretations = new Set<string>()
      
      // Ensure we get exactly 6 different interpretation modes
      const requiredModes = ['cinematic', 'close-up', 'crowd-reaction', 'minimalist', 'exaggerated-proportions', 'goofy-absurd']
      
      for (const rec of parsed.visuals) {
        const validated = validateVisualRec(rec, expectedStyle, allProps)
        if (validated && !usedInterpretations.has(validated.interpretation)) {
          validVisuals.push(validated)
          usedInterpretations.add(validated.interpretation)
        }
      }
      
      console.log(`Attempt ${attempts}: Got ${validVisuals.length} valid visuals with modes: [${[...usedInterpretations].join(', ')}]`)
      
      // Success if we have at least 4 different modes (allow partial success)
      if (validVisuals.length >= 4) {
        return validVisuals.slice(0, 6) // Return up to 6 visuals
      }
      
      console.log(`Need at least 4 different visual modes, got ${validVisuals.length}, retrying...`)
      
    } catch (error) {
      console.error(`Visual generation attempt ${attempts} failed:`, error)
    }
  }
  
  // Fallback: create visual recommendations using the 6-mode system
  console.log('Using enhanced fallback visual generation with 6 modes')
  const fallbackModes = ['cinematic', 'close-up', 'crowd-reaction', 'minimalist', 'exaggerated-proportions', 'goofy-absurd']
  const { allProps: fallbackProps, mood } = extractVisualElements(params.finalText, params.category, params.insertWords)
  const moodKeywords = TONE_TO_MOOD[params.tone] || 'balanced mood'
  
  return fallbackModes.slice(0, 6).map((mode, index) => {
    const modeConfig = VISUAL_MODES[mode]
    const primaryProp = fallbackProps[0] || 'main subject'
    const secondaryProp = fallbackProps[1] || 'scene elements'
    
    let description = ''
    switch (mode) {
      case 'cinematic':
        description = `Wide dramatic ${expectedStyle.toLowerCase()} shot of ${primaryProp} scene, ${moodKeywords}, cinematic lighting, full environment visible`
        break
      case 'close-up':
        description = `Detailed ${expectedStyle.toLowerCase()} close-up of ${primaryProp} and ${secondaryProp}, shallow depth of field, intimate focus, ${moodKeywords}`
        break
      case 'crowd-reaction':
        description = `Group of people reacting to ${primaryProp} situation, ${params.category} setting, ${expectedStyle.toLowerCase()} style, expressions and gestures, ${moodKeywords}`
        break
      case 'minimalist':
        description = `Clean simple ${expectedStyle.toLowerCase()} composition featuring ${primaryProp}, negative space, minimal elements, strong lighting, ${moodKeywords}`
        break
      case 'exaggerated-proportions':
        description = `Comically oversized ${primaryProp} with tiny ${secondaryProp}, cartoon-style proportions, ${expectedStyle.toLowerCase()} rendering, visual comedy through scale`
        break
      case 'goofy-absurd':
        description = `Peak absurdity with ${primaryProp} behaving ridiculously, chaotic ${secondaryProp} placement, maximum silliness, ${expectedStyle.toLowerCase()} style, pure comedy energy`
        break
    }
    
    return {
      visualStyle: expectedStyle,
      layout: layouts[index % layouts.length],
      description,
      props: fallbackProps.slice(0, 3),
      interpretation: mode,
      mood: moodKeywords
    }
  })
}

// Build visual prompt function (placeholder for compatibility)
function buildVisualPrompt(params: GenerateVisualsParams): { system: string; user: string } {
  return buildEnhancedVisualPrompt(params);
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const params = await req.json() as GenerateVisualsParams
    
    // Extract user ID from request for RLS compliance
    const authHeader = req.headers.get('authorization')
    let userId: string | undefined
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7)
        // Create a temporary supabase client to get user from token
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )
        const { data: { user } } = await supabase.auth.getUser(token)
        userId = user?.id
      } catch (error) {
        console.log('Could not extract user ID from token:', error)
      }
    }
    
    // Validate required parameters
    if (!params.finalText || !params.visualStyle) {
      throw new Error('finalText and visualStyle are required')
    }
    
    console.log('Visual generation request:', params)
    
    const visuals = await generateVisuals(params)
    
    // Save to history with user ID for proper RLS
    await saveToVisualHistory(visuals, params, userId)
    
    const response: GenerateVisualsResponse = {
      success: true,
      visuals,
      model: 'gpt-4o-mini'
    }
    
    console.log('Visual generation successful:', visuals.length, 'recommendations')
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Visual generation error:', error)
    
    // Enhanced error handling for better user feedback
    let userMessage = 'Visual generation failed'
    let statusCode = 500
    
    if (error.message.includes('timeout') || error.message.includes('Visual generation timed out')) {
      userMessage = 'Visual generation timed out. The AI service is taking too long to respond. Please try again.'
      statusCode = 408
    } else if (error.message.includes('Invalid JSON') || error.message.includes('JSON parse')) {
      userMessage = 'Visual generation returned invalid data. Please try again with different settings.'
      statusCode = 422
    } else if (error.message.includes('Only generated')) {
      userMessage = 'Could not generate enough visual variations. Try simpler text or different style.'
      statusCode = 422
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        visuals: [],
        model: 'gpt-4o-mini',
        error: userMessage,
        troubleshooting: 'Try: simpler text, different visual style, or retry in a moment'
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
