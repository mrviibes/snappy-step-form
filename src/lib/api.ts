interface GenerateTextParams {
  tone: string
  category?: string
  subcategory?: string
  specificWords?: string[]
  style?: string
  rating?: string
  comedianStyle?: string
}

interface GenerateTextResponse {
  success: boolean
  options: string[]
  model: string
  error?: string
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

interface HealthResponse {
  ok: boolean
  error?: string
}

// Get Supabase URL from the environment or use localhost for development
const getSupabaseUrl = () => {
  // In production, this will be set by Lovable/Supabase
  return import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321'
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const supabaseUrl = getSupabaseUrl()
    const response = await fetch(`${supabaseUrl}/functions/v1/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      return false
    }
    
    const data: HealthResponse = await response.json()
    return data.ok
  } catch (error) {
    console.error('Health check failed:', error)
    return false
  }
}

export async function generateTextOptions(params: GenerateTextParams): Promise<string[]> {
  try {
    const supabaseUrl = getSupabaseUrl()
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data: GenerateTextResponse = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Generation failed')
    }
    
    return data.options
  } catch (error) {
    console.error('Text generation failed:', error)
    throw error
  }
}

export async function generateVisualOptions(params: GenerateVisualsParams): Promise<VisualRecommendation[]> {
  try {
    const supabaseUrl = getSupabaseUrl()
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-visuals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data: GenerateVisualsResponse = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Visual generation failed')
    }
    
    return data.visuals
  } catch (error) {
    console.error('Visual generation failed:', error)
    throw error
  }
}