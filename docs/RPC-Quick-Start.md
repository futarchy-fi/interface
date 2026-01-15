# RPC System Quick Start

## What Changed?

The RPC testing system now **detects CORS issues before selecting an RPC**, preventing swap failures.

## Key Changes

### 1. Browser-Native Testing
- ✅ Uses `fetch()` instead of `ethers.providers.JsonRpcProvider`
- ✅ Tests in actual browser context
- ✅ Detects CORS blocks immediately

### 2. Smart Filtering
- ✅ Automatically excludes CORS-blocked RPCs
- ✅ Clear logging: `[RPC-TEST] ❌ https://example.com - CORS blocked`
- ✅ Never returns unusable RPCs

### 3. Diagnostic Tools
- ✅ New page: http://localhost:3000/rpc-diagnostics
- ✅ Functions: `diagnoseRpcs()`, `getRpcCacheStatus()`, `clearRpcCache()`

## How to Test

### Option 1: Use Diagnostics Page (Easiest)

```bash
npm run dev
# Open: http://localhost:3000/rpc-diagnostics
# Click: "Run Full Diagnostics"
# Result: See which RPCs work and which are CORS-blocked
```

### Option 2: Watch Console Logs

```bash
npm run dev
# Open: http://localhost:3000
# Check browser console
# Look for: [RPC-TEST] logs showing RPC test results
```

### Option 3: Programmatic Testing

```javascript
import { diagnoseRpcs, getBestRpc } from './src/utils/getBestRpc';

// Test all RPCs
const diagnosis = await diagnoseRpcs(100); // Gnosis Chain
console.log(`Working: ${diagnosis.working}, CORS-blocked: ${diagnosis.corsBlocked}`);

// Get best RPC (excludes CORS-blocked)
const bestRpc = await getBestRpc(100);
console.log(`Selected: ${bestRpc}`);
```

## Expected Console Output

### Good (Multiple RPCs Working)
```
[RPC-TEST] Testing 4 RPCs for chain 100...
[RPC-TEST] ✅ https://rpc.gnosischain.com - 118ms (block: 12345678)
[RPC-TEST] ✅ https://1rpc.io/gnosis - 145ms (block: 12345678)
[RPC-TEST] ❌ https://gnosis-rpc.publicnode.com - CORS blocked
[RPC-TEST] ✅ https://rpc.ankr.com/gnosis - 167ms (block: 12345678)
[RPC-TEST] ⚠️ 1 RPCs blocked by CORS: ['https://gnosis-rpc.publicnode.com']
[RPC-TEST] ✅ Best RPC: https://rpc.gnosischain.com (118ms)
[RPC-TEST] 📊 Summary: 3 working, 1 CORS-blocked, 0 other failures
```

### Bad (All RPCs CORS-Blocked)
```
[RPC-TEST] Testing 4 RPCs for chain 100...
[RPC-TEST] ❌ https://rpc.gnosischain.com - CORS blocked
[RPC-TEST] ❌ https://gnosis-rpc.publicnode.com - CORS blocked
[RPC-TEST] ❌ https://1rpc.io/gnosis - CORS blocked
[RPC-TEST] ❌ https://rpc.ankr.com/gnosis - CORS blocked
[RPC-TEST] ⚠️ 4 RPCs blocked by CORS
[RPC-TEST] ❌ All RPCs are CORS-blocked. This may be a browser configuration issue.
```

**If you see this**: Disable ad blocker or VPN for localhost

## Files Modified

1. **[src/utils/getBestRpc.js](../src/utils/getBestRpc.js)** - Core RPC testing (CORS-aware)
2. **[src/pages/rpc-diagnostics.js](../src/pages/rpc-diagnostics.js)** - NEW diagnostic UI
3. **[docs/RPC-CORS-Fix.md](./RPC-CORS-Fix.md)** - Full technical documentation
4. **[docs/ConfirmSwapModal-Architecture.md](./ConfirmSwapModal-Architecture.md)** - Updated architecture docs

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| All RPCs CORS-blocked | Disable ad blocker for localhost |
| One specific RPC always fails | System auto-excludes it ✅ |
| Swaps still failing | Check diagnostics page for working RPCs |
| Cache not updating | Click "Clear Cache" on diagnostics page |

## Next Steps

1. Test the diagnostics page: http://localhost:3000/rpc-diagnostics
2. Try a swap and watch console for RPC selection logs
3. If issues persist, share diagnostics page screenshot

## Documentation

- **Quick Start**: [docs/RPC-Quick-Start.md](./RPC-Quick-Start.md) ← You are here
- **Technical Details**: [docs/RPC-CORS-Fix.md](./RPC-CORS-Fix.md)
- **Architecture Overview**: [docs/ConfirmSwapModal-Architecture.md](./ConfirmSwapModal-Architecture.md)
