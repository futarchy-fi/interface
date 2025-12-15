import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractConfig } from '../../hooks/useContractConfig';
import { BASE_TOKENS_CONFIG, ERC20_ABI, FUTARCHY_ROUTER_ABI } from '../futarchyFi/marketPage/constants/contracts';
import { useBalanceManager } from '../../hooks/useBalanceManager';
import { ethers } from 'ethers';

// Helper to get ethers signer from wallet client
const getEthersSigner = (walletClient, publicClient) => {
    if (!walletClient) return null;
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    return signer;
};

export default function NewSwapInterface({ market }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [activeTab, setActiveTab] = useState('trade'); // trade, mint, merge, redeem
  const [amount, setAmount] = useState('');
  const [outcome, setOutcome] = useState('YES'); // YES, NO
  const [tradeType, setTradeType] = useState('buy'); // buy, sell

  // Get dynamic token config
  // Use proposal_id if available, otherwise fallback to id (for mock data)
  const proposalId = market?.proposal_id || market?.id;
  const { config } = useContractConfig(proposalId);
  const currencySymbol = config?.BASE_TOKENS_CONFIG?.currency?.symbol || BASE_TOKENS_CONFIG?.currency?.symbol || 'USDC';

  // Fetch balances
  const { balances } = useBalanceManager(config, address, isConnected);

  // Debug logging
  React.useEffect(() => {
    console.log('[NewSwapInterface] Debug:', {
      marketId: market?.id,
      proposalId,
      hasConfig: !!config,
      balancesLoaded: !!balances,
      wrappedYes: balances?.wrappedCurrencyYes,
      wrappedNo: balances?.wrappedCurrencyNo
    });
  }, [market, proposalId, config, balances]);

  const tabs = [
    { id: 'trade', label: 'Trade' },
    { id: 'mint', label: 'Mint (Split)' },
    { id: 'merge', label: 'Merge' },
    { id: 'redeem', label: 'Redeem' },
  ];

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-4 text-sm font-medium transition-colors relative ${
              activeTab === tab.id ? 'text-white' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_#45FFC5]"
              />
            )}
          </button>
        ))}
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'trade' && (
            <TradePanel 
              key="trade" 
              tradeType={tradeType} 
              setTradeType={setTradeType} 
              outcome={outcome} 
              setOutcome={setOutcome} 
              amount={amount} 
              setAmount={setAmount} 
              isConnected={isConnected}
              currencySymbol={currencySymbol}
              balances={balances}
            />
          )}
          {activeTab === 'mint' && (
            <MintPanel key="mint" amount={amount} setAmount={setAmount} isConnected={isConnected} currencySymbol={currencySymbol} balances={balances} />
          )}
          {activeTab === 'merge' && (
            <MergePanel 
                key="merge" 
                amount={amount} 
                setAmount={setAmount} 
                isConnected={isConnected} 
                currencySymbol={currencySymbol} 
                balances={balances}
                config={config}
                publicClient={publicClient}
                walletClient={walletClient}
                address={address}
                proposalId={proposalId}
            />
          )}
          {activeTab === 'redeem' && (
            <RedeemPanel key="redeem" isConnected={isConnected} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TradePanel({ tradeType, setTradeType, outcome, setOutcome, amount, setAmount, isConnected, currencySymbol, balances }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Buy/Sell Toggle */}
      <div className="flex bg-black/40 p-1 rounded-xl">
        <button
          onClick={() => setTradeType('buy')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
            tradeType === 'buy' ? 'bg-primary text-black shadow-lg' : 'text-white/40 hover:text-white'
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => setTradeType('sell')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
            tradeType === 'sell' ? 'bg-red-500 text-white shadow-lg' : 'text-white/40 hover:text-white'
          }`}
        >
          SELL
        </button>
      </div>

      {/* Outcome Selection */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setOutcome('YES')}
          className={`p-4 rounded-2xl border-2 transition-all ${
            outcome === 'YES' 
              ? 'border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(69,255,197,0.1)]' 
              : 'border-white/5 bg-white/5 text-white/40 hover:bg-white/10'
          }`}
        >
          <div className="text-xs font-medium mb-1 opacity-60">Outcome</div>
          <div className="text-2xl font-bold">YES</div>
        </button>
        <button
          onClick={() => setOutcome('NO')}
          className={`p-4 rounded-2xl border-2 transition-all ${
            outcome === 'NO' 
              ? 'border-red-500 bg-red-500/10 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
              : 'border-white/5 bg-white/5 text-white/40 hover:bg-white/10'
          }`}
        >
          <div className="text-xs font-medium mb-1 opacity-60">Outcome</div>
          <div className="text-2xl font-bold">NO</div>
        </button>
      </div>

      {/* Amount Input */}
      <div>
        <div className="flex justify-between text-xs text-white/40 mb-2">
          <span>Amount</span>
          <span>Balance: {balances?.currency || '0.00'}</span>
        </div>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-2xl font-mono focus:outline-none focus:border-primary/50 transition-colors"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button className="text-xs bg-white/10 px-2 py-1 rounded hover:bg-white/20 transition-colors">MAX</button>
            <span className="font-bold text-white/60">{currencySymbol}</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      {isConnected ? (
        <button className={`w-full py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
          tradeType === 'buy' 
            ? 'bg-primary text-black hover:bg-primary/90 shadow-[0_0_30px_rgba(69,255,197,0.3)]' 
            : 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
        }`}>
          {tradeType === 'buy' ? `Buy ${outcome}` : `Sell ${outcome}`}
        </button>
      ) : (
        <div className="w-full">
            <ConnectButton.Custom>
                {({ openConnectModal }) => (
                    <button onClick={openConnectModal} className="w-full py-4 rounded-2xl font-bold text-lg bg-white/10 text-white hover:bg-white/20 transition-all">
                        Connect Wallet
                    </button>
                )}
            </ConnectButton.Custom>
        </div>
      )}
    </motion.div>
  );
}

function MintPanel({ amount, setAmount, isConnected, currencySymbol, balances }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-sm text-blue-200">
                <p className="font-bold mb-1">Minting (Splitting)</p>
                <p className="opacity-80">Lock collateral to mint equal amounts of YES and NO tokens. You can use these tokens to provide liquidity or sell one side.</p>
            </div>

            <div>
                <div className="flex justify-between text-xs text-white/40 mb-2">
                <span>Collateral Amount</span>
                <span>Balance: {balances?.currency || '0.00'}</span>
                </div>
                <div className="relative">
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-2xl font-mono focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button 
                        onClick={() => setAmount(balances?.currency || '0')}
                        className="text-xs bg-white/10 px-2 py-1 rounded hover:bg-white/20 transition-colors"
                    >
                        MAX
                    </button>
                    <span className="font-bold text-white/60">{currencySymbol}</span>
                </div>
                </div>
            </div>

            {isConnected ? (
                <button className="w-full py-4 rounded-2xl font-bold text-lg bg-blue-500 text-white hover:bg-blue-600 shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                    Mint Tokens
                </button>
            ) : (
                <div className="w-full">
                    <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                            <button onClick={openConnectModal} className="w-full py-4 rounded-2xl font-bold text-lg bg-white/10 text-white hover:bg-white/20 transition-all">
                                Connect Wallet
                            </button>
                        )}
                    </ConnectButton.Custom>
                </div>
            )}
        </motion.div>
    );
}

function MergePanel({ amount, setAmount, isConnected, currencySymbol, balances, config, publicClient, walletClient, address, proposalId }) {
    const [processingStep, setProcessingStep] = useState('idle'); // idle, approving_yes, approving_no, merging, completed
    const [error, setError] = useState(null);

    // Calculate max mergeable amount
    const calculateMaxMergeable = () => {
        try {
            const yesBalance = balances?.wrappedCurrencyYes || '0';
            const noBalance = balances?.wrappedCurrencyNo || '0';
            
            const yesWei = ethers.utils.parseUnits(yesBalance.toString(), 18);
            const noWei = ethers.utils.parseUnits(noBalance.toString(), 18);
            
            const minWei = yesWei.lt(noWei) ? yesWei : noWei;
            return ethers.utils.formatUnits(minWei, 18);
        } catch (e) {
            console.error("Error calculating max mergeable:", e);
            return '0';
        }
    };

    const maxMergeable = calculateMaxMergeable();

    const handleMerge = async () => {
        if (!amount || parseFloat(amount) <= 0) return;
        if (!config || !walletClient || !publicClient) return;

        setError(null);
        setProcessingStep('approving_yes');

        // JSON ABI for publicClient (wagmi/viem)
        const ERC20_JSON_ABI = [
            {
                inputs: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" }
                ],
                name: "allowance",
                outputs: [{ name: "", type: "uint256" }],
                stateMutability: "view",
                type: "function"
            }
        ];

        try {
            const amountWei = ethers.utils.parseUnits(amount, 18);
            const routerAddress = config.FUTARCHY_ROUTER_ADDRESS;
            
            // 1. Approve YES Token
            const yesTokenAddress = config.MERGE_CONFIG.currencyPositions.yes.wrap.wrappedCollateralTokenAddress;
            const yesAllowance = await publicClient.readContract({
                address: yesTokenAddress,
                abi: ERC20_JSON_ABI,
                functionName: 'allowance',
                args: [address, routerAddress]
            });

            if (yesAllowance < amountWei) {
                const signer = getEthersSigner(walletClient, publicClient);
                const yesContract = new ethers.Contract(yesTokenAddress, ERC20_ABI, signer);
                const tx = await yesContract.approve(routerAddress, ethers.constants.MaxUint256);
                await tx.wait();
            }

            setProcessingStep('approving_no');

            // 2. Approve NO Token
            const noTokenAddress = config.MERGE_CONFIG.currencyPositions.no.wrap.wrappedCollateralTokenAddress;
            const noAllowance = await publicClient.readContract({
                address: noTokenAddress,
                abi: ERC20_JSON_ABI,
                functionName: 'allowance',
                args: [address, routerAddress]
            });

            if (noAllowance < amountWei) {
                const signer = getEthersSigner(walletClient, publicClient);
                const noContract = new ethers.Contract(noTokenAddress, ERC20_ABI, signer);
                const tx = await noContract.approve(routerAddress, ethers.constants.MaxUint256);
                await tx.wait();
            }

            setProcessingStep('merging');

            // 3. Merge Positions
            const signer = getEthersSigner(walletClient, publicClient);
            const routerContract = new ethers.Contract(routerAddress, FUTARCHY_ROUTER_ABI, signer);
            
            // mergePositions(address proposal, address collateralToken, uint256 amount)
            // We are merging the Currency (Base) token positions (e.g. sDAI)
            const collateralTokenAddress = config.BASE_TOKENS_CONFIG.currency.address;
            
            console.log('[NewSwapInterface] Merging:', {
                proposal: proposalId,
                collateralToken: collateralTokenAddress,
                amount: amountWei.toString()
            });

            const tx = await routerContract.mergePositions(proposalId, collateralTokenAddress, amountWei);
            await tx.wait();

            setProcessingStep('completed');
            setAmount('');
            
        } catch (e) {
            console.error("Merge failed:", e);
            setError(e.message || "Transaction failed");
            setProcessingStep('idle');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-sm text-purple-200">
                <p className="font-bold mb-1">Merging</p>
                <p className="opacity-80">Burn equal amounts of YES and NO tokens to unlock your original collateral.</p>
            </div>

            <div>
                <div className="flex justify-between text-xs text-white/40 mb-2">
                <span>Amount to Merge</span>
                <span>Max Mergeable: {maxMergeable}</span>
                </div>
                <div className="relative">
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-2xl font-mono focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button 
                        onClick={() => setAmount(maxMergeable)}
                        className="text-xs bg-white/10 px-2 py-1 rounded hover:bg-white/20 transition-colors"
                    >
                        MAX
                    </button>
                    <span className="font-bold text-white/60">SETS</span>
                </div>
                </div>
            </div>

            {/* Status Steps */}
            {processingStep !== 'idle' && (
                <div className="space-y-2">
                    <div className={`flex items-center gap-2 text-sm ${processingStep === 'approving_yes' ? 'text-yellow-400' : 'text-white/40'}`}>
                        <div className={`w-2 h-2 rounded-full ${processingStep === 'approving_yes' ? 'bg-yellow-400 animate-pulse' : 'bg-white/20'}`} />
                        Approving YES Token
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${processingStep === 'approving_no' ? 'text-yellow-400' : 'text-white/40'}`}>
                        <div className={`w-2 h-2 rounded-full ${processingStep === 'approving_no' ? 'bg-yellow-400 animate-pulse' : 'bg-white/20'}`} />
                        Approving NO Token
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${processingStep === 'merging' ? 'text-purple-400' : 'text-white/40'}`}>
                        <div className={`w-2 h-2 rounded-full ${processingStep === 'merging' ? 'bg-purple-400 animate-pulse' : 'bg-white/20'}`} />
                        Merging Positions
                    </div>
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-200">
                    {error}
                </div>
            )}

            {isConnected ? (
                <button 
                    onClick={handleMerge}
                    disabled={processingStep !== 'idle' || !amount || parseFloat(amount) <= 0}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                        processingStep === 'completed' 
                            ? 'bg-green-500 text-white shadow-[0_0_30px_rgba(34,197,94,0.3)]'
                            : 'bg-purple-500 text-white hover:bg-purple-600 shadow-[0_0_30px_rgba(168,85,247,0.3)]'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {processingStep === 'idle' ? 'Merge Tokens' : 
                     processingStep === 'completed' ? 'Merge Successful!' : 
                     'Processing...'}
                </button>
            ) : (
                <div className="w-full">
                    <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                            <button onClick={openConnectModal} className="w-full py-4 rounded-2xl font-bold text-lg bg-white/10 text-white hover:bg-white/20 transition-all">
                                Connect Wallet
                            </button>
                        )}
                    </ConnectButton.Custom>
                </div>
            )}
        </motion.div>
    );
}

function RedeemPanel({ isConnected }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-sm text-green-200">
                <p className="font-bold mb-1">Redemption</p>
                <p className="opacity-80">If the market has resolved, you can redeem your winning tokens for the collateral.</p>
            </div>

            <div className="p-6 bg-white/5 rounded-2xl text-center">
                <p className="text-white/40 mb-2">Market Status</p>
                <p className="text-xl font-bold text-white mb-4">OPEN</p>
                <p className="text-xs text-white/30">Redemption is only available after market resolution.</p>
            </div>

            {isConnected ? (
                <button disabled className="w-full py-4 rounded-2xl font-bold text-lg bg-white/5 text-white/20 cursor-not-allowed">
                    Nothing to Redeem
                </button>
            ) : (
                <div className="w-full">
                    <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                            <button onClick={openConnectModal} className="w-full py-4 rounded-2xl font-bold text-lg bg-white/10 text-white hover:bg-white/20 transition-all">
                                Connect Wallet
                            </button>
                        )}
                    </ConnectButton.Custom>
                </div>
            )}
        </motion.div>
    );
}
