import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3ConnectedOrInfura } from '../contexts/Web3Context';
import { approvalAmountFor } from '../utils/approvalAmount';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

export const useAllowance = (tokenAddress) => {
  const { address, provider } = useWeb3ConnectedOrInfura();
  const [isApproving, setIsApproving] = useState(false);

  const unlock = useCallback(async (requiredAmount, useUnlimitedApproval = false) => {
    if (!provider || !address || !tokenAddress) {
      throw new Error('Missing dependencies');
    }
    if (requiredAmount == null) throw new Error('Required approval amount is missing');

    try {
      setIsApproving(true);
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      const tx = await tokenContract.approve(
        address,
        approvalAmountFor(requiredAmount, useUnlimitedApproval)
      );
      
      // Wait for transaction confirmation
      await tx.wait();

      return tx;
    } catch (error) {
      console.error('Approval failed:', error);
      throw error;
    } finally {
      setIsApproving(false);
    }
  }, [provider, address, tokenAddress]);

  return {
    unlock,
    isApproving
  };
};
