import { expect } from 'chai';
import { SubgraphClient } from '../src/core/subgraph.js';
import { BlockchainService } from '../src/core/provider.js';
import { CONTRACTS } from '../src/config/constants.js';

describe('System Connectivity (Integration)', function () {
    this.timeout(10000); // Allow time for network requests

    const subgraph = new SubgraphClient();
    const blockchain = new BlockchainService();

    it('should connect to the Subgraph and fetch the Aggregator', async () => {
        const data = await subgraph.getAggregator(CONTRACTS.DEFAULT_AGGREGATOR);
        expect(data.aggregator).to.not.be.null;
        expect(data.aggregator.id).to.equal(CONTRACTS.DEFAULT_AGGREGATOR.toLowerCase());
        console.log(`    ✓ Found Aggregator with ${data.aggregator.organizations.length} Orgs`);
    });

    it('should connect to the RPC Provider and get Block Number', async () => {
        const block = await blockchain.getBlockNumber();
        expect(block).to.be.greaterThan(0);
        console.log(`    ✓ Block Number: ${block}`);
    });
});
