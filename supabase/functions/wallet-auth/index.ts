import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as ethers from 'https://esm.sh/ethers@5.7.2'
import { create, verify } from 'https://deno.land/x/djwt@v2.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Hardcoded JWT secret - this should match your Supabase JWT secret
const JWT_SECRET = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { wallet_address, message, signature } = await req.json()
    
    if (!wallet_address || !message || !signature) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Verify the signature
    try {
      const recoveredAddress = ethers.utils.verifyMessage(message, signature)
      
      if (recoveredAddress.toLowerCase() !== wallet_address.toLowerCase()) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Signature verification failed: ' + error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Call the authenticate_wallet function
    const { data: authData, error: authError } = await supabase
      .rpc('authenticate_wallet', {
        wallet_address: wallet_address.toLowerCase(),
        nonce: message,
        signature: signature
      })
    
    if (authError) throw authError
    
    if (!authData) {
      throw new Error('Authentication failed')
    }

    // Create JWT token using the hardcoded secret
    const jwt = await create(
      { alg: 'HS512', typ: 'JWT' },
      {
        sub: authData.user_id || wallet_address.toLowerCase(),
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
        wallet_address: wallet_address.toLowerCase()
      },
      JWT_SECRET // Use the hardcoded secret
    )

    return new Response(
      JSON.stringify({
        user: {
          id: authData.user_id,
          wallet_address: wallet_address.toLowerCase()
        },
        session: {
          access_token: jwt,
          refresh_token: jwt // Using same token for refresh token
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 