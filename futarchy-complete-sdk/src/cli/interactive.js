// src/cli/interactive.js
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import figlet from 'figlet';
import boxen from 'boxen';
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, CHAIN_CONFIG, CATEGORY_PRESETS, MIN_BOND_PRESETS, TRADING_ADDRESSES } from '../config/contracts.js';
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { gnosis, mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { exportChartData, fetchCandles, fetchTrades, fetchPools, fetchSpotCandles, gapFillCandles } from '../core/ChartDataClient.js';
import fs from 'fs';

export class InteractiveCLI {
    constructor(dataLayer, executor = null) {
        this.dataLayer = dataLayer;
        this.executor = executor;
        this.connectedWallet = executor?.account?.address || null;
    }

    async start() {
        // console.clear();
        console.log("--- Futarchy SDK Interactive Mode ---");
        /*
        console.log(
            chalk.blue(
                figlet.textSync('Futarchy SDK', { horizontalLayout: 'full' })
            )
        );
        console.log(boxen(chalk.green('Interactive Mode'), { padding: 1, borderStyle: 'round' }));
        */

        while (true) {
            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'What would you like to do?',
                    choices: [
                        { name: '🚀 Create Actual Proposal', value: 'create_actual_proposal' },
                        { name: '🏢 Manage Organizations', value: 'manage_orgs' },
                        { name: '➕ Create Organization', value: 'create_org' },
                        { name: '🗑️ Remove Organization', value: 'remove_org' },
                        { name: '✏️ Edit Aggregator', value: 'edit_aggregator' },
                        { name: '🔍 Explore Metadata', value: 'explore_metadata' },
                        { name: '➕ Add Proposal Metadata', value: 'add_proposal' },
                        { name: '❌ Exit', value: 'exit' }
                    ]
                }
            ]);

            if (action === 'exit') {
                console.log(chalk.yellow('Goodbye!'));
                process.exit(0);
            }

            if (action === 'manage_orgs') {
                await this.manageOrganizations();
            } else if (action === 'create_org') {
                await this.createOrganizationFlow();
            } else if (action === 'remove_org') {
                await this.removeOrganizationFlow();
            } else if (action === 'edit_aggregator') {
                await this.editAggregatorFlow();
            } else if (action === 'add_proposal') {
                await this.addProposalFlow();
            } else if (action === 'create_actual_proposal') {
                await this.createActualProposalFlow();
            } else if (action === 'explore_metadata') {
                await this.exploreMetadataFlow();
            }
        }
    }

    async manageOrganizations() {
        // Known aggregators list
        const knownAggregators = [
            {
                name: 'Futarchy Finance (Default)',
                value: CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR,
                description: 'Main Futarchy aggregator'
            }
        ];

        // Aggregator selection
        const { aggregatorChoice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'aggregatorChoice',
                message: 'Select Aggregator:',
                choices: [
                    ...knownAggregators.map(agg => ({
                        name: `📦 ${agg.name}`,
                        value: agg.value
                    })),
                    { name: '🔧 Custom Aggregator', value: 'custom' },
                    { name: '🔙 Back', value: null }
                ]
            }
        ]);

        if (!aggregatorChoice) return;

        let aggregatorAddress;
        if (aggregatorChoice === 'custom') {
            const { customAddress } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'customAddress',
                    message: 'Enter Aggregator Address:',
                    validate: v => v.startsWith('0x') && v.length === 42 ? true : 'Invalid address'
                }
            ]);
            aggregatorAddress = customAddress;
        } else {
            aggregatorAddress = aggregatorChoice;
        }

        // Fetch aggregator info first
        let aggregatorInfo = { name: '', description: '' };
        try {
            for await (const update of this.dataLayer.execute('futarchy.getAggregatorMetadata', { aggregatorAddress })) {
                if (update.status === 'success') {
                    aggregatorInfo = update.data;
                }
            }
        } catch (e) {
            // Ignore - we'll show what we can
        }

        // Display aggregator header
        console.log(chalk.magenta('\n╭─────────────────────────────────────────────────────'));
        console.log(chalk.magenta('│ ') + chalk.bold.white(`📦 ${aggregatorInfo.name || 'Aggregator'}`));
        console.log(chalk.magenta('│ ') + chalk.dim(`Address: ${aggregatorAddress}`));
        if (aggregatorInfo.description) {
            console.log(chalk.magenta('│ ') + chalk.dim(`Description: ${aggregatorInfo.description}`));
        }
        console.log(chalk.magenta('╰─────────────────────────────────────────────────────\n'));

        // Fetch Orgs
        const spinner = ora('Fetching organizations...').start();
        const orgs = [];
        try {
            for await (const update of this.dataLayer.execute('futarchy.getOrganizations', { aggregatorAddress })) {
                if (update.status === 'partial') {
                    // Update spinner text? No, too fast usually.
                } else if (update.status === 'success') {
                    orgs.push(...update.data);
                }
            }
            spinner.succeed(`Found ${orgs.length} organizations`);
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
            return;
        }

        const { selectedOrg } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedOrg',
                message: 'Select an Organization to view:',
                choices: [
                    ...orgs.map(org => ({ name: `${org.name} (${org.address})`, value: org })),
                    { name: '🔙 Back', value: null }
                ]
            }
        ]);

        if (!selectedOrg) return;

        await this.manageSingleOrg(selectedOrg);
    }

    async manageSingleOrg(org) {
        // Show organization info header
        console.log(chalk.cyan('\n╭─────────────────────────────────────────────────────'));
        console.log(chalk.cyan('│ ') + chalk.bold.white(org.name));
        console.log(chalk.cyan('│ ') + chalk.dim(`Address: ${org.address}`));
        if (org.description) {
            console.log(chalk.cyan('│ ') + chalk.dim(`Description: ${org.description}`));
        }
        console.log(chalk.cyan('╰─────────────────────────────────────────────────────\n'));

        while (true) {
            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: `Organization: ${chalk.green(org.name)}`,
                    choices: [
                        { name: '📄 List Proposals', value: 'list_proposals' },
                        { name: '🔗 Link Existing Proposal (Subgraph)', value: 'link_proposal' },
                        { name: '▶️ Add Proposal (New)', value: 'add_proposal_here' },
                        { name: '📎 Add Existing Metadata (by address)', value: 'add_existing_metadata' },
                        { name: '🗑️ Remove Proposal', value: 'remove_proposal' },
                        { name: '✏️ Edit Organization', value: 'edit_org' },
                        { name: '📝 Edit Extended Metadata', value: 'edit_org_extended_metadata' },
                        { name: '🔙 Back', value: 'back' }
                    ]
                }
            ]);

            if (action === 'back') return;

            if (action === 'list_proposals') {
                await this.listProposals(org);
            } else if (action === 'link_proposal') {
                await this.linkExistingProposalFlow(org);
            } else if (action === 'add_proposal_here') {
                await this.addProposalFlow(org);
            } else if (action === 'add_existing_metadata') {
                await this.addExistingMetadataFlow(org);
            } else if (action === 'remove_proposal') {
                await this.removeProposalFlow(org);
            } else if (action === 'edit_org') {
                await this.editOrganizationFlow(org);
            } else if (action === 'edit_org_extended_metadata') {
                await this.editOrgExtendedMetadataFlow(org);
            }
        }
    }

    async linkExistingProposalFlow(org) {
        const spinner = ora('Fetching linkable proposals...').start();
        let proposals = [];
        try {
            for await (const update of this.dataLayer.execute('futarchy.getLinkableProposals', {})) {
                if (update.status === 'success') {
                    proposals = update.data;
                }
            }
            spinner.succeed(`Found ${proposals.length} candidates`);
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
            return;
        }

        // Search/filter option
        const { searchKeyword } = await inquirer.prompt([
            {
                type: 'input',
                name: 'searchKeyword',
                message: 'Filter by keyword or 0x address (Enter to show all):',
                default: ''
            }
        ]);

        let filteredProposals = proposals;
        const input = searchKeyword.trim().toLowerCase();

        if (input) {
            // Check if it looks like an Ethereum address (0x...)
            const isAddress = /^0x[a-fA-F0-9]{4,}$/.test(input);

            if (isAddress) {
                console.log(chalk.dim(`  🔍 Detected address pattern, searching by ID...`));
                // Search by ID (partial match)
                filteredProposals = proposals.filter(p =>
                    p.id?.toLowerCase().includes(input)
                );

                // If not found in cached list and looks like full address, try direct lookup
                if (filteredProposals.length === 0 && input.length >= 40) {
                    console.log(chalk.dim(`  📡 Not in top 50, trying direct subgraph lookup...`));
                    try {
                        const { getCandleSubgraph } = await import('../config/subgraphEndpoints.js');
                        const query = `{ proposal(id: "${input}") { id marketName companyToken { symbol } } }`;
                        const response = await fetch(getCandleSubgraph(100), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ query })
                        });
                        const result = await response.json();
                        if (result.data?.proposal) {
                            const p = result.data.proposal;
                            filteredProposals = [{
                                id: p.id,
                                title: p.marketName || 'Untitled',
                                marketName: p.marketName || 'N/A',
                                question: p.marketName || 'N/A',
                                description: '',
                                companyId: 'N/A'
                            }];
                            console.log(chalk.green(`  ✅ Found via direct lookup!`));
                        }
                    } catch (e) {
                        console.log(chalk.red(`  Direct lookup failed: ${e.message}`));
                    }
                }
            } else {
                // Regular keyword search
                filteredProposals = proposals.filter(p =>
                    p.title?.toLowerCase().includes(input) ||
                    p.id?.toLowerCase().includes(input) ||
                    p.marketName?.toLowerCase().includes(input) ||
                    p.question?.toLowerCase().includes(input)
                );
            }
            console.log(chalk.dim(`  Filtered to ${filteredProposals.length} of ${proposals.length} proposals`));
        }

        if (filteredProposals.length === 0) {
            console.log(chalk.yellow('No proposals match your filter.'));
            return;
        }

        const { selectedLink } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedLink',
                message: 'Select a Proposal to Link:',
                choices: [
                    ...filteredProposals.map(p => ({
                        name: `${p.title} (${p.id.slice(0, 10)}...)`,
                        value: p
                    })),
                    { name: '🔙 Cancel', value: null }
                ]
            }
        ]);

        if (!selectedLink) return;

        // Auto-fill details from selection
        await this.addProposalFlow(org, selectedLink);
    }

    async listProposals(org) {
        const spinner = ora(`Fetching proposals for ${org.name}...`).start();
        let proposals = [];
        try {
            for await (const update of this.dataLayer.execute('futarchy.getProposals', { organizationAddress: org.address })) {
                if (update.status === 'success') {
                    proposals = update.data;
                }
            }
            spinner.succeed(`Found ${proposals.length} proposals`);
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
            return;
        }

        if (proposals.length === 0) {
            console.log(chalk.gray('No proposals found.'));
            return;
        }

        // Check for duplicates - multiple metadata pointing to same proposalAddress
        const proposalCounts = {};
        proposals.forEach(p => {
            if (p.proposalAddress) {
                proposalCounts[p.proposalAddress] = (proposalCounts[p.proposalAddress] || 0) + 1;
            }
        });
        const duplicates = Object.entries(proposalCounts).filter(([_, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log(chalk.yellow.bold('\n⚠️  DUPLICATE METADATA DETECTED:'));
            duplicates.forEach(([propAddr, count]) => {
                console.log(chalk.yellow(`   ${propAddr.slice(0, 12)}... has ${count} metadata contracts`));
            });
            console.log(chalk.dim('   Each proposal should only have one metadata contract.\n'));
        }

        // Display proposals: metadataAddress(proposalAddress)
        const { selectedProp } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedProp',
                message: 'Select a Proposal:',
                choices: [
                    ...proposals.map(p => {
                        const label = `${p.metadataAddress}(${p.proposalAddress || 'N/A'})`;
                        return { name: label, value: p.metadataAddress };
                    }),
                    { name: '🔙 Back', value: null }
                ]
            }
        ]);

        if (selectedProp) {
            // Fetch Details
            try {
                const spinner = ora(`Loading details for ${selectedProp}...`).start();
                let details = null;
                for await (const update of this.dataLayer.execute('futarchy.getProposalDetails', { proposalAddress: selectedProp })) {
                    if (update.status === 'success') {
                        details = update.data;
                        spinner.succeed('Details loaded');
                    } else if (update.status === 'error') {
                        spinner.fail(chalk.red(update.message));
                    }
                }
                // spinner.stop(); // Handled by succeed/fail above

                if (details) {
                    // Read metadata from contract for coingecko_ticker (subgraph may be stale)
                    let spotTickerInfo = chalk.yellow('⚠ not configured');
                    try {
                        const client = createPublicClient({
                            chain: details.chain.id === 1 ? mainnet : gnosis,
                            transport: http(details.chain.id === 1 ? 'https://eth.llamarpc.com' : 'https://rpc.gnosischain.com')
                        });
                        const rawMeta = await client.readContract({
                            address: selectedProp,
                            abi: CONTRACT_ABIS.PROPOSAL,
                            functionName: 'metadata'
                        });
                        const parsedMeta = JSON.parse(rawMeta || '{}');
                        details.parsedMetadata = parsedMeta; // Store for later use in export
                        if (parsedMeta?.coingecko_ticker) {
                            const ticker = parsedMeta.coingecko_ticker;
                            spotTickerInfo = chalk.green('✓ ') + chalk.dim(ticker.slice(0, 50) + (ticker.length > 50 ? '...' : ''));
                        }
                    } catch { }

                    // Build pool summary
                    const poolSummary = [];
                    if (details.pools?.conditional?.yes) poolSummary.push('COND_YES');
                    if (details.pools?.conditional?.no) poolSummary.push('COND_NO');
                    if (details.pools?.prediction?.yes) poolSummary.push('PRED_YES');
                    if (details.pools?.prediction?.no) poolSummary.push('PRED_NO');
                    if (details.pools?.expectedValue?.yes) poolSummary.push('EV_YES');
                    if (details.pools?.expectedValue?.no) poolSummary.push('EV_NO');

                    console.log(boxen(
                        chalk.bold(`Name: ${details.question || ''} ${details.marketName || 'N/A'}\n`) +
                        chalk.cyan(`Proposal ID: ${details.address || 'N/A'}\n`) +
                        chalk.dim(`Metadata Contract: ${selectedProp}\n`) +
                        chalk.gray(`Description: ${details.description || 'N/A'}\n`) +
                        `----------------------------------------\n` +
                        chalk.yellow(`Chain ID: ${details.chain.id} (${details.chain.source})\n`) +
                        chalk.magenta(`SPOT Ticker: `) + spotTickerInfo + '\n' +
                        chalk.dim(`Owner: ${details.owner}\n`) +
                        chalk.dim(`Metadata URI: ${details.metadataURI}\n`) +
                        (details.extra?.resolutionInfo ? chalk.green(`ℹ ${details.extra.resolutionInfo}\n`) : '') +
                        `----------------------------------------\n` +
                        chalk.bold(`Base Tokens:\n`) +
                        chalk.white(`  Company:  ${details.baseTokens?.company?.symbol || 'N/A'}\n`) +
                        chalk.dim(`            ${details.baseTokens?.company?.address || 'N/A'}\n`) +
                        chalk.white(`  Currency: ${details.baseTokens?.currency?.symbol || 'N/A'}\n`) +
                        chalk.dim(`            ${details.baseTokens?.currency?.address || 'N/A'}\n`) +
                        `----------------------------------------\n` +
                        chalk.bold(`Outcome Tokens (by Role):\n`) +
                        chalk.green(`  YES_COMPANY:  ${details.outcomeTokens?.YES_COMPANY?.symbol || 'N/A'}\n`) +
                        chalk.dim(`                ${details.outcomeTokens?.YES_COMPANY?.address || 'N/A'}\n`) +
                        chalk.red(`  NO_COMPANY:   ${details.outcomeTokens?.NO_COMPANY?.symbol || 'N/A'}\n`) +
                        chalk.dim(`                ${details.outcomeTokens?.NO_COMPANY?.address || 'N/A'}\n`) +
                        chalk.green(`  YES_CURRENCY: ${details.outcomeTokens?.YES_CURRENCY?.symbol || 'N/A'}\n`) +
                        chalk.dim(`                ${details.outcomeTokens?.YES_CURRENCY?.address || 'N/A'}\n`) +
                        chalk.red(`  NO_CURRENCY:  ${details.outcomeTokens?.NO_CURRENCY?.symbol || 'N/A'}\n`) +
                        chalk.dim(`                ${details.outcomeTokens?.NO_CURRENCY?.address || 'N/A'}\n`) +
                        `----------------------------------------\n` +
                        chalk.bold(`Pools (${details.poolCount || 0} total):\n`) +
                        chalk.magenta(`  ${poolSummary.join(', ') || 'None'}\n`) +
                        (details.pools?.conditional?.yes ? chalk.white(`  COND_YES: ${details.pools.conditional.yes.address}\n`) : '') +
                        (details.pools?.conditional?.no ? chalk.white(`  COND_NO:  ${details.pools.conditional.no.address}\n`) : '') +
                        (details.pools?.prediction?.yes ? chalk.white(`  PRED_YES: ${details.pools.prediction.yes.address}\n`) : '') +
                        (details.pools?.prediction?.no ? chalk.white(`  PRED_NO:  ${details.pools.prediction.no.address}\n`) : '') +
                        (details.pools?.expectedValue?.yes ? chalk.white(`  EV_YES:   ${details.pools.expectedValue.yes.address}\n`) : '') +
                        (details.pools?.expectedValue?.no ? chalk.white(`  EV_NO:    ${details.pools.expectedValue.no.address}\n`) : ''),
                        { padding: 1, borderStyle: 'round', title: 'Proposal Details' }
                    ));

                    if (details.parsedMetadata) {
                        console.log(chalk.dim('Metadata JSON parsed successfully.'));
                    }

                    // Action menu for proposal
                    await this.proposalActionsMenu(selectedProp, details);
                }
            } catch (e) {
                console.error(chalk.red(`Failed to load details: ${e.message}`));
            }
        }
    }

    async proposalActionsMenu(proposalAddress, details) {
        const chainId = details?.chain?.id || 100;
        // Use the TRADING CONTRACT address for candle/swap queries, not metadata address
        const tradingContractId = details?.address || proposalAddress;
        const yesPoolId = details?.pools?.conditional?.yes?.address;
        const noPoolId = details?.pools?.conditional?.no?.address;
        const hasConditionalPools = yesPoolId || noPoolId;

        while (true) {
            const choices = [
                { name: '🔙 Back', value: 'back' }
            ];

            if (hasConditionalPools) {
                choices.unshift(
                    { name: '📊 Export Candles & Trades', value: 'export_all' },
                    { name: '🕯️ Export Candles Only', value: 'export_candles' },
                    { name: '💱 Export Trades Only', value: 'export_trades' }
                );
            }

            // Always add these options
            choices.unshift({ name: '💰 View Position', value: 'view_position' });
            choices.unshift({ name: '📈 View Pool Prices', value: 'view_prices' });
            choices.unshift({ name: '✏️ Edit Proposal Info', value: 'edit_proposal_info' });
            choices.unshift({ name: '📝 Edit Extended Metadata', value: 'edit_metadata' });

            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Proposal Actions:',
                    choices
                }
            ]);

            if (action === 'back') return;

            if (action === 'edit_metadata') {
                await this.editMetadataFlow(tradingContractId, details, proposalAddress);
            } else if (action === 'edit_proposal_info') {
                await this.editProposalInfoFlow(proposalAddress, details);
            } else if (action === 'view_position') {
                await this.viewPositionFlow(tradingContractId, details);
            } else if (action === 'view_prices') {
                await this.viewPoolPricesFlow(tradingContractId, chainId, details, proposalAddress);
            } else if (action === 'export_all' || action === 'export_candles' || action === 'export_trades') {
                // Use tradingContractId (0x45e...) NOT metadataAddress (0xA78...)
                await this.exportChartDataFlow(tradingContractId, chainId, action, yesPoolId, noPoolId, details);
            }
        }
    }

    async exportChartDataFlow(proposalAddress, chainId, exportType, yesPoolId, noPoolId, details = {}) {
        // Get export options from user
        const now = Math.floor(Date.now() / 1000);
        const oneWeekAgo = now - (7 * 24 * 60 * 60);

        // Check if SPOT config is available in metadata
        let spotConfig = null;
        try {
            // Try parsedMetadata first, then parse from string
            let parsedMeta = details?.parsedMetadata;
            if (!parsedMeta && details?.metadata) {
                parsedMeta = JSON.parse(details.metadata);
            }
            spotConfig = parsedMeta?.coingecko_ticker || parsedMeta?.spot_config;
            console.log(chalk.dim(`[DEBUG] Export: parsedMeta = ${JSON.stringify(parsedMeta)}`));
            console.log(chalk.dim(`[DEBUG] Export: spotConfig = ${spotConfig ? 'found' : 'null'}`));
        } catch (e) {
            console.log(chalk.dim(`[DEBUG] Export: metadata parse error: ${e.message}`));
        }

        const { startTimeStr, candleLimit, tradeLimit, gapFill, includeSpot, outputFile } = await inquirer.prompt([
            {
                type: 'input',
                name: 'startTimeStr',
                message: 'Start time (unix timestamp or leave empty for all):',
                default: String(oneWeekAgo)
            },
            {
                type: 'input',
                name: 'candleLimit',
                message: 'Max candles to fetch:',
                default: '500',
                when: () => exportType !== 'export_trades'
            },
            {
                type: 'input',
                name: 'tradeLimit',
                message: 'Max trades to fetch:',
                default: '100',
                when: () => exportType !== 'export_candles'
            },
            {
                type: 'confirm',
                name: 'gapFill',
                message: 'Gap-fill missing candles?',
                default: true,
                when: () => exportType !== 'export_trades'
            },
            {
                type: 'confirm',
                name: 'includeSpot',
                message: spotConfig ? '📊 Include SPOT price? (from GeckoTerminal)' : '⚠️ Include SPOT price? (no coingecko_ticker configured)',
                default: !!spotConfig,
                when: () => exportType !== 'export_trades'
            },
            {
                type: 'input',
                name: 'outputFile',
                message: 'Output filename:',
                default: `export_${proposalAddress.slice(0, 8)}_${Date.now()}.json`
            }
        ]);

        const startTime = startTimeStr ? parseInt(startTimeStr, 10) : null;
        const spinner = ora('Fetching data from subgraph...').start();

        try {
            let result = {};

            if (exportType === 'export_all') {
                result = await exportChartData(chainId, proposalAddress, {
                    candleLimit: parseInt(candleLimit, 10),
                    tradeLimit: parseInt(tradeLimit, 10),
                    startTime,
                    gapFill
                });
            } else if (exportType === 'export_candles') {
                const candleResult = await fetchCandles(chainId, proposalAddress, parseInt(candleLimit, 10), startTime);
                let { yesData, noData, yesPool, noPool } = candleResult;

                // Apply gap-fill and sync if requested
                if (gapFill && yesData && noData) {
                    yesData = gapFillCandles(yesData);
                    noData = gapFillCandles(noData);

                    // Sync to common time range (start AND end)
                    if (yesData.length > 0 && noData.length > 0) {
                        const syncStart = Math.max(yesData[0].time, noData[0].time);
                        const syncEnd = Math.min(yesData[yesData.length - 1].time, noData[noData.length - 1].time);

                        yesData = yesData.filter(c => c.time >= syncStart && c.time <= syncEnd);
                        noData = noData.filter(c => c.time >= syncStart && c.time <= syncEnd);

                        console.log(chalk.dim(`[Sync] YES=${yesData.length}, NO=${noData.length} candles`));
                    }
                }

                result = {
                    success: !candleResult.error,
                    proposal: proposalAddress,
                    chainId,
                    exportedAt: new Date().toISOString(),
                    options: { candleLimit: parseInt(candleLimit, 10), startTime, gapFill },
                    pools: { yes: yesPool, no: noPool },
                    candles: { yes: yesData, no: noData },
                    error: candleResult.error
                };
            } else if (exportType === 'export_trades') {
                const poolAddresses = [yesPoolId, noPoolId].filter(Boolean);
                const tradeResult = await fetchTrades(chainId, poolAddresses, parseInt(tradeLimit, 10), startTime);
                result = {
                    success: !tradeResult.error,
                    proposal: proposalAddress,
                    chainId,
                    exportedAt: new Date().toISOString(),
                    trades: tradeResult.trades,
                    error: tradeResult.error
                };
            }

            if (result.success === false || result.error) {
                spinner.fail(chalk.red(`Export failed: ${result.error}`));
                return;
            }

            // Fetch SPOT if requested
            if (includeSpot && spotConfig && result.candles) {
                spinner.text = 'Fetching SPOT price from GeckoTerminal...';
                const { spotData, spotPrice, error: spotError } = await fetchSpotCandles(spotConfig);

                if (spotError) {
                    console.log(chalk.yellow(`  ⚠️ SPOT fetch failed: ${spotError}`));
                } else if (spotData.length > 0) {
                    // Align SPOT to YES/NO time range if we have candles
                    const yesStart = result.candles.yes?.[0]?.time;
                    const yesEnd = result.candles.yes?.[result.candles.yes.length - 1]?.time;

                    if (yesStart && yesEnd) {
                        // Filter SPOT to same time range
                        result.candles.spot = spotData.filter(c => c.time >= yesStart && c.time <= yesEnd);
                    } else {
                        result.candles.spot = spotData;
                    }

                    result.spotConfig = spotConfig;
                    result.spotPrice = spotPrice;
                }
            }

            // Write to file
            fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
            spinner.succeed(chalk.green(`Exported to ${outputFile}`));

            // Summary
            const candleCount = (result.candles?.yes?.length || 0) + (result.candles?.no?.length || 0);
            const spotCount = result.candles?.spot?.length || 0;
            const tradeCount = result.trades?.length || 0;
            console.log(chalk.cyan(`  📊 Candles: ${candleCount} (YES: ${result.candles?.yes?.length || 0}, NO: ${result.candles?.no?.length || 0})`));
            if (spotCount > 0) {
                console.log(chalk.yellow(`  🔶 SPOT: ${spotCount} candles`));
            }
            console.log(chalk.cyan(`  💱 Trades: ${tradeCount}`));

            if (tradeCount > 0) {
                const yesTrades = result.trades.filter(t => t.outcomeSide === 'YES').length;
                const noTrades = result.trades.filter(t => t.outcomeSide === 'NO').length;
                console.log(chalk.dim(`     YES trades: ${yesTrades}, NO trades: ${noTrades}`));
            }

        } catch (e) {
            spinner.fail(chalk.red(`Export error: ${e.message}`));
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    }

    async addProposalFlow(preSelectedOrg = null, preFilledData = null) {
        let org = preSelectedOrg;

        // If no org selected, ask to select one
        if (!org) {
            console.log(chalk.yellow("Please use 'Manage Organizations' to select an org first."));
            return;
        }

        // Extract a SHORT market name from the full question (first part before 'be approved' or '?')
        const extractShortName = (fullText) => {
            if (!fullText) return '';
            // Try to extract "GIP-XXX" or "KIP-XXX" pattern
            const gipMatch = fullText.match(/(GIP-\d+|KIP-\d+)/i);
            if (gipMatch) return gipMatch[1];
            // Otherwise truncate at 50 chars
            return fullText.slice(0, 50) + (fullText.length > 50 ? '...' : '');
        };

        // Pre-fill logic with smarter defaults
        const defaults = preFilledData ? {
            proposalAddress: preFilledData.id,
            displayNameQuestion: preFilledData.marketName || preFilledData.question || '',
            displayNameEvent: extractShortName(preFilledData.marketName || preFilledData.title),
            description: '' // Leave blank by default, user can fill
        } : {
            proposalAddress: '0x...',
            displayNameQuestion: '',
            displayNameEvent: '',
            description: ''
        };

        console.log(chalk.cyan('\n📝 Add Proposal Metadata'));
        console.log(chalk.dim('This links an existing proposal to the organization with display info.\n'));

        const answers = await inquirer.prompt([
            { type: 'input', name: 'proposalAddress', message: 'proposalAddress:', default: defaults.proposalAddress },
            { type: 'input', name: 'displayNameQuestion', message: 'displayNameQuestion:', default: defaults.displayNameQuestion },
            { type: 'input', name: 'displayNameEvent', message: 'displayNameEvent:', default: defaults.displayNameEvent },
            { type: 'input', name: 'description', message: 'description:', default: defaults.description },
            { type: 'input', name: 'metadataURI', message: 'metadataURI:', default: '' }
        ]);

        // Interactive metadata JSON builder
        console.log(chalk.dim('\n📦 Build metadata JSON (key-value pairs). Leave key empty to finish.\n'));
        const metadataObj = {};
        let addingKeys = true;
        while (addingKeys) {
            const { key } = await inquirer.prompt([
                { type: 'input', name: 'key', message: 'Key (empty to finish):' }
            ]);
            if (!key.trim()) {
                addingKeys = false;
            } else {
                const { value } = await inquirer.prompt([
                    { type: 'input', name: 'value', message: `Value for "${key}":` }
                ]);
                metadataObj[key.trim()] = value;
                console.log(chalk.green(`  + ${key}: ${value}`));
            }
        }
        answers.metadata = Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : '';

        // Show summary before confirmation
        console.log(boxen(
            chalk.bold.cyan('📄 Metadata Summary\n\n') +
            `${chalk.white('Organization:')}         ${org.name || org.address.slice(0, 12) + '...'}\n` +
            `${chalk.white('proposalAddress:')}      ${answers.proposalAddress}\n` +
            `${chalk.white('displayNameQuestion:')}  ${answers.displayNameQuestion}\n` +
            `${chalk.white('displayNameEvent:')}     ${answers.displayNameEvent}\n` +
            `${chalk.white('description:')}          ${answers.description || '(empty)'}\n` +
            `${chalk.white('metadata:')}             ${answers.metadata || '(empty)'}\n` +
            `${chalk.white('metadataURI:')}          ${answers.metadataURI || '(empty)'}`,
            { padding: 1, borderStyle: 'round', borderColor: 'cyan' }
        ));

        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: 'Create Metadata Contract?', default: true }
        ]);

        if (!confirm) return;

        const spinner = ora('Saving proposal metadata...').start();
        try {
            const iter = this.dataLayer.execute('futarchy.addProposal', {
                organizationAddress: org.address,
                proposalAddress: answers.proposalAddress,
                displayNameQuestion: answers.displayNameQuestion,
                displayNameEvent: answers.displayNameEvent,
                description: answers.description,
                metadata: answers.metadata,
                metadataURI: answers.metadataURI
            });

            for await (const update of iter) {
                if (update.status === 'success') {
                    spinner.succeed(`Metadata created! Hash: ${update.data.hash}`);
                    if (update.data.metadataContract) {
                        console.log(chalk.green(`📄 Metadata Contract: ${update.data.metadataContract}`));
                    }
                    console.log(chalk.dim(`   Block: ${update.data.blockNumber}`));
                } else if (update.status === 'error') {
                    spinner.fail(`Error: ${update.message}`);
                } else {
                    spinner.text = update.message;
                }
            }
        } catch (e) {
            spinner.fail(`Critical Error: ${e.message}`);
        }
    }

    /**
     * Edit Extended Metadata Flow - Update metadata/metadataURI on a ProposalMetadata contract
     */
    async editMetadataFlow(proposalAddress, details, metadataAddress) {
        console.log(chalk.cyan('\n✏️ Edit Extended Metadata (Proposal)'));
        console.log(chalk.dim('Update the metadata JSON field on the existing ProposalMetadata contract.\n'));

        // The metadataAddress is the ProposalMetadata contract we need to update
        if (!metadataAddress) {
            metadataAddress = details.metadataAddress || details.resolvedFrom;
        }
        if (!metadataAddress) {
            console.log(chalk.red('Error: Could not find ProposalMetadata contract address.'));
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        // Fetch current metadata from contract
        const spinner = ora('Fetching current metadata from contract...').start();
        let currentMetadata = '';
        let currentMetadataURI = '';

        try {
            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            currentMetadata = await client.readContract({
                address: metadataAddress,
                abi: CONTRACT_ABIS.PROPOSAL,
                functionName: 'metadata'
            });

            currentMetadataURI = await client.readContract({
                address: metadataAddress,
                abi: CONTRACT_ABIS.PROPOSAL,
                functionName: 'metadataURI'
            });

            spinner.succeed('Current metadata fetched.');
        } catch (e) {
            spinner.fail(`Failed to fetch: ${e.message}`);
        }

        console.log(chalk.yellow('\nCurrent Values:'));
        console.log(`  metadata:    ${chalk.white(currentMetadata || '(empty)')}`);
        console.log(`  metadataURI: ${chalk.white(currentMetadataURI || '(empty)')}`);
        console.log('');

        const { editChoice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'editChoice',
                message: 'What would you like to do?',
                choices: [
                    { name: '✏️ Edit Metadata JSON', value: 'edit_metadata' },
                    { name: '🔗 Edit Metadata URI', value: 'edit_uri' },
                    { name: '🔍 View Raw Metadata JSON', value: 'view_raw' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);

        if (editChoice === 'back') return;

        if (editChoice === 'view_raw') {
            console.log(chalk.cyan('\nRaw Metadata:'));
            try {
                console.log(JSON.stringify(JSON.parse(currentMetadata), null, 2));
            } catch {
                console.log(currentMetadata || '(empty)');
            }
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        let newMetadata = currentMetadata;
        let newMetadataURI = currentMetadataURI;

        if (editChoice === 'edit_metadata') {
            // Parse existing metadata
            let metadataObj = {};
            try {
                metadataObj = JSON.parse(currentMetadata) || {};
            } catch { }

            // Show existing keys
            const existingKeys = Object.keys(metadataObj);
            if (existingKeys.length > 0) {
                console.log(chalk.yellow('\nExisting keys:'));
                existingKeys.forEach(k => console.log(`  ${chalk.white(k)}: ${chalk.dim(metadataObj[k])}`));
            }

            console.log(chalk.dim('\n📦 Edit metadata (key-value). Leave key empty to finish.\n'));

            let editing = true;
            while (editing) {
                const { key } = await inquirer.prompt([
                    { type: 'input', name: 'key', message: 'Key (empty to finish):' }
                ]);
                if (!key.trim()) {
                    editing = false;
                } else {
                    const existingValue = metadataObj[key.trim()] || '';
                    const { value } = await inquirer.prompt([
                        { type: 'input', name: 'value', message: `Value for "${key}":`, default: existingValue }
                    ]);
                    metadataObj[key.trim()] = value;
                    console.log(chalk.green(`  ✓ ${key}: ${value}`));
                }
            }
            newMetadata = JSON.stringify(metadataObj);
            console.log(chalk.cyan('\nNew metadata: ') + newMetadata);
        } else if (editChoice === 'edit_uri') {
            const { metadataURI } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'metadataURI',
                    message: 'New Metadata URI:',
                    default: currentMetadataURI
                }
            ]);
            newMetadataURI = metadataURI;
        }

        // Confirm
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Submit transaction to update metadata on ${metadataAddress.slice(0, 10)}...?`,
                default: true
            }
        ]);

        if (!confirm) return;

        const updateSpinner = ora('Updating extended metadata...').start();

        try {
            for await (const update of this.dataLayer.execute('futarchy.updateProposalExtendedMetadata', {
                proposalMetadataAddress: metadataAddress,
                metadata: newMetadata,
                metadataURI: newMetadataURI
            })) {
                if (update.status === 'success') {
                    updateSpinner.succeed(update.message);
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    updateSpinner.fail(update.message);
                } else {
                    updateSpinner.text = update.message;
                }
            }
        } catch (e) {
            updateSpinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * View Position Flow - Show user's token balances and calculated positions
     */
    async viewPositionFlow(proposalAddress, details) {
        console.log(chalk.cyan('\n💰 View Position\n'));

        // Get chain config
        const chainId = details?.chain?.id || 100;
        const chainConfig = CHAIN_CONFIG[chainId];
        const viemChain = chainId === 1 ? mainnet : gnosis;

        // Prompt for wallet address (default to connected wallet)
        const defaultWallet = this.connectedWallet || '';
        const { walletAddress } = await inquirer.prompt([
            {
                type: 'input',
                name: 'walletAddress',
                message: 'Wallet address to check:',
                default: defaultWallet,
                validate: (v) => /^0x[a-fA-F0-9]{40}$/.test(v) || 'Invalid Ethereum address'
            }
        ]);

        // Get outcome token addresses
        const tokens = {
            YES_COMPANY: details.outcomeTokens?.YES_COMPANY,
            NO_COMPANY: details.outcomeTokens?.NO_COMPANY,
            YES_CURRENCY: details.outcomeTokens?.YES_CURRENCY,
            NO_CURRENCY: details.outcomeTokens?.NO_CURRENCY
        };

        // Check if we have all tokens
        const missingTokens = Object.entries(tokens).filter(([_, t]) => !t?.address);
        if (missingTokens.length > 0) {
            console.log(chalk.red(`Missing token addresses: ${missingTokens.map(([k]) => k).join(', ')} `));
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        const spinner = ora('Fetching token balances...').start();

        try {
            // Create viem public client
            const publicClient = createPublicClient({
                chain: viemChain,
                transport: http(chainConfig.rpcUrl)
            });

            // Fetch all balances in parallel (outcome + base tokens)
            const [yesCompanyBal, noCompanyBal, yesCurrencyBal, noCurrencyBal, baseCurrencyBal, baseCompanyBal] = await Promise.all([
                publicClient.readContract({
                    address: tokens.YES_COMPANY.address,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'balanceOf',
                    args: [walletAddress]
                }),
                publicClient.readContract({
                    address: tokens.NO_COMPANY.address,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'balanceOf',
                    args: [walletAddress]
                }),
                publicClient.readContract({
                    address: tokens.YES_CURRENCY.address,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'balanceOf',
                    args: [walletAddress]
                }),
                publicClient.readContract({
                    address: tokens.NO_CURRENCY.address,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'balanceOf',
                    args: [walletAddress]
                }),
                publicClient.readContract({
                    address: details.baseTokens.currency.address,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'balanceOf',
                    args: [walletAddress]
                }),
                publicClient.readContract({
                    address: details.baseTokens.company.address,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'balanceOf',
                    args: [walletAddress]
                })
            ]);

            spinner.succeed('Balances fetched');

            // Format balances (assuming 18 decimals for outcome tokens)
            const decimals = 18;
            const balances = {
                YES_COMPANY: parseFloat(formatUnits(yesCompanyBal, decimals)),
                NO_COMPANY: parseFloat(formatUnits(noCompanyBal, decimals)),
                YES_CURRENCY: parseFloat(formatUnits(yesCurrencyBal, decimals)),
                NO_CURRENCY: parseFloat(formatUnits(noCurrencyBal, decimals)),
                BASE_CURRENCY: parseFloat(formatUnits(baseCurrencyBal, decimals)),
                BASE_COMPANY: parseFloat(formatUnits(baseCompanyBal, decimals))
            };

            // Calculate positions
            const companyMin = Math.min(balances.YES_COMPANY, balances.NO_COMPANY);
            const companyMax = Math.max(balances.YES_COMPANY, balances.NO_COMPANY);
            const companyPosition = companyMax - companyMin;
            const companyDirection = balances.YES_COMPANY > balances.NO_COMPANY ? 'YES' : 'NO';

            const currencyMin = Math.min(balances.YES_CURRENCY, balances.NO_CURRENCY);
            const currencyMax = Math.max(balances.YES_CURRENCY, balances.NO_CURRENCY);
            const currencyPosition = currencyMax - currencyMin;
            const currencyDirection = balances.YES_CURRENCY > balances.NO_CURRENCY ? 'YES' : 'NO';

            // Build display
            const formatBal = (n) => n.toFixed(4);
            const shortAddr = walletAddress.slice(0, 10) + '...';

            const positionBox =
                chalk.bold.cyan('💵 Wallet (Splittable):\n') +
                chalk.white(`  ${details.baseTokens.currency.symbol}:  ${formatBal(balances.BASE_CURRENCY)} \n`) +
                chalk.white(`  ${details.baseTokens.company.symbol}:  ${formatBal(balances.BASE_COMPANY)} \n`) +
                `----------------------------------------\n` +
                chalk.bold.cyan('📦 Outcome Tokens:\n') +
                chalk.green(`  YES_COMPANY(${tokens.YES_COMPANY.symbol}):   ${formatBal(balances.YES_COMPANY)} \n`) +
                chalk.red(`  NO_COMPANY(${tokens.NO_COMPANY.symbol}):    ${formatBal(balances.NO_COMPANY)} \n`) +
                chalk.green(`  YES_CURRENCY(${tokens.YES_CURRENCY.symbol}): ${formatBal(balances.YES_CURRENCY)} \n`) +
                chalk.red(`  NO_CURRENCY(${tokens.NO_CURRENCY.symbol}):  ${formatBal(balances.NO_CURRENCY)} \n`) +
                `----------------------------------------\n` +
                chalk.bold.cyan('📊 Net Position:\n') +
                (companyPosition > 0
                    ? chalk.white(`  Company:  ${formatBal(companyPosition)} ${companyDirection === 'YES' ? tokens.YES_COMPANY.symbol : tokens.NO_COMPANY.symbol} (${companyDirection === 'YES' ? chalk.green('bullish') : chalk.red('bearish')}) \n`)
                    : chalk.dim(`  Company:  No position\n`)) +
                (currencyPosition > 0
                    ? chalk.white(`  Currency: ${formatBal(currencyPosition)} ${currencyDirection === 'YES' ? tokens.YES_CURRENCY.symbol : tokens.NO_CURRENCY.symbol} (${currencyDirection === 'YES' ? chalk.green('bullish') : chalk.red('bearish')}) \n`)
                    : chalk.dim(`  Currency: No position\n`)) +
                `----------------------------------------\n` +
                chalk.bold.cyan('🔄 Mergeable Tokens (redeemable):\n') +
                (companyMin > 0
                    ? chalk.yellow(`  Company:  ${formatBal(companyMin)} pairs(${tokens.YES_COMPANY.symbol} + ${tokens.NO_COMPANY.symbol}) \n`)
                    : chalk.dim(`  Company: None\n`)) +
                (currencyMin > 0
                    ? chalk.yellow(`  Currency: ${formatBal(currencyMin)} pairs(${tokens.YES_CURRENCY.symbol} + ${tokens.NO_CURRENCY.symbol}) \n`)
                    : chalk.dim(`  Currency: None\n`));

            console.log(boxen(positionBox, {
                padding: 1,
                borderStyle: 'round',
                title: `💰 Position for ${shortAddr}`,
                borderColor: 'cyan'
            }));

            // Offer to trade
            const { nextAction } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'nextAction',
                    message: 'What would you like to do?',
                    choices: [
                        { name: '🔄 Trade', value: 'trade' },
                        { name: '➕ Split Collateral (base → YES+NO)', value: 'split' },
                        { name: '➖ Merge Collateral (YES+NO → base)', value: 'merge' },
                        { name: '🔙 Back', value: 'back' }
                    ]
                }
            ]);

            if (nextAction === 'trade') {
                await this.tradeFlow(proposalAddress, details, tokens, balances, walletAddress, chainId);
            } else if (nextAction === 'split') {
                await this.splitFlow(proposalAddress, details, walletAddress, chainId);
            } else if (nextAction === 'merge') {
                await this.mergeFlow(proposalAddress, details, tokens, balances, walletAddress, chainId, { companyMin, currencyMin });
            }

        } catch (e) {
            spinner.fail(chalk.red(`Error fetching balances: ${e.message} `));
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
        }
    }

    /**
     * Trade Flow - Execute swaps on Algebra/Swapr
     */
    async tradeFlow(proposalAddress, details, tokens, balances, walletAddress, chainId) {
        console.log(chalk.cyan('\n🔄 Trade\n'));

        // Check if we have a wallet client
        if (!this.executor?.walletClient) {
            console.log(chalk.red('❌ No wallet connected. Please set PRIVATE_KEY in .env'));
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        const chainConfig = CHAIN_CONFIG[chainId];
        const viemChain = chainId === 1 ? mainnet : gnosis;

        // Build trade choices based on balances
        const tradeChoices = [
            { name: `📈 Buy YES_COMPANY(${tokens.YES_COMPANY.symbol})`, value: { action: 'buy', type: 'company', direction: 'yes' } },
            { name: `📉 Buy NO_COMPANY(${tokens.NO_COMPANY.symbol})`, value: { action: 'buy', type: 'company', direction: 'no' } },
            { name: `📈 Buy YES_CURRENCY(${tokens.YES_CURRENCY.symbol})`, value: { action: 'buy', type: 'currency', direction: 'yes' } },
            { name: `📉 Buy NO_CURRENCY(${tokens.NO_CURRENCY.symbol})`, value: { action: 'buy', type: 'currency', direction: 'no' } },
        ];

        // Add sell options if user has balances
        if (balances.YES_COMPANY > 0) {
            tradeChoices.push({ name: `💰 Sell YES_COMPANY(${balances.YES_COMPANY.toFixed(4)} ${tokens.YES_COMPANY.symbol})`, value: { action: 'sell', type: 'company', direction: 'yes' } });
        }
        if (balances.NO_COMPANY > 0) {
            tradeChoices.push({ name: `💰 Sell NO_COMPANY(${balances.NO_COMPANY.toFixed(4)} ${tokens.NO_COMPANY.symbol})`, value: { action: 'sell', type: 'company', direction: 'no' } });
        }
        if (balances.YES_CURRENCY > 0) {
            tradeChoices.push({ name: `💰 Sell YES_CURRENCY(${balances.YES_CURRENCY.toFixed(4)} ${tokens.YES_CURRENCY.symbol})`, value: { action: 'sell', type: 'currency', direction: 'yes' } });
        }
        if (balances.NO_CURRENCY > 0) {
            tradeChoices.push({ name: `💰 Sell NO_CURRENCY(${balances.NO_CURRENCY.toFixed(4)} ${tokens.NO_CURRENCY.symbol})`, value: { action: 'sell', type: 'currency', direction: 'no' } });
        }

        tradeChoices.push({ name: '🔙 Cancel', value: null });

        const { trade } = await inquirer.prompt([
            {
                type: 'list',
                name: 'trade',
                message: 'Select trade:',
                choices: tradeChoices
            }
        ]);

        if (!trade) return;

        // Get base token balances for potential splitting
        const publicClient = createPublicClient({
            chain: viemChain,
            transport: http(chainConfig.rpcUrl)
        });

        const baseCompany = details.baseTokens?.company?.address;
        const baseCurrency = details.baseTokens?.currency?.address;

        // Fetch base token balances
        let baseCompanyBalance = 0n;
        let baseCurrencyBalance = 0n;

        console.log(chalk.dim(`[DEBUG] Fetching base balances...`));
        console.log(chalk.dim(`  Company: ${baseCompany} `));
        console.log(chalk.dim(`  Currency: ${baseCurrency} `));
        console.log(chalk.dim(`  Wallet: ${walletAddress} `));

        try {
            [baseCompanyBalance, baseCurrencyBalance] = await Promise.all([
                publicClient.readContract({
                    address: baseCompany,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'balanceOf',
                    args: [walletAddress]
                }),
                publicClient.readContract({
                    address: baseCurrency,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'balanceOf',
                    args: [walletAddress]
                })
            ]);
            console.log(chalk.dim(`  GNO: ${formatUnits(baseCompanyBalance, 18)}, sDAI: ${formatUnits(baseCurrencyBalance, 18)} `));
        } catch (e) {
            console.log(chalk.yellow(`Could not fetch base balances: ${e.message} `));
        }

        // Determine token addresses for CONDITIONAL POOLS:
        // Buy YES_COMPANY = spend YES_CURRENCY (COND_YES pool)
        // Buy NO_COMPANY = spend NO_CURRENCY (COND_NO pool)
        // Buy YES_CURRENCY = spend sDAI (PRED_YES pool) - direct
        // Buy NO_CURRENCY = spend sDAI (PRED_NO pool) - direct
        let tokenIn, tokenOut, tokenInSymbol, tokenOutSymbol;
        let availableBalance = 0;  // Float for display
        let availableBalanceWei = 0n;  // Wei for precise calculations
        let splittableBalance = 0;  // Float for display
        let splittableBalanceWei = 0n;  // Wei for precise calculations
        let needsSplit = false;
        let splitToken = null;
        let splitAmount = 0n;

        if (trade.action === 'buy') {
            if (trade.type === 'company') {
                // Buy YES/NO_COMPANY = spend YES/NO_CURRENCY (COND pools)
                if (trade.direction === 'yes') {
                    tokenIn = tokens.YES_CURRENCY.address;
                    tokenInSymbol = tokens.YES_CURRENCY.symbol;
                    tokenOut = tokens.YES_COMPANY.address;
                    tokenOutSymbol = tokens.YES_COMPANY.symbol;
                    availableBalance = balances.YES_CURRENCY;
                    splittableBalance = parseFloat(formatUnits(baseCurrencyBalance, 18));
                    splitToken = baseCurrency;
                } else {
                    tokenIn = tokens.NO_CURRENCY.address;
                    tokenInSymbol = tokens.NO_CURRENCY.symbol;
                    tokenOut = tokens.NO_COMPANY.address;
                    tokenOutSymbol = tokens.NO_COMPANY.symbol;
                    availableBalance = balances.NO_CURRENCY;
                    splittableBalance = parseFloat(formatUnits(baseCurrencyBalance, 18));
                    splitToken = baseCurrency;
                }
            } else {
                // Buy YES/NO_CURRENCY = spend base sDAI (PRED pools)
                tokenIn = baseCurrency;
                tokenInSymbol = details.baseTokens.currency.symbol;
                tokenOut = trade.direction === 'yes' ? tokens.YES_CURRENCY.address : tokens.NO_CURRENCY.address;
                tokenOutSymbol = trade.direction === 'yes' ? tokens.YES_CURRENCY.symbol : tokens.NO_CURRENCY.symbol;
                availableBalance = parseFloat(formatUnits(baseCurrencyBalance, 18));
                splittableBalance = 0; // Can't split further
            }
        } else {
            // Sell = swap outcome token for matching currency token (COND pools)
            if (trade.type === 'company') {
                // Sell YES/NO_COMPANY = get YES/NO_CURRENCY
                if (trade.direction === 'yes') {
                    tokenIn = tokens.YES_COMPANY.address;
                    tokenInSymbol = tokens.YES_COMPANY.symbol;
                    tokenOut = tokens.YES_CURRENCY.address;
                    tokenOutSymbol = tokens.YES_CURRENCY.symbol;
                    availableBalance = balances.YES_COMPANY;
                } else {
                    tokenIn = tokens.NO_COMPANY.address;
                    tokenInSymbol = tokens.NO_COMPANY.symbol;
                    tokenOut = tokens.NO_CURRENCY.address;
                    tokenOutSymbol = tokens.NO_CURRENCY.symbol;
                    availableBalance = balances.NO_COMPANY;
                }
            } else {
                // Sell YES/NO_CURRENCY = get base sDAI (PRED pools)
                tokenIn = trade.direction === 'yes' ? tokens.YES_CURRENCY.address : tokens.NO_CURRENCY.address;
                tokenInSymbol = trade.direction === 'yes' ? tokens.YES_CURRENCY.symbol : tokens.NO_CURRENCY.symbol;
                tokenOut = baseCurrency;
                tokenOutSymbol = details.baseTokens.currency.symbol;
                availableBalance = trade.direction === 'yes' ? balances.YES_CURRENCY : balances.NO_CURRENCY;
            }
        }

        // Show available balance info
        const totalAvailable = availableBalance + splittableBalance;
        let balanceInfo = `Available: ${availableBalance.toFixed(4)} ${tokenInSymbol} `;
        if (splittableBalance > 0) {
            balanceInfo += chalk.dim(` + ${splittableBalance.toFixed(4)} splittable from ${details.baseTokens.currency.symbol} `);
            balanceInfo += chalk.cyan(`\nTotal: ${totalAvailable.toFixed(4)} `);
        }
        console.log(boxen(balanceInfo, { padding: 1, borderStyle: 'single', borderColor: 'gray' }));

        // Get amount
        const { amount } = await inquirer.prompt([
            {
                type: 'input',
                name: 'amount',
                message: `Amount of ${tokenInSymbol} to ${trade.action === 'buy' ? 'spend' : 'sell'}: `,
                validate: (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0 || 'Enter a valid positive number'
            }
        ]);

        const amountIn = parseUnits(amount, 18);
        const amountFloat = parseFloat(amount);

        // Fetch actual available balance in wei for precise split calculation
        availableBalanceWei = await publicClient.readContract({
            address: tokenIn,
            abi: CONTRACT_ABIS.ERC20,
            functionName: 'balanceOf',
            args: [walletAddress]
        });

        // Check if we need to split (compare in wei for precision)
        if (amountIn > availableBalanceWei && splitToken) {
            // Calculate needed split in wei (precise)
            const neededSplitWei = amountIn - availableBalanceWei;
            const neededSplitFloat = parseFloat(formatUnits(neededSplitWei, 18));

            // Check if we have enough to split
            if (neededSplitWei > baseCurrencyBalance) {
                console.log(chalk.red(`❌ Insufficient balance.Need ${neededSplitFloat.toFixed(4)} more but only ${formatUnits(baseCurrencyBalance, 18)} available to split.`));
                await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
                return;
            }

            console.log(chalk.yellow(`\n⚡ Need to split ${neededSplitFloat.toFixed(4)} ${details.baseTokens.currency.symbol} first...`));

            const { confirmSplit } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmSplit',
                    message: `Split ${neededSplitFloat.toFixed(4)} ${details.baseTokens.currency.symbol} into YES / NO tokens ? `,
                    default: true
                }
            ]);

            if (!confirmSplit) {
                console.log(chalk.yellow('Trade cancelled'));
                return;
            }

            const splitSpinner = ora('Splitting tokens...').start();
            try {
                const account = this.executor.account;
                const walletClient = this.executor.walletClient;
                // Use neededSplitWei directly (precise BigInt calculation)
                const splitAmountWei = neededSplitWei;

                // Approve base token for FutarchyRouter
                splitSpinner.text = 'Approving for split...';
                const currentAllowance = await publicClient.readContract({
                    address: splitToken,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'allowance',
                    args: [walletAddress, TRADING_ADDRESSES.FUTARCHY_ROUTER]
                });

                if (currentAllowance < splitAmountWei) {
                    const approveHash = await walletClient.writeContract({
                        address: splitToken,
                        abi: CONTRACT_ABIS.ERC20,
                        functionName: 'approve',
                        args: [TRADING_ADDRESSES.FUTARCHY_ROUTER, splitAmountWei],
                        chain: viemChain,
                        account
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approveHash });
                }

                // Execute split
                splitSpinner.text = 'Executing split...';
                const splitHash = await walletClient.writeContract({
                    address: TRADING_ADDRESSES.FUTARCHY_ROUTER,
                    abi: CONTRACT_ABIS.FUTARCHY_ROUTER,
                    functionName: 'splitPosition',
                    args: [proposalAddress, splitToken, splitAmountWei],
                    chain: viemChain,
                    account
                });
                await publicClient.waitForTransactionReceipt({ hash: splitHash });
                splitSpinner.succeed(chalk.green(`Split complete! Now have ${neededSplitFloat.toFixed(4)} more ${tokenInSymbol} `));
            } catch (e) {
                splitSpinner.fail(chalk.red(`Split failed: ${e.message} `));
                await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
                return;
            }
        }

        // Fetch actual token balance and cap amountIn to prevent rounding errors (STF)
        const actualTokenBalance = await publicClient.readContract({
            address: tokenIn,
            abi: CONTRACT_ABIS.ERC20,
            functionName: 'balanceOf',
            args: [walletAddress]
        });

        // Cap amountIn to actual balance to prevent STF errors from rounding
        let amountInCapped = amountIn;
        if (amountIn > actualTokenBalance) {
            console.log(chalk.yellow(`⚠️  Adjusting amount from ${formatUnits(amountIn, 18)} to ${formatUnits(actualTokenBalance, 18)} (actual balance)`));
            amountInCapped = actualTokenBalance;
        }

        // Get quote
        const quoteSpinner = ora('Fetching quote...').start();
        try {
            // Call Algebra Quoter
            const amountOut = await publicClient.simulateContract({
                address: TRADING_ADDRESSES.ALGEBRA_QUOTER,
                abi: CONTRACT_ABIS.ALGEBRA_QUOTER,
                functionName: 'quoteExactInputSingle',
                args: [tokenIn, tokenOut, amountInCapped, 0n]
            });

            const expectedOut = amountOut.result;
            const slippageBps = 300n; // 3%
            const minAmountOut = expectedOut * (10000n - slippageBps) / 10000n;

            quoteSpinner.succeed('Quote received');

            const quoteBox =
                chalk.cyan(`Selling: ${formatUnits(amountInCapped, 18)} ${tokenInSymbol} \n`) +
                chalk.green(`Expected: ~${formatUnits(expectedOut, 18)} ${tokenOutSymbol} \n`) +
                chalk.yellow(`Min(3 % slip): ${formatUnits(minAmountOut, 18)} ${tokenOutSymbol} `);

            console.log(boxen(quoteBox, {
                padding: 1,
                borderStyle: 'round',
                title: '📊 Quote',
                borderColor: 'green'
            }));

            // Confirm
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Execute trade?',
                    default: false
                }
            ]);

            if (!confirm) {
                console.log(chalk.yellow('Trade cancelled'));
                return;
            }

            // Execute trade
            const tradeSpinner = ora('Executing trade...').start();

            // Setup wallet client
            const account = this.executor.account;
            const walletClient = this.executor.walletClient;

            // Step 1: Check & Approve
            tradeSpinner.text = 'Checking approval...';
            const currentAllowance = await publicClient.readContract({
                address: tokenIn,
                abi: CONTRACT_ABIS.ERC20,
                functionName: 'allowance',
                args: [walletAddress, TRADING_ADDRESSES.SWAPR_V3_ROUTER]
            });

            if (currentAllowance < amountInCapped) {
                tradeSpinner.text = 'Approving tokens...';
                const approveHash = await walletClient.writeContract({
                    address: tokenIn,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'approve',
                    args: [TRADING_ADDRESSES.SWAPR_V3_ROUTER, amountInCapped],
                    chain: viemChain,
                    account
                });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                tradeSpinner.text = 'Approved! Executing swap...';
            }

            // Step 2: Execute swap
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
            const swapParams = {
                tokenIn,
                tokenOut,
                recipient: walletAddress,
                deadline,
                amountIn: amountInCapped,
                amountOutMinimum: minAmountOut,
                limitSqrtPrice: 0n
            };

            const swapHash = await walletClient.writeContract({
                address: TRADING_ADDRESSES.SWAPR_V3_ROUTER,
                abi: CONTRACT_ABIS.SWAPR_V3_ROUTER,
                functionName: 'exactInputSingle',
                args: [swapParams],
                chain: viemChain,
                account
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });

            if (receipt.status === 'success') {
                tradeSpinner.succeed(chalk.green(`Trade executed! TX: ${swapHash} `));
                console.log(chalk.dim(`View on explorer: https://gnosisscan.io/tx/${swapHash}`));
            } else {
                tradeSpinner.fail(chalk.red('Trade failed'));
            }

        } catch (e) {
            quoteSpinner.fail(chalk.red(`Error: ${e.message}`));
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Split Flow - Split base tokens into YES+NO outcome tokens
     */
    async splitFlow(proposalAddress, details, walletAddress, chainId) {
        console.log(chalk.cyan('\n➕ Split Collateral\n'));

        if (!this.executor?.walletClient) {
            console.log(chalk.red('❌ No wallet connected. Please set PRIVATE_KEY in .env'));
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        const chainConfig = CHAIN_CONFIG[chainId];
        const viemChain = chainId === 1 ? mainnet : gnosis;

        // Select token type
        const { tokenType } = await inquirer.prompt([
            {
                type: 'list',
                name: 'tokenType',
                message: 'Which collateral to split?',
                choices: [
                    { name: `${details.baseTokens.currency.symbol} → YES_${details.baseTokens.currency.symbol} + NO_${details.baseTokens.currency.symbol}`, value: 'currency' },
                    { name: `${details.baseTokens.company.symbol} → YES_${details.baseTokens.company.symbol} + NO_${details.baseTokens.company.symbol}`, value: 'company' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);

        if (tokenType === 'back') return;

        const baseToken = tokenType === 'currency' ? details.baseTokens.currency : details.baseTokens.company;
        const publicClient = createPublicClient({ chain: viemChain, transport: http(chainConfig.rpcUrl) });

        // Fetch balance
        const balanceSpinner = ora('Fetching balance...').start();
        let balance;
        try {
            const balanceWei = await publicClient.readContract({
                address: baseToken.address,
                abi: CONTRACT_ABIS.ERC20,
                functionName: 'balanceOf',
                args: [walletAddress]
            });
            balance = parseFloat(formatUnits(balanceWei, 18));
            balanceSpinner.succeed(`Available: ${balance.toFixed(4)} ${baseToken.symbol}`);
        } catch (e) {
            balanceSpinner.fail(`Failed to fetch balance: ${e.message}`);
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        if (balance <= 0) {
            console.log(chalk.yellow(`No ${baseToken.symbol} balance to split`));
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        // Get amount
        const { amount } = await inquirer.prompt([
            {
                type: 'input',
                name: 'amount',
                message: `Amount of ${baseToken.symbol} to split (max: ${balance.toFixed(4)}):`,
                validate: (v) => {
                    const num = parseFloat(v);
                    if (isNaN(num) || num <= 0) return 'Enter a valid positive number';
                    if (num > balance) return `Amount exceeds balance (${balance.toFixed(4)})`;
                    return true;
                }
            }
        ]);

        const amountWei = parseUnits(amount, 18);
        const account = this.executor.account;
        const walletClient = this.executor.walletClient;

        // Check approval
        const approvalSpinner = ora('Checking approval...').start();
        try {
            const currentAllowance = await publicClient.readContract({
                address: baseToken.address,
                abi: CONTRACT_ABIS.ERC20,
                functionName: 'allowance',
                args: [walletAddress, TRADING_ADDRESSES.FUTARCHY_ROUTER]
            });

            if (currentAllowance < amountWei) {
                approvalSpinner.text = `Approving ${baseToken.symbol}...`;
                const approveHash = await walletClient.writeContract({
                    address: baseToken.address,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'approve',
                    args: [TRADING_ADDRESSES.FUTARCHY_ROUTER, amountWei],
                    chain: viemChain,
                    account
                });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                approvalSpinner.succeed('Approved');
            } else {
                approvalSpinner.succeed('Already approved');
            }
        } catch (e) {
            approvalSpinner.fail(`Approval failed: ${e.message}`);
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        // Execute split
        const splitSpinner = ora('Splitting...').start();
        try {
            const splitHash = await walletClient.writeContract({
                address: TRADING_ADDRESSES.FUTARCHY_ROUTER,
                abi: CONTRACT_ABIS.FUTARCHY_ROUTER,
                functionName: 'splitPosition',
                args: [proposalAddress, baseToken.address, amountWei],
                chain: viemChain,
                account
            });
            await publicClient.waitForTransactionReceipt({ hash: splitHash });
            splitSpinner.succeed(chalk.green(`Split complete! TX: ${splitHash}`));
            console.log(chalk.dim(`View on explorer: https://gnosisscan.io/tx/${splitHash}`));
            console.log(chalk.green(`\n✅ Received ${amount} YES_${baseToken.symbol} + ${amount} NO_${baseToken.symbol}`));
        } catch (e) {
            splitSpinner.fail(`Split failed: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Merge Flow - Merge YES+NO outcome tokens back into base tokens
     */
    async mergeFlow(proposalAddress, details, tokens, balances, walletAddress, chainId, { companyMin, currencyMin }) {
        console.log(chalk.cyan('\n➖ Merge Collateral\n'));

        if (!this.executor?.walletClient) {
            console.log(chalk.red('❌ No wallet connected. Please set PRIVATE_KEY in .env'));
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        const chainConfig = CHAIN_CONFIG[chainId];
        const viemChain = chainId === 1 ? mainnet : gnosis;

        // Show mergeable amounts
        console.log(boxen(
            `${chalk.bold('Mergeable amounts (min of YES + NO):')}\n\n` +
            `  ${details.baseTokens.currency.symbol}: ${currencyMin.toFixed(4)} (→ ${currencyMin.toFixed(4)} ${details.baseTokens.currency.symbol})\n` +
            `  ${details.baseTokens.company.symbol}: ${companyMin.toFixed(4)} (→ ${companyMin.toFixed(4)} ${details.baseTokens.company.symbol})`,
            { padding: 1, borderStyle: 'single', borderColor: 'yellow' }
        ));

        // Select token type
        const currencyChoice = currencyMin > 0
            ? { name: `Merge ${details.baseTokens.currency.symbol} (max: ${currencyMin.toFixed(4)})`, value: 'currency' }
            : { name: chalk.dim(`${details.baseTokens.currency.symbol} (no balance)`), value: 'currency', disabled: 'No mergeable balance' };

        const companyChoice = companyMin > 0
            ? { name: `Merge ${details.baseTokens.company.symbol} (max: ${companyMin.toFixed(4)})`, value: 'company' }
            : { name: chalk.dim(`${details.baseTokens.company.symbol} (no balance)`), value: 'company', disabled: 'No mergeable balance' };

        const { tokenType } = await inquirer.prompt([
            {
                type: 'list',
                name: 'tokenType',
                message: 'Which tokens to merge?',
                choices: [currencyChoice, companyChoice, { name: '🔙 Back', value: 'back' }]
            }
        ]);

        if (tokenType === 'back') return;

        const maxAmount = tokenType === 'currency' ? currencyMin : companyMin;
        const baseToken = tokenType === 'currency' ? details.baseTokens.currency : details.baseTokens.company;
        const yesToken = tokenType === 'currency' ? tokens.YES_CURRENCY : tokens.YES_COMPANY;
        const noToken = tokenType === 'currency' ? tokens.NO_CURRENCY : tokens.NO_COMPANY;

        // Get amount
        const { amount } = await inquirer.prompt([
            {
                type: 'input',
                name: 'amount',
                message: `Amount to merge (max: ${maxAmount.toFixed(4)}):`,
                validate: (v) => {
                    const num = parseFloat(v);
                    if (isNaN(num) || num <= 0) return 'Enter a valid positive number';
                    if (num > maxAmount) return `Amount exceeds mergeable (${maxAmount.toFixed(4)})`;
                    return true;
                }
            }
        ]);

        const amountWei = parseUnits(amount, 18);
        const publicClient = createPublicClient({ chain: viemChain, transport: http(chainConfig.rpcUrl) });
        const account = this.executor.account;
        const walletClient = this.executor.walletClient;

        // Approve YES token
        const approveYesSpinner = ora(`Checking ${yesToken.symbol} approval...`).start();
        try {
            const yesAllowance = await publicClient.readContract({
                address: yesToken.address,
                abi: CONTRACT_ABIS.ERC20,
                functionName: 'allowance',
                args: [walletAddress, TRADING_ADDRESSES.FUTARCHY_ROUTER]
            });

            if (yesAllowance < amountWei) {
                approveYesSpinner.text = `Approving ${yesToken.symbol}...`;
                const approveHash = await walletClient.writeContract({
                    address: yesToken.address,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'approve',
                    args: [TRADING_ADDRESSES.FUTARCHY_ROUTER, amountWei],
                    chain: viemChain,
                    account
                });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                approveYesSpinner.succeed(`${yesToken.symbol} approved`);
            } else {
                approveYesSpinner.succeed(`${yesToken.symbol} already approved`);
            }
        } catch (e) {
            approveYesSpinner.fail(`Approval failed: ${e.message}`);
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        // Approve NO token
        const approveNoSpinner = ora(`Checking ${noToken.symbol} approval...`).start();
        try {
            const noAllowance = await publicClient.readContract({
                address: noToken.address,
                abi: CONTRACT_ABIS.ERC20,
                functionName: 'allowance',
                args: [walletAddress, TRADING_ADDRESSES.FUTARCHY_ROUTER]
            });

            if (noAllowance < amountWei) {
                approveNoSpinner.text = `Approving ${noToken.symbol}...`;
                const approveHash = await walletClient.writeContract({
                    address: noToken.address,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'approve',
                    args: [TRADING_ADDRESSES.FUTARCHY_ROUTER, amountWei],
                    chain: viemChain,
                    account
                });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                approveNoSpinner.succeed(`${noToken.symbol} approved`);
            } else {
                approveNoSpinner.succeed(`${noToken.symbol} already approved`);
            }
        } catch (e) {
            approveNoSpinner.fail(`Approval failed: ${e.message}`);
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        // Execute merge
        const mergeSpinner = ora('Merging...').start();
        try {
            const mergeHash = await walletClient.writeContract({
                address: TRADING_ADDRESSES.FUTARCHY_ROUTER,
                abi: CONTRACT_ABIS.FUTARCHY_ROUTER,
                functionName: 'mergePositions',
                args: [proposalAddress, baseToken.address, amountWei],
                chain: viemChain,
                account
            });
            await publicClient.waitForTransactionReceipt({ hash: mergeHash });
            mergeSpinner.succeed(chalk.green(`Merge complete! TX: ${mergeHash}`));
            console.log(chalk.dim(`View on explorer: https://gnosisscan.io/tx/${mergeHash}`));
            console.log(chalk.green(`\n✅ Received ${amount} ${baseToken.symbol}`));
        } catch (e) {
            mergeSpinner.fail(`Merge failed: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Create Actual Proposal Flow - Full interactive form for creating trading contracts
     */
    async createActualProposalFlow() {
        console.log(chalk.cyan('\n🚀 Create Actual Proposal (Trading Contract)\n'));

        // 1. Chain Selection
        const chainChoices = Object.values(CHAIN_CONFIG).map(c => ({
            name: `${c.name} (Chain ${c.id})`,
            value: c.id
        }));

        const { chainId } = await inquirer.prompt([
            {
                type: 'list',
                name: 'chainId',
                message: 'Select Chain:',
                choices: chainChoices,
                default: 100
            }
        ]);

        const chainConfig = CHAIN_CONFIG[chainId];
        console.log(chalk.gray(`Factory: ${chainConfig.factoryAddress}`));

        // 2. Token inputs with defaults
        const { companyToken, currencyToken } = await inquirer.prompt([
            {
                type: 'input',
                name: 'companyToken',
                message: 'Company Token Address:',
                default: chainConfig.defaultTokens.company.address,
                validate: (v) => /^0x[a-fA-F0-9]{40}$/.test(v) || 'Invalid address'
            },
            {
                type: 'input',
                name: 'currencyToken',
                message: 'Currency Token Address:',
                default: chainConfig.defaultTokens.currency.address,
                validate: (v) => /^0x[a-fA-F0-9]{40}$/.test(v) || 'Invalid address'
            }
        ]);

        // 3. Verify tokens via RPC
        const spinner = ora('Verifying tokens...').start();
        let companyInfo = { symbol: 'UNKNOWN', decimals: 18 };
        let currencyInfo = { symbol: 'UNKNOWN', decimals: 18 };

        try {
            for await (const update of this.dataLayer.execute('futarchy.verifyToken', { tokenAddress: companyToken, chainId })) {
                if (update.status === 'success') {
                    companyInfo = update.data;
                }
            }
            for await (const update of this.dataLayer.execute('futarchy.verifyToken', { tokenAddress: currencyToken, chainId })) {
                if (update.status === 'success') {
                    currencyInfo = update.data;
                }
            }
            spinner.succeed(`Tokens: ${chalk.green(companyInfo.symbol)} / ${chalk.green(currencyInfo.symbol)}`);
        } catch (e) {
            spinner.warn(`Token verification failed: ${e.message}`);
        }

        // 4. Market details
        const { marketName, category, language, minBondLabel, openingTimeOffset } = await inquirer.prompt([
            {
                type: 'input',
                name: 'marketName',
                message: 'Market Name (Question):',
                validate: (v) => v.trim().length > 0 || 'Required'
            },
            {
                type: 'list',
                name: 'category',
                message: 'Category:',
                choices: CATEGORY_PRESETS,
                default: 'crypto'
            },
            {
                type: 'list',
                name: 'language',
                message: 'Language:',
                choices: ['en', 'es', 'fr', 'de'],
                default: 'en'
            },
            {
                type: 'list',
                name: 'minBondLabel',
                message: 'Min Bond:',
                choices: MIN_BOND_PRESETS.map(p => p.label),
                default: '1'
            },
            {
                type: 'list',
                name: 'openingTimeOffset',
                message: 'Opening Time:',
                choices: [
                    { name: '1 month from now', value: 30 * 24 * 60 * 60 },
                    { name: '3 months from now', value: 90 * 24 * 60 * 60 },
                    { name: '6 months from now', value: 180 * 24 * 60 * 60 },
                    { name: 'Custom timestamp', value: 'custom' }
                ],
                default: 90 * 24 * 60 * 60
            }
        ]);

        let openingTime;
        if (openingTimeOffset === 'custom') {
            const { customTime } = await inquirer.prompt([{ type: 'input', name: 'customTime', message: 'Enter custom unix timestamp (e.g. 1775087999):' }]);
            openingTime = parseInt(customTime, 10);
        } else {
            openingTime = Math.floor(Date.now() / 1000) + openingTimeOffset;
        }

        const minBond = MIN_BOND_PRESETS.find(p => p.label === minBondLabel)?.value || '1000000000000000000';
        const openingDate = new Date(openingTime * 1000).toLocaleDateString();

        // 5. Confirmation Summary
        console.log(boxen(
            chalk.bold.cyan('📋 Proposal Summary\n\n') +
            `${chalk.white('Chain:')}        ${chalk.yellow(chainConfig.name)}\n` +
            `${chalk.white('Factory:')}      ${chalk.gray(chainConfig.factoryAddress)}\n\n` +
            `${chalk.white('Market Name:')}  ${chalk.green(marketName)}\n` +
            `${chalk.white('Company Token:')} ${chalk.green(companyInfo.symbol)} (${companyToken.slice(0, 10)}...)\n` +
            `${chalk.white('Currency Token:')} ${chalk.green(currencyInfo.symbol)} (${currencyToken.slice(0, 10)}...)\n` +
            `${chalk.white('Category:')}     ${category}\n` +
            `${chalk.white('Language:')}     ${language}\n` +
            `${chalk.white('Min Bond:')}     ${minBondLabel} token(s)\n` +
            `${chalk.white('Opening:')}      ${openingDate} (Unix: ${openingTime})`,
            { padding: 1, borderStyle: 'round', borderColor: 'cyan' }
        ));

        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: 'Create this proposal?', default: false }
        ]);

        if (!confirm) {
            console.log(chalk.gray('Cancelled.'));
            return;
        }

        // 6. Execute creation
        let createdProposalAddress = null;
        const createSpinner = ora('Creating proposal on chain...').start();
        try {
            for await (const update of this.dataLayer.execute('futarchy.createActualProposal', {
                chainId,
                marketName,
                companyToken,
                currencyToken,
                category,
                language,
                minBond,
                openingTime
            })) {
                if (update.status === 'success') {
                    createSpinner.succeed(update.message);
                    if (update.data?.proposalAddress) {
                        createdProposalAddress = update.data.proposalAddress;
                        console.log(chalk.green(`\n✅ Proposal Address: ${createdProposalAddress}`));
                    }
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 Explorer: ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    createSpinner.fail(update.message);
                } else {
                    createSpinner.text = update.message;
                }
            }
        } catch (e) {
            createSpinner.fail(`Error: ${e.message}`);
        }

        // Exit early if no proposal was created
        if (!createdProposalAddress) {
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        // 7. Ask if user wants to link to organization
        console.log(chalk.cyan('\n📎 Link Proposal to Organization?\n'));
        const { wantLink } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'wantLink',
                message: 'Would you like to create ProposalMetadata and link to an Organization?',
                default: true
            }
        ]);

        if (!wantLink) {
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        // 8. Get wallet address to find user's orgs
        let walletAddress;
        try {
            const { privateKeyToAccount } = await import('viem/accounts');
            let pk = process.env.PRIVATE_KEY?.trim();
            if (pk && !pk.startsWith('0x')) pk = '0x' + pk;
            if (pk) {
                walletAddress = privateKeyToAccount(pk).address;
            }
        } catch { }

        // 9. Query organizations owned by user
        let userOrgs = [];
        if (walletAddress) {
            const orgSpinner = ora('Fetching your organizations...').start();
            try {
                for await (const update of this.dataLayer.execute('futarchy.getOrganizationsByOwner', { ownerAddress: walletAddress })) {
                    if (update.status === 'success') {
                        userOrgs = update.data || [];
                        orgSpinner.succeed(`Found ${userOrgs.length} organization(s) you own`);
                    } else if (update.status === 'error') {
                        orgSpinner.warn(update.message);
                    }
                }
            } catch (e) {
                orgSpinner.warn(`Could not fetch orgs: ${e.message}`);
            }
        }

        // 10. Select or enter organization
        let selectedOrg = null;
        if (userOrgs.length > 0) {
            const orgChoices = [
                ...userOrgs.map(o => ({ name: `${o.name || 'Unnamed'} (${o.address.slice(0, 10)}...)`, value: o })),
                { name: '📝 Enter custom address', value: 'custom' }
            ];
            const { org } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'org',
                    message: 'Select Organization:',
                    choices: orgChoices
                }
            ]);
            if (org === 'custom') {
                const { customOrg } = await inquirer.prompt([
                    { type: 'input', name: 'customOrg', message: 'Organization Address:', validate: v => /^0x[a-fA-F0-9]{40}$/.test(v) || 'Invalid address' }
                ]);
                selectedOrg = { address: customOrg, name: 'Custom' };
            } else {
                selectedOrg = org;
            }
        } else {
            const { customOrg } = await inquirer.prompt([
                { type: 'input', name: 'customOrg', message: 'Organization Address:', validate: v => /^0x[a-fA-F0-9]{40}$/.test(v) || 'Invalid address' }
            ]);
            selectedOrg = { address: customOrg, name: 'Custom' };
        }

        // 11. Get metadata details
        const { displayNameQuestion, displayNameEvent, metaDescription } = await inquirer.prompt([
            { type: 'input', name: 'displayNameQuestion', message: 'Display Name (Question):', default: marketName },
            { type: 'input', name: 'displayNameEvent', message: 'Display Name (Event):', default: marketName },
            { type: 'input', name: 'metaDescription', message: 'Description:', default: '' }
        ]);

        // 12. Confirmation
        console.log(boxen(
            chalk.bold.magenta('📎 Link Summary\n\n') +
            `${chalk.white('Organization:')}  ${chalk.green(selectedOrg.name)} (${selectedOrg.address.slice(0, 12)}...)\n` +
            `${chalk.white('Proposal:')}      ${createdProposalAddress.slice(0, 12)}...\n` +
            `${chalk.white('Question:')}      ${displayNameQuestion}\n` +
            `${chalk.white('Event:')}         ${displayNameEvent}`,
            { padding: 1, borderStyle: 'round', borderColor: 'magenta' }
        ));

        const { confirmLink } = await inquirer.prompt([
            { type: 'confirm', name: 'confirmLink', message: 'Create ProposalMetadata and link?', default: true }
        ]);

        if (!confirmLink) {
            console.log(chalk.gray('Link cancelled.'));
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        // 13. Execute linking
        const linkSpinner = ora('Linking proposal to organization...').start();
        try {
            for await (const update of this.dataLayer.execute('futarchy.linkProposalToOrganization', {
                organizationAddress: selectedOrg.address,
                proposalAddress: createdProposalAddress,
                displayNameQuestion,
                displayNameEvent,
                description: metaDescription,
                metadata: JSON.stringify({ chain: chainId }),
                metadataURI: ''
            })) {
                if (update.status === 'success') {
                    linkSpinner.succeed(update.message);
                    if (update.data?.metadataContract) {
                        console.log(chalk.green(`📄 Metadata Contract: ${update.data.metadataContract}`));
                    }
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 Explorer: ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    linkSpinner.fail(update.message);
                } else {
                    linkSpinner.text = update.message;
                }
            }
        } catch (e) {
            linkSpinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    // =========================================
    // NEW: Explore Metadata Flow
    // =========================================

    async exploreMetadataFlow() {
        while (true) {
            const { target } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'target',
                    message: '🔍 Explore Metadata - Select Entity Type:',
                    choices: [
                        { name: '🏛️  Aggregator Metadata', value: 'aggregator' },
                        { name: '🏢 Organization Metadata', value: 'organization' },
                        { name: '📄 Proposal Metadata', value: 'proposal' },
                        { name: '🔙 Back to Main Menu', value: 'back' }
                    ]
                }
            ]);

            if (target === 'back') return;

            if (target === 'aggregator') {
                await this.viewAggregatorMetadata();
            } else if (target === 'organization') {
                await this.viewOrganizationMetadata();
            } else if (target === 'proposal') {
                await this.viewProposalMetadata();
            }
        }
    }

    async viewAggregatorMetadata() {
        const { address } = await inquirer.prompt([
            {
                type: 'input',
                name: 'address',
                message: 'Aggregator Address:',
                default: CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR
            }
        ]);

        const spinner = ora('Fetching aggregator metadata...').start();
        let data = null;

        try {
            for await (const update of this.dataLayer.execute('futarchy.getAggregatorMetadata', { aggregatorAddress: address })) {
                if (update.status === 'success') {
                    data = update.data;
                    spinner.succeed(update.message);
                } else if (update.status === 'error') {
                    spinner.fail(update.message);
                    await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
                    return;
                }
            }
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        if (!data) return;

        // Display metadata
        await this.displayMetadataTable('Aggregator', data);

        // Ask if user wants to edit
        await this.offerEditMetadata('aggregator', address, data.metadataEntries);
    }

    async viewOrganizationMetadata() {
        // First, fetch list of organizations
        const spinner = ora('Fetching organizations...').start();
        const orgs = [];

        try {
            for await (const update of this.dataLayer.execute('futarchy.getOrganizations', { aggregatorAddress: CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR })) {
                if (update.status === 'partial') {
                    orgs.push(update.data);
                } else if (update.status === 'success') {
                    orgs.push(...update.data);
                }
            }
            spinner.succeed(`Found ${orgs.length} organizations`);
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        const { selectedOrg } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedOrg',
                message: 'Select Organization:',
                choices: [
                    ...orgs.map(o => ({ name: `${o.name} (${o.address.slice(0, 10)}...)`, value: o.address })),
                    { name: '📝 Enter custom address', value: 'custom' },
                    { name: '🔙 Back', value: null }
                ]
            }
        ]);

        if (!selectedOrg) return;

        let address = selectedOrg;
        if (selectedOrg === 'custom') {
            const { customAddr } = await inquirer.prompt([
                { type: 'input', name: 'customAddr', message: 'Organization Address:', validate: v => /^0x[a-fA-F0-9]{40}$/.test(v) || 'Invalid address' }
            ]);
            address = customAddr;
        }

        const metaSpinner = ora('Fetching organization metadata...').start();
        let data = null;

        try {
            for await (const update of this.dataLayer.execute('futarchy.getOrganizationMetadata', { organizationAddress: address })) {
                if (update.status === 'success') {
                    data = update.data;
                    metaSpinner.succeed(update.message);
                } else if (update.status === 'error') {
                    metaSpinner.fail(update.message);
                    await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
                    return;
                }
            }
        } catch (e) {
            metaSpinner.fail(`Error: ${e.message}`);
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        if (!data) return;

        await this.displayMetadataTable('Organization', data);
        await this.offerEditMetadata('organization', address, data.metadataEntries);
    }

    async viewProposalMetadata() {
        const { address } = await inquirer.prompt([
            {
                type: 'input',
                name: 'address',
                message: 'Proposal Address (Trading Contract):',
                validate: v => /^0x[a-fA-F0-9]{40}$/.test(v) || 'Invalid address'
            }
        ]);

        const spinner = ora('Fetching proposal metadata...').start();
        let data = null;

        try {
            for await (const update of this.dataLayer.execute('futarchy.getProposalMetadata', { proposalAddress: address })) {
                if (update.status === 'success') {
                    data = update.data;
                    spinner.succeed(update.message);
                } else if (update.status === 'error') {
                    spinner.fail(update.message);
                    await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
                    return;
                }
            }
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        if (!data) return;

        await this.displayMetadataTable('Proposal', data);
        // For proposals, the metadata contract is the entity to edit (not trading contract)
        await this.offerEditMetadata('proposal', data.metadataContract, data.metadataEntries);
    }

    async displayMetadataTable(entityType, data) {
        console.log('');

        // Build info section
        let infoSection = chalk.bold.cyan(`${entityType}: ${data.name || data.title || 'N/A'}\n`);
        infoSection += chalk.gray(`Address: ${data.address || data.metadataContract || 'N/A'}\n`);
        infoSection += chalk.gray(`Owner: ${data.owner || 'N/A'}\n`);
        if (data.description) infoSection += chalk.gray(`Description: ${data.description.slice(0, 100)}${data.description.length > 100 ? '...' : ''}\n`);
        infoSection += `\n`;

        // Build metadata entries table
        const entries = data.metadataEntries || [];
        let tableSection = chalk.bold.yellow(`📋 Metadata Entries (${entries.length}):\n`);
        tableSection += chalk.gray('─'.repeat(60) + '\n');

        if (entries.length === 0) {
            tableSection += chalk.dim('  (no metadata entries)\n');
        } else {
            for (const entry of entries) {
                const key = entry.key;
                let value = entry.value;
                // Truncate long values
                if (value.length > 40) {
                    value = value.slice(0, 37) + '...';
                }
                tableSection += `  ${chalk.green(key.padEnd(25))} ${chalk.white(value)}\n`;
            }
        }
        tableSection += chalk.gray('─'.repeat(60));

        console.log(boxen(
            infoSection + tableSection,
            { padding: 1, borderStyle: 'round', title: `${entityType} Metadata` }
        ));
    }

    async offerEditMetadata(entityType, entityAddress, currentEntries) {
        if (!entityAddress) {
            console.log(chalk.dim('Cannot edit: no valid address for this entity'));
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    { name: '✏️  Add/Update Metadata Key', value: 'edit' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);

        if (action === 'back') return;

        // Show existing keys as suggestions
        const existingKeys = (currentEntries || []).map(e => e.key);
        const commonKeys = ['chain', 'coingecko_ticker', 'price_precision', 'currency_base_symbol', 'currency_stable_symbol', 'chart_start_range'];
        const allKeys = [...new Set([...existingKeys, ...commonKeys])];

        const { keyChoice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'keyChoice',
                message: 'Select or enter key:',
                choices: [
                    ...allKeys.map(k => ({ name: `${existingKeys.includes(k) ? '📝' : '➕'} ${k}`, value: k })),
                    { name: '✨ Enter custom key', value: '__custom__' }
                ]
            }
        ]);

        let key = keyChoice;
        if (keyChoice === '__custom__') {
            const { customKey } = await inquirer.prompt([
                { type: 'input', name: 'customKey', message: 'Key name:', validate: v => v.trim().length > 0 || 'Key required' }
            ]);
            key = customKey;
        }

        // Show current value if exists
        const currentValue = currentEntries?.find(e => e.key === key)?.value;
        if (currentValue) {
            console.log(chalk.dim(`Current value: ${currentValue}`));
        }

        const { value } = await inquirer.prompt([
            { type: 'input', name: 'value', message: 'New value:', default: currentValue || '' }
        ]);

        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Set ${key} = "${value.slice(0, 30)}${value.length > 30 ? '...' : ''}"?`, default: true }
        ]);

        if (!confirm) {
            console.log(chalk.gray('Cancelled.'));
            return;
        }

        // Execute update
        const spinner = ora('Updating metadata...').start();
        try {
            for await (const update of this.dataLayer.execute('futarchy.updateEntityMetadata', {
                entityType,
                entityAddress,
                key,
                value
            })) {
                if (update.status === 'success') {
                    spinner.succeed(update.message);
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    spinner.fail(update.message);
                } else {
                    spinner.text = update.message;
                }
            }
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Create Organization Flow - Create a new org under an aggregator
     */
    async createOrganizationFlow() {
        console.log(chalk.cyan('\n➕ Create Organization\n'));

        const { aggregatorAddress, companyName, description, metadata, metadataURI } = await inquirer.prompt([
            {
                type: 'input',
                name: 'aggregatorAddress',
                message: 'Aggregator Address:',
                default: CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR
            },
            {
                type: 'input',
                name: 'companyName',
                message: 'Company Name:',
                validate: v => v.trim() ? true : 'Name is required'
            },
            {
                type: 'input',
                name: 'description',
                message: 'Description:',
                default: ''
            },
            {
                type: 'input',
                name: 'metadata',
                message: 'Metadata JSON (optional):',
                default: ''
            },
            {
                type: 'input',
                name: 'metadataURI',
                message: 'Metadata URI (optional):',
                default: ''
            }
        ]);

        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Create organization "${companyName}"?`, default: true }
        ]);

        if (!confirm) return;

        const spinner = ora('Creating organization...').start();
        try {
            for await (const update of this.dataLayer.execute('futarchy.createOrganization', {
                aggregatorAddress,
                companyName,
                description,
                metadata,
                metadataURI
            })) {
                if (update.status === 'success') {
                    spinner.succeed(update.message);
                    if (update.data?.organizationAddress) {
                        console.log(chalk.green(`📍 Organization Address: ${update.data.organizationAddress}`));
                    }
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    spinner.fail(update.message);
                } else {
                    spinner.text = update.message;
                }
            }
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Remove Proposal Flow - Remove a proposal from an organization by index
     */
    async removeProposalFlow(org) {
        console.log(chalk.red('\n🗑️ Remove Proposal\\n'));
        console.log(chalk.yellow('⚠️  Warning: This will remove the proposal from the organization.'));
        console.log(chalk.dim('The proposal contract itself will still exist on-chain.\n'));

        // Fetch proposals first to show current list
        const spinner = ora('Fetching proposals...').start();
        let proposals = [];
        try {
            for await (const update of this.dataLayer.execute('futarchy.getProposals', { organizationAddress: org.address })) {
                if (update.status === 'success') {
                    proposals = update.data;
                }
            }
            spinner.succeed(`Found ${proposals.length} proposals`);
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
            return;
        }

        if (proposals.length === 0) {
            console.log(chalk.gray('No proposals to remove.'));
            return;
        }

        // Optional search filter
        const { searchFilter } = await inquirer.prompt([
            {
                type: 'input',
                name: 'searchFilter',
                message: 'Filter by address (0x...) or leave empty to show all:',
                default: ''
            }
        ]);

        let filteredProposals = proposals.map((p, i) => ({ ...p, originalIndex: i }));
        if (searchFilter.trim()) {
            const filter = searchFilter.trim().toLowerCase();
            filteredProposals = filteredProposals.filter(p =>
                p.metadataAddress?.toLowerCase().includes(filter) ||
                p.proposalAddress?.toLowerCase().includes(filter) ||
                p.displayNameEvent?.toLowerCase().includes(filter)
            );
            console.log(chalk.dim(`  Filtered to ${filteredProposals.length} of ${proposals.length}`));
        }

        if (filteredProposals.length === 0) {
            console.log(chalk.yellow('No proposals match your filter.'));
            return;
        }

        // Arrow-based selection
        const { selectedProposal } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedProposal',
                message: 'Select proposal to remove:',
                choices: [
                    ...filteredProposals.map(p => ({
                        name: `[${p.originalIndex}] ${p.metadataAddress.slice(0, 10)}...(${p.proposalAddress?.slice(0, 10) || 'N/A'}...)`,
                        value: p
                    })),
                    { name: '🔙 Cancel', value: null }
                ]
            }
        ]);

        if (!selectedProposal) return;

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: chalk.red(`⚠️ REMOVE proposal at index ${selectedProposal.originalIndex}? (${selectedProposal.metadataAddress.slice(0, 16)}...)`),
                default: false
            }
        ]);

        if (!confirm) return;

        const removeSpinner = ora('Removing proposal...').start();
        try {
            for await (const update of this.dataLayer.execute('futarchy.removeProposal', {
                organizationAddress: org.address,
                proposalIndex: selectedProposal.originalIndex
            })) {
                if (update.status === 'success') {
                    removeSpinner.succeed(update.message);
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    removeSpinner.fail(update.message);
                } else {
                    removeSpinner.text = update.message;
                }
            }
        } catch (e) {
            removeSpinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Remove Organization Flow - Remove an org from an aggregator
     */
    async removeOrganizationFlow() {
        console.log(chalk.red('\n🗑️ Remove Organization\n'));
        console.log(chalk.yellow('⚠️  Warning: This will remove the organization from the aggregator.'));
        console.log(chalk.dim('The organization contract itself will still exist on-chain.\n'));

        const { aggregatorAddress } = await inquirer.prompt([
            {
                type: 'input',
                name: 'aggregatorAddress',
                message: 'Aggregator Address:',
                default: CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR
            }
        ]);

        // Fetch organizations
        const spinner = ora('Fetching organizations...').start();
        let orgs = [];
        try {
            for await (const update of this.dataLayer.execute('futarchy.getOrganizations', { aggregatorAddress })) {
                if (update.status === 'partial') {
                    // skip
                } else if (update.status === 'success') {
                    orgs = update.data;
                }
            }
            spinner.succeed(`Found ${orgs.length} organizations`);
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
            return;
        }

        if (orgs.length === 0) {
            console.log(chalk.gray('No organizations to remove.'));
            return;
        }

        // Optional search filter
        const { searchFilter } = await inquirer.prompt([
            {
                type: 'input',
                name: 'searchFilter',
                message: 'Filter by name or address (0x...) or leave empty:',
                default: ''
            }
        ]);

        let filteredOrgs = orgs.map((o, i) => ({ ...o, originalIndex: i }));
        if (searchFilter.trim()) {
            const filter = searchFilter.trim().toLowerCase();
            filteredOrgs = filteredOrgs.filter(o =>
                o.name?.toLowerCase().includes(filter) ||
                o.address?.toLowerCase().includes(filter)
            );
            console.log(chalk.dim(`  Filtered to ${filteredOrgs.length} of ${orgs.length}`));
        }

        if (filteredOrgs.length === 0) {
            console.log(chalk.yellow('No organizations match your filter.'));
            return;
        }

        // Arrow-based selection
        const { selectedOrg } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedOrg',
                message: 'Select organization to remove:',
                choices: [
                    ...filteredOrgs.map(o => ({
                        name: `[${o.originalIndex}] ${o.name} (${o.address.slice(0, 10)}...)`,
                        value: o
                    })),
                    { name: '🔙 Cancel', value: null }
                ]
            }
        ]);

        if (!selectedOrg) return;

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: chalk.red(`⚠️ REMOVE organization "${selectedOrg.name}" at index ${selectedOrg.originalIndex}?`),
                default: false
            }
        ]);

        if (!confirm) return;

        const removeSpinner = ora('Removing organization...').start();
        try {
            for await (const update of this.dataLayer.execute('futarchy.removeOrganization', {
                aggregatorAddress,
                organizationIndex: selectedOrg.originalIndex
            })) {
                if (update.status === 'success') {
                    removeSpinner.succeed(update.message);
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    removeSpinner.fail(update.message);
                } else {
                    removeSpinner.text = update.message;
                }
            }
        } catch (e) {
            removeSpinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Edit Organization Flow - Update name and description
     */
    async editOrganizationFlow(org) {
        console.log(chalk.cyan('\n✏️ Edit Organization\n'));
        console.log(chalk.dim(`Current Name: ${org.name}`));
        console.log(chalk.dim(`Address: ${org.address}\n`));

        const { newName, newDescription } = await inquirer.prompt([
            {
                type: 'input',
                name: 'newName',
                message: 'New Name:',
                default: org.name,
                validate: v => v.trim() ? true : 'Name is required'
            },
            {
                type: 'input',
                name: 'newDescription',
                message: 'New Description:',
                default: org.description || ''
            }
        ]);

        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Update organization to "${newName}"?`, default: true }
        ]);

        if (!confirm) return;

        const spinner = ora('Updating organization...').start();
        try {
            for await (const update of this.dataLayer.execute('futarchy.updateOrganizationInfo', {
                organizationAddress: org.address,
                newName,
                newDescription
            })) {
                if (update.status === 'success') {
                    spinner.succeed(update.message);
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                    // Update local reference
                    org.name = newName;
                } else if (update.status === 'error') {
                    spinner.fail(update.message);
                } else {
                    spinner.text = update.message;
                }
            }
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Edit Aggregator Flow - Update aggregator name and description
     */
    async editAggregatorFlow() {
        console.log(chalk.cyan('\n✏️ Edit Aggregator\n'));

        const { aggregatorAddress, newName, newDescription } = await inquirer.prompt([
            {
                type: 'input',
                name: 'aggregatorAddress',
                message: 'Aggregator Address:',
                default: CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR
            },
            {
                type: 'input',
                name: 'newName',
                message: 'New Name:',
                validate: v => v.trim() ? true : 'Name is required'
            },
            {
                type: 'input',
                name: 'newDescription',
                message: 'New Description:',
                default: ''
            }
        ]);

        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Update aggregator to "${newName}"?`, default: true }
        ]);

        if (!confirm) return;

        const spinner = ora('Updating aggregator...').start();
        try {
            for await (const update of this.dataLayer.execute('futarchy.updateAggregatorInfo', {
                aggregatorAddress,
                newName,
                newDescription
            })) {
                if (update.status === 'success') {
                    spinner.succeed(update.message);
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    spinner.fail(update.message);
                } else {
                    spinner.text = update.message;
                }
            }
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Edit Proposal Info Flow - Update displayNameQuestion, displayNameEvent, description
     * Called from proposalActionsMenu
     */
    async editProposalInfoFlow(proposalMetadataAddress, details) {
        console.log(chalk.cyan('\n✏️ Edit Proposal Info\n'));

        console.log(chalk.dim('Current values:'));
        console.log(chalk.dim(`  displayNameQuestion: ${details.question || ''}`));
        console.log(chalk.dim(`  displayNameEvent: ${details.marketName || ''}`));
        console.log(chalk.dim(`  description: ${details.description || ''}\n`));

        const { displayNameQuestion, displayNameEvent, description } = await inquirer.prompt([
            {
                type: 'input',
                name: 'displayNameQuestion',
                message: 'displayNameQuestion:',
                default: details.question || ''
            },
            {
                type: 'input',
                name: 'displayNameEvent',
                message: 'displayNameEvent:',
                default: details.marketName || ''
            },
            {
                type: 'input',
                name: 'description',
                message: 'description:',
                default: details.description || ''
            }
        ]);

        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: 'Update proposal info?', default: true }
        ]);

        if (!confirm) return;

        const spinner = ora('Updating proposal info...').start();
        try {
            for await (const update of this.dataLayer.execute('futarchy.updateProposalInfo', {
                proposalMetadataAddress,
                displayNameQuestion,
                displayNameEvent,
                description
            })) {
                if (update.status === 'success') {
                    spinner.succeed(update.message);
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    spinner.fail(update.message);
                } else {
                    spinner.text = update.message;
                }
            }
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Add existing ProposalMetadata contract by address
     */
    async addExistingMetadataFlow(org) {
        console.log(chalk.cyan('\n📎 Add Existing Proposal Metadata'));
        console.log(chalk.dim('Link an existing ProposalMetadata contract to this organization.\n'));

        const { metadataAddress } = await inquirer.prompt([
            {
                type: 'input',
                name: 'metadataAddress',
                message: 'Proposal Metadata Address:',
                validate: v => v.startsWith('0x') && v.length === 42 ? true : 'Invalid address'
            }
        ]);

        // Confirm
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Add metadata ${metadataAddress.slice(0, 10)}... to ${org.name}?`,
                default: true
            }
        ]);

        if (!confirm) return;

        const spinner = ora('Adding metadata to organization...').start();

        try {
            for await (const update of this.dataLayer.execute('futarchy.addExistingMetadata', {
                organizationAddress: org.address,
                metadataAddress
            })) {
                if (update.status === 'success') {
                    spinner.succeed(update.message);
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    spinner.fail(update.message);
                } else {
                    spinner.text = update.message;
                }
            }
        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * View Pool Prices from Subgraph
     */
    async viewPoolPricesFlow(proposalId, chainId, details, metadataContractAddress) {
        const spinner = ora('Fetching pool prices from subgraph...').start();

        try {
            const { yesPool, noPool, error } = await fetchPools(chainId, proposalId);

            if (error) {
                spinner.fail(`Failed to fetch pools: ${error}`);
                await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
                return;
            }

            spinner.succeed('Pool prices fetched!');

            const yesPrice = parseFloat(yesPool?.price) || 0;
            const noPrice = parseFloat(noPool?.price) || 0;

            console.log(chalk.cyan('\n╭─────────────────────────────────────────────────────'));
            console.log(chalk.cyan('│ ') + chalk.bold.white('📈 Pool Prices (Conditional)'));
            console.log(chalk.cyan('├─────────────────────────────────────────────────────'));
            console.log(chalk.cyan('│ ') + chalk.green.bold(`YES: ${yesPrice.toFixed(6)}`));
            console.log(chalk.cyan('│ ') + chalk.dim(`Pool: ${yesPool?.id || 'N/A'}`));
            console.log(chalk.cyan('│ ') + chalk.dim(`Name: ${yesPool?.name || 'N/A'}`));
            console.log(chalk.cyan('├─────────────────────────────────────────────────────'));
            console.log(chalk.cyan('│ ') + chalk.red.bold(`NO:  ${noPrice.toFixed(6)}`));
            console.log(chalk.cyan('│ ') + chalk.dim(`Pool: ${noPool?.id || 'N/A'}`));
            console.log(chalk.cyan('│ ') + chalk.dim(`Name: ${noPool?.name || 'N/A'}`));
            console.log(chalk.cyan('╰─────────────────────────────────────────────────────\n'));

            // Read metadata directly from contract (not subgraph) for freshness
            let spotConfig = null;
            let parsedMeta = {};
            // The metadataAddress is the ProposalMetadata contract - try multiple sources
            const metadataAddress = metadataContractAddress || details.metadataAddress || details.extra?.resolvedFrom;
            console.log(chalk.dim(`[DEBUG] metadataContractAddress passed: ${metadataContractAddress}`));
            console.log(chalk.dim(`[DEBUG] metadataAddress resolved to: ${metadataAddress}`));

            if (metadataAddress) {
                try {
                    const client = createPublicClient({
                        chain: chainId === 1 ? mainnet : gnosis,
                        transport: http(chainId === 1 ? 'https://eth.llamarpc.com' : 'https://rpc.gnosischain.com')
                    });

                    const rawMetadata = await client.readContract({
                        address: metadataAddress,
                        abi: CONTRACT_ABIS.PROPOSAL,
                        functionName: 'metadata'
                    });

                    console.log(chalk.dim(`[DEBUG] rawMetadata from contract: ${rawMetadata}`));
                    parsedMeta = JSON.parse(rawMetadata || '{}');
                    spotConfig = parsedMeta?.coingecko_ticker || parsedMeta?.spot_config;
                } catch (e) {
                    console.log(chalk.dim(`[DEBUG] Contract read error: ${e.message}, falling back to subgraph`));
                    // Fall back to subgraph metadata
                    try {
                        parsedMeta = details?.parsedMetadata || JSON.parse(details?.metadata || '{}');
                        spotConfig = parsedMeta?.coingecko_ticker || parsedMeta?.spot_config;
                    } catch { }
                }
            } else {
                console.log(chalk.dim(`[DEBUG] No metadataAddress, using subgraph metadata`));
                // No metadata address, try from details
                try {
                    parsedMeta = details?.parsedMetadata || JSON.parse(details?.metadata || '{}');
                    spotConfig = parsedMeta?.coingecko_ticker || parsedMeta?.spot_config;
                } catch { }
            }

            // Display metadata info
            console.log(chalk.gray('╭─────────────────────────────────────────────────────'));
            console.log(chalk.gray('│ ') + chalk.bold.white('⚙️ Metadata Config'));
            console.log(chalk.gray('├─────────────────────────────────────────────────────'));
            console.log(chalk.gray('│ ') + `chain: ${chalk.white(parsedMeta?.chain || chainId || 'N/A')}`);
            if (spotConfig) {
                console.log(chalk.gray('│ ') + `coingecko_ticker: ${chalk.green('✓ configured')}`);
                console.log(chalk.gray('│ ') + chalk.dim(spotConfig.slice(0, 50) + '...'));
            } else {
                console.log(chalk.gray('│ ') + `coingecko_ticker: ${chalk.yellow('⚠ missing spot ticker')}`);
            }
            console.log(chalk.gray('╰─────────────────────────────────────────────────────\n'));

            if (spotConfig) {
                const spotSpinner = ora('Fetching SPOT price from GeckoTerminal...').start();
                const { spotPrice, error: spotError } = await fetchSpotCandles(spotConfig);

                if (spotError) {
                    spotSpinner.fail(`SPOT fetch failed: ${spotError}`);
                } else if (spotPrice) {
                    spotSpinner.succeed('SPOT price fetched!');
                    console.log(chalk.yellow('╭─────────────────────────────────────────────────────'));
                    console.log(chalk.yellow('│ ') + chalk.bold.white('📊 SPOT Price (GeckoTerminal)'));
                    console.log(chalk.yellow('├─────────────────────────────────────────────────────'));
                    console.log(chalk.yellow('│ ') + chalk.bold.yellow(`SPOT: ${spotPrice.toFixed(6)}`));
                    console.log(chalk.yellow('╰─────────────────────────────────────────────────────\n'));
                } else {
                    spotSpinner.info('No SPOT price available');
                }
            }

        } catch (e) {
            spinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }

    /**
     * Edit extended metadata on an Organization contract
     */
    async editOrgExtendedMetadataFlow(org) {
        console.log(chalk.cyan('\n📝 Edit Extended Metadata (Organization)'));
        console.log(chalk.dim('Update the metadata JSON and metadataURI on the organization contract.\n'));

        // Fetch current metadata
        const spinner = ora('Fetching current metadata...').start();
        let currentMetadata = '';
        let currentMetadataURI = '';

        try {
            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            currentMetadata = await client.readContract({
                address: org.address,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'metadata'
            });

            currentMetadataURI = await client.readContract({
                address: org.address,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'metadataURI'
            });

            spinner.succeed('Current metadata fetched.');
        } catch (e) {
            spinner.fail(`Failed to fetch: ${e.message}`);
        }

        console.log(chalk.yellow('\nCurrent Values:'));
        console.log(`  metadata: ${currentMetadata || '(empty)'}`);
        console.log(`  metadataURI: ${currentMetadataURI || '(empty)'}`);

        const { whatToDo } = await inquirer.prompt([
            {
                type: 'list',
                name: 'whatToDo',
                message: 'What would you like to do?',
                choices: [
                    { name: '✏️ Edit Metadata JSON', value: 'edit_metadata' },
                    { name: '🔗 Edit Metadata URI', value: 'edit_uri' },
                    { name: '🔍 View Raw Metadata JSON', value: 'view_raw' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);

        if (whatToDo === 'back') return;

        if (whatToDo === 'view_raw') {
            console.log(chalk.cyan('\nRaw Metadata:'));
            try {
                console.log(JSON.stringify(JSON.parse(currentMetadata), null, 2));
            } catch {
                console.log(currentMetadata || '(empty)');
            }
            await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
            return;
        }

        let newMetadata = currentMetadata;
        let newMetadataURI = currentMetadataURI;

        if (whatToDo === 'edit_metadata') {
            const { metadata } = await inquirer.prompt([
                {
                    type: 'editor',
                    name: 'metadata',
                    message: 'Edit metadata JSON (opens editor):',
                    default: currentMetadata
                }
            ]);
            newMetadata = metadata;
        } else if (whatToDo === 'edit_uri') {
            const { metadataURI } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'metadataURI',
                    message: 'New Metadata URI:',
                    default: currentMetadataURI
                }
            ]);
            newMetadataURI = metadataURI;
        }

        // Confirm
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Submit transaction to update extended metadata?',
                default: true
            }
        ]);

        if (!confirm) return;

        const updateSpinner = ora('Updating extended metadata...').start();

        try {
            for await (const update of this.dataLayer.execute('futarchy.updateOrgExtendedMetadata', {
                organizationAddress: org.address,
                metadata: newMetadata,
                metadataURI: newMetadataURI
            })) {
                if (update.status === 'success') {
                    updateSpinner.succeed(update.message);
                    if (update.data?.explorerUrl) {
                        console.log(chalk.blue(`🔗 ${update.data.explorerUrl}`));
                    }
                } else if (update.status === 'error') {
                    updateSpinner.fail(update.message);
                } else {
                    updateSpinner.text = update.message;
                }
            }
        } catch (e) {
            updateSpinner.fail(`Error: ${e.message}`);
        }

        await inquirer.prompt([{ type: 'input', name: 'pause', message: 'Press Enter to continue...' }]);
    }
}
