// Test script to explore Snapshot GraphQL schema
const fetch = require('node-fetch');

const SNAPSHOT_GRAPHQL_ENDPOINT = 'https://hub.snapshot.org/graphql';

// Introspection query to get proposal fields
const introspectionQuery = `
  query {
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
        description
      }
    }
  }
`;

// Or test with a real proposal to see actual data structure
const realProposalQuery = `
  query {
    proposal(id: "0x7886e688825f63883b4702286b96d5f89014fabd58cbe995dd53c4b9f7bf0f66") {
      id
      title
      state
      choices
      scores
      scores_total
      scores_state
      votes
      quorum
      type
      privacy
      created
      start
      end
      snapshot
      network
      strategies {
        name
        params
      }
      plugins
      validation {
        name
        params
      }
      space {
        id
        name
      }
    }
  }
`;

async function testSchema() {
  console.log('=== INTROSPECTION QUERY ===\n');

  try {
    const introspectResponse = await fetch(SNAPSHOT_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: introspectionQuery }),
    });

    const introspectResult = await introspectResponse.json();
    console.log('Available Proposal fields:');
    console.log(JSON.stringify(introspectResult, null, 2));
  } catch (error) {
    console.error('Introspection error:', error);
  }

  console.log('\n\n=== REAL PROPOSAL QUERY ===\n');

  try {
    const realResponse = await fetch(SNAPSHOT_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: realProposalQuery }),
    });

    const realResult = await realResponse.json();
    console.log('Real proposal data structure:');
    console.log(JSON.stringify(realResult, null, 2));
  } catch (error) {
    console.error('Real query error:', error);
  }
}

testSchema();
