import { RawMarketDTO } from '../providers/IMarketProvider';
import { discoveryOrchestrator, ProviderType, PriorityProfile } from '../DiscoveryOrchestrator';

export class MarketRepository {
    async fetchMarkets(orgId: string, priorityOverride?: ProviderType[] | PriorityProfile): Promise<RawMarketDTO[]> {
        return discoveryOrchestrator.fetchMarkets(orgId, priorityOverride);
    }

    async fetchMarket(id: string, priorityOverride?: ProviderType[] | PriorityProfile): Promise<RawMarketDTO | null> {
        return discoveryOrchestrator.fetchMarket(id, priorityOverride);
    }

    async fetchHistory(poolAddress: string, limit?: number, priorityOverride?: ProviderType[] | PriorityProfile): Promise<any[]> {
        return discoveryOrchestrator.fetchHistory(poolAddress, limit, priorityOverride);
    }

    async fetchTradeHistory(proposalId: string, limit?: number, priorityOverride?: ProviderType[] | PriorityProfile, userAddress?: string): Promise<any[]> {
        return discoveryOrchestrator.fetchTradeHistory(proposalId, limit, priorityOverride, userAddress);
    }

    setProvider(mode: ProviderType) {
        discoveryOrchestrator.setPriority([mode, mode === 'RPC' ? 'SUPABASE' : 'RPC']);
    }
}
