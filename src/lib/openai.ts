import { getStoredApiKey } from '@/components/ApiKeyManager'

interface GenerateTextParams {
  tone: string
  category?: string
  subcategory?: string
  specificWords?: string[]
  style?: string
  rating?: string
}

export const generateTextOptions = async (params: GenerateTextParams): Promise<string[]> => {
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set your API key first.')
  }

  const { tone, category, subcategory, specificWords, style, rating } = params

  // Build the prompt based on parameters
  let prompt = `Generate 4 different short text options (each under 100 characters) with a ${tone} tone`
  
  if (category && subcategory) {
    prompt += ` for a ${category} - ${subcategory} context`
  }
  
  if (specificWords && specificWords.length > 0) {
    prompt += `. Must include these words: ${specificWords.join(', ')}`
  }
  
  if (style && style !== 'generic') {
    prompt += `. Style: ${style}`
  }
  
  if (rating && rating !== 'g') {
    prompt += `. Rating: ${rating}`
  }
  
  prompt += '. Each option should be unique and creative. Return only the 4 text options, one per line, no numbering or extra formatting.'

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key.')
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.')
      } else {
        throw new Error(`OpenAI API error: ${response.status}`)
      }
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content?.trim()
    
    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    // Split the response into individual options and clean them up
    const options = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove any numbering or bullet points
        return line.replace(/^\d+\.?\s*/, '').replace(/^[-•]\s*/, '').trim()
      })
      .filter(line => line.length > 0)
      .slice(0, 4) // Ensure we only get 4 options

    // If we don't have exactly 4 options, pad with fallbacks
    while (options.length < 4) {
      options.push(`Generated ${tone} text option ${options.length + 1}`)
    }

    return options
  } catch (error) {
    console.error('OpenAI API Error:', error)
    throw error
  }
}