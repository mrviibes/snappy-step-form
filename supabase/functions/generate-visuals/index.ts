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
  tone: string
  textStyle: string
  rating: string
  insertWords?: string[]
  visualStyle: string
}

interface VisualRecommendation {
  visualStyle: string
  layout: string
  description: string
  props?: string[]
}

interface GenerateVisualsResponse {
  success: boolean
  visuals: VisualRecommendation[]
  model: string
  error?: string
}

// Extract key visual elements from text
function extractVisualElements(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/)
  const visualElements = words.filter(word => {
    // Remove common words and focus on nouns/verbs that could be visual
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'just', 'called', 'it', 'is', 'was', 'are', 'were', 'have', 'has', 'had']
    return word.length > 3 && !commonWords.includes(word) && !/^\d+$/.test(word)
  })
  return visualElements.slice(0, 5) // Top 5 visual elements
}

// Build visual generation prompt
function buildVisualPrompt(params: GenerateVisualsParams): { system: string; user: string } {
  const { finalText, category, subcategory, tone, textStyle, rating, insertWords = [], visualStyle } = params
  
  const selectedStyle = visualStyles[visualStyle.toLowerCase().replace(/\s+/g, '-')] || visualStyles['general']
  const visualElements = extractVisualElements(finalText)
  const palette = toneToPalette[tone] || 'balanced color palette'
  const boldness = ratingToBoldness[rating] || 'moderate styling'
  
  const bannedTerms = selectedStyle.banned.length > 0 
    ? `NEVER use these conflicting styles: ${selectedStyle.banned.join(', ')}`
    : ''

  const system = `You are a visual content specialist who creates detailed visual recommendations for humorous one-liners.

CRITICAL RULES:
- Generate exactly 4 distinct visual recommendations
- Each must use a different layout from: ${layouts.join(', ')}
- Visual style MUST be: ${selectedStyle.name} - ${selectedStyle.description}
- ${bannedTerms}
- Tie visual elements to specific words from the text
- Never fabricate personal details (age, occupation, etc.)
- Focus on mood, objects, actions, and settings from the text

OUTPUT FORMAT (JSON only):
{
  "visuals": [
    {
      "visualStyle": "${selectedStyle.name}",
      "layout": "one of the layout types",
      "description": "detailed visual description incorporating text elements",
      "props": ["key", "visual", "elements"]
    }
  ]
}`

  const user = `Create 4 visual recommendations for this humorous line:

TEXT: "${finalText}"

CONTEXT:
- Category: ${category}${subcategory ? ` > ${subcategory}` : ''}
- Tone: ${tone} (${palette})
- Text Style: ${textStyle}
- Rating: ${rating} (${boldness})
- Key Visual Elements: ${visualElements.join(', ')}
- Important Words: ${insertWords.join(', ')}

Requirements:
- Each visual must highlight different aspects of the text
- Use ${selectedStyle.name} style consistently
- Incorporate the ${palette} and ${boldness} approach
- Reference specific objects/actions from: ${visualElements.join(', ')}
- Make each layout choice enhance the humor
- Ensure variety across all 4 recommendations`

  return { system, user }
}

// Validate visual recommendation
function validateVisualRec(rec: any, expectedStyle: string): VisualRecommendation | null {
  if (!rec || typeof rec !== 'object') return null
  
  const { visualStyle, layout, description, props = [] } = rec
  
  // Validate required fields
  if (!visualStyle || !layout || !description) return null
  if (typeof description !== 'string' || description.length < 20) return null
  if (!layouts.includes(layout)) return null
  
  // Validate visual style matches expected
  if (visualStyle !== expectedStyle) return null
  
  // Validate props if provided
  if (props && !Array.isArray(props)) return null
  
  return {
    visualStyle,
    layout,
    description: description.trim(),
    props: Array.isArray(props) ? props.filter(p => typeof p === 'string') : []
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
        const validated = validateVisualRec(rec, expectedStyle)
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
  const visualElements = extractVisualElements(params.finalText)
  
  return fallbackLayouts.map((layout, index) => ({
    visualStyle: expectedStyle,
    layout,
    description: `${expectedStyle} style ${layout.replace('-', ' ')} featuring ${visualElements[index] || 'the main concept'} from "${params.finalText.substring(0, 30)}..."`,
    props: visualElements.slice(0, 3)
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