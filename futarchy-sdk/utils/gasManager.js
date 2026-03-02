// Gas Manager - Provides safe gas configuration for different chains
// Prevents excessive gas costs while ensuring transaction confirmation

import { parseUnits } from 'viem';

export class GasManager {
    constructor(chainConfig) {
        this.chainId = chainConfig.chainId;
        this.gasConfig = chainConfig.gasConfig || this.getDefaultGasConfig(chainConfig.chainId);
    }

    getDefaultGasConfig(chainId) {
        // Fallback gas configurations if not specified in runtime-chains.config.json
        const defaults = {
            1: { // Ethereum Mainnet
                minPriorityFeeGwei: '0.04',
                maxFeeGwei: '150',
                gasLimits: {
                    split: 1000000,
                    merge: 1500000,
                    swap: 350000,
                    approve: 100000
                }
            },
            137: { // Polygon
                minPriorityFeeGwei: '30',
                maxFeeGwei: '500',
                gasLimits: {
                    split: 1500000,
                    merge: 1500000,
                    swap: 500000,
                    approve: 100000
                }
            },
            100: { // Gnosis
                minPriorityFeeGwei: '1',
                maxFeeGwei: '50',
                gasLimits: {
                    split: 1500000,
                    merge: 1500000,
                    swap: 500000,
                    approve: 100000
                }
            }
        };

        return defaults[chainId] || defaults[100]; // Default to Gnosis settings
    }

    async getGasOptions(publicClient, operation = 'swap') {
        try {
            // Get current network fees
            const feeData = await publicClient.estimateFeePerGas();

            // Parse minimum and maximum values
            const minPriorityFee = parseUnits(this.gasConfig.minPriorityFeeGwei, 9);
            const maxFee = parseUnits(this.gasConfig.maxFeeGwei, 9);

            // Calculate safe priority fee (at least minimum)
            let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || minPriorityFee;
            if (maxPriorityFeePerGas < minPriorityFee) {
                maxPriorityFeePerGas = minPriorityFee;
            }

            // Calculate max fee (at least 2x priority fee, but capped)
            let maxFeePerGas = feeData.maxFeePerGas || (maxPriorityFeePerGas * 2n);
            if (maxFeePerGas < maxPriorityFeePerGas * 2n) {
                maxFeePerGas = maxPriorityFeePerGas * 2n;
            }
            if (maxFeePerGas > maxFee) {
                maxFeePerGas = maxFee;
                console.warn(`⚠️  Gas price capped at ${this.gasConfig.maxFeeGwei} gwei to prevent excessive costs`);
            }

            // Get gas limit for operation
            const gasLimit = this.gasConfig.gasLimits[operation] || 500000;

            return {
                maxFeePerGas,
                maxPriorityFeePerGas,
                gas: BigInt(gasLimit)
            };
        } catch (error) {
            console.warn('⚠️  Failed to estimate gas, using defaults:', error.message);

            // Fallback to safe defaults
            const minPriorityFee = parseUnits(this.gasConfig.minPriorityFeeGwei, 9);
            const gasLimit = this.gasConfig.gasLimits[operation] || 500000;

            return {
                maxFeePerGas: minPriorityFee * 2n,
                maxPriorityFeePerGas: minPriorityFee,
                gas: BigInt(gasLimit)
            };
        }
    }

    // Check if current gas price is within acceptable range
    async isGasPriceAcceptable(publicClient) {
        try {
            const feeData = await publicClient.estimateFeePerGas();
            const maxFee = parseUnits(this.gasConfig.maxFeeGwei, 9);

            if (feeData.maxFeePerGas && feeData.maxFeePerGas > maxFee) {
                const currentGwei = Number(feeData.maxFeePerGas) / 1e9;
                const maxGwei = Number(maxFee) / 1e9;
                console.warn(`⚠️  Current gas price (${currentGwei.toFixed(1)} gwei) exceeds maximum (${maxGwei} gwei)`);
                return false;
            }

            return true;
        } catch (error) {
            console.warn('⚠️  Could not check gas price:', error.message);
            return true; // Allow to proceed with caution
        }
    }

    // Get a warning message if gas is high
    getGasWarning(currentGwei) {
        const maxGwei = Number(this.gasConfig.maxFeeGwei);

        if (currentGwei > maxGwei * 0.8) {
            return `⚠️  High gas alert: ${currentGwei.toFixed(1)} gwei (max: ${maxGwei} gwei). Consider waiting for lower gas prices.`;
        }

        return null;
    }
}

// Export a factory function for easy initialization
export function createGasManager(chainConfig) {
    return new GasManager(chainConfig);
}