#!/usr/bin/env node

// Complete Futarchy Management Interface
// Automatically discovers pools, manages positions, and handles approvals

import { DataLayer } from '../DataLayer.js';
import fs from 'fs';
import path from 'path';
import { createPoolDiscoveryFetcher } from '../fetchers/PoolDiscoveryFetcher.js';
import { createProposalFetcher } from '../fetchers/ProposalFetcher.js';
import MarketEventsFetcher from '../fetchers/MarketEventsFetcher.js';
import { FutarchyFetcher } from '../fetchers/FutarchyFetcher.js';
import { createTickSpreadFetcher } from '../fetchers/TickSpreadFetcher.js';
import { SdaiRateFetcher } from '../fetchers/SdaiRateFetcher.js';
import { ViemExecutor } from '../executors/ViemExecutor.js';
import { FutarchyCartridge } from '../executors/FutarchyCartridge.js';
import { UniswapRouterCartridge } from '../executors/UniswapRouterCartridge.js';
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { gnosis, polygon, mainnet } from 'viem/chains';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import dotenv from 'dotenv';

dotenv.config();

// Allow piping all console output to a log file for reproducible sessions
const LOG_PATH = process.env.FUTARCHY_LOG_FILE || process.env.FUTARCHY_LOG_PATH;
if (LOG_PATH) {
    try {
        const resolvedPath = path.isAbsolute(LOG_PATH) ? LOG_PATH : path.resolve(process.cwd(), LOG_PATH);
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        const logStream = fs.createWriteStream(resolvedPath, { flags: 'a' });
        logStream.write(`\n===== Futarchy complete script started ${new Date().toISOString()} =====\n`);

        const teeWrite = (origWrite) => function (chunk, encoding, callback) {
            try {
                if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
                    logStream.write(chunk);
                }
            } catch (_) {
                // Ignore logging failures to avoid interrupting CLI UX
            }
            return origWrite.call(this, chunk, encoding, callback);
        };

        process.stdout.write = teeWrite(process.stdout.write.bind(process.stdout));
        process.stderr.write = teeWrite(process.stderr.write.bind(process.stderr));

        const closeStream = () => {
            try { logStream.end(`\n===== Futarchy complete script ended ${new Date().toISOString()} =====\n`); } catch {}
        };
        process.on('exit', closeStream);
        process.on('SIGINT', () => { closeStream(); process.exit(130); });
        process.on('SIGTERM', () => { closeStream(); process.exit(143); });
    } catch (error) {
        console.error(`⚠️  Failed to initialise log file at ${LOG_PATH}: ${error.message}`);
    }
}

// Runtime chain config loader (defaults to Gnosis; keeps current behavior)
function loadRuntimeChainConfig() {
    try {
        const cfgPath = path.resolve(process.cwd(), 'runtime-chains.config.json');
        const raw = fs.readFileSync(cfgPath, 'utf8');
        const json = JSON.parse(raw);

        // Parse --chain=<id>
        const args = process.argv.slice(2);
        const chainArg = args.find(a => a.startsWith('--chain='));
        const cliChain = chainArg ? chainArg.split('=')[1] : null;
        const envChain = process.env.CHAIN_ID;
        const selectedId = String(cliChain || envChain || json.defaultChain || '100');

        const chain = json.chains?.[selectedId];
        if (!chain) {
            console.log(`⚠️  Chain ${selectedId} not found in runtime-chains.config.json; falling back to Gnosis (100)`);
            return { chainId: 100, name: 'Gnosis Chain', rpcUrl: process.env.RPC_URL || 'https://rpc.gnosischain.com', amm: 'swapr', futarchyRouter: '0x7495a583ba85875d59407781b4958ED6e0E1228f', conditionalTokens: '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce' };
        }

        // Prefer chain RPC when --chain is provided, else allow env override
        const useChainRpc = !!cliChain;
        const rpcUrl = useChainRpc ? chain.rpcUrl : (process.env.RPC_URL || chain.rpcUrl);

        return {
            chainId: Number(selectedId),
            name: chain.name || `chain-${selectedId}`,
            rpcUrl,
            amm: (chain.amm || 'swapr').toLowerCase(),
            futarchyRouter: chain.futarchyRouter || '0x7495a583ba85875d59407781b4958ED6e0E1228f',
            conditionalTokens: chain.conditionalTokens || '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce',
            uniswap: chain.uniswap || {},
            algebraFactory: chain.algebraFactory || null,
            gasConfig: chain.gasConfig || null
        };
    } catch (e) {
        // Fallback to current hardcoded Gnosis defaults
        return { chainId: 100, name: 'Gnosis Chain', rpcUrl: process.env.RPC_URL || 'https://rpc.gnosischain.com', amm: 'swapr', futarchyRouter: '0x7495a583ba85875d59407781b4958ED6e0E1228f', conditionalTokens: '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce' };
    }
}

const RUNTIME = loadRuntimeChainConfig();
const ROUTER_ADDRESS = RUNTIME.futarchyRouter;
const CONDITIONAL_TOKENS = RUNTIME.conditionalTokens;
// Explorer helpers
const EXPLORER_BASE = (RUNTIME.chainId === 137)
  ? 'https://polygonscan.com'
  : (RUNTIME.chainId === 1 ? 'https://etherscan.io' : 'https://gnosisscan.io');
const txLink = (hash) => `${EXPLORER_BASE}/tx/${hash}`;
const addressLink = (addr) => `${EXPLORER_BASE}/address/${addr}`;
// Select viem chain object based on runtime.chainId
const CHAIN_OBJ = (RUNTIME.chainId === 137)
  ? polygon
  : (RUNTIME.chainId === 1 ? mainnet : gnosis);
const SDAI_RATE_ENABLED = (RUNTIME?.sdaiRate?.enabled !== undefined)
  ? !!RUNTIME.sdaiRate.enabled
  : (RUNTIME.chainId === 100);

class FutarchyManager {
    constructor() {
        this.dataLayer = new DataLayer();
        this.proposal = null;
        this.pools = null;
        this.tokens = null;
        this.prices = null;
        this.balances = {};
        this.sdaiRate = null;
        
        // Initialize viem clients
        if (process.env.PRIVATE_KEY) {
            // Ensure private key has 0x prefix
            const privateKey = process.env.PRIVATE_KEY.startsWith('0x') 
                ? process.env.PRIVATE_KEY 
                : `0x${process.env.PRIVATE_KEY}`;
            this.account = privateKeyToAccount(privateKey);
            this.publicClient = createPublicClient({
                chain: CHAIN_OBJ,
                transport: http(RUNTIME.rpcUrl)
            });
            this.walletClient = createWalletClient({
                account: this.account,
                chain: CHAIN_OBJ,
                transport: http(RUNTIME.rpcUrl)
            });
            this.isConnected = true;
        } else {
            this.publicClient = createPublicClient({ chain: CHAIN_OBJ, transport: http(RUNTIME.rpcUrl) });
            this.isConnected = false;
        }

        console.log(`\n🔗 Chain: ${RUNTIME.name} (id: ${RUNTIME.chainId})`);
        console.log(`📡 RPC: ${RUNTIME.rpcUrl}`);
        console.log(`⚙️  AMM: ${RUNTIME.amm}`);
        console.log(`🧩 Futarchy Router: ${ROUTER_ADDRESS}`);
        
        // Register fetchers
        this.poolFetcher = createPoolDiscoveryFetcher({
            rpcUrl: RUNTIME.rpcUrl,
            mode: RUNTIME.amm === 'uniswap' ? 'uniswap' : 'algebra',
            uniswapFactory: RUNTIME.uniswap?.factory || null,
            chainId: RUNTIME.chainId
        });
        this.proposalFetcher = createProposalFetcher({ publicClient: this.publicClient });
        this.marketEventsFetcher = new MarketEventsFetcher();
        // Pass publicClient directly to FutarchyFetcher (now supports both formats)
        this.futarchyFetcher = new FutarchyFetcher(this.publicClient);
        this.tickSpreadFetcher = createTickSpreadFetcher();
        // Optional per-chain: sDAI rate fetcher
        if (SDAI_RATE_ENABLED) {
            this.sdaiRateFetcher = new SdaiRateFetcher({ publicClient: this.publicClient });
        }
        this.dataLayer.registerFetcher(this.poolFetcher);
        this.dataLayer.registerFetcher(this.proposalFetcher);
        this.dataLayer.registerFetcher(this.marketEventsFetcher);
        this.dataLayer.registerFetcher(this.futarchyFetcher);
        this.dataLayer.registerFetcher(this.tickSpreadFetcher);
        if (SDAI_RATE_ENABLED && this.sdaiRateFetcher) {
            this.dataLayer.registerFetcher(this.sdaiRateFetcher);
        } else {
            console.log('ℹ️  sDAI rate fetcher disabled for this chain');
        }
        
        // Register executor if connected
        if (this.isConnected) {
            this.executor = new ViemExecutor({
                chain: CHAIN_OBJ,
                publicClient: this.publicClient,
                walletClient: this.walletClient,
                account: this.account
            });
            
            // Add cartridge for enhanced operations with gas protection
            const cartridge = new FutarchyCartridge(ROUTER_ADDRESS, {
                swapMode: RUNTIME.amm === 'uniswap' ? 'uniswap' : 'swapr',
                swapRouter: RUNTIME.amm === 'uniswap' ? (RUNTIME.uniswap?.universalRouter || null) : null,
                swapConfig: RUNTIME.amm === 'uniswap' ? (RUNTIME.uniswap || null) : null,
                gasConfig: RUNTIME.gasConfig || null
            });
            this.executor.registerCartridge(cartridge);

            // Register UniswapRouterCartridge for chains using Uniswap (Ethereum & Polygon)
            // This is the new working implementation that handles V3 swaps correctly
            if (RUNTIME.chainId === 137 || RUNTIME.chainId === 1) {
                const uniswapCartridge = new UniswapRouterCartridge({
                    chainId: RUNTIME.chainId,
                    routerAddress: RUNTIME.uniswap?.universalRouter,
                    permit2Address: RUNTIME.uniswap?.permit2 || '0x000000000022D473030F116dDEE9F6B43aC78BA3',
                    defaultFee: 500 // 0.05% fee tier
                });
                this.executor.registerCartridge(uniswapCartridge);
                console.log(`✅ Registered UniswapRouterCartridge for ${RUNTIME.name} swaps via Universal Router`);
            }
            
            this.dataLayer.registerExecutor(this.executor);
        }
    }
    
    /**
     * Format price with USD conversion
     */
    formatPriceWithUSD(sdaiAmount, decimals = 4, compact = false) {
        if (!this.sdaiRate || this.sdaiRate <= 0) {
            // If no sDAI rate available, show as sDAI amount with $ prefix for consistency
            return `$${sdaiAmount.toFixed(decimals)}`;
        }
        
        const daiEquivalent = sdaiAmount * this.sdaiRate;
        const usdValue = daiEquivalent; // Assuming 1 DAI ≈ $1 USD
        
        if (compact) {
            // Compact format for proposal list
            return `$${usdValue.toFixed(2)}`;
        } else {
            // Detailed format for other displays
            return `${sdaiAmount.toFixed(decimals)} sDAI (~$${usdValue.toFixed(2)} USD)`;
        }
    }

    /**
     * Format price showing both sDAI and USD for maximum clarity
     */
    formatCompactPriceWithBothUnits(sdaiAmount) {
        if (!this.sdaiRate || this.sdaiRate <= 0) {
            // If no sDAI rate available, show sDAI amount only
            return `${sdaiAmount.toFixed(3)}s`;
        }
        
        const daiEquivalent = sdaiAmount * this.sdaiRate;
        const usdValue = daiEquivalent; // Assuming 1 DAI ≈ $1 USD
        
        // Ultra compact format: "0.030s/0.035" (removed $ to save space)
        // Use 3 decimals for both to keep it very short
        return `${sdaiAmount.toFixed(3)}s/${usdValue.toFixed(3)}`;
    }
    
    /**
     * Get USD equivalent of sDAI amount
     */
    getUSDValue(sdaiAmount) {
        if (!this.sdaiRate || this.sdaiRate <= 0) {
            return null;
        }
        return sdaiAmount * this.sdaiRate; // Assuming 1 DAI ≈ $1 USD
    }
    
    /**
     * Fetch and cache sDAI rate
     */
    async fetchSdaiRate() {
        try {
            const rateResult = await this.dataLayer.fetch('sdai.rate');
            if (rateResult.status === 'success') {
                this.sdaiRate = rateResult.data.rate;
                return this.sdaiRate;
            } else if (rateResult.status === 'warning' && rateResult.data?.rate) {
                // Use stale cached rate if available
                this.sdaiRate = rateResult.data.rate;
                console.log(chalk.yellow(`⚠️ Using stale sDAI rate: ${this.sdaiRate}`));
                return this.sdaiRate;
            }
        } catch (error) {
            console.log(chalk.yellow(`⚠️ Could not fetch sDAI rate: ${error.message}`));
        }
        return null;
    }
    
    async initialize() {
        console.log(chalk.cyan.bold('\n🚀 Futarchy Complete Manager\n'));
        
        // Fetch sDAI rate for USD conversions (only when enabled for this chain)
        if (SDAI_RATE_ENABLED) {
            const rateSpinner = ora('Fetching sDAI exchange rate...').start();
            await this.fetchSdaiRate();
            if (this.sdaiRate) {
                rateSpinner.succeed(`sDAI Rate: ${this.sdaiRate.toFixed(6)} (1 sDAI = ${this.sdaiRate.toFixed(4)} DAI ≈ $${this.sdaiRate.toFixed(2)} USD)`);
            } else {
                rateSpinner.warn('Could not fetch sDAI rate - USD conversions unavailable');
            }
        }
        
        if (this.isConnected) {
            const balance = await this.publicClient.getBalance({ 
                address: this.account.address 
            });
            
            const nativeSymbol = (CHAIN_OBJ?.nativeCurrency?.symbol || '').toUpperCase() || 'NATIVE';
            console.log(boxen(
                `✅ Connected to ${RUNTIME.name}\n` +
                `👛 Account: ${chalk.green(this.account.address)}\n` +
                `💰 Balance: ${chalk.yellow(formatEther(balance))} ${nativeSymbol}`,
                {
                    padding: 1,
                    borderStyle: 'round',
                    borderColor: 'green'
                }
            ));
        } else {
            console.log(chalk.yellow('⚠️  Read-only mode (no private key provided)'));
        }
    }
    
    /**
     * Format proposal choice with proper sDAI to USD conversion
     */
    formatProposalChoiceWithUSD(proposal) {
        const formatted = this.marketEventsFetcher.formatProposalForDisplay(proposal);
        const statusEmoji = proposal.event_status === 'open' ? '🟢' : 
                           proposal.event_status === 'resolved' ? '✅' : '⏸️';
        const visibilityBadge = proposal.visibility === 'public' ? '' : 
                                proposal.visibility === 'test' ? ' [TEST]' : 
                                proposal.visibility === 'private' ? ' [PRIVATE]' : '';
        const days = formatted.daysRemaining === 'Ended' ? '⏰ Ended' : 
                    `📅 ${formatted.daysRemaining} days`;
        
        // Show first 6 chars of address (0x + 4 chars) and last 3 chars
        const shortAddress = proposal.id ? 
            `${proposal.id.substring(0, 6)}...${proposal.id.substring(proposal.id.length - 3)}` : 
            'unknown';
        
        // Format prices with proper sDAI conversion if available
        let priceInfo = '';
        if (proposal.latestPrices && (proposal.latestPrices.yes || proposal.latestPrices.no)) {
            const yesPrice = proposal.latestPrices.yes !== null 
                ? `Y:${this.formatCompactPriceWithBothUnits(proposal.latestPrices.yes)}` 
                : 'Y:N/A';
            const noPrice = proposal.latestPrices.no !== null 
                ? `N:${this.formatCompactPriceWithBothUnits(proposal.latestPrices.no)}` 
                : 'N:N/A';
            priceInfo = `\n    💰 ${yesPrice} ${noPrice}`;
        }
        
        return {
            name: `${statusEmoji} [${shortAddress}] ${formatted.title.substring(0, 50)}${visibilityBadge} | ${days}${priceInfo}`,
            value: proposal,
            short: `${shortAddress} - ${formatted.title.substring(0, 40)}`
        };
    }

    async selectProposal() {
        // Try to fetch proposals from Supabase
        let proposalChoice;
        try {
            const spinner = ora('Fetching ALL proposals with latest prices...').start();
            
            // Get raw proposals with prices (not formatted choices)
            const proposals = await this.marketEventsFetcher.fetchMarketEventsWithPrices({ 
                eventStatus: undefined // Get all proposals including closed/test
            });
            
            // Format choices with proper sDAI conversion
            const choices = proposals.map(p => this.formatProposalChoiceWithUSD(p));
            
            // Add custom option
            choices.push({
                name: '📝 Enter custom proposal address',
                value: 'custom',
                short: 'Custom address'
            });
            
            spinner.stop();
            
            if (choices.length > 1) { // Has proposals + custom option
                const { selection } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'selection',
                        message: 'Select a proposal:',
                        choices: choices,
                        pageSize: 10
                    }
                ]);
                
