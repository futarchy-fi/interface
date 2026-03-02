// Test to verify contracts have same ABIs across chains
// Uses block explorer APIs to fetch and compare contract ABIs

import { createPublicClient, http } from 'viem';
import { mainnet, polygon } from 'viem/chains';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

// Contract addresses to verify
const CONTRACTS_TO_CHECK = {
  'Futarchy Adapter': {
    ethereum: '0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc',
    polygon: '0x11a1EA07a47519d9900242e1b30a529ECD65588a'
  },
  'NFPM (Position Manager)': {
    ethereum: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    polygon: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
  },
  'Universal Router': {
    ethereum: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
    polygon: '0x1095692a6237d83c6a72f3f5efedb9a670c49223'
  },
  'Permit2': {
    ethereum: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    polygon: '0x000000000022D473030F116dDEE9F6B43aC78BA3'
  },
  'Uniswap V3 Factory': {
    ethereum: '0x1F98431c8aD98523631AE4a59F267346ea31F984',
    polygon: '0x1F98431c8aD98523631AE4a59F267346ea31F984'
  }
};

// Explorer API endpoints (you'll need API keys for these)
const ETHERSCAN_API = 'https://api.etherscan.io/api';
const POLYGONSCAN_API = 'https://api.polygonscan.com/api';

// Get your API keys from environment or set them here
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || 'YourEtherscanAPIKey';
const POLYGONSCAN_KEY = process.env.POLYGONSCAN_API_KEY || 'YourPolygonscanAPIKey';

async function fetchContractABI(address, chain) {
  const apiUrl = chain === 'ethereum' ? ETHERSCAN_API : POLYGONSCAN_API;
  const apiKey = chain === 'ethereum' ? ETHERSCAN_KEY : POLYGONSCAN_KEY;

  const url = `${apiUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && data.result) {
      return JSON.parse(data.result);
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching ABI for ${address} on ${chain}:`, error.message);
    return null;
  }
}

async function getContractBytecode(client, address) {
  try {
    const bytecode = await client.getBytecode({ address });
    return bytecode;
  } catch (error) {
    console.error(`Error fetching bytecode:`, error.message);
    return null;
  }
}

async function verifyContract(name, addresses) {
  console.log(`\n${chalk.cyan('━'.repeat(60))}`);
  console.log(chalk.bold.cyan(`Checking: ${name}`));
  console.log(chalk.gray(`Ethereum: ${addresses.ethereum}`));
  console.log(chalk.gray(`Polygon:  ${addresses.polygon}`));

  // Create viem clients
  const ethClient = createPublicClient({
    chain: mainnet,
    transport: http(process.env.ETH_RPC_URL || 'https://ethereum.publicnode.com')
  });

  const polyClient = createPublicClient({
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com')
  });

  // Check if contracts are deployed (have bytecode)
  const [ethBytecode, polyBytecode] = await Promise.all([
    getContractBytecode(ethClient, addresses.ethereum),
    getContractBytecode(polyClient, addresses.polygon)
  ]);

  if (!ethBytecode) {
    console.log(chalk.red(`  ❌ No contract deployed on Ethereum at ${addresses.ethereum}`));
    return false;
  }
  if (!polyBytecode) {
    console.log(chalk.red(`  ❌ No contract deployed on Polygon at ${addresses.polygon}`));
    return false;
  }

  console.log(chalk.green('  ✓ Both contracts deployed'));

  // Check bytecode length (rough indicator)
  console.log(chalk.gray(`  Ethereum bytecode: ${ethBytecode.length} bytes`));
  console.log(chalk.gray(`  Polygon bytecode:  ${polyBytecode.length} bytes`));

  // For exact same contracts (like Permit2, NFPM), bytecode might be identical
  if (addresses.ethereum === addresses.polygon) {
    if (ethBytecode === polyBytecode) {
      console.log(chalk.green('  ✓ Identical bytecode (same deployment)'));
    } else {
      console.log(chalk.yellow('  ⚠ Different bytecode despite same address'));
    }
  }

  // Fetch ABIs from explorers (requires API keys)
  if (ETHERSCAN_KEY !== 'YourEtherscanAPIKey') {
    console.log(chalk.cyan('\n  Fetching verified ABIs...'));

    const [ethABI, polyABI] = await Promise.all([
      fetchContractABI(addresses.ethereum, 'ethereum'),
      fetchContractABI(addresses.polygon, 'polygon')
    ]);

    if (!ethABI) {
      console.log(chalk.yellow('  ⚠ Contract not verified on Etherscan'));
    }
    if (!polyABI) {
      console.log(chalk.yellow('  ⚠ Contract not verified on Polygonscan'));
    }

    if (ethABI && polyABI) {
      // Compare function signatures
      const ethFunctions = ethABI.filter(item => item.type === 'function').map(f => f.name).sort();
      const polyFunctions = polyABI.filter(item => item.type === 'function').map(f => f.name).sort();

      console.log(chalk.gray(`  Ethereum functions: ${ethFunctions.length}`));
      console.log(chalk.gray(`  Polygon functions:  ${polyFunctions.length}`));

      // Check if same functions
      const sameFunctions = JSON.stringify(ethFunctions) === JSON.stringify(polyFunctions);
      if (sameFunctions) {
        console.log(chalk.green('  ✓ Same function signatures'));
      } else {
        console.log(chalk.yellow('  ⚠ Different function signatures'));

        // Show differences
        const ethOnly = ethFunctions.filter(f => !polyFunctions.includes(f));
        const polyOnly = polyFunctions.filter(f => !ethFunctions.includes(f));

        if (ethOnly.length > 0) {
          console.log(chalk.red(`    Ethereum only: ${ethOnly.join(', ')}`));
        }
        if (polyOnly.length > 0) {
          console.log(chalk.red(`    Polygon only: ${polyOnly.join(', ')}`));
        }
      }
    }
  } else {
    console.log(chalk.yellow('\n  ⚠ Set ETHERSCAN_API_KEY and POLYGONSCAN_API_KEY in .env to fetch ABIs'));
  }

  return true;
}

async function main() {
  console.log(chalk.bold.blue('\n🔍 Cross-Chain Contract Verification\n'));
  console.log(chalk.gray('Checking if contracts on Ethereum and Polygon are compatible...\n'));

  const results = [];

  for (const [name, addresses] of Object.entries(CONTRACTS_TO_CHECK)) {
    const result = await verifyContract(name, addresses);
    results.push({ name, success: result });

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n${chalk.cyan('━'.repeat(60))}`);
  console.log(chalk.bold.blue('\n📊 SUMMARY\n'));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    const color = r.success ? chalk.green : chalk.red;
    console.log(`${icon} ${color(r.name)}`);
  });

  console.log(chalk.gray(`\n${successful} deployed, ${failed} not found`));

  if (ETHERSCAN_KEY === 'YourEtherscanAPIKey') {
    console.log(chalk.yellow('\n💡 Tip: Add API keys to .env file:'));
    console.log(chalk.gray('ETHERSCAN_API_KEY=your_key_here'));
    console.log(chalk.gray('POLYGONSCAN_API_KEY=your_key_here'));
    console.log(chalk.gray('\nGet free API keys from:'));
    console.log(chalk.gray('- https://etherscan.io/apis'));
    console.log(chalk.gray('- https://polygonscan.com/apis'));
  }
}

main().catch(console.error);