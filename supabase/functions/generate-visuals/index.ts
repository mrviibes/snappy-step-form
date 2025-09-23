import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Visual style definitions
const visualStyles = {
  'realistic': {
    name: 'Realistic',
    description: 'Photorealistic images with natural lighting and authentic details',
    banned: ['cartoon', 'anime', 'illustration', 'drawing', 'sketch']
  },
  'anime': {
    name: 'Anime',
    description: 'Japanese animation style with expressive characters and vibrant colors',
    banned: ['photorealistic', 'realistic', 'photograph']
  },
  '3d-render': {
    name: '3D Render',
    description: 'Computer-generated 3D models with crisp lighting and textures',
    banned: ['flat', '2d', 'hand-drawn']
  },
  'design': {
    name: 'Design',
    description: 'Clean graphic design with typography and geometric elements',
    banned: ['cluttered', 'chaotic', 'realistic']
  },
  'general': {
    name: 'General',
    description: 'Flexible artistic style that adapts to content needs',
    banned: []
  }
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

// Extract key visual concepts from text
function extractVisualConcepts(text: string): { nouns: string[], verbs: string[], concepts: string[] } {
  const words = text.toLowerCase().split(/\W+/).filter(word => word.length > 2)
  
  // Common words to exclude
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'just', 'called', 'it', 'is', 'was', 'are', 'were', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'might', 'must', 'can', 'do', 'did', 'does', 'get', 'got', 'been', 'being', 'well', 'now', 'then', 'here', 'there', 'this', 'that', 'these', 'those'])
  
  const meaningfulWords = words.filter(word => !stopWords.has(word) && !/^\d+$/.test(word))
  
  // Identify potential nouns (things that can be visualized)
  const visualNouns = meaningfulWords.filter(word => {
    // Look for concrete nouns that suggest visual elements
    return word.length > 3 || ['cat', 'dog', 'car', 'sun', 'sky', 'sea', 'eye', 'art', 'cup', 'box', 'hat', 'map', 'key', 'gem', 'ice', 'oil', 'gas'].includes(word)
  })
  
  // Identify potential action verbs
  const actionWords = meaningfulWords.filter(word => {
    const actionIndicators = ['made', 'make', 'creating', 'leaving', 'taking', 'giving', 'moving', 'running', 'walking', 'flying', 'falling', 'rising', 'shining', 'glowing', 'breaking', 'building', 'growing', 'flowing', 'burning', 'melting', 'dancing', 'singing']
    return actionIndicators.some(indicator => word.includes(indicator) || indicator.includes(word))
  })
  
  return {
    nouns: visualNouns.slice(0, 4),
    verbs: actionWords.slice(0, 3), 
    concepts: meaningfulWords.slice(0, 6)
  }
}

// Build visual generation prompt using text-anchored approach
function buildVisualPrompt(params: GenerateVisualsParams): { system: string; user: string } {
  const { 
    finalText, 
    category, 
    subcategory, 
    subSubcategory,
    tone, 
    textStyle, 
    rating, 
    insertWords = [], 
    visualStyle,
    visualTaste = 'balanced',
    customVisuals = [],
    dimension = 'square'
  } = params
  
  const selectedStyle = visualStyles[visualStyle.toLowerCase().replace(/\s+/g, '-')] || visualStyles['general']
  const { nouns, verbs, concepts } = extractVisualConcepts(finalText)
  const palette = toneToPalette[tone] || 'balanced color palette'
  const boldness = ratingToBoldness[rating] || 'moderate styling'
  
  const bannedTerms = selectedStyle.banned.length > 0 
    ? `NEVER use these conflicting styles: ${selectedStyle.banned.join(', ')}`
    : ''

  const system = `You are a visual concept generator creating SHORT, punchy descriptions for image generation.

CRITICAL RULES:
1. Each description must be 15-35 words maximum
2. Start with main subject/action from text: "${finalText}"
3. Include 2-3 concrete visual elements from the text
4. End with lighting/mood keywords
5. Generate exactly 4 interpretations:
   - Cinematic: Dramatic camera angle, lighting, main subject prominent
   - Close-Up: Detailed focus on key elements/props from text
   - Crowd Reaction: Wide scene showing context and environment
   - Minimalist: Simple composition, essential elements only
6. Style: ${selectedStyle.name} - ${selectedStyle.description}
7. ${bannedTerms}
8. Use concrete objects, avoid abstract metaphors
9. No fabricated personal details

OUTPUT FORMAT (JSON only):
{
  "visuals": [
    {
      "visualStyle": "${selectedStyle.name}",
      "layout": "layout-type", 
      "description": "15-35 word description with subject, props, mood",
      "props": ["concrete", "elements", "from", "text"],
      "interpretation": "cinematic/close-up/crowd-reaction/minimalist"
    }
  ]
}`

  const user = `TEXT: "${finalText}"

KEY ELEMENTS: ${concepts.join(', ')}
CATEGORY: ${category}${subcategory ? ` > ${subcategory}` : ''}
STYLE: ${selectedStyle.name} | TONE: ${tone} | RATING: ${rating}

Create 4 SHORT visual descriptions (15-35 words each):

1. CINEMATIC: Dramatic shot of main subject with ${selectedStyle.name.toLowerCase()} lighting, focus on: ${concepts.slice(0, 2).join(', ')}
2. CLOSE-UP: Detailed view of key props/elements from text: ${concepts.slice(0, 3).join(', ')}  
3. CROWD REACTION: Wide scene showing full context, ${category} setting, people reacting
4. MINIMALIST: Simple ${selectedStyle.name.toLowerCase()} composition, essential elements only: ${concepts.slice(0, 2).join(', ')}

Each must:
- Use words from the original text
- Be concrete and specific
- Include lighting/mood
- Stay under 35 words`

  return { system, user }
}

