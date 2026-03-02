import { expect } from 'chai';
import { ConfigAdapter } from '../src/core/configAdapter.js';

describe('ConfigAdapter (Unit)', () => {
    const mockProposal = {
        id: '0x123',
        marketName: 'Test Market',
        description: 'Test Desc',
        currencyToken: { id: '0xUDSC', symbol: 'USDC', decimals: 6 },
        outcomeTokens: [
            { id: '0xYES', symbol: 'YES', decimals: 18, role: 'YES' },
            { id: '0xNO', symbol: 'NO', decimals: 18, role: 'NO' }
        ],
        pools: [
            {
                id: '0xPOOL1',
                type: 'CONDITIONAL',
                outcomeSide: 'YES',
                liquidity: '1000',
                tick: '500',
                token0: { symbol: 'YES' },
                token1: { symbol: 'USDC' }
            }
        ]
    };

    it('should transform subgraph proposal to frontend config format', () => {
        const config = ConfigAdapter.transform(mockProposal, 100);

        expect(config.id).to.equal('0x123');
        expect(config.metadata.chain).to.equal(100);
        expect(config.metadata.contractInfos.collateralToken).to.equal('0xUDSC');
        expect(config.metadata.conditional_pools.yes.address).to.equal('0xPOOL1');
        expect(config.metadata.conditional_pools.no).to.be.null;
    });

    it('should handle missing pools gracefully', () => {
        const emptyProposal = { ...mockProposal, pools: [] };
        const config = ConfigAdapter.transform(emptyProposal, 100);

        expect(config.metadata.conditional_pools.yes).to.be.null;
        expect(config.metadata.conditional_pools.no).to.be.null;
    });
});
