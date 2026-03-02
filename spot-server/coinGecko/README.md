# Super Easy GeckoTerminal Price Server

Pass token symbols, get SubgraphChart-ready candles.

## Quick Start

```bash
cd spot-server/coinGecko
npm install
npm start
```

Server at `http://localhost:3457`

---

## Usage

```bash
# By token symbols (must be exact!)
GET /candles?tokens=waGnoGNO/sDAI
GET /candles?tokens=GNO/WXDAI

# By base & quote
GET /candles?base=waGnoGNO&quote=sDAI

# By pool address (when you know it)
GET /candles?pool=0xd1d7fa8871d84d0e77020fc28b7cd5718c446522

# Search for pools
GET /search?q=waGnoGNO
```

---

## Parameters

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `tokens` | ❌ | - | e.g., `waGnoGNO/sDAI` |
| `base` | ❌ | - | e.g., `waGnoGNO` |
| `quote` | ❌ | - | e.g., `sDAI` |
| `pool` | ❌ | - | Pool address |
| `network` | | `xdai` | Network name |
| `timeframe` | | `hour` | `minute`, `hour`, `day` |
| `limit` | | `100` | 1-1000 |
| `aggregate` | | `1` | 1,4,12 (hour); 1,5,15 (minute) |
| `autoRate` | | `true` | Auto-apply rate for known wrapped tokens |

---

## Auto Rate Detection

These wrapped tokens are auto-detected:
- `waGnoGNO` → rate from `0xbbb4...`
- `wagnogno` → same

When detected, the rate is automatically applied to prices.

---

## Response Format

```json
{
  "candles": [{ "time": 1704067200, "value": 120.49 }],
  "pool": {
    "address": "0xd1d7...",
    "name": "waGnoGNO / sDAI 0.25%",
    "baseToken": "waGnoGNO",
    "quoteToken": "sDAI"
  },
  "price": 120.49,
  "rate": {
    "provider": "0xbbb4...",
    "rate": 1.004841,
    "token": "waGnoGNO",
    "source": "auto-detected"
  },
  "count": 100
}
```

---

## Examples

| Request | Result |
|---------|--------|
| `?tokens=waGnoGNO/sDAI` | waGnoGNO/sDAI pool, rate auto-applied |
| `?tokens=GNO/WXDAI` | GNO/WXDAI pool, no rate needed |
| `?pool=0xd1d7...` | Direct pool lookup |
| `/search?q=GNO` | Find all GNO pools |
