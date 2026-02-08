// Supabase Edge Function: process-image
// Handles GPT-4o Vision for OCR and product data extraction
// This keeps the OpenAI API key secure on the server

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProductData {
  product_name: string
  brand: string
  price: string
  size: string
  store: string
  categories: string[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64, imageType = 'jpeg' } = await req.json()

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get API key from environment (stored securely in Supabase)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const dataUrl = `data:image/${imageType};base64,${imageBase64}`

    const prompt = `You are a product data extraction assistant. Analyze this grocery store price tag image and extract the product information.

IMPORTANT RULES:
1. PRICE: Look for prices with Rs, R.S, R.P, or just numbers that look like prices. If you find multiple prices, pick the SMALLEST one (likely the unit price, not total). Format as "Rs XX,XX" (use comma as decimal separator).

2. PRODUCT NAME: Extract the full product name INCLUDING the brand. It should be:
   - The complete product name as a customer would recognize it
   - In ALL CAPITALS
   - MUST INCLUDE the brand name (brand is critical for product identification)
   - Should NOT include: size/weight, manufacturer words (marketing, co, ltd, distributors, etc.)
   - Should NOT include price numbers

3. SIZE: Extract size/quantity separately. Look for:
   - Weight: kg, g, lb, oz
   - Volume: L, ml, fl oz
   - Count: pieces, pcs, units, x6, x12, etc.
   - Any numbers followed by units

4. BRAND: Identify the brand/manufacturer SEPARATELY:
   - Well-known companies (Nestle, Coca-Cola, Heinz, Knorr, Kellogg's, etc.)
   - Usually the first prominent word(s)
   - Often in ALL CAPS or bold
   - Return in ALL CAPITALS
   - Note: Brand should ALSO remain in the product_name field

5. EXAMPLES:
   - "NESTLE MILO 400G Rs 45,00" → brand: "NESTLE", product_name: "NESTLE MILO", size: "400G", price: "Rs 45,00"
   - "COCA COLA 2L" → brand: "COCA COLA", product_name: "COCA COLA", size: "2L"
   - "DINA SUCRE BLANC 1KG" → brand: "DINA", product_name: "DINA SUCRE BLANC", size: "1KG"
   - "COCO POPS CEREAL 500G Rs 200" → brand: "COCO POPS", product_name: "COCO POPS CEREAL", size: "500G", price: "Rs 200,00"
   - "KELLOGG'S CORN FLAKES 750G" → brand: "KELLOGG'S", product_name: "KELLOGG'S CORN FLAKES", size: "750G"

Return ONLY a valid JSON object with these exact fields (no explanation, no markdown):
{
  "product_name": "full product name INCLUDING brand, without size",
  "brand": "extracted brand in CAPITALS (also included in product_name)",
  "price": "extracted price with Rs",
  "size": "extracted size/quantity"
}

If any field cannot be identified, use an empty string "".`

    // Call OpenAI GPT-4o Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API error:', errorData)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    let content = data.choices[0]?.message?.content?.trim() || ""

    // Clean markdown formatting if present
    if (content.startsWith("```json")) {
      content = content.substring(7)
    } else if (content.startsWith("```")) {
      content = content.substring(3)
    }
    if (content.endsWith("```")) {
      content = content.substring(0, content.length - 3)
    }
    content = content.trim()

    // Parse JSON response
    let productData: ProductData
    try {
      const parsedData = JSON.parse(content)
      productData = {
        product_name: parsedData.product_name || "",
        brand: (parsedData.brand || "").toUpperCase(),
        price: parsedData.price || "",
        size: parsedData.size || "",
        store: "",
        categories: []
      }
    } catch (jsonError) {
      // Try regex extraction as fallback
      const jsonPattern = /{[^{}]*(?:{[^{}]*}[^{}]*)*}/
      const match = content.match(jsonPattern)

      if (match) {
        try {
          const parsedData = JSON.parse(match[0])
          productData = {
            product_name: parsedData.product_name || "",
            brand: (parsedData.brand || "").toUpperCase(),
            price: parsedData.price || "",
            size: parsedData.size || "",
            store: "",
            categories: []
          }
        } catch {
          productData = { product_name: "", brand: "", price: "", size: "", store: "", categories: [] }
        }
      } else {
        productData = { product_name: "", brand: "", price: "", size: "", store: "", categories: [] }
      }
    }

    // Check if we got meaningful data
    if (!productData.product_name && !productData.price && !productData.brand) {
      return new Response(
        JSON.stringify({ success: false, error: 'No product information could be extracted from the image' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: productData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing image:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal processing error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
