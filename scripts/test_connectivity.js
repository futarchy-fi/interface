/**
 * Test connectivity to multiple subgraphs
 * Run: node scripts/test_connectivity.js
 */

const ENDPOINTS = {
    'Futarchy Complete': 'https://api.studio.thegraph.com/query/1719045/futarchy-complete/version/latest',
    'Uniswap': 'https://api.studio.thegraph.com/query/1718249/uniswap-proposal-candles/version/latest'
};

const QUERY = `{ _meta { block { number } } }`;

async function main() {
    console.log('=== Connectivity Test ===\n');

    for (const [name, url] of Object.entries(ENDPOINTS)) {
        console.log(`Testing ${name}...`);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: QUERY })
            });
            console.log(`   Status: ${res.status} ${res.statusText}`);
            
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                if (data.data) {
                    console.log(`   ✅ Success! Block: ${data.data._meta.block.number}`);
                } else {
                    console.log(`   ❌ GraphQL Error:`, JSON.stringify(data.errors));
                }
            } catch (e) {
                console.log(`   ❌ Invalid JSON. Response start:`, text.slice(0, 200));
            }
        } catch (e) {
            console.log(`   ❌ Network Error:`, e.message);
        }
        console.log('');
    }
}

main().catch(console.error);
