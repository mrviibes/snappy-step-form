import { getStoredApiKey } from '@/components/ApiKeyManager'
import { promptBuilder } from './promptBuilder'

interface GenerateTextParams {
  tone: string
  category?: string
  subcategory?: string
  specificWords?: string[]
  style?: string
  rating?: string
  comedianStyle?: string
}

export const generateTextOptions = async (params: GenerateTextParams): Promise<string[]> => {
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set your API key first.')
  }

  // Build sophisticated prompt using the prompt builder
  const prompt = promptBuilder.buildPrompt(params)

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

    // Validate each option against AI rules
    const validatedOptions: string[] = []
    const validationErrors: string[] = []

    for (const option of options) {
      const validation = promptBuilder.validateGeneratedText(option, params)
      if (validation.isValid) {
        validatedOptions.push(option)
      } else {
        validationErrors.push(`"${option}": ${validation.errors.join(', ')}`)
      }
    }

    // If we don't have enough valid options, use the best we have
    if (validatedOptions.length === 0) {
      console.warn('No options passed validation:', validationErrors)
      // Return original options if none pass validation
      return options.length > 0 ? options : [`Generated ${params.tone} text fallback`]
    }

    // Pad with fallbacks if needed, but prioritize valid options
    while (validatedOptions.length < 4 && options.length > validatedOptions.length) {
      const remainingOption = options.find(opt => !validatedOptions.includes(opt))
      if (remainingOption) {
        validatedOptions.push(remainingOption)
      } else {
        break
      }
    }

    // Final fallback if still not enough options
    while (validatedOptions.length < 4) {
      validatedOptions.push(`Generated ${params.tone || 'humorous'} text option ${validatedOptions.length + 1}`)
    }

    return validatedOptions
  } catch (error) {
    console.error('OpenAI API Error:', error)
    throw error
  }
}