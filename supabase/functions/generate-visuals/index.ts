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

// Extract visual props from Step-2 text + category lexicon + insert words
function extractVisualElements(text: string, category: string, insertWords: string[] = []): {
  textProps: string[], 
  categoryProps: string[], 
  allProps: string[],
  mood: string[],
  actions: string[]
} {
  const words = text.toLowerCase().split(/\W+/).filter(word => word.length > 2)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'just', 'called', 'it', 'is', 'was', 'are', 'were', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'might', 'must', 'can', 'do', 'did', 'does', 'get', 'got', 'been', 'being', 'well', 'now', 'then', 'here', 'there', 'this', 'that', 'these', 'those', 'like', 'than', 'more', 'most', 'some', 'much', 'many', 'all', 'any', 'when', 'who', 'what', 'where', 'why', 'how'])
  
  // Extract meaningful props from text
  const meaningfulWords = words.filter(word => 
    !stopWords.has(word) && 
    !/^\d+$/.test(word) && 
    word.length > 2
  )
  
  // Get category-specific props
  const categoryKey = category.toLowerCase().replace(/\s+/g, '-')
  const categoryLexicon = CATEGORY_LEXICONS[categoryKey] || CATEGORY_LEXICONS['general']
  
  // Find props mentioned in text
  const textProps = meaningfulWords.filter(word => {
    // Visual nouns that can be rendered
    return word.length > 3 || ['cat', 'dog', 'car', 'sun', 'sky', 'sea', 'eye', 'art', 'cup', 'box', 'hat', 'map', 'key', 'gem', 'ice', 'oil', 'gas', 'bar', 'mic', 'dj'].includes(word)
  })
  
  // Extract category props that appear in text or are contextually relevant
  const categoryProps = categoryLexicon.filter(prop => 
    text.toLowerCase().includes(prop) || 
    meaningfulWords.some(word => word.includes(prop.substring(0, 3)))
  )
  
  // Combine all props, prioritizing insert words, then text props, then category props
  const allProps = [
    ...insertWords.filter(word => word.trim().length > 0),
    ...textProps.slice(0, 4),
    ...categoryProps.slice(0, 3)
  ].filter((prop, index, arr) => arr.indexOf(prop) === index).slice(0, 6)
  
  // Extract action/emotion words for mood
  const moodWords = meaningfulWords.filter(word => {
    const emotions = ['laugh', 'smile', 'cry', 'angry', 'happy', 'sad', 'excited', 'calm', 'worried', 'surprised', 'shocked', 'amazed', 'confused', 'proud', 'embarrassed', 'nervous', 'confident']
    const actions = ['dance', 'sing', 'run', 'walk', 'jump', 'fall', 'fly', 'swim', 'climb', 'throw', 'catch', 'break', 'build', 'create', 'destroy', 'explode', 'burn', 'freeze', 'melt', 'shine', 'glow']
    return emotions.some(e => word.includes(e) || e.includes(word)) ||
           actions.some(a => word.includes(a) || a.includes(word))
  })
  
  const actions = meaningfulWords.filter(word => {
    const actionIndicators = ['made', 'make', 'creating', 'leaving', 'taking', 'giving', 'moving', 'running', 'walking', 'flying', 'falling', 'rising', 'shining', 'glowing', 'breaking', 'building', 'growing', 'flowing', 'burning', 'melting', 'dancing', 'singing', 'clapping', 'pointing', 'laughing', 'crying', 'shouting']
    return actionIndicators.some(indicator => word.includes(indicator.substring(0, 4)) || indicator.includes(word))
  })
  
  return {
    textProps: textProps.slice(0, 4),
    categoryProps: categoryProps.slice(0, 3), 
    allProps,
    mood: moodWords.slice(0, 3),
    actions: actions.slice(0, 3)
  }
}

