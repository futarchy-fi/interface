
export const ALGEBRA_POOL_ABI = [
    {
        "inputs": [],
        "name": "globalState",
        "outputs": [
            { "internalType": "uint160", "name": "price", "type": "uint160" },
            { "internalType": "int24", "name": "tick", "type": "int24" },
            { "internalType": "uint16", "name": "fee", "type": "uint16" },
            { "internalType": "uint16", "name": "timepointIndex", "type": "uint16" },
            { "internalType": "uint8", "name": "communityFeeToken0", "type": "uint8" },
            { "internalType": "uint8", "name": "communityFeeToken1", "type": "uint8" },
            { "internalType": "bool", "name": "unlocked", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "token0",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "token1",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

export const ALGEBRA_FACTORY_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "tokenA", "type": "address" },
            { "internalType": "address", "name": "tokenB", "type": "address" }
        ],
        "name": "poolByPair",
        "outputs": [{ "internalType": "address", "name": "pool", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

export const ALGEBRA_POSITION_MANAGER_ABI = [
    {
        "inputs": [],
        "name": "factory",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;
