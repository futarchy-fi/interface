import { expect } from 'chai';
import { SpotClient } from '../src/core/spotClient.js';
import { CHAIN_ID } from '../src/config/constants.js';

describe('SpotClient (External API)', function () {
    this.timeout(10000); // 10s for external API
    const client = new SpotClient();

    // sDAI/GNO Pool on Gnosis (Known good pool)
    const TEST_POOL = '0xd1d7fa8871d84d0e77020fc28b7cd5718c446522';

    it('should fetch real spot price from GeckoTerminal', async () => {
        const price = await client.getSpotPrice(CHAIN_ID, TEST_POOL);
        console.log(`    ✓ Spot Price: $${price}`);

        expect(price).to.not.be.null;
        expect(Number(price)).to.be.greaterThan(0);
    });

    it('should fetch OHLCV candles', async () => {
        const candles = await client.getOHLCV(CHAIN_ID, TEST_POOL, 'hour', 5);

        expect(candles).to.be.an('array');
        expect(candles.length).to.be.greaterThan(0);

        const latest = candles[0];
        expect(latest).to.have.property('close');
        expect(latest).to.have.property('time');
    });

    it('should handle invalid pools gracefully', async () => {
        const price = await client.getSpotPrice(CHAIN_ID, '0x0000000000000000000000000000000000000000');
        expect(price).to.be.null;
    });
});
