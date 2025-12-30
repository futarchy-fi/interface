
export interface MarketTokens {
    collateral1: string;
    collateral2: string;
    yesCompany: string;
    noCompany: string;
    yesCurrency: string;
    noCurrency: string;
}

export interface RawMarketDTO {
    id: string;
    title: string;
    marketName: string;
    description?: string;
    displayTitle0?: string;
    displayTitle1?: string;
    ticker?: string;
    companySymbol?: string;
    currencySymbol?: string;
    tokens: MarketTokens;
    rawStatus: number;
    yesPoolAddress?: string;
    noPoolAddress?: string;
    // Legacy support
    collateralToken: string;
    outcomeTokens: string[];
}

export interface IMarketProvider {
    fetchMarket(id: string): Promise<RawMarketDTO | null>;
    fetchMarkets(orgId: string): Promise<RawMarketDTO[]>;
    fetchLatestPrice(poolAddress: string, tokenA?: string, tokenB?: string): Promise<number | null>;
    fetchHistory(poolAddress: string, limit?: number): Promise<any[]>;
    fetchTradeHistory(proposalId: string, limit?: number, userAddress?: string): Promise<any[]>;
}
