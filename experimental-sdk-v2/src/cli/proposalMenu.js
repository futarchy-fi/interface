import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ConfigAdapter } from '../core/configAdapter.js';
import { LiquidityAnalyzer } from '../core/liquidity.js';
import { createPool } from '../actions/poolWrite.js';
import { displaySwaps, displayCandles, displaySpotPrice } from '../actions/read.js';
import { CONTRACTS, CHAIN_ID } from '../config/constants.js';

export async function openProposalMenu(subgraph, contracts, spotClient, proposalId) {
    while (true) {
        // Fetch fresh details every loop
        const data = await subgraph.getProposalDetails(proposalId);
        if (!data.proposal) {
            console.log(chalk.red('Proposal not found.'));
            break;
        }

        console.log(chalk.bold.cyan(`\n🎫 PROPOSAL: ${data.proposal.marketName}`));

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Select Action:',
            choices: [
                '📄 View Config (Frontend Adapter)',
                '🌊 Smart Liquidity Analysis',
                '🔄 View Recent Swaps',
                '🕯️ View Candles',
                '📈 External Spot Price',
                '➕ Create Missing Pool (Write)',
                '🔙 Back'
            ]
        }]);

        if (action === '🔙 Back') break;

        try {
            if (action === '📄 View Config (Frontend Adapter)') {
                const config = ConfigAdapter.transform(data.proposal, CHAIN_ID);
                console.log(chalk.gray(JSON.stringify(config, null, 2)));
            }

            if (action === '🌊 Smart Liquidity Analysis') {
                const analysis = LiquidityAnalyzer.analyze(data.proposal.pools);
                console.log(chalk.bold('\n💧 Liquidity Analysis (Values are approximate raw units)'));

                const table = new Table({ head: ['Side', 'Best Pool ID', 'Liquidity', 'Approx Price'] });

                if (analysis.yes) table.push(['YES', analysis.yes.address, analysis.yes.liquidity, analysis.yes.derivedPrice.toFixed(4)]);
                else table.push(['YES', chalk.red('Missing'), '-', '-']);

                if (analysis.no) table.push(['NO', analysis.no.address, analysis.no.liquidity, analysis.no.derivedPrice.toFixed(4)]);
                else table.push(['NO', chalk.red('Missing'), '-', '-']);

                console.log(table.toString());
            }

            if (action === '🔄 View Recent Swaps') {
                const poolIds = data.proposal.pools.map(p => p.id);
                await displaySwaps(subgraph, poolIds);
            }

            if (action === '🕯️ View Candles') {
                // Determine best pools from liquidity analysis
                const analysis = LiquidityAnalyzer.analyze(data.proposal.pools);
                const targetPool = analysis.yes || analysis.no || data.proposal.pools[0];

                if (!targetPool) console.log(chalk.yellow('No pools to fetch candles from.'));
                else await displayCandles(subgraph, targetPool.address || targetPool.id);
            }

            if (action === '📈 External Spot Price') {
                // Try to guess pool? For now, manual input is safest.
                const { poolAddr } = await inquirer.prompt([{
                    type: 'input',
                    name: 'poolAddr',
                    message: 'Enter GeckoTerminal Pool Address:',
                    default: '0xd1d7fa8871d84d0e77020fc28b7cd5718c446522'
                }]);
                await displaySpotPrice(spotClient, CHAIN_ID, poolAddr);
            }

            if (action === '➕ Create Missing Pool (Write)') {
                // Interactive wizard
                const { side, price } = await inquirer.prompt([
                    { type: 'list', name: 'side', message: 'Side:', choices: ['YES', 'NO'] },
                    { type: 'number', name: 'price', message: 'Initial Price:' }
                ]);

                // Determine TOKENS
                // Side YES: outcomeToken vs Currency
                // Side NO: outcomeToken vs Currency
                // We need to look up the exact contract addresses.
                // ConfigAdapter logic helps here.
                const config = ConfigAdapter.transform(data.proposal, CHAIN_ID);
                const outcomeToken = side === 'YES'
                    ? config.metadata.contractInfos.outcomeTokens[0] // Simplified index 0
                    : config.metadata.contractInfos.outcomeTokens[1]; // Simplified index 1

                const currency = config.metadata.contractInfos.collateralToken;

                if (!outcomeToken || !currency) {
                    console.error(chalk.red('Could not determine token addresses from config.'));
                    continue;
                }

                console.log(chalk.yellow(`Creating Pool: ${side} Token (${outcomeToken}) / Currency (${currency})`));
                // Call createPool
                // We need to pass blockchainService... wait, we need to pass `contracts` service wrapper or provider.
                // Refactor: createPool expects blockchainService. 
                // We'll pass `contracts.provider` assuming it's the blockchain service instance.
                await createPool(contracts.provider, outcomeToken, currency, price);
            }

        } catch (error) {
            console.error(chalk.red('Error:'), error.message);
        }
    }
}
