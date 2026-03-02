
import fetch from 'node-fetch';

const ALGEBRA_SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest";
const PROPOSAL_ID_LOGIC = "0x3d076d5d12341226527241f8a489d4a8863b73e5"; // Resolved Logic Address
const PROPOSAL_ID_METADATA = "0x3c109ec3c7eb7da835dd3b64f575efae7abfdf4e"; // Original Metadata Address

async function testQuery(id, label) {
    console.log(`\n--- Testing ${label} ID: ${id} ---`);
    const query = `{
        proposal(id: "${id}") {
            id
            marketName
            companyToken { id symbol }
            currencyToken { id symbol }
            pools { id type outcomeSide }
        }
    }`;

    try {
        const response = await fetch(ALGEBRA_SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const result = await response.json();
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

async function main() {
    await testQuery(PROPOSAL_ID_LOGIC.toLowerCase(), "Logic Lowercase");
    await testQuery(PROPOSAL_ID_METADATA.toLowerCase(), "Metadata Lowercase");
}

main();
