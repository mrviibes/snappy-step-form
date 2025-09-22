import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateTextParams {
  tone: string
  category?: string
  subcategory?: string
  specificWords?: string[]
  style?: string
  rating?: string
  comedianStyle?: string
}

function buildPrompt(params: GenerateTextParams): string {
  const { tone, category, subcategory, specificWords = [], style = "Generic", rating = "G", comedianStyle } = params
  
  const mandatoryWords = specificWords.slice(0, 6).join(", ")
  
  return `
Generate 4 distinct celebration one-liners for a meme generator.

Rules:
- Each line must be 60-120 characters
- One sentence per line
- No em dashes (—). Use commas or periods
- Include these words naturally if present: ${mandatoryWords || "none"}
- Tone: ${tone}
- Style: ${style}
- Rating: ${rating}
- Category: ${category}${subcategory ? `, Subcategory: ${subcategory}` : ""}
${comedianStyle ? `- Deliver in the spirit of ${comedianStyle} comedy style without naming them` : ""}

Output format:
Return exactly 4 lines, each on its own line, no numbering, no quotes, no extra text.

Example format:
Life's too short for boring celebrations, let's make some noise!
Today's the day to sparkle brighter than your phone screen.
Forget the diet, it's time to celebrate with cake and confetti.
Success tastes better when shared with amazing friends like you.
`
}

async function callOpenAI(prompt: string, model: string): Promise<string> {
  const openAiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openAiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.9,
      top_p: 0.95,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content?.trim() || ""
}

function splitAndValidate(rawText: string): string[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(line => !line.match(/^\d+\.?\s/)) // Remove numbered lines
    .slice(0, 4)

  if (lines.length === 0) {
    throw new Error('No valid lines generated')
  }

  // Pad to 4 options if we have fewer
  while (lines.length < 4) {
    lines.push(`Celebrate like there's no tomorrow - you deserve it!`)
  }

  // Validate and clean each line
  const cleanLines = lines.map(line => {
    let clean = line.replace(/["'`]/g, '').trim()
    
    // Check length
    if (clean.length < 60) {
      clean = clean + " Let's make this celebration unforgettable!"
    }
    if (clean.length > 120) {
      clean = clean.substring(0, 117) + "..."
    }
    
    // Remove em dashes
    clean = clean.replace(/—/g, '-')
    
    // Ensure proper punctuation
    if (!/[.!?]$/.test(clean)) {
      clean = clean + '!'
    }
    
    return clean
  })

  return cleanLines
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: corsHeaders }
    )
  }

  try {
    const params: GenerateTextParams = await req.json()
    
    if (!params.tone) {
      return Response.json(
        { error: 'Tone is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const prompt = buildPrompt(params)
    
    let generatedText: string
    let modelUsed: string

    // Try GPT-4o first, fall back to GPT-4o-mini
    try {
      generatedText = await callOpenAI(prompt, 'gpt-4o')
      modelUsed = 'gpt-4o'
    } catch (error) {
      console.warn('GPT-4o failed, trying GPT-4o-mini:', error.message)
      try {
        generatedText = await callOpenAI(prompt, 'gpt-4o-mini')
        modelUsed = 'gpt-4o-mini'
      } catch (fallbackError) {
        console.error('Both models failed:', fallbackError.message)
        throw new Error('Text generation failed with both models')
      }
    }

    const options = splitAndValidate(generatedText)

    return Response.json(
      { 
        success: true,
        options,
        model: modelUsed
      },
      { headers: corsHeaders }
    )

  } catch (error) {
    console.error('Generation error:', error)
    return Response.json(
      { 
        success: false, 
        error: error.message || 'Generation failed' 
      },
      { status: 500, headers: corsHeaders }
    )
  }
})