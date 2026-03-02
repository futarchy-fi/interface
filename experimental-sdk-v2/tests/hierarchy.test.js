import { expect } from 'chai';
import { SubgraphClient } from '../src/core/subgraph.js';
import { CONTRACTS } from '../src/config/constants.js';

describe('Hierarchy Verification (Aggregator -> Orgs)', function () {
    this.timeout(15000);
    const subgraph = new SubgraphClient();

    it('should fetch the Default Aggregator and list Organizations', async () => {
        const id = CONTRACTS.DEFAULT_AGGREGATOR;
        console.log(`    ℹ️ Querying Aggregator: ${id}`);

        const data = await subgraph.getAggregator(id);
        const agg = data.aggregator;

        expect(agg).to.not.be.null;
        expect(agg.id).to.equal(id.toLowerCase());

        console.log(`    ✓ Aggregator Name: ${agg.name}`);
        console.log(`    ✓ Found ${agg.organizations.length} Organizations (Companies)`);

        expect(agg.organizations).to.be.an('array');
        expect(agg.organizations.length).to.be.greaterThan(0);

        // Check first org structure
        const firstOrg = agg.organizations[0];
        expect(firstOrg).to.have.property('name');
        expect(firstOrg).to.have.property('id');
        expect(firstOrg).to.have.property('proposals');

        console.log(`    ✓ Sample Org: ${firstOrg.name} has ${firstOrg.proposals.length} proposals`);
    });
});