// Simplified visual prompt for faster generation
function buildSimplifiedVisualPrompt(params: GenerateVisualsParams): { system: string; user: string } {
  const { finalText, category, subcategory, visualStyle, rating } = params
  
  const selectedStyle = visualStyles[visualStyle.toLowerCase().replace(/\s+/g, '-')] || visualStyles['general']
  const { allProps } = extractVisualElements(finalText, category, params.insertWords)
  
  // Get only the most important props (max 3)
  const keyProps = allProps.slice(0, 3)
  const propList = keyProps.length > 0 ? keyProps.join(', ') : 'birthday elements'
  
  const system = `Create 6 SHORT visual descriptions for image generation (20-30 words each).

CRITICAL RULES:
- Text: "${finalText}"
- Style: ${selectedStyle.name} 
- Props: ${propList}
- Each description must be completely different
- Use exactly these 6 modes: cinematic, close-up, crowd-reaction, minimalist, exaggerated-proportions, goofy-absurd

FORMAT: JSON with "visuals" array containing objects with "description", "interpretation", "layout", "visualStyle", "props".

Keep descriptions simple and concrete - avoid complex lighting descriptions.`

  const user = `Generate 6 visual concepts for: "${finalText}"

1. CINEMATIC: Wide shot of ${propList}, ${category} setting
2. CLOSE-UP: Detail view of ${keyProps[0] || 'main element'}, shallow focus  
3. CROWD REACTION: People reacting to ${keyProps[0] || 'scene'}, group expressions
4. MINIMALIST: Simple ${keyProps[0] || 'element'} on clean background
5. EXAGGERATED PROPORTIONS: Oversized ${keyProps[0] || 'elements'}, cartoon proportions
6. GOOFY ABSURD: Silly ${propList} arrangement, maximum comedy

Each 20-30 words, ${selectedStyle.name.toLowerCase()} style.`

  return { system, user }
}

