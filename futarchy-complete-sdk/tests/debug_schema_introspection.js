
import fetch from 'node-fetch';
import fs from 'fs';

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest";

const query = `
  query Introspection {
    __type(name: "Proposal") {
      name
      fields {
        name
        type {
          name
          kind
          ofType {
            name
            kind
          }
        }
      }
    }
    OrganizationType: __type(name: "Organization") {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
    QueryType: __type(name: "Query") {
        fields {
            name
        }
    }
  }
`;

async function main() {
    console.log("Fetching schema introspection...");
    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });

        const result = await response.json();

        // Log the full output for inspection
        console.log(JSON.stringify(result, null, 2));

        fs.writeFileSync('debug_schema_introspection_output.json', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error fetching schema:", error);
    }
}

main();
