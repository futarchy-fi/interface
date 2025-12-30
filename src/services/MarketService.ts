
// src/services/MarketService.ts
// SERVICE LAYER: Business Logic, Transformation, Coordination

import { MarketRepository } from "../data/repositories/MarketRepository";
import { RawMarketDTO } from "../data/providers/IMarketProvider";
import { ProviderType, PriorityProfile } from "../data/DiscoveryOrchestrator";

export interface MarketModel {
    id: string;
    name: string;
    description: string;
    displayTitle0?: string;
    displayTitle1?: string;
    yesPoolAddress?: string;
    noPoolAddress?: string;
    endTime: number;
    tokens: {
        collateral: string;
        collateral1: string;
        collateral2: string;
        yesCompany: string;
        noCompany: string;
        yesCurrency: string;
        noCurrency: string;
        // Symbol aliases if available
        companySymbol: string;
        currencySymbol: string;
    };
    isOpen: boolean;
}

export class MarketService {
    private repo: MarketRepository;

    constructor(repo: MarketRepository) {
        this.repo = repo;
    }

    async getActiveMarkets(orgId: string, priority?: ProviderType[] | PriorityProfile): Promise<MarketModel[]> {
        const rawMarkets = await this.repo.fetchMarkets(orgId, priority);

        // Logic: Filter active, Transform DTO -> Domain Model
        return rawMarkets
            .filter(m => m.rawStatus === 1)
            .map(this.transformToModel);
    }

    async getMarket(id: string, priority?: ProviderType[] | PriorityProfile): Promise<MarketModel | null> {
        const raw = await this.repo.fetchMarket(id, priority);
        if (!raw) return null;
        return this.transformToModel(raw);
    }

