import { useState, useEffect } from "react";
import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";
import { Executor } from "@/services/Executor";
import { FutarchyCartridge } from "@/services/cartridges/FutarchyCartridge";

import { MOCK_CONFIG } from "@/config/mocks";

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
                const publicClient = createPublicClient({
                    chain: gnosis,
                    transport: http(MOCK_CONFIG.MARKET.RPC_URL)
                });

                const exec = new Executor({
                    rpc: publicClient,
                    wallet: null, // No wallet yet
                    logger: console
                });

                const cartridge = new FutarchyCartridge(MOCK_CONFIG.MARKET.DEFAULT_ID);
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