                if (selection === 'custom') {
                    proposalChoice = null; // Will prompt for custom address
                } else {
                    // Use the selected proposal from Supabase
                    this.proposal = selection;
                    
                    // Extract tokens from Supabase metadata structure
                    this.tokens = {
                        companyToken: selection.metadata?.companyTokens?.base?.wrappedCollateralTokenAddress || selection.pool_yes,
                        currencyToken: selection.metadata?.currencyTokens?.base?.wrappedCollateralTokenAddress || selection.pool_no,
                        yesCompany: selection.metadata?.companyTokens?.yes?.wrappedCollateralTokenAddress,
                        noCompany: selection.metadata?.companyTokens?.no?.wrappedCollateralTokenAddress,
                        yesCurrency: selection.metadata?.currencyTokens?.yes?.wrappedCollateralTokenAddress,
                        noCurrency: selection.metadata?.currencyTokens?.no?.wrappedCollateralTokenAddress
                    };
                    
                    // Store the proposal address for later use
                    this.proposal.address = selection.id;
                    
                    return selection.id; // Return the proposal address
                }
            }
        } catch (error) {
            console.log(chalk.yellow('Could not fetch proposals from API, falling back to manual input'));
        }
        
        // Fallback to manual input
        const { proposalAddress } = await inquirer.prompt([
            {
                type: 'input',
                name: 'proposalAddress',
                message: 'Enter Futarchy proposal address:',
                default: '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371',
                validate: (input) => {
                    return /^0x[a-fA-F0-9]{40}$/.test(input) || 'Please enter a valid address';
                }
            }
        ]);
        
        // If we don't have proposal data yet (custom input), fetch it
        if (!this.proposal) {
            const spinner = ora('Loading proposal data...').start();
            
            try {
                // Fetch proposal details
                const [details, status, tokens, wrapped] = await Promise.all([
                    this.dataLayer.fetch('proposal.details', { proposalAddress }),
                    this.dataLayer.fetch('proposal.status', { proposalAddress }),
                    this.dataLayer.fetch('proposal.tokens', { proposalAddress }),
                    this.dataLayer.fetch('proposal.wrapped', { proposalAddress })
                ]);
                // Basic validation: ensure 'details' succeeded and has marketName
                if (details.status !== 'success' || !details.data?.marketName) {
                    throw new Error('Address does not look like a FutarchyProposal contract. Please provide a valid proposal address.');
                }

                spinner.succeed('Proposal loaded');

                this.proposal = {
                    address: proposalAddress,
                    details: details.data,
                    status: status.data,
                    tokens: tokens.data,
                    wrapped: wrapped.data
                };
                
                // Set tokens from fetched data
                this.tokens = tokens.data;
                
                // Display proposal info
                console.log(boxen(
                    `📝 ${chalk.cyan.bold(details.data.marketName)}\n` +
                    `❓ ${details.data.encodedQuestion}\n` +
                    `📊 Status: ${this.getStatusColor(status.data.status)}\n` +
                    `${status.data.currentAnswer ? `✅ Current Answer: ${chalk.bold(status.data.currentAnswer)}` : ''}`,
                    {
                        padding: 1,
                        borderStyle: 'round',
                        borderColor: 'magenta',
                        title: '🏛️ Proposal Information'
                    }
                ));
                
            } catch (error) {
                spinner.fail('Failed to load proposal');
                console.log(chalk.red(`\n⚠️ ${error.message}`));
                console.log(chalk.gray('Tip: Do not paste Uniswap router or token addresses; use the FutarchyProposal contract address.'));
                return null;
            }
        } else {
            // Display info from Supabase data
            const endDate = new Date(this.proposal.end_date);
            const now = new Date();
            const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            
            console.log(boxen(
                `📝 ${chalk.cyan.bold(this.proposal.title.substring(0, 100))}\n` +
                `📊 Status: ${this.getStatusColor(this.proposal.approval_status)}\n` +
                `📅 Days remaining: ${daysRemaining > 0 ? chalk.yellow(daysRemaining) : chalk.red('Ended')}\n` +
                `💰 Tokens: ${chalk.green(this.proposal.tokens)}\n` +
                `📈 Approval Price: ${chalk.green(this.proposal.approval_price)}\n` +
                `📉 Refusal Price: ${chalk.red(this.proposal.refusal_price)}`,
                {
                    padding: 1,
                    borderStyle: 'round',
                    borderColor: 'magenta',
                    title: '🏛️ Proposal Information'
                }
            ));
            
            // Try to fetch wrapped token info from blockchain for additional details
            const spinner = ora('Fetching additional token details from blockchain...').start();
            try {
                const wrapped = await this.dataLayer.fetch('proposal.wrapped', { 
                    proposalAddress: this.proposal.id 
                });
                if (wrapped.data) {
                    this.proposal.wrapped = wrapped.data;
                    spinner.succeed('Additional token details loaded from blockchain');
                } else {
                    spinner.text = 'Using token data from API';
                    spinner.succeed();
                }
            } catch (error) {
                // Not critical - we already have token addresses from Supabase
                spinner.warn('Could not fetch wrapped tokens from blockchain, using API data');
                console.log(chalk.gray('This is normal for some proposals'));
            }
            
            // Ensure we have all required token addresses
            if (!this.tokens.companyToken || !this.tokens.currencyToken) {
                // Try to fetch from proposal contract as fallback
                try {
                    const tokensFromContract = await this.dataLayer.fetch('proposal.tokens', { 
                        proposalAddress: this.proposal.id 
                    });
                    if (tokensFromContract.data) {
                        // Merge with existing tokens, preferring contract data
                        this.tokens = { ...this.tokens, ...tokensFromContract.data };
                        console.log(chalk.green('✅ Fetched missing token data from proposal contract'));
                    }
                } catch (err) {
                    console.log(chalk.yellow('⚠️ Could not fetch from proposal contract'));
                }
            }
        }
    }
    
    async fetchPoolStats() {
        // Initialize poolStats object
        this.poolStats = {};
        
        try {
            // Get all pool addresses
            const poolAddresses = [];
            
            // Get conditional pool addresses
            if (this.proposal.metadata?.conditional_pools) {
                if (this.proposal.metadata.conditional_pools.yes?.address) {
                    poolAddresses.push({
                        name: 'YES_CONDITIONAL',
                        address: this.proposal.metadata.conditional_pools.yes.address
                    });
                }
                if (this.proposal.metadata.conditional_pools.no?.address) {
                    poolAddresses.push({
                        name: 'NO_CONDITIONAL',
                        address: this.proposal.metadata.conditional_pools.no.address
                    });
                }
            }
            
            // Get prediction pool addresses  
            if (this.proposal.metadata?.prediction_pools) {
                if (this.proposal.metadata.prediction_pools.yes?.address) {
                    poolAddresses.push({
                        name: 'YES_PREDICTION',
                        address: this.proposal.metadata.prediction_pools.yes.address
                    });
                }
                if (this.proposal.metadata.prediction_pools.no?.address) {
                    poolAddresses.push({
                        name: 'NO_PREDICTION',
                        address: this.proposal.metadata.prediction_pools.no.address
                    });
                }
            }
            
            // Fetch stats for each pool
            if (poolAddresses.length > 0) {
                console.log(chalk.dim(`  Fetching liquidity/volume data...`));
            }
            
            for (const pool of poolAddresses) {
                try {
                    const stats = await this.dataLayer.fetch('tickspread.poolStats', {
                        poolId: pool.address
                    });
                    
                    if (stats.status === 'success') {
                        this.poolStats[pool.name] = stats.data;
                        // Only show success for pools with data
                        if (pool.name.includes('CONDITIONAL')) {
                            console.log(chalk.dim(`    ✓ ${pool.name}: Liq $${stats.data.summary.totalLiquidity}`));
                        }
                    }
                } catch (error) {
                    // Silently ignore errors for pools not in TickSpread
                }
            }
        } catch (error) {
            console.log(chalk.yellow('  Note: Pool statistics unavailable'));
        }
    }
    
    async discoverPools() {
        const spinner = ora('Discovering pools...').start();
        
        try {
            // Check if we already have data from Supabase
            if (this.proposal.metadata) {
                // Use data from Supabase
                spinner.text = 'Using pool data from API, fetching current prices...';
                
                // Set up pools structure from Supabase data
                this.pools = {
                    conditionalPools: [
                        {
                            name: 'YES_COMPANY/YES_CURRENCY',
                            address: this.proposal.metadata.conditional_pools?.yes?.address
                        },
                        {
                            name: 'NO_COMPANY/NO_CURRENCY', 
                            address: this.proposal.metadata.conditional_pools?.no?.address
                        }
                    ],
                    predictionPools: [
                        {
                            name: 'YES_COMPANY/BASE_CURRENCY',
                            address: this.proposal.metadata.prediction_pools?.yes?.address
                        },
                        {
                            name: 'NO_COMPANY/BASE_CURRENCY',
                            address: this.proposal.metadata.prediction_pools?.no?.address
                        }
                    ],
                    totalPools: 4
                };
                
                // We'll still need to fetch current prices
                spinner.text = 'Fetching current pool prices...';
                const prices = await this.dataLayer.fetch('pools.prices', { 
                    proposalAddress: this.proposal.id 
                });
                this.prices = prices.data.prices;
                
                spinner.succeed('Pool data and prices loaded');
                
            } else {
                // Fallback to regular discovery
                const discovery = await this.dataLayer.fetch('pools.discover', { 
                    proposalAddress: this.proposal.address 
                });
                
                const prices = await this.dataLayer.fetch('pools.prices', { 
                    proposalAddress: this.proposal.address 
                });
                
                spinner.succeed(`Found ${discovery.data.totalPools} pools`);
                
                this.pools = discovery.data;
                this.prices = prices.data.prices;
                this.tokens = discovery.data.tokens;
            }
            
            // Don't fetch liquidity/volume on initial load - user can view it via menu
            
            // Display all 6 pool prices correctly
            console.log('\n' + chalk.cyan.bold('💱 All Pool Prices:'));
            
            // Conditional Pools (how much currency to buy company token)
            console.log(chalk.yellow('\nConditional Pools:'));
            if (this.prices['YES_COMPANY/YES_CURRENCY']) {
                const pool = this.prices['YES_COMPANY/YES_CURRENCY'];
                // Determine which token is which and show price accordingly
                const yesCompanyIsToken0 = pool.token0.toLowerCase() === this.tokens.yesCompany.toLowerCase();
                const price = yesCompanyIsToken0 ? pool.price : pool.priceInverse;
                
                console.log(chalk.gray('  YES_COMPANY/YES_CURRENCY:'), `1 YES_COMPANY = ${price.toFixed(4)} YES_CURRENCY`);
            }
            if (this.prices['NO_COMPANY/NO_CURRENCY']) {
                const pool = this.prices['NO_COMPANY/NO_CURRENCY'];
                const noCompanyIsToken0 = pool.token0.toLowerCase() === this.tokens.noCompany.toLowerCase();
                const price = noCompanyIsToken0 ? pool.price : pool.priceInverse;
                
                console.log(chalk.gray('  NO_COMPANY/NO_CURRENCY:'), `1 NO_COMPANY = ${price.toFixed(4)} NO_CURRENCY`);
            }
            
            // Prediction Pools (how much sDAI to buy each token)
            console.log(chalk.yellow('\nPrediction Pools vs sDAI:'));
            
            // YES_COMPANY/sDAI
            if (this.prices['YES_COMPANY/BASE_CURRENCY']) {
                const pool = this.prices['YES_COMPANY/BASE_CURRENCY'];
                const yesCompanyIsToken0 = pool.token0.toLowerCase() === this.tokens.yesCompany.toLowerCase();
                const price = yesCompanyIsToken0 ? pool.price : pool.priceInverse;
                console.log(chalk.gray('  YES_COMPANY/sDAI:'), chalk.green(`1 YES_COMPANY = ${this.formatPriceWithUSD(price, 6)}`));
            }
            
            // NO_COMPANY/sDAI
            if (this.prices['NO_COMPANY/BASE_CURRENCY']) {
                const pool = this.prices['NO_COMPANY/BASE_CURRENCY'];
                const noCompanyIsToken0 = pool.token0.toLowerCase() === this.tokens.noCompany.toLowerCase();
                const price = noCompanyIsToken0 ? pool.price : pool.priceInverse;
                console.log(chalk.gray('  NO_COMPANY/sDAI:'), chalk.red(`1 NO_COMPANY = ${this.formatPriceWithUSD(price, 6)}`));
            }
            
            // YES_CURRENCY/sDAI
            if (this.prices['YES_CURRENCY/BASE_CURRENCY']) {
                const pool = this.prices['YES_CURRENCY/BASE_CURRENCY'];
                const yesCurrencyIsToken0 = pool.token0.toLowerCase() === this.tokens.yesCurrency.toLowerCase();
                const price = yesCurrencyIsToken0 ? pool.price : pool.priceInverse;
                
                console.log(chalk.gray('  YES_CURRENCY/sDAI:'), chalk.green(`1 YES_CURRENCY = ${this.formatPriceWithUSD(price, 6)}`));
            }
            
            // NO_CURRENCY/sDAI
            if (this.prices['NO_CURRENCY/BASE_CURRENCY']) {
                const pool = this.prices['NO_CURRENCY/BASE_CURRENCY'];
                const noCurrencyIsToken0 = pool.token0.toLowerCase() === this.tokens.noCurrency.toLowerCase();
                const price = noCurrencyIsToken0 ? pool.price : pool.priceInverse;
                
                console.log(chalk.gray('  NO_CURRENCY/sDAI:'), chalk.red(`1 NO_CURRENCY = ${this.formatPriceWithUSD(price, 6)}`));
            }
            
            // Display implied probabilities
            if (this.prices && Object.keys(this.prices).length > 0) {
                // Calculate implied probabilities from prices if we have them
                const prob = this.calculateImpliedProbabilities();
                
                // Use prediction currency method if available (most accurate)
                if (prob.fromPredictionCurrency) {
                    console.log('\n' + chalk.cyan('📊 Implied Probabilities:'));
                    
                    // Show direct prices as probabilities
                    const yesProb = (prob.fromPredictionCurrency.yes * 100).toFixed(1);
                    const noProb = (prob.fromPredictionCurrency.no * 100).toFixed(1);
                    console.log(chalk.gray('  Direct prices:'), 
                        chalk.green(`YES ${yesProb}%`), '/', 
                        chalk.red(`NO ${noProb}%`));
                    
                    // Show normalized if significantly different from 1.0
                    if (Math.abs(prob.fromPredictionCurrency.total - 1.0) > 0.1) {
                        const yesNorm = (prob.fromPredictionCurrency.yesNormalized * 100).toFixed(1);
                        const noNorm = (prob.fromPredictionCurrency.noNormalized * 100).toFixed(1);
                        console.log(chalk.gray('  Normalized:'), 
                            chalk.green(`YES ${yesNorm}%`), '/', 
                            chalk.red(`NO ${noNorm}%`));
                    }
                }
                // Fallback to company pools
                else if (prob.fromPredictionCompany) {
                    console.log('\n' + chalk.cyan('📊 Implied Probabilities:'));
                    const yesProb = (prob.fromPredictionCompany.yes * 100).toFixed(1);
                    const noProb = (prob.fromPredictionCompany.no * 100).toFixed(1);
                    console.log(chalk.gray('  Direct:'), 
                        chalk.green(`YES ${yesProb}%`), '/', 
                        chalk.red(`NO ${noProb}%`));
                }
            }
            
        } catch (error) {
            spinner.fail('Failed to discover pools');
            throw error;
        }
    }
    
    calculateImpliedProbabilities() {
        // Try to calculate from prediction currency pools
        if (this.prices['YES_CURRENCY/BASE_CURRENCY'] && this.prices['NO_CURRENCY/BASE_CURRENCY']) {
            const yesPool = this.prices['YES_CURRENCY/BASE_CURRENCY'];
            const noPool = this.prices['NO_CURRENCY/BASE_CURRENCY'];
            
            const yesCurrencyIsToken0 = yesPool.token0.toLowerCase() === this.tokens.yesCurrency.toLowerCase();
            const yesPrice = yesCurrencyIsToken0 ? yesPool.price : yesPool.priceInverse;
            
            const noCurrencyIsToken0 = noPool.token0.toLowerCase() === this.tokens.noCurrency.toLowerCase();
            const noPrice = noCurrencyIsToken0 ? noPool.price : noPool.priceInverse;
            
            const total = yesPrice + noPrice;
            
            return {
                fromPredictionCurrency: {
                    yes: yesPrice,
                    no: noPrice,
                    total: total,
                    yesNormalized: yesPrice / total,
                    noNormalized: noPrice / total
                }
            };
        }
        
        // Fallback to company pools
        if (this.prices['YES_COMPANY/BASE_CURRENCY'] && this.prices['NO_COMPANY/BASE_CURRENCY']) {
            const yesPool = this.prices['YES_COMPANY/BASE_CURRENCY'];
            const noPool = this.prices['NO_COMPANY/BASE_CURRENCY'];
            
            const yesCompanyIsToken0 = yesPool.token0.toLowerCase() === this.tokens.yesCompany.toLowerCase();
            const yesPrice = yesCompanyIsToken0 ? yesPool.price : yesPool.priceInverse;
            
            const noCompanyIsToken0 = noPool.token0.toLowerCase() === this.tokens.noCompany.toLowerCase();
            const noPrice = noCompanyIsToken0 ? noPool.price : noPool.priceInverse;
            
            const total = yesPrice + noPrice;
            
            return {
                fromPredictionCompany: {
                    yes: yesPrice,
                    no: noPrice,
                    total: total,
                    yesNormalized: yesPrice / total,
                    noNormalized: noPrice / total
                }
            };
        }
        
        return null;
    }
    
    async fetchBalances() {
        if (!this.isConnected) return;
        
        const spinner = ora('Fetching balances...').start();
        
        try {
            // Get collateral token symbols
            const [companySymbol, currencySymbol] = await Promise.all([
                this.publicClient.readContract({
                    address: this.tokens.companyToken,
                    abi: [{
                        name: 'symbol',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ name: '', type: 'string' }]
                    }],
                    functionName: 'symbol'
                }).catch(() => 'COMPANY'),
                this.publicClient.readContract({
                    address: this.tokens.currencyToken,
                    abi: [{
                        name: 'symbol',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ name: '', type: 'string' }]
                    }],
                    functionName: 'symbol'
                }).catch(() => 'CURRENCY')
            ]);
            
            // Get collateral token balances
            const [companyBalance, currencyBalance] = await Promise.all([
                this.publicClient.readContract({
                    address: this.tokens.companyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                }),
                this.publicClient.readContract({
                    address: this.tokens.currencyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                })
            ]);
            
            // Get wrapped token balances - handle both data sources
            let wrappedBalances = [];
            
            if (this.proposal.wrapped && this.proposal.wrapped.wrappedOutcomes) {
                // Use wrapped data from blockchain fetch
                const balancePromises = this.proposal.wrapped.wrappedOutcomes.map(async (outcome) => {
                    const balance = await this.publicClient.readContract({
                        address: outcome.wrapped1155,
                        abi: [{
                            name: 'balanceOf',
                            type: 'function',
                            stateMutability: 'view',
                            inputs: [{ name: 'account', type: 'address' }],
                            outputs: [{ name: '', type: 'uint256' }]
                        }],
                        functionName: 'balanceOf',
                        args: [this.account.address]
                    }).catch(() => 0n);
                    
                    return { label: outcome.label, balance };
                });
                
                wrappedBalances = await Promise.all(balancePromises);
            } else if (this.tokens && this.tokens.yesCompany) {
                // Use token addresses from Supabase data
                const tokenMap = [
                    { label: 'YES_COMPANY', address: this.tokens.yesCompany },
                    { label: 'NO_COMPANY', address: this.tokens.noCompany },
                    { label: 'YES_CURRENCY', address: this.tokens.yesCurrency },
                    { label: 'NO_CURRENCY', address: this.tokens.noCurrency }
                ].filter(t => t.address); // Filter out undefined addresses
                
                const balancePromises = tokenMap.map(async (token) => {
                    const balance = await this.publicClient.readContract({
                        address: token.address,
                        abi: [{
                            name: 'balanceOf',
                            type: 'function',
                            stateMutability: 'view',
                            inputs: [{ name: 'account', type: 'address' }],
                            outputs: [{ name: '', type: 'uint256' }]
                        }],
                        functionName: 'balanceOf',
                        args: [this.account.address]
                    }).catch(() => 0n);
                    
                    return { label: token.label, balance };
                });
                
                wrappedBalances = await Promise.all(balancePromises);
            }
            
            spinner.succeed('Balances fetched');
            
            // Store balances
            this.balances.company = companyBalance;
            this.balances.currency = currencyBalance;
            wrappedBalances.forEach(({ label, balance }) => {
                this.balances[label] = balance;
            });
            
            // Display balances
            console.log('\n' + chalk.cyan.bold('💰 Your Balances:'));
            
            // Show collateral tokens
            console.log(chalk.blue('Collateral Tokens:'));
            console.log(chalk.gray(`  ${companySymbol}:`), chalk.yellow(formatEther(companyBalance)));
            console.log(chalk.gray(`  ${currencySymbol}:`), chalk.yellow(formatEther(currencyBalance)));
            
            // Show conditional tokens
            const hasConditionalTokens = wrappedBalances.some(({ balance }) => balance > 0n);
            if (hasConditionalTokens) {
                console.log(chalk.blue('\nConditional Tokens:'));
                wrappedBalances.forEach(({ label, balance }) => {
                    if (balance > 0n) {
                        console.log(chalk.gray(`  ${label}:`), chalk.yellow(formatEther(balance)));
                    }
                });
            }
            
        } catch (error) {
            spinner.fail('Failed to fetch balances');
        }
    }
    
    async viewLiquidityAndVolume() {
        const spinner = ora('Fetching liquidity and volume data...').start();
        
        try {
            // Fetch pool stats
            await this.fetchPoolStats();
            spinner.stop();
            
            // Display liquidity and volume in a nice box
            console.log(boxen(
                chalk.cyan.bold('💧 Pool Liquidity & Volume Analysis\n\n') +
                
                chalk.yellow('🔀 Conditional Markets:\n') +
                this.formatPoolStats('YES_CONDITIONAL', 'YES_COMPANY/YES_CURRENCY') +
                this.formatPoolStats('NO_CONDITIONAL', 'NO_COMPANY/NO_CURRENCY') +
                
                chalk.yellow('\n📊 Prediction Markets:\n') +
                this.formatPoolStats('YES_PREDICTION', 'YES_CURRENCY/sDAI') +
                this.formatPoolStats('NO_PREDICTION', 'NO_CURRENCY/sDAI') +
                
                '\n' + chalk.dim('Data provided by TickSpread API'),
                {
                    padding: 1,
                    borderStyle: 'round',
                    borderColor: 'cyan',
                    title: '📊 Market Depth Analysis',
                    titleAlignment: 'center'
                }
            ));
            
            // Show trading insights
            this.displayTradingInsights();
            
        } catch (error) {
            spinner.fail('Failed to fetch liquidity data');
            console.error(chalk.red('Error:'), error.message);
        }
    }
    
    formatPoolStats(poolKey, poolName) {
        if (!this.poolStats || !this.poolStats[poolKey]) {
            return chalk.gray(`  ${poolName}: No data available\n`);
        }
        
        const stats = this.poolStats[poolKey];
        const liquidity = parseFloat(stats.summary.totalLiquidity).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        const volume = parseFloat(stats.summary.volume24h).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        // Calculate volume/liquidity ratio (turnover)
        const turnover = (parseFloat(stats.summary.volume24h) / parseFloat(stats.summary.totalLiquidity) * 100).toFixed(1);
        
        return chalk.white(`  ${poolName}:\n`) +
               chalk.gray(`    💰 Liquidity: ${chalk.green(liquidity)}\n`) +
               chalk.gray(`    📈 24h Volume: ${chalk.yellow(volume)}\n`) +
               chalk.gray(`    🔄 Turnover: ${chalk.cyan(turnover + '%')}\n`);
    }
    
    displayTradingInsights() {
        if (!this.poolStats) return;
        
        // Calculate total liquidity and volume
        let totalLiquidity = 0;
        let totalVolume = 0;
        let poolCount = 0;
        
        Object.values(this.poolStats).forEach(stats => {
            if (stats && stats.summary) {
                totalLiquidity += parseFloat(stats.summary.totalLiquidity || 0);
                totalVolume += parseFloat(stats.summary.volume24h || 0);
                poolCount++;
            }
        });
        
        if (poolCount > 0) {
            console.log(chalk.cyan('\n💡 Market Insights:'));
            
            // Total market stats
            console.log(chalk.gray(`  Total Liquidity: ${chalk.green(totalLiquidity.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
            }))}`));
            console.log(chalk.gray(`  Total 24h Volume: ${chalk.yellow(totalVolume.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
            }))}`));
            
            // Find most liquid pool
            let mostLiquid = null;
            let maxLiquidity = 0;
            
            Object.entries(this.poolStats).forEach(([key, stats]) => {
                if (stats && stats.summary && parseFloat(stats.summary.totalLiquidity) > maxLiquidity) {
                    maxLiquidity = parseFloat(stats.summary.totalLiquidity);
                    mostLiquid = key;
                }
            });
            
            if (mostLiquid) {
                const poolNames = {
                    'YES_CONDITIONAL': 'YES Conditional',
                    'NO_CONDITIONAL': 'NO Conditional',
                    'YES_PREDICTION': 'YES Prediction',
                    'NO_PREDICTION': 'NO Prediction'
                };
                console.log(chalk.gray(`  Most Liquid: ${chalk.cyan(poolNames[mostLiquid] || mostLiquid)}`));
            }
            
            // Trading recommendations
            const avgTurnover = (totalVolume / totalLiquidity * 100);
            if (avgTurnover > 20) {
                console.log(chalk.green(`  ✅ High activity market (${avgTurnover.toFixed(1)}% daily turnover)`));
            } else if (avgTurnover > 5) {
                console.log(chalk.yellow(`  ⚠️ Moderate activity (${avgTurnover.toFixed(1)}% daily turnover)`));
            } else {
                console.log(chalk.red(`  ⚠️ Low activity market (${avgTurnover.toFixed(1)}% daily turnover)`));
            }
        }
    }
    
    async viewPositions() {
        if (!this.isConnected) {
            console.log(chalk.yellow('⚠️  Please connect wallet to view positions'));
            return;
        }
        
        const spinner = ora('Calculating positions...').start();
        
        try {
            // Fetch user positions using FutarchyFetcher
            const result = await this.dataLayer.fetch('futarchy.positions', {
                proposalAddress: this.proposal.address || this.proposal.id,
                userAddress: this.account.address
            });
            
            spinner.stop();
            
            if (result.status !== 'success') {
                console.log(chalk.red('❌ Failed to calculate positions'));
                return;
            }
            
            const { mergeable, positions, summary } = result.data;
            
            // Display positions in a nice box
            console.log(boxen(
                chalk.cyan.bold('📈 Your Positions Analysis\n\n') +
                
                chalk.blue('🔄 Mergeable (Paired) Amounts:\n') +
                chalk.gray('  These YES/NO pairs can be merged back to collateral\n') +
                chalk.yellow(`  Company Tokens: ${mergeable.company.formatted}\n`) +
                chalk.yellow(`  Currency Tokens: ${mergeable.currency.formatted}\n\n`) +
                
                chalk.blue('📊 Net Positions (Unpaired):\n') +
                chalk.gray('  Your actual trading positions after pairing\n') +
                chalk.green(`  Company: ${positions.company.description}\n`) +
                chalk.green(`  Currency: ${positions.currency.description}\n\n`) +
                
                chalk.blue('📋 Summary:\n') +
                chalk.gray(`  Has Positions: ${summary.hasPositions ? chalk.green('Yes') : chalk.red('No')}\n`) +
                chalk.gray(`  Has Mergeable: ${summary.hasMergeable ? chalk.green('Yes') : chalk.red('No')}\n`) +
                chalk.gray(`  Total Value: ${chalk.yellow(summary.totalValue)} tokens`),
                {
                    padding: 1,
                    borderStyle: 'round',
                    borderColor: 'cyan',
                    title: '💼 Position Analysis',
                    titleAlignment: 'center'
                }
            ));
            
            // Provide actionable insights
            if (summary.hasMergeable) {
                console.log(chalk.cyan('\n💡 Tip: You have mergeable tokens that can be converted back to collateral using "Merge Position"'));
            }
            
            if (positions.company.isLong || positions.currency.isLong) {
                console.log(chalk.green(`\n📈 You're betting on YES outcome with:`));
                if (positions.company.isLong) {
                    console.log(chalk.gray(`   - ${positions.company.formatted} company tokens`));
                }
                if (positions.currency.isLong) {
                    console.log(chalk.gray(`   - ${positions.currency.formatted} currency tokens`));
                }
            }
            
            if (!positions.company.isLong || !positions.currency.isLong) {
                console.log(chalk.red(`\n📉 You're betting on NO outcome with:`));
                if (!positions.company.isLong && positions.company.raw !== '0') {
                    console.log(chalk.gray(`   - ${positions.company.formatted} company tokens`));
                }
                if (!positions.currency.isLong && positions.currency.raw !== '0') {
                    console.log(chalk.gray(`   - ${positions.currency.formatted} currency tokens`));
                }
            }
            
        } catch (error) {
            spinner.fail('Failed to calculate positions');
            console.error(chalk.red('Error:'), error.message);
        }
    }
    
    async closePosition() {
        if (!this.isConnected) {
            console.log(chalk.red('❌ Wallet not connected'));
            return;
        }
        
        const spinner = ora('Analyzing positions...').start();
        
        try {
            // First, fetch current positions
            const positionsResult = await this.dataLayer.fetch('futarchy.positions', {
                proposalAddress: this.proposal.address || this.proposal.id,
                userAddress: this.account.address
            });
            
            if (positionsResult.status !== 'success') {
                spinner.fail('Failed to fetch positions');
                return;
            }
            
            const positionsData = positionsResult.data;
            
            // Also fetch raw balances to know exact amounts
            const balancesResult = await this.dataLayer.fetch('futarchy.balances', {
                proposalAddress: this.proposal.address || this.proposal.id,
                userAddress: this.account.address
            });
            
            if (balancesResult.status !== 'success') {
                spinner.fail('Failed to fetch balances');
                return;
            }
            
            spinner.stop();
            
            const { outcomeTokens } = balancesResult.data;
            
            // Check what positions exist
            const hasCompanyPosition = positionsData.positions.company.raw !== '0';
            const hasCurrencyPosition = positionsData.positions.currency.raw !== '0';
            
            if (!hasCompanyPosition && !hasCurrencyPosition) {
                console.log(chalk.yellow('⚠️ No positions to close'));
                return;
            }
            
            // Display current positions
            console.log(boxen(
                chalk.cyan.bold('🚪 Close Position\n\n') +
                chalk.blue('Current Positions:\n') +
                (hasCompanyPosition ? 
                    chalk.gray(`  Company: ${positionsData.positions.company.description}\n`) : 
                    chalk.dim(`  Company: No position\n`)) +
                (hasCurrencyPosition ? 
                    chalk.gray(`  Currency: ${positionsData.positions.currency.description}\n`) : 
                    chalk.dim(`  Currency: No position\n`)),
                {
                    padding: 1,
                    borderStyle: 'round',
                    borderColor: 'cyan'
                }
            ));
            
            // Build choices for what to close
            const closeChoices = [];
            
            if (hasCompanyPosition) {
                const isYes = positionsData.positions.company.side === 'YES';
                closeChoices.push({
                    name: `🏢 Close Company ${positionsData.positions.company.side} position (${positionsData.positions.company.formatted} tokens) - Sell to market`,
                    value: {
                        type: 'company',
                        side: positionsData.positions.company.side,
                        amount: isYes ? outcomeTokens.yesCompany.raw : outcomeTokens.noCompany.raw,
                        tokenAddress: isYes ? this.tokens.yesCompany : this.tokens.noCompany,
                        description: `Sell ${positionsData.positions.company.formatted} ${positionsData.positions.company.side}_COMPANY tokens`
                    }
                });
            }
            
            if (hasCurrencyPosition) {
                const isYes = positionsData.positions.currency.side === 'YES';
                
                // Determine method based on company position
                let method, methodDesc, description;
                
                if (!hasCompanyPosition) {
                    // No company position - use prediction market
                    method = 'prediction';
                    methodDesc = 'Sell via prediction market (no company position)';
                    description = `Sell ${positionsData.positions.currency.formatted} ${positionsData.positions.currency.side}_CURRENCY via prediction market`;
                } else if (positionsData.positions.company.side === positionsData.positions.currency.side) {
                    // Both positions on same side - use prediction to avoid increasing position
                    method = 'prediction';
                    methodDesc = 'Sell via prediction market (avoid increasing same-side position)';
                    description = `Sell ${positionsData.positions.currency.formatted} ${positionsData.positions.currency.side}_CURRENCY via prediction market`;
                } else {
                    // Positions on opposite sides - can use conditional to neutralize
                    method = 'conditional';
                    methodDesc = `Buy ${positionsData.positions.currency.side} company tokens via conditional market`;
                    description = `Buy ${positionsData.positions.currency.side}_COMPANY to close ${positionsData.positions.currency.formatted} ${positionsData.positions.currency.side}_CURRENCY`;
                }
                    
                closeChoices.push({
                    name: `💰 Close Currency ${positionsData.positions.currency.side} position (${positionsData.positions.currency.formatted} tokens) - ${methodDesc}`,
                    value: {
                        type: 'currency',
                        side: positionsData.positions.currency.side,
                        amount: isYes ? outcomeTokens.yesCurrency.raw : outcomeTokens.noCurrency.raw,
                        tokenAddress: isYes ? this.tokens.yesCurrency : this.tokens.noCurrency,
                        method: method,
                        description: description
                    }
                });
            }
            
            closeChoices.push({
                name: '❌ Cancel',
                value: null
            });
            
            const { positionToClose } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'positionToClose',
                    message: 'Which position would you like to close?',
                    choices: closeChoices
                }
            ]);
            
            if (!positionToClose) {
                console.log(chalk.gray('Cancelled'));
                return;
            }
            
            // Display clear explanation of what will happen
            console.log(boxen(
                chalk.yellow.bold('⚠️ Position Closing Strategy\n\n') +
                chalk.white(positionToClose.description) + '\n\n' +
                (positionToClose.type === 'company' ? 
                    chalk.gray('• This will sell your company tokens directly to the market\n') +
                    chalk.gray('• You will receive currency tokens in return\n') :
                    positionToClose.method === 'conditional' ?
                        chalk.gray('• This will buy same-side company tokens via conditional market\n') +
                        chalk.gray('• Your currency position will be neutralized\n') +
                        chalk.gray('• You can then merge the paired tokens\n') :
                        chalk.gray('• This will sell your currency tokens via prediction market\n') +
                        chalk.gray('• You will receive base currency in return\n')
                ),
                {
                    padding: 1,
                    borderStyle: 'double',
                    borderColor: 'yellow',
                    title: '📋 Closing Strategy',
                    titleAlignment: 'center'
                }
            ));
            
            const { confirmClose } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmClose',
                    message: `Proceed with closing this position?`,
                    default: false
                }
            ]);
            
            if (!confirmClose) {
                console.log(chalk.gray('Cancelled'));
                return;
            }
            
            // Execute the close based on type
            if (positionToClose.type === 'company') {
                // Closing company position - sell the tokens
                await this.executeCloseCompanyPosition(positionToClose);
            } else {
                // Closing currency position
                if (positionToClose.method === 'conditional') {
                    // Buy opposite company tokens via conditional market
                    await this.executeCloseCurrencyViaConditional(positionToClose);
                } else {
                    // Sell via prediction market
                    await this.executeCloseCurrencyViaPrediction(positionToClose);
                }
            }
            
        } catch (error) {
            spinner.fail('Failed to close position');
            console.error(chalk.red('Error:'), error.message);
        }
    }
    
    async executeCloseCompanyPosition(position) {
        console.log(chalk.cyan(`\n🔄 Closing ${position.side}_COMPANY position...`));
        
        // We're selling company tokens, which means using conditional markets
        // Set up the swap parameters
        const isYes = position.side === 'YES';
        const tokenIn = isYes ? this.tokens.yesCompany : this.tokens.noCompany;
        const tokenOut = isYes ? this.tokens.yesCurrency : this.tokens.noCurrency;
        
        // Determine which pool to use (conditional pool)
        const poolAddress = position.side === 'YES' ? 
            this.proposal.metadata?.conditional_pools?.yes?.address :
            this.proposal.metadata?.conditional_pools?.no?.address;
            
        if (!poolAddress) {
            console.log(chalk.red('❌ Could not find appropriate conditional pool'));
            return;
        }
        
        console.log(chalk.gray(`Using conditional pool: ${poolAddress}`));
        console.log(chalk.yellow(`Selling ${position.side}_COMPANY → ${position.side}_CURRENCY`));
        
        // Get price info if available
        const poolName = isYes ? 'YES_COMPANY/YES_CURRENCY' : 'NO_COMPANY/NO_CURRENCY';
        const priceData = this.prices?.[poolName];
        let displayPrice = null;
        
        if (priceData) {
            // Determine which token is token0 and get the correct price
            const companyToken = isYes ? this.tokens.yesCompany : this.tokens.noCompany;
            const companyIsToken0 = priceData.token0.toLowerCase() === companyToken.toLowerCase();
            // If company is token0, price = currency/company. If company is token1, we need inverse
            displayPrice = companyIsToken0 ? priceData.price : priceData.priceInverse;
            console.log(chalk.gray(`Current exchange rate: ${displayPrice.toFixed(4)} ${position.side}_CURRENCY per ${position.side}_COMPANY`));
        }
        
        // Ask for amount to sell
        const { amount, slippageInput } = await inquirer.prompt([
            {
                type: 'input',
                name: 'amount',
                message: `Amount of ${position.side}_COMPANY to sell (max: ${formatEther(position.amount)}):`,
                default: formatEther(position.amount),
                validate: (input) => {
                    const num = parseFloat(input);
                    if (num <= 0) return 'Please enter a positive amount';
                    if (parseEther(input) > BigInt(position.amount)) return 'Amount exceeds balance';
                    return true;
                }
            },
            {
                type: 'input',
                name: 'slippageInput',
                message: 'Slippage tolerance (%):',
                default: '2',
                validate: (input) => {
                    const num = parseFloat(input);
                    if (isNaN(num) || num < 0.1 || num > 50) {
                        return 'Please enter a valid slippage between 0.1% and 50%';
                    }
                    return true;
                }
            }
        ]);
        
        const amountWei = parseEther(amount);
        const slippage = parseFloat(slippageInput) / 100;
        
        // Calculate expected output and show estimation
        const expectedOut = displayPrice ? parseFloat(amount) * displayPrice : parseFloat(amount) * 0.01;
        const minOut = expectedOut * (1 - slippage);
        
        console.log(chalk.cyan('\n━━━ 📊 Trade Estimation ━━━'));
        console.log(chalk.white(`  You sell:    ${amount} ${position.side}_COMPANY`));
        console.log(chalk.green(`  You receive: ~${expectedOut.toFixed(6)} ${position.side}_CURRENCY`));
        if (displayPrice) {
            console.log(chalk.gray(`  Exchange rate: ${displayPrice.toFixed(4)} ${position.side}_CURRENCY per ${position.side}_COMPANY`));
        }
        console.log(chalk.gray(`  Minimum output: ${minOut.toFixed(6)} ${position.side}_CURRENCY (with ${slippage * 100}% slippage)`));
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━'));
        
        // Ask if user wants to run simulation
        const { runSimulation } = await inquirer.prompt([{
            type: 'confirm',
            name: 'runSimulation',
            message: 'Run simulation to calculate exact output and price impact?',
            default: true
        }]);
        
        if (runSimulation) {
            const simSpinner = ora('Running swap simulation...').start();
            try {
                if (RUNTIME.amm === 'uniswap' && RUNTIME.uniswap?.quoterV4) {
                    const fee = (position.side === 'YES' ? (this.prices?.['YES_COMPANY/YES_CURRENCY']?.fee) : (this.prices?.['NO_COMPANY/NO_CURRENCY']?.fee)) ?? 500;
                    let simulatedOutput = null;
                    for await (const st of this.dataLayer.execute('uniswap.quote', {
                        tokenIn,
                        tokenOut,
                        amountIn: formatEther(amountWei),
                        fee,
                        tickSpacing: 10,
                        hooks: '0x0000000000000000000000000000000000000000'
                    })) {
                        if (st.status === 'success') {
                            simulatedOutput = formatEther(BigInt(st.data.amountOut));
                            break;
                        } else if (st.status === 'error') {
                            throw new Error(st.message || 'Quote failed');
                        }
                    }
                    const priceImpact = ((parseFloat(simulatedOutput) - expectedOut) / expectedOut * 100).toFixed(2);
                    simSpinner.succeed('Simulation complete!');
                    console.log(chalk.cyan('\n━━━ ✅ Simulation Results ━━━'));
                    console.log(chalk.white(`  Exact output: ${simulatedOutput} ${position.side}_CURRENCY`));
                    console.log(chalk.yellow(`  Price impact: ${priceImpact}%`));
                    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━'));
                } else {
                    simSpinner.warn('Simulation skipped for this AMM in demo path');
                }
            } catch (error) {
                simSpinner.fail(`Simulation failed: ${error.message}`);
                console.log(chalk.yellow('Proceeding without simulation...'));
            }
        }
        
        // Ask for final confirmation
        const { confirmSwap } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirmSwap',
            message: `Proceed with closing ${position.side}_COMPANY position?`,
            default: true
        }]);
        
        if (!confirmSwap) {
            console.log(chalk.gray('Cancelled'));
            return;
        }
        
        // On Polygon, use the new UniswapRouterCartridge for swaps
        if (RUNTIME.chainId === 137 && this.executor) {
            console.log('[DEBUG] Using UniswapRouterCartridge for Universal Router swap');
            const uniSpinner = ora('Executing swap via Universal Router...').start();
            try {
                const poolName = targetSide === 'YES' ? 'YES_COMPANY/YES_CURRENCY' : 'NO_COMPANY/NO_CURRENCY';
                const dynamicFee = (this.prices?.[poolName]?.fee) ?? 500;
                for await (const st of this.dataLayer.execute('uniswap.universal.swapV3', {
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    amountIn: formatEther(amountWei),
                    minAmountOut: '0', // Accept any amount for now
                    fee: dynamicFee
                })) {
                    console.log('[DEBUG][Universal Router] status:', st);
                    if (st.status === 'pending') uniSpinner.text = `${st.step ?? 'pending'}: ${st.message || uniSpinner.text}`;
                    if (st.status === 'success') {
                        uniSpinner.succeed('Swap executed successfully!');
                        const txh = st.data?.transactionHash || st.data?.hash;
                        if (txh) {
                            console.log(chalk.green('✅ Transaction Hash:'), txh);
                            console.log(chalk.gray('View on Explorer:'), txLink(txh));
                        }
                        await this.fetchBalances();
                        return;
                    }
                    if (st.status === 'error') {
                        throw new Error(st.message || 'Swap failed');
                    }
                }
            } catch (e) {
                uniSpinner.fail(`Swap failed: ${e.message}`);
            }
        }

        if (RUNTIME.chainId === 137) {
            const uniSpinner = ora('Executing swap via Universal Router...').start();
            try {
                const dynamicFee = (position.side === 'YES' ? (this.prices?.['YES_COMPANY/YES_CURRENCY']?.fee) : (this.prices?.['NO_COMPANY/NO_CURRENCY']?.fee)) ?? 500;
                for await (const st of this.dataLayer.execute('uniswap.universal.swapV3', {
                    tokenIn,
                    tokenOut,
                    amountIn: formatEther(amountWei),
                    minAmountOut: '0',
                    fee: dynamicFee
                })) {
                    console.log('[DEBUG][Universal Router] status:', st);
                    if (st.status === 'pending') uniSpinner.text = `${st.step ?? 'pending'}: ${st.message || uniSpinner.text}`;
                    if (st.status === 'success') {
                        uniSpinner.succeed('Company position closed successfully!');
                        const txh = st.data?.transactionHash || st.data?.hash;
                        if (txh) {
                            console.log(chalk.green('✅ Transaction Hash:'), txh);
                            console.log(chalk.gray('View on Explorer:'), txLink(txh));
                        }
                        await this.fetchBalances();
                        return;
                    }
                    if (st.status === 'error') throw new Error(st.message || 'Swap failed');
                }
            } catch (error) {
                uniSpinner.fail(`Swap failed: ${error.message}`);
            }
        } else {
            // Algebra fallback kept for Gnosis
            if (RUNTIME.chainId === 137) {
                console.log('[DEBUG] Algebra fallback disabled on Polygon (using Universal Router)');
                return;
            }
            const algebraRouter = '0xffb643e73f280b97809a8b41f7232ab401a04ee1';
            console.log(chalk.cyan('Checking token approval...'));
            await this.ensureApprovalWithStatus(tokenIn, algebraRouter, amountWei, `${position.side}_COMPANY`);
            const swapSpinner = ora('Executing swap on conditional market...').start();
            try {
                const minAmountOut = parseEther((minOut).toFixed(18));
                const deadline = Math.floor(Date.now() / 1000) + 1200;
                const hash = await this.walletClient.writeContract({ address: algebraRouter, abi: [{ name: 'exactInputSingle', type: 'function', stateMutability: 'payable', inputs: [{ name: 'params', type: 'tuple', components: [ { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'deadline', type: 'uint256' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' }, { name: 'limitSqrtPrice', type: 'uint160' } ] }], outputs: [{ name: 'amountOut', type: 'uint256' }] }], functionName: 'exactInputSingle', args: [{ tokenIn, tokenOut, recipient: this.account.address, deadline: BigInt(deadline), amountIn: amountWei, amountOutMinimum: minAmountOut, limitSqrtPrice: 0n }] });
                swapSpinner.text = `Transaction submitted: ${hash.slice(0, 10)}...`;
                const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'success') {
                    swapSpinner.succeed('Company position closed successfully!');
                    console.log(chalk.green('✅ Transaction Hash:'), hash);
                    console.log(chalk.gray('View on Explorer:'), txLink(hash));
                    console.log(chalk.cyan(`\n📊 Result: Sold ${amount} ${position.side}_COMPANY for ${position.side}_CURRENCY`));
                    await this.fetchBalances();
                } else {
                    swapSpinner.fail('Transaction failed');
                }
            } catch (error) {
                swapSpinner.fail(`Swap failed: ${error.message}`);
            }
        }
    }
    
    async executeCloseCurrencyViaConditional(position) {
        console.log(chalk.cyan(`\n🔄 Closing ${position.side}_CURRENCY position via conditional market...`));
        
        // To close currency position, we buy SAME side company tokens
        const targetSide = position.side; // SAME side, not opposite!
        console.log(chalk.gray(`Strategy: Buy ${targetSide}_COMPANY tokens to neutralize position`));
        
        // We're buying same-side company tokens with same-side currency tokens
        const tokenIn = targetSide === 'YES' ? this.tokens.yesCurrency : this.tokens.noCurrency;
        const tokenOut = targetSide === 'YES' ? this.tokens.yesCompany : this.tokens.noCompany;
        
        // Use the same-side conditional pool
        const poolAddress = this.proposal.metadata?.conditional_pools?.[targetSide.toLowerCase()]?.address;
        
        if (!poolAddress) {
            console.log(chalk.red('❌ Could not find appropriate conditional pool'));
            return;
        }
        
        console.log(chalk.gray(`Using conditional pool: ${poolAddress}`));
        console.log(chalk.yellow(`Buying ${targetSide}_COMPANY with ${targetSide}_CURRENCY`));
        
        // Get price info if available
        const poolName = targetSide === 'YES' ? 'YES_COMPANY/YES_CURRENCY' : 'NO_COMPANY/NO_CURRENCY';
        const price = this.prices?.[poolName];
        
        if (price) {
            console.log(chalk.gray(`Current exchange rate: ${(1/price.price).toFixed(4)} ${targetSide}_COMPANY per ${targetSide}_CURRENCY`));
        }
        
        // Ask for amount
        const { amount, slippageInput } = await inquirer.prompt([
            {
                type: 'input',
                name: 'amount',
                message: `Amount of ${targetSide}_CURRENCY to spend (to buy ${targetSide}_COMPANY):`,
                default: formatEther(position.amount), // Use the currency position amount
                validate: (input) => {
                    const num = parseFloat(input);
                    if (num <= 0) return 'Please enter a positive amount';
                    // Note: We might need to check actual balance of opposite currency
                    return true;
                }
            },
            {
                type: 'input',
                name: 'slippageInput',
                message: 'Slippage tolerance (%):',
                default: '2',
                validate: (input) => {
                    const num = parseFloat(input);
                    if (isNaN(num) || num < 0.1 || num > 50) {
                        return 'Please enter a valid slippage between 0.1% and 50%';
                    }
                    return true;
                }
            }
        ]);
        
        const amountWei = parseEther(amount);
        const slippage = parseFloat(slippageInput) / 100;
        
        // Calculate expected output and show estimation
        const expectedOut = price ? parseFloat(amount) / price.price : parseFloat(amount);
        const minOut = expectedOut * (1 - slippage);
        
        console.log(chalk.cyan('\n━━━ 📊 Trade Estimation ━━━'));
        console.log(chalk.white(`  You spend:   ${amount} ${targetSide}_CURRENCY`));
        console.log(chalk.green(`  You receive: ~${expectedOut.toFixed(6)} ${targetSide}_COMPANY`));
        if (price) {
            console.log(chalk.gray(`  Exchange rate: ${(1/price.price).toFixed(4)} ${targetSide}_COMPANY per ${targetSide}_CURRENCY`));
        }
        console.log(chalk.gray(`  Minimum output: ${minOut.toFixed(6)} ${targetSide}_COMPANY (with ${slippage * 100}% slippage)`));
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━'));
        
        // Ask if user wants to run simulation
        const { runSimulation } = await inquirer.prompt([{
            type: 'confirm',
            name: 'runSimulation',
            message: 'Run simulation to calculate exact output and price impact?',
            default: true
        }]);
        
        if (runSimulation) {
            const simSpinner = ora('Running swap simulation...').start();
            
            try {
                const fee = (this.prices?.[poolName]?.fee) ?? 500;
                // Simulate via v4 Quoter when AMM=uniswap
                if (RUNTIME.amm === 'uniswap' && RUNTIME.uniswap?.quoterV4) {
                    let simulatedOutput = null;
                    for await (const st of this.dataLayer.execute('uniswap.quote', {
                        tokenIn,
                        tokenOut,
                        amountIn: formatEther(amountWei),
                        fee,
                        tickSpacing: 10,
                        hooks: '0x0000000000000000000000000000000000000000'
                    })) {
                        if (st.status === 'success') { simulatedOutput = formatEther(BigInt(st.data.amountOut)); break; }
                        if (st.status === 'error') throw new Error(st.message || 'Quote failed');
                    }
                    const priceImpact = ((parseFloat(simulatedOutput) - expectedOut) / expectedOut * 100).toFixed(2);
                    simSpinner.succeed('Simulation complete!');
                    console.log(chalk.cyan('\n━━━ ✅ Simulation Results ━━━'));
                    console.log(chalk.white(`  Exact output: ${simulatedOutput} ${targetSide}_COMPANY`));
                    console.log(chalk.yellow(`  Price impact: ${priceImpact}%`));
                    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━'));
                } else {
                    simSpinner.warn('Skipping simulation on this AMM in the demo path');
                }
                
                
            } catch (error) {
                simSpinner.fail(`Simulation failed: ${error.message}`);
                console.log(chalk.yellow('Proceeding without simulation...'));
            }
        }
        
        // Ask for final confirmation
        const { confirmSwap } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirmSwap',
            message: `Proceed with buying ${targetSide}_COMPANY to close position?`,
            default: true
        }]);
        
        if (!confirmSwap) {
            console.log(chalk.gray('Cancelled'));
            return;
        }
        
        // Check if we have enough of the currency tokens
        const balance = await this.publicClient.readContract({
            address: tokenIn,
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
        
        if (balance < amountWei) {
            console.log(chalk.yellow(`\n⚠️ Insufficient ${targetSide}_CURRENCY balance`));
            console.log(chalk.gray(`Available: ${formatEther(balance)}`));
            console.log(chalk.gray(`Needed: ${amount}`));
            console.log(chalk.yellow(`You may need to split collateral first to get ${targetSide}_CURRENCY tokens`));
            return;
        }
        
        if (RUNTIME.chainId === 137) {
            const swapSpinner = ora('Executing swap on conditional market via Universal Router...').start();
            try {
                const dynamicFee = (this.prices?.[poolName]?.fee) ?? 500;
                for await (const st of this.dataLayer.execute('uniswap.universal.swapV3', {
                    tokenIn,
                    tokenOut,
                    amountIn: formatEther(amountWei),
                    minAmountOut: '0',
                    fee: dynamicFee
                })) {
                    if (st.status === 'pending') swapSpinner.text = st.message || swapSpinner.text;
                    if (st.status === 'success') {
                        swapSpinner.succeed('Currency position closed via conditional market!');
                        const txh = st.data?.transactionHash || st.data?.hash;
                        if (txh) {
                            console.log(chalk.green('✅ Transaction Hash:'), txh);
                            console.log(chalk.gray('View on Explorer:'), txLink(txh));
                        }
                        await this.fetchBalances();
                        return;
                    }
                    if (st.status === 'error') throw new Error(st.message || 'Swap failed');
                }
            } catch (e) {
                swapSpinner.fail(`Swap failed: ${e.message}`);
            }
        } else {
            // Fallback to Algebra on Gnosis
            const algebraRouter = '0xffb643e73f280b97809a8b41f7232ab401a04ee1';
            console.log(chalk.cyan('Checking token approval...'));
            await this.ensureApprovalWithStatus(tokenIn, algebraRouter, amountWei, `${targetSide}_CURRENCY`);
            const swapSpinner = ora('Executing swap on conditional market...').start();
            try {
                const expectedOut = price ? parseFloat(amount) / price.price : parseFloat(amount);
                const minAmountOut = parseEther((expectedOut * (1 - slippage)).toFixed(18));
                const deadline = Math.floor(Date.now() / 1000) + 1200;
                // Debug details before sending
                try {
                    const cid = await this.publicClient.getChainId();
                    console.log('[DEBUG][Algebra Conditional] chainId:', cid);
                } catch {}
                console.log('[DEBUG][Algebra Conditional] params:', {
                    tokenIn,
                    tokenOut,
                    amountIn: formatEther(amountWei),
                    minOut: formatEther(minAmountOut),
                    deadline
                });
                const hash = await this.walletClient.writeContract({
                    address: algebraRouter,
                    abi: [{ name: 'exactInputSingle', type: 'function', stateMutability: 'payable', inputs: [{ name: 'params', type: 'tuple', components: [ { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'deadline', type: 'uint256' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' }, { name: 'limitSqrtPrice', type: 'uint160' } ] }], outputs: [{ name: 'amountOut', type: 'uint256' }] }],
                    functionName: 'exactInputSingle',
                    args: [{ tokenIn, tokenOut, recipient: this.account.address, deadline: BigInt(deadline), amountIn: amountWei, amountOutMinimum: minAmountOut, limitSqrtPrice: 0n }]
                });
                console.log('[DEBUG][Algebra Conditional] tx hash:', hash);
                swapSpinner.text = `Transaction submitted: ${hash.slice(0, 10)}...`;
                const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'success') {
                    swapSpinner.succeed('Currency position closed via conditional market!');
                    console.log(chalk.green('✅ Transaction Hash:'), hash);
                    console.log(chalk.gray('View on Explorer:'), txLink(hash));
                    console.log(chalk.cyan(`\n📊 Result: Bought ${targetSide}_COMPANY to neutralize ${position.side}_CURRENCY position`));
                    console.log(chalk.yellow('💡 Tip: You can now use "Merge Position" to combine paired tokens'));
                    await this.fetchBalances();
                } else {
                    swapSpinner.fail('Transaction failed');
                }
            } catch (error) {
                swapSpinner.fail(`Swap failed: ${error.message}`);
                console.log('[DEBUG][Algebra Conditional] error:', error);
            }
        }
    }
    
    async executeCloseCurrencyViaPrediction(position) {
        console.log(chalk.cyan(`\n🔄 Closing ${position.side}_CURRENCY position via prediction market...`));
        console.log(chalk.gray('No company position exists - using prediction market directly'));
        
        // Selling currency tokens for base currency (sDAI)
        const isYes = position.side === 'YES';
        const tokenIn = isYes ? this.tokens.yesCurrency : this.tokens.noCurrency;
        const tokenOut = this.tokens.currencyToken; // sDAI
        
        // Use prediction pool
        const poolAddress = this.proposal.metadata?.prediction_pools?.[position.side.toLowerCase()]?.address;
        
        if (!poolAddress) {
            console.log(chalk.red('❌ Could not find appropriate prediction pool'));
            return;
        }
        
        console.log(chalk.gray(`Using prediction pool: ${poolAddress}`));
        console.log(chalk.yellow(`Selling ${position.side}_CURRENCY → sDAI`));
        
        // Get price info if available
        const poolName = isYes ? 'YES_CURRENCY/BASE_CURRENCY' : 'NO_CURRENCY/BASE_CURRENCY';
        const price = this.prices?.[poolName];
        
        if (price) {
            const displayPrice = price.token0.toLowerCase() === tokenIn.toLowerCase() ? 
                price.price : price.priceInverse;
            console.log(chalk.gray(`Current price: ${displayPrice.toFixed(4)} sDAI per ${position.side}_CURRENCY`));
            console.log(chalk.yellow(`Implied probability: ${(displayPrice * 100).toFixed(2)}%`));
        }
        
        // Ask for amount
        const { amount, slippageInput } = await inquirer.prompt([
            {
                type: 'input',
                name: 'amount',
                message: `Amount of ${position.side}_CURRENCY to sell (max: ${formatEther(position.amount)}):`,
                default: formatEther(position.amount),
                validate: (input) => {
                    const num = parseFloat(input);
                    if (num <= 0) return 'Please enter a positive amount';
                    if (parseEther(input) > BigInt(position.amount)) return 'Amount exceeds balance';
                    return true;
                }
            },
            {
                type: 'input',
                name: 'slippageInput',
                message: 'Slippage tolerance (%):',
                default: '2',
                validate: (input) => {
                    const num = parseFloat(input);
                    if (isNaN(num) || num < 0.1 || num > 50) {
                        return 'Please enter a valid slippage between 0.1% and 50%';
                    }
                    return true;
                }
            }
        ]);
        
        const amountWei = parseEther(amount);
        const slippage = parseFloat(slippageInput) / 100;
        
        if (RUNTIME.chainId === 137) {
            const swapSpinner = ora('Executing swap on prediction market via Universal Router...').start();
            try {
                let expectedOut = parseFloat(amount);
                if (price) {
                    const displayPrice = price.token0.toLowerCase() === tokenIn.toLowerCase() ? price.price : price.priceInverse;
                    expectedOut = parseFloat(amount) * displayPrice;
                }
                const dynamicFee = (this.prices?.[poolName]?.fee) ?? 500;
                for await (const st of this.dataLayer.execute('uniswap.universal.swapV3', {
                    tokenIn,
                    tokenOut,
                    amountIn: formatEther(amountWei),
                    minAmountOut: '0',
                    fee: dynamicFee
                })) {
                    if (st.status === 'pending') swapSpinner.text = st.message || swapSpinner.text;
                    if (st.status === 'success') {
                        swapSpinner.succeed('Currency position closed via prediction market!');
                        const txh = st.data?.transactionHash || st.data?.hash;
                        if (txh) {
                            console.log(chalk.green('✅ Transaction Hash:'), txh);
                            console.log(chalk.gray('View on Explorer:'), txLink(txh));
                        }
                        await this.fetchBalances();
                        return;
                    }
                    if (st.status === 'error') throw new Error(st.message || 'Swap failed');
                }
            } catch (error) {
                swapSpinner.fail(`Swap failed: ${error.message}`);
            }
        } else {
            // Fallback Algebra route
            if (RUNTIME.amm === 'uniswap') {
                console.log('[DEBUG] Algebra fallback disabled on Uniswap chains (Polygon)');
                return;
            }
            const algebraRouter = '0xffb643e73f280b97809a8b41f7232ab401a04ee1';
            console.log(chalk.cyan('Checking token approval...'));
            await this.ensureApprovalWithStatus(tokenIn, algebraRouter, amountWei, `${position.side}_CURRENCY`);
            const swapSpinner = ora('Executing swap on prediction market...').start();
            try {
                let expectedOut = parseFloat(amount);
                if (price) {
                    const displayPrice = price.token0.toLowerCase() === tokenIn.toLowerCase() ? price.price : price.priceInverse;
                    expectedOut = parseFloat(amount) * displayPrice;
                }
                const minAmountOut = parseEther((expectedOut * (1 - slippage)).toFixed(18));
                const deadline = Math.floor(Date.now() / 1000) + 1200;
                // Debug details before sending
                try {
                    const cid = await this.publicClient.getChainId();
                    console.log('[DEBUG][Algebra Prediction] chainId:', cid);
                } catch {}
                console.log('[DEBUG][Algebra Prediction] params:', {
                    tokenIn,
                    tokenOut,
                    amountIn: formatEther(amountWei),
                    minOut: formatEther(minAmountOut),
                    deadline
                });
                const hash = await this.walletClient.writeContract({
                    address: algebraRouter,
                    abi: [{ name: 'exactInputSingle', type: 'function', stateMutability: 'payable', inputs: [{ name: 'params', type: 'tuple', components: [ { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'deadline', type: 'uint256' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' }, { name: 'limitSqrtPrice', type: 'uint160' } ] }], outputs: [{ name: 'amountOut', type: 'uint256' }] }],
                    functionName: 'exactInputSingle',
                    args: [{ tokenIn, tokenOut, recipient: this.account.address, deadline: BigInt(deadline), amountIn: amountWei, amountOutMinimum: minAmountOut, limitSqrtPrice: 0n }]
                });
                console.log('[DEBUG][Algebra Prediction] tx hash:', hash);
                swapSpinner.text = `Transaction submitted: ${hash.slice(0, 10)}...`;
                const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'success') {
                    swapSpinner.succeed('Currency position closed via prediction market!');
                    console.log(chalk.green('✅ Transaction Hash:'), hash);
                    console.log(chalk.gray('View on Explorer:'), txLink(hash));
                    console.log(chalk.cyan(`\n📊 Result: Sold ${amount} ${position.side}_CURRENCY for sDAI`));
                    await this.fetchBalances();
                } else {
                    swapSpinner.fail('Transaction failed');
                }
            } catch (error) {
                swapSpinner.fail(`Swap failed: ${error.message}`);
                console.log('[DEBUG][Algebra Prediction] error:', error);
            }
        }
    }
    
    async splitPosition() {
        if (!this.isConnected) {
            console.log(chalk.red('❌ Wallet not connected'));
            return;
        }
        
        const spinner = ora('Fetching collateral token info...').start();
        
        try {
            // Get collateral token symbols and balances
            const [companySymbol, currencySymbol, companyBalance, currencyBalance] = await Promise.all([
                this.publicClient.readContract({
                    address: this.tokens.companyToken,
                    abi: [{
                        name: 'symbol',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ name: '', type: 'string' }]
                    }],
                    functionName: 'symbol'
                }).catch(() => 'COMPANY'),
                this.publicClient.readContract({
                    address: this.tokens.currencyToken,
                    abi: [{
                        name: 'symbol',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ name: '', type: 'string' }]
                    }],
                    functionName: 'symbol'
                }).catch(() => 'CURRENCY'),
                this.publicClient.readContract({
                    address: this.tokens.companyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                }).catch(() => 0n),
                this.publicClient.readContract({
                    address: this.tokens.currencyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                }).catch(() => 0n)
            ]);
            
            spinner.stop();
            
            // Show available collateral tokens
            console.log(chalk.cyan('\n💰 Available Collateral Tokens:'));
            console.log(chalk.gray(`  1. ${companySymbol}:`), chalk.yellow(formatEther(companyBalance)), chalk.gray(`(${this.tokens.companyToken.slice(0, 8)}...)`));
            console.log(chalk.gray(`  2. ${currencySymbol}:`), chalk.yellow(formatEther(currencyBalance)), chalk.gray(`(${this.tokens.currencyToken.slice(0, 8)}...)`));
            
            const { collateralChoice, amount } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'collateralChoice',
                    message: 'Which collateral token to split?',
                    choices: [
                        { name: `${companySymbol} (Balance: ${formatEther(companyBalance)})`, value: 'company' },
                        { name: `${currencySymbol} (Balance: ${formatEther(currencyBalance)})`, value: 'currency' }
                    ]
                },
                {
                    type: 'input',
                    name: 'amount',
                    message: (answers) => {
                        const token = answers.collateralChoice === 'company' ? companySymbol : currencySymbol;
                        const balance = answers.collateralChoice === 'company' ? companyBalance : currencyBalance;
                        return `Amount of ${token} to split into YES/NO tokens (max: ${formatEther(balance)}):`;
                    },
                    default: '10',
                    validate: (input, answers) => {
                        const num = parseFloat(input);
                        if (num <= 0) return 'Please enter a positive amount';
                        const maxBalance = answers.collateralChoice === 'company' ? companyBalance : currencyBalance;
                        if (parseEther(input) > maxBalance) return 'Amount exceeds balance';
                        return true;
                    }
                }
            ]);
            
            const splitSpinner = ora('Splitting position...').start();
            
            // Determine which collateral to use
            const isCompanyCollateral = collateralChoice === 'company';
            const collateralToken = isCompanyCollateral ? this.tokens.companyToken : this.tokens.currencyToken;
            const collateralSymbol = isCompanyCollateral ? companySymbol : currencySymbol;
            
            // Get YES/NO token addresses we'll receive (from wrapped outcomes)
            const yesLabel = isCompanyCollateral ? 'YES_COMPANY' : 'YES_CURRENCY';
            const noLabel = isCompanyCollateral ? 'NO_COMPANY' : 'NO_CURRENCY';
            
            let yesToken, noToken;
            
            // Handle both data sources: blockchain (wrapped) and Supabase (tokens)
            if (this.proposal.wrapped && this.proposal.wrapped.wrappedOutcomes) {
                // Use wrapped data from blockchain
                const yesOutcome = this.proposal.wrapped.wrappedOutcomes.find(o => o.label === yesLabel);
                const noOutcome = this.proposal.wrapped.wrappedOutcomes.find(o => o.label === noLabel);
                yesToken = yesOutcome ? yesOutcome.wrapped1155 : this.tokens[isCompanyCollateral ? 'yesCompany' : 'yesCurrency'];
                noToken = noOutcome ? noOutcome.wrapped1155 : this.tokens[isCompanyCollateral ? 'noCompany' : 'noCurrency'];
            } else if (this.tokens) {
                // Use token addresses from Supabase data
                yesToken = this.tokens[isCompanyCollateral ? 'yesCompany' : 'yesCurrency'];
                noToken = this.tokens[isCompanyCollateral ? 'noCompany' : 'noCurrency'];
            } else {
                throw new Error('No token data available for split operation');
            }
            
            // Get balances before split
            splitSpinner.text = 'Checking balances before split...';
            const [yesBalanceBefore, noBalanceBefore] = await Promise.all([
                this.publicClient.readContract({
                    address: yesToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                }).catch(() => 0n),
                this.publicClient.readContract({
                    address: noToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                }).catch(() => 0n)
            ]);
            
            splitSpinner.stop();
            console.log(chalk.cyan('\n📊 Balances Before Split:'));
            if (isCompanyCollateral) {
                console.log(chalk.gray(`  YES_COMPANY: ${formatEther(yesBalanceBefore)}`));
                console.log(chalk.gray(`  NO_COMPANY: ${formatEther(noBalanceBefore)}`));
            } else {
                console.log(chalk.gray(`  YES_CURRENCY: ${formatEther(yesBalanceBefore)}`));
                console.log(chalk.gray(`  NO_CURRENCY: ${formatEther(noBalanceBefore)}`));
            }
            
            splitSpinner.start('Splitting position...');
            
            // Check approval first
            const amountWei = parseEther(amount);
            console.log(chalk.cyan('\n📝 Checking approval...'));
            await this.ensureApprovalWithStatus(collateralToken, ROUTER_ADDRESS, amountWei, collateralSymbol);
            
            // Execute split
            console.log('Executing split with params:', {
                proposal: this.proposal.address,
                amount: amountWei.toString(),
                collateralToken: collateralToken
            });
            
            for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
                proposal: this.proposal.address || this.proposal.id,
                amount: amountWei,
                collateralToken: collateralToken
            })) {
                splitSpinner.text = status.message;
                
                if (status.status === 'pending' && status.data?.hash) {
                    splitSpinner.text = `Transaction submitted: ${status.data.hash.slice(0, 10)}...`;
                    console.log(chalk.gray(`\n  Transaction: ${txLink(status.data.hash)}`));
                }
                
                if (status.status === 'success') {
                    splitSpinner.succeed(`Successfully split ${amount} ${collateralSymbol} into YES/NO tokens!`);
                    console.log(chalk.green('✅ Transaction Hash:'), status.data.transactionHash);
                    console.log(chalk.gray('View on Explorer:'), txLink(status.data.transactionHash));
                    
                    // Get balances after split
                    const [yesBalanceAfter, noBalanceAfter] = await Promise.all([
                        this.publicClient.readContract({
                            address: yesToken,
                            abi: [{
                                name: 'balanceOf',
                                type: 'function',
                                stateMutability: 'view',
                                inputs: [{ name: 'account', type: 'address' }],
                                outputs: [{ name: '', type: 'uint256' }]
                            }],
                            functionName: 'balanceOf',
                            args: [this.account.address]
                        }),
                        this.publicClient.readContract({
                            address: noToken,
                            abi: [{
                                name: 'balanceOf',
                                type: 'function',
                                stateMutability: 'view',
                                inputs: [{ name: 'account', type: 'address' }],
                                outputs: [{ name: '', type: 'uint256' }]
                            }],
                            functionName: 'balanceOf',
                            args: [this.account.address]
                        })
                    ]);
                    
                    // Show balances after split
                    console.log(chalk.cyan('\n📊 Balances After Split:'));
                    if (isCompanyCollateral) {
                        console.log(chalk.gray(`  YES_COMPANY: ${formatEther(yesBalanceAfter)}`), chalk.green(`(+${formatEther(yesBalanceAfter - yesBalanceBefore)})`));
                        console.log(chalk.gray(`  NO_COMPANY: ${formatEther(noBalanceAfter)}`), chalk.green(`(+${formatEther(noBalanceAfter - noBalanceBefore)})`));
                    } else {
                        console.log(chalk.gray(`  YES_CURRENCY: ${formatEther(yesBalanceAfter)}`), chalk.green(`(+${formatEther(yesBalanceAfter - yesBalanceBefore)})`));
                        console.log(chalk.gray(`  NO_CURRENCY: ${formatEther(noBalanceAfter)}`), chalk.green(`(+${formatEther(noBalanceAfter - noBalanceBefore)})`));
                    }
                    
                    // Refresh all balances
                    await this.fetchBalances();
                }
            }
        } catch (error) {
            spinner.fail(`Failed to split: ${error.message}`);
        }
    }
    
    async redeemPosition() {
        if (!this.isConnected) {
            console.log(chalk.red('❌ Wallet not connected'));
            return;
        }
        
        // Check if proposal is finalized (handle both data sources)
        let isFinalized = false;
        let winningOutcome = null;
        
        if (this.proposal.status?.isFinalized) {
            // Blockchain data
            isFinalized = this.proposal.status.isFinalized;
            winningOutcome = this.proposal.status.currentAnswer;
        } else if (this.proposal.resolution_status === 'resolved' && this.proposal.resolution_outcome) {
            // Supabase data
            isFinalized = true;
            winningOutcome = this.proposal.resolution_outcome === 'yes' ? 'YES' : 'NO';
        } else {
            // Try to fetch status from blockchain
            try {
                const statusData = await this.dataLayer.fetch('proposal.status', { 
                    proposalAddress: this.proposal.address || this.proposal.id 
                });
                if (statusData.data) {
                    isFinalized = statusData.data.isFinalized;
                    winningOutcome = statusData.data.currentAnswer;
                }
            } catch (error) {
                console.log(chalk.gray('Could not fetch status from blockchain'));
            }
        }
        
        if (!isFinalized) {
            console.log(chalk.yellow('⚠️  Proposal not yet finalized. Cannot redeem.'));
            return;
        }
        
        const spinner = ora('Checking redeemable positions...').start();
        
        try {
            // Determine winning outcome
            const isYes = winningOutcome === 'YES';
            
            // Check winning token balances
            const winningTokens = isYes ? 
                ['YES_COMPANY', 'YES_CURRENCY'] : 
                ['NO_COMPANY', 'NO_CURRENCY'];
            
            const redeemableTokens = winningTokens.filter(token => 
                this.balances[token] && this.balances[token] > 0n
            );
            
            if (redeemableTokens.length === 0) {
                spinner.fail('No winning tokens to redeem');
                return;
            }
            
            spinner.succeed(`Found ${redeemableTokens.length} redeemable positions`);
            
            // Show what will be redeemed
            console.log(chalk.cyan('\n💰 Redeemable Balances:'));
            
            // Get actual amounts for company and currency tokens
            const companyToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
            const currencyToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
            
            const companyBalance = this.balances[companyToken] || 0n;
            const currencyBalance = this.balances[currencyToken] || 0n;
            
            if (companyBalance > 0n) {
                console.log(chalk.gray(`  ${companyToken}: ${formatEther(companyBalance)}`));
            }
            if (currencyBalance > 0n) {
                console.log(chalk.gray(`  ${currencyToken}: ${formatEther(currencyBalance)}`));
            }
            
            const { confirmRedeem } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmRedeem',
                    message: `Redeem these winning tokens for collateral?`,
                    default: true
                }
            ]);
            
            if (!confirmRedeem) return;
            
            // Check approvals for tokens we're redeeming
            console.log(chalk.cyan('\n📝 Checking approvals...'));
            
            const routerAddress = ROUTER_ADDRESS;
            
            // Check and approve company tokens if needed
            if (companyBalance > 0n) {
                const companyTokenAddress = this.tokens[isYes ? 'yesCompany' : 'noCompany'];
                console.log(chalk.gray(`Checking ${companyToken} approval...`));
                await this.ensureApprovalWithStatus(companyTokenAddress, routerAddress, companyBalance, companyToken);
            }
            
            // Check and approve currency tokens if needed  
            if (currencyBalance > 0n) {
                const currencyTokenAddress = this.tokens[isYes ? 'yesCurrency' : 'noCurrency'];
                console.log(chalk.gray(`Checking ${currencyToken} approval...`));
                await this.ensureApprovalWithStatus(currencyTokenAddress, routerAddress, currencyBalance, currencyToken);
            }
            
            const redeemSpinner = ora('Starting redemption transaction...').start();
            
            // Use redeemProposal for redeeming both company and currency tokens
            for await (const status of this.dataLayer.execute('futarchy.redeemProposal', {
                proposal: this.proposal.address || this.proposal.id,
                amount1: companyBalance,  // Company amount first
                amount2: currencyBalance  // Currency amount second
            })) {
                redeemSpinner.text = status.message;
                
                if (status.status === 'pending' && status.data?.hash) {
                    redeemSpinner.text = `Transaction submitted: ${status.data.hash.slice(0, 10)}...`;
                }
                
                if (status.status === 'success') {
                    redeemSpinner.succeed('Positions redeemed successfully!');
                    console.log(chalk.green('✅ Transaction Hash:'), status.data.transactionHash);
                    console.log(chalk.gray('View on Explorer:'), txLink(status.data.transactionHash));
                    
                    // Show what was redeemed
                    console.log(chalk.cyan('\n📊 Redemption Summary:'));
                    if (companyBalance > 0n) {
                        console.log(chalk.gray(`  Redeemed ${formatEther(companyBalance)} ${companyToken} → Collateral`));
                    }
                    if (currencyBalance > 0n) {
                        console.log(chalk.gray(`  Redeemed ${formatEther(currencyBalance)} ${currencyToken} → Collateral`));
                    }
                    
                    // Refresh balances
                    await this.fetchBalances();
                }
            }
            
        } catch (error) {
            spinner.fail(`Failed to redeem: ${error.message}`);
        }
    }
    
    async mergePosition() {
        if (!this.isConnected) {
            console.log(chalk.red('❌ Wallet not connected'));
            return;
        }
        
        const spinner = ora('Fetching conditional token balances...').start();
        
        try {
            // Get all wrapped token balances to find mergeable pairs
            let balances = [];
            
            if (this.proposal.wrapped && this.proposal.wrapped.wrappedOutcomes) {
                // Use wrapped data from blockchain
                balances = await Promise.all(
                    this.proposal.wrapped.wrappedOutcomes.map(async (outcome) => {
                    const balance = await this.publicClient.readContract({
                        address: outcome.wrapped1155,
                        abi: [{
                            name: 'balanceOf',
                            type: 'function',
                            stateMutability: 'view',
                            inputs: [{ name: 'account', type: 'address' }],
                            outputs: [{ name: '', type: 'uint256' }]
                        }],
                        functionName: 'balanceOf',
                        args: [this.account.address]
                    }).catch(() => 0n);
                    
                    return { 
                        label: outcome.label, 
                        address: outcome.wrapped1155,
                        balance 
                    };
                    })
                );
            } else if (this.tokens) {
                // Use token addresses from Supabase data
                const tokenMapping = [
                    { label: 'YES_COMPANY', address: this.tokens.yesCompany },
                    { label: 'NO_COMPANY', address: this.tokens.noCompany },
                    { label: 'YES_CURRENCY', address: this.tokens.yesCurrency },
                    { label: 'NO_CURRENCY', address: this.tokens.noCurrency }
                ];
                
                balances = await Promise.all(
                    tokenMapping.map(async ({ label, address }) => {
                        if (!address) return { label, address, balance: 0n };
                        
                        const balance = await this.publicClient.readContract({
                            address,
                            abi: [{
                                name: 'balanceOf',
                                type: 'function',
                                stateMutability: 'view',
                                inputs: [{ name: 'account', type: 'address' }],
                                outputs: [{ name: '', type: 'uint256' }]
                            }],
                            functionName: 'balanceOf',
                            args: [this.account.address]
                        }).catch(() => 0n);
                        
                        return { label, address, balance };
                    })
                );
            }
            
            // Find YES/NO pairs for company tokens
            const yesCompany = balances.find(b => b.label === 'YES_COMPANY');
            const noCompany = balances.find(b => b.label === 'NO_COMPANY');
            const mergeableCompany = yesCompany && noCompany ? 
                (yesCompany.balance < noCompany.balance ? yesCompany.balance : noCompany.balance) : 0n;
            
            // Find YES/NO pairs for currency tokens
            const yesCurrency = balances.find(b => b.label === 'YES_CURRENCY');
            const noCurrency = balances.find(b => b.label === 'NO_CURRENCY');
            const mergeableCurrency = yesCurrency && noCurrency ? 
                (yesCurrency.balance < noCurrency.balance ? yesCurrency.balance : noCurrency.balance) : 0n;
            
            spinner.stop();
            
            // Fetch actual token symbols from blockchain (like split does)
            const [companySymbol, currencySymbol] = await Promise.all([
                this.publicClient.readContract({
                    address: this.tokens.companyToken,
                    abi: [{
                        name: 'symbol',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ name: '', type: 'string' }]
                    }],
                    functionName: 'symbol'
                }).catch(() => 'COMPANY'),
                this.publicClient.readContract({
                    address: this.tokens.currencyToken,
                    abi: [{
                        name: 'symbol',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ name: '', type: 'string' }]
                    }],
                    functionName: 'symbol'
                }).catch(() => 'CURRENCY')
            ]);
            
            // Show mergeable amounts with actual token symbols
            console.log(chalk.cyan('\n🔀 Mergeable Positions:'));
            
            const mergeOptions = [];
            if (mergeableCompany > 0n) {
                console.log(chalk.gray(`  Company tokens (${companySymbol}):`));
                console.log(chalk.gray(`    YES_COMPANY: ${formatEther(yesCompany.balance)}`));
                console.log(chalk.gray(`    NO_COMPANY: ${formatEther(noCompany.balance)}`));
                console.log(chalk.green(`    Mergeable: ${formatEther(mergeableCompany)}`));
                mergeOptions.push({ 
                    name: `Merge ${formatEther(mergeableCompany)} Company tokens back to ${companySymbol}`, 
                    value: 'company',
                    amount: mergeableCompany
                });
            }
            
            if (mergeableCurrency > 0n) {
                console.log(chalk.gray(`  Currency tokens (${currencySymbol}):`));
                console.log(chalk.gray(`    YES_CURRENCY: ${formatEther(yesCurrency.balance)}`));
                console.log(chalk.gray(`    NO_CURRENCY: ${formatEther(noCurrency.balance)}`));
                console.log(chalk.green(`    Mergeable: ${formatEther(mergeableCurrency)}`));
                mergeOptions.push({ 
                    name: `Merge ${formatEther(mergeableCurrency)} Currency tokens back to ${currencySymbol}`, 
                    value: 'currency',
                    amount: mergeableCurrency
                });
            }
            
            if (mergeOptions.length === 0) {
                console.log(chalk.yellow('\n⚠️  No mergeable positions (need equal YES and NO tokens)'));
                return;
            }
            
            const { mergeChoice } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'mergeChoice',
                    message: 'Which tokens to merge?',
                    choices: [...mergeOptions, { name: 'Cancel', value: 'cancel' }]
                }
            ]);
            
            if (mergeChoice === 'cancel') return;
            
            const mergeSpinner = ora('Merging positions...').start();
            
            // Determine collateral token and amount
            const isCompany = mergeChoice === 'company';
            const collateralToken = isCompany ? this.tokens.companyToken : this.tokens.currencyToken;
            const mergeAmount = isCompany ? mergeableCompany : mergeableCurrency;
            const yesToken = isCompany ? yesCompany.address : yesCurrency.address;
            const noToken = isCompany ? noCompany.address : noCurrency.address;
            
            // Check approvals
            console.log(chalk.cyan('\n📝 Checking approvals...'));
            const yesTokenName = isCompany ? 'YES_COMPANY' : 'YES_CURRENCY';
            const noTokenName = isCompany ? 'NO_COMPANY' : 'NO_CURRENCY';
            
            // Check and approve YES token
            await this.ensureApprovalWithStatus(yesToken, ROUTER_ADDRESS, mergeAmount, yesTokenName);
            // Check and approve NO token  
            await this.ensureApprovalWithStatus(noToken, ROUTER_ADDRESS, mergeAmount, noTokenName);
            
            mergeSpinner.text = 'Starting merge transaction...';
            
            // Execute merge
            for await (const status of this.dataLayer.execute('futarchy.mergePositions', {
                proposal: this.proposal.address || this.proposal.id,
                collateralToken: collateralToken,
                amount: mergeAmount
            })) {
                mergeSpinner.text = status.message;
                
                if (status.status === 'pending' && status.data?.hash) {
                    mergeSpinner.text = `Transaction submitted: ${status.data.hash.slice(0, 10)}...`;
                    console.log(chalk.gray(`\n  Transaction: https://gnosisscan.io/tx/${status.data.hash}`));
                }
                
                if (status.status === 'success') {
                    const collateralSymbol = isCompany ? companySymbol : currencySymbol;
                    mergeSpinner.succeed(`Successfully merged ${formatEther(mergeAmount)} YES/NO tokens back to ${collateralSymbol}!`);
                    console.log(chalk.green('✅ Transaction Hash:'), status.data.transactionHash);
                    const explorerUrl = RUNTIME.chainId === 137 ? 
                        `https://polygonscan.com/tx/${status.data.transactionHash}` : 
                        `https://gnosisscan.io/tx/${status.data.transactionHash}`;
                    console.log(chalk.gray('View on Explorer:'), explorerUrl);
                    
                    // Refresh balances
                    await this.fetchBalances();
                }
            }
            
        } catch (error) {
            spinner.fail(`Failed to merge: ${error.message}`);
        }
    }
    
    async swapTokens() {
        if (!this.isConnected) {
            console.log(chalk.red('❌ Wallet not connected'));
            return;
        }
        
        const spinner = ora('Loading balances...').start();
        
        try {
            // Get all token balances
            const [companyBalance, currencyBalance] = await Promise.all([
                this.publicClient.readContract({
                    address: this.tokens.companyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                }),
                this.publicClient.readContract({
                    address: this.tokens.currencyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [this.account.address]
                })
            ]);
            
            // Get conditional token balances (handle both data sources)
            let conditionalBalances = [];
            
            if (this.proposal.wrapped && this.proposal.wrapped.wrappedOutcomes) {
                // Use wrapped data from blockchain
                conditionalBalances = await Promise.all(
                    this.proposal.wrapped.wrappedOutcomes.map(async (outcome) => {
                        const balance = await this.publicClient.readContract({
                            address: outcome.wrapped1155,
                            abi: [{
                                name: 'balanceOf',
                                type: 'function',
                                stateMutability: 'view',
                                inputs: [{ name: 'account', type: 'address' }],
                                outputs: [{ name: '', type: 'uint256' }]
                            }],
                            functionName: 'balanceOf',
                            args: [this.account.address]
                        }).catch(() => 0n);
                        
                        return { label: outcome.label, balance };
                    })
                );
            } else if (this.tokens) {
                // Use token addresses from Supabase data
                const tokenMapping = [
                    { label: 'YES_COMPANY', address: this.tokens.yesCompany },
                    { label: 'NO_COMPANY', address: this.tokens.noCompany },
                    { label: 'YES_CURRENCY', address: this.tokens.yesCurrency },
                    { label: 'NO_CURRENCY', address: this.tokens.noCurrency }
                ];
                
                conditionalBalances = await Promise.all(
                    tokenMapping.map(async ({ label, address }) => {
                        if (!address) return { label, balance: 0n };
                        
                        const balance = await this.publicClient.readContract({
                            address,
                            abi: [{
                                name: 'balanceOf',
                                type: 'function',
                                stateMutability: 'view',
                                inputs: [{ name: 'account', type: 'address' }],
                                outputs: [{ name: '', type: 'uint256' }]
                            }],
                            functionName: 'balanceOf',
                            args: [this.account.address]
                        }).catch(() => 0n);
                        
                        return { label, balance };
                    })
                );
            }
            
            spinner.stop();
            
            // Show ALL available pools and prices
            console.log('\n' + chalk.cyan.bold('💱 Available Trading Markets:'));
            console.log(chalk.gray('━'.repeat(50)));
            
            // Show prediction pools (trade against base collateral)
            console.log('\n' + chalk.yellow('📊 Prediction Markets (Trade with base collateral):'));
            
            const yesPredPool = this.pools.predictionPools?.find(p => p.name.includes('YES'));
            const noPredPool = this.pools.predictionPools?.find(p => p.name.includes('NO'));
            
            if (yesPredPool && this.prices['YES_CURRENCY/BASE_CURRENCY']) {
                const price = this.prices['YES_CURRENCY/BASE_CURRENCY'];
                console.log(chalk.green(`  YES Pool: 1 YES_CURRENCY = ${this.formatPriceWithUSD(price.price, 4)}`));
                console.log(chalk.gray(`    Implied probability: ${(price.price * 100).toFixed(1)}%`));
            }
            
            if (noPredPool && this.prices['NO_CURRENCY/BASE_CURRENCY']) {
                const price = this.prices['NO_CURRENCY/BASE_CURRENCY'];
                console.log(chalk.red(`  NO Pool: 1 NO_CURRENCY = ${this.formatPriceWithUSD(price.price, 4)}`));
                console.log(chalk.gray(`    Implied probability: ${(price.price * 100).toFixed(1)}%`));
            }
            
            // Show conditional pools  
            console.log('\n' + chalk.magenta('🔀 Conditional Markets (Trade between YES/NO tokens):'));
            
            const yesCondPool = this.pools.conditionalPools?.find(p => p.name === 'YES_COMPANY/YES_CURRENCY');
            const noCondPool = this.pools.conditionalPools?.find(p => p.name === 'NO_COMPANY/NO_CURRENCY');
            
            if (yesCondPool && this.prices['YES_COMPANY/YES_CURRENCY']) {
                const price = this.prices['YES_COMPANY/YES_CURRENCY'];
                const yesCompanyIsToken0 = price.token0.toLowerCase() === this.tokens.yesCompany.toLowerCase();
                const rate = yesCompanyIsToken0 ? price.price : price.priceInverse;
                console.log(chalk.green(`  YES Conditional: 1 YES_COMPANY = ${rate.toFixed(4)} YES_CURRENCY`));
            }
            
            if (noCondPool && this.prices['NO_COMPANY/NO_CURRENCY']) {
                const price = this.prices['NO_COMPANY/NO_CURRENCY'];
                const noCompanyIsToken0 = price.token0.toLowerCase() === this.tokens.noCompany.toLowerCase();
                const rate = noCompanyIsToken0 ? price.price : price.priceInverse;
                console.log(chalk.red(`  NO Conditional: 1 NO_COMPANY = ${rate.toFixed(4)} NO_CURRENCY`));
            }
            
            console.log(chalk.gray('━'.repeat(50)));
            
            // First ask which market type
            const { marketType } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'marketType',
                    message: 'Which market do you want to trade on?',
                    choices: [
                        { name: chalk.yellow('📊 Prediction Market (YES/NO_CURRENCY ↔ sDAI)'), value: 'PREDICTION' },
                        { name: chalk.cyan('💼 Company Market (YES/NO_COMPANY ↔ sDAI)'), value: 'COMPANY' },
                        { name: chalk.magenta('🔀 Conditional Market (YES tokens ↔ YES tokens, NO ↔ NO)'), value: 'CONDITIONAL' }
                    ]
                }
            ]);
            
            let outcome, side, amount, slippage, swapType;
            
            if (marketType === 'PREDICTION') {
                // Prediction market flow
                const predictionAnswers = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'outcome',
                        message: 'Which outcome token to trade?',
                        choices: [
                            { name: chalk.green('YES tokens (betting on approval)'), value: 'YES' },
                            { name: chalk.red('NO tokens (betting on rejection)'), value: 'NO' }
                        ]
                    },
                    {
                        type: 'list',
                        name: 'side',
                        message: 'Trade direction?',
                        choices: [
                            { name: '📈 BUY outcome tokens (swap sDAI → YES/NO tokens)', value: 'BUY' },
                            { name: '📉 SELL outcome tokens (swap YES/NO tokens → sDAI)', value: 'SELL' }
                        ]
                    },
                    {
                        type: 'list',
                        name: 'swapType',
                        message: 'Swap type?',
                        choices: [
                            { name: '📊 Exact Input (specify amount to spend)', value: 'EXACT_IN' },
                            { name: '🎯 Exact Output (specify amount to receive)', value: 'EXACT_OUT' }
                        ]
                    },
                    {
                        type: 'input',
                        name: 'amount',
                        message: (answers) => {
                            const isYes = answers.outcome === 'YES';
                            const isBuy = answers.side === 'BUY';
                            const isExactOut = answers.swapType === 'EXACT_OUT';
                            
                            if (isBuy) {
                                // Buying with base currency (sDAI) - can use existing balance
                                const balanceInSDAI = parseFloat(formatEther(currencyBalance));
                                if (isExactOut) {
                                    const outcomeToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                                    return `Amount of ${outcomeToken} tokens you want to receive:`;
                                } else {
                                    return `Amount of sDAI to spend (balance: ${this.formatPriceWithUSD(balanceInSDAI)}):`;
                                }
                            } else {
                                // Selling outcome tokens - show existing + splittable
                                // For prediction markets against sDAI, we use CURRENCY tokens
                                const outcomeToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                                const existing = conditionalBalances.find(b => b.label === outcomeToken)?.balance || 0n;
                                
                                // For prediction markets, we can split sDAI to get more YES/NO_CURRENCY tokens
                                const splittableCurrency = currencyBalance; // sDAI can be split to get YES/NO_CURRENCY
                                const total = existing + splittableCurrency;
                                
                                if (isExactOut) {
                                    return `Amount of sDAI you want to receive:`;
                                } else {
                                    return `Amount of ${outcomeToken} to sell (available: ${formatEther(existing)} + ${formatEther(splittableCurrency)} splittable = ${formatEther(total)} total):`;
                                }
                            }
                        },
                        default: '0.01',
                        validate: (input, answers) => {
                            const num = parseFloat(input);
                            if (num <= 0) return 'Please enter a positive amount';
                            
                            const isYes = answers.outcome === 'YES';
                            const isBuy = answers.side === 'BUY';
                            
                            if (isBuy) {
                                // Check sDAI balance
                                if (parseEther(input) > currencyBalance) {
                                    const maxBalance = parseFloat(formatEther(currencyBalance));
                                    return `Amount exceeds sDAI balance (max: ${this.formatPriceWithUSD(maxBalance)})`;
                                }
                            } else {
                                // Check outcome token balance (existing + splittable)
                                const outcomeToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                                const existing = conditionalBalances.find(b => b.label === outcomeToken)?.balance || 0n;
                                const splittableCurrency = currencyBalance;
                                const total = existing + splittableCurrency;
                                if (parseEther(input) > total) return 'Amount exceeds available balance (including splittable)';
                            }
                            
                            return true;
                        }
                    }
                ]);
                
                outcome = predictionAnswers.outcome;
                side = predictionAnswers.side;
                amount = predictionAnswers.amount;
                swapType = predictionAnswers.swapType;
                
                // Ask for slippage tolerance
                const { slippageInput } = await inquirer.prompt([{
                    type: 'input',
                    name: 'slippageInput',
                    message: 'Slippage tolerance (%):', 
                    default: '2',
                    validate: (input) => {
                        const num = parseFloat(input);
                        if (isNaN(num) || num < 0.1 || num > 50) {
                            return 'Please enter a valid slippage between 0.1% and 50%';
                        }
                        return true;
                    }
                }]);
                
                slippage = parseFloat(slippageInput) / 100;
                
                // Calculate and show estimation BEFORE confirmation
                const amountWei = parseEther(amount);
                const isYes = outcome === 'YES';
                const isBuy = side === 'BUY';
                
                // Get the prediction pool - using CURRENCY tokens against base sDAI
                const poolName = isYes ? 'YES_CURRENCY/BASE_CURRENCY' : 'NO_CURRENCY/BASE_CURRENCY';
                const pool = this.pools.predictionPools?.find(p => p.name.includes(isYes ? 'YES' : 'NO'));
                const price = this.prices[poolName];
                
                if (!pool || !price) {
                    throw new Error(`${poolName} pool not found`);
                }
                
                // Determine token ordering in the pool
                const outcomeTokenAddress = isYes ? this.tokens.yesCurrency : this.tokens.noCurrency;
                const outcomeIsToken0 = price.token0.toLowerCase() === outcomeTokenAddress.toLowerCase();
                
                // Get the correct price: price means token1/token0
                // If outcome is token0: price = sDAI/outcome (how much sDAI per outcome token)
                // If outcome is token1: price = outcome/sDAI (how much outcome per sDAI)
                const displayPrice = outcomeIsToken0 ? price.price : price.priceInverse;
                
                // Calculate expected output
                let expectedOut;
                let minOut; // Define minOut at the outer scope
                
                console.log(chalk.cyan('\n━━━ 📊 Trade Estimation ━━━'));
                
                if (typeof swapType !== 'undefined' && swapType === 'EXACT_OUT') {
                    // For exact output, show what they want to receive and max willing to pay
                    if (isBuy) {
                        // Buying YES/NO_CURRENCY tokens with sDAI - they want exact outcome tokens
                        const estimatedCost = parseFloat(amount) * displayPrice;
                        const maxCost = estimatedCost * (1 + slippage);
                        
                        console.log(chalk.green(`  You receive: ${amount} ${outcome}_CURRENCY (exact)`));
                        console.log(chalk.white(`  You pay:     ~${this.formatPriceWithUSD(estimatedCost, 6)}`));
                        console.log(chalk.gray(`  Exchange rate: 1 ${outcome}_CURRENCY = ${this.formatPriceWithUSD(displayPrice, 4)}`));
                        console.log(chalk.gray(`  Maximum input: ${this.formatPriceWithUSD(maxCost, 6)} (with ${slippage * 100}% slippage)`));
                        console.log(chalk.yellow(`  Implied probability: ${(displayPrice * 100).toFixed(2)}%`));
                    } else {
                        // Selling YES/NO_CURRENCY tokens for sDAI - they want exact sDAI
                        const estimatedInput = parseFloat(amount) / displayPrice;
                        const maxInput = estimatedInput * (1 + slippage);
                        
                        console.log(chalk.green(`  You receive: ${this.formatPriceWithUSD(parseFloat(amount), 6)} (exact)`));
                        console.log(chalk.white(`  You sell:    ~${estimatedInput.toFixed(6)} ${outcome}_CURRENCY`));
                        console.log(chalk.gray(`  Exchange rate: 1 ${outcome}_CURRENCY = ${this.formatPriceWithUSD(displayPrice, 4)}`));
                        console.log(chalk.gray(`  Maximum input: ${maxInput.toFixed(6)} ${outcome}_CURRENCY (with ${slippage * 100}% slippage)`));
                        console.log(chalk.yellow(`  Current implied probability: ${(displayPrice * 100).toFixed(2)}%`));
                    }
                } else {
                    // For exact input, show normal estimation
                    if (isBuy) {
                        // Buying YES/NO_CURRENCY tokens with sDAI
                        expectedOut = parseFloat(amount) / displayPrice;
                        minOut = expectedOut * (1 - slippage);
                        
                        console.log(chalk.white(`  You pay:     ${this.formatPriceWithUSD(parseFloat(amount))}`));
                        console.log(chalk.green(`  You receive: ~${expectedOut.toFixed(6)} ${outcome}_CURRENCY`));
                        console.log(chalk.gray(`  Exchange rate: 1 ${outcome}_CURRENCY = ${this.formatPriceWithUSD(displayPrice, 4)}`));
                        console.log(chalk.gray(`  Minimum output: ${minOut.toFixed(6)} ${outcome}_CURRENCY (with ${slippage * 100}% slippage)`));
                        console.log(chalk.yellow(`  Implied probability: ${(displayPrice * 100).toFixed(2)}%`));
                    } else {
                        // Selling YES/NO_CURRENCY tokens for sDAI
                        expectedOut = parseFloat(amount) * displayPrice;
                        minOut = expectedOut * (1 - slippage);
                        
                        console.log(chalk.white(`  You sell:    ${amount} ${outcome}_CURRENCY`));
                        console.log(chalk.green(`  You receive: ~${this.formatPriceWithUSD(expectedOut, 6)}`));
                        console.log(chalk.gray(`  Exchange rate: 1 ${outcome}_CURRENCY = ${this.formatPriceWithUSD(displayPrice, 4)}`));
                        console.log(chalk.gray(`  Minimum output: ${this.formatPriceWithUSD(minOut, 6)} (with ${slippage * 100}% slippage)`));
                        console.log(chalk.yellow(`  Current implied probability: ${(displayPrice * 100).toFixed(2)}%`));
                    }
                }
                
                console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━'));
                
                // Ask if user wants to run simulation
                const { runSimulation } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'runSimulation',
                    message: 'Run simulation to calculate exact output and price impact?',
                    default: true
                }]);
                
                let simulatedOutput = null;
                let priceImpact = null;
                
                if (runSimulation) {
                    let simSpinner = ora('Preparing simulation...').start();
                    
                    try {
                        // Check if we need to split first for the simulation
                        const outcomeToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                        let existing = conditionalBalances.find(b => b.label === outcomeToken)?.balance || 0n;
                        
                        // If we need to split, do it NOW before simulation
                        if (!isBuy && existing < amountWei) {
                            const needToSplit = amountWei - existing;
                            simSpinner.text = `Need to split ${formatEther(needToSplit)} sDAI for simulation...`;
                            
                            console.log(chalk.yellow(`\n📝 Preparing for simulation:`));
                            console.log(chalk.gray(`  Current ${outcomeToken}: ${formatEther(existing)}`));
                            console.log(chalk.gray(`  Needed: ${formatEther(amountWei)}`));
                            console.log(chalk.gray(`  Splitting: ${formatEther(needToSplit)} sDAI\n`));
                            
                            // Stop spinner before prompting
                            simSpinner.stop();
                            
                            // Ask user to confirm split for simulation
                            const { confirmSplit } = await inquirer.prompt([{
                                type: 'confirm',
                                name: 'confirmSplit',
                                message: `Split ${formatEther(needToSplit)} sDAI to enable simulation?`,
                                default: true
                            }]);
                            
                            if (confirmSplit) {
                                // ACTUALLY SPLIT THE TOKENS
                                console.log(chalk.cyan('\n🔄 Executing split for simulation...'));
                                await this.ensureApprovalWithStatus(this.tokens.currencyToken, ROUTER_ADDRESS, needToSplit, 'sDAI');
                                
                                const splitSpinner = ora('Executing split transaction...').start();
                                
                                for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
                                    proposal: this.proposal.address || this.proposal.id,
                                    amount: needToSplit,
                                    collateralToken: this.tokens.currencyToken
                                })) {
                                    if (status.status === 'pending' && status.data?.hash) {
                                        splitSpinner.text = `Split transaction: ${status.data.hash.slice(0, 10)}...`;
                                    }
                                    if (status.status === 'success') {
                                        splitSpinner.succeed('Split successful! Now have tokens for simulation.');
                                        console.log(chalk.green(`✅ Split transaction: ${status.data.transactionHash.slice(0, 10)}...`));
                                        
                                        // Update balances after split
                                        await this.fetchBalances();
                                        // Update conditional balances
                                        const newBalance = await this.publicClient.readContract({
                                            address: isYes ? this.tokens.yesCurrency : this.tokens.noCurrency,
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
                                        existing = newBalance;
                                        console.log(chalk.gray(`New ${outcomeToken} balance: ${formatEther(existing)}\n`));
                                    }
                                }
                                
                                // Restart spinner for simulation
                                simSpinner = ora('Preparing to run simulation with new tokens...').start();
                            } else {
                                console.log(chalk.yellow('Split cancelled - skipping simulation'));
                                simulatedOutput = null;
                                priceImpact = null;
                                throw new Error('Split cancelled by user');
                            }
                        }
                        
                        if (!simSpinner.isSpinning) {
                            simSpinner = ora('Running swap simulation...').start();
                        } else {
                            simSpinner.text = 'Checking token approval for simulation...';
                        }
                        
                        // Prepare simulation parameters
                        const algebraRouter = '0xffb643e73f280b97809a8b41f7232ab401a04ee1';
                        const deadline = Math.floor(Date.now() / 1000) + 1200;
                        
                        // Get token addresses
                        let tokenIn, tokenOut;
                        if (isBuy) {
                            tokenIn = this.tokens.currencyToken; // sDAI
                            tokenOut = isYes ? this.tokens.yesCurrency : this.tokens.noCurrency;
                        } else {
                            tokenIn = isYes ? this.tokens.yesCurrency : this.tokens.noCurrency;
                            tokenOut = this.tokens.currencyToken; // sDAI
                        }
                        
                        // ENSURE APPROVAL BEFORE SIMULATION
                        simSpinner.text = 'Checking and approving tokens for simulation...';
                        const tokenInName = isBuy ? 'sDAI' : outcomeToken;
                        
                        // Check current allowance
                        const currentAllowance = await this.publicClient.readContract({
                            address: tokenIn,
                            abi: [{
                                name: 'allowance',
                                type: 'function',
                                stateMutability: 'view',
                                inputs: [
                                    { name: 'owner', type: 'address' },
                                    { name: 'spender', type: 'address' }
                                ],
                                outputs: [{ name: '', type: 'uint256' }]
                            }],
                            functionName: 'allowance',
                            args: [this.account.address, algebraRouter]
                        });
                        
                        if (currentAllowance < amountWei) {
                            simSpinner.stop();
                            console.log(chalk.yellow(`\n📝 Approval needed for simulation`));
                            await this.ensureApprovalWithStatus(tokenIn, algebraRouter, amountWei, tokenInName);
                            simSpinner = ora('Running swap simulation...').start();
                        }
                        
                        simSpinner.text = 'Simulating swap transaction...';
                        
                        // Simulate the swap call
                        let simulationResult;
                        if (RUNTIME.amm === 'uniswap' && RUNTIME.uniswap?.quoterV4) {
                            // Use v4 quoter via cartridge to estimate output
                            let amountOutWei = null;
                            const fee = (isBuy ? (this.prices?.['YES_COMPANY/YES_CURRENCY']?.fee) : (this.prices?.['NO_COMPANY/NO_CURRENCY']?.fee)) ?? 500;
                            for await (const st of this.dataLayer.execute('uniswap.quote', {
                                tokenIn,
                                tokenOut,
                                amountIn: formatEther(amountWei),
                                fee,
                                tickSpacing: 10,
                                hooks: '0x0000000000000000000000000000000000000000'
                            })) {
                                if (st.status === 'success') { amountOutWei = BigInt(st.data.amountOut); break; }
                                if (st.status === 'error') throw new Error(st.message || 'Quote failed');
                            }
                            // Synthesize a result-like object for downstream formatting
                            simulationResult = { result: amountOutWei ?? 0n };
                        } else {
                            simulationResult = await this.publicClient.simulateContract({
                                address: algebraRouter,
                                abi: [{ name: 'exactInputSingle', type: 'function', stateMutability: 'payable', inputs: [{ name: 'params', type: 'tuple', components: [ { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'deadline', type: 'uint256' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' }, { name: 'limitSqrtPrice', type: 'uint160' } ] }], outputs: [{ name: 'amountOut', type: 'uint256' }] }],
                                functionName: 'exactInputSingle',
                                args: [{ tokenIn, tokenOut, recipient: this.account.address, deadline: BigInt(deadline), amountIn: amountWei, amountOutMinimum: 0n, limitSqrtPrice: 0n }],
                                account: this.account.address
                            });
                        }
                        
                        simulatedOutput = parseFloat(formatEther(simulationResult.result));
                        
                        // Calculate price impact
                        const expectedPrice = price.price;
                        const actualPrice = isBuy ? 
                            parseFloat(amount) / simulatedOutput :  // sDAI per token
                            simulatedOutput / parseFloat(amount);    // sDAI per token
                        
                        priceImpact = Math.abs((actualPrice - expectedPrice) / expectedPrice * 100);
                        
                        simSpinner.succeed('Simulation complete');
                        
                        // Calculate new pool price after trade
                        const newPrice = isBuy ? 
                            parseFloat(amount) / simulatedOutput :  // New price if buying
                            simulatedOutput / parseFloat(amount);    // New price if selling
                        
                        // Show comprehensive simulation results
                        console.log(chalk.cyan('\n━━━ 🔬 Simulation Results ━━━'));
                        
                        // Output comparison
                        console.log(chalk.white.bold('\n📊 Output Analysis:'));
                        console.log(chalk.white(`  Expected output:  ${expectedOut.toFixed(6)} ${isBuy ? `${outcome}_CURRENCY` : 'sDAI'}`));
                        console.log(chalk.green(`  Exact output:     ${simulatedOutput.toFixed(6)} ${isBuy ? `${outcome}_CURRENCY` : 'sDAI'}`));
                        console.log(chalk.gray(`  Minimum output:   ${minOut.toFixed(6)} ${isBuy ? `${outcome}_CURRENCY` : 'sDAI'} (${slippage * 100}% slippage)`));
                        
                        // Price impact analysis
                        console.log(chalk.white.bold('\n💹 Price Impact:'));
                        console.log(chalk.gray(`  Current price:    1 ${outcome}_CURRENCY = ${price.price.toFixed(4)} sDAI`));
                        console.log(chalk.gray(`  New price:        1 ${outcome}_CURRENCY = ${newPrice.toFixed(4)} sDAI`));
                        
                        if (priceImpact < 0.5) {
                            console.log(chalk.green(`  Price impact:     ${priceImpact.toFixed(3)}% ✅`));
                        } else if (priceImpact < 2) {
                            console.log(chalk.yellow(`  Price impact:     ${priceImpact.toFixed(3)}% ⚠️`));
                        } else {
                            console.log(chalk.red(`  Price impact:     ${priceImpact.toFixed(3)}% ⛔ HIGH`));
                        }
                        
                        // Slippage comparison
                        const actualSlippage = Math.abs((simulatedOutput - expectedOut) / expectedOut * 100);
                        console.log(chalk.white.bold('\n⚡ Slippage Check:'));
                        console.log(chalk.gray(`  Max slippage set: ${slippage * 100}%`));
                        console.log(chalk.gray(`  Actual slippage:  ${actualSlippage.toFixed(3)}%`));
                        
                        // Alerts and warnings
                        if (priceImpact > slippage * 100) {
                            console.log(chalk.red.bold('\n⚠️  WARNING: Price impact exceeds slippage tolerance!'));
                            console.log(chalk.red(`    Consider reducing trade size or increasing slippage`));
                        }
                        
                        if (simulatedOutput < minOut) {
                            console.log(chalk.red.bold('\n⛔ ALERT: Output below minimum!'));
                            console.log(chalk.red(`    Expected min: ${minOut.toFixed(6)}, Got: ${simulatedOutput.toFixed(6)}`));
                        }
                        
                        // New implied probability after trade
                        const newImpliedProb = newPrice * 100;
                        console.log(chalk.white.bold('\n🎯 Market Probability:'));
                        console.log(chalk.gray(`  Current implied:  ${(price.price * 100).toFixed(2)}%`));
                        console.log(chalk.gray(`  After trade:      ${newImpliedProb.toFixed(2)}%`));
                        
                        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━'));
                        
                    } catch (error) {
                        if (error.message === 'Split cancelled by user') {
                            console.log(chalk.yellow('\nSimulation cancelled - split was not performed'));
                        } else if (error.message.includes('STF')) {
                            simSpinner.fail('Simulation failed - Insufficient liquidity');
                            console.log(chalk.yellow('\n⚠️ The pool may not have enough liquidity for this trade'));
                            console.log(chalk.gray('  Try a smaller amount or adjust slippage'));
                        } else {
                            simSpinner.fail('Simulation failed');
                            console.log(chalk.yellow('\nCould not simulate. Possible reasons:'));
                            console.log(chalk.gray('  - Token approval needed for swap'));
                            console.log(chalk.gray('  - Insufficient liquidity in pool'));
                            console.log(chalk.gray('  - Pool contract issues'));
                            console.log(chalk.gray(`\nError: ${error.message.substring(0, 100)}`));
                        }
                    }
                }
                
                // Ask for final confirmation
                const { confirmTrade } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirmTrade',
                    message: simulatedOutput ? 
                        `Execute trade? (Output: ${simulatedOutput.toFixed(6)}, Impact: ${priceImpact.toFixed(3)}%)` :
                        'Execute this trade?',
                    default: true
                }]);
                
                if (!confirmTrade) {
                    console.log(chalk.red('Trade cancelled'));
                    return;
                }
                
                console.log(chalk.cyan('\n📊 Executing Prediction Market Trade...'));
                
                // Check if we need to split first - GET UPDATED BALANCE
                const outcomeToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                
                // Fetch current balance (may have changed after simulation split)
                const currentBalance = await this.publicClient.readContract({
                    address: isYes ? this.tokens.yesCurrency : this.tokens.noCurrency,
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
                
                const existing = currentBalance;
                
                console.log(chalk.gray(`Checking ${outcomeToken} balance: ${formatEther(existing)}`));
                
                if (!isBuy && existing < amountWei) {
                    // Need to split collateral first
                    const needToSplit = amountWei - existing;
                    console.log(chalk.yellow(`\n⚠️ Need to split ${formatEther(needToSplit)} sDAI first to get ${outcomeToken}`));
                    
                    const { confirmSplit } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'confirmSplit',
                        message: `Split ${formatEther(needToSplit)} sDAI to get YES/NO_CURRENCY tokens first?`,
                        default: true
                    }]);
                    
                    if (!confirmSplit) {
                        console.log(chalk.red('Trade cancelled'));
                        return;
                    }
                    
                    // Execute split
                    console.log(chalk.cyan('Splitting collateral...'));
                    await this.ensureApprovalWithStatus(this.tokens.currencyToken, ROUTER_ADDRESS, needToSplit, 'sDAI');
                    
                    for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
                        proposal: this.proposal.address || this.proposal.id,
                        amount: needToSplit,
                        collateralToken: this.tokens.currencyToken
                    })) {
                        if (status.status === 'success') {
                            console.log(chalk.green('✅ Split successful!'));
                        }
                    }
                }
                
                // Now execute the actual swap on the prediction market
                const swapSpinner = ora('Executing prediction market swap...').start();
                
                try {
                    // Get the correct token addresses for the swap
                    let tokenIn, tokenOut;
                    
                    if (isBuy) {
                        // Buying outcome tokens with sDAI
                        tokenIn = this.tokens.currencyToken; // sDAI
                        tokenOut = isYes ? this.tokens.yesCurrency : this.tokens.noCurrency;
                    } else {
                        // Selling outcome tokens for sDAI
                        tokenIn = isYes ? this.tokens.yesCurrency : this.tokens.noCurrency;
                        tokenOut = this.tokens.currencyToken; // sDAI
                    }
                    
                    // Use Algebra router like conditional swaps
                    const algebraRouter = '0xffb643e73f280b97809a8b41f7232ab401a04ee1';
                    
                    // Check approval for input token to Algebra router
                    swapSpinner.text = 'Checking token approval...';
                    const tokenInName = isBuy ? 'sDAI' : outcomeToken;
                    await this.ensureApprovalWithStatus(tokenIn, algebraRouter, amountWei, tokenInName);
                    
                    // Calculate minimum output with slippage
                    const minAmountOut = parseEther((minOut * 0.98).toFixed(18)); // 2% slippage tolerance
                    
                    swapSpinner.text = 'Submitting swap transaction to Algebra...';
                    
                    const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes from now
                    
                    // Execute swap using Algebra router (same as conditional swaps)
                    const hash = await this.walletClient.writeContract({
                        address: algebraRouter,
                        abi: [{
                            "name": "exactInputSingle",
                            "type": "function",
                            "stateMutability": "payable",
                            "inputs": [
                                {
                                    "name": "params",
                                    "type": "tuple",
                                    "components": [
                                        {"name": "tokenIn", "type": "address"},
                                        {"name": "tokenOut", "type": "address"},
                                        {"name": "recipient", "type": "address"},
                                        {"name": "deadline", "type": "uint256"},
                                        {"name": "amountIn", "type": "uint256"},
                                        {"name": "amountOutMinimum", "type": "uint256"},
                                        {"name": "limitSqrtPrice", "type": "uint160"}
                                    ]
                                }
                            ],
                            "outputs": [{"name": "amountOut", "type": "uint256"}]
                        }],
                        functionName: 'exactInputSingle',
                        args: [{
                            tokenIn: tokenIn,
                            tokenOut: tokenOut,
                            recipient: this.account.address,
                            deadline: BigInt(deadline),
                            amountIn: amountWei,
                            amountOutMinimum: minAmountOut,
                            limitSqrtPrice: 0n
                        }],
                        account: this.account
                    });
                    
                    swapSpinner.text = `Transaction submitted: ${hash.slice(0, 10)}...`;
                    console.log(chalk.gray(`\n  Transaction: ${txLink(hash)}`));
                    
                    swapSpinner.text = 'Waiting for confirmation...';
                    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
                    
                    // Check status - viem uses 'success' string or status === 1
                    if (receipt.status === 'success' || receipt.status === 1 || receipt.status === true) {
                        swapSpinner.succeed('Prediction market swap successful!');
                        console.log(chalk.green(`✅ Transaction confirmed: ${hash.slice(0, 10)}...`));
                        console.log(chalk.gray(`  Gas used: ${receipt.gasUsed.toString()}`));
                        
                        // Show swap summary
                        console.log(chalk.cyan('\n📊 Swap Summary:'));
                        if (isBuy) {
                            console.log(chalk.gray(`  Spent: ${amount} sDAI`));
                            console.log(chalk.gray(`  Received: ~${expectedOut.toFixed(6)} ${outcomeToken}`));
                        } else {
                            console.log(chalk.gray(`  Sold: ${amount} ${outcomeToken}`));
                            console.log(chalk.gray(`  Received: ~${expectedOut.toFixed(6)} sDAI`));
                        }
                        
                        // Get actual amounts from transaction logs if possible
                        try {
                            // Parse swap event from logs to get actual amounts
                            const swapLog = receipt.logs.find(log => 
                                log.topics[0] === '0xcd3829a3813dc3cdd188fd3d01dcf3268c16be2fdd2dd21d0665418816e46062' // Swap event
                            );
                            if (swapLog) {
                                console.log(chalk.green('  ✅ Swap executed at expected rates'));
                            }
                        } catch (e) {
                            // Log parsing is optional
                        }
                        
                        // Refresh balances
                        await this.fetchBalances();
                    } else {
                        swapSpinner.fail('Swap transaction reverted');
                        console.log(chalk.red('Transaction status:', receipt.status));
                    }
                    
                } catch (error) {
                    swapSpinner.fail(`Swap failed: ${error.message}`);
                    console.log(chalk.yellow('\n⚠️ This might be due to:'));
                    console.log(chalk.gray('  - Insufficient liquidity in the prediction pool'));
                    console.log(chalk.gray('  - Price moved beyond slippage tolerance'));
                    console.log(chalk.gray('  - Pool may need initialization'));
                    console.log(chalk.gray('\nTip: Try a smaller amount or adjust slippage'));
                }
                
                return;
                
            } else if (marketType === 'COMPANY') {
                // Company market flow - trade COMPANY tokens against sDAI
                const companyAnswers = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'outcome',
                        message: 'Which outcome token to trade?',
                        choices: [
                            { name: chalk.green('YES_COMPANY tokens (betting on approval)'), value: 'YES' },
                            { name: chalk.red('NO_COMPANY tokens (betting on rejection)'), value: 'NO' }
                        ]
                    },
                    {
                        type: 'list',
                        name: 'side',
                        message: 'Trade direction?',
                        choices: [
                            { name: '📈 BUY outcome tokens (swap sDAI → YES/NO_COMPANY)', value: 'BUY' },
                            { name: '📉 SELL outcome tokens (swap YES/NO_COMPANY → sDAI)', value: 'SELL' }
                        ]
                    },
                    {
                        type: 'list',
                        name: 'swapType',
                        message: 'Swap type?',
                        choices: [
                            { name: '📊 Exact Input (specify amount to spend)', value: 'EXACT_IN' },
                            { name: '🎯 Exact Output (specify amount to receive)', value: 'EXACT_OUT' }
                        ]
                    },
                    {
                        type: 'input',
                        name: 'amount',
                        message: (answers) => {
                            const isYes = answers.outcome === 'YES';
                            const isBuy = answers.side === 'BUY';
                            const isExactOut = answers.swapType === 'EXACT_OUT';
                            
                            if (isBuy) {
                                // Buying with base currency (sDAI) - can use existing balance
                                const balanceInSDAI = parseFloat(formatEther(currencyBalance));
                                if (isExactOut) {
                                    const outcomeToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                                    return `Amount of ${outcomeToken} tokens you want to receive:`;
                                } else {
                                    return `Amount of sDAI to spend (balance: ${this.formatPriceWithUSD(balanceInSDAI)}):`;
                                }
                            } else {
                                // Selling outcome tokens - show existing + splittable
                                const outcomeToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                                const existing = conditionalBalances.find(b => b.label === outcomeToken)?.balance || 0n;
                                
                                // For company markets, we can split GNO to get more YES/NO_COMPANY tokens
                                const splittableCompany = companyBalance; // GNO can be split to get YES/NO_COMPANY
                                const total = existing + splittableCompany;
                                
                                if (isExactOut) {
                                    return `Amount of sDAI you want to receive:`;
                                } else {
                                    return `Amount of ${outcomeToken} to sell (available: ${formatEther(existing)} + ${formatEther(splittableCompany)} splittable = ${formatEther(total)} total):`;
                                }
                            }
                        },
                        default: '0.01',
                        validate: (input, answers) => {
                            const num = parseFloat(input);
                            if (num <= 0) return 'Please enter a positive amount';
                            
                            const isYes = answers.outcome === 'YES';
                            const isBuy = answers.side === 'BUY';
                            
                            if (isBuy) {
                                // Check sDAI balance
                                if (parseEther(input) > currencyBalance) {
                                    const maxBalance = parseFloat(formatEther(currencyBalance));
                                    return `Amount exceeds sDAI balance (max: ${this.formatPriceWithUSD(maxBalance)})`;
                                }
                            } else {
                                // Check outcome token balance (existing + splittable)
                                const outcomeToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                                const existing = conditionalBalances.find(b => b.label === outcomeToken)?.balance || 0n;
                                const splittableCompany = companyBalance;
                                const total = existing + splittableCompany;
                                if (parseEther(input) > total) return 'Amount exceeds available balance (including splittable)';
                            }
                            
                            return true;
                        }
                    }
                ]);
                
                outcome = companyAnswers.outcome;
                side = companyAnswers.side;
                amount = companyAnswers.amount;
                swapType = companyAnswers.swapType;
                
                // Ask for slippage tolerance
                const { slippageInput } = await inquirer.prompt([{
                    type: 'input',
                    name: 'slippageInput',
                    message: 'Slippage tolerance (%):', 
                    default: '2',
                    validate: (input) => {
                        const num = parseFloat(input);
                        if (isNaN(num) || num < 0.1 || num > 50) {
                            return 'Please enter a valid slippage between 0.1% and 50%';
                        }
                        return true;
                    }
                }]);
                
                slippage = parseFloat(slippageInput) / 100;
                
                // Calculate and show estimation BEFORE confirmation
                const amountWei = parseEther(amount);
                const isYes = outcome === 'YES';
                const isBuy = side === 'BUY';
                
                // Get the company pool - using COMPANY tokens against base sDAI
                const poolName = isYes ? 'YES_COMPANY/BASE_CURRENCY' : 'NO_COMPANY/BASE_CURRENCY';
                const pool = this.pools.predictionPools?.find(p => 
                    p.name === poolName || 
                    (isYes ? p.name.includes('YES_COMPANY') && p.name.includes('BASE') : 
                             p.name.includes('NO_COMPANY') && p.name.includes('BASE'))
                );
                const price = this.prices[poolName];
                
                if (!pool || !price) {
                    throw new Error(`${poolName} pool not found`);
                }
                
                // Determine token ordering in the pool
                const outcomeTokenAddress = isYes ? this.tokens.yesCompany : this.tokens.noCompany;
                const outcomeIsToken0 = price.token0.toLowerCase() === outcomeTokenAddress.toLowerCase();
                
                // Get the correct price: price means token1/token0
                // If outcome is token0: price = sDAI/outcome (how much sDAI per outcome token)
                // If outcome is token1: price = outcome/sDAI (how much outcome per sDAI)
                const displayPrice = outcomeIsToken0 ? price.price : price.priceInverse;
                
                // Calculate expected output
                let expectedOut;
                let minOut;
                
                console.log(chalk.cyan('\n━━━ 📊 Trade Estimation ━━━'));
                
                if (typeof swapType !== 'undefined' && swapType === 'EXACT_OUT') {
                    // For exact output, show what they want to receive and max willing to pay
                    if (isBuy) {
                        // Buying YES/NO_COMPANY tokens with sDAI - they want exact company tokens
                        const estimatedCost = parseFloat(amount) * displayPrice;
                        const maxCost = estimatedCost * (1 + slippage);
                        
                        console.log(chalk.green(`  You receive: ${amount} ${outcome}_COMPANY (exact)`));
                        console.log(chalk.white(`  You pay:     ~${this.formatPriceWithUSD(estimatedCost, 6)}`));
                        console.log(chalk.gray(`  Exchange rate: 1 ${outcome}_COMPANY = ${this.formatPriceWithUSD(displayPrice, 4)}`));
                        console.log(chalk.gray(`  Maximum input: ${this.formatPriceWithUSD(maxCost, 6)} (with ${slippage * 100}% slippage)`));
                    } else {
                        // Selling YES/NO_COMPANY tokens for sDAI - they want exact sDAI
                        const estimatedInput = parseFloat(amount) / displayPrice;
                        const maxInput = estimatedInput * (1 + slippage);
                        
                        console.log(chalk.green(`  You receive: ${this.formatPriceWithUSD(parseFloat(amount), 6)} (exact)`));
                        console.log(chalk.white(`  You sell:    ~${estimatedInput.toFixed(6)} ${outcome}_COMPANY`));
                        console.log(chalk.gray(`  Exchange rate: 1 ${outcome}_COMPANY = ${this.formatPriceWithUSD(displayPrice, 4)}`));
                        console.log(chalk.gray(`  Maximum input: ${maxInput.toFixed(6)} ${outcome}_COMPANY (with ${slippage * 100}% slippage)`));
                    }
                } else {
                    // For exact input, show normal estimation
                    if (isBuy) {
                        // Buying YES/NO_COMPANY tokens with sDAI
                        expectedOut = parseFloat(amount) / displayPrice;
                        minOut = expectedOut * (1 - slippage);
                        
                        console.log(chalk.white(`  You pay:     ${this.formatPriceWithUSD(parseFloat(amount))}`));
                        console.log(chalk.green(`  You receive: ~${expectedOut.toFixed(6)} ${outcome}_COMPANY`));
                        console.log(chalk.gray(`  Exchange rate: 1 ${outcome}_COMPANY = ${this.formatPriceWithUSD(displayPrice, 4)}`));
                        console.log(chalk.gray(`  Minimum output: ${minOut.toFixed(6)} ${outcome}_COMPANY (with ${slippage * 100}% slippage)`));
                    } else {
                        // Selling YES/NO_COMPANY tokens for sDAI
                        expectedOut = parseFloat(amount) * displayPrice;
                        minOut = expectedOut * (1 - slippage);
                        
                        console.log(chalk.white(`  You sell:    ${amount} ${outcome}_COMPANY`));
                        console.log(chalk.green(`  You receive: ~${this.formatPriceWithUSD(expectedOut, 6)}`));
                        console.log(chalk.gray(`  Exchange rate: 1 ${outcome}_COMPANY = ${this.formatPriceWithUSD(displayPrice, 4)}`));
                        console.log(chalk.gray(`  Minimum output: ${this.formatPriceWithUSD(minOut, 6)} (with ${slippage * 100}% slippage)`));
                    }
                }
                
                console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━'));
                
                // Ask if user wants to run simulation
                const { runSimulation } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'runSimulation',
                    message: 'Run simulation to calculate exact output and price impact?',
                    default: true
                }]);
                
                let simulatedOutput = null;
                let priceImpact = null;
                
                if (runSimulation) {
                    let simSpinner = ora('Preparing simulation...').start();
                    
                    try {
                        // Check if we need to split first for the simulation
                        const outcomeToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                        let existing = conditionalBalances.find(b => b.label === outcomeToken)?.balance || 0n;
                        
                        // If we need to split, do it NOW before simulation
                        if (!isBuy && existing < amountWei) {
                            const needToSplit = amountWei - existing;
                            simSpinner.text = `Need to split ${formatEther(needToSplit)} GNO for simulation...`;
                            
                            console.log(chalk.yellow(`\n📝 Preparing for simulation:`));
                            console.log(chalk.gray(`  Current ${outcomeToken}: ${formatEther(existing)}`));
                            console.log(chalk.gray(`  Needed: ${formatEther(amountWei)}`));
                            console.log(chalk.gray(`  Splitting: ${formatEther(needToSplit)} GNO\n`));
                            
                            // Stop spinner before prompting
                            simSpinner.stop();
                            
                            // Ask user to confirm split for simulation
                            const { confirmSplit } = await inquirer.prompt([{
                                type: 'confirm',
                                name: 'confirmSplit',
                                message: `Split ${formatEther(needToSplit)} GNO to enable simulation?`,
                                default: true
                            }]);
                            
                            if (confirmSplit) {
                                // ACTUALLY SPLIT THE TOKENS
                                console.log(chalk.cyan('\n🔄 Executing split for simulation...'));
                                await this.ensureApprovalWithStatus(this.tokens.companyToken, ROUTER_ADDRESS, needToSplit, 'GNO');
                                
                                const splitSpinner = ora('Executing split transaction...').start();
                                
                                for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
                                    proposal: this.proposal.address || this.proposal.id,
                                    amount: needToSplit,
                                    collateralToken: this.tokens.companyToken
                                })) {
                                    if (status.status === 'pending' && status.data?.hash) {
                                        splitSpinner.text = `Split transaction: ${status.data.hash.slice(0, 10)}...`;
                                    }
                                    if (status.status === 'success') {
                                        splitSpinner.succeed('Split successful! Now have tokens for simulation.');
                                        console.log(chalk.green(`✅ Split transaction: ${status.data.transactionHash.slice(0, 10)}...`));
                                        
                                        // Update balances after split
                                        await this.fetchBalances();
                                        // Update conditional balances
                                        const newBalance = await this.publicClient.readContract({
                                            address: isYes ? this.tokens.yesCompany : this.tokens.noCompany,
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
                                        
                                        existing = newBalance;
                                        console.log(chalk.gray(`\nNew ${outcomeToken} balance: ${formatEther(existing)}`));
                                        break;
                                    }
                                    if (status.status === 'error') {
                                        splitSpinner.fail('Split failed');
                                        throw new Error(`Split failed: ${status.error}`);
                                    }
                                }
                                
                                // Create new spinner for continuing simulation
                                simSpinner = ora('Running swap simulation...').start();
                            } else {
                                console.log(chalk.yellow('Simulation cancelled - requires splitting first'));
                                simulatedOutput = null;
                                priceImpact = null;
                            }
                        } else {
                            simSpinner.text = 'Running swap simulation...';
                        }
                        
                        if (!simSpinner.isSpinning) {
                            simSpinner = ora('Running swap simulation...').start();
                        } else {
                            simSpinner.text = 'Checking token approval for simulation...';
                        }
                        
                        // Prepare simulation parameters
                        const algebraRouter = '0xffb643e73f280b97809a8b41f7232ab401a04ee1';
                        const deadline = Math.floor(Date.now() / 1000) + 1200;
                        
                        // Get token addresses
                        let tokenIn, tokenOut;
                        if (isBuy) {
                            tokenIn = this.tokens.currencyToken; // sDAI
                            tokenOut = isYes ? this.tokens.yesCompany : this.tokens.noCompany;
                        } else {
                            tokenIn = isYes ? this.tokens.yesCompany : this.tokens.noCompany;
                            tokenOut = this.tokens.currencyToken; // sDAI
                        }
                        
                        // Check approval before simulation
                        const tokenInName = isBuy ? 'sDAI' : outcomeToken;
                        await this.ensureApprovalWithStatus(tokenIn, algebraRouter, amountWei, tokenInName);
                        
                        simSpinner.text = 'Simulating swap transaction...';
                        
                        // Simulate the swap call
                        const simulationResult = await this.publicClient.simulateContract({
                            address: algebraRouter,
                            abi: [{
                                "name": "exactInputSingle",
                                "type": "function",
                                "stateMutability": "payable",
                                "inputs": [
                                    {
                                        "name": "params",
                                        "type": "tuple",
                                        "components": [
                                            {"name": "tokenIn", "type": "address"},
                                            {"name": "tokenOut", "type": "address"},
                                            {"name": "recipient", "type": "address"},
                                            {"name": "deadline", "type": "uint256"},
                                            {"name": "amountIn", "type": "uint256"},
                                            {"name": "amountOutMinimum", "type": "uint256"},
                                            {"name": "limitSqrtPrice", "type": "uint160"}
                                        ]
                                    }
                                ],
                                "outputs": [{"name": "amountOut", "type": "uint256"}]
                            }],
                            functionName: 'exactInputSingle',
                            args: [{
                                tokenIn: tokenIn,
                                tokenOut: tokenOut,
                                recipient: this.account.address,
                                deadline: BigInt(deadline),
                                amountIn: amountWei,
                                amountOutMinimum: 0n, // Set to 0 for simulation
                                limitSqrtPrice: 0n
                            }],
                            account: this.account.address
                        });
                        
                        simulatedOutput = parseFloat(formatEther(simulationResult.result));
                        
                        simSpinner.succeed('Simulation complete');
                        
                        console.log(chalk.cyan('\n━━━ 🔬 Simulation Results ━━━\n'));
                        
                        // Output analysis
                        console.log(chalk.white.bold('📊 Output Analysis:'));
                        console.log(chalk.white(`  Expected output:  ${expectedOut.toFixed(6)} ${isBuy ? `${outcome}_COMPANY` : 'sDAI'}`));
                        console.log(chalk.green(`  Exact output:     ${simulatedOutput.toFixed(6)} ${isBuy ? `${outcome}_COMPANY` : 'sDAI'}`));
                        console.log(chalk.gray(`  Minimum output:   ${minOut.toFixed(6)} ${isBuy ? `${outcome}_COMPANY` : 'sDAI'} (${slippage * 100}% slippage)`));
                        
                        // Price impact analysis
                        console.log(chalk.white.bold('\n💹 Price Impact:'));
                        console.log(chalk.gray(`  Current rate:     1 ${outcome}_COMPANY = ${displayPrice.toFixed(4)} sDAI`));
                        
                        // Calculate new price after swap
                        const newPrice = isBuy ? 
                            parseFloat(amount) / simulatedOutput : // sDAI spent / COMPANY received
                            simulatedOutput / parseFloat(amount);  // sDAI received / COMPANY sold
                        
                        console.log(chalk.gray(`  New rate:         1 ${outcome}_COMPANY = ${newPrice.toFixed(4)} sDAI`));
                        
                        priceImpact = Math.abs((newPrice - displayPrice) / displayPrice * 100);
                        const impactColor = priceImpact < 1 ? chalk.green : priceImpact < 5 ? chalk.yellow : chalk.red;
                        console.log(impactColor(`  Price impact:     ${priceImpact.toFixed(3)}% ${priceImpact > 10 ? '⛔ HIGH' : ''}`));
                        
                        // Slippage comparison
                        const actualSlippage = Math.abs((simulatedOutput - expectedOut) / expectedOut * 100);
                        console.log(chalk.white.bold('\n⚡ Slippage Check:'));
                        console.log(chalk.gray(`  Max slippage set: ${slippage * 100}%`));
                        console.log(chalk.gray(`  Actual slippage:  ${actualSlippage.toFixed(3)}%`));
                        
                        // Alerts and warnings
                        if (priceImpact > slippage * 100) {
                            console.log(chalk.red.bold('\n⚠️  WARNING: Price impact exceeds slippage tolerance!'));
                            console.log(chalk.red(`    Consider reducing trade size or increasing slippage`));
                        }
                        
                        if (simulatedOutput < minOut) {
                            console.log(chalk.red.bold('\n⛔ WARNING: Output below minimum!'));
                            console.log(chalk.red('    Transaction will likely fail'));
                        }
                        
                        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━'));
                        
                    } catch (error) {
                        if (error.message.includes('insufficient balance')) {
                            simSpinner.fail('Simulation failed - Insufficient balance');
                            console.log(chalk.yellow('\n⚠️ You may not have enough tokens for this trade'));
                        } else if (error.message.includes('STF')) {
                            simSpinner.fail('Simulation failed - Insufficient liquidity');
                            console.log(chalk.yellow('\n⚠️ The pool may not have enough liquidity for this trade'));
                            console.log(chalk.gray('  Try a smaller amount or adjust slippage'));
                        } else {
                            simSpinner.fail('Simulation failed');
                            console.log(chalk.yellow('\nCould not simulate. Possible reasons:'));
                            console.log(chalk.gray('  - Pool may not exist for this pair'));
                            console.log(chalk.gray('  - Insufficient liquidity'));
                            console.log(chalk.gray('  - Pool needs initialization'));
                            console.log(chalk.gray(`\nError: ${error.message.substring(0, 100)}`));
                        }
                    }
                }
                
                // Ask for confirmation with simulation results
                // Display which contracts will be used for company market swap
                console.log(chalk.cyan.bold('\n🔧 Swap Execution Details:'));
                console.log(chalk.white('━'.repeat(50)));

                if (RUNTIME.chainId === 1) {
                    console.log(chalk.white(`  Chain:           ${chalk.yellow('Ethereum Mainnet')}`));
                    console.log(chalk.white(`  AMM:             ${chalk.yellow('Uniswap V3')}`));
                    console.log(chalk.white(`  Approval to:     ${chalk.cyan('0x000000000022D473030F116dDEE9F6B43aC78BA3')} (Permit2)`));
                    console.log(chalk.white(`  Router:          ${chalk.cyan('0x66a9893cc07d91d95644aedd05d03f95e1dba8af')} (Universal Router)`));
                } else if (RUNTIME.chainId === 137) {
                    console.log(chalk.white(`  Chain:           ${chalk.yellow('Polygon')}`));
                    console.log(chalk.white(`  AMM:             ${chalk.yellow('Uniswap V3')}`));
                    console.log(chalk.white(`  Approval to:     ${chalk.cyan('0x000000000022D473030F116dDEE9F6B43aC78BA3')} (Permit2)`));
                    console.log(chalk.white(`  Router:          ${chalk.cyan('0x1095692A6237d83C6a72F3F5eFEdb9A670C49223')} (Universal Router)`));
                } else if (RUNTIME.chainId === 100) {
                    console.log(chalk.white(`  Chain:           ${chalk.yellow('Gnosis Chain')}`));
                    console.log(chalk.white(`  AMM:             ${chalk.yellow('Swapr (Algebra V3)')}`));
                    console.log(chalk.white(`  Approval to:     ${chalk.cyan('0xffb643e73f280b97809a8b41f7232ab401a04ee1')} (Swapr Router)`));
                    console.log(chalk.white(`  Router:          ${chalk.cyan('0xffb643e73f280b97809a8b41f7232ab401a04ee1')} (Swapr V3 Router)`));
                }

                console.log(chalk.white(`  Gas Config:      Min ${RUNTIME.gasConfig?.minPriorityFeeGwei || 'auto'} gwei, Max ${RUNTIME.gasConfig?.maxFeeGwei || 'unlimited'} gwei`));
                console.log(chalk.white('━'.repeat(50)));

                const { confirmSwap } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirmSwap',
                        message: simulatedOutput ?
                            `Execute swap? (Output: ${simulatedOutput.toFixed(6)}, Impact: ${priceImpact?.toFixed(3)}%)` :
                            'Execute this swap?',
                        default: true
                    }
                ]);

                if (!confirmSwap) {
                    console.log(chalk.red('Trade cancelled'));
                    return;
                }

                console.log(chalk.cyan('\n📊 Executing Company Market Trade...'));
                
                // Execute the COMPANY market swap
                // Similar to prediction swap but with company tokens
                const outcomeToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                
                // Check if we need to split first
                const currentBalance = await this.publicClient.readContract({
                    address: isYes ? this.tokens.yesCompany : this.tokens.noCompany,
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
                
                const existing = currentBalance;
                
                console.log(chalk.gray(`Checking ${outcomeToken} balance: ${formatEther(existing)}`));
                
                if (!isBuy && existing < amountWei) {
                    // Need to split collateral first
                    const needToSplit = amountWei - existing;
                    console.log(chalk.yellow(`\n⚠️ Need to split ${formatEther(needToSplit)} GNO first to get ${outcomeToken}`));
                    
                    const { confirmSplit } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'confirmSplit',
                        message: `Split ${formatEther(needToSplit)} GNO to get YES/NO_COMPANY tokens first?`,
                        default: true
                    }]);
                    
                    if (!confirmSplit) {
                        console.log(chalk.red('Trade cancelled'));
                        return;
                    }
                    
                    // Execute split
                    console.log(chalk.cyan('Splitting collateral...'));
                    await this.ensureApprovalWithStatus(this.tokens.companyToken, ROUTER_ADDRESS, needToSplit, 'GNO');
                    
                    for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
                        proposal: this.proposal.address || this.proposal.id,
                        amount: needToSplit,
                        collateralToken: this.tokens.companyToken
                    })) {
                        if (status.status === 'success') {
                            console.log(chalk.green('✅ Split successful!'));
                        }
                    }
                }
                
                // Now execute the actual swap on the company market
                const swapSpinner = ora('Executing company market swap...').start();
                
                try {
                    // Get the correct token addresses for the swap
                    let tokenIn, tokenOut;
                    if (isBuy) {
                        tokenIn = this.tokens.currencyToken; // sDAI
                        tokenOut = isYes ? this.tokens.yesCompany : this.tokens.noCompany;
                    } else {
                        tokenIn = isYes ? this.tokens.yesCompany : this.tokens.noCompany;
                        tokenOut = this.tokens.currencyToken; // sDAI
                    }
                    
                    // Use correct router based on chain
                    const swapRouter = (RUNTIME.chainId === 137 || RUNTIME.chainId === 1)
                        ? (RUNTIME.uniswap?.permit2 || '0x000000000022D473030F116dDEE9F6B43aC78BA3')  // Approve to Permit2 for Uniswap chains
                        : '0xffb643e73f280b97809a8b41f7232ab401a04ee1';  // Swapr router for Gnosis

                    // Check approval for input token
                    swapSpinner.text = 'Checking token approval...';
                    const tokenInName = isBuy ? 'sDAI' : outcomeToken;
                    await this.ensureApprovalWithStatus(tokenIn, swapRouter, amountWei, tokenInName);
                    
                    // Calculate minimum output with slippage
                    const minAmountOut = parseEther((minOut * 0.98).toFixed(18)); // Additional 2% safety margin
                    
                    swapSpinner.text = 'Submitting swap transaction...';

                    const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes from now

                    let hash;

                    if (RUNTIME.chainId === 137 || RUNTIME.chainId === 1) {
                        // Use UniswapRouterCartridge for Ethereum and Polygon
                        swapSpinner.text = 'Executing swap via Universal Router...';

                        // Use the registered UniswapRouterCartridge
                        for await (const status of this.dataLayer.execute('uniswap.universal.swapV3', {
                            tokenIn,
                            tokenOut,
                            amountIn: formatEther(amountWei),
                            minAmountOut: formatEther(minAmountOut),
                            fee: 500 // 0.05% fee tier
                        })) {
                            if (status.status === 'pending') {
                                swapSpinner.text = status.message || swapSpinner.text;
                            } else if (status.status === 'success') {
                                hash = status.data?.transactionHash || status.data?.hash;
                                break;
                            } else if (status.status === 'error') {
                                throw new Error(status.message || 'Universal Router swap failed');
                            }
                        }
                    } else {
                        // Use Swapr/Algebra for Gnosis
                        swapSpinner.text = 'Executing swap on Algebra...';

                        hash = await this.walletClient.writeContract({
                            address: swapRouter,
                            abi: [{
                                "name": "exactInputSingle",
                                "type": "function",
                                "stateMutability": "payable",
                                "inputs": [
                                    {
                                        "name": "params",
                                        "type": "tuple",
                                        "components": [
                                            {"name": "tokenIn", "type": "address"},
                                            {"name": "tokenOut", "type": "address"},
                                            {"name": "recipient", "type": "address"},
                                            {"name": "deadline", "type": "uint256"},
                                            {"name": "amountIn", "type": "uint256"},
                                            {"name": "amountOutMinimum", "type": "uint256"},
                                            {"name": "limitSqrtPrice", "type": "uint160"}
                                        ]
                                    }
                                ],
                                "outputs": [{"name": "amountOut", "type": "uint256"}]
                            }],
                            functionName: 'exactInputSingle',
                            args: [{
                                tokenIn,
                                tokenOut,
                                recipient: this.account.address,
                                deadline: BigInt(deadline),
                                amountIn: amountWei,
                                amountOutMinimum: minAmountOut,
                                limitSqrtPrice: 0n
                            }],
                            account: this.account
                        });
                    }
                    
                    swapSpinner.text = `Waiting for transaction confirmation: ${hash.slice(0, 10)}...`;
                    
                    const receipt = await this.publicClient.waitForTransactionReceipt({ 
                        hash,
                        confirmations: 1
                    });
                    
                    if (receipt.status === 'success') {
                        swapSpinner.succeed('Company market swap successful!');
                        console.log(chalk.green('✅ Transaction Hash:'), receipt.transactionHash);
                console.log(chalk.gray('View on Explorer:'), txLink(receipt.transactionHash));
                        
                        // Parse actual output from logs if possible
                        const swapEvent = receipt.logs.find(log => 
                            log.topics[0] === '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'
                        );
                        
                        if (swapEvent) {
                            // Decode swap event to get actual amounts
                            const amount0 = BigInt(`0x${swapEvent.data.slice(2, 66)}`);
                            const amount1 = BigInt(`0x${swapEvent.data.slice(66, 130)}`);
                            console.log(chalk.cyan('\n📊 Actual swap amounts:'));
                            console.log(chalk.gray(`  Token0: ${formatEther(amount0 > 0n ? amount0 : -amount0)}`));
                            console.log(chalk.gray(`  Token1: ${formatEther(amount1 > 0n ? amount1 : -amount1)}`));
                        }
                        
                        // Refresh balances
                        await this.fetchBalances();
                    } else {
                        swapSpinner.fail('Swap transaction reverted');
                        console.log(chalk.red('Transaction status:', receipt.status));
                    }
                    
                } catch (error) {
                    swapSpinner.fail(`Swap failed: ${error.message}`);
                    console.log(chalk.yellow('\n⚠️ This might be due to:'));
                    console.log(chalk.gray('  - Insufficient liquidity in the company pool'));
                    console.log(chalk.gray('  - Price moved beyond slippage tolerance'));
                    console.log(chalk.gray('  - Pool may need initialization'));
                    console.log(chalk.gray('\nTip: Try a smaller amount or adjust slippage'));
                }
                
                return;
                
            } else {
                // Conditional market flow (existing logic)
                const conditionalAnswers = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'outcome',
                        message: 'Which conditional pool to trade on?',
                        choices: [
                            { name: chalk.green('YES pool (YES_COMPANY ↔ YES_CURRENCY)'), value: 'YES' },
                            { name: chalk.red('NO pool (NO_COMPANY ↔ NO_CURRENCY)'), value: 'NO' }
                        ]
                    },
                    {
                        type: 'list',
                        name: 'side',
                        message: 'Trade direction?',
                        choices: [
                            { name: '📈 BUY Company tokens (swap Currency → Company)', value: 'BUY' },
                            { name: '📉 SELL Company tokens (swap Company → Currency)', value: 'SELL' }
                        ]
                    },
                    {
                        type: 'list',
                        name: 'swapType',
                        message: 'Swap type?',
                        choices: [
                            { name: '📊 Exact Input (specify amount to spend)', value: 'EXACT_IN' },
                            { name: '🎯 Exact Output (specify amount to receive)', value: 'EXACT_OUT' }
                        ]
                    },
                {
                    type: 'input',
                    name: 'amount',
                    message: (answers) => {
                        // Calculate available balance
                        const isYes = answers.outcome === 'YES';
                        const isBuy = answers.side === 'BUY';
                        const isExactOut = answers.swapType === 'EXACT_OUT';
                        
                        if (isBuy) {
                            // Buying company with currency
                            const currencyToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                            const companyToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                            
                            if (isExactOut) {
                                return `Amount of ${companyToken} tokens you want to receive:`;
                            } else {
                                const existing = conditionalBalances.find(b => b.label === currencyToken)?.balance || 0n;
                                const splittable = currencyBalance;
                                const total = existing + splittable;
                                return `Amount of ${currencyToken} to swap (available: ${formatEther(existing)} + ${formatEther(splittable)} splittable = ${formatEther(total)} total):`;
                            }
                        } else {
                            // Selling company for currency
                            const companyToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                            const currencyToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                            
                            if (isExactOut) {
                                return `Amount of ${currencyToken} tokens you want to receive:`;
                            } else {
                                const existing = conditionalBalances.find(b => b.label === companyToken)?.balance || 0n;
                                const splittable = companyBalance;
                                const total = existing + splittable;
                                return `Amount of ${companyToken} to swap (available: ${formatEther(existing)} + ${formatEther(splittable)} splittable = ${formatEther(total)} total):`;
                            }
                        }
                    },
                    default: '0.01',
                    validate: (input, answers) => {
                        const num = parseFloat(input);
                        if (num <= 0) return 'Please enter a positive amount';
                        
                        // Check total available balance
                        const isYes = answers.outcome === 'YES';
                        const isBuy = answers.side === 'BUY';
                        
                        if (isBuy) {
                            const currencyToken = isYes ? 'YES_CURRENCY' : 'NO_CURRENCY';
                            const existing = conditionalBalances.find(b => b.label === currencyToken)?.balance || 0n;
                            const total = existing + currencyBalance;
                            if (parseEther(input) > total) return 'Amount exceeds available balance';
                        } else {
                            const companyToken = isYes ? 'YES_COMPANY' : 'NO_COMPANY';
                            const existing = conditionalBalances.find(b => b.label === companyToken)?.balance || 0n;
                            const total = existing + companyBalance;
                            if (parseEther(input) > total) return 'Amount exceeds available balance';
                        }
                        
                        return true;
                    }
                }
                ]);
                
                outcome = conditionalAnswers.outcome;
                side = conditionalAnswers.side;
                amount = conditionalAnswers.amount;
                swapType = conditionalAnswers.swapType;
                
                // Ask for slippage tolerance for conditional swap too
                const { slippageInput } = await inquirer.prompt([{
                    type: 'input',
                    name: 'slippageInput',
                    message: 'Slippage tolerance (%):', 
                    default: '0.5',
                    validate: (input) => {
                        const num = parseFloat(input);
                        if (isNaN(num) || num < 0.1 || num > 50) {
                            return 'Please enter a valid slippage between 0.1% and 50%';
                        }
                        return true;
                    }
                }]);
                
                slippage = parseFloat(slippageInput) / 100;
            }
            
            // Setup swap parameters
            const isYes = outcome === 'YES';
            const isBuy = side === 'BUY';
            const amountWei = parseEther(amount);
            
            // Get wrapped token addresses
            const tokenInLabel = isBuy ? 
                (isYes ? 'YES_CURRENCY' : 'NO_CURRENCY') : 
                (isYes ? 'YES_COMPANY' : 'NO_COMPANY');
            const tokenOutLabel = isBuy ?
                (isYes ? 'YES_COMPANY' : 'NO_COMPANY') :
                (isYes ? 'YES_CURRENCY' : 'NO_CURRENCY');
            let tokenInWrapped, tokenOutWrapped;
            
            // Handle both data sources
            if (this.proposal.wrapped && this.proposal.wrapped.wrappedOutcomes) {
                // Use wrapped data from blockchain
                tokenInWrapped = this.proposal.wrapped.wrappedOutcomes.find(o => o.label === tokenInLabel)?.wrapped1155;
                tokenOutWrapped = this.proposal.wrapped.wrappedOutcomes.find(o => o.label === tokenOutLabel)?.wrapped1155;
            } else if (this.tokens) {
                // Use token addresses from Supabase data
                const tokenMap = {
                    'YES_COMPANY': this.tokens.yesCompany,
                    'NO_COMPANY': this.tokens.noCompany,
                    'YES_CURRENCY': this.tokens.yesCurrency,
                    'NO_CURRENCY': this.tokens.noCurrency
                };
                tokenInWrapped = tokenMap[tokenInLabel];
                tokenOutWrapped = tokenMap[tokenOutLabel];
            }
            
            if (!tokenInWrapped || !tokenOutWrapped) {
                throw new Error('Could not find wrapped token addresses');
            }
            
            // Find the pool and price
            const poolName = isYes ? 'YES_COMPANY/YES_CURRENCY' : 'NO_COMPANY/NO_CURRENCY';
            const pool = this.pools.conditionalPools.find(p => p.name === poolName);
            const price = this.prices[poolName];
            
            if (!pool || !price) {
                throw new Error(`${poolName} pool or price not found`);
            }
            
            // Calculate expected output based on pool price
            let expectedAmountOut;
            let rate;
            
            // Determine which token is token0 in the pool
            // For YES pool: comparing YES_COMPANY with token0
            // For NO pool: comparing NO_COMPANY with token0
            const companyToken = isYes ? this.tokens.yesCompany : this.tokens.noCompany;
            const companyIsToken0 = price.token0.toLowerCase() === companyToken.toLowerCase();
            
            // Get the correct rate: price means token1/token0
            // If company is token0: price = currency/company (how much currency per company)
            // If company is token1: price = company/currency (how much company per currency)
            
            // For display: always show as "1 COMPANY = X CURRENCY"
            const displayRate = companyIsToken0 ? price.price : price.priceInverse;
            
            if (isBuy) {
                // Buying company with currency
                // We pay currency, we get company
                // If 1 COMPANY = 0.0081 CURRENCY, then 1 CURRENCY = 123.46 COMPANY
                expectedAmountOut = parseFloat(amount) / displayRate;
            } else {
                // Selling company for currency
                // We pay company, we get currency
                // If 1 COMPANY = 0.0081 CURRENCY, then selling 1 COMPANY gets 0.0081 CURRENCY
                expectedAmountOut = parseFloat(amount) * displayRate;
            }
            
            rate = displayRate; // Use for display
            
            // Calculate minimum output with user's slippage
            const slippageMultiplier = 1 - slippage;
            const minAmountOut = expectedAmountOut * slippageMultiplier;
            const minAmountOutWei = BigInt(Math.floor(minAmountOut * (10 ** 18)));
            
            // Show trade estimation BEFORE confirmation
            console.log(chalk.cyan('\n━━━ 💱 Trade Estimation ━━━'));
            console.log(chalk.gray(`  Pool: ${poolName}`));
            
            if (swapType === 'EXACT_OUT') {
                // For exact output, show what they want to receive and max willing to pay
                if (isBuy) {
                    // Buying company tokens with currency - want exactly 1 YES_COMPANY
                    const estimatedCost = parseFloat(amount) * rate; // How much currency we expect to pay
                    const maxCost = estimatedCost * (1 + slippage); // Maximum we're willing to pay
                    
                    console.log(chalk.green(`  You receive: ${amount} ${tokenOutLabel} (exact)`));
                    console.log(chalk.white(`  You pay:     ~${estimatedCost.toFixed(6)} ${tokenInLabel}`));
                    console.log(chalk.gray(`  Exchange rate: 1 COMPANY = ${rate.toFixed(4)} CURRENCY`));
                    console.log(chalk.gray(`  Maximum input: ${maxCost.toFixed(6)} ${tokenInLabel} (with ${(slippage * 100).toFixed(1)}% slippage)`));
                } else {
                    // Selling company tokens for currency - want exactly X currency
                    const estimatedInput = parseFloat(amount) / rate; // How much company tokens we expect to spend
                    const maxInput = estimatedInput * (1 + slippage); // Maximum company tokens we're willing to spend
                    
                    console.log(chalk.green(`  You receive: ${amount} ${tokenOutLabel} (exact)`));
                    console.log(chalk.white(`  You sell:    ~${estimatedInput.toFixed(6)} ${tokenInLabel}`));
                    console.log(chalk.gray(`  Exchange rate: 1 COMPANY = ${rate.toFixed(4)} CURRENCY`));
                    console.log(chalk.gray(`  Maximum input: ${maxInput.toFixed(6)} ${tokenInLabel} (with ${(slippage * 100).toFixed(1)}% slippage)`));
                }
            } else {
                // For exact input, show normal estimation
                if (isBuy) {
                    console.log(chalk.white(`  You pay:     ${amount} ${tokenInLabel}`));
                    console.log(chalk.green(`  You receive: ~${expectedAmountOut.toFixed(6)} ${tokenOutLabel}`));
                    console.log(chalk.gray(`  Exchange rate: 1 COMPANY = ${rate.toFixed(4)} CURRENCY`));
                } else {
                    console.log(chalk.white(`  You sell:    ${amount} ${tokenInLabel}`));
                    console.log(chalk.green(`  You receive: ~${expectedAmountOut.toFixed(6)} ${tokenOutLabel}`));
                    console.log(chalk.gray(`  Exchange rate: 1 COMPANY = ${rate.toFixed(4)} CURRENCY`));
                }
                
                const outputDecimals = expectedAmountOut < 0.000001 ? 12 : 
                                       expectedAmountOut < 0.001 ? 9 : 6;
                console.log(chalk.gray(`  Minimum output: ${minAmountOut.toFixed(outputDecimals)} ${tokenOutLabel} (with ${(slippage * 100).toFixed(1)}% slippage)`));
            }
            console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━'));
            
            // Ask if user wants to run simulation for conditional swap too
            const { runSimulation } = await inquirer.prompt([{
                type: 'confirm',
                name: 'runSimulation',
                message: 'Run simulation to calculate exact output and price impact?',
                default: true
            }]);
            
            let simulatedOutput = null;
            let priceImpact = null;
            
            if (runSimulation) {
                const simSpinner = ora('Running transaction simulation...').start();
                
                try {
                    // Check if we need to split first for the simulation
                    const existingBalance = conditionalBalances.find(b => b.label === tokenInLabel)?.balance || 0n;
                    
                    // For exact output, use maximum input amount; for exact input, use input amount
                    let requiredInputWei;
                    if (swapType === 'EXACT_OUT') {
                        // For exact output, use the maximum input amount (with slippage)
                        const maxInput = parseFloat(amount) * rate * (1 + slippage);
                        requiredInputWei = parseEther(maxInput.toString());
                    } else {
                        // For exact input, we need the exact input amount
                        requiredInputWei = amountWei;
                    }
                    
                    if (existingBalance < requiredInputWei) {
                        const splitNeeded = requiredInputWei - existingBalance;
                        simSpinner.text = `Need to split ${formatEther(splitNeeded)} tokens for simulation...`;
                        
                        console.log(chalk.yellow(`\n📝 Preparing for simulation:`));
                        console.log(chalk.gray(`  Current ${tokenInLabel}: ${formatEther(existingBalance)}`));
                        if (swapType === 'EXACT_OUT') {
                            console.log(chalk.gray(`  Max needed: ${formatEther(requiredInputWei)} (for ${amount} ${tokenOutLabel} output)`));
                        } else {
                            console.log(chalk.gray(`  Needed: ${formatEther(requiredInputWei)}`));
                        }
                        console.log(chalk.gray(`  Splitting: ${formatEther(splitNeeded)} from collateral\n`));
                        
                        // Stop spinner before prompting
                        simSpinner.stop();
                        
                        // Ask user to confirm split for simulation
                        const { confirmSplit } = await inquirer.prompt([{
                            type: 'confirm',
                            name: 'confirmSplit',
                            message: `Split ${formatEther(splitNeeded)} collateral to enable simulation?`,
                            default: true
                        }]);
                        
                        if (confirmSplit) {
                            // Determine which collateral to split
                            const collateralToken = isBuy ? this.tokens.currencyToken : this.tokens.companyToken;
                            const collateralName = isBuy ? 'sDAI' : 'GNO';
                            
                            // Execute split
                            console.log(chalk.cyan('\n🔄 Executing split for simulation...'));
                            await this.ensureApprovalWithStatus(collateralToken, ROUTER_ADDRESS, splitNeeded, collateralName);
                            
                            const splitSpinner = ora('Executing split transaction...').start();
                            
                            for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
                                proposal: this.proposal.address || this.proposal.id,
                                amount: splitNeeded,
                                collateralToken: collateralToken
                            })) {
                                if (status.status === 'pending' && status.data?.hash) {
                                    splitSpinner.text = `Split transaction: ${status.data.hash.slice(0, 10)}...`;
                                }
                                if (status.status === 'success') {
                                    splitSpinner.succeed('Split successful! Now have tokens for simulation.');
                                    console.log(chalk.green(`✅ Split transaction: ${status.data.transactionHash.slice(0, 10)}...`));
                                    
                                    // Update balances after split
                                    await this.fetchBalances();
                                    // Update conditional balances
                                    conditionalBalances = await this.getConditionalTokenBalances();
                                    
                                    break;
                                }
                                if (status.status === 'error') {
                                    splitSpinner.fail('Split failed');
                                    throw new Error(`Split failed: ${status.error}`);
                                }
                            }
                            
                            // Restart simulation spinner
                            simSpinner = ora('Continuing with simulation...').start();
                        } else {
                            console.log(chalk.yellow('Simulation cancelled - requires splitting first'));
                            simSpinner.stop();
                            simulatedOutput = null;
                            priceImpact = null;
                            // Don't proceed with simulation
                            throw new Error('User cancelled split');
                        }
                    }
                    
                    const algebraRouter = '0xffb643e73f280b97809a8b41f7232ab401a04ee1';
                    const deadline = Math.floor(Date.now() / 1000) + 1200;
                    
                    // Check approval before simulation
                    simSpinner.text = 'Checking token approval for simulation...';
                    await this.ensureApprovalWithStatus(tokenInWrapped, algebraRouter, amountWei, tokenInLabel);
                    
                    simSpinner.text = 'Simulating swap transaction...';
                    
                    let simulationResult;
                    
                    if (typeof swapType !== 'undefined' && swapType === 'EXACT_OUT') {
                        // For exact output, use exactOutputSingle 
                        const maxAmountIn = parseFloat(amount) * rate * (1 + slippage * 2); // Extra buffer for simulation
                        const maxAmountInWei = parseEther(maxAmountIn.toString());
                        
                        simulationResult = await this.publicClient.simulateContract({
                            address: algebraRouter,
                            abi: [{
                                "name": "exactOutputSingle",
                                "type": "function",
                                "stateMutability": "payable",
                                "inputs": [{
                                    "name": "params",
                                    "type": "tuple",
                                    "components": [
                                        {"name": "tokenIn", "type": "address"},
                                        {"name": "tokenOut", "type": "address"},
                                        {"name": "fee", "type": "uint24"},
                                        {"name": "recipient", "type": "address"},
                                        {"name": "deadline", "type": "uint256"},
                                        {"name": "amountOut", "type": "uint256"},
                                        {"name": "amountInMaximum", "type": "uint256"},
                                        {"name": "limitSqrtPrice", "type": "uint160"}
                                    ]
                                }],
                                "outputs": [{"name": "amountIn", "type": "uint256"}]
                            }],
                            functionName: 'exactOutputSingle',
                            args: [{
                                tokenIn: tokenInWrapped,
                                tokenOut: tokenOutWrapped,
                                fee: 3000, // 0.3% fee
                                recipient: this.account.address,
                                deadline: BigInt(deadline),
                                amountOut: amountWei, // Exact amount we want to receive
                                amountInMaximum: maxAmountInWei, // Maximum we're willing to pay
                                limitSqrtPrice: 0n
                            }],
                            account: this.account.address
                        });
                        
                        // For exact output, the result is the actual amount spent
                        const actualAmountSpent = parseFloat(formatEther(simulationResult.result));
                        simulatedOutput = parseFloat(amount); // We know we'll get exactly what we asked for
                        
                        console.log(`\n🎯 Exact Output Simulation:`);
                        console.log(`  Requested: ${amount} ${tokenOutLabel}`);
                        console.log(`  Will spend: ${actualAmountSpent.toFixed(6)} ${tokenInLabel}`);
                        console.log(`  Expected spend: ~${(parseFloat(amount) * rate).toFixed(6)} ${tokenInLabel}`);
                        
                    } else {
                        // For exact input, use exactInputSingle (existing logic)
                        simulationResult = await this.publicClient.simulateContract({
                            address: algebraRouter,
                            abi: [{
                                "name": "exactInputSingle",
                                "type": "function",
                                "stateMutability": "payable",
                                "inputs": [{
                                    "name": "params",
                                    "type": "tuple",
                                    "components": [
                                        {"name": "tokenIn", "type": "address"},
                                        {"name": "tokenOut", "type": "address"},
                                        {"name": "recipient", "type": "address"},
                                        {"name": "deadline", "type": "uint256"},
                                        {"name": "amountIn", "type": "uint256"},
                                        {"name": "amountOutMinimum", "type": "uint256"},
                                        {"name": "limitSqrtPrice", "type": "uint160"}
                                    ]
                                }],
                                "outputs": [{"name": "amountOut", "type": "uint256"}]
                            }],
                            functionName: 'exactInputSingle',
                            args: [{
                                tokenIn: tokenInWrapped,
                                tokenOut: tokenOutWrapped,
                                recipient: this.account.address,
                                deadline: BigInt(deadline),
                                amountIn: amountWei,
                                amountOutMinimum: 0n,
                                limitSqrtPrice: 0n
                            }],
                            account: this.account.address
                        });
                        
                        simulatedOutput = parseFloat(formatEther(simulationResult.result));
                    }
                    
                    // Calculate price impact for conditional market
                    let actualRate, newRate;
                    
                    if (typeof swapType !== 'undefined' && swapType === 'EXACT_OUT') {
                        // For exact output, we compare actual amount spent vs expected
                        const actualAmountSpent = parseFloat(formatEther(simulationResult.result));
                        const expectedAmountSpent = parseFloat(amount) * rate;
                        
                        priceImpact = Math.abs((actualAmountSpent - expectedAmountSpent) / expectedAmountSpent * 100);
                        
                        // For display purposes
                        actualRate = isBuy ? 
                            actualAmountSpent / parseFloat(amount) :  // actual CURRENCY per COMPANY
                            parseFloat(amount) / actualAmountSpent;   // actual COMPANY per CURRENCY
                        newRate = actualRate;
                        
                    } else {
                        // For exact input, original logic
                        actualRate = isBuy ? 
                            parseFloat(amount) / simulatedOutput :
                            simulatedOutput / parseFloat(amount);
                        
                        priceImpact = Math.abs((actualRate - rate) / rate * 100);
                        newRate = actualRate;
                    }
                    
                    simSpinner.succeed('Simulation complete');
                    
                    // Show comprehensive results for conditional market
                    console.log(chalk.cyan('\n━━━ 🔬 Simulation Results ━━━'));
                    
                    if (typeof swapType !== 'undefined' && swapType === 'EXACT_OUT') {
                        // Show input comparison for exact output
                        const actualAmountSpent = parseFloat(formatEther(simulationResult.result));
                        const expectedAmountSpent = parseFloat(amount) * rate;
                        const maxAmountSpent = expectedAmountSpent * (1 + slippage);
                        
                        console.log(chalk.white.bold('\n📊 Input Analysis (Exact Output):'));
                        console.log(chalk.green(`  Exact output:     ${amount} ${tokenOutLabel} (guaranteed)`));
                        console.log(chalk.white(`  Expected cost:    ${expectedAmountSpent.toFixed(6)} ${tokenInLabel}`));
                        console.log(chalk.yellow(`  Actual cost:      ${actualAmountSpent.toFixed(6)} ${tokenInLabel}`));
                        console.log(chalk.gray(`  Maximum cost:     ${maxAmountSpent.toFixed(6)} ${tokenInLabel} (${(slippage * 100).toFixed(1)}% slippage)`));
                    } else {
                        // Show output comparison for exact input
                        console.log(chalk.white.bold('\n📊 Output Analysis:'));
                        console.log(chalk.white(`  Expected output:  ${expectedAmountOut.toFixed(6)} ${tokenOutLabel}`));
                        console.log(chalk.green(`  Exact output:     ${simulatedOutput.toFixed(6)} ${tokenOutLabel}`));
                        console.log(chalk.gray(`  Minimum output:   ${minAmountOut.toFixed(6)} ${tokenOutLabel} (${(slippage * 100).toFixed(1)}% slippage)`));
                    }
                    
                    // Price impact for conditional pools
                    console.log(chalk.white.bold('\n💹 Price Impact:'));
                    console.log(chalk.gray(`  Current rate:     1 COMPANY = ${rate.toFixed(4)} CURRENCY`));
                    console.log(chalk.gray(`  New rate:         1 COMPANY = ${newRate.toFixed(4)} CURRENCY`));
                    
                    if (priceImpact < 0.5) {
                        console.log(chalk.green(`  Price impact:     ${priceImpact.toFixed(3)}% ✅`));
                    } else if (priceImpact < 2) {
                        console.log(chalk.yellow(`  Price impact:     ${priceImpact.toFixed(3)}% ⚠️`));
                    } else {
                        console.log(chalk.red(`  Price impact:     ${priceImpact.toFixed(3)}% ⛔ HIGH`));
                    }
                    
                    // Slippage check  
                    let actualSlippage;
                    if (swapType === 'EXACT_OUT') {
                        // For exact output, compare input amounts (what we spend vs what we expected to spend)
                        const actualInput = parseFloat(formatEther(simulationResult.result)); // Amount actually spent
                        const expectedInput = parseFloat(amount) * rate; // Expected amount to spend
                        actualSlippage = Math.abs((actualInput - expectedInput) / expectedInput * 100);
                    } else {
                        // For exact input, compare output amounts as before
                        actualSlippage = Math.abs((simulatedOutput - expectedAmountOut) / expectedAmountOut * 100);
                    }
                    console.log(chalk.white.bold('\n⚡ Slippage Check:'));
                    console.log(chalk.gray(`  Max slippage set: ${(slippage * 100).toFixed(1)}%`));
                    console.log(chalk.gray(`  Actual slippage:  ${actualSlippage.toFixed(3)}%`));
                    
                    // Warnings
                    if (priceImpact > slippage * 100) {
                        console.log(chalk.red.bold('\n⚠️  WARNING: Price impact exceeds slippage!'));
                    }
                    
                    // For exact output, check if input exceeds maximum; for exact input, check if output below minimum
                    if (swapType === 'EXACT_OUT') {
                        const actualInput = parseFloat(formatEther(simulationResult.result));
                        const maxInput = parseFloat(amount) * rate * (1 + slippage);
                        if (actualInput > maxInput) {
                            console.log(chalk.red.bold('\n⛔ ALERT: Input exceeds maximum!'));
                            console.log(chalk.red(`    Max willing to pay: ${maxInput.toFixed(6)}, Required: ${actualInput.toFixed(6)}`));
                        }
                    } else {
                        if (simulatedOutput < parseFloat(formatEther(minAmountOutWei))) {
                            console.log(chalk.red.bold('\n⛔ ALERT: Output below minimum!'));
                        }
                    }
                    
                    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━'));
                    
                } catch (error) {
                    if (error.message === 'User cancelled split') {
                        // User cancelled, don't show error
                    } else {
                        simSpinner.fail('Simulation failed');
                        console.log(chalk.yellow('Could not simulate. Possible reasons:'));
                        console.log(chalk.gray('  - Insufficient liquidity'));
                        console.log(chalk.gray('  - Pool needs initialization'));
                        console.log(chalk.gray(`\nError: ${error.message.substring(0, 100)}`));
                    }
                }
            }
            
            // Display which contracts will be used
            console.log(chalk.cyan.bold('\n🔧 Swap Execution Details:'));
            console.log(chalk.white('━'.repeat(50)));

            if (RUNTIME.chainId === 1) {
                console.log(chalk.white(`  Chain:           ${chalk.yellow('Ethereum Mainnet')}`));
                console.log(chalk.white(`  AMM:             ${chalk.yellow('Uniswap V3')}`));
                console.log(chalk.white(`  Approval to:     ${chalk.cyan('0x000000000022D473030F116dDEE9F6B43aC78BA3')} (Permit2)`));
                console.log(chalk.white(`  Router:          ${chalk.cyan('0x66a9893cc07d91d95644aedd05d03f95e1dba8af')} (Universal Router)`));
            } else if (RUNTIME.chainId === 137) {
                console.log(chalk.white(`  Chain:           ${chalk.yellow('Polygon')}`));
                console.log(chalk.white(`  AMM:             ${chalk.yellow('Uniswap V3')}`));
                console.log(chalk.white(`  Approval to:     ${chalk.cyan('0x000000000022D473030F116dDEE9F6B43aC78BA3')} (Permit2)`));
                console.log(chalk.white(`  Router:          ${chalk.cyan('0x1095692A6237d83C6a72F3F5eFEdb9A670C49223')} (Universal Router)`));
            } else if (RUNTIME.chainId === 100) {
                console.log(chalk.white(`  Chain:           ${chalk.yellow('Gnosis Chain')}`));
                console.log(chalk.white(`  AMM:             ${chalk.yellow('Swapr (Algebra V3)')}`));
                console.log(chalk.white(`  Approval to:     ${chalk.cyan('0xffb643e73f280b97809a8b41f7232ab401a04ee1')} (Swapr Router)`));
                console.log(chalk.white(`  Router:          ${chalk.cyan('0xffb643e73f280b97809a8b41f7232ab401a04ee1')} (Swapr V3 Router)`));
            }

            console.log(chalk.white(`  Gas Config:      Min ${RUNTIME.gasConfig?.minPriorityFeeGwei || 'auto'} gwei, Max ${RUNTIME.gasConfig?.maxFeeGwei || 'unlimited'} gwei`));
            console.log(chalk.white('━'.repeat(50)));

            const { confirmSwap } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmSwap',
                    message: simulatedOutput ?
                        `Execute swap? (Output: ${simulatedOutput.toFixed(6)}, Impact: ${priceImpact?.toFixed(3)}%)` :
                        'Execute this swap?',
                    default: true
                }
            ]);
            
            if (!confirmSwap) return;
            
            const swapSpinner = ora('Preparing swap...').start();
            
            // Check existing balance and split if needed
            const existingBalance = conditionalBalances.find(b => b.label === tokenInLabel)?.balance || 0n;
            
            if (existingBalance < amountWei) {
                const splitNeeded = amountWei - existingBalance;
                swapSpinner.text = `Need to split ${formatEther(splitNeeded)} more tokens...`;
                
                // Determine which collateral to split
                const collateralToken = isBuy ? this.tokens.currencyToken : this.tokens.companyToken;
                
                // Ensure approval for splitting
                await this.ensureApproval(collateralToken, ROUTER_ADDRESS, splitNeeded);
                
                // Execute split
                swapSpinner.text = 'Splitting collateral into conditional tokens...';
                for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
                    proposal: this.proposal.address,
                    amount: splitNeeded,
                    collateralToken: collateralToken
                })) {
                    if (status.status === 'success') {
                        console.log(chalk.green('\n✅ Split transaction:'), status.data.transactionHash);
                    } else if (status.status === 'error') {
                        throw new Error(`Split failed: ${status.error}`);
                    }
                }
            }
            
            // Ensure approval for swap
            swapSpinner.text = 'Checking token approval for swap...';
            const swapRouterAddress = (RUNTIME.chainId === 137 || RUNTIME.chainId === 1)
                ? (RUNTIME.uniswap?.permit2 || '0x000000000022D473030F116dDEE9F6B43aC78BA3')  // Approve to Permit2 for Uniswap
                : '0xffb643e73f280b97809a8b41f7232ab401a04ee1';  // Swapr router for Gnosis
            await this.ensureApproval(tokenInWrapped, swapRouterAddress, amountWei);
            
            // Defer setting Algebra spinner until we actually choose Algebra branch
            
            const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes from now
            
            try {
                // Choose between exact input or exact output
                let hash;
                
        if (RUNTIME.chainId === 137 || RUNTIME.chainId === 1) {
            swapSpinner.text = 'Executing swap via Universal Router...';
            // Use the new UniswapRouterCartridge for Ethereum and Polygon
            console.log('[DEBUG][Universal Router] Executing swap with', {
                tokenIn: tokenInWrapped, tokenOut: tokenOutWrapped,
                amountIn: formatEther(amountWei),
                minAmountOut: '0' // Will accept any amount for now
            });
            // Use the same fee tier for both directions (pools have fixed fee tiers)
            const feeTier = 500; // 0.05% fee tier
            
            for await (const st of this.dataLayer.execute('uniswap.universal.swapV3', {
                tokenIn: tokenInWrapped,
                tokenOut: tokenOutWrapped,
                amountIn: formatEther(amountWei),
                minAmountOut: '0', // TODO: Calculate based on slippage
                fee: feeTier
            })) {
                console.log('[DEBUG][Universal Router] status:', st);
                if (st.status === 'pending') { swapSpinner.text = st.message || swapSpinner.text; continue; }
                if (st.status === 'success') { hash = st.data?.transactionHash || st.data?.hash; break; }
                if (st.status === 'error') throw new Error(st.message || 'Universal Router swap failed');
            }
                } else {
                    // Algebra path (Gnosis)
                    swapSpinner.text = 'Executing swap on Algebra...';
                    try { const cid = await this.publicClient.getChainId(); console.log('[DEBUG][Algebra Fallback] chainId:', cid); } catch {}
                    console.log('[DEBUG][Algebra Fallback] router:', '0xffb643e73f280b97809a8b41f7232ab401a04ee1');
                    console.log('[DEBUG][Algebra Fallback] tokenIn:', tokenInWrapped, 'tokenOut:', tokenOutWrapped, 'amountIn:', formatEther(amountWei));
                    hash = await this.walletClient.writeContract({
                        address: '0xffb643e73f280b97809a8b41f7232ab401a04ee1',
                        abi: [{
                            "name": "exactInputSingle",
                            "type": "function",
                            "stateMutability": "payable",
                            "inputs": [
                                {
                                    "name": "params",
                                    "type": "tuple",
                                    "components": [
                                        {"name": "tokenIn", "type": "address"},
                                        {"name": "tokenOut", "type": "address"},
                                        {"name": "recipient", "type": "address"},
                                        {"name": "deadline", "type": "uint256"},
                                        {"name": "amountIn", "type": "uint256"},
                                        {"name": "amountOutMinimum", "type": "uint256"},
                                        {"name": "limitSqrtPrice", "type": "uint160"}
                                    ]
                                }
                            ],
                            "outputs": [{"name": "amountOut", "type": "uint256"}]
                        }],
                        functionName: 'exactInputSingle',
                        args: [{
                            tokenIn: tokenInWrapped,
                            tokenOut: tokenOutWrapped,
                            recipient: this.account.address,
                            deadline: BigInt(deadline),
                            amountIn: amountWei,
                            amountOutMinimum: minAmountOutWei,
                            limitSqrtPrice: 0n
                        }],
                        account: this.account
                    });
                }
                
                swapSpinner.text = 'Waiting for transaction confirmation...';
                const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
                
                swapSpinner.succeed(`Swap executed successfully!`);
                console.log(chalk.green('✅ Transaction Hash:'), hash);
                console.log(chalk.gray('View on Gnosisscan:'), `https://gnosisscan.io/tx/${hash}`);
                console.log(chalk.gray(`  Gas used: ${receipt.gasUsed.toString()}`));
                
                // Refresh balances
                await this.fetchBalances();
                
            } catch (error) {
                swapSpinner.fail('Swap failed');
                console.log(chalk.yellow('\n⚠️  This might be due to:'));
                console.log(chalk.gray('  - Insufficient liquidity in the pool'));
                console.log(chalk.gray('  - Price moved beyond slippage tolerance'));
                console.log(chalk.gray('  - Pool may need initialization'));
                console.log(chalk.gray('  - Approval issues (check transaction logs)'));
                console.error(chalk.red('\nDetailed error:'), error.message);
                throw error;
            }

        } catch (error) {
            spinner.fail(`Failed to swap: ${error.message}`);

            // More helpful error messages based on the error type
            if (error.message.includes('could not be found')) {
                console.log(chalk.yellow('\n⚠️  Approval might have succeeded, but swap execution failed.'));
                console.log(chalk.gray('  Check the transaction on Etherscan to verify approval status.'));
            }
        }
    }
    
    async executeRouterSwap(tokenIn, tokenOut, amountIn, minAmountOut, poolAddress) {
        // Try using a Uniswap V2 style router
        const routerAddress = ROUTER_ADDRESS; // Use futarchy router
        
        const routerAbi = [{
            name: 'swapExactTokensForTokens',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
                { name: 'amountIn', type: 'uint256' },
                { name: 'amountOutMin', type: 'uint256' },
                { name: 'path', type: 'address[]' },
                { name: 'to', type: 'address' },
                { name: 'deadline', type: 'uint256' }
            ],
            outputs: [{ name: 'amounts', type: 'uint256[]' }]
        }];
        
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
        const path = [tokenIn, tokenOut];
        
        const hash = await this.walletClient.writeContract({
            address: routerAddress,
            abi: routerAbi,
            functionName: 'swapExactTokensForTokens',
            args: [amountIn, minAmountOut, path, this.account.address, deadline],
            account: this.account
        });
        
        console.log(chalk.gray(`Router transaction: ${hash.slice(0, 10)}...`));
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
            console.log(chalk.green('✅ Router swap successful!'));
        }
        
        return receipt;
    }
    
    async ensureApproval(tokenAddress, spenderAddress, amount) {
        // Check current allowance
        const allowance = await this.publicClient.readContract({
            address: tokenAddress,
            abi: [{
                name: 'allowance',
                type: 'function',
                stateMutability: 'view',
                inputs: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' }
                ],
                outputs: [{ name: '', type: 'uint256' }]
            }],
            functionName: 'allowance',
            args: [this.account.address, spenderAddress]
        });
        
        if (allowance < amount) {
            const spinner = ora('Approving tokens...').start();
            
            try {
                const hash = await this.walletClient.writeContract({
                    address: tokenAddress,
                    abi: [{
                        name: 'approve',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [
                            { name: 'spender', type: 'address' },
                            { name: 'amount', type: 'uint256' }
                        ],
                        outputs: [{ name: '', type: 'bool' }]
                    }],
                    functionName: 'approve',
                    args: [spenderAddress, amount],
                    account: this.account
                });
                
                await this.publicClient.waitForTransactionReceipt({ hash });
                spinner.succeed('Approval granted');
            } catch (error) {
                spinner.fail('Approval failed');
                throw error;
            }
        } else {
            console.log(chalk.gray('✓ Token already approved'));
        }
    }
    
    async ensureApprovalWithStatus(tokenAddress, spenderAddress, amount, tokenName) {
        // Check current allowance
        const allowance = await this.publicClient.readContract({
            address: tokenAddress,
            abi: [{
                name: 'allowance',
                type: 'function',
                stateMutability: 'view',
                inputs: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' }
                ],
                outputs: [{ name: '', type: 'uint256' }]
            }],
            functionName: 'allowance',
            args: [this.account.address, spenderAddress]
        });
        
        if (allowance >= amount) {
            console.log(chalk.green(`  ✅ ${tokenName} already approved (${formatEther(allowance)} approved)`));
            return;
        }
        
        const spinner = ora(`Approving ${tokenName} (need ${formatEther(amount)})...`).start();
        
        try {
            spinner.text = `Submitting approval transaction for ${tokenName}...`;
            
            // Estimate gas first
            const gasEstimate = await this.publicClient.estimateContractGas({
                address: tokenAddress,
                abi: [{
                    name: 'approve',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'spender', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'approve',
                args: [spenderAddress, amount],
                account: this.account.address
            });
            
            const hash = await this.walletClient.writeContract({
                address: tokenAddress,
                abi: [{
                    name: 'approve',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'spender', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'approve',
                args: [spenderAddress, amount],
                gas: gasEstimate * 120n / 100n, // Add 20% buffer
                account: this.account
            });
            
            spinner.text = `Approval transaction submitted: ${hash.slice(0, 10)}...`;
            console.log(chalk.gray(`\n  Transaction: ${txLink(hash)}`));
            
            spinner.text = `Waiting for confirmation...`;
            await this.publicClient.waitForTransactionReceipt({ hash });
            
            spinner.succeed(`${tokenName} approved for ${formatEther(amount)}`);
            console.log(chalk.green(`  ✅ Approval transaction confirmed: ${hash.slice(0, 10)}...`));
        } catch (error) {
            spinner.fail(`Failed to approve ${tokenName}`);
            throw error;
        }
    }
    
    async mainMenu() {
        const choices = [
            '📊 View Prices & Probabilities',
            '💰 View Balances',
            '💧 View Liquidity & Volume',
            '📈 View Positions (Paired/Unpaired)',
            '🔄 Split Position',
            '🔀 Merge Position',
            '🚪 Close Position',
            '💱 Swap Tokens',
            '💸 Redeem Position',
            '🔄 Change Proposal',
            '❌ Exit'
        ];
        
        if (!this.isConnected) {
            // Remove write operations in read-only mode (keep View options since they're read-only)
            choices.splice(4, 5);
        }
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices
            }
        ]);
        
        switch (action) {
            case '📊 View Prices & Probabilities':
                await this.discoverPools();
                break;
            case '💰 View Balances':
                await this.fetchBalances();
                break;
            case '💧 View Liquidity & Volume':
                await this.viewLiquidityAndVolume();
                break;
            case '📈 View Positions (Paired/Unpaired)':
                await this.viewPositions();
                break;
            case '🔄 Split Position':
                await this.splitPosition();
                break;
            case '🔀 Merge Position':
                await this.mergePosition();
                break;
            case '🚪 Close Position':
                await this.closePosition();
                break;
            case '💱 Swap Tokens':
                await this.swapTokens();
                break;
            case '💸 Redeem Position':
                await this.redeemPosition();
                break;
            case '🔄 Change Proposal':
                await this.selectProposal();
                await this.discoverPools();
                if (this.isConnected) await this.fetchBalances();
                break;
            case '❌ Exit':
                return false;
        }
        
        return true;
    }
    
    getStatusColor(status) {
        const colors = {
            'FINALIZED': chalk.green(status),
            'OPEN_FOR_ANSWERS': chalk.yellow(status),
            'PENDING_ARBITRATION': chalk.red(status),
            'NOT_OPENED': chalk.gray(status)
        };
        return colors[status] || chalk.white(status);
    }
    
    async run() {
        await this.initialize();
        await this.selectProposal();
        await this.discoverPools();
        
        if (this.isConnected) {
            await this.fetchBalances();
        }
        
        // Main loop
        let running = true;
        while (running) {
            console.log('\n' + chalk.gray('─'.repeat(50)) + '\n');
            running = await this.mainMenu();
        }
        
        console.log('\n' + chalk.cyan.bold('👋 Thanks for using Futarchy Manager!'));
        process.exit(0);
    }
}

// Run the manager
const manager = new FutarchyManager();
manager.run().catch(console.error);
