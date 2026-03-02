/**
 * Complete Debug Script: Fetch from BOTH subgraphs and build full contract config
 * 
 * - futarchy-complete-new: Registry data (display names, question, event, description)
 * - algebra-proposals-candles: Market data (tokens, pools with roles)
 * 
 * Usage: node tests/debug_complete_config.js
 */

const PROPOSAL_ID = '0x3D076d5d12341226527241f8a489D4A8863B73e5'.toLowerCase();
const METADATA_CONTRACT = '0x3c109ec3c7eb7da835dd3b64f575efae7abfdf4e';

const REGISTRY_SUBGRAPH = 'https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest';
const MARKET_SUBGRAPH = 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest';

// ============================================
// 1. FETCH FROM REGISTRY (futarchy-complete-new)
// ============================================
async function fetchRegistryData() {
    // Query by PROPOSAL_ID (logic address) - find org that contains this proposal
    const query = `{
        organizations(where: { proposals_: { id: "${PROPOSAL_ID}" } }, first: 1) {
            id
            name
            description
            proposals(where: { id: "${PROPOSAL_ID}" }, first: 1) {
                id
                owner
                metadataContract
                displayNameQuestion
                displayNameEvent
                description
                metadataURI
                metadata
            }
        }
    }`;

    console.log('📋 REGISTRY SUBGRAPH (futarchy-complete-new)');
    console.log('   Query ID:', PROPOSAL_ID);

    const response = await fetch(REGISTRY_SUBGRAPH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });

    const result = await response.json();

    if (result.errors) {
        console.log('   ❌ Errors:', JSON.stringify(result.errors));
        return null;
    }

    const org = result.data?.organizations?.[0];
    const proposal = org?.proposals?.[0];

    console.log('   ✅ Found Organization:', org?.name);
    console.log('   ✅ Proposal Fields:');
    if (proposal) {
        console.log('      - displayNameQuestion:', proposal.displayNameQuestion || 'N/A');
        console.log('      - displayNameEvent:', proposal.displayNameEvent || 'N/A');
        console.log('      - description:', proposal.description || 'N/A');
        console.log('      - owner:', proposal.owner);
        console.log('      - metadataContract:', proposal.metadataContract);
    }
    console.log('');

    return { organization: org, proposal };
}

// ============================================
// 2. FETCH FROM MARKET (algebra-proposals-candles)
// ============================================
async function fetchMarketData() {
    const query = `{
        proposal(id: "${PROPOSAL_ID}") {
            id
            marketName
            
            companyToken { id symbol decimals }
            currencyToken { id symbol decimals }
            
            outcomeTokens {
                id
                symbol
                decimals
                role
            }
            
            pools {
                id
                name
                type
                outcomeSide
                price
                token0 { id symbol }
                token1 { id symbol }
            }
        }
    }`;

    console.log('📊 MARKET SUBGRAPH (algebra-proposals-candles)');
    console.log('   Query ID:', PROPOSAL_ID);

    const response = await fetch(MARKET_SUBGRAPH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });

    const result = await response.json();

    if (result.errors) {
        console.log('   ❌ Errors:', JSON.stringify(result.errors));
        return null;
    }

    const proposal = result.data?.proposal;

    if (proposal) {
        console.log('   ✅ Found Proposal');
        console.log('   ✅ OutcomeTokens by Role:');
        proposal.outcomeTokens?.forEach(t => {
            console.log(`      - ${t.role}: ${t.symbol} (${t.id.slice(0, 10)}...)`);
        });
        console.log('   ✅ Pools:');
        proposal.pools?.forEach(p => {
            console.log(`      - ${p.type}_${p.outcomeSide}: ${p.id.slice(0, 10)}...`);
        });
    }
    console.log('');

    return proposal;
}

