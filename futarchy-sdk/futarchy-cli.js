#!/usr/bin/env node

// futarchy-cli.js - Beautiful CLI for Futarchy SDK with full integration

import fs from 'fs';
import path from 'path';
import { DataLayer } from './DataLayer.js';
import { createViemExecutor } from './executors/ViemExecutor.js';
import { FutarchyCartridge } from './executors/FutarchyCartridge.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import { MockFetcher } from './fetchers/MockFetcher.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import { createPoolDiscoveryFetcher } from './fetchers/PoolDiscoveryFetcher.js';
import { config } from './config.js';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { createWalletClient, createPublicClient, http, formatEther, parseEther } from 'viem';
import { gnosis } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Optional log-file mirroring for debugging sessions
const LOG_PATH = process.env.FUTARCHY_LOG_FILE || process.env.FUTARCHY_LOG_PATH;
if (LOG_PATH) {
    try {
        const resolvedPath = path.isAbsolute(LOG_PATH) ? LOG_PATH : path.resolve(process.cwd(), LOG_PATH);
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        const logStream = fs.createWriteStream(resolvedPath, { flags: 'a' });
        logStream.write(`\n===== Futarchy CLI session started ${new Date().toISOString()} =====\n`);

        const teeWrite = (origWrite) => function (chunk, encoding, callback) {
            try {
                if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
                    logStream.write(chunk);
                }
            } catch (error) {
                // Swallow logging errors so CLI UX remains unaffected
            }
            return origWrite.call(this, chunk, encoding, callback);
        };

        process.stdout.write = teeWrite(process.stdout.write.bind(process.stdout));
        process.stderr.write = teeWrite(process.stderr.write.bind(process.stderr));

        const closeStream = () => {
            try { logStream.end(`\n===== Futarchy CLI session ended ${new Date().toISOString()} =====\n`); } catch {}
        };
        process.on('exit', closeStream);
        process.on('SIGINT', () => { closeStream(); process.exit(130); });
        process.on('SIGTERM', () => { closeStream(); process.exit(143); });
    } catch (error) {
        console.error(`⚠️  Failed to initialise log file at ${LOG_PATH}: ${error.message}`);
    }
}

// =============================================================================
// CLI CONFIGURATION & STYLING
// =============================================================================

const LOGO = gradient.rainbow(figlet.textSync('FUTARCHY', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
    verticalLayout: 'default'
}));

const STYLES = {
    success: chalk.green.bold,
    error: chalk.red.bold,
    warning: chalk.yellow.bold,
    info: chalk.cyan.bold,
    dim: chalk.dim,
    highlight: chalk.magenta.bold,
    price: chalk.green,
    address: chalk.gray,
    value: chalk.white.bold
};

// Contract addresses from environment or defaults
const CONTRACTS = {
    SDAI: process.env.SDAI_ADDRESS || '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    FUTARCHY_ROUTER: process.env.FUTARCHY_ROUTER || '0x7495a583ba85875d59407781b4958ED6e0E1228f',
    DEFAULT_PROPOSAL: process.env.DEFAULT_PROPOSAL || '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919'
};

// =============================================================================
// FUTARCHY CLI CLASS
// =============================================================================

class FutarchyCLI {
    constructor() {
        this.dataLayer = new DataLayer();
        this.viemExecutor = null;
        this.walletClient = null;
        this.publicClient = null;
        this.account = null;
        this.isConnected = false;
        this.usePrivateKey = !!process.env.PRIVATE_KEY;
        this.autoConfirm = process.env.AUTO_CONFIRM === 'true';
    }

    async initialize() {
        console.clear();
        console.log(LOGO);
        console.log('\n');
        
        const spinner = ora('Initializing Futarchy SDK...').start();
        
        try {
            // Setup blockchain clients
            await this.setupBlockchainClients();
            
            // Setup fetchers
            this.setupFetchers();
            
            // Setup executors with cartridges
            await this.setupExecutors();
            
            spinner.succeed('Futarchy SDK initialized successfully!');
            
            // Show connection status
            this.showConnectionStatus();
            
        } catch (error) {
            spinner.fail(`Initialization failed: ${error.message}`);
            process.exit(1);
        }
    }

