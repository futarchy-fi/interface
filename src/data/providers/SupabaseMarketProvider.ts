
import { IMarketProvider, RawMarketDTO } from './IMarketProvider';

const SUPABASE_URL = "https://nvhqdqtlsdboctqjcelq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg";

export class SupabaseMarketProvider implements IMarketProvider {
    async fetchMarkets(orgId: string): Promise<RawMarketDTO[]> {
        return [];
    }

    async fetchMarket(id: string): Promise<RawMarketDTO | null> {
        try {
            const url = `${SUPABASE_URL}/rest/v1/market_event?select=*&id=eq.${id}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'authorization': `Bearer ${SUPABASE_KEY}`,
                    'accept': 'application/vnd.pgrst.object+json',
                    'accept-profile': 'public'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                if (response.status === 406 && errorData.code === 'PGRST116') {
                    console.log(`[SupabaseMarketProvider] Market ${id} not found (406).`);
                    return null;
                }

                console.error(`[SupabaseMarketProvider] Error ${response.status}:`, errorData);
                return null;
            }

            const data = await response.json();
            if (!data || !data.metadata) return null;

            const meta = data.metadata;

            return {
                id: data.id,
                title: data.title,
                marketName: meta.marketName || data.title,
                description: meta.description,
                displayTitle0: meta.display_title_0,
                displayTitle1: meta.display_title_1,
                ticker: meta.ticker,
                companySymbol: meta.companyTokens?.base?.tokenSymbol,
                currencySymbol: meta.currencyTokens?.base?.tokenSymbol,
                yesPoolAddress: meta.conditional_pools?.yes?.address,
                noPoolAddress: meta.conditional_pools?.no?.address,
                tokens: {
                    collateral1: meta.companyTokens?.base?.wrappedCollateralTokenAddress,
                    collateral2: meta.currencyTokens?.base?.wrappedCollateralTokenAddress,
                    yesCompany: meta.companyTokens?.yes?.wrappedCollateralTokenAddress,
                    noCompany: meta.companyTokens?.no?.wrappedCollateralTokenAddress,
                    yesCurrency: meta.currencyTokens?.yes?.wrappedCollateralTokenAddress,
                    noCurrency: meta.currencyTokens?.no?.wrappedCollateralTokenAddress,
                },
                rawStatus: data.event_status === 'open' ? 1 : 0,
                collateralToken: meta.companyTokens?.base?.wrappedCollateralTokenAddress,
                outcomeTokens: [
                    meta.companyTokens?.yes?.wrappedCollateralTokenAddress,
                    meta.companyTokens?.no?.wrappedCollateralTokenAddress
                ]
            };
        } catch (error) {
            console.error("[SupabaseMarketProvider] Failed to fetch market:", error);
            return null;
        }
    }

    async fetchLatestPrice(poolAddress: string): Promise<number | null> {
        const history = await this.fetchHistory(poolAddress, 1);
        return history.length > 0 ? history[0].price : null;
    }

    async fetchHistory(poolAddress: string, limit: number = 1000): Promise<any[]> {
        if (!poolAddress) return [];
        try {
            const url = `${SUPABASE_URL}/rest/v1/pool_candles?address=eq.${poolAddress}&interval=eq.3600000&limit=${limit}&order=timestamp.desc&select=timestamp,price`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'authorization': `Bearer ${SUPABASE_KEY}`,
                    'accept': 'application/json',
                    'accept-profile': 'public'
                }
            });

            if (!response.ok) return [];

            const data = await response.json();
            if (Array.isArray(data)) {
                return data.map(item => ({
                    timestamp: item.timestamp,
                    price: item.price
                }));
            }
            return [];
        } catch (error) {
            console.error(`[SupabaseMarketProvider] Failed to fetch history for ${poolAddress}:`, error);
            return [];
        }
    }

    async fetchTradeHistory(proposalId: string, limit: number = 30, userAddress?: string): Promise<any[]> {
        if (!proposalId) return [];
        try {
            let url = `${SUPABASE_URL}/rest/v1/trade_history?proposal_id=eq.${proposalId}&limit=${limit}&order=evt_block_time.desc&select=*`;
            if (userAddress) {
                url += `&user_address=eq.${userAddress.toLowerCase()}`;
            }
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'authorization': `Bearer ${SUPABASE_KEY}`,
                    'accept': 'application/json',
                    'accept-profile': 'public'
                }
            });

            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error(`[SupabaseMarketProvider] Failed to fetch trade history for ${proposalId}:`, error);
            return [];
        }
    }
}
