import { Executor, Cartridge } from "../Executor";
import { getContract } from "viem";

// The ABI provided by the user for fetching tokens
const MARKET_ABI = [
    {
        "inputs": [],
        "name": "collateralToken1",
        "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "collateralToken2",
        "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
        "name": "wrappedOutcome",
        "outputs": [
            { "internalType": "contract IERC20", "name": "wrapped1155", "type": "address" },
            { "internalType": "bytes", "name": "data", "type": "bytes" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

export class FutarchyCartridge implements Cartridge {
    marketAddress: `0x${string}`;
    tokens: Record<string, string> = {};

    constructor(marketAddress: string) {
        this.marketAddress = marketAddress as `0x${string}`;
    }

    async install(exec: Executor) {
        const { rpc } = exec.services;
        if (!rpc) {
            console.error("[FutarchyCartridge] CRITICAL: RPC client is missing from Executor services!");
        }

        console.log(`[FutarchyCartridge] Installing for market: ${this.marketAddress}...`);

        // 1. Dynamic Discovery Phase
        // We fetch the immutable token addresses once during installation/init.
        const marketContract = getContract({
            address: this.marketAddress,
            abi: MARKET_ABI,
            client: rpc
        }) as any;

        try {
            // Parallel fetch for speed
            const [col1, col2, yesCol1, noCol1, yesCol2, noCol2] = await Promise.all([
                marketContract.read.collateralToken1(),
                marketContract.read.collateralToken2(),
                marketContract.read.wrappedOutcome([BigInt(0)]), // YES_COMPANY
                marketContract.read.wrappedOutcome([BigInt(1)]), // NO_COMPANY
                marketContract.read.wrappedOutcome([BigInt(2)]), // YES_CURRENCY
                marketContract.read.wrappedOutcome([BigInt(3)])  // NO_CURRENCY
            ]);

            // Map outcomes - wrappedOutcome returns [tokenAddress, data] (struct)
            // But viem readContract might return it as an array or object depending on config.
            // Based on standard ABI return, it's likely an array-like result or object.
            // Let's assume standard object return or array destructuring works.

            // The ABI says outputs: [address, bytes].

            this.tokens = {
                "COLLATERAL_1": col1, // Company (e.g. GNO)
                "COLLATERAL_2": col2, // Currency (e.g. sDAI)

                // Outcomes
                "YES_COLLATERAL_1": (yesCol1 as any)[0],
                "NO_COLLATERAL_1": (noCol1 as any)[0],
                "YES_COLLATERAL_2": (yesCol2 as any)[0],
                "NO_COLLATERAL_2": (noCol2 as any)[0],

                // UI Aliases (Compat with TradePanelUI)
                // Assuming Col1 = Company (NVDA placeholder) and Col2 = Currency (sDAI)
                "NVDA": col1,
                "YES_NVDA": (yesCol1 as any)[0],
                "NO_NVDA": (noCol1 as any)[0],
                "sDAI": col2,
                "YES_sDAI": (yesCol2 as any)[0],
                "NO_sDAI": (noCol2 as any)[0]
            };

            console.log(`[FutarchyCartridge] Discovered Tokens:`, this.tokens);

        } catch (err) {
            console.error("[FutarchyCartridge] Failed to discover tokens. Is the address correct?", err);
            // We might throw or allow partial functionality. For now, let's warn.
        }

        // 2. Register Commands

        // Command: Get the discovered tokens
        exec.registerCommand("market.getTokens", async () => {
            return this.tokens;
        });

        // Command: Get a specific token address by semantic name
        exec.registerCommand("market.getTokenAddress", async ({ name }: { name: string }) => {
            return this.tokens[name] || null;
        });

        // Command: Initialize (Wrapper around contract initialize if needed, or just debug)
        exec.registerCommand("market.debug", async () => {
            return {
                address: this.marketAddress,
                tokens: this.tokens
            };
        });

        // Command: Get Balance of a specific token
        // usage: exec.run('market.getBalance', { token: 'sDAI', user: '0x...' })
        exec.registerCommand("market.getBalance", async ({ token, user }: { token: string, user: string }) => {
            if (!user) return BigInt(0);

            // Resolve token address (either semantic or raw)
            const tokenAddress = this.tokens[token] || token;

            // Robustness: If tokenAddress is not a valid hex, return 0 instead of crashing
            if (!tokenAddress || !tokenAddress.startsWith('0x')) {
                // console.warn(`[FutarchyCartridge] Invalid token address for key '${token}': ${tokenAddress}`);
                return BigInt(0);
            }

            // Simple Balance Check
            const erc20Abi = [{
                "constant": true,
                "inputs": [{ "name": "_owner", "type": "address" }],
                "name": "balanceOf",
                "outputs": [{ "name": "balance", "type": "uint256" }],
                "type": "function"
            }] as const;

            try {
                // Direct read to bypass getContract wrapper issues
                if (!rpc.readContract) {
                    console.error("[FutarchyCartridge] RPC client missing readContract!", Object.keys(rpc));
                    return BigInt(0);
                }

                return await rpc.readContract({
                    address: tokenAddress as `0x${string}`,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [user as `0x${string}`]
                });
            } catch (error) {
                console.error(`[FutarchyCartridge] Failed to fetch balance for ${token} (${tokenAddress})`, error);
                return BigInt(0);
            }
        });

        // Command: Get Quote (Simulated/Real)
        // usage: exec.run('market.getQuote', { amountIn: '100', tokenIn: 'sDAI', tokenOut: 'YES_sDAI' })
        exec.registerCommand("market.getQuote", async ({ amountIn, tokenIn, tokenOut }: { amountIn: string, tokenIn: string, tokenOut: string }) => {
            // TODO: Connect to Real Router/AMM using getAmountsOut
            // For now, return a mocked price slightly different based on side to show flow works

            const isBuy = tokenIn === 'sDAI' || tokenIn.startsWith('COLLATERAL');
            const price = isBuy ? 0.98 : 1.02; // Buy cheaper (mock), Sell higher (mock)

            const amountInNum = parseFloat(amountIn);
            if (isNaN(amountInNum)) return "0";

            const amountOut = isBuy ? amountInNum / price : amountInNum * price;
            return amountOut.toFixed(6);
        });
    }
}