    async setupBlockchainClients() {
        const rpcUrl = process.env.RPC_URL || 'https://rpc.gnosischain.com';
        
        // Create public client for reading
        this.publicClient = createPublicClient({
            chain: gnosis,
            transport: http(rpcUrl)
        });
        
        // Setup wallet client if private key is provided
        if (this.usePrivateKey && process.env.PRIVATE_KEY) {
            try {
                const privateKey = process.env.PRIVATE_KEY.startsWith('0x') 
                    ? process.env.PRIVATE_KEY 
                    : `0x${process.env.PRIVATE_KEY}`;
                    
                this.account = privateKeyToAccount(privateKey);
                
                this.walletClient = createWalletClient({
                    account: this.account,
                    chain: gnosis,
                    transport: http(rpcUrl)
                });
                
                this.isConnected = true;
                
                // Get balance
                const balance = await this.publicClient.getBalance({
                    address: this.account.address
                });
                
                this.accountBalance = formatEther(balance);
                
            } catch (error) {
                console.warn(STYLES.warning('⚠️  Private key setup failed. Running in read-only mode.'));
                this.usePrivateKey = false;
            }
        }
    }

    setupFetchers() {
        // Add mock fetcher for development
        const mockFetcher = new MockFetcher();
        this.dataLayer.registerFetcher(mockFetcher);
        
        // Add Supabase fetcher if configured
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            const supabaseFetcher = createSupabasePoolFetcher(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY
            );
            this.dataLayer.registerFetcher(supabaseFetcher);
        }
        
        // Add Proposal fetcher for reading proposal data from blockchain
        const proposalFetcher = createProposalFetcher(
            process.env.RPC_URL || 'https://rpc.gnosischain.com'
        );
        this.dataLayer.registerFetcher(proposalFetcher);
        
        // Add Pool Discovery fetcher for finding pools related to proposals
        const poolDiscoveryFetcher = createPoolDiscoveryFetcher(
            process.env.RPC_URL || 'https://rpc.gnosischain.com'
        );
        this.dataLayer.registerFetcher(poolDiscoveryFetcher);
    }

    async setupExecutors() {
        // Create custom Viem executor with private key support
        this.viemExecutor = new ViemExecutorWithPrivateKey({
            rpcUrl: process.env.RPC_URL || 'https://rpc.gnosischain.com',
            walletClient: this.walletClient,
            publicClient: this.publicClient,
            account: this.account
        });
        
        // Add Futarchy cartridge
        const futarchyCartridge = new FutarchyCartridge(CONTRACTS.FUTARCHY_ROUTER);
        this.viemExecutor.registerCartridge(futarchyCartridge);
        
        // Register with DataLayer
        this.dataLayer.registerExecutor(this.viemExecutor);
    }

    showConnectionStatus() {
        const statusBox = boxen(
            this.isConnected 
                ? `${STYLES.success('✓ Connected to Gnosis Chain')}
${STYLES.info('Account:')} ${STYLES.address(this.account?.address || 'N/A')}
${STYLES.info('Balance:')} ${STYLES.value(this.accountBalance || '0')} xDAI
${STYLES.info('Mode:')} ${this.autoConfirm ? 'Auto-confirm' : 'Manual confirm'}`
                : `${STYLES.warning('⚠ Read-only mode (no private key)')}
${STYLES.dim('Add PRIVATE_KEY to .env for transaction capabilities')}`,
            {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: this.isConnected ? 'green' : 'yellow',
                title: '🔗 Connection Status',
                titleAlignment: 'center'
            }
        );
        console.log(statusBox);
    }

    async showMainMenu() {
        const choices = [
            { name: '📊 View Market Data', value: 'market_data' },
            { name: '💰 Check Balances', value: 'balances' },
            { name: '🏛️ View Proposals', value: 'proposals' },
            { name: '🏊 Discover Pools', value: 'discover_pools' }
        ];
        
        if (this.isConnected) {
            choices.push(
                { name: '✅ Approve Tokens', value: 'approve' },
                { name: '🔄 Split Position', value: 'split' },
                { name: '💸 Redeem Position', value: 'redeem' },
                { name: '🎯 Execute Custom Operation', value: 'custom' }
            );
        }
        
        choices.push(
            { name: '🔍 Test Operations', value: 'test' },
            { name: '❌ Exit', value: 'exit' }
        );
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices,
                pageSize: 10
            }
        ]);
        
        return action;
    }

    async handleMarketData() {
        const { poolAddress } = await inquirer.prompt([
            {
                type: 'input',
                name: 'poolAddress',
                message: 'Enter pool address (or press enter for default):',
                default: process.env.DEFAULT_YES_POOL || '0xF336F812Db1ad142F22A9A4dd43D40e64B478361'
            }
        ]);
        
        const spinner = ora('Fetching market data...').start();
        
        try {
            // Fetch pool candles
            const result = await this.dataLayer.fetch('pools.candle', {
                id: poolAddress,
                limit: 10
            });
            
            spinner.stop();
            
            if (result.status === 'success' && result.data) {
                // Create beautiful table
                const table = new Table({
                    head: ['Time', 'Price', 'Volume'],
                    colWidths: [20, 15, 15],
                    style: {
                        head: ['cyan'],
                        border: ['gray']
                    }
                });
                
                result.data.forEach(candle => {
                    const time = new Date(candle.timestamp * 1000).toLocaleTimeString();
                    table.push([
                        time,
                        STYLES.price(`$${(candle.price || 0).toFixed(4)}`),
                        STYLES.value((candle.volume || 0).toFixed(2))
                    ]);
                });
                
                console.log('\n' + STYLES.info('📊 Market Data for ') + STYLES.address(poolAddress));
                console.log(table.toString());
            } else {
                console.log(STYLES.error('Failed to fetch market data'));
            }
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }

    async handleDiscoverPools() {
        const { proposalAddress } = await inquirer.prompt([
            {
                type: 'input',
                name: 'proposalAddress',
                message: 'Enter proposal address to discover pools (or press enter for default):',
                default: CONTRACTS.DEFAULT_PROPOSAL
            }
        ]);
        
        const spinner = ora('Discovering pools for proposal...').start();
        
        try {
            // Discover all pools
            const discovery = await this.dataLayer.fetch('pools.discover', { proposalAddress });
            
            spinner.stop();
            
            if (discovery.status === 'success') {
                const data = discovery.data;
                
                // Main summary box
                const summaryBox = boxen(
                    `${STYLES.info('Total Pools Found:')} ${STYLES.value(data.totalPools)} / 6
${STYLES.info('Conditional Pools:')} ${STYLES.value(data.conditionalPools.length)} (YES/YES, NO/NO)
${STYLES.info('Prediction Pools:')} ${STYLES.value(data.predictionPools.length)} (vs BASE_CURRENCY)`,
                    {
                        padding: 1,
                        borderStyle: 'round',
                        borderColor: 'blue',
                        title: '🏊 Pool Discovery Results',
                        titleAlignment: 'center'
                    }
                );
                console.log(summaryBox);
                
                // Show conditional pools
                if (data.conditionalPools.length > 0) {
                    console.log('\n' + STYLES.info('🔄 Conditional Token Pools (YES/NO pairs):'));
                    const condTable = new Table({
                        head: ['Pool Name', 'Address', 'Collateral'],
                        colWidths: [25, 45, 12],
                        style: {
                            head: ['cyan'],
                            border: ['gray']
                        }
                    });
                    
                    for (const pool of data.conditionalPools) {
                        condTable.push([
                            STYLES.highlight(pool.name),
                            STYLES.address(pool.address),
                            STYLES.value(pool.collateral)
                        ]);
                    }
                    console.log(condTable.toString());
                }
                
                // Show prediction pools
                if (data.predictionPools.length > 0) {
                    console.log('\n' + STYLES.info('📈 Prediction Pools (vs BASE_CURRENCY):'));
                    const predTable = new Table({
                        head: ['Pool #', 'Name', 'Address'],
                        colWidths: [8, 30, 45],
                        style: {
                            head: ['cyan'],
                            border: ['gray']
                        }
                    });
                    
                    for (const pool of data.predictionPools) {
                        predTable.push([
                            STYLES.value(pool.poolNumber || '-'),
                            STYLES.highlight(pool.name),
                            STYLES.address(pool.address)
                        ]);
                    }
                    console.log(predTable.toString());
                }
                
                // Fetch liquidity for discovered pools
                const allPoolAddresses = [
                    ...data.conditionalPools.map(p => p.address),
                    ...data.predictionPools.map(p => p.address)
                ].filter(addr => addr);
                
                if (allPoolAddresses.length > 0) {
                    const spinner2 = ora('Fetching liquidity information...').start();
                    
                    const liquidityResult = await this.dataLayer.fetch('pools.liquidity', { 
                        poolAddresses: allPoolAddresses 
                    });
                    
                    spinner2.stop();
                    
                    if (liquidityResult.status === 'success') {
                        console.log('\n' + STYLES.info('💧 Liquidity Status:'));
                        console.log(STYLES.dim('  Pools with liquidity:'), 
                            STYLES.value(`${liquidityResult.data.poolsWithLiquidity}/${liquidityResult.data.totalPools}`));
                    }
                }
                
                // Fetch and show prices
                const pricesResult = await this.dataLayer.fetch('pools.prices', { proposalAddress });
                
                if (pricesResult.status === 'success' && Object.keys(pricesResult.data.prices).length > 0) {
                    console.log('\n' + STYLES.info('💱 Current Pool Prices:'));
                    
                    for (const [poolName, priceData] of Object.entries(pricesResult.data.prices)) {
                        // Get token symbols for better display
                        const tokens = poolName.split('/');
                        if (priceData.price && priceData.priceInverse) {
                            console.log(STYLES.dim(`  ${poolName}:`));
                            console.log(STYLES.dim(`    1 ${tokens[0]} =`), STYLES.value(priceData.price.toFixed(6)), STYLES.dim(tokens[1]));
                            console.log(STYLES.dim(`    1 ${tokens[1]} =`), STYLES.value(priceData.priceInverse.toFixed(6)), STYLES.dim(tokens[0]));
                        }
                    }
                    
                    if (pricesResult.data.impliedProbabilities) {
                        const probs = pricesResult.data.impliedProbabilities;
                        console.log('\n' + STYLES.info('🎲 Implied Probabilities:'));
                        if (probs.fromCompany !== undefined) {
                            console.log(STYLES.dim('  From Company pools:'), 
                                STYLES.value(`${(probs.fromCompany * 100).toFixed(1)}% YES`));
                        }
                        if (probs.fromCurrency !== undefined) {
                            console.log(STYLES.dim('  From Currency pools:'), 
                                STYLES.value(`${(probs.fromCurrency * 100).toFixed(1)}% YES`));
                        }
                    }
                }
                
                // Show tokens
                console.log('\n' + STYLES.info('🪙 Tokens:'));
                console.log(STYLES.dim('  Company Token:'), STYLES.address(data.tokens.companyToken));
                console.log(STYLES.dim('  Currency Token:'), STYLES.address(data.tokens.currencyToken));
                console.log(STYLES.dim('  YES_COMPANY:'), STYLES.address(data.tokens.yesCompany));
                console.log(STYLES.dim('  NO_COMPANY:'), STYLES.address(data.tokens.noCompany));
                console.log(STYLES.dim('  YES_CURRENCY:'), STYLES.address(data.tokens.yesCurrency));
                console.log(STYLES.dim('  NO_CURRENCY:'), STYLES.address(data.tokens.noCurrency));
                
            } else {
                console.log(STYLES.error('❌ Failed to discover pools'));
                console.log(STYLES.dim(`Reason: ${discovery.reason}`));
            }
            
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }
    
    async handleViewProposals() {
        const { proposalAddress } = await inquirer.prompt([
            {
                type: 'input',
                name: 'proposalAddress',
                message: 'Enter proposal address (or press enter for default):',
                default: CONTRACTS.DEFAULT_PROPOSAL
            }
        ]);
        
        const spinner = ora('Fetching proposal data from blockchain...').start();
        
        try {
            // Fetch all proposal data in parallel
            const [details, tokens, outcomes, wrapped, status] = await Promise.all([
                this.dataLayer.fetch('proposal.details', { proposalAddress }),
                this.dataLayer.fetch('proposal.tokens', { proposalAddress }),
                this.dataLayer.fetch('proposal.outcomes', { proposalAddress }),
                this.dataLayer.fetch('proposal.wrapped', { proposalAddress }),
                this.dataLayer.fetch('proposal.status', { proposalAddress })
            ]);
            
            spinner.stop();
            
            if (details.status === 'success') {
                const data = details.data;
                
                // Main proposal info box
                const proposalBox = boxen(
                    `${STYLES.info('📝 Market Name:')} ${STYLES.value(data.marketName)}
${STYLES.info('❓ Question:')} ${STYLES.value(data.encodedQuestion)}
${STYLES.info('🔢 Outcomes:')} ${STYLES.value(data.numOutcomes)} (${outcomes.data?.outcomes?.join(', ') || 'YES, NO'})
${STYLES.info('📍 Address:')} ${STYLES.address(proposalAddress)}`,
                    {
                        padding: 1,
                        borderStyle: 'round',
                        borderColor: 'magenta',
                        title: '🏛️ Futarchy Proposal',
                        titleAlignment: 'center'
                    }
                );
                console.log(proposalBox);
                
                // Token information
                if (tokens.status === 'success') {
                    console.log('\n' + STYLES.info('💰 Collateral Tokens:'));
                    console.log(STYLES.dim('  Company Token:'), STYLES.value(tokens.data.companyToken.symbol), STYLES.address(`(${tokens.data.companyToken.address})`));
                    console.log(STYLES.dim('  Currency Token:'), STYLES.value(tokens.data.currencyToken.symbol), STYLES.address(`(${tokens.data.currencyToken.address})`));
                }
                
                // Wrapped outcomes table
                if (wrapped.status === 'success' && wrapped.data.wrappedOutcomes.length > 0) {
                    console.log('\n' + STYLES.info('🎯 Wrapped Outcome Tokens:'));
                    
                    const table = new Table({
                        head: ['Index', 'Type', 'Token Address'],
                        colWidths: [8, 15, 45],
                        style: {
                            head: ['cyan'],
                            border: ['gray']
                        }
                    });
                    
                    wrapped.data.wrappedOutcomes.forEach(outcome => {
                        table.push([
                            outcome.index,
                            STYLES.highlight(outcome.label),
                            STYLES.address(outcome.wrapped1155)
                        ]);
                    });
                    
                    console.log(table.toString());
                }
                
                // Realitio Status
                if (status.status === 'success') {
                    const statusData = status.data;
                    let statusColor = 'yellow';
                    let statusIcon = '⏳';
                    
                    if (statusData.status === 'FINALIZED') {
                        statusColor = 'green';
                        statusIcon = '✅';
                    } else if (statusData.status === 'PENDING_ARBITRATION') {
                        statusColor = 'red';
                        statusIcon = '⚖️';
                    } else if (statusData.status === 'OPEN_FOR_ANSWERS') {
                        statusColor = 'cyan';
                        statusIcon = '📝';
                    }
                    
                    const statusBox = boxen(
                        `${STYLES.info('Status:')} ${chalk[statusColor].bold(statusData.status)} ${statusIcon}
${STYLES.info('Finalized:')} ${statusData.isFinalized ? STYLES.success('Yes') : STYLES.warning('No')}
${STYLES.info('Opening Time:')} ${STYLES.value(statusData.openingTime)}
${statusData.finalizeTime ? STYLES.info('Finalize Time:') + ' ' + STYLES.value(statusData.finalizeTime) : ''}
${statusData.currentAnswer ? STYLES.info('Current Answer:') + ' ' + STYLES.highlight(statusData.currentAnswer) : ''}
${STYLES.info('Timeout:')} ${STYLES.value(statusData.timeout)}`,
                        {
                            padding: 1,
                            borderStyle: 'round',
                            borderColor: statusColor,
                            title: '⏰ Realitio Status',
                            titleAlignment: 'center'
                        }
                    );
                    console.log('\n' + statusBox);
                }
                
                // Additional details
                console.log('\n' + STYLES.info('📊 Technical Details:'));
                console.log(STYLES.dim('  Condition ID:'), STYLES.address(data.conditionId));
                console.log(STYLES.dim('  Question ID:'), STYLES.address(data.questionId));
                if (data.parentMarket !== '0x0000000000000000000000000000000000000000') {
                    console.log(STYLES.dim('  Parent Market:'), STYLES.address(data.parentMarket));
                    console.log(STYLES.dim('  Parent Outcome:'), STYLES.value(data.parentOutcome));
                }
                console.log(STYLES.dim('  Reality Proxy:'), STYLES.address(data.realityProxy));
                
            } else {
                console.log(STYLES.error('❌ Failed to fetch proposal data'));
                console.log(STYLES.dim(`Reason: ${details.reason}`));
            }
            
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }
    
    async handleBalances() {
        if (!this.isConnected) {
            console.log(STYLES.warning('\n⚠️  Wallet not connected. Please provide a private key in .env'));
            return;
        }
        
        const spinner = ora('Fetching balances...').start();
        
        try {
            // Get xDAI balance
            const xdaiBalance = await this.publicClient.getBalance({
                address: this.account.address
            });
            
            // Get sDAI balance
            const sdaiBalance = await this.publicClient.readContract({
                address: CONTRACTS.SDAI,
                abi: [{
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }]
                }],
                functionName: 'balanceOf',
                args: [this.account.address]
            });
            
            spinner.stop();
            
            const balanceBox = boxen(
                `${STYLES.info('xDAI Balance:')} ${STYLES.value(formatEther(xdaiBalance))} xDAI
${STYLES.info('sDAI Balance:')} ${STYLES.value(formatEther(sdaiBalance))} sDAI`,
                {
                    padding: 1,
                    borderStyle: 'double',
                    borderColor: 'cyan',
                    title: '💰 Account Balances',
                    titleAlignment: 'center'
                }
            );
            
            console.log(balanceBox);
            
        } catch (error) {
            spinner.fail(`Error fetching balances: ${error.message}`);
        }
    }

    async handleApprove() {
        if (!this.isConnected) {
            console.log(STYLES.warning('\n⚠️  Wallet not connected. Please provide a private key in .env'));
            return;
        }
        
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'tokenAddress',
                message: 'Token address to approve:',
                default: CONTRACTS.SDAI
            },
            {
                type: 'input',
                name: 'spenderAddress',
                message: 'Spender address:',
                default: CONTRACTS.FUTARCHY_ROUTER
            },
            {
                type: 'input',
                name: 'amount',
                message: 'Amount to approve (in tokens):',
                default: '100'
            }
        ]);
        
        const amountWei = parseEther(answers.amount);
        
        if (!this.autoConfirm) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Approve ${answers.amount} tokens for ${STYLES.address(answers.spenderAddress)}?`,
                    default: false
                }
            ]);
            
            if (!confirm) {
                console.log(STYLES.warning('Transaction cancelled'));
                return;
            }
        }
        
        const spinner = ora('Processing approval...').start();
        
        try {
            for await (const status of this.dataLayer.execute('web3.approve', {
                tokenAddress: answers.tokenAddress,
                spenderAddress: answers.spenderAddress,
                amount: amountWei
            })) {
                spinner.text = status.message;
                
                if (status.status === 'success') {
                    spinner.succeed(STYLES.success('✅ Approval successful!'));
                    console.log(STYLES.info('Transaction hash:'), STYLES.address(status.data?.transactionHash));
                } else if (status.status === 'error') {
                    spinner.fail(STYLES.error(`❌ Approval failed: ${status.error}`));
                }
            }
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }

    async handleSplitPosition() {
        if (!this.isConnected) {
            console.log(STYLES.warning('\n⚠️  Wallet not connected. Please provide a private key in .env'));
            return;
        }
        
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'proposalAddress',
                message: 'Proposal address:',
                default: CONTRACTS.DEFAULT_PROPOSAL
            },
            {
                type: 'input',
                name: 'amount',
                message: 'Amount of sDAI to split:',
                default: '10'
            }
        ]);
        
        const amountWei = parseEther(answers.amount);
        
        if (!this.autoConfirm) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Split ${answers.amount} sDAI into YES/NO tokens?`,
                    default: false
                }
            ]);
            
            if (!confirm) {
                console.log(STYLES.warning('Transaction cancelled'));
                return;
            }
        }
        
        const spinner = ora('Processing split position...').start();
        
        try {
            for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
                proposalAddress: answers.proposalAddress,
                amount: amountWei
            })) {
                spinner.text = status.message;
                
                if (status.status === 'success') {
                    spinner.succeed(STYLES.success('✅ Position split successful!'));
                    console.log(STYLES.info('Transaction hash:'), STYLES.address(status.data?.transactionHash));
                } else if (status.status === 'error') {
                    spinner.fail(STYLES.error(`❌ Split failed: ${status.error}`));
                }
            }
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }

    async handleTestOperations() {
        console.log('\n' + STYLES.info('🔍 Testing Available Operations'));
        
        // Show available operations
        const operations = this.dataLayer.getAvailableOperations();
        
        const table = new Table({
            head: ['Operation', 'Type', 'Status'],
            colWidths: [30, 15, 15],
            style: {
                head: ['cyan'],
                border: ['gray']
            }
        });
        
        operations.forEach(op => {
            const type = op.startsWith('pools') || op.startsWith('user') || op.startsWith('market') 
                ? 'Fetcher' 
                : 'Executor';
            const status = STYLES.success('✓ Available');
            table.push([op, type, status]);
        });
        
        console.log(table.toString());
        
        // Test a sample fetch operation
        const spinner = ora('Testing sample fetch operation...').start();
        
        try {
            const result = await this.dataLayer.fetch('market.stats', {});
            if (result.status === 'success') {
                spinner.succeed('Sample fetch successful!');
            } else {
                spinner.warn('Sample fetch returned no data');
            }
        } catch (error) {
            spinner.fail(`Test failed: ${error.message}`);
        }
    }

    async run() {
        await this.initialize();
        
        let running = true;
        while (running) {
            console.log('\n');
            const action = await this.showMainMenu();
            
            switch (action) {
                case 'market_data':
                    await this.handleMarketData();
                    break;
                case 'balances':
                    await this.handleBalances();
                    break;
                case 'proposals':
                    await this.handleViewProposals();
                    break;
                case 'discover_pools':
                    await this.handleDiscoverPools();
                    break;
                case 'approve':
                    await this.handleApprove();
                    break;
                case 'split':
                    await this.handleSplitPosition();
                    break;
                case 'redeem':
                    console.log(STYLES.info('💸 Redeem feature coming soon...'));
                    break;
                case 'custom':
                    console.log(STYLES.info('🎯 Custom operations coming soon...'));
                    break;
                case 'test':
                    await this.handleTestOperations();
                    break;
                case 'exit':
                    running = false;
                    break;
            }
        }
        
        console.log('\n' + STYLES.success('👋 Thanks for using Futarchy CLI!'));
        process.exit(0);
    }
}

