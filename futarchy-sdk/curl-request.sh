#!/bin/bash

# Raw curl request to Supabase API
# Using the exact URL and headers from the query

SUPABASE_URL="https://nvhqdqtlsdboctqjcelq.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg"

echo "======================================="
echo "   CURL REQUEST TO SUPABASE"
echo "======================================="
echo ""
echo "Executing curl request..."
echo ""

curl -X GET \
  "https://nvhqdqtlsdboctqjcelq.supabase.co/rest/v1/trade_history?select=*&user_address=eq.0x645a3d9208523bbfee980f7269ac72c61dd3b552&proposal_id=eq.0x2a4b52b47625431fdc6fe58ced3086e76c1f6bbf&order=evt_block_time.desc&limit=10" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  | python -m json.tool

echo ""
echo "======================================="
echo "   CURL REQUEST COMPLETE"
echo "======================================="