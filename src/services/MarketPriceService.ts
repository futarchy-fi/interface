
import { discoveryOrchestrator, ProviderType } from "../data/DiscoveryOrchestrator";

export interface PoolPrices {
    yesPrice: number | null;
    noPrice: number | null;
    prediction: number | null; // Probability (0-100)
    lastUpdated: number;
}

export class MarketPriceService {
    async getLatestPrices(
        yesPool?: string,
        noPool?: string,
        tokens?: { yesCompany?: string; noCompany?: string; yesCurrency?: string; noCurrency?: string },
        priority?: ProviderType[]
    ): Promise<PoolPrices> {
        const [yesPrice, noPrice] = await Promise.all([
            yesPool ? discoveryOrchestrator.fetchLatestPrice(yesPool, tokens?.yesCompany, tokens?.yesCurrency, priority) : Promise.resolve(null),
            noPool ? discoveryOrchestrator.fetchLatestPrice(noPool, tokens?.noCompany, tokens?.noCurrency, priority) : Promise.resolve(null)
        ]);

        let prediction = null;
        if (yesPrice !== null && noPrice !== null && (yesPrice + noPrice) > 0) {
            // Standard probability formula for YES/NO markets
            prediction = (yesPrice / (yesPrice + noPrice)) * 100;
        }

        return {
            yesPrice,
            noPrice,
            prediction,
            lastUpdated: Date.now()
        };
    }
}

export const marketPriceService = new MarketPriceService();