    async getMarketHistory(id: string, priority?: ProviderType[] | PriorityProfile): Promise<any[]> {
        const market = await this.getMarket(id, priority);
        if (!market || (!market.yesPoolAddress && !market.noPoolAddress)) return [];

        // For history, we typically want Supabase if RPC Priority is selected but RPC has no history
        const fetchPriority = priority || 'HISTORICAL';

        const [yesHistory, noHistory] = await Promise.all([
            market.yesPoolAddress ? this.repo.fetchHistory(market.yesPoolAddress, 1000, fetchPriority) : Promise.resolve([]),
            market.noPoolAddress ? this.repo.fetchHistory(market.noPoolAddress, 1000, fetchPriority) : Promise.resolve([])
        ]);

        // Merge and sort by timestamp
        // This is a simple merge for now, assuming candles align or we just want a unified timeline
        const pointsMap = new Map<number, { timestamp: number, yesPrice?: number, noPrice?: number }>();

        yesHistory.forEach(h => {
            pointsMap.set(h.timestamp, { timestamp: h.timestamp, yesPrice: h.price });
        });

        noHistory.forEach(h => {
            const existing = pointsMap.get(h.timestamp) || { timestamp: h.timestamp };
            pointsMap.set(h.timestamp, { ...existing, noPrice: h.price });
        });

        return Array.from(pointsMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }

    async getTradeHistory(id: string, priority?: ProviderType[] | PriorityProfile, userAddress?: string): Promise<any[]> {
        const market = await this.getMarket(id, priority);
        if (!market) return [];

        const rawTrades = await this.repo.fetchTradeHistory(id, 50, priority, userAddress);
        const { tokens } = market;

        return rawTrades.map(trade => {
            const t0 = (trade.token0 || '').toLowerCase();
            const t1 = (trade.token1 || '').toLowerCase();

            // Pool Classification Logic
            let poolType: 'PREDICTION' | 'EXPECTED_VALUE' | 'CONDITIONAL' = 'PREDICTION';
            let outcome: 'YES' | 'NO' | null = null;

            const isCurrency = (addr: string) => addr === tokens.collateral2.toLowerCase();
            const isCompany = (addr: string) => addr === tokens.collateral1.toLowerCase();

            const isYesCurrency = (addr: string) => addr === tokens.yesCurrency.toLowerCase();
            const isNoCurrency = (addr: string) => addr === tokens.noCurrency.toLowerCase();
            const isYesCompany = (addr: string) => addr === tokens.yesCompany.toLowerCase();
            const isNoCompany = (addr: string) => addr === tokens.noCompany.toLowerCase();

            // 1. Check for Prediction Pools (Currency vs YES/NO Currency)
            if (isCurrency(t0) || isCurrency(t1)) {
                if (isYesCurrency(t0) || isYesCurrency(t1)) { poolType = 'PREDICTION'; outcome = 'YES'; }
                else if (isNoCurrency(t0) || isNoCurrency(t1)) { poolType = 'PREDICTION'; outcome = 'NO'; }
                // 2. Check for EV Pools (Company vs Currency)
                else if (isCompany(t0) || isCompany(t1)) { poolType = 'EXPECTED_VALUE'; outcome = null; }
            }
            // 3. Check for Conditional Pools (YES Company vs YES Currency)
            else if (isYesCompany(t0) || isYesCompany(t1)) { poolType = 'CONDITIONAL'; outcome = 'YES'; }
            else if (isNoCompany(t0) || isNoCompany(t1)) { poolType = 'CONDITIONAL'; outcome = 'NO'; }

            // Symbol mapping logic
            const getSymbol = (addr: string) => {
                const a = addr.toLowerCase();
                if (isYesCurrency(a)) return `YES_${tokens.currencySymbol}`;
                if (isNoCurrency(a)) return `NO_${tokens.currencySymbol}`;
                if (isYesCompany(a)) return `YES_${tokens.companySymbol}`;
                if (isNoCompany(a)) return `NO_${tokens.companySymbol}`;
                if (isCurrency(a)) return tokens.currencySymbol;
                if (isCompany(a)) return tokens.companySymbol;
                return '???';
            };

            const symbol0 = getSymbol(t0);
            const symbol1 = getSymbol(t1);

            // Price Inference Logic
            // We want Price = amountQuote / amountBase
            // PREDICTION: Quote = Currency, Base = YES/NO_Currency
            // EV: Quote = Currency, Base = Company
            // CONDITIONAL: Quote = YES/NO_Currency, Base = YES/NO_Company

            let amountQuote = 0;
            let amountBase = 0;

            const isQ = (addr: string) => isCurrency(addr) || isYesCurrency(addr) || isNoCurrency(addr);

            // Logic to isolate base vs quote
            if (poolType === 'PREDICTION') {
                if (isCurrency(t0)) { amountQuote = trade.amount0; amountBase = trade.amount1; }
                else { amountQuote = trade.amount1; amountBase = trade.amount0; }
            } else if (poolType === 'EXPECTED_VALUE') {
                if (isCurrency(t0)) { amountQuote = trade.amount0; amountBase = trade.amount1; }
                else { amountQuote = trade.amount1; amountBase = trade.amount0; }
            } else if (poolType === 'CONDITIONAL') {
                if (isYesCurrency(t0) || isNoCurrency(t0)) { amountQuote = trade.amount0; amountBase = trade.amount1; }
                else { amountQuote = trade.amount1; amountBase = trade.amount0; }
            }

            const price = amountBase !== 0 ? Math.abs(amountQuote / amountBase) : 0;

            // Amount/Side Logic
            // Side is relative to the Base token.
            // If base token left the pool (amountBase < 0), it's a BUY.
            const side = amountBase < 0 ? 'BUY' : 'SELL';

            return {
                id: trade.id,
                timestamp: trade.evt_block_time,
                poolType,
                outcome,
                side,
                amount0: Math.abs(trade.amount0) / 1e18,
                amount1: Math.abs(trade.amount1) / 1e18,
                symbol0,
                symbol1,
                price,
                txHash: trade.evt_tx_hash
            };
        });
    }

    async getMarketPositions(id: string, userAddress: string, positionService: any): Promise<any> {
        console.log(`[MarketService] Debug: Fetching positions for ${id} for user ${userAddress}`);
        const market = await this.getMarket(id);
        if (!market) {
            console.warn(`[MarketService] Market ${id} not found`);
            return null;
        }

        const tokens = [
            market.tokens.collateral1,
            market.tokens.collateral2,
            market.tokens.yesCompany,
            market.tokens.noCompany,
            market.tokens.yesCurrency,
            market.tokens.noCurrency
        ].filter(Boolean);

        console.log(`[MarketService] Querying balances for:`, tokens);
        const balances = await positionService.getMarketBalances(userAddress, tokens);
        console.log(`[MarketService] Raw balances from service:`, balances);

        const getB = (addr: string) => {
            const b = balances.find((b: any) => b.id.toLowerCase() === addr.toLowerCase());
            return b ? b.shares : 0;
        };

        const getS = (addr: string, fallback: string) => {
            const b = balances.find((b: any) => b.id.toLowerCase() === addr.toLowerCase());
            return b?.tokenSymbol && b.tokenSymbol !== '???' ? b.tokenSymbol : fallback;
        };

        const yComp = getB(market.tokens.yesCompany);
        const nComp = getB(market.tokens.noCompany);
        const yCurr = getB(market.tokens.yesCurrency);
        const nCurr = getB(market.tokens.noCurrency);

        const mergeComp = Math.min(yComp, nComp);
        const mergeCurr = Math.min(yCurr, nCurr);

        const companySymbol = getS(market.tokens.collateral1, market.tokens.companySymbol);
        const currencySymbol = getS(market.tokens.collateral2, market.tokens.currencySymbol);

        const wallet = [
            { symbol: companySymbol, balance: getB(market.tokens.collateral1) },
            { symbol: currencySymbol, balance: getB(market.tokens.collateral2) }
        ];

        const positions = [
            { symbol: companySymbol, net: yComp - mergeComp, side: 'YES', mergeable: mergeComp },
            { symbol: companySymbol, net: nComp - mergeComp, side: 'NO', mergeable: mergeComp },
            { symbol: currencySymbol, net: yCurr - mergeCurr, side: 'YES', mergeable: mergeCurr },
            { symbol: currencySymbol, net: nCurr - mergeCurr, side: 'NO', mergeable: mergeCurr }
        ].filter((p: any) => p.net > 0 || p.mergeable > 0);

        const result = { wallet, positions, tokens: market.tokens, balances };
        console.log(`[MarketService] Final processed positions:`, result);
        return result;
    }

    private transformToModel(dto: RawMarketDTO): MarketModel {
        return {
            id: dto.id,
            name: dto.marketName || dto.title,
            description: dto.description || dto.title,
            displayTitle0: dto.displayTitle0,
            displayTitle1: dto.displayTitle1,
            yesPoolAddress: dto.yesPoolAddress,
            noPoolAddress: dto.noPoolAddress,
            endTime: Date.now() + 15 * 24 * 60 * 60 * 1000,
            tokens: {
                collateral: dto.tokens?.collateral1 || dto.collateralToken,
                collateral1: dto.tokens?.collateral1 || dto.collateralToken,
                collateral2: dto.tokens?.collateral2 || '',
                yesCompany: dto.tokens?.yesCompany || dto.outcomeTokens?.[0] || '',
                noCompany: dto.tokens?.noCompany || dto.outcomeTokens?.[1] || '',
                yesCurrency: dto.tokens?.yesCurrency || '',
                noCurrency: dto.tokens?.noCurrency || '',
                companySymbol: dto.companySymbol || dto.ticker || dto.displayTitle0?.split(' ')?.[0] || 'COMPANY',
                currencySymbol: dto.currencySymbol || 'sDAI'
            },
            isOpen: dto.rawStatus === 1
        };
    }
}
