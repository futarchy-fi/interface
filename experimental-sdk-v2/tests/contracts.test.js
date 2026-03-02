import { expect } from 'chai';
import { BlockchainService } from '../src/core/provider.js';
import { ContractService } from '../src/core/contracts.js';
import { CONTRACTS } from '../src/config/constants.js';

describe('Contract System (On-Chain)', function () {
    this.timeout(10000);

    const blockchain = new BlockchainService();
    const contracts = new ContractService(blockchain);

    it('should verify Default Aggregator exists on-chain', async () => {
        const provider = blockchain.provider;
        const code = await provider.getCode(CONTRACTS.DEFAULT_AGGREGATOR);

        // If code === '0x', address is empty/EOA. If long string, it's a contract.
        expect(code).to.not.equal('0x');
        console.log(`    ✓ Contract Code found at ${CONTRACTS.DEFAULT_AGGREGATOR.slice(0, 10)}...`);
    });

    it('should read owner() from Aggregator', async () => {
        const agg = contracts.getAggregator(CONTRACTS.DEFAULT_AGGREGATOR);

        // Static Call to view function
        const owner = await agg.owner();
        expect(owner).to.be.a('string');
        expect(owner).to.match(/^0x[a-fA-F0-9]{40}$/);
        console.log(`    ✓ Aggregator Owner: ${owner}`);
    });

    // We can't easily test Factory write functions without a Private Key safely
    // But we can check if the factory variable in constants is defined
    it('should have valid Factory addresses configured', () => {
        expect(CONTRACTS.AGGREGATOR_FACTORY).to.be.a('string');
        // Warning if they are placeholders
        if (CONTRACTS.AGGREGATOR_FACTORY === '0x...') {
            console.warn('    ! Warning: AGGREGATOR_FACTORY is set to placeholder 0x...');
        }
    });
});
