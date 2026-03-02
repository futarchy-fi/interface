/**
 * CreateOrganizationModal
 * 
 * Debug mode modal for:
 * 1. Creating new Organizations with metadata
 * 2. Linking existing Organizations to an Aggregator
 */

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

// Contract addresses (Gnosis Chain)
const CONTRACTS = {
    ORGANIZATION_FACTORY: '0x2Fa9318E1e29d7435EE9d23B687b10a9CDDD0d9e',
};

// Default aggregator (FutarchyFi)
const DEFAULT_AGGREGATOR = '0x767868874be4b5434bd351410b0b9a6e7f4c3aaf';

// Subgraph endpoint
import { AGGREGATOR_SUBGRAPH_URL as SUBGRAPH_URL } from '../../config/subgraphEndpoints';

// ABIs (minimal)
const ORGANIZATION_FACTORY_ABI = [
    {
        inputs: [
            { name: 'companyName', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'metadata', type: 'string' },
            { name: 'metadataURI', type: 'string' }
        ],
        name: 'createOrganizationMetadata',
        outputs: [{ type: 'address' }],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

const AGGREGATOR_ABI = [
    {
        inputs: [{ name: '_organizationMetadata', type: 'address' }],
        name: 'addOrganization',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

const ORGANIZATION_ABI = [
    {
        inputs: [
            { name: '_metadata', type: 'string' },
            { name: '_metadataURI', type: 'string' }
        ],
        name: 'updateExtendedMetadata',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

// Steps
const STEP = {
    CHOOSE: 'choose',
    CREATE: 'create',
    LINK: 'link',
    EDIT: 'edit',    // New step for editing owned orgs
    SUCCESS: 'success'
};

export default function CreateOrganizationModal({ isOpen, onClose }) {
    const { address: connectedAddress, isConnected } = useAccount();

    // Modal state
    const [step, setStep] = useState(STEP.CHOOSE);
    const [mode, setMode] = useState(null); // 'create' or 'link'

    // Form state
    const [companyName, setCompanyName] = useState('');
    const [description, setDescription] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#6b21a8');
    const [linkAfterCreate, setLinkAfterCreate] = useState(true);

    // Link state
    const [aggregatorAddress, setAggregatorAddress] = useState(DEFAULT_AGGREGATOR);
    const [organizationAddress, setOrganizationAddress] = useState('');
    const [aggregatorOwner, setAggregatorOwner] = useState(null);
    const [aggregatorName, setAggregatorName] = useState('');
    const [createdOrgAddress, setCreatedOrgAddress] = useState(null);
    const [aggregatorsList, setAggregatorsList] = useState([]);

    // Organization validation state
    const [orgInfo, setOrgInfo] = useState(null); // { name, owner, exists }
    const [isCheckingOrg, setIsCheckingOrg] = useState(false);

    // Edit/My Orgs state
    const [myOrgs, setMyOrgs] = useState([]);
    const [isLoadingMyOrgs, setIsLoadingMyOrgs] = useState(false);
    const [selectedOrgToEdit, setSelectedOrgToEdit] = useState(null);
    const [editMetadata, setEditMetadata] = useState('');

    // Loading state
    const [isCheckingOwner, setIsCheckingOwner] = useState(false);
    const [isLoadingAggregators, setIsLoadingAggregators] = useState(false);
    const [error, setError] = useState(null);

    // Contract writes
    const { writeContract: createOrg, data: createHash, isPending: isCreating } = useWriteContract();
    const { writeContract: linkOrg, data: linkHash, isPending: isLinking } = useWriteContract();
    const { writeContract: updateMetadata, data: updateHash, isPending: isUpdating } = useWriteContract();

    // Transaction receipts
    const { isSuccess: createSuccess, data: createReceipt } = useWaitForTransactionReceipt({ hash: createHash });
    const { isSuccess: linkSuccess } = useWaitForTransactionReceipt({ hash: linkHash });
    const { isSuccess: updateSuccess } = useWaitForTransactionReceipt({ hash: updateHash });

    // Check aggregator owner via subgraph
    const checkAggregatorOwner = async (address) => {
        if (!address || address.length < 42) return;

        setIsCheckingOwner(true);
        setError(null);

        try {
            const query = `{
        aggregator(id: "${address.toLowerCase()}") {
          id
          name
          owner
        }
      }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            if (result.data?.aggregator) {
                setAggregatorOwner(result.data.aggregator.owner);
                setAggregatorName(result.data.aggregator.name);
            } else {
                setError('Aggregator not found');
                setAggregatorOwner(null);
                setAggregatorName('');
            }
        } catch (e) {
            setError('Failed to check aggregator');
            console.error(e);
        } finally {
            setIsCheckingOwner(false);
        }
    };

    // Fetch list of all aggregators from subgraph
    const fetchAggregatorsList = async () => {
        setIsLoadingAggregators(true);
        try {
            const query = `{
                aggregators(first: 20) {
                    id
                    name
                    owner
                }
            }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            if (result.data?.aggregators) {
                setAggregatorsList(result.data.aggregators);
            }
        } catch (e) {
            console.error('Failed to fetch aggregators:', e);
        } finally {
            setIsLoadingAggregators(false);
        }
    };

    // Load aggregators list and check default on mount
    useEffect(() => {
        if (isOpen) {
            fetchAggregatorsList();
            // Check default aggregator owner on open
            if (aggregatorAddress.length === 42) {
                checkAggregatorOwner(aggregatorAddress);
            }
            // Also fetch my orgs if connected
            if (connectedAddress) {
                fetchMyOrgs(connectedAddress);
            }
        }
    }, [isOpen, connectedAddress]);

    // Fetch organizations owned by the connected wallet
    const fetchMyOrgs = async (walletAddress) => {
        if (!walletAddress) return;

        setIsLoadingMyOrgs(true);
        try {
            const query = `{
                organizations(where: { owner: "${walletAddress.toLowerCase()}" }) {
                    id
                    name
                    description
                    metadata
                    metadataURI
                }
            }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            if (result.data?.organizations) {
                setMyOrgs(result.data.organizations);
                console.log(`[Modal] Found ${result.data.organizations.length} orgs owned by wallet`);
            }
        } catch (e) {
            console.error('Failed to fetch my orgs:', e);
        } finally {
            setIsLoadingMyOrgs(false);
        }
    };

    // Handle aggregator address change
    useEffect(() => {
        if (aggregatorAddress.length === 42) {
            checkAggregatorOwner(aggregatorAddress);
        }
    }, [aggregatorAddress]);

    // Check organization exists via subgraph
    const checkOrganization = async (address) => {
        if (!address || address.length < 42) {
            setOrgInfo(null);
            return;
        }

        setIsCheckingOrg(true);
        try {
            const query = `{
                organization(id: "${address.toLowerCase()}") {
                    id
                    name
                    owner
                }
            }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            if (result.data?.organization) {
                setOrgInfo({
                    exists: true,
                    name: result.data.organization.name,
                    owner: result.data.organization.owner
                });
            } else {
                setOrgInfo({ exists: false });
            }
        } catch (e) {
            console.error('Failed to check organization:', e);
            setOrgInfo(null);
        } finally {
            setIsCheckingOrg(false);
        }
    };

    // Handle organization address change
    useEffect(() => {
        if (organizationAddress.length === 42) {
            checkOrganization(organizationAddress);
        } else {
            setOrgInfo(null);
        }
    }, [organizationAddress]);

    // Handle create success - extract new org address from logs
    useEffect(() => {
        if (createSuccess && createReceipt) {
            // Find OrganizationMetadataCreated event
            const log = createReceipt.logs.find(l =>
                l.topics[0] === '0x' + 'OrganizationMetadataCreated'.split('').map(c => c.charCodeAt(0).toString(16)).join('')
            );

            if (createReceipt.logs[0]?.topics[1]) {
                const newOrgAddr = '0x' + createReceipt.logs[0].topics[1].slice(26);
                setCreatedOrgAddress(newOrgAddr);
                setOrganizationAddress(newOrgAddr);

                if (linkAfterCreate) {
                    setStep(STEP.LINK);
                } else {
                    setStep(STEP.SUCCESS);
                }
            }
        }
    }, [createSuccess, createReceipt, linkAfterCreate]);

    // Handle link success
    useEffect(() => {
        if (linkSuccess) {
            setStep(STEP.SUCCESS);
        }
    }, [linkSuccess]);

    // Reset on close
    const handleClose = () => {
        setStep(STEP.CHOOSE);
        setMode(null);
        setCompanyName('');
        setDescription('');
        setCoverImage('');
        setPrimaryColor('#6b21a8');
        setAggregatorAddress(DEFAULT_AGGREGATOR);
        setOrganizationAddress('');
        setCreatedOrgAddress(null);
        setError(null);
        onClose();
    };

    // Build metadata JSON
    const buildMetadata = () => {
        return JSON.stringify({
            coverImage: coverImage || null,
            colors: { primary: primaryColor },
            createdAt: new Date().toISOString()
        });
    };

    // Handle create
    const handleCreate = () => {
        setError(null);
        createOrg({
            address: CONTRACTS.ORGANIZATION_FACTORY,
            abi: ORGANIZATION_FACTORY_ABI,
            functionName: 'createOrganizationMetadata',
            args: [companyName, description, buildMetadata(), ''],
            chainId: 100 // Gnosis Chain
        });
    };

    // Handle link
    const handleLink = () => {
        if (!aggregatorAddress || !organizationAddress) return;
        setError(null);
        linkOrg({
            address: aggregatorAddress,
            abi: AGGREGATOR_ABI,
            functionName: 'addOrganization',
            args: [organizationAddress],
            chainId: 100 // Gnosis Chain
        });
    };

    // Handle update metadata
    const handleUpdateMetadata = () => {
        if (!selectedOrgToEdit) return;
        setError(null);
        updateMetadata({
            address: selectedOrgToEdit.id,
            abi: ORGANIZATION_ABI,
            functionName: 'updateExtendedMetadata',
            args: [editMetadata, ''],
            chainId: 100 // Gnosis Chain
        });
    };

    // Handle update success
    useEffect(() => {
        if (updateSuccess) {
            setStep(STEP.SUCCESS);
            // Refresh my orgs list
            if (connectedAddress) {
                fetchMyOrgs(connectedAddress);
            }
        }
    }, [updateSuccess]);

    // Check if user can add to aggregator
    const canAddToAggregator = aggregatorOwner &&
        connectedAddress &&
        aggregatorOwner.toLowerCase() === connectedAddress.toLowerCase();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

            {/* Modal */}
            <div className="relative bg-white dark:bg-futarchyDarkGray2 rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-futarchyGray6 dark:border-futarchyGray11">
                    <h2 className="text-lg font-semibold text-futarchyGray12 dark:text-white flex items-center gap-2">
                        {step === STEP.CHOOSE && '✨ Organization Manager'}
                        {step === STEP.CREATE && '📦 Create Organization'}
                        {step === STEP.LINK && '🔗 Link to Aggregator'}
                        {step === STEP.SUCCESS && '✅ Success'}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="text-futarchyGray11 hover:text-futarchyGray12 dark:text-futarchyGray6 dark:hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* Not connected warning */}
                    {!isConnected && (
                        <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-800 dark:text-yellow-200 text-sm">
                            ⚠️ Please connect your wallet to continue
                        </div>
                    )}

                    {/* STEP: Choose */}
                    {step === STEP.CHOOSE && (
                        <div className="space-y-3">
                            <p className="text-futarchyGray11 dark:text-futarchyGray6 text-sm mb-4">
                                What would you like to do?
                            </p>
                            <button
                                onClick={() => { setMode('create'); setStep(STEP.CREATE); }}
                                className="w-full p-4 text-left rounded-xl border-2 border-futarchyGray6 dark:border-futarchyGray11 hover:border-futarchyLavender dark:hover:border-futarchyLavender transition-colors"
                                disabled={!isConnected}
                            >
                                <div className="font-semibold text-futarchyGray12 dark:text-white">📦 Create New Organization</div>
                                <div className="text-sm text-futarchyGray11 dark:text-futarchyGray6 mt-1">
                                    Create a new company with metadata
                                </div>
                            </button>
                            <button
                                onClick={() => { setMode('link'); setStep(STEP.LINK); }}
                                className="w-full p-4 text-left rounded-xl border-2 border-futarchyGray6 dark:border-futarchyGray11 hover:border-futarchyLavender dark:hover:border-futarchyLavender transition-colors"
                                disabled={!isConnected}
                            >
                                <div className="font-semibold text-futarchyGray12 dark:text-white">🔗 Link Existing Organization</div>
                                <div className="text-sm text-futarchyGray11 dark:text-futarchyGray6 mt-1">
                                    Add an existing organization to an aggregator
                                </div>
                            </button>
                            <button
                                onClick={() => { setMode('edit'); setStep(STEP.EDIT); }}
                                className="w-full p-4 text-left rounded-xl border-2 border-futarchyGray6 dark:border-futarchyGray11 hover:border-futarchyLavender dark:hover:border-futarchyLavender transition-colors"
                                disabled={!isConnected || myOrgs.length === 0}
                            >
                                <div className="font-semibold text-futarchyGray12 dark:text-white flex items-center gap-2">
                                    ✏️ Edit My Organizations
                                    {myOrgs.length > 0 && (
                                        <span className="bg-futarchyLavender text-white text-xs px-2 py-0.5 rounded-full">
                                            {myOrgs.length}
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-futarchyGray11 dark:text-futarchyGray6 mt-1">
                                    {isLoadingMyOrgs ? 'Loading...' :
                                        myOrgs.length === 0 ? 'No organizations owned by you' :
                                            `Update metadata for your ${myOrgs.length} organization(s)`}
                                </div>
                            </button>
                        </div>
                    )}

                    {/* STEP: Create */}
                    {step === STEP.CREATE && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-futarchyGray12 dark:text-white mb-1">
                                    Company Name *
                                </label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="e.g., GnosisDAO"
                                    className="w-full px-3 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-futarchyGray12 dark:text-white mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief description of the organization"
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-futarchyGray12 dark:text-white mb-1">
                                    Cover Image URL
                                </label>
                                <input
                                    type="text"
                                    value={coverImage}
                                    onChange={(e) => setCoverImage(e.target.value)}
                                    placeholder="https://... or ipfs://..."
                                    className="w-full px-3 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-futarchyGray12 dark:text-white mb-1">
                                    Primary Color
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="w-10 h-10 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="flex-1 px-3 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white font-mono"
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-sm text-futarchyGray11 dark:text-futarchyGray6">
                                <input
                                    type="checkbox"
                                    checked={linkAfterCreate}
                                    onChange={(e) => setLinkAfterCreate(e.target.checked)}
                                    className="rounded"
                                />
                                Link to Aggregator after creation
                            </label>

                            {error && (
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-800 dark:text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setStep(STEP.CHOOSE)}
                                    className="px-4 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 text-futarchyGray12 dark:text-white hover:bg-futarchyGray2 dark:hover:bg-futarchyGray11"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!companyName || isCreating}
                                    className="flex-1 px-4 py-2 rounded-lg bg-futarchyLavender text-white font-medium hover:bg-futarchyLavender/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating ? 'Creating...' : 'Create Organization'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: Link */}
                    {step === STEP.LINK && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-futarchyGray12 dark:text-white mb-1">
                                    Aggregator {aggregatorsList.length > 0 ? '' : '*'}
                                </label>
                                {aggregatorsList.length > 0 ? (
                                    <select
                                        value={aggregatorAddress}
                                        onChange={(e) => setAggregatorAddress(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white"
                                    >
                                        {aggregatorsList.map((agg) => (
                                            <option key={agg.id} value={agg.id}>
                                                {agg.name} ({agg.id.slice(0, 6)}...{agg.id.slice(-4)})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={aggregatorAddress}
                                        onChange={(e) => setAggregatorAddress(e.target.value)}
                                        placeholder="0x..."
                                        className="w-full px-3 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white font-mono text-sm"
                                    />
                                )}
                                {isLoadingAggregators && (
                                    <p className="text-xs text-futarchyGray11 dark:text-futarchyGray6 mt-1">Loading aggregators...</p>
                                )}
                            </div>

                            {/* Owner check result */}
                            {aggregatorAddress.length === 42 && (
                                <div className={`p-3 rounded-lg text-sm ${isCheckingOwner ? 'bg-futarchyGray2 dark:bg-futarchyGray11' :
                                    canAddToAggregator ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                                        aggregatorOwner ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                    }`}>
                                    {isCheckingOwner && '⏳ Checking owner...'}
                                    {!isCheckingOwner && canAddToAggregator && (
                                        <>✅ You are the owner of <strong>{aggregatorName}</strong></>
                                    )}
                                    {!isCheckingOwner && aggregatorOwner && !canAddToAggregator && (
                                        <>❌ Owner is {aggregatorOwner.slice(0, 6)}...{aggregatorOwner.slice(-4)} (not you)</>
                                    )}
                                    {!isCheckingOwner && !aggregatorOwner && error && (
                                        <>⚠️ {error}</>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-futarchyGray12 dark:text-white mb-1">
                                    Organization Address *
                                </label>
                                <input
                                    type="text"
                                    value={organizationAddress}
                                    onChange={(e) => setOrganizationAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full px-3 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white font-mono text-sm"
                                />
                                {createdOrgAddress && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                        ✓ Using newly created organization
                                    </p>
                                )}
                            </div>

                            {/* Organization validation result */}
                            {organizationAddress.length === 42 && !createdOrgAddress && (
                                <div className={`p-3 rounded-lg text-sm ${isCheckingOrg ? 'bg-futarchyGray2 dark:bg-futarchyGray11' :
                                    orgInfo?.exists ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                                        'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                                    }`}>
                                    {isCheckingOrg && '⏳ Checking organization...'}
                                    {!isCheckingOrg && orgInfo?.exists && (
                                        <>
                                            ✅ Found: <strong>{orgInfo.name}</strong>
                                            <br />
                                            <span className="text-xs opacity-75">
                                                Owner: {orgInfo.owner?.slice(0, 6)}...{orgInfo.owner?.slice(-4)}
                                                {connectedAddress && orgInfo.owner?.toLowerCase() === connectedAddress.toLowerCase() && ' (you)'}
                                            </span>
                                        </>
                                    )}
                                    {!isCheckingOrg && orgInfo && !orgInfo.exists && (
                                        <>❌ Organization not found in subgraph</>
                                    )}
                                </div>
                            )}

                            {error && !aggregatorAddress && (
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-800 dark:text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setStep(mode === 'create' && createdOrgAddress ? STEP.SUCCESS : STEP.CHOOSE)}
                                    className="px-4 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 text-futarchyGray12 dark:text-white hover:bg-futarchyGray2 dark:hover:bg-futarchyGray11"
                                >
                                    {createdOrgAddress ? 'Skip' : '← Back'}
                                </button>
                                <button
                                    onClick={handleLink}
                                    disabled={!canAddToAggregator || !organizationAddress || isLinking}
                                    className="flex-1 px-4 py-2 rounded-lg bg-futarchyLavender text-white font-medium hover:bg-futarchyLavender/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLinking ? 'Linking...' : 'Add to Aggregator'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: Edit */}
                    {step === STEP.EDIT && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-futarchyGray12 dark:text-white mb-1">
                                    Select Organization to Edit
                                </label>
                                <select
                                    value={selectedOrgToEdit?.id || ''}
                                    onChange={(e) => {
                                        const org = myOrgs.find(o => o.id === e.target.value);
                                        setSelectedOrgToEdit(org);
                                        if (org) {
                                            // Pre-fill the metadata editor with current metadata
                                            try {
                                                setEditMetadata(org.metadata || '{}');
                                            } catch {
                                                setEditMetadata('{}');
                                            }
                                        }
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white"
                                >
                                    <option value="">Select an organization...</option>
                                    {myOrgs.map((org) => (
                                        <option key={org.id} value={org.id}>
                                            {org.name} ({org.id.slice(0, 6)}...{org.id.slice(-4)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedOrgToEdit && (
                                <>
                                    <div className="p-3 bg-futarchyGray2 dark:bg-futarchyGray11 rounded-lg">
                                        <div className="text-sm font-medium text-futarchyGray12 dark:text-white">
                                            {selectedOrgToEdit.name}
                                        </div>
                                        <div className="text-xs text-futarchyGray11 dark:text-futarchyGray6 font-mono">
                                            {selectedOrgToEdit.id}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-futarchyGray12 dark:text-white mb-1">
                                            Metadata JSON
                                        </label>
                                        <textarea
                                            value={editMetadata}
                                            onChange={(e) => setEditMetadata(e.target.value)}
                                            placeholder='{"coverImage": "...", "colors": {"primary": "#6b21a8"}}'
                                            rows={6}
                                            className="w-full px-3 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white font-mono text-sm"
                                        />
                                        <p className="text-xs text-futarchyGray11 dark:text-futarchyGray6 mt-1">
                                            Edit the JSON metadata for company card display
                                        </p>
                                    </div>
                                </>
                            )}

                            {error && (
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-800 dark:text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setStep(STEP.CHOOSE)}
                                    className="px-4 py-2 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 text-futarchyGray12 dark:text-white hover:bg-futarchyGray2 dark:hover:bg-futarchyGray11"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleUpdateMetadata}
                                    disabled={!selectedOrgToEdit || isUpdating}
                                    className="flex-1 px-4 py-2 rounded-lg bg-futarchyLavender text-white font-medium hover:bg-futarchyLavender/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUpdating ? 'Updating...' : 'Update Metadata'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: Success */}
                    {step === STEP.SUCCESS && (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-4">🎉</div>
                            <h3 className="text-lg font-semibold text-futarchyGray12 dark:text-white mb-2">
                                {mode === 'create' ? 'Organization Created!' :
                                    mode === 'edit' ? 'Metadata Updated!' :
                                        'Organization Linked!'}
                            </h3>
                            {createdOrgAddress && (
                                <p className="text-sm text-futarchyGray11 dark:text-futarchyGray6 font-mono break-all">
                                    {createdOrgAddress}
                                </p>
                            )}
                            <button
                                onClick={handleClose}
                                className="mt-4 px-6 py-2 rounded-lg bg-futarchyLavender text-white font-medium hover:bg-futarchyLavender/90"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