// Validate visual recommendation with enhanced checks
function validateVisualRec(rec: any, expectedStyle: string, textConcepts: string[]): VisualRecommendation | null {
  if (!rec || typeof rec !== 'object') return null
  
  const { visualStyle, layout, description, props = [], interpretation } = rec
  
  // Validate required fields
  if (!visualStyle || !layout || !description || !interpretation) return null
  if (typeof description !== 'string') return null
  
  // Validate description length (15-40 words)
  const wordCount = description.trim().split(/\s+/).length
  if (wordCount < 15 || wordCount > 40) {
    console.log(`Visual rejected: ${wordCount} words (need 15-40). Description: ${description.substring(0, 50)}`)
    return null
  }
  
  // Validate layout exists
  if (!layouts.includes(layout)) return null
  
  // Validate visual style matches expected
  if (visualStyle !== expectedStyle) return null
  
  // Validate interpretation type
  const validInterpretations = ['cinematic', 'close-up', 'crowd-reaction', 'minimalist']
  if (!validInterpretations.includes(interpretation)) return null
  
  // Check if description is anchored to text concepts (more lenient)
  const lowercaseDesc = description.toLowerCase()
  const hasTextAnchor = textConcepts.length === 0 || textConcepts.some(concept => 
    concept.length > 2 && lowercaseDesc.includes(concept.toLowerCase().substring(0, Math.min(4, concept.length)))
  )
  
  if (!hasTextAnchor) {
    console.log(`Visual rejected: no text anchoring. Concepts: ${textConcepts.join(', ')}, Description: ${description.substring(0, 50)}`)
    return null
  }
  
  return {
    visualStyle,
    layout,
    description: description.trim(),
    props: Array.isArray(props) ? props.filter(p => typeof p === 'string').slice(0, 5) : [],
    interpretation
  }
}

// Call OpenAI API
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
async function saveToVisualHistory(visuals: VisualRecommendation[], payload: any) {
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
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to save to visual history:', error)
  }
}

// Generate visual recommendations
async function generateVisuals(params: GenerateVisualsParams): Promise<VisualRecommendation[]> {
  const { system, user } = buildVisualPrompt(params)
  const expectedStyle = visualStyles[params.visualStyle.toLowerCase().replace(/\s+/g, '-')]?.name || 'General'
  const { concepts } = extractVisualConcepts(params.finalText)
  
  console.log('Generating visuals with params:', params)
  
  let attempts = 0
  const maxAttempts = 3
  
  while (attempts < maxAttempts) {
    attempts++
    
    try {
      const rawResponse = await callOpenAI(system, user)
      console.log(`Visual generation attempt ${attempts}:`, rawResponse.substring(0, 200))
      
      // Parse JSON response
      let parsed
      try {
        // Extract JSON from response
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON found')
        parsed = JSON.parse(jsonMatch[0])
      } catch (e) {
        console.error('JSON parse error:', e)
        continue
      }
      
      // Validate visuals array
      if (!parsed.visuals || !Array.isArray(parsed.visuals)) {
        console.error('Invalid visuals array')
        continue
      }
      
      // Validate each visual recommendation
      const validVisuals: VisualRecommendation[] = []
      const usedLayouts = new Set<string>()
      
      for (const rec of parsed.visuals) {
        const validated = validateVisualRec(rec, expectedStyle, concepts)
        if (validated && !usedLayouts.has(validated.layout)) {
          validVisuals.push(validated)
          usedLayouts.add(validated.layout)
        }
      }
      
      if (validVisuals.length >= 4) {
        return validVisuals.slice(0, 4)
      }
      
      console.log(`Only got ${validVisuals.length} valid visuals, retrying...`)
      
    } catch (error) {
      console.error(`Visual generation attempt ${attempts} failed:`, error)
    }
  }
  
  // Fallback: create basic visual recommendations
  console.log('Using fallback visual generation')
  const fallbackLayouts = layouts.slice(0, 4)
  const { concepts: fallbackConcepts } = extractVisualConcepts(params.finalText)
  
  const interpretations = ['cinematic', 'close-up', 'crowd-reaction', 'minimalist']
  
  return fallbackLayouts.map((layout, index) => ({
    visualStyle: expectedStyle,
    layout,
    description: `${interpretations[index].replace('-', ' ')} shot featuring ${fallbackConcepts[0] || 'main subject'}, ${expectedStyle.toLowerCase()} style, ${params.tone.toLowerCase()} mood, focused lighting`,
    props: fallbackConcepts.slice(0, 3),
    interpretation: interpretations[index]
  }))
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
    
    // Validate required parameters
    if (!params.finalText || !params.visualStyle) {
      throw new Error('finalText and visualStyle are required')
    }
    
    console.log('Visual generation request:', params)
    
    const visuals = await generateVisuals(params)
    
    // Save to history
    await saveToVisualHistory(visuals, params)
    
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
    
    const response: GenerateVisualsResponse = {
      success: false,
      visuals: [],
      model: 'gpt-4o-mini',
      error: error.message
    }
    
    return new Response(
      JSON.stringify(response),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})