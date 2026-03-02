import fetch from 'node-fetch';

export class SpotClient {
    constructor() {
        this.baseUrl = 'https://api.geckoterminal.com/api/v2';
    }

    async getOHLCV(network, poolAddress, timeframe = 'hour', limit = 100) {
        // Gnosis chain ID 100 -> 'xdai' in GeckoTerminal
        const geckoNetwork = network === 100 ? 'xdai' : 'eth';
        const url = `${this.baseUrl}/networks/${geckoNetwork}/pools/${poolAddress}/ohlcv/${timeframe}?limit=${limit}&currency=token`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            // Format: [timestamp, open, high, low, close, volume]
            const candles = data.data.attributes.ohlcv_list.map(c => ({
                time: c[0],
                open: c[1],
                high: c[2],
                low: c[3],
                close: c[4],
                volume: c[5]
            }));

            return candles.reverse(); // Newest first
        } catch (error) {
            console.error('Error fetching spot prices:', error.message);
            return [];
        }
    }

    async getSpotPrice(network, poolAddress) {
        // Fetch latest candle for "rough" current price
        const candles = await this.getOHLCV(network, poolAddress, 'minute', 1);
        if (candles.length > 0) {
            return candles[0].close;
        }
        return null;
    }
}