// Enhanced visual prompt builder with comprehensive context
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
  const { textProps, categoryProps, allProps, mood, actions } = extractVisualElements(finalText, category, insertWords)
  const visualMood = TONE_TO_MOOD[tone] || 'balanced mood and lighting'
  const styleMood = selectedStyle.moodKeywords?.[rating] || 'appropriate mood for rating'
  
  const bannedTerms = selectedStyle.banned.length > 0 
    ? `CRITICAL: NEVER use these conflicting styles: ${selectedStyle.banned.join(', ')}`
    : ''

  const system = `You are a Step-3 Visual Concept Generator creating exactly 6 distinct visual interpretations.

MASTER RULES:
1. Generate exactly 6 visual concepts using the official variation modes
2. Each description: 20-35 words maximum 
3. Anchor every concept to the Step-2 text: "${finalText}"
4. Include concrete props from text: ${allProps.slice(0, 4).join(', ')}
5. Style: ${selectedStyle.name} - ${selectedStyle.description}
6. ${bannedTerms}
7. Mood: ${visualMood}
8. Rating guidance: ${styleMood}

THE 6 OFFICIAL VARIATION MODES:
1. CINEMATIC: ${VISUAL_MODES.cinematic.description} - ${VISUAL_MODES.cinematic.focus}
2. CLOSE-UP: ${VISUAL_MODES['close-up'].description} - ${VISUAL_MODES['close-up'].focus}  
3. CROWD REACTION: ${VISUAL_MODES['crowd-reaction'].description} - ${VISUAL_MODES['crowd-reaction'].focus}
4. MINIMALIST: ${VISUAL_MODES.minimalist.description} - ${VISUAL_MODES.minimalist.focus}
5. EXAGGERATED PROPORTIONS: ${VISUAL_MODES['exaggerated-proportions'].description} - ${VISUAL_MODES['exaggerated-proportions'].focus}
6. GOOFY ABSURD: ${VISUAL_MODES['goofy-absurd'].description} - ${VISUAL_MODES['goofy-absurd'].focus}

CRITICAL: Each mode must produce a completely different composition and camera angle.

OUTPUT FORMAT (JSON only):
{
  "visuals": [
    {
      "visualStyle": "${selectedStyle.name}",
      "layout": "layout-type",
      "description": "20-35 word description with specific props and ${selectedStyle.name.toLowerCase()} style", 
      "props": ["prop1", "prop2", "prop3"],
      "interpretation": "cinematic/close-up/crowd-reaction/minimalist/exaggerated-proportions/goofy-absurd",
      "cameraAngle": "specific camera direction and framing"
    }
  ]
}`

  const user = `STEP-2 TEXT: "${finalText}"

CONTEXT:
- Category: ${category}${subcategory ? ` > ${subcategory}` : ''}
- Props to include: ${allProps.join(', ')}
- Insert words: ${insertWords.join(', ') || 'none'}
- Mood: ${mood.join(', ') || 'general'}
- Actions: ${actions.join(', ') || 'static scene'}

Generate 6 completely different ${selectedStyle.name.toLowerCase()} visual concepts:

1. CINEMATIC (${VISUAL_MODES.cinematic.cameraAngle}):
   Wide dramatic shot showing the full scene from "${finalText}", include: ${allProps.slice(0, 2).join(', ')}

2. CLOSE-UP (${VISUAL_MODES['close-up'].cameraAngle}): 
   Detailed intimate view of key props: ${allProps.slice(0, 3).join(', ')}, shallow focus

3. CROWD REACTION (${VISUAL_MODES['crowd-reaction'].cameraAngle}):
   People reacting to the situation in "${finalText}", ${category} setting, group expressions

4. MINIMALIST (${VISUAL_MODES.minimalist.cameraAngle}):
   Clean simple composition, essential elements only: ${allProps.slice(0, 2).join(', ')}, negative space

5. EXAGGERATED PROPORTIONS (${VISUAL_MODES['exaggerated-proportions'].cameraAngle}):
   Comically oversized or distorted ${allProps[0] || 'elements'}, cartoon-style proportions, visual comedy

6. GOOFY ABSURD (${VISUAL_MODES['goofy-absurd'].cameraAngle}):
   Peak silliness from "${finalText}", props behaving ridiculously, maximum comedy chaos

Each description must:
- Use exact words from the original text
- Include specific ${selectedStyle.name.toLowerCase()} style elements  
- Have ${visualMood}
- Stay 20-35 words
- Be completely unique in composition`

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
async function callOpenAIWithRetry(systemPrompt: string, userPrompt: string, maxRetries: number = 2): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🎯 Visual API attempt ${attempt + 1}/${maxRetries}`);
      
      const result = await withTimeout(callOpenAI(systemPrompt, userPrompt), 18000); // 18s timeout
      
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
        if (errorMessage === 'timeout_exceeded') {
          throw new Error('Visual generation timed out after multiple attempts');
        }
        throw error;
      }
      
      // Wait before retry with jitter
      const delay = 300 + Math.random() * 500 + (attempt * 1000);
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
    // Use simplified prompt for faster generation
    const { system, user } = buildSimplifiedVisualPrompt(params)
    
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
      throw new Error('Invalid JSON response from visual generation API')
    }
    
    // Validate and process visuals
    if (!parsed.visuals || !Array.isArray(parsed.visuals)) {
      throw new Error('Response missing visuals array')
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
    
    // Return results (even if not perfect 6)
    if (validVisuals.length >= 4) {
      console.log(`🎉 Generated ${validVisuals.length} valid visuals with modes: [${[...usedInterpretations].join(', ')}]`)
      return validVisuals.slice(0, 6)
    }
    
    throw new Error(`Only generated ${validVisuals.length} valid visuals, need at least 4`)
    
  } catch (error) {
    console.error('💥 Visual generation failed:', error.message)
    
    // Return fast fallback visuals to prevent timeout
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