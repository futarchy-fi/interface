
// Use native fetch (Node 22+)
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest';
const ORG_ID = '0x818FdF727aA4672c80bBFd47eE13975080AC40E5'.toLowerCase(); // Gnosis Org

async function checkOrgSchema() {
    console.log(`🔍 Checking Organization: ${ORG_ID}`);

    // Query 1: Check if Organization entity exists and has proposals
    const query = `{
        organization(id: "${ORG_ID}") {
            id
            proposals(first: 10) {
                id
                marketName
            }
        }
    }`;

    try {
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));

        if (data.data?.organization?.proposals?.length > 0) {
            console.log("✅ Organization has proposals in Subgraph!");
        } else {
            console.log("❌ Organization not found or has no proposals linked.");
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkOrgSchema();
