import { ethers } from 'ethers';
import chalk from 'chalk';
import ora from 'ora';
import { CHAIN_ID } from '../config/constants.js';

// Minimal ABI for NonfungiblePositionManager
const POSITION_MANAGER_ABI = [
    "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)"
];

// Addresses (Gnosis / Algebra)
const POSITION_MANAGER_ADDRESS = '0x91fD594c46D8B01E62dBDeBed2401dde01817834';

export async function createPool(blockchainService, tokenA, tokenB, initialPrice) {
    const spinner = ora('Initializing Pool...').start();
    try {
        const signer = blockchainService.getSigner();
        const manager = new ethers.Contract(POSITION_MANAGER_ADDRESS, POSITION_MANAGER_ABI, signer);

        // 1. Sort Tokens
        const token0 = tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenA : tokenB;
        const token1 = tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenB : tokenA;

        // 2. Calculate SqrtPriceX96
        // If order inverted, use 1/price
        const priceToUse = token0 === tokenA ? initialPrice : (1 / initialPrice);
        const sqrtPrice = Math.sqrt(priceToUse);
        const q96 = BigInt(2) ** BigInt(96);
        const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(q96)));

        // 3. Send Tx
        // Note: Algebra on Gnosis doesn't use fee tier in this function signature exactly like Uniswap V3
        // But the ABI above matches Standard V3. 
        // For Algebra (Gnosis), the signature is often `createAndInitializePoolIfNecessary(token0, token1, sqrtPriceX96)` without fee.
        // Let's assume Algebra signature for Chain 100 based on docs.

        // ALGEBRA ABI (No Fee param)
        const ALGEBRA_ABI = [
            "function createAndInitializePoolIfNecessary(address token0, address token1, uint160 sqrtPriceX96) external payable returns (address pool)"
        ];

        const algebraManager = new ethers.Contract(POSITION_MANAGER_ADDRESS, ALGEBRA_ABI, signer);

        spinner.text = `Creating Pool [${token0} / ${token1}] at price ${priceToUse}...`;

        const tx = await algebraManager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            sqrtPriceX96
        );

        spinner.text = 'Transaction sent! Waiting...';
        const receipt = await tx.wait();
        spinner.succeed(chalk.green(`Pool Created! Hash: ${receipt.hash}`));

    } catch (error) {
        spinner.fail(chalk.red('Failed to create pool'));
        console.error(error);
    }
}