// =============================================================================
// CUSTOM VIEM EXECUTOR WITH PRIVATE KEY SUPPORT
// =============================================================================

class ViemExecutorWithPrivateKey extends BaseExecutor {
    constructor(options = {}) {
        super();
        
        this.chain = options.chain || gnosis;
        this.rpcUrl = options.rpcUrl || 'https://rpc.gnosischain.com';
        this.walletClient = options.walletClient;
        this.publicClient = options.publicClient;
        this.account = options.account;
        
        this.cartridges = new Map();
        this.registerOperations();
    }
    
    registerOperations() {
        this.registerOperation('web3.approve', this.handleApprove.bind(this));
        this.registerOperation('web3.transfer', this.handleTransfer.bind(this));
        this.registerOperation('web3.getBalance', this.handleGetBalance.bind(this));
    }
    
    registerCartridge(cartridge) {
        const operations = cartridge.getSupportedOperations();
        operations.forEach(operation => {
            this.cartridges.set(operation, cartridge);
            this.supportedOperations.push(operation);
        });
        return this;
    }
    
    async* execute(dataPath, args = {}) {
        if (this.cartridges.has(dataPath)) {
            const cartridge = this.cartridges.get(dataPath);
            const viemClients = {
                publicClient: this.publicClient,
                walletClient: this.walletClient,
                account: this.account
            };
            yield* cartridge.execute(dataPath, args, viemClients);
            return;
        }
        
        if (dataPath in this.operations) {
            yield* this.operations[dataPath](args);
            return;
        }
        
        yield {
            status: 'error',
            message: `Operation '${dataPath}' not supported`
        };
    }
    
