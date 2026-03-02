# Proposal Chain Deployment 🚀

Easily deploy and manage Futarchy markets on Gnosis Chain.

## 🛠️ Setup (First Run)

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Compile Contracts:**
    ```bash
    npx hardhat compile
    ```

3.  **Configure Environment (`.env`):**
    Copy `.env.example` to `.env` and fill in your details:
    ```env
    RPC_URL=https://rpc.gnosischain.com
    PRIVATE_KEY=your_private_wallet_key
    ETHERSCAN_API_KEY=your_gnosisscan_key
    
    # Safety Limits (Max tokens to approve)
    COMPANY_TOKEN_APPROVAL_AMOUNT=0.02
    CURRENCY_TOKEN_APPROVAL_AMOUNT=1
    ```

4.  **Configure Market (`deploymentConfig.json`):**
    Set your market parameters (Name, Price, Liquidity) in this file.

---

## 🚀 Option 1: Deploy New System
**Deploys a new Orchestrator contract**, verifies it, and creates the first 6 pools.

```bash
npm run deployFutarchy
```

*Note: You may see a "Deprecated V1 Endpoint" warning during verification. This is normal; the script handles it automatically.*

---

## 🔄 Option 2: Run on Existing System
**Creates pools on an alreayd deployed Orchestrator**.

1.  Add the address to your `.env` file:
    ```env
    ORCHESTRATOR_ADDRESS=0xYourDeployedAddress
    ```

2.  Run the command:
    ```bash
    npm run createFutarchy
    ```

---

## ⛓️ Option 3: Deploy Futarchy Aggregator (Metadata System)
**Deploys the Metadata factories for Proposal, Organization, and Aggregators.**

1.  **Run Deployment Script:**
    ```bash
    npm run deployAggregator
    ```
    This script will deploy the factories and attempt to verify them.

2.  **Verification:**
    If the automatic verification fails, the recommended way to verify on Gnosis Chain is using **Sourcify** (enabled in our config).
    
    Get the addresses from the deployment output and run:

    ```bash
    npx hardhat verify --network gnosis <ProposalMetadataFactoryAddress>
    npx hardhat verify --network gnosis <OrganizationMetadataFactoryAddress>
    npx hardhat verify --network gnosis <FutarchyAggregatorFactoryAddress>
    ```

    *Note: We suggest using Sourcify as GnosisScan API v1 is deprecated.*
