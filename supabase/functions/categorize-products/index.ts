// Supabase Edge Function: categorize-products
// Handles product categorization using GPT-3.5-turbo
// This keeps the OpenAI API key secure on the server

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedCategories = [
  'grown', 'meat', 'wheat', 'dairy', 'liquid', 'frozen', 'snacks', 'miscellaneous'
]

interface FoodCategoryResult {
  isFood: boolean
  category: string
  confidence: number
  description?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { texts, mode = 'batch' } = await req.json()

    if (!texts || (Array.isArray(texts) && texts.length === 0)) {
      return new Response(
        JSON.stringify({ success: false, error: 'No texts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle single text categorization
    if (mode === 'single' || !Array.isArray(texts)) {
      const text = Array.isArray(texts) ? texts[0] : texts
      const result = await categorizeSingle(openaiApiKey, text)
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle batch categorization
    const results = await categorizeBatch(openaiApiKey, texts)
    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error categorizing products:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal processing error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function categorizeSingle(apiKey: string, text: string): Promise<FoodCategoryResult> {
  const prompt = `
    Analyze the following text and determine if it describes a food or grocery item.
    If it is a food item, categorize it using ONLY one of these exact categories.

    Text: "${text}"

    ALLOWED CATEGORIES (use ONLY these exact values):
    ${allowedCategories.join(', ')}

    CRITICAL: You MUST choose one of the exact categories above. Do not create new categories or modify these names.

    Respond with a JSON object containing:
    - isFood: boolean (true if this is a food/grocery item)
    - category: string (MUST be exactly one of: ${allowedCategories.join(', ')})
    - confidence: number (0.0 to 1.0)
    - description: string (brief explanation)
  `

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to categorize product')
  }

  const data = await response.json()
  let result = data.choices[0]?.message?.content?.trim() || ""

  // Clean markdown formatting
  if (result.startsWith('```json')) result = result.slice(7)
  if (result.endsWith('```')) result = result.slice(0, -3)
  result = result.trim()

  try {
    const parsed = JSON.parse(result)
    const category = parsed.category || 'miscellaneous'
    const validatedCategory = allowedCategories.includes(category) ? category : 'miscellaneous'

    return {
      isFood: parsed.isFood || false,
      category: validatedCategory,
      confidence: parsed.confidence || 0.5,
      description: parsed.description,
    }
  } catch {
    return {
      isFood: false,
      category: 'miscellaneous',
      confidence: 0.0,
      description: 'Failed to parse response',
    }
  }
}

async function categorizeBatch(apiKey: string, texts: string[]): Promise<FoodCategoryResult[]> {
  const textList = texts.map((text, index) => `${index + 1}. "${text}"`).join('\n')

  const prompt = `
    Analyze the following list of texts and determine if each describes a food or grocery item.
    If it is a food item, categorize it using ONLY the allowed categories below.

    Texts:
    ${textList}

    ALLOWED CATEGORIES (use ONLY these exact values):
    ${allowedCategories.join(', ')}

    CRITICAL: You MUST choose one of the exact categories above. Do not create new categories or modify these names.

    Respond with a JSON array where each object contains:
    - index: number (corresponding to input order)
    - isFood: boolean (true if this is a food/grocery item)
    - category: string (MUST be exactly one of: ${allowedCategories.join(', ')})
    - confidence: number (0.0 to 1.0)
    - description: string (brief explanation)

    Return ONLY the JSON array, no additional text.
  `

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to categorize products')
  }

  const data = await response.json()
  let result = data.choices[0]?.message?.content?.trim() || ""

  // Clean markdown formatting
  if (result.startsWith('```json')) result = result.slice(7)
  if (result.endsWith('```')) result = result.slice(0, -3)
  result = result.trim()

  try {
    const parsedArray = JSON.parse(result)
    const results: FoodCategoryResult[] = new Array(texts.length)

    for (const item of parsedArray) {
      const index = (item.index || 1) - 1
      if (index >= 0 && index < texts.length) {
        const category = item.category || 'miscellaneous'
        const validatedCategory = allowedCategories.includes(category) ? category : 'miscellaneous'

        results[index] = {
          isFood: item.isFood || false,
          category: validatedCategory,
          confidence: item.confidence || 0.5,
          description: item.description,
        }
      }
    }

    // Fill any missing results
    for (let i = 0; i < results.length; i++) {
      if (!results[i]) {
        results[i] = {
          isFood: false,
          category: 'miscellaneous',
          confidence: 0.0,
          description: 'Failed to analyze',
        }
      }
    }

    return results
  } catch {
    // Fallback: return empty results
    return texts.map(() => ({
      isFood: false,
      category: 'miscellaneous',
      confidence: 0.0,
      description: 'Failed to parse response',
    }))
  }
}
