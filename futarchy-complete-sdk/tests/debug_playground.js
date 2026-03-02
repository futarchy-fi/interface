
import fetch from 'node-fetch';

// CONFIGURATION
const REGISTRY_SUBGRAPH = "https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest";
const MARKET_SUBGRAPH = "https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest";

// IDs
const LOGIC_ADDRESS = "0x3d076d5d12341226527241f8a489d4a8863b73e5"; // Use for Registry
const METADATA_ADDRESS = "0x3c109ec3c7eb7da835dd3b64f575efae7abfdf4e"; // Use for Market

async function runPlayground() {
    console.log("🎨 Subgraph Playground Data Fetcher\n");

    // 1. REGISTRY FETCH
    console.log(`1️⃣  Fetching REGISTRY (Owner/Org)`);
    console.log(`    URL: ${REGISTRY_SUBGRAPH}`);
    console.log(`    ID (Logic): ${LOGIC_ADDRESS}`);

    // Inverted Lookup Query
    const registryQuery = `{
        organizations(where: { proposals_: { id: "${LOGIC_ADDRESS}" } }, first: 1) {
            id
            name
            proposals(where: { id: "${LOGIC_ADDRESS}" }, first: 1) {
                owner
                metadataContract
            }
        }
    }`;

    try {
        const res = await fetch(REGISTRY_SUBGRAPH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: registryQuery })
        });
        const data = await res.json();
        console.log("    ✅ Result:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.log("    ❌ Error:", e.message);
    }

    console.log("\n--------------------------------------------------\n");

    // 2. MARKET FETCH (Discovery)
    console.log(`2️⃣  Fetching MARKET (Tokens/Pools)`);
    console.log(`    URL: ${MARKET_SUBGRAPH}`);

    // A. List Recent to check ID format
    const listQuery = `{
        proposals(first: 5, orderBy: id, orderDirection: desc) {
            id
            marketName
            companyToken { symbol }
        }
    }`;

    try {
        const res = await fetch(MARKET_SUBGRAPH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: listQuery })
        });
        const data = await res.json();
        console.log("    🔍 Recent IDs in Subgraph:", JSON.stringify(data.data?.proposals, null, 2));
    } catch (e) {
        console.log("    ❌ List Error:", e.message);
    }

    // B. Test Specific IDs
    console.log("\n    Targeting Specific IDs:");

    const checkId = async (id, label) => {
        const q = `{ proposal(id: "${id.toLowerCase()}") { id marketName pools { id } } }`;
        const r = await fetch(MARKET_SUBGRAPH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q })
        });
        const d = await r.json();
        console.log(`    Checking ${label} (${id}):`, d.data?.proposal ? "✅ FOUND" : "❌ NOT FOUND");
        if (d.data?.proposal) console.log("      ->", JSON.stringify(d.data.proposal));
    };

    await checkId(LOGIC_ADDRESS, "Logic Addr");
    await checkId(METADATA_ADDRESS, "Metadata Addr");
}

runPlayground();