// ============================================
// 3. BUILD COMPLETE CONTRACT CONFIG
// ============================================
function buildContractConfig(registryData, marketData) {
    const { organization, proposal: regProposal } = registryData || {};
    const mkt = marketData;

    // Parse outcome tokens by role
    const tokensByRole = {};
    mkt?.outcomeTokens?.forEach(t => { tokensByRole[t.role] = t; });

    // Parse pools by type_side
    const poolsByKey = {};
    mkt?.pools?.forEach(p => { poolsByKey[`${p.type}_${p.outcomeSide}`] = p; });

    return {
        // ===== IDENTIFICATION =====
        proposalId: PROPOSAL_ID,
        metadataContract: regProposal?.metadataContract || METADATA_CONTRACT,
        chainId: 100,

        // ===== DISPLAY (from Registry) =====
        display: {
            question: regProposal?.displayNameQuestion || mkt?.marketName || 'N/A',
            event: regProposal?.displayNameEvent || 'N/A',
            description: regProposal?.description || 'N/A',
            metadataURI: regProposal?.metadataURI || null
        },

        // ===== ORGANIZATION (from Registry) =====
        organization: {
            id: organization?.id || null,
            name: organization?.name || 'Unknown',
            owner: regProposal?.owner || null
        },

        // ===== BASE TOKENS (from Market) =====
        baseTokens: {
            company: mkt?.companyToken ? {
                address: mkt.companyToken.id,
                symbol: mkt.companyToken.symbol,
                decimals: parseInt(mkt.companyToken.decimals)
            } : null,
            currency: mkt?.currencyToken ? {
                address: mkt.currencyToken.id,
                symbol: mkt.currencyToken.symbol,
                decimals: parseInt(mkt.currencyToken.decimals)
            } : null
        },

        // ===== OUTCOME TOKENS by ROLE (from Market) =====
        outcomeTokens: {
            YES_COMPANY: tokensByRole['YES_COMPANY'] ? {
                address: tokensByRole['YES_COMPANY'].id,
                symbol: tokensByRole['YES_COMPANY'].symbol,
                decimals: parseInt(tokensByRole['YES_COMPANY'].decimals)
            } : null,
            NO_COMPANY: tokensByRole['NO_COMPANY'] ? {
                address: tokensByRole['NO_COMPANY'].id,
                symbol: tokensByRole['NO_COMPANY'].symbol,
                decimals: parseInt(tokensByRole['NO_COMPANY'].decimals)
            } : null,
            YES_CURRENCY: tokensByRole['YES_CURRENCY'] ? {
                address: tokensByRole['YES_CURRENCY'].id,
                symbol: tokensByRole['YES_CURRENCY'].symbol,
                decimals: parseInt(tokensByRole['YES_CURRENCY'].decimals)
            } : null,
            NO_CURRENCY: tokensByRole['NO_CURRENCY'] ? {
                address: tokensByRole['NO_CURRENCY'].id,
                symbol: tokensByRole['NO_CURRENCY'].symbol,
                decimals: parseInt(tokensByRole['NO_CURRENCY'].decimals)
            } : null
        },

        // ===== POOLS by TYPE (from Market) =====
        pools: {
            conditional: {
                yes: poolsByKey['CONDITIONAL_YES'] ? {
                    address: poolsByKey['CONDITIONAL_YES'].id,
                    type: 'CONDITIONAL',
                    outcomeSide: 'YES',
                    token0: poolsByKey['CONDITIONAL_YES'].token0,
                    token1: poolsByKey['CONDITIONAL_YES'].token1
                } : null,
                no: poolsByKey['CONDITIONAL_NO'] ? {
                    address: poolsByKey['CONDITIONAL_NO'].id,
                    type: 'CONDITIONAL',
                    outcomeSide: 'NO',
                    token0: poolsByKey['CONDITIONAL_NO'].token0,
                    token1: poolsByKey['CONDITIONAL_NO'].token1
                } : null
            },
            prediction: {
                yes: poolsByKey['PREDICTION_YES'] ? {
                    address: poolsByKey['PREDICTION_YES'].id,
                    type: 'PREDICTION',
                    outcomeSide: 'YES',
                    token0: poolsByKey['PREDICTION_YES'].token0,
                    token1: poolsByKey['PREDICTION_YES'].token1
                } : null,
                no: poolsByKey['PREDICTION_NO'] ? {
                    address: poolsByKey['PREDICTION_NO'].id,
                    type: 'PREDICTION',
                    outcomeSide: 'NO',
                    token0: poolsByKey['PREDICTION_NO'].token0,
                    token1: poolsByKey['PREDICTION_NO'].token1
                } : null
            },
            expectedValue: {
                yes: poolsByKey['EXPECTED_VALUE_YES'] ? {
                    address: poolsByKey['EXPECTED_VALUE_YES'].id,
                    type: 'EXPECTED_VALUE',
                    outcomeSide: 'YES',
                    token0: poolsByKey['EXPECTED_VALUE_YES'].token0,
                    token1: poolsByKey['EXPECTED_VALUE_YES'].token1
                } : null,
                no: poolsByKey['EXPECTED_VALUE_NO'] ? {
                    address: poolsByKey['EXPECTED_VALUE_NO'].id,
                    type: 'EXPECTED_VALUE',
                    outcomeSide: 'NO',
                    token0: poolsByKey['EXPECTED_VALUE_NO'].token0,
                    token1: poolsByKey['EXPECTED_VALUE_NO'].token1
                } : null
            }
        },

        // ===== POOL COUNT =====
        poolCount: mkt?.pools?.length || 0,

        // ===== SOURCE INFO =====
        _source: {
            registry: 'futarchy-complete-new',
            market: 'algebra-proposals-candles'
        }
    };
}

// ============================================
// MAIN
// ============================================
async function main() {
    console.log('='.repeat(70));
    console.log('🔬 COMPLETE CONTRACT CONFIG DEBUG');
    console.log('='.repeat(70));
    console.log('Proposal Logic Address:', PROPOSAL_ID);
    console.log('Metadata Contract:', METADATA_CONTRACT);
    console.log('='.repeat(70) + '\n');

    // Fetch from both subgraphs
    const registryData = await fetchRegistryData();
    const marketData = await fetchMarketData();

    // Build complete config
    const contractConfig = buildContractConfig(registryData, marketData);

    console.log('='.repeat(70));
    console.log('📦 COMPLETE CONTRACT CONFIG (Ready for useContractConfig):');
    console.log('='.repeat(70));
    console.log(JSON.stringify(contractConfig, null, 2));

    // Save to file
    const fs = await import('fs');
    fs.writeFileSync(
        'tests/debug_complete_config_output.json',
        JSON.stringify(contractConfig, null, 2)
    );
    console.log('\n💾 Saved to tests/debug_complete_config_output.json');
}

main().catch(console.error);
