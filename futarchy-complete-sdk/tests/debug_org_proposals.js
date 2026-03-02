
import fs from 'fs';

// Use native fetch (Node 22+)
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest';
const GNOSIS_TOKEN = '0x6810e776880c02933d47db1b9fc05908e5386b96'; // Gnosis Token (common for Gnosis DAO)
const ORG_ADDRESS = '0x818FdF727aA4672c80bBFd47eE13975080AC40E5'.toLowerCase();

async function run() {
    const log = [];
    const logFile = 'debug_org_proposals_output.json';

    console.log(`🔍 Checking Proposal Links for Org: ${ORG_ADDRESS}`);
    log.push({ msg: `Checking Org: ${ORG_ADDRESS}` });

    // Strategy 1: Link via Organization Entity
    const query1 = `{
        organization(id: "${ORG_ADDRESS}") {
            id
            proposals(first: 5) { id marketName }
        }
    }`;

    // Strategy 2: Filter Proposals by Owner (if owner == Org address)
    const query2 = `{
        proposals(first: 5, where: { owner: "${ORG_ADDRESS}" }) {
            id
            marketName
            owner
        }
    }`;

    // Strategy 3: Filter by Company Token
    const query3 = `{
        proposals(first: 5, where: { companyToken: "${GNOSIS_TOKEN}" }) {
            id
            marketName
            companyToken { symbol }
        }
    }`;

    async function tryQuery(name, query) {
        try {
            const res = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await res.json();
            log.push({ strategy: name, result: data });
            console.log(`${name} done`);
        } catch (e) {
            log.push({ strategy: name, error: e.message });
            console.error(`${name} error: ${e.message}`);
        }
    }

    await tryQuery("Strategy 1 (Org Entity)", query1);
    await tryQuery("Strategy 2 (Owner)", query2);
    await tryQuery("Strategy 3 (Company Token)", query3);

    fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
    console.log(`Wrote results to ${logFile}`);
}

run();
