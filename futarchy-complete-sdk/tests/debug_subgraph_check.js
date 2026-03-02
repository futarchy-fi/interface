
import fs from 'fs';

// Node 22 has global fetch
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest';
const PROPOSAL_ID = '0x3c109ec3c7eb7da835dd3b64f575efae7abfdf4e'; // Lowercased

async function runDebug() {
    const log = [];
    const logFile = 'debug_output.json';

    console.log(`🔍 Debugging Subgraph Proposal: ${PROPOSAL_ID}`);
    log.push({ msg: `Debugging ID: ${PROPOSAL_ID}` });

    // 1. Specific Query
    const querySpecific = `{
        proposal(id: "${PROPOSAL_ID}") {
            id
            marketName
            companyToken { symbol }
            currencyToken { symbol }
            pools { id }
        }
    }`;

    try {
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: querySpecific })
        });
        const data = await res.json();
        log.push({ type: 'specific', data });
        console.log('Specific done');
    } catch (e) {
        log.push({ type: 'specific_error', error: e.message });
    }

    // 2. Generic Query
    const queryGeneric = `{
        proposals(first: 5) {
            id
            marketName
        }
    }`;

    try {
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryGeneric })
        });
        const data = await res.json();
        log.push({ type: 'generic', data });
        console.log('Generic done');
    } catch (e) {
        log.push({ type: 'generic_error', error: e.message });
    }

    fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
    console.log(`Wrote results to ${logFile}`);
}

runDebug();
