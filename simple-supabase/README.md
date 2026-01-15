# Simple Supabase Trade History Realtime Test

A minimal Node.js setup to test Supabase realtime functionality for trade history using `postgres_changes` events.

## 🚀 Quick Setup

1. **Install dependencies:**
   ```bash
   cd simple-supabase
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open in browser:**
   ```
   http://localhost:3000
   ```

## 📋 Configuration

- **Event Type:** `postgres_changes`
- **Schema:** `public`
- **Table:** `trade_history`
- **Filter:** `user_address=eq.{connected_wallet}`

## 🧪 Testing Steps

### 1. Basic Connection Test
1. Open the app in your browser
2. Click "Connect MetaMask"
3. Click "📊 Fetch Trades" to load existing trades

### 2. Realtime Test (Filtered)
1. Click "🚀 Start Realtime" 
2. This will listen for changes to trades for your connected wallet address only
3. Try "🧪 Test Insert" to insert a test trade (if you have write permissions)

### 3. Simple Realtime Test (No Filter)
1. Click "🔧 Test Simple Realtime (No Filter)"
2. This will listen for ALL changes to the trade_history table
3. Any changes to any trade will trigger an event

## 🔍 What to Look For

### Successful Connection
- Realtime Status shows 🟢
- Debug logs show "REALTIME FULLY CONNECTED"
- Subscription status shows "SUBSCRIBED"

### Realtime Events
- Look for "POSTGRES_CHANGES EVENT" in debug logs
- Events should show: INSERT, UPDATE, or DELETE
- Payload includes full trade data

### Common Issues
- **No events received:** Check if realtime is enabled on the table in Supabase dashboard
- **Connection fails:** Verify Supabase URL and API key
- **Insert fails:** Normal if you don't have write permissions

## 📊 Debug Information

The app provides comprehensive logging:
- All WebSocket connection events
- Full payload data for each realtime event
- Subscription status changes
- Error details

## 🔧 Key Features

- **Minimal Setup:** Just HTML + Node.js + Supabase
- **Proper postgres_changes:** Uses correct event type and schema
- **Comprehensive Logging:** See exactly what's happening
- **Two Test Modes:** Filtered (by wallet) and unfiltered (all trades)
- **Visual Feedback:** Real-time stats and trade display

## 📁 Files

- `package.json` - Dependencies and scripts
- `server.js` - Simple Express server
- `index.html` - Main test interface
- `README.md` - This file

## 🌐 Supabase Configuration

Make sure your Supabase project has:
1. Realtime enabled on the `trade_history` table
2. Proper RLS policies (if using Row Level Security)
3. Anonymous access allowed (or proper authentication)

## 🔗 Useful Links

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [postgres_changes Reference](https://supabase.com/docs/guides/realtime/postgres-changes) 