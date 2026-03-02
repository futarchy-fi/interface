import { ethers } from 'ethers';
import { ENV } from '../config/env.js';

export class BlockchainService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(ENV.RPC_URL);
        this.wallet = ENV.PRIVATE_KEY
            ? new ethers.Wallet(ENV.PRIVATE_KEY, this.provider)
            : null;
    }

    async getBlockNumber() {
        return this.provider.getBlockNumber();
    }

    getSigner() {
        if (!this.wallet) {
            throw new Error('Private key not found in .env. Read-only mode active.');
        }
        return this.wallet;
    }
}
