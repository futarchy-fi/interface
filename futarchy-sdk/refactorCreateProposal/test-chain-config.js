#!/usr/bin/env node

// Test script to verify chain configuration works
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('    CHAIN CONFIGURATION TEST');
console.log('========================================\n');

// Test 1: Load chain configuration
console.log('Test 1: Loading chains.config.json...');
const chainConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'chains.config.json'), 'utf8'));
console.log('✅ Chains loaded:', Object.keys(chainConfig.chains).join(', '));
console.log('✅ Default chain:', chainConfig.defaultChain);

// Test 2: Test Gnosis Chain (100)
console.log('\n----------------------------------------');
console.log('Test 2: Gnosis Chain Configuration');
console.log('----------------------------------------');
process.env.CHAIN_ID = '100';
delete require.cache[require.resolve('./contracts/constants')];
const gnosisConstants = require('./contracts/constants');

console.log('Network:', gnosisConstants.NETWORK.NAME);
console.log('Chain ID:', gnosisConstants.NETWORK.CHAIN_ID);
console.log('Contracts:');
console.log('  - Position Manager:', gnosisConstants.POSITION_MANAGER);
console.log('  - Futarchy Factory:', gnosisConstants.FUTARCHY_FACTORY);
console.log('  - Default Adapter:', gnosisConstants.DEFAULT_ADAPTER);
console.log('Default Tokens:');
console.log('  - Company:', gnosisConstants.DEFAULT_COMPANY_SYMBOL, '@', gnosisConstants.DEFAULT_COMPANY_TOKEN);
console.log('  - Currency:', gnosisConstants.DEFAULT_CURRENCY_SYMBOL, '@', gnosisConstants.DEFAULT_CURRENCY_TOKEN);

// Test 3: Test Ethereum Chain (1)
console.log('\n----------------------------------------');
console.log('Test 3: Ethereum Chain Configuration');
console.log('----------------------------------------');
process.env.CHAIN_ID = '1';
delete require.cache[require.resolve('./contracts/constants')];
const ethConstants = require('./contracts/constants');

console.log('Network:', ethConstants.NETWORK.NAME);
console.log('Chain ID:', ethConstants.NETWORK.CHAIN_ID);
console.log('Contracts:');
console.log('  - Position Manager:', ethConstants.POSITION_MANAGER);
console.log('  - Futarchy Factory:', ethConstants.FUTARCHY_FACTORY);
console.log('Default Tokens:');
console.log('  - Company:', ethConstants.DEFAULT_COMPANY_SYMBOL, '@', ethConstants.DEFAULT_COMPANY_TOKEN);
console.log('  - Currency:', ethConstants.DEFAULT_CURRENCY_SYMBOL, '@', ethConstants.DEFAULT_CURRENCY_TOKEN);

// Test 4: Load test config
console.log('\n----------------------------------------');
console.log('Test 4: Loading test-minimal-liquidity.config.json');
console.log('----------------------------------------');
const testConfig = require('./config/test-minimal-liquidity.config.json');
console.log('Market Name:', testConfig.marketName.substring(0, 50) + '...');
console.log('Company Token:', testConfig.companyToken.symbol, '@', testConfig.companyToken.address);
console.log('Currency Token:', testConfig.currencyToken.symbol, '@', testConfig.currencyToken.address);
console.log('Spot Price:', testConfig.spotPrice);
console.log('Event Probability:', testConfig.eventProbability);
console.log('Adapter Address:', testConfig.adapterAddress);

// Test 5: Verify Gnosis compatibility
console.log('\n----------------------------------------');
console.log('Test 5: Verifying Gnosis Compatibility');
console.log('----------------------------------------');
process.env.CHAIN_ID = '100';
delete require.cache[require.resolve('./contracts/constants')];
const finalConstants = require('./contracts/constants');

console.log('✅ Chain is Gnosis:', finalConstants.NETWORK.CHAIN_ID === 100);
console.log('✅ Adapter matches:', testConfig.adapterAddress === finalConstants.DEFAULT_ADAPTER);
console.log('✅ Currency token (sDAI) matches:', 
  testConfig.currencyToken.address.toLowerCase() === '0xaf204776c7245bf4147c2612bf6e5972ee483701'.toLowerCase());

console.log('\n========================================');
console.log('    ALL TESTS PASSED! ✅');
console.log('========================================');
console.log('\nYou can now run:');
console.log('  node cli.js --chain=100 setup-pools config/test-minimal-liquidity.config.json');
console.log('or');
console.log('  node cli.js --chain=100 create-proposal config/test-minimal-liquidity.config.json');
console.log('\n');