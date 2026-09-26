/**
 * Switch to the target wallet chain and verify the provider did switch before
 * a wallet-backed write. `readWalletChainId` is optional for connectors that
 * do not expose an injected provider; wagmi's current chain check remains the
 * first gate in that case.
 */
export async function ensureWalletChain({
  currentChainId,
  targetChainId,
  switchChainAsync,
  readWalletChainId,
}) {
  if (currentChainId !== targetChainId) {
    await switchChainAsync({ chainId: targetChainId });
  }

  if (readWalletChainId) {
    const actualChainId = await readWalletChainId();
    if (actualChainId != null && actualChainId !== targetChainId) {
      throw new Error(`Chain mismatch: expected ${targetChainId}, got ${actualChainId}`);
    }
  }
}

export async function readInjectedWalletChainId() {
  if (typeof window === 'undefined' || !window.ethereum?.request) return null;
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  return Number(chainId);
}
