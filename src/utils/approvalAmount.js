import { ethers } from 'ethers';

/**
 * Amount to pass to ERC20 approve() for a pending operation.
 *
 * @param {ethers.BigNumber|bigint|string} requiredAmount - exact amount the
 *   operation needs, in wei / raw token units. Must be an integer quantity —
 *   decimal strings (e.g. "1.5") are a caller bug and throw here.
 * @param {boolean} useUnlimited - user's explicit unlimited-approval opt-in.
 * @returns {ethers.BigNumber}
 */
export const approvalAmountFor = (
  requiredAmount,
  useUnlimited = false,
  unlimitedAmount = ethers.constants.MaxUint256
) => {
  if (useUnlimited) return ethers.BigNumber.from(unlimitedAmount);
  if (requiredAmount === null || requiredAmount === undefined) {
    throw new Error('approvalAmountFor: requiredAmount is required when not using unlimited approval');
  }
  return ethers.BigNumber.from(requiredAmount);
};
