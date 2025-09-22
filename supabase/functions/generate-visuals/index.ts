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
  
  // Map visual taste to specific guidance
  const tasteGuidance = {
    balanced: "balanced composition with natural elements",
    cinematic: "dramatic lighting, depth of field, cinematic shadows and contrast", 
    dreamlike: "soft ethereal textures, surreal atmospheric effects",
    action: "dynamic motion, high energy composition, bold contrasts",
    exaggerated: "amplified features, intense colors, dramatic proportions"
  }[visualTaste] || "balanced approach"
  
  // Map dimensions to layout guidance
  const dimensionGuidance = {
    square: "centered composition with balanced negative space",
    landscape: "wide cinematic format with horizontal emphasis", 
    portrait: "vertical composition with upward visual flow"
  }[dimension] || "centered composition"
  
  const bannedTerms = selectedStyle.banned.length > 0 
    ? `NEVER use these conflicting styles: ${selectedStyle.banned.join(', ')}`
    : ''

  const system = `You are a visual concept generator that creates text-anchored visual recommendations for humorous content.

CRITICAL RULES:
1. ALWAYS anchor visuals to specific words from the text: "${finalText}"
2. Extract key nouns, verbs, and concepts from the text to create props and scenes
3. Generate exactly 4 distinct visual interpretations:
   - Literal interpretation (direct objects/verbs from text)
   - Metaphorical interpretation (symbolic props related to text meaning)
   - Cinematic interpretation (dramatic lighting/focus on text elements)
   - Abstract interpretation (textures/patterns inspired by text concepts)
4. Visual style MUST be: ${selectedStyle.name} - ${selectedStyle.description}
5. ${bannedTerms}
6. Use ${tasteGuidance} for overall mood
7. Apply ${dimensionGuidance} for composition
8. Never fabricate personal details (age, occupation, relationships)
9. Each recommendation must use a different layout approach

LAYOUT TYPES: ${layouts.join(', ')}

OUTPUT FORMAT (JSON only):
{
  "visuals": [
    {
      "visualStyle": "${selectedStyle.name}",
      "layout": "layout-type",
      "description": "detailed visual description anchored to text elements",
      "props": ["specific", "elements", "from", "text"],
      "interpretation": "literal/metaphorical/cinematic/abstract",
      "palette": ["#color1", "#color2", "#color3"],
      "mood": "specific mood description"
    }
  ]
}`

  const user = `Create 4 visual recommendations anchored to this text:

TEXT: "${finalText}"

EXTRACTED ELEMENTS:
- Key Nouns: ${nouns.join(', ') || 'none identified'}
- Action Verbs: ${verbs.join(', ') || 'none identified'} 
- Visual Concepts: ${concepts.join(', ') || 'general themes'}
- Insert Words: ${insertWords.join(', ') || 'none'}
- Custom Visuals: ${customVisuals.join(', ') || 'none'}

CONTEXT:
- Category: ${category}${subcategory ? ` > ${subcategory}` : ''}${subSubcategory ? ` > ${subSubcategory}` : ''}
- Tone: ${tone} (use ${palette})
- Text Style: ${textStyle}
- Rating: ${rating} (apply ${boldness})
- Visual Taste: ${visualTaste} (${tasteGuidance})
- Dimension: ${dimension} (${dimensionGuidance})

REQUIREMENTS:
1. Literal: Use direct objects/verbs from the text (e.g., if text mentions "impression", show fingerprints, footprints, dents)
2. Metaphorical: Create symbolic representations of text meaning
3. Cinematic: Apply dramatic ${selectedStyle.name.toLowerCase()} lighting to text elements
4. Abstract: Transform text concepts into textures/patterns while staying ${selectedStyle.name.toLowerCase()}

Each visual must:
- Reference specific words from: ${concepts.join(', ')}
- Use ${selectedStyle.name} style language only
- Apply ${palette} color approach
- Follow ${dimensionGuidance} composition
- Enhance the ${tone} mood of the text`

  return { system, user }
}

// Validate visual recommendation with enhanced checks
function validateVisualRec(rec: any, expectedStyle: string, textConcepts: string[]): VisualRecommendation | null {
  if (!rec || typeof rec !== 'object') return null
  
  const { visualStyle, layout, description, props = [], interpretation, palette = [], mood } = rec
  
  // Validate required fields
  if (!visualStyle || !layout || !description) return null
  if (typeof description !== 'string' || description.length < 20) return null
  if (!layouts.includes(layout)) return null
  
  // Validate visual style matches expected
  if (visualStyle !== expectedStyle) return null
  
  // Validate props if provided
  if (props && !Array.isArray(props)) return null
  
  // Check if description is anchored to text concepts
  const lowercaseDesc = description.toLowerCase()
  const hasTextAnchor = textConcepts.some(concept => 
    lowercaseDesc.includes(concept.toLowerCase()) || 
    concept.toLowerCase().length > 3 && lowercaseDesc.includes(concept.toLowerCase().slice(0, -1))
  )
  
  if (!hasTextAnchor && textConcepts.length > 0) {
    console.log(`Visual rejected: no text anchoring. Concepts: ${textConcepts.join(', ')}, Description: ${description.substring(0, 50)}`)
    return null
  }
  
  return {
    visualStyle,
    layout,
    description: description.trim(),
    props: Array.isArray(props) ? props.filter(p => typeof p === 'string') : [],
    interpretation,
    palette: Array.isArray(palette) ? palette : [],
    mood
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
  
  return fallbackLayouts.map((layout, index) => ({
    visualStyle: expectedStyle,
    layout,
    description: `${expectedStyle} style ${layout.replace('-', ' ')} featuring ${fallbackConcepts[index] || 'the main concept'} from "${params.finalText.substring(0, 30)}..."`,
    props: fallbackConcepts.slice(0, 3),
    interpretation: ['literal', 'metaphorical', 'cinematic', 'abstract'][index] || 'literal'
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