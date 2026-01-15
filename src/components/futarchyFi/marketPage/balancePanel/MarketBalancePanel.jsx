import React, { useState, useMemo } from 'react';
import { formatBalance } from '../../../../utils/formatters';
import TransactionModal from '../../../modals/transactionModal/TransactionModal';
import { CollateralConfig } from '../../../modals/transactionModal/configs/CollateralConfig';
import { ethers } from 'ethers';

const LoadingSpinner = ({ className = "h-4 w-4" }) => (
  <div className="flex items-center justify-center">
    <div className={`animate-spin rounded-full border-b-2 border-futarchyGray12 dark:border-white ${className}`}></div>
  </div>
);

const PlusIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.5 2a.5.5 0 0 0-1 0v5.5H.5a.5.5 0 0 0 0 1H6.5v5.5a.5.5 0 0 0 1 0V8.5h5.5a.5.5 0 0 0 0-1H7.5V2Z" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);

const MinusIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 7.5a.5.5 0 0 0 0 1h12a.5.5 0 0 0 0-1H2Z" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);

const WalletBalanceItem = ({ tokenName, walletBalance, isLoading, showBorder = false }) => (
  <div className={`flex-1 flex flex-col items-center justify-center p-3 ${showBorder ? 'border-r-2 border-futarchyGray62 dark:border-futarchyGray112/40' : ''}`}>
    <span className="text-sm text-futarchyGray11 dark:text-white/70 font-medium">{tokenName}</span>
    <span className="text-sm font-semibold text-futarchyGray12 dark:text-white h-6 flex items-center">
      {isLoading ? <LoadingSpinner /> : formatBalance(parseFloat(walletBalance || '0').toFixed(6), tokenName, 4)}
    </span>
  </div>
);

const BalanceItem = ({ tokenName, positionBalance, walletBalance, isLoading, showBorder = false }) => {
  const hasMergeableBalance = parseFloat(positionBalance || '0') > 0;

  return (
    <div className={`flex-1 flex flex-col items-center justify-center p-3 ${showBorder ? 'border-r-2 border-futarchyGray62 dark:border-futarchyGray112/40' : ''}`}>
      <span className="text-sm text-futarchyGray11 dark:text-white/70 font-medium">{tokenName}</span>

      {/* Main Mergeable Balance */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-bold text-futarchyGray12 dark:text-white flex items-center">
          {isLoading ? <LoadingSpinner /> : formatBalance(positionBalance, tokenName, 4)}
        </span>
        <span className="text-[10px] text-futarchyGray11 dark:text-futarchyGray112 font-medium uppercase tracking-wide">
          Mergeable
        </span>
      </div>

      {/* Secondary Wallet Balance */}
      <div className="text-xs text-futarchyGray11 dark:text-futarchyGray112 mt-1">
        <span className="font-normal">Wallet: </span>
        <span className="font-semibold">
          {isLoading ? '...' : formatBalance(parseFloat(walletBalance || '0').toFixed(6), tokenName, 4)}
        </span>
      </div>
    </div>
  );
};

const ActionButton = ({ onClick, icon, text }) => (
  <button
    onClick={onClick}
    className="group relative overflow-hidden w-full py-3 px-4 rounded-xl font-semibold transition-colors cursor-pointer xl:text-sm text-xs bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-2 border-futarchyGray62 dark:border-futarchyGray112/40 text-black dark:text-white flex items-center justify-center gap-2"
  >
    {icon}
    <span className="relative z-10">{text}</span>
    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-black/10 dark:via-white/20 to-transparent transform -translate-x-full -skew-x-12 group-hover:translate-x-full transition-transform duration-500 ease-in-out pointer-events-none"></div>
  </button>
);

const LinkButton = ({ href, text }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative overflow-hidden w-full py-3 px-4 rounded-xl font-semibold transition-colors cursor-pointer xl:text-sm text-xs bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-2 border-futarchyGray62 dark:border-futarchyGray112/40 text-black dark:text-white flex items-center justify-center gap-2 text-center"
  >
    <span className="relative z-10">{text}</span>
    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-black/10 dark:via-white/20 to-transparent transform -translate-x-full -skew-x-12 group-hover:translate-x-full transition-transform duration-500 ease-in-out pointer-events-none"></div>
  </a>
);

// Mock data that would normally come from props or a high-level context
const MOCK_TOKEN_CONFIG = {
  baseToken: { symbol: 'SDAI', address: '0xBaseTokenAddressSDAI', decimals: 18 },
  gnoToken: { symbol: 'GNO', address: '0xGnoTokenAddress', decimals: 18 },
};

const MOCK_GET_MORE_TOKENS_CONFIG = {
      token1: { text: 'BUY SDAI', link: 'https://swap.cow.fi/#/100/swap/_/sdai' },
    token2: { text: 'BUY GNO', link: 'https://swap.cow.fi/#/100/swap/_/gno' },
};

const MarketBalancePanel = ({
  positions,
  address,
  isLoadingPositions = false,
  devMode = false,
  getMoreTokensConfig,
}) => {
  const [moreDetailsToggle, setMoreDetailsToggle] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'add' or 'remove'
  
  const [collateralAmount, setCollateralAmount] = useState('');

  const handleOpenCollateralModal = (action) => {
    setModalAction(action);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCollateralAmount('');
    // A brief delay to allow the modal to animate out before resetting the action
    setTimeout(() => setModalAction(null), 300);
  };

  const handleAmountChange = (e) => {
    const newAmount = e.target.value;
    if (/^\d*\.?\d*$/.test(newAmount)) {
        setCollateralAmount(newAmount);
    }
  };

  const isAmountValid = useMemo(() => {
    if (!collateralAmount) return false;
    const amountBn = ethers.utils.parseUnits(collateralAmount || '0', 18);
    return amountBn.gt(0);
  }, [collateralAmount]);

  const modalBalances = useMemo(() => ({
    baseTokenBalance: positions?.wxdai,
  }), [positions]);

  const sdiPositionBalance = Math.min(
    parseFloat(positions?.currencyYes?.total || 0),
    parseFloat(positions?.currencyNo?.total || 0)
  ).toString();

  const gnoPositionBalance = Math.min(
    parseFloat(positions?.companyYes?.total || 0),
    parseFloat(positions?.companyNo?.total || 0)
  ).toString();

  return (
    <>
      <div className="flex flex-col bg-futarchyGray3 dark:bg-futarchyDarkGray3 rounded-3xl border-2 border-futarchyGray62 dark:border-futarchyGray11/70 overflow-hidden">
        {/* Balance Header */}
        <div className="flex h-16 py-3 px-4 bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-b-2 border-futarchyGray62 dark:border-futarchyGray11/70 items-center">
          <h3 className="text-futarchyGray12 dark:text-white text-sm font-semibold">Balance</h3>
        </div>
        {/* Balance Content */}
        <div className="flex flex-col justify-between p-4 h-[190px]">
          {devMode ? (
            <>
              {/* Unified Balance Card for devMode=true */}
              <div className="flex rounded-2xl h-[90px] border-2 border-futarchyGray62 dark:border-futarchyGray112/40 bg-futarchyGray2 dark:bg-futarchyDarkGray2 overflow-hidden">
                <BalanceItem
                  tokenName="SDAI"
                  positionBalance={sdiPositionBalance}
                  walletBalance={positions?.wxdai}
                  isLoading={isLoadingPositions}
                  showBorder
                />
                <BalanceItem
                  tokenName="GNO"
                  positionBalance={gnoPositionBalance}
                  walletBalance={positions?.faot}
                  isLoading={isLoadingPositions}
                />
              </div>

              <div className="hidden">
                {/* More Details Toggle */}
                <button
                  onClick={() => setMoreDetailsToggle(!moreDetailsToggle)}
                  className="w-full mt-4 text-xs text-futarchyGray11 hover:text-futarchyGray12 transition-colors"
                >
                  {moreDetailsToggle ? '▼ Less Details' : '▶ More Details'}
                </button>

                {/* Balance Log */}
                {moreDetailsToggle && (
                  <div className="p-3 bg-futarchyGray3 rounded-lg text-xs text-futarchyGray11">
                    {(() => {
                      console.log('Raw Position Values:', {
                        currencyYes: positions?.currencyYes?.total,
                        currencyNo: positions?.currencyNo?.total,
                        companyYes: positions?.companyYes?.total,
                        companyNo: positions?.companyNo?.total,
                        rawBalances: positions,
                      });
                      return (
                        <>
                          <div className="mb-1">
                            SDAI: {positions?.currencyYes?.total} Yes + {positions?.currencyNo?.total} No = min({positions?.currencyYes?.total}, {positions?.currencyNo?.total}) available
                          </div>
                          <div>
                            GNO: {positions?.companyYes?.total} Yes + {positions?.companyNo?.total} No = min({positions?.companyYes?.total}, {positions?.companyNo?.total}) available
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Action Buttons for devMode=true */}
              <div className="flex flex-row gap-3 mt-4 h-[50px]">
                <ActionButton
                  onClick={() => handleOpenCollateralModal('add')}
                  icon={<PlusIcon className="w-4 h-4 animate-pulse-strong" />}
                  text="Add Collateral"
                />
                <ActionButton
                  onClick={() => handleOpenCollateralModal('remove')}
                  icon={<MinusIcon className="w-4 h-4 animate-pulse-strong" />}
                  text="Merge Collateral"
                />
              </div>
            </>
          ) : (
            <>
              {/* Simplified Balance Card for devMode=false */}
              <div className="flex rounded-2xl h-[90px] border-2 border-futarchyGray62 dark:border-futarchyGray112/40 bg-futarchyGray2 dark:bg-futarchyDarkGray2 overflow-hidden">
                <WalletBalanceItem
                  tokenName="SDAI"
                  walletBalance={positions?.wxdai}
                  isLoading={isLoadingPositions}
                  showBorder
                />
                <WalletBalanceItem
                  tokenName="GNO"
                  walletBalance={positions?.faot}
                  isLoading={isLoadingPositions}
                />
              </div>

              {/* "BUY" Action Buttons for devMode=false */}
              <div className="flex flex-row gap-3 mt-4 h-[50px]">
                {(getMoreTokensConfig || MOCK_GET_MORE_TOKENS_CONFIG)?.token1 && (
                  <LinkButton
                    href={(getMoreTokensConfig || MOCK_GET_MORE_TOKENS_CONFIG).token1.link}
                    text={(getMoreTokensConfig || MOCK_GET_MORE_TOKENS_CONFIG).token1.text}
                  />
                )}
                {(getMoreTokensConfig || MOCK_GET_MORE_TOKENS_CONFIG)?.token2 && (
                  <LinkButton
                    href={(getMoreTokensConfig || MOCK_GET_MORE_TOKENS_CONFIG).token2.link}
                    text={(getMoreTokensConfig || MOCK_GET_MORE_TOKENS_CONFIG).token2.text}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {devMode && isModalOpen && (
        <TransactionModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          config={CollateralConfig}
          transactionType={modalAction}
          tokenConfig={MOCK_TOKEN_CONFIG}
          balances={modalBalances}
          desiredOutputAmount={collateralAmount}
        >
          <div className="flex flex-col gap-4">
            <h3 className="text-futarchyGray12 dark:text-futarchyGray3 text-base font-semibold">
              Amount to {modalAction === 'add' ? 'Add' : 'Remove'}
            </h3>
            <div className="relative">
              <div className="flex items-center border border-futarchyGray62 dark:border-futarchyGray112/25 rounded-xl h-12">
                <input
                  type="text"
                  value={collateralAmount}
                  onChange={handleAmountChange}
                  className="flex-1 h-full px-4 bg-transparent dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-futarchyGray3 focus:outline-none rounded-xl"
                  placeholder="0.00"
                />
                <span className="absolute right-4 text-futarchyGray11 font-medium">
                  SDAI
                </span>
              </div>
            </div>
            <div className="text-xs text-futarchyGray11 mt-1">
              Available in Wallet: {formatBalance(positions?.wxdai || '0', 'SDAI')}
            </div>
          </div>
        </TransactionModal>
      )}
    </>
  );
};

export default MarketBalancePanel;