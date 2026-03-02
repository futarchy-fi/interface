import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../../../../../../../hooks/useMetaMask';
import { ethers } from 'ethers';

// Constants from algebra-cli.js
const DEFAULT_FACTORY_ADDRESS = '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345';
const futarchyFactoryAbi = [
  'function createProposal((string,address,address,string,string,uint256,uint32)) returns (address)',
  'function proposals(uint256) view returns (address)',
  'function marketsCount() view returns (uint256)'
];
const DEFAULT_COMPANY_TOKEN = '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb'; // GNO
const DEFAULT_CURRENCY_TOKEN = '0xaf204776c7245bF4147c2612BF6e5972Ee483701'; // SDAI
const DEFAULT_MIN_BOND = '1000000000000000000'; // 1 GNO/ETH in wei
const DEFAULT_CATEGORY = 'crypto';
const DEFAULT_LANGUAGE = 'en';
const calculateDefaultOpeningTime = () => Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 3 months from now

const ProposalCreator = ({ onCompletionChange, initialData, stepId }) => {
    const { account, connect: connectWallet, signer, ethersProvider } = useMetaMask();
    const [localError, setLocalError] = useState(null);

    // Form state
    const [marketName, setMarketName] = useState('');
    const [companyToken, setCompanyToken] = useState(DEFAULT_COMPANY_TOKEN);
    const [currencyToken, setCurrencyToken] = useState(DEFAULT_CURRENCY_TOKEN);
    const [category, setCategory] = useState(DEFAULT_CATEGORY);
    const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
    const [minBond, setMinBond] = useState(DEFAULT_MIN_BOND);
    const [openingTime, setOpeningTime] = useState(calculateDefaultOpeningTime().toString());

    // Transaction state
    const [transactionHash, setTransactionHash] = useState(null);
    const [transactionStatus, setTransactionStatus] = useState('idle'); // idle, pending, success, error
    const [newProposalAddress, setNewProposalAddress] = useState(null);
    const [submissionError, setSubmissionError] = useState(null);


    useEffect(() => {
        console.log(`[${stepId}] useEffect for account changes triggered. Account:`, account);
        if (account) {
            console.log(`[${stepId}] Wallet connected in useEffect:`, account);
            if (onCompletionChange) {
                const callbackData = { account: account, connectedAt: new Date().toISOString(), stepStatus: 'walletConnected' };
                console.log(`[${stepId}] About to call onCompletionChange (walletConnected):`, callbackData);
                onCompletionChange(true, callbackData);
            }
            setLocalError(null);
        } else {
            console.log(`[${stepId}] Wallet disconnected or not yet connected in useEffect.`);
            if (onCompletionChange) {
                const callbackData = { stepStatus: 'walletDisconnected' };
                console.log(`[${stepId}] About to call onCompletionChange (walletDisconnected):`, callbackData);
                onCompletionChange(false, callbackData);
            }
        }
    }, [account, onCompletionChange, stepId]);

    const handleConnect = async () => {
        setLocalError(null);
        setSubmissionError(null);
        try {
            console.log(`[${stepId}] Attempting to connect wallet...`);
            await connectWallet();
        } catch (err) {
            console.error(`[${stepId}] Error connecting wallet:`, err);
            setLocalError(err);
            if (onCompletionChange) {
                const callbackData = { stepStatus: 'walletConnectionFailed', error: err.message };
                console.log(`[${stepId}] About to call onCompletionChange (walletConnectionFailed):`, callbackData);
                onCompletionChange(false, callbackData);
            }
        }
    };

    const handleCreateProposal = async () => {
        console.log(`[${stepId}] handleCreateProposal started.`);
        if (!account || !signer) {
            console.warn(`[${stepId}] Wallet not connected or signer not available for proposal creation.`);
            setSubmissionError('Wallet not connected or signer not available.');
            return;
        }
        if (transactionStatus === 'pending') {
            console.warn(`[${stepId}] A transaction is already pending. Proposal creation aborted.`);
            setSubmissionError('A transaction is already pending.');
            return;
        }

        setTransactionStatus('pending');
        setSubmissionError(null);
        setTransactionHash(null);
        setNewProposalAddress(null);
        
        const currentParams = { marketName, companyToken, currencyToken, category, language, minBond, openingTime };
        console.log(`[${stepId}] Attempting to create proposal with params:`, currentParams);
        
        if (onCompletionChange) {
            const callbackData = { account, stepStatus: 'submissionPending', params: currentParams };
            console.log(`[${stepId}] About to call onCompletionChange (submissionPending):`, callbackData);
            onCompletionChange(false, callbackData);
        }
        
        let tempTxHash = null;

        try {
            const factoryContract = new ethers.Contract(DEFAULT_FACTORY_ADDRESS, futarchyFactoryAbi, signer);
            
            const parsedOpeningTime = parseInt(openingTime, 10);
            if (isNaN(parsedOpeningTime)) {
                throw new Error("Invalid Opening Time. Must be a valid number (Unix timestamp).");
            }

            const paramsForContract = [
                marketName,
                companyToken,
                currencyToken,
                category,
                language,
                minBond, 
                parsedOpeningTime
            ];

            console.log(`[${stepId}] Sending transaction to contract with:`, paramsForContract);
            const tx = await factoryContract.createProposal(paramsForContract);
            tempTxHash = tx.hash;
            setTransactionHash(tx.hash);
            console.log(`[${stepId}] Transaction sent: ${tx.hash}`);
            if (onCompletionChange) {
                const callbackData = { account, stepStatus: 'submissionTxSent', transactionHash: tx.hash };
                console.log(`[${stepId}] About to call onCompletionChange (submissionTxSent):`, callbackData);
                onCompletionChange(false, callbackData);
            }

            console.log(`[${stepId}] Waiting for transaction confirmation...`);
            const receipt = await tx.wait();
            console.log(`[${stepId}] Transaction confirmed. Receipt:`, receipt);

            // Explicitly handle marketsCount as BigInt
            const rawMarketsCount = await factoryContract.marketsCount();
            console.log(`[${stepId}] Fetched rawMarketsCount:`, rawMarketsCount, `(raw type: ${typeof rawMarketsCount})`);

            // Ensure rawMarketsCount is converted to BigInt if it isn't already.
            // This handles cases where it might be a BigNumber object (ethers v5) or a number.
            let marketsCountAsBigInt;
            if (typeof rawMarketsCount === 'bigint') {
                marketsCountAsBigInt = rawMarketsCount;
            } else if (rawMarketsCount && typeof rawMarketsCount.toBigInt === 'function') { // Ethers v5 BigNumber
                marketsCountAsBigInt = rawMarketsCount.toBigInt();
            } else if (typeof rawMarketsCount === 'number') {
                marketsCountAsBigInt = BigInt(rawMarketsCount);
            } else {
                // Attempt to convert from string if possible, or throw error
                try {
                    marketsCountAsBigInt = BigInt(rawMarketsCount.toString());
                } catch (e) {
                    console.error(`[${stepId}] Could not convert marketsCount to BigInt. Value:`, rawMarketsCount);
                    throw new Error('Could not convert marketsCount to a usable BigInt format.');
                }
            }
            console.log(`[${stepId}] marketsCountAsBigInt: ${marketsCountAsBigInt.toString()} (type: ${typeof marketsCountAsBigInt})`);

            if (marketsCountAsBigInt === 0n) {
                console.error(`[${stepId}] marketsCount is 0 after proposal creation.`);
                throw new Error('Proposal count is zero after creation. Cannot reliably determine new proposal address.');
            }

            const proposalIndex = marketsCountAsBigInt - BigInt(1);
            console.log(`[${stepId}] Calculated proposalIndex: ${proposalIndex.toString()}`);
            const proposalAddress = await factoryContract.proposals(proposalIndex); // proposalIndex must be BigInt or compatible
            console.log(`[${stepId}] Fetched proposalAddress: ${proposalAddress}`);
            
            if (!proposalAddress || proposalAddress === ethers.ZeroAddress) {
                console.error(`[${stepId}] Retrieved proposal address is invalid or zero: ${proposalAddress}`);
                throw new Error('Retrieved proposal address is invalid or the zero address.');
            }
            setNewProposalAddress(proposalAddress);
            
            setTransactionStatus('success');
            console.log(`[${stepId}] Proposal created successfully! Address: ${proposalAddress}`);
            if (onCompletionChange) {
                const callbackData = { 
                    account, 
                    stepStatus: 'submissionSuccess', 
                    transactionHash: receipt.transactionHash, 
                    proposalAddress: proposalAddress,
                };
                console.log(`[${stepId}] About to call onCompletionChange (submissionSuccess):`, callbackData);
                onCompletionChange(true, callbackData);
            }

        } catch (err) {
            console.error(`[${stepId}] Error during proposal creation process:`, err);
            let detailedErrorMessage = err.message || 'An unexpected error occurred.';
            if (err.data && err.data.message) { 
                detailedErrorMessage = err.data.message;
            } else if (err.reason) { 
                detailedErrorMessage = err.reason;
            }
            console.log(`[${stepId}] Parsed error message: ${detailedErrorMessage}`);

            setSubmissionError(detailedErrorMessage);
            setTransactionStatus('error');
            if (onCompletionChange) {
                const callbackData = { 
                    account, 
                    stepStatus: 'submissionFailed', 
                    error: detailedErrorMessage, 
                    transactionHash: tempTxHash 
                };
                console.log(`[${stepId}] About to call onCompletionChange (submissionFailed):`, callbackData);
                onCompletionChange(false, callbackData);
            }
        }
    };
    
    const inputStyle = "mt-1 block w-full px-3 py-2 bg-white dark:bg-futarchyGray2 border border-futarchyGray6 dark:border-futarchyGray5 rounded-md shadow-sm focus:outline-none focus:ring-futarchyViolet11 dark:focus:ring-futarchyViolet9 focus:border-futarchyViolet11 dark:focus:border-futarchyViolet9 sm:text-sm text-futarchyGray12 dark:text-futarchyGray12";
    const labelStyle = "block text-sm font-medium text-futarchyGray11 dark:text-futarchyGray11";

    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Step {stepId}: Create Futarchy Proposal</h2>
            
            {!account ? (
                <>
                    <p className="text-sm text-futarchyGray10 dark:text-futarchyGray112 mb-2">Connect your wallet to create a proposal.</p>
                    <button
                        onClick={handleConnect}
                        className="px-6 py-2 text-sm font-medium rounded-md text-white bg-futarchyViolet11 hover:bg-futarchyViolet11/80 dark:bg-futarchyViolet9 dark:hover:bg-futarchyViolet9/80 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Connect Wallet
                    </button>
                    {localError && <p className="text-futarchyCrimson9 dark:text-futarchyCrimson9 mt-2">Error: {localError.message || 'Failed to connect.'}</p>}
                </>
            ) : (
                <div>
                    <p className="text-futarchyGreen10 dark:text-futarchyGreen9">Connected Account: {`${account.substring(0, 6)}...${account.substring(account.length - 4)}`}</p>
                    <p className="text-sm text-futarchyGray10 dark:text-futarchyGray112 mt-1 mb-6">Wallet connected. You can now fill in the proposal details.</p>

                    <form onSubmit={(e) => { e.preventDefault(); handleCreateProposal(); }} className="space-y-4">
                        <div>
                            <label htmlFor="marketName" className={labelStyle}>Market Name (Question)</label>
                            <input type="text" name="marketName" id="marketName" value={marketName} onChange={(e) => setMarketName(e.target.value)} className={inputStyle} placeholder="e.g., Should we implement feature X?" required />
                        </div>
                        <div>
                            <label htmlFor="companyToken" className={labelStyle}>Company Token Address</label>
                            <input type="text" name="companyToken" id="companyToken" value={companyToken} onChange={(e) => setCompanyToken(e.target.value)} className={inputStyle} required />
                        </div>
                        <div>
                            <label htmlFor="currencyToken" className={labelStyle}>Currency Token Address</label>
                            <input type="text" name="currencyToken" id="currencyToken" value={currencyToken} onChange={(e) => setCurrencyToken(e.target.value)} className={inputStyle} required />
                        </div>
                        <div>
                            <label htmlFor="category" className={labelStyle}>Category</label>
                            <input type="text" name="category" id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputStyle} />
                        </div>
                        <div>
                            <label htmlFor="language" className={labelStyle}>Language</label>
                            <input type="text" name="language" id="language" value={language} onChange={(e) => setLanguage(e.target.value)} className={inputStyle} />
                        </div>
                        <div>
                            <label htmlFor="minBond" className={labelStyle}>Minimum Bond (in wei)</label>
                            <input type="text" name="minBond" id="minBond" value={minBond} onChange={(e) => setMinBond(e.target.value)} className={inputStyle} required />
                        </div>
                        <div>
                            <label htmlFor="openingTime" className={labelStyle}>Opening Time (Unix Timestamp)</label>
                            <input type="number" name="openingTime" id="openingTime" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} className={inputStyle} required />
                        </div>

                        <button
                            type="submit"
                            disabled={transactionStatus === 'pending' || !account}
                            className="w-full px-6 py-2.5 text-sm font-medium rounded-md text-white bg-futarchyViolet11 hover:bg-futarchyViolet11/80 dark:bg-futarchyViolet9 dark:hover:bg-futarchyViolet9/80 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {transactionStatus === 'pending' ? 'Creating Proposal...' : 'Create Proposal'}
                        </button>
                    </form>

                    {transactionStatus !== 'idle' && (
                        <div className="mt-6 p-3 border border-futarchyGray6 dark:border-futarchyGray5 rounded-md">
                            <h3 className="text-md font-semibold mb-2 text-futarchyGray12 dark:text-futarchyGray12">Transaction Status:</h3>
                            {transactionHash && <p className="text-sm text-futarchyGray11 dark:text-futarchyGray11">Hash: <a href={`https://gnosisscan.io/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer" className="text-futarchyViolet11 dark:text-futarchyViolet9 hover:underline">{transactionHash.substring(0,10)}...{transactionHash.substring(transactionHash.length - 8)}</a></p>}
                            
                            {transactionStatus === 'pending' && <p className="text-futarchyBlue10 dark:text-futarchyBlue9">Status: Pending confirmation...</p>}
                            {transactionStatus === 'success' && (
                                <>
                                    <p className="text-futarchyGreen10 dark:text-futarchyGreen9">Status: Success!</p>
                                    {newProposalAddress && <p className="text-sm text-futarchyGreen10 dark:text-futarchyGreen9">New Proposal Address: <a href={`https://gnosisscan.io/address/${newProposalAddress}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{newProposalAddress}</a></p>}
                                </>
                            )}
                            {transactionStatus === 'error' && <p className="text-futarchyCrimson9 dark:text-futarchyCrimson9">Status: Error</p>}
                            {submissionError && <p className="text-futarchyCrimson9 dark:text-futarchyCrimson9 mt-1">Details: {submissionError}</p>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProposalCreator;