    async* handleApprove(args) {
        const { tokenAddress, spenderAddress, amount } = args;
        
        if (!this.account || !this.walletClient) {
            yield {
                status: 'error',
                message: 'Wallet not connected'
            };
            return;
        }
        
        const erc20Abi = [
            {
                name: 'approve',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [
                    { name: 'spender', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                ],
                outputs: [{ name: '', type: 'bool' }]
            }
        ];
        
        try {
            yield {
                status: 'pending',
                message: 'Preparing approval transaction...'
            };
            
            const hash = await this.walletClient.writeContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'approve',
                args: [spenderAddress, amount],
                account: this.account
            });
            
            yield {
                status: 'pending',
                message: 'Transaction submitted, waiting for confirmation...',
                data: { transactionHash: hash }
            };
            
            const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
            
            yield {
                status: 'success',
                message: 'Approval successful!',
                data: { 
                    transactionHash: hash,
                    blockNumber: receipt.blockNumber
                }
            };
            
        } catch (error) {
            yield {
                status: 'error',
                message: `Approval failed: ${error.message}`,
                error: error.message
            };
        }
    }
    
    async* handleGetBalance(args) {
        const { tokenAddress, userAddress } = args;
        const address = userAddress || this.account?.address;
        
        if (!address) {
            yield {
                status: 'error',
                message: 'No address provided'
            };
            return;
        }
        
        try {
            yield {
                status: 'pending',
                message: 'Fetching balance...'
            };
            
            let balance;
            
            if (tokenAddress) {
                const erc20Abi = [
                    {
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }
                ];
                
                balance = await this.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [address]
                });
            } else {
                balance = await this.publicClient.getBalance({ address });
            }
            
            yield {
                status: 'success',
                message: 'Balance retrieved successfully',
                data: { 
                    balance: balance.toString(),
                    formattedBalance: formatEther(balance)
                }
            };
            
        } catch (error) {
            yield {
                status: 'error',
                message: `Balance fetch failed: ${error.message}`,
                error: error.message
            };
        }
    }
    
    async* handleTransfer(args) {
        yield {
            status: 'error',
            message: 'Transfer not implemented yet'
        };
    }
}

// Import BaseExecutor for the custom executor
import { BaseExecutor } from './executors/BaseExecutor.js';

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main() {
    try {
        const cli = new FutarchyCLI();
        await cli.run();
    } catch (error) {
        console.error(STYLES.error(`\n❌ Fatal error: ${error.message}`));
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n' + STYLES.info('👋 Shutting down gracefully...'));
    process.exit(0);
});

// Run the CLI
main();
