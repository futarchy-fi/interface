import { ethers } from 'ethers';

export class ConfigAdapter {
    static transform(proposal, chainId = 100) {
        if (!proposal) return null;

        const findTokenByRole = (role) => {
            // Check outcomes first
            const outcome = proposal.outcomeTokens.find(t => t.role === role);
            if (outcome) return outcome;

            // Then check pools' tokens (sometimes roles are only on pool tokens in older subgraphs)
            // But for v2, they should be on the proposal relations.
            // Simplified for SDK: Assume direct relation or deduce.
            return null;
        };

        const findPool = (type, side) => {
            return proposal.pools.find(p =>
                p.type === type &&
                (p.outcomeSide || '').toLowerCase() === side.toLowerCase()
            );
        };

        return {
            id: proposal.id,
            title: proposal.marketName,
            type: 'proposal',
            metadata: {
                chain: chainId,
                title: proposal.marketName,
                contractInfos: {
                    collateralToken: proposal.currencyToken?.id,
                    outcomeTokens: proposal.outcomeTokens.map(t => t.id)
                },
                // Reconstructing the "Config" shape used by frontend
                conditional_pools: {
                    yes: this._formatPool(findPool('CONDITIONAL', 'YES')),
                    no: this._formatPool(findPool('CONDITIONAL', 'NO'))
                },
                prediction_pools: {
                    yes: this._formatPool(findPool('PREDICTION', 'YES')),
                    no: this._formatPool(findPool('PREDICTION', 'NO'))
                },
                _source: 'subgraph',
                _chainId: chainId
            },
            event_status: 'open', // Mock status
            resolution_status: 'open'
        };
    }

    static _formatPool(pool) {
        if (!pool) return null;
        return {
            address: pool.id,
            liquidity: pool.liquidity,
            tick: pool.tick,
            token0: pool.token0.symbol,
            token1: pool.token1.symbol
        };
    }
}
