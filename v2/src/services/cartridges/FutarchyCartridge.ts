import { Executor, Cartridge } from "../Executor";
import { FUTARCHY_PROPOSAL_ABI } from "../../data/abis/FutarchyProposal";

export class FutarchyCartridge implements Cartridge {
    marketAddress: `0x${string}`;
    tokens: Record<string, string> = {};

    constructor(marketAddress: string, initialTokens?: Record<string, string>) {
        this.marketAddress = marketAddress as `0x${string}`;
        if (initialTokens) {
            this.tokens = initialTokens;
        }
    }

    async install(exec: Executor) {
        const { rpc } = exec.services;

        // Skip RPC discovery if we already have tokens (e.g. from Supabase)
        if (Object.keys(this.tokens).length > 0) {
            console.log(`[FutarchyCartridge] Using pre-discovered tokens for ${this.marketAddress}`);
        } else {
            if (!rpc) {
                console.error("[FutarchyCartridge] CRITICAL: RPC client is missing and no pre-discovered tokens provided!");
                return;
            }

            console.log(`[FutarchyCartridge] No pre-discovered tokens. Starting RPC Discovery for ${this.marketAddress}...`);

            try {
                const results = await rpc.multicall({
                    contracts: [
                        { address: this.marketAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'collateralToken1' },
                        { address: this.marketAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'collateralToken2' },
                        { address: this.marketAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [BigInt(0)] },
                        { address: this.marketAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [BigInt(1)] },
                        { address: this.marketAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [BigInt(2)] },
                        { address: this.marketAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [BigInt(3)] }
                    ]
                });

                // Detailed Log for debugging RPC issues
                results.forEach((res: any, i: number) => {
                    if (res.status !== 'success') {
                        console.error(`[FutarchyCartridge] Multicall item ${i} failed:`, res.error);
                    }
                });

                const [col1, col2, yesComp, noComp, yesCurr, noCurr] = results;

                if (col1.status !== 'success' || col2.status !== 'success') {
                    throw new Error(`Failed to fetch primary collateral tokens for ${this.marketAddress}. Check if the address is correct and initialized.`);
                }

                // Standard Mapping based on Proposal ABI
                // collateralToken1 = Company (usually)
                // collateralToken2 = Currency (usually)
                const c1 = col1.result as string;
                const c2 = col2.result as string;
                const yC = (yesComp.result as any)?.[0];
                const nC = (noComp.result as any)?.[0];
                const yR = (yesCurr.result as any)?.[0];
                const nR = (noCurr.result as any)?.[0];

                this.tokens = {
                    "COLLATERAL_1": c1,
                    "COLLATERAL_2": c2,
                    "COMPANY": c1,
                    "CURRENCY": c2,
                    "YES_COMPANY": yC,
                    "NO_COMPANY": nC,
                    "YES_CURRENCY": yR,
                    "NO_CURRENCY": nR,
                    // Legacy/Semantic fallbacks
                    "YES_COLLATERAL_1": yC,
                    "NO_COLLATERAL_1": nC,
                    "YES_COLLATERAL_2": yR,
                    "NO_COLLATERAL_2": nR
                };

                console.log(`[FutarchyCartridge] Discovery Success for ${this.marketAddress}:`, this.tokens);

            } catch (err) {
                console.error("[FutarchyCartridge] Discovery Failed:", err);
                throw err; // Re-throw to let useExecutor handle it
            }
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

            const isBuy = tokenIn === 'CURRENCY' || tokenIn === 'sDAI' || tokenIn.startsWith('COLLATERAL_2');
            const price = isBuy ? 0.98 : 1.02; // Buy cheaper (mock), Sell higher (mock)

            const amountInNum = parseFloat(amountIn);
            if (isNaN(amountInNum)) return "0";

            const amountOut = isBuy ? amountInNum / price : amountInNum * price;
            return amountOut.toFixed(6);
        });
    }
}
