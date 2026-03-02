
import fetch from 'node-fetch';

const COMPLETE_SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest";

const query = `
  query Introspection {
    __schema {
      queryType {
        name
        fields {
          name
        }
      }
    }
  }
`;

async function main() {
    console.log(`Introspecting Query Type: ${COMPLETE_SUBGRAPH_URL}`);
    try {
        const response = await fetch(COMPLETE_SUBGRAPH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error fetching schema:", error);
    }
}

main();
