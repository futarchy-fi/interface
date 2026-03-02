// Quick playground query for Market Subgraph
const MARKET_SUBGRAPH = 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest';

const proposalId = '0x77371fe7e6fc66b6fc77035e34932df6f139a193';

const query = `{
  proposals(first: 5, where: { id: "${proposalId.toLowerCase()}" }) {
    id
    marketName
    companyToken {
      id
    }
    currencyToken {
      id
    }
  }
}`;

console.log('Query:', query);

fetch(MARKET_SUBGRAPH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
})
    .then(r => r.json())
    .then(result => {
        console.log('\nResult:', JSON.stringify(result, null, 2));
    })
    .catch(e => console.error('Error:', e));
