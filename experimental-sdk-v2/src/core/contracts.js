import { ethers } from 'ethers';
import { AGGREGATOR_ABI } from '../abis/aggregator.js';
import { ORGANIZATION_ABI } from '../abis/organization.js';

export class ContractService {
    constructor(blockchainService) {
        this.provider = blockchainService;
    }

    getAggregator(address) {
        return new ethers.Contract(address, AGGREGATOR_ABI, this.provider.getSigner());
    }

    getOrganization(address) {
        return new ethers.Contract(address, ORGANIZATION_ABI, this.provider.getSigner());
    }
}
