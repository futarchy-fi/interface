import { useState, useEffect } from "react";
import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";
import { Executor } from "@/services/Executor";
import { FutarchyCartridge } from "@/services/cartridges/FutarchyCartridge";

import { MOCK_CONFIG } from "@/config/mocks";

import { discoveryOrchestrator } from "@/data/DiscoveryOrchestrator";

// Singleton or caching mechanism can be added here
let globalExecutor: Executor | null = null;

export function useExecutor() {
    const [executor, setExecutor] = useState<Executor | null>(globalExecutor);
    const [isLoading, setIsLoading] = useState(!globalExecutor);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (globalExecutor) return;

        const init = async () => {
            try {
                console.log("[useExecutor] Initializing Executor...");

                // 1. Fetch Market Data first to get tokens (respecting priority)
                const marketData = await discoveryOrchestrator.fetchMarket(MOCK_CONFIG.MARKET.DEFAULT_ID);
                const tokens = marketData?.tokens ? {
                    "COLLATERAL_1": marketData.tokens.collateral1,
                    "COLLATERAL_2": marketData.tokens.collateral2,
                    "YES_COLLATERAL_1": marketData.tokens.yesCompany,
                    "NO_COLLATERAL_1": marketData.tokens.noCompany,
                    "YES_COLLATERAL_2": marketData.tokens.yesCurrency,
                    "NO_COLLATERAL_2": marketData.tokens.noCurrency,
                    "COMPANY": marketData.tokens.collateral1,
                    "CURRENCY": marketData.tokens.collateral2,
                    "YES_COMPANY": marketData.tokens.yesCompany,
                    "NO_COMPANY": marketData.tokens.noCompany,
                    "YES_CURRENCY": marketData.tokens.yesCurrency,
                    "NO_CURRENCY": marketData.tokens.noCurrency
                } : undefined;

                const publicClient = createPublicClient({
                    chain: gnosis,
                    transport: http(MOCK_CONFIG.MARKET.RPC_URL, {
                        retryCount: 3,
                        retryDelay: 1000,
                    })
                });

                const exec = new Executor({
                    rpc: publicClient,
                    wallet: null, // No wallet yet
                    logger: console
                });

                // 2. Install Cartridge with pre-discovered tokens
                const cartridge = new FutarchyCartridge(MOCK_CONFIG.MARKET.DEFAULT_ID, tokens);
                await exec.install(cartridge);

                globalExecutor = exec;
                setExecutor(exec);
            } catch (err: any) {
                console.error("[useExecutor] Failed to initialize:", err);
                setError(err);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, []);

    return { executor, isLoading, error };
}
