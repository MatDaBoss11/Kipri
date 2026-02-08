// Supabase Edge Function: process-receipt
// Handles GPT-4o Vision for receipt OCR and batch product extraction
// Extracts ALL line items from a grocery receipt photo

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReceiptItem {
  product_name: string
  abbreviated_name: string
  brand: string
  price: number
  quantity: number
  size: string
}

interface ReceiptScanResult {
  store_name: string
  date: string
  items: ReceiptItem[]
  total: number
  currency: string
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

    const prompt = `You are a receipt data extraction assistant for a grocery price comparison app in Mauritius. Analyze this receipt image and extract ALL product line items.

IMPORTANT RULES:

1. STORE NAME: Extract the store name from the receipt header. Common Mauritius stores:
   - Winners / Winners Supermarket
   - Kingsavers / King Saver
   - Super U / SuperU / Hyper U
   - Intermart
   - Shoprite
   - Pick N Pay
   Return JUST the store brand name (e.g. "Winners" not "Winners Supermarket Pereybere")

2. DATE: Extract the receipt date. Format as YYYY-MM-DD. If not found, use empty string "".

3. ITEMS: Extract EVERY product line item. For each item:
   - product_name: The FULL expanded product name. IMPORTANT: Receipts abbreviate names heavily. You MUST expand abbreviations to the full product name a customer would recognize:
     * "NESTL CHOC MLK" → "NESTLE CHOCOLATE MILK"
     * "PNT BTR CRNCHY" → "PEANUT BUTTER CRUNCHY"
     * "YOG NAT 0%" → "YOGURT NATURAL 0%"
     * "CCA COL 1.5L" → "COCA COLA 1.5L"
     * "DINA SCR BLC" → "DINA SUCRE BLANC"
     * Always write the full name in ALL CAPITALS
   - abbreviated_name: The ORIGINAL abbreviated text as it appears on the receipt
   - brand: The brand name in ALL CAPITALS (e.g. "NESTLE", "COCA COLA", "DINA"). If unknown, use ""
   - price: The UNIT price as a number (not the line total). If quantity > 1, divide the line total by quantity to get unit price
   - quantity: Number of units purchased (default 1)
   - size: Product size/weight if visible (e.g. "1.5L", "500G", "1KG"). If not on receipt, use ""

4. SKIP these lines (they are NOT products):
   - Subtotal, total, tax, VAT lines
   - Payment method lines (CASH, CARD, CHANGE, etc.)
   - Barcodes, receipt numbers, cashier info
   - Store header/footer text
   - Discount lines (but apply discount to the product price if applicable)

5. CURRENCY: In Mauritius, prices are in Mauritian Rupees (Rs / MUR). Set currency to "Rs".

6. TOTAL: Extract the receipt total as a number. If not found, use 0.

Return ONLY a valid JSON object with these exact fields (no explanation, no markdown):
{
  "store_name": "store name",
  "date": "YYYY-MM-DD or empty string",
  "items": [
    {
      "product_name": "FULL EXPANDED NAME",
      "abbreviated_name": "original receipt text",
      "brand": "BRAND",
      "price": 45.50,
      "quantity": 1,
      "size": "500G"
    }
  ],
  "total": 1234.50,
  "currency": "Rs"
}`

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
        max_tokens: 4000,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API error:', errorData)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process receipt image' }),
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
    let receiptData: ReceiptScanResult
    try {
      const parsedData = JSON.parse(content)
      receiptData = {
        store_name: parsedData.store_name || "",
        date: parsedData.date || "",
        items: (parsedData.items || []).map((item: any) => ({
          product_name: item.product_name || "",
          abbreviated_name: item.abbreviated_name || item.product_name || "",
          brand: (item.brand || "").toUpperCase(),
          price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
          quantity: item.quantity || 1,
          size: item.size || "",
        })),
        total: typeof parsedData.total === 'number' ? parsedData.total : parseFloat(parsedData.total) || 0,
        currency: parsedData.currency || "Rs",
      }
    } catch (jsonError) {
      // Try regex extraction as fallback
      const jsonPattern = /\{[\s\S]*\}/
      const match = content.match(jsonPattern)

      if (match) {
        try {
          const parsedData = JSON.parse(match[0])
          receiptData = {
            store_name: parsedData.store_name || "",
            date: parsedData.date || "",
            items: (parsedData.items || []).map((item: any) => ({
              product_name: item.product_name || "",
              abbreviated_name: item.abbreviated_name || item.product_name || "",
              brand: (item.brand || "").toUpperCase(),
              price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
              quantity: item.quantity || 1,
              size: item.size || "",
            })),
            total: typeof parsedData.total === 'number' ? parsedData.total : parseFloat(parsedData.total) || 0,
            currency: parsedData.currency || "Rs",
          }
        } catch {
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to parse receipt data from AI response' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'No valid JSON found in AI response' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check if we got meaningful data
    if (receiptData.items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No product items could be extracted from the receipt' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Successfully extracted ${receiptData.items.length} items from receipt`)

    return new Response(
      JSON.stringify({ success: true, data: receiptData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing receipt:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal processing error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
