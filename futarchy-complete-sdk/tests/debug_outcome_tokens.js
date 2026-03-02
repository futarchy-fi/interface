/**
 * Debug script to explore outcomeTokens with roles from the subgraph
 * and format a clean contract config JSON
 * 
 * Usage: node tests/debug_outcome_tokens.js
 */

const PROPOSAL_ID = '0x3D076d5d12341226527241f8a489D4A8863B73e5'.toLowerCase();
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest';

async function fetchFullProposalSchema() {
    // Query the full schema including outcomeTokens with roles
    const query = `{
        proposal(id: "${PROPOSAL_ID}") {
            id
            marketName
            companyToken { id symbol decimals }
            currencyToken { id symbol decimals }
            
            # OutcomeTokens with roles - this is the key!
            outcomeTokens {
                id
                symbol
                decimals
                role
            }
            
            # Pools with full details
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

    console.log('🔍 Fetching proposal with full schema...\n');
    console.log('Query:', query);
    console.log('\n---\n');

    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });

    const result = await response.json();

    if (result.errors) {
        console.error('❌ GraphQL Errors:', JSON.stringify(result.errors, null, 2));
        return null;
    }

    return result.data?.proposal;
}

function formatContractConfig(proposal) {
    if (!proposal) {
        console.log('❌ No proposal data');
        return null;
    }

    console.log('📦 Raw Proposal Data:');
    console.log(JSON.stringify(proposal, null, 2));
    console.log('\n---\n');

    // Parse outcome tokens by role
    const outcomeTokensByRole = {};
    if (proposal.outcomeTokens) {
        console.log('🎯 OutcomeTokens with Roles:');
        proposal.outcomeTokens.forEach(token => {
            console.log(`  - ${token.symbol}: role="${token.role}" (${token.id})`);
            outcomeTokensByRole[token.role] = token;
        });
        console.log('\n');
    }

    // Parse pools by type and side
    const poolsByTypeAndSide = {};
    if (proposal.pools) {
        console.log('🏊 Pools by Type and Side:');
        proposal.pools.forEach(pool => {
            const key = `${pool.type}_${pool.outcomeSide}`;
            poolsByTypeAndSide[key] = pool;
            console.log(`  - ${key}: ${pool.id}`);
            console.log(`      token0: ${pool.token0?.symbol} (${pool.token0?.id})`);
            console.log(`      token1: ${pool.token1?.symbol} (${pool.token1?.id})`);
        });
        console.log('\n');
    }

    // Build clean contract config using roles
    const contractConfig = {
        proposalId: proposal.id,
        marketName: proposal.marketName,
        chainId: 100,

        // Base tokens (directly from proposal)
        baseTokens: {
            company: {
                address: proposal.companyToken?.id,
                symbol: proposal.companyToken?.symbol,
                decimals: proposal.companyToken?.decimals
            },
            currency: {
                address: proposal.currencyToken?.id,
                symbol: proposal.currencyToken?.symbol,
                decimals: proposal.currencyToken?.decimals
            }
        },

        // Outcome tokens (parsed by role - EASY!)
        outcomeTokens: {
            YES_COMPANY: outcomeTokensByRole['YES_COMPANY'] ? {
                address: outcomeTokensByRole['YES_COMPANY'].id,
                symbol: outcomeTokensByRole['YES_COMPANY'].symbol,
                decimals: outcomeTokensByRole['YES_COMPANY'].decimals
            } : null,
            NO_COMPANY: outcomeTokensByRole['NO_COMPANY'] ? {
                address: outcomeTokensByRole['NO_COMPANY'].id,
                symbol: outcomeTokensByRole['NO_COMPANY'].symbol,
                decimals: outcomeTokensByRole['NO_COMPANY'].decimals
            } : null,
            YES_CURRENCY: outcomeTokensByRole['YES_CURRENCY'] ? {
                address: outcomeTokensByRole['YES_CURRENCY'].id,
                symbol: outcomeTokensByRole['YES_CURRENCY'].symbol,
                decimals: outcomeTokensByRole['YES_CURRENCY'].decimals
            } : null,
            NO_CURRENCY: outcomeTokensByRole['NO_CURRENCY'] ? {
                address: outcomeTokensByRole['NO_CURRENCY'].id,
                symbol: outcomeTokensByRole['NO_CURRENCY'].symbol,
                decimals: outcomeTokensByRole['NO_CURRENCY'].decimals
            } : null
        },

        // Pools (parsed by type and side - CLEAN!)
        pools: {
            conditional: {
                yes: poolsByTypeAndSide['CONDITIONAL_YES'] ? {
                    address: poolsByTypeAndSide['CONDITIONAL_YES'].id,
                    token0: poolsByTypeAndSide['CONDITIONAL_YES'].token0,
                    token1: poolsByTypeAndSide['CONDITIONAL_YES'].token1
                } : null,
                no: poolsByTypeAndSide['CONDITIONAL_NO'] ? {
                    address: poolsByTypeAndSide['CONDITIONAL_NO'].id,
                    token0: poolsByTypeAndSide['CONDITIONAL_NO'].token0,
                    token1: poolsByTypeAndSide['CONDITIONAL_NO'].token1
                } : null
            },
            prediction: {
                yes: poolsByTypeAndSide['PREDICTION_YES'] ? {
                    address: poolsByTypeAndSide['PREDICTION_YES'].id,
                    token0: poolsByTypeAndSide['PREDICTION_YES'].token0,
                    token1: poolsByTypeAndSide['PREDICTION_YES'].token1
                } : null,
                no: poolsByTypeAndSide['PREDICTION_NO'] ? {
                    address: poolsByTypeAndSide['PREDICTION_NO'].id,
                    token0: poolsByTypeAndSide['PREDICTION_NO'].token0,
                    token1: poolsByTypeAndSide['PREDICTION_NO'].token1
                } : null
            },
            expectedValue: {
                yes: poolsByTypeAndSide['EXPECTED_VALUE_YES'] ? {
                    address: poolsByTypeAndSide['EXPECTED_VALUE_YES'].id,
                    token0: poolsByTypeAndSide['EXPECTED_VALUE_YES'].token0,
                    token1: poolsByTypeAndSide['EXPECTED_VALUE_YES'].token1
                } : null,
                no: poolsByTypeAndSide['EXPECTED_VALUE_NO'] ? {
                    address: poolsByTypeAndSide['EXPECTED_VALUE_NO'].id,
                    token0: poolsByTypeAndSide['EXPECTED_VALUE_NO'].token0,
                    token1: poolsByTypeAndSide['EXPECTED_VALUE_NO'].token1
                } : null
            }
        }
    };

    return contractConfig;
}

async function main() {
    console.log('='.repeat(60));
    console.log('🧪 Debug: OutcomeTokens with Roles');
    console.log('='.repeat(60));
    console.log(`Proposal: ${PROPOSAL_ID}`);
    console.log(`Subgraph: ${SUBGRAPH_URL}`);
    console.log('='.repeat(60) + '\n');

    const proposal = await fetchFullProposalSchema();
    const contractConfig = formatContractConfig(proposal);

    console.log('='.repeat(60));
    console.log('✅ FINAL CONTRACT CONFIG (Easy to Consume):');
    console.log('='.repeat(60));
    console.log(JSON.stringify(contractConfig, null, 2));

    // Save to file
    const fs = await import('fs');
    fs.writeFileSync(
        'tests/debug_contract_config_output.json',
        JSON.stringify(contractConfig, null, 2)
    );
    console.log('\n💾 Saved to tests/debug_contract_config_output.json');
}

main().catch(console.error);
