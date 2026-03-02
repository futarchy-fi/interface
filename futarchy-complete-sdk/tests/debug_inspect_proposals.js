
import fetch from 'node-fetch';
import fs from 'fs';

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest';

const query = `
  query Inspect {
    proposals(first: 5, orderBy: id, orderDirection: desc) {
      id
      marketName
      companyToken {
        id
        symbol
      }
    }
  }
`;

async function main() {
    console.log("Fetching sample proposals...");
    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        console.log(JSON.stringify(result, null, 2));

        fs.writeFileSync('debug_inspect_proposals_output.json', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error fetching proposals:", error);
    }
}

main();
