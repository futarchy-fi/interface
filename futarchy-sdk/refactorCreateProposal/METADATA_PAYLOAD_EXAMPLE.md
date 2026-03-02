# Metadata Payload Example (Velora)

Based on `config/test-vlr-ethereum.json`, here is the example payload that will be sent to the backend for the first pool (YES VLR / YES sDAI).

**Note**: Addresses for pools and wrapped tokens are placeholders/examples as they are generated dynamically.

```json
{
  "address": "0xPool1Address...",
  "type": "uniswapv3",
  "proposal_address": "0x4912cd9f05DDDC1831CEB605b9E5b31E7631F7d9",
  "company_id": 11,
  "chain_id": 1,
  "metadata": {
    "name": "YES_VLR / YES_sDAI",
    "chain": 1,
    "pools": [
      {
        "reserves": {
          "token0": "0",
          "token1": "0"
        },
        "volume7d": 0,
        "volume24h": 0
      }
    ],
    "title": "Will 'PIP - Liquidity Funding for Futarchy Experimentation in Velora Governance' be approved ('Yes') or rejected ('No') by VeloraDAO? If unresolved by 2025-10-31 23:59 UTC, it resolves to 'No'.",
    "impact": 0.02,
    "token0": "0xYesVlrAddress...",
    "token1": "0xYesSdaiAddress...",
    "reality": {
      "questionText": "Will 'PIP - Liquidity Funding for Futarchy Experimentation in Velora Governance' be approved ('Yes') or rejected ('No') by VeloraDAO? If unresolved by 2025-10-31 23:59 UTC, it resolves to 'No'."
    },
    "outcomes": [
      "Yes",
      "No"
    ],
    "proposal": {
      "creator": "0xYourWalletAddress...",
      "creationTimestamp": 1732890000
    },
    "routerV2": "0x00",
    "routerV3": "0x00",
    "spotPool": "0x00",
    "analytics": {
      "offChain": {
        "clicks": 0,
        "pageViews": 0
      }
    },
    "companyId": 11,
    "spotPrice": 0.0126779661,
    "marketName": "Will 'PIP - Liquidity Funding for Futarchy Experimentation in Velora Governance' be approved ('Yes') or rejected ('No') by VeloraDAO? If unresolved by 2025-10-31 23:59 UTC, it resolves to 'No'.",
    "questionId": "0x00",
    "conditionId": "0x00",
    "description": "Will 'PIP - Liquidity Funding for Futarchy Experimentation in Velora Governance' be approved ('Yes') or rejected ('No') by VeloraDAO? If unresolved by 2025-10-31 23:59 UTC, it resolves to 'No'.",
    "numOutcomes": 2,
    "openingTime": 1758565452,
    "questionLink": "",
    "companyTokens": {
      "no": {
        "tokenName": "NO_VLR",
        "tokenSymbol": "NO_VLR",
        "wrappedCollateralTokenAddress": "0xNoVlrAddress..."
      },
      "yes": {
        "tokenName": "YES_VLR",
        "tokenSymbol": "YES_VLR",
        "wrappedCollateralTokenAddress": "0xYesVlrAddress..."
      },
      "base": {
        "tokenName": "VLR",
        "tokenSymbol": "VLR",
        "wrappedCollateralTokenAddress": "0x4e107a0000DB66f0E9Fd2039288Bf811dD1f9c74"
      }
    },
    "contractInfos": {
      "futarchy": {
        "router": "0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc"
      }
    },
    "routerAddress": "0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc",
    "currencyTokens": {
      "no": {
        "tokenName": "NO_sDAI",
        "tokenSymbol": "NO_sDAI",
        "wrappedCollateralTokenAddress": "0xNoSdaiAddress..."
      },
      "yes": {
        "tokenName": "YES_sDAI",
        "tokenSymbol": "YES_sDAI",
        "wrappedCollateralTokenAddress": "0xYesSdaiAddress..."
      },
      "base": {
        "tokenName": "sDAI",
        "tokenSymbol": "sDAI",
        "wrappedCollateralTokenAddress": "0x83F20F44975D03b1b09e64809B757c47f942BEeA"
      }
    },
    "factoryAddress": "0x...",
    "display_title_0": "What will the impact on VLR price be",
    "display_title_1": "if 'PIP - Liquidity Funding for Futarchy Experimentation in Velora Governance' is approved?",
    "futarchyAdapter": "0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc",
    "proposalAddress": "0x4912cd9f05DDDC1831CEB605b9E5b31E7631F7d9",
    "background_image": "",
    "eventProbability": 0.5,
    "prediction_pools": {
      "no": {
        "address": "0xPool6Address...",
        "tokenBaseSlot": 1
      },
      "yes": {
        "address": "0xPool5Address...",
        "tokenBaseSlot": 0
      }
    },
    "conditional_pools": {
      "no": {
        "address": "0xPool2Address...",
        "tokenCompanySlot": 1
      },
      "yes": {
        "address": "0xPool1Address...",
        "tokenCompanySlot": 0
      }
    }
  }
}
```
