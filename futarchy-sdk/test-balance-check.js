// Test balance checking functionality

import { createPublicClient, http, formatEther } from 'viem';
import { gnosis } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import chalk from 'chalk';
import boxen from 'boxen';
import dotenv from 'dotenv';

dotenv.config();

async function testBalanceCheck() {
    console.log(chalk.cyan.bold('\n💰 Testing Balance Check Functionality\n'));
    
    if (!process.env.PRIVATE_KEY) {
        console.log(chalk.yellow('⚠️  No private key found in .env'));
        return;
    }
    
    try {
        // Setup account
        const privateKey = process.env.PRIVATE_KEY.startsWith('0x') 
            ? process.env.PRIVATE_KEY 
            : `0x${process.env.PRIVATE_KEY}`;
        const account = privateKeyToAccount(privateKey);
        
        // Create public client
        const publicClient = createPublicClient({
            chain: gnosis,
            transport: http(process.env.RPC_URL || 'https://rpc.gnosischain.com')
        });
        
        console.log(chalk.yellow('Fetching balances...\n'));
        
        // Get xDAI balance
        const xdaiBalance = await publicClient.getBalance({
            address: account.address
        });
        
        // Get sDAI balance
        const SDAI = '0xaf204776c7245bF4147c2612BF6e5972Ee483701';
        const sdaiBalance = await publicClient.readContract({
            address: SDAI,
            abi: [{
                name: 'balanceOf',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }]
            }],
            functionName: 'balanceOf',
            args: [account.address]
        });
        
        // Display in a beautiful box
        const balanceBox = boxen(
            `${chalk.cyan('Account:')} ${chalk.white(account.address)}
${chalk.cyan('xDAI Balance:')} ${chalk.green.bold(formatEther(xdaiBalance))} xDAI
${chalk.cyan('sDAI Balance:')} ${chalk.green.bold(formatEther(sdaiBalance))} sDAI`,
            {
                padding: 1,
                margin: 1,
                borderStyle: 'double',
                borderColor: 'cyan',
                title: '💰 Account Balances',
                titleAlignment: 'center'
            }
        );
        
        console.log(balanceBox);
        
        // Check if user has enough for transactions
        const xdaiNum = parseFloat(formatEther(xdaiBalance));
        const sdaiNum = parseFloat(formatEther(sdaiBalance));
        
        if (xdaiNum < 0.01) {
            console.log(chalk.yellow('\n⚠️  Warning: Low xDAI balance. You may need more for gas fees.'));
        } else {
            console.log(chalk.green('\n✅ Sufficient xDAI for gas fees'));
        }
        
        if (sdaiNum > 0) {
            console.log(chalk.green(`✅ You have ${sdaiNum.toFixed(4)} sDAI available for splitting into YES/NO tokens`));
        } else {
            console.log(chalk.yellow('⚠️  No sDAI balance. You need sDAI to split positions.'));
        }
        
        console.log(chalk.dim('\n💡 The CLI can now:'));
        console.log(chalk.dim('   • Approve tokens for spending'));
        console.log(chalk.dim('   • Split sDAI into YES/NO tokens'));
        console.log(chalk.dim('   • Execute futarchy operations'));
        
    } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
    }
}

testBalanceCheck();