
export class LiquidityAnalyzer {
    static analyze(pools) {
        if (!pools || pools.length === 0) return { yes: null, no: null, totalLiquidity: 0 };

        // 1. Group by Side
        const yesPools = pools.filter(p => p.outcomeSide === 'yes');
        const noPools = pools.filter(p => p.outcomeSide === 'no');

        // 2. Select Best Pool (Highest Liquidity)
        const bestYes = this._getBestPool(yesPools);
        const bestNo = this._getBestPool(noPools);

        // 3. Calculate Values (Tick Math)
        return {
            yes: bestYes ? this._enrichPoolData(bestYes) : null,
            no: bestNo ? this._enrichPoolData(bestNo) : null,
            allPools: pools.map(p => this._enrichPoolData(p))
        };
    }

    static _getBestPool(poolList) {
        // Sort by raw liquidity descending
        return poolList.sort((a, b) => Number(b.liquidity) - Number(a.liquidity))[0];
    }

    static _enrichPoolData(pool) {
        // Simple tick-to-price derivation for approximate value
        // Price = 1.0001 ^ tick
        const price = Math.pow(1.0001, Number(pool.tick));
        // Approximate Volume/TVL derivation would go here
        // For SDK display, we return raw liquidity + derived price
        return {
            ...pool,
            derivedPrice: price,
            isBest: true // marked by selection logic
        };
    }
}
