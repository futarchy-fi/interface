
import { IMarketProvider, RawMarketDTO } from './providers/IMarketProvider';
import { RPCMarketProvider } from './providers/RPCMarketProvider';
import { SupabaseMarketProvider } from './providers/SupabaseMarketProvider';

export type ProviderType = 'RPC' | 'SUPABASE';

export const DATA_PROFILES = {
    TRADING: ['RPC', 'SUPABASE'] as ProviderType[],
    METADATA: ['SUPABASE', 'RPC'] as ProviderType[],
    HISTORICAL: ['SUPABASE'] as ProviderType[],
    DECENTRALIZED: ['RPC'] as ProviderType[],
} as const;

export type PriorityProfile = keyof typeof DATA_PROFILES;

export class DiscoveryOrchestrator {
    private providers: Record<ProviderType, IMarketProvider>;
    private priority: ProviderType[];
    private requestCache: Map<string, { promise: Promise<any>, timestamp: number }> = new Map();
    private cacheTTL = 5000; // 5 second deduplication window

    constructor() {
        this.providers = {
            RPC: new RPCMarketProvider(),
            SUPABASE: new SupabaseMarketProvider()
        };

        // Initialize priority from localStorage or default
        const savedPriority = typeof window !== 'undefined' ? localStorage.getItem('DATA_PROVIDER_PRIORITY') : null;
        this.priority = savedPriority ? JSON.parse(savedPriority) : DATA_PROFILES.METADATA;
    }

    private resolvePriority(override?: ProviderType[] | PriorityProfile): ProviderType[] {
        if (!override) return this.priority;
        if (typeof override === 'string' && DATA_PROFILES[override]) {
            return [...DATA_PROFILES[override]];
        }
        return override as ProviderType[];
    }

    private async withDeduplication<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
        const now = Date.now();
        const cached = this.requestCache.get(key);

        if (cached && (now - cached.timestamp) < this.cacheTTL) {
            console.log(`[DiscoveryOrchestrator] Collapsing request for key: ${key}`);
            return cached.promise;
        }

        const promise = fetcher().finally(() => {
            // We keep it in cache for TTL even after resolution to handle rapid polling overlaps
        });

        this.requestCache.set(key, { promise, timestamp: now });
        return promise;
    }

    async fetchMarket(id: string, priorityOverride?: ProviderType[] | PriorityProfile): Promise<RawMarketDTO | null> {
        return this.withDeduplication(`market:${id}`, async () => {
            const priority = this.resolvePriority(priorityOverride);
            for (const type of priority) {
                try {
                    const provider = this.providers[type];
                    console.log(`[DiscoveryOrchestrator] Trying fetchMarket via ${type} for ID: ${id}`);
                    const data = await provider.fetchMarket(id);
                    if (data) {
                        console.log(`[DiscoveryOrchestrator] Data found via ${type} for ID: ${id}.`);
                        return data;
                    }
                } catch (err) {
                    console.error(`[DiscoveryOrchestrator] ${type} failed to fetch market ${id}:`, err);
                }
            }
            return null;
        });
    }

    async fetchMarkets(orgId: string, priorityOverride?: ProviderType[] | PriorityProfile): Promise<RawMarketDTO[]> {
        const priority = this.resolvePriority(priorityOverride);
        const topProvider = this.providers[priority[0]];
        return topProvider.fetchMarkets(orgId);
    }

    async fetchLatestPrice(poolAddress: string, tokenA?: string, tokenB?: string, priorityOverride?: ProviderType[] | PriorityProfile): Promise<number | null> {
        return this.withDeduplication(`latestPrice:${poolAddress}:${tokenA || 'none'}:${tokenB || 'none'}`, async () => {
            const priority = this.resolvePriority(priorityOverride);
            for (const type of priority) {
                try {
                    const provider = this.providers[type];
                    const price = await provider.fetchLatestPrice(poolAddress, tokenA, tokenB);
                    if (price !== null) return price;
                } catch (err) {
                    // Silently try next provider
                }
            }
            return null;
        });
    }

    async fetchHistory(poolAddress: string, limit?: number, priorityOverride?: ProviderType[] | PriorityProfile): Promise<any[]> {
        return this.withDeduplication(`history:${poolAddress}:${limit}`, async () => {
            const priority = this.resolvePriority(priorityOverride);
            for (const type of priority) {
                try {
                    const provider = this.providers[type];
                    const history = await provider.fetchHistory(poolAddress, limit);
                    if (history && history.length > 0) return history;
                } catch (err) {
                    // Silently try next provider
                }
            }
            return [];
        });
    }

    async fetchTradeHistory(proposalId: string, limit?: number, priorityOverride?: ProviderType[] | PriorityProfile, userAddress?: string): Promise<any[]> {
        return this.withDeduplication(`trades:${proposalId}:${limit}:${userAddress || 'all'}`, async () => {
            const priority = this.resolvePriority(priorityOverride);
            for (const type of priority) {
                try {
                    const provider = this.providers[type];
                    const history = await provider.fetchTradeHistory(proposalId, limit, userAddress);
                    if (history && history.length > 0) return history;
                } catch (err) {
                    // Silently try next provider
                }
            }
            return [];
        });
    }

    setPriority(newPriority: ProviderType[]) {
        this.priority = newPriority;
        if (typeof window !== 'undefined') {
            localStorage.setItem('DATA_PROVIDER_PRIORITY', JSON.stringify(newPriority));
        }
    }

    getPriority(): ProviderType[] {
        return this.priority;
    }
}

// Export a singleton instance if needed, or instantiate where required
export const discoveryOrchestrator = new DiscoveryOrchestrator();
