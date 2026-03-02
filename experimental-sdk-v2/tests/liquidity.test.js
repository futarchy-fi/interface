import { expect } from 'chai';
import { LiquidityAnalyzer } from '../src/core/liquidity.js';

describe('LiquidityAnalyzer (Unit)', () => {
    const mockPools = [
        {
            id: '0xPOOL_YES_1',
            outcomeSide: 'yes',
            liquidity: '1000',
            tick: '500',
            type: 'CONDITIONAL'
        },
        {
            id: '0xPOOL_YES_2',
            outcomeSide: 'yes',
            liquidity: '5000', // Higher liquidity
            tick: '550',
            type: 'CONDITIONAL'
        },
        {
            id: '0xPOOL_NO_1',
            outcomeSide: 'no',
            liquidity: '2000',
            tick: '-500',
            type: 'CONDITIONAL'
        }
    ];

    it('should select the pool with highest liquidity for a side', () => {
        const analysis = LiquidityAnalyzer.analyze(mockPools);

        expect(analysis.yes).to.not.be.null;
        expect(analysis.yes.address).to.equal('0xPOOL_YES_2');
        expect(analysis.yes.liquidity).to.equal('5000');
    });

    it('should correctly enrich pool data with derived price', () => {
        const analysis = LiquidityAnalyzer.analyze(mockPools);
        const yesPool = analysis.yes;

        // Price = 1.0001 ^ tick
        // 1.0001 ^ 550 approx 1.056
        expect(yesPool.derivedPrice).to.be.closeTo(1.056, 0.001);
    });

    it('should handle missing sides', () => {
        const onlyYes = [mockPools[0]];
        const analysis = LiquidityAnalyzer.analyze(onlyYes);

        expect(analysis.yes).to.not.be.null;
        expect(analysis.no).to.be.null;
    });

    it('should return nulls for empty input', () => {
        const analysis = LiquidityAnalyzer.analyze([]);
        expect(analysis.yes).to.be.null;
        expect(analysis.totalLiquidity).to.equal(0);
    });
});
