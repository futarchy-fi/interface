# Metadata Mapping Documentation

This document explains how the **Input Configuration** (JSON file) is transformed into the **Output Metadata Payload** sent to the backend API.

This notification is triggered automatically after the successful creation of the liquidity pools. The rich metadata is attached **only** to the notification for the **First Pool** (YES Company / YES Currency).

## 1. Input Configuration
Example from `config/test-vlr-ethereum.json`:

```json
{
  "chainId": 1,
  "amm": "uniswap",
  "proposalAddress": "0x4912cd9f05DDDC1831CEB605b9E5b31E7631F7d9",
  "marketName": "Will 'PIP - Liquidity Funding...' be approved?",
  "openingTime": 1758565452,
  "display_text_1": "What will the impact on VLR price be",
  "display_text_2": "if 'PIP ...' is approved?",
  "companyToken": {
    "symbol": "VLR",
    "address": "0x4e107a0000DB66f0E9Fd2039288Bf811dD1f9c74"
  },
  "currencyToken": {
    "symbol": "sDAI",
    "address": "0x83F20F44975D03b1b09e64809B757c47f942BEeA"
  },
  "spotPrice": 0.0126779661,
  "eventProbability": 0.5,
  "impact": 0.02,
  "liquidityAmounts": [0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001],
  "companyId": "11",
  "feeTier": 500
}
```

## 2. Output Metadata Payload
The JSON payload sent to `BACKEND_API_URL`:

```json
{
  "address": "0xPool1Address...",       // Address of Pool 1 (YES VLR / YES sDAI)
  "type": "uniswapv3",
  "proposal_address": "0x4912cd9f05DDDC1831CEB605b9E5b31E7631F7d9",
  "company_id": 11,
  "chain_id": 1,
  "metadata": {
    "name": "YES_VLR / YES_sDAI",
    "title": "Will 'PIP - Liquidity Funding...' be approved?",
    "description": "Will 'PIP - Liquidity Funding...' be approved?",
    "marketName": "Will 'PIP - Liquidity Funding...' be approved?",
    "reality": {
      "questionText": "Will 'PIP - Liquidity Funding...' be approved?"
    },
    "display_title_0": "What will the impact on VLR price be",
    "display_title_1": "if 'PIP ...' is approved?",
    "impact": 0.02,
    "spotPrice": 0.0126779661,
    "eventProbability": 0.5,
    "openingTime": 1758565452,
    "companyId": 11,
    "companyTokens": {
      "base": {
        "tokenName": "VLR",
        "tokenSymbol": "VLR",
        "wrappedCollateralTokenAddress": "0x4e107a0000DB66f0E9Fd2039288Bf811dD1f9c74"
      },
      "yes": { "tokenSymbol": "YES_VLR", "wrappedCollateralTokenAddress": "0xYesVlr..." },
      "no": { "tokenSymbol": "NO_VLR", "wrappedCollateralTokenAddress": "0xNoVlr..." }
    },
    "currencyTokens": {
      "base": {
        "tokenName": "sDAI",
        "tokenSymbol": "sDAI",
        "wrappedCollateralTokenAddress": "0x83F20F44975D03b1b09e64809B757c47f942BEeA"
      },
      "yes": { "tokenSymbol": "YES_sDAI", "wrappedCollateralTokenAddress": "0xYesSdai..." },
      "no": { "tokenSymbol": "NO_sDAI", "wrappedCollateralTokenAddress": "0xNoSdai..." }
    },
    "prediction_pools": {
      "yes": { "address": "0xPool5Address...", "tokenBaseSlot": 0 },
      "no": { "address": "0xPool6Address...", "tokenBaseSlot": 1 }
    },
    "conditional_pools": {
      "yes": { "address": "0xPool1Address...", "tokenCompanySlot": 0 },
      "no": { "address": "0xPool2Address...", "tokenCompanySlot": 1 }
    }
  }
}
```

## 3. Mapping Logic

| Input Config Field | Output Metadata Field | Description |
| :--- | :--- | :--- |
| `marketName` | `metadata.title`<br>`metadata.description`<br>`metadata.marketName`<br>`metadata.reality.questionText` | The main question/title of the market. Mapped to multiple fields for compatibility. |
| `display_text_1` | `metadata.display_title_0` | First part of the display title (e.g., "What will be the price..."). |
| `display_text_2` | `metadata.display_title_1` | Second part of the display title (e.g., "if outcome is YES?"). |
| `companyToken` | `metadata.companyTokens.base` | Details of the base company token (e.g., VLR). |
| `currencyToken` | `metadata.currencyTokens.base` | Details of the base currency token (e.g., sDAI). |
| `spotPrice` | `metadata.spotPrice` | The initial spot price used for calculations. |
| `eventProbability` | `metadata.eventProbability` | The probability of the YES outcome (e.g., 0.5). |
| `impact` | `metadata.impact` | The price impact parameter. |
| `companyId` | `company_id`<br>`metadata.companyId` | The ID of the company/DAO (defaults to 9 if missing). |
| `openingTime` | `metadata.openingTime` | Timestamp when the market resolves. |
| `proposalAddress` | `proposal_address`<br>`metadata.proposalAddress` | The on-chain address of the Futarchy proposal. |

### Dynamic Fields (Calculated)

These fields are **not** in the config but are generated during the execution:

*   **`metadata.companyTokens.yes/no`**: Discovered from the proposal or wrapped token logs.
*   **`metadata.currencyTokens.yes/no`**: Discovered from the proposal or wrapped token logs.
*   **`metadata.prediction_pools`**:
    *   `yes`: Address of **Pool 5** (YES Currency / Currency).
    *   `no`: Address of **Pool 6** (NO Currency / Currency).
    *   `tokenBaseSlot`: Calculated by comparing token addresses. If Base Token < Conditional Token, slot is 0, else 1.
*   **`metadata.conditional_pools`**:
    *   `yes`: Address of **Pool 1** (YES Company / YES Currency).
    *   `no`: Address of **Pool 2** (NO Company / NO Currency).
    *   `tokenCompanySlot`: Calculated by comparing token addresses. If Company Token < Currency Token, slot is 0, else 1.
