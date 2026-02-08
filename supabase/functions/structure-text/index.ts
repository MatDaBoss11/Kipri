// Supabase Edge Function: structure-text
// Handles text filtering and product data structuring using GPT-3.5-turbo
// This keeps the OpenAI API key secure on the server

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Product {
  product: string
  brand?: string
  price: string
  size: string
  store: string
  categories?: string[]
  unitPrice?: string
  discount?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { rawText, action = 'structure' } = await req.json()

    if (!rawText) {
      return new Response(
        JSON.stringify({ success: false, error: 'No text provided' }),
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

    if (action === 'filter') {
      const result = await filterUsefulText(openaiApiKey, rawText)
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Default: structure product data
    const result = await structureProductData(openaiApiKey, rawText)
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing text:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal processing error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function structureProductData(apiKey: string, rawText: string): Promise<Product | null> {
  const prompt = `
    You are analyzing OCR text from a grocery store promotional flyer.
    Extract structured product information from the following text.

    OCR Text: "${rawText}"

    Extract the following information (return null if not found):
    - Product name
    - Price (with currency)
    - Unit price (if available, e.g., "Rs 45/kg")
    - Size/weight (e.g., "500g", "1L")
    - Brand name
    - Category (infer if possible: dairy, meat, vegetables, etc.)
    - Discount percentage (if mentioned)

    Return ONLY a JSON object with these fields. No additional text.
    Example format:
    {
      "name": "Fresh Milk",
      "price": "Rs 45",
      "size": "1L",
      "store": "Super U",
      "category": "Dairy",
      "discount": "20%"
    }
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
    throw new Error('Failed to structure product data')
  }

  const data = await response.json()
  let result = data.choices[0]?.message?.content?.trim() || ""

  // Clean markdown formatting
  if (result.startsWith('```json')) result = result.slice(7)
  if (result.endsWith('```')) result = result.slice(0, -3)
  result = result.trim()

  try {
    const productData = JSON.parse(result)
    return {
      product: productData.name || 'Unknown',
      price: productData.price || '0',
      size: productData.size || 'N/A',
      store: productData.store || 'Unknown Store',
      unitPrice: productData.unit_price,
      categories: productData.category ? [productData.category] : undefined,
      discount: productData.discount,
    }
  } catch {
    return null
  }
}

async function filterUsefulText(apiKey: string, rawText: string): Promise<string | null> {
  const prompt = `
    You are analyzing OCR text from a grocery store promotional image.
    Extract only the useful product information and filter out noise, headers, and irrelevant text.

    OCR Text: "${rawText}"

    Keep only:
    - Product names
    - Prices and price-related information
    - Brand names
    - Product sizes/weights
    - Discount information
    - Categories if mentioned

    Remove:
    - Store names and logos
    - Page numbers
    - General promotional text
    - Navigation elements
    - Decorative text
    - Repeated headers

    Return the cleaned text, organized by product. If no useful product information is found, return "NO_PRODUCTS_FOUND".
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
      max_tokens: 500,
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to filter text')
  }

  const data = await response.json()
  const cleanedText = data.choices[0]?.message?.content?.trim() || ""

  return cleanedText === 'NO_PRODUCTS_FOUND' ? null : cleanedText
}
