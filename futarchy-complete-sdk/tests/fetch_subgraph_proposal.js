import fetch from 'node-fetch'; // Standard fetch might be available depending on node version, but import usually cleaner in Module
// Actually in Node 22, global fetch is available.

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest';
const PROPOSAL_ID = '0x3c109ec3c7eb7da835dd3b64f575efae7abfdf4e'; // Lowercase

async function fetchProposal() {
    console.log(`Fetching proposal ${PROPOSAL_ID} from Subgraph...`);

    const query = `{
        proposal(id: "${PROPOSAL_ID}") {
          id
          marketName
          companyToken { id symbol decimals }
          currencyToken { id symbol decimals }
          outcomeTokens { id symbol decimals }
          pools { 
            id 
            name 
            type 
            outcomeSide 
            token0 { id symbol }
            token1 { id symbol }
          }
        }
      }`;

    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const result = await response.json();

        if (result.errors) {
            console.error('Errors:', result.errors);
        } else {
            console.log('Result:', JSON.stringify(result.data, null, 2));

            const p = result.data.proposal;
            if (p) {
                console.log('\n--- Analysis ---');
                console.log(`Market: ${p.marketName}`);
                console.log(`Company Token: ${p.companyToken.symbol} (${p.companyToken.id})`);
                console.log(`Currency Token: ${p.currencyToken.symbol} (${p.currencyToken.id})`);
                console.log(`Pools Found: ${p.pools.length}`);
                p.pools.forEach(pool => {
                    console.log(`  - [${pool.type}] ${pool.outcomeSide} : ${pool.id}`);
                });
            } else {
                console.log('Proposal not found in subgraph.');
            }
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

fetchProposal();
