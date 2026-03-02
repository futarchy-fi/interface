
import fetch from 'node-fetch';
import fs from 'fs';

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest";

const query = `
  query Introspection {
    ProposalMetadata: __type(name: "ProposalMetadata") {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
    OrganizationMetadata: __type(name: "OrganizationMetadata") {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
    Proposal: __type(name: "Proposal") {
      name
      fields {
        name
        type {
           name
           kind
        }
      }
    }
  }
`;

async function main() {
    console.log(`Introspecting: ${SUBGRAPH_URL}`);
    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        console.log(JSON.stringify(result, null, 2));

        fs.writeFileSync('debug_futarchy_complete_introspection.json', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error fetching schema:", error);
    }
}

main();
