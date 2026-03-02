const axios = require('axios');

/**
 * Graph Status Tester with RPC Sync Check
 * 
 * Usage:
 *   node statu/test-graph-status.js <SUBGRAPH_URL_OR_ID>
 * 
 * Examples:
 *   node statu/test-graph-status.js https://api.studio.thegraph.com/query/1234/subgraph-name/version/latest
 *   node statu/test-graph-status.js QmDeploymentId...
 */

const STATUS_ENDPOINT = 'https://api.studio.thegraph.com/query/status';
const GNOSIS_RPC = 'https://rpc.gnosischain.com';
const LAG_THRESHOLD = 50; // Blocks

async function getRPCBlockNumber() {
  try {
    const response = await axios.post(GNOSIS_RPC, {
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1
    });
    const hexBlock = response.data.result;
    return parseInt(hexBlock, 16);
  } catch (error) {
    console.error('⚠️ RPC Error:', error.message);
    return null;
  }
}

async function queryMeta(url, rpcBlock) {
  console.log(`\n🔍 Querying _meta from: ${url}`);
  const query = `
    {
      _meta {
        block {
          number
          hash
          timestamp
        }
        deployment
        hasIndexingErrors
      }
    }
  `;

  try {
    const response = await axios.post(url, { query });
    if (response.data.errors) {
      console.error('❌ Metadata GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
      return;
    }

    if (!response.data.data || !response.data.data._meta) {
      console.error('❌ No _meta found. Ensure this is a valid Subgraph query endpoint.');
      return;
    }

    const meta = response.data.data._meta;
    const subheaderBlock = meta.block.number;

    console.log('\n--- Subgraph Metadata (_meta) ---');
    console.log(`Deployment ID: ${meta.deployment}`);
    console.log(`Latest Block:  ${subheaderBlock}`);
    console.log(`Timestamp:     ${new Date(meta.block.timestamp * 1000).toLocaleString()}`);
    console.log(`Has Errors:    ${meta.hasIndexingErrors ? '❌ YES' : '✅ NO'}`);

    if (rpcBlock) {
      const lag = rpcBlock - subheaderBlock;
      console.log(`RPC Head:      ${rpcBlock}`);
      if (lag > LAG_THRESHOLD) {
        console.log(`⚠️ SYNC ALERT: Subgraph is lagging by ${lag} blocks (Threshold: ${LAG_THRESHOLD})`);
      } else {
        console.log(`✅ SYNC OK: Lag is only ${lag} blocks`);
      }
    }

    return meta.deployment;
  } catch (error) {
    console.error('❌ Metadata Query Error:', error.message);
  }
}

async function checkIndexingStatus(subgraphId, rpcBlock) {
  console.log(`\n📊 Checking Detailed Indexing Status (from Status API)...`);

  const query = `
    {
      indexingStatuses(subgraphs: ["${subgraphId}"]) {
        subgraph
        synced
        health
        fatalError {
          message
          block {
            number
          }
        }
        chains {
          network
          chainHeadBlock {
            number
          }
          latestBlock {
            number
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(STATUS_ENDPOINT, { query });

    if (!response.data || !response.data.data || !response.data.data.indexingStatuses) {
      console.log('⚠️ Status API did not return indexing data for this ID.');
      return;
    }

    const statuses = response.data.data.indexingStatuses;

    if (statuses.length === 0) {
      console.log('⚠️ No indexing status found in the status API registry for this deployment.');
      return;
    }

    statuses.forEach((status) => {
      console.log('\n--- Indexing Status Report ---');
      console.log(`ID/Deployment: ${status.subgraph}`);
      console.log(`Synced:        ${status.synced ? '✅ YES' : '⏳ NO'}`);
      console.log(`Health:        ${status.health === 'healthy' ? '💚 Healthy' : '💔 ' + status.health.toUpperCase()}`);

      if (status.fatalError) {
        console.log(`❌ FATAL ERROR: ${status.fatalError.message}`);
        console.log(`   At block:    ${status.fatalError.block.number}`);
      }

      if (status.chains && status.chains.length > 0) {
        status.chains.forEach((chain) => {
          console.log(`\nChain: ${chain.network}`);
          const latest = chain.latestBlock ? parseInt(chain.latestBlock.number) : 0;
          const head = chain.chainHeadBlock ? parseInt(chain.chainHeadBlock.number) : 0;
          const diff = head - latest;
          const progress = head > 0 ? ((latest / head) * 100).toFixed(4) : 'N/A';

          console.log(`  Latest Block: ${latest}`);
          console.log(`  Chain Head:   ${head}`);
          console.log(`  Sync Lag:     ${diff} blocks`);

          if (rpcBlock && chain.network === 'gnosis') {
            const rpcLag = rpcBlock - latest;
            console.log(`  RPC Lag:      ${rpcLag} blocks (vs RPC Head ${rpcBlock})`);
            if (rpcLag > LAG_THRESHOLD) {
              console.log(`  ⚠️ SYNC ALERT: Subgraph is significantly behind RPC head!`);
            }
          }

          console.log(`  Progress:     ${progress}%`);
        });
      }
    });

  } catch (error) {
    console.error('❌ Status API Error:', error.message);
  }
}

async function run() {
  const input = process.argv[2];

  if (!input) {
    console.log('❌ Please provide a Subgraph URL or Deployment ID.');
    console.log('Usage: node statu/test-graph-status.js <URL_OR_ID>');
    return;
  }

  console.log('🌐 Fetching latest block from Gnosis RPC...');
  const rpcBlock = await getRPCBlockNumber();

  if (input.startsWith('http')) {
    const deploymentId = await queryMeta(input, rpcBlock);
    if (deploymentId) {
      await checkIndexingStatus(deploymentId, rpcBlock);
    }
  } else {
    await checkIndexingStatus(input, rpcBlock);
  }
}

run();
