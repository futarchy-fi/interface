# Futarchy Aggregator System

This system provides a structured way to organize and index Futarchy proposals. It creates a hierarchy that allows subgraphs and frontends to easily discover all proposals associated with an organization.

## 🔗 Live Example (Gnosis Chain)

The following instances were created using the **Clones Pattern**. They point to verified implementations, so they are automatically verified.

1.  **Aggregator**: [FutarchyFi (0xdc...0EE)](https://gnosisscan.io/address/0xdc5825b60462F38C41E0d3e7F7e3052148A610EE)
    *   *Desc*: "The premier aggregation layer for Futarchy markets."
    *   *Contains*: **GNOSIS DAO**

2.  **Organization**: [GNOSIS DAO (0xe2...47)](https://gnosisscan.io/address/0xe204584Feb4564d3891739E395F6d6198F218247)
    *   *Desc*: "Gnosis DAO is the decentralized autonomous organization governing the Gnosis ecosystem."
    *   *Contains*: **Proposal "Will GNO price..."**

3.  **Proposal Metadata**: [Metadata (0xA6...77)](https://gnosisscan.io/address/0xA62c418D49dd955df13C92F6939E1ebc09227077)
    *   **Question**: "What will be the price of GNO"
    *   **Linked Proposal**: `0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418`

---

## 🛠️ Infrastructure Addresses (Clones Factories)

These factories deploy minimal proxies (Clones) which are cheap and auto-verified.

| Contract | Address |
| :--- | :--- |
| **Aggregator Factory** | [`0x511D18d5567d76bbd20dEaDF4F90CD9f039eEd2D`](https://gnosisscan.io/address/0x511D18d5567d76bbd20dEaDF4F90CD9f039eEd2D) |
| **Organization Factory** | [`0xf4AeE123eEd6B86121F289EC81877150E0FD53Ae`](https://gnosisscan.io/address/0xf4AeE123eEd6B86121F289EC81877150E0FD53Ae) |
| **Proposal Factory** | [`0xdc1248BD6ef64476166cD9823290dF597Ea4Ddb6`](https://gnosisscan.io/address/0xdc1248BD6ef64476166cD9823290dF597Ea4Ddb6) |

---

## 🧪 How to Create & Test

You can create new metadata instances programmatically or via Etherscan/GnosisScan.

### Option 1: Using the Script (Recommended)
We have a script that creates an entire hierarchy (Proposal -> Organization -> Aggregator).

1.  Open `scripts/create_metadata_hierarchy.js`.
2.  Edit the `DATA` object with your custom details (Question, Company Name, etc.).
3.  Run the script:
    ```bash
    npx hardhat run scripts/create_metadata_hierarchy.js --network gnosis
    ```
4.  The console will output the new addresses. You can view them immediately on GnosisScan.

### Option 2: Using Block Explorer (Manual)
You can directly interact with the Factories on GnosisScan to create new instances.

1.  **Create Organization**:
    *   Go to the [Organization Factory](https://gnosisscan.io/address/0xf4AeE123eEd6B86121F289EC81877150E0FD53Ae#writeContract).
    *   Connect your wallet.
    *   Call `createOrganizationMetadata("My DAO", "Description")`.
    *   Use the new address from the transaction logs.

2.  **Add Proposal to Organization**:
    *   Go to your new Organization contract (on GnosisScan).
    *   Call `addProposal(<ProposalMetadataAddress>)`.

---

## 📐 Hierarchy Explanation

```mermaid
graph TD
    A[Futarchy Aggregator (FutarchyFi)] -->|Contains| B[Organization (GNOSIS DAO)]
    B -->|Contains| C[Proposal Metadata]
    C -->|Points to| D[Real Futarchy Proposal]
```
