# 🏛️ Futarchy SDK - SDAI Approval Example

Simple, modular Web3 example using Viem to approve SDAI tokens for the Futarchy Router on Gnosis Chain.

## ✨ Features

- **Modular Architecture**: BaseExecutor → ViemExecutor → SDAIApprovalExample
- **Real-time Updates**: Async generators provide live transaction status
- **Beautiful UI**: Modern web interface with progress tracking
- **Error Handling**: Comprehensive error handling and user feedback
- **Chain Support**: Configured for Gnosis Chain with sDAI token

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Open Web Interface
Simply open `index.html` in your browser or use a local server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

### 3. Use CLI (Node.js)
```bash
# Run with default 1000 sDAI approval
node examples/sdai-approval.js

# Run with custom amount
node examples/sdai-approval.js 500
```

## 🏗️ Architecture

```
BaseExecutor (Abstract)
    ↓
ViemExecutor (Viem Implementation)  
    ↓
SDAIApprovalExample (Use Case)
    ↓
index.html (UI Demo)
```

## 📋 Contract Addresses (Gnosis Chain)

- **sDAI**: `0xaf204776c7245bF4147c2612BF6e5972Ee483701`
- **Futarchy Router**: `0x7495a583ba85875d59407781b4958ED6e0E1228f`

## 🔧 How It Works

1. **Connect Wallet**: Uses injected provider (MetaMask)
2. **Check Balance**: Reads sDAI balance via contract call  
3. **Approve Tokens**: Executes ERC20 approval transaction
4. **Real-time Updates**: Provides status throughout the process

## 🧩 Modular Design

Each component is completely modular:

- **BaseExecutor**: Abstract interface for all executors
- **ViemExecutor**: Viem-specific implementation with wallet connection
- **SDAIApprovalExample**: Business logic for SDAI approval flow
- **index.html**: UI layer that uses the modules

## 🎯 Operations Supported

- `web3.connect` - Connect to injected wallet
- `web3.approve` - ERC20 token approval
- `web3.getBalance` - Get token/ETH balance
- `web3.transfer` - Token transfer (placeholder)

## 🔍 Status Updates

The executor yields real-time status updates:

```javascript
for await (const status of executor.execute('web3.approve', args)) {
    console.log(status.status); // 'pending' | 'success' | 'error'
    console.log(status.message); // Human-readable message
    console.log(status.step); // Current step identifier
    console.log(status.data); // Transaction data (hash, receipt, etc.)
}
```

This follows your original vision of modular, flexible, and reliable Web3 interactions! 🚀 