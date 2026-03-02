/**
 * OrganizationManagerModal
 * 
 * Comprehensive management interface for Futarchy v2 Entities (Aggregators & Organizations).
 * Supports:
 * - Viewing Entity Details (Overview)
 * - Managing Content (Orgs in Aggregator, Proposals in Org)
 * - Settings (Transfer Ownership, Manage Editor, Update Metadata)
 */

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from '../futarchyFi/marketPage/constants/contracts';
import { AGGREGATOR_SUBGRAPH_URL as SUBGRAPH_URL } from '../../config/subgraphEndpoints';
import { useSearchProposals } from '../../hooks/useSearchProposals'; // Import search hook

// Tabs
const TAB = {
    OVERVIEW: 'overview',
    CONTENT: 'content',
    SETTINGS: 'settings'
};

// Mode
const MODE = {
    AGGREGATOR: 'aggregator',
    ORGANIZATION: 'organization'
};

export default function OrganizationManagerModal({
    isOpen,
    onClose,
    entityId,
    mode = MODE.ORGANIZATION // 'aggregator' | 'organization'
}) {
    const { address: connectedAddress, isConnected } = useAccount();

    // State
    const [activeTab, setActiveTab] = useState(TAB.OVERVIEW);
    const [entityData, setEntityData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [parsedMetadata, setParsedMetadata] = useState({});

    // Permission state
    const isOwner = entityData?.owner && connectedAddress &&
        entityData.owner.toLowerCase() === connectedAddress.toLowerCase();
    const isEditor = entityData?.editor && connectedAddress &&
        entityData.editor.toLowerCase() === connectedAddress.toLowerCase();
    const canEdit = isOwner || isEditor;

    // Refresh trigger
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const refresh = () => setRefreshTrigger(prev => prev + 1);

    // Fetch Entity Data
    useEffect(() => {
        if (!isOpen || !entityId) return;

        const fetchEntity = async () => {
            setIsLoading(true);
            try {
                const query = mode === MODE.AGGREGATOR
                    ? `{ aggregator(id: "${entityId.toLowerCase()}") { id name description metadata owner editor organizations { id name } } }`
                    : `{ organization(id: "${entityId.toLowerCase()}") { id name description metadata owner editor proposals { id metadataContract } } }`;

                const response = await fetch(SUBGRAPH_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });

                const result = await response.json();
                const data = mode === MODE.AGGREGATOR
                    ? result.data?.aggregator
                    : result.data?.organization;

                if (data) {
                    setEntityData(data);
                    try {
                        setParsedMetadata(JSON.parse(data.metadata || '{}'));
                    } catch {
                        setParsedMetadata({});
                    }
                } else {
                    setError('Entity not found');
                }
            } catch (e) {
                console.error(e);
                setError('Failed to load entity data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchEntity();
    }, [isOpen, entityId, mode, refreshTrigger]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-futarchyDarkGray2 rounded-2xl shadow-xl max-w-2xl w-full mx-4 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-futarchyGray6 dark:border-futarchyGray11 bg-futarchyGray2 dark:bg-futarchyDarkGray1">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${mode === MODE.AGGREGATOR ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                            {mode === MODE.AGGREGATOR ? '🌐' : '🏛️'}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-futarchyGray12 dark:text-white">
                                {entityData?.name || 'Loading...'}
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-futarchyGray11 dark:text-futarchyGray6">
                                <span className="font-mono">{entityId?.slice(0, 8)}...{entityId?.slice(-6)}</span>
                                {isOwner && <span className="text-green-600 bg-green-100 px-1.5 rounded">Owner</span>}
                                {isEditor && <span className="text-yellow-600 bg-yellow-100 px-1.5 rounded">Editor</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-futarchyGray11 hover:text-white transition-colors">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-futarchyGray6 dark:border-futarchyGray11">
                    {[
                        { id: TAB.OVERVIEW, label: 'Overview', icon: '📝' },
                        { id: TAB.CONTENT, label: mode === MODE.AGGREGATOR ? 'Organizations' : 'Proposals', icon: '📦' },
                        { id: TAB.SETTINGS, label: 'Settings', icon: '⚙️' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors
                                ${activeTab === tab.id
                                    ? 'text-futarchyLavender border-b-2 border-futarchyLavender bg-futarchyLavender/5'
                                    : 'text-futarchyGray11 hover:text-futarchyGray12 dark:hover:text-white'}`}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-futarchyLavender"></div></div>
                    ) : error ? (
                        <div className="text-center text-red-500 p-8">{error}</div>
                    ) : !entityData ? (
                        <div className="text-center text-futarchyGray11 p-8">No data found</div>
                    ) : (
                        <>
                            {activeTab === TAB.OVERVIEW && <OverviewTab entity={entityData} canEdit={canEdit} mode={mode} onRefresh={refresh} />}
                            {activeTab === TAB.CONTENT && <ContentTab entity={entityData} canEdit={canEdit} mode={mode} chainId={parsedMetadata.chain || 100} onRefresh={refresh} />}
                            {activeTab === TAB.SETTINGS && <SettingsTab entity={entityData} isOwner={isOwner} mode={mode} onRefresh={refresh} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Sub-Components ---

function OverviewTab({ entity, canEdit, mode, onRefresh }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <InfoCard label="Name" value={entity.name} />
                <InfoCard label="Type" value={mode === MODE.AGGREGATOR ? 'Aggregator' : 'Organization'} />
                <InfoCard label="Owner" value={entity.owner} mono />
                <InfoCard label="Editor" value={entity.editor || 'None'} mono />
            </div>

            <div className="p-4 bg-futarchyGray2 dark:bg-futarchyGray11/20 rounded-xl">
                <h3 className="text-sm font-semibold mb-2 dark:text-white">Metadata</h3>
                <pre className="text-xs font-mono overflow-auto max-h-40 bg-white dark:bg-futarchyDarkGray3 p-3 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11">
                    {entity.metadata}
                </pre>
            </div>

            <div className="flex justify-end">
                <div className="text-xs text-futarchyGray11">
                    ID: {entity.id}
                </div>
            </div>
        </div>
    );
}

function InfoCard({ label, value, mono }) {
    return (
        <div className="p-3 bg-futarchyGray2 dark:bg-futarchyGray11/20 rounded-lg">
            <div className="text-xs text-futarchyGray11 dark:text-futarchyGray6 mb-1">{label}</div>
            <div className={`text-sm dark:text-white truncate ${mono ? 'font-mono' : 'font-medium'}`} title={value}>
                {value}
            </div>
        </div>
    );
}

function ContentTab({ entity, canEdit, mode, chainId, onRefresh }) {
    const [subStep, setSubStep] = useState('list'); // list | create
    const publicClient = usePublicClient();

    // Create/Add Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [metadataJSON, setMetadataJSON] = useState('{}');
    const [targetAddress, setTargetAddress] = useState(''); // For linking existing

    // Proposal specific
    const [propQuestion, setPropQuestion] = useState('');
    const [propEvent, setPropEvent] = useState('');

    // Search Hook (Only for Organization mode)
    const { proposals, loading: isSearching, search } = useSearchProposals(chainId);
    const [searchTerm, setSearchTerm] = useState('');

    // Contracts
    const { writeContract, isPending: isTxPending, isSuccess, data: txData } = useWriteContract();
    const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txData });

    // Removal State
    const [removingId, setRemovingId] = useState(null);

    useEffect(() => {
        if (isConfirmed) {
            setSubStep('list');
            setName('');
            setTargetAddress('');
            setRemovingId(null);
            onRefresh();
        }
    }, [isConfirmed]);

    // Debounce search
    useEffect(() => {
        if (mode === MODE.ORGANIZATION && subStep === 'create') {
            const timer = setTimeout(() => search(searchTerm), 500);
            return () => clearTimeout(timer);
        }
    }, [searchTerm, subStep, mode]);

    const handleCreateAndAdd = () => {
        const metadata = JSON.stringify({ ...JSON.parse(metadataJSON || '{}'), createdAt: new Date().toISOString() });

        if (mode === MODE.AGGREGATOR) {
            writeContract({
                address: entity.id,
                abi: CONTRACT_ABIS.AGGREGATOR,
                functionName: 'createAndAddOrganizationMetadata',
                args: [name, description, metadata, ''], // metadataURI empty for now
                chainId: 100
            });
        } else {
            // Organization -> Create Proposal (wraps existing pool)
            writeContract({
                address: entity.id,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'createAndAddProposalMetadata',
                args: [targetAddress, propQuestion, propEvent, description, metadata, ''],
                chainId: 100
            });
        }
    };

    const handleRemove = async (item) => {
        const idDisplay = item.metadataContract ? `Metadata Contract: ${item.metadataContract}` : (item.name || item.id);
        if (!confirm(`Are you sure you want to remove this item?\n\n${idDisplay}`)) return;
        setRemovingId(item.id);

        try {
            // 1. Find the index of the item on-chain
            const abi = mode === MODE.AGGREGATOR ? CONTRACT_ABIS.AGGREGATOR : CONTRACT_ABIS.ORGANIZATION;
            const getMethod = mode === MODE.AGGREGATOR ? 'getOrganizations' : 'getProposals';

            // Fetch a large batch to find the index (assuming < 1000 items)
            const list = await publicClient.readContract({
                address: entity.id,
                abi: abi,
                functionName: getMethod,
                args: [0n, 1000n]
            });

            let index = -1;

            if (mode === MODE.ORGANIZATION) {
                // Proposal Mode: Use metadataContract from subgraph if available
                const targetAddress = item.metadataContract;

                if (targetAddress) {
                    console.log(`Using metadataContract: ${targetAddress}`);
                    index = list.findIndex(addr => addr.toLowerCase() === targetAddress.toLowerCase());
                } else {
                    // Fallback: This path should rarely happen with the new query
                    console.warn("metadataContract missing, resolving manually...");
                    const proposalAddresses = await Promise.all(list.map(async (addr) => {
                        try {
                            return await publicClient.readContract({
                                address: addr,
                                abi: CONTRACT_ABIS.PROPOSAL,
                                functionName: 'proposalAddress'
                            });
                        } catch (e) {
                            return null;
                        }
                    }));
                    index = proposalAddresses.findIndex(addr => addr && addr.toLowerCase() === item.id.toLowerCase());
                }
            } else {
                // Aggregator Mode: item.id is the Organization Metadata Address
                index = list.findIndex(addr => addr.toLowerCase() === item.id.toLowerCase());
            }

            if (index === -1) {
                console.error("Item ID not found in list. Item ID:", item.id);
                console.log("On-chain list:", list);
                alert(`Item ${item.id} not found on-chain. It may have already been removed or there is an index mismatch.`);
                setRemovingId(null);
                return;
            }

            console.log(`Found item ${item.id} at index ${index}`);

            // 2. Call remove function
            const removeMethod = mode === MODE.AGGREGATOR ? 'removeOrganizationMetadata' : 'removeProposalMetadata';

            writeContract({
                address: entity.id,
                abi: abi,
                functionName: removeMethod,
                args: [BigInt(index)],
                chainId: 100
            });

        } catch (error) {
            console.error("Error finding item index:", error);
            alert("Failed to prepare removal transaction. See console.");
            setRemovingId(null);
        }
    };

    const selectProposal = (p) => {
        setTargetAddress(p.id);
        setPropEvent(p.marketName || '');
        // Try to guess question from marketName
        setPropQuestion(p.marketName || '');
    };

    if (subStep === 'create') {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold dark:text-white">
                        {mode === MODE.AGGREGATOR ? 'Create & Add Organization' : 'Link Proposal'}
                    </h3>
                    <button onClick={() => setSubStep('list')} className="text-sm text-futarchyLavender hover:underline">Cancel</button>
                </div>

                {mode === MODE.ORGANIZATION && (
                    <div className="space-y-2 mb-4">
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm rounded-lg">
                            💡 Search for an existing Proposal Pool to create metadata and link it.
                        </div>
                        <Input
                            label="Search Proposals"
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Search by market name..."
                        />

                        {/* Search Results */}
                        {(isSearching || proposals.length > 0) && (
                            <div className="border border-futarchyGray6 rounded-lg max-h-40 overflow-y-auto bg-white dark:bg-futarchyDarkGray3">
                                {isSearching && <div className="p-2 text-xs">Searching...</div>}
                                {proposals.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => selectProposal(p)}
                                        className="p-2 hover:bg-futarchyGray2 dark:hover:bg-futarchyGray11 cursor-pointer text-sm border-b border-futarchyGray6 last:border-0"
                                    >
                                        <div className="font-medium">{p.marketName}</div>
                                        <div className="text-xs text-futarchyGray11 font-mono">{p.id}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Common Fields */}
                {mode === MODE.AGGREGATOR && (
                    <div className="space-y-3">
                        <Input label="Organization Name" value={name} onChange={setName} placeholder="e.g. Gnosis DAO" />
                    </div>
                )}

                {mode === MODE.ORGANIZATION && (
                    <div className="space-y-3 pt-2 border-t border-futarchyGray6">
                        <Input label="Proposal Address (0x...)" value={targetAddress} onChange={setTargetAddress} placeholder="0x123..." mono />
                        <Input label="Market Question" value={propQuestion} onChange={setPropQuestion} placeholder="Will GNO reach..." />
                        <Input label="Event Name" value={propEvent} onChange={setPropEvent} placeholder="GNO Price" />
                    </div>
                )}

                <div className="space-y-3">
                    <Input label="Description" value={description} onChange={setDescription} isTextArea />
                    <Input label="Metadata JSON" value={metadataJSON} onChange={setMetadataJSON} isTextArea mono />
                </div>

                <button
                    onClick={handleCreateAndAdd}
                    disabled={isTxPending || (mode === MODE.ORGANIZATION && !targetAddress)}
                    className="w-full py-3 bg-futarchyLavender text-white rounded-xl font-bold hover:brightness-110 disabled:opacity-50 mt-4"
                >
                    {isTxPending ? 'Confirming...' : (mode === MODE.AGGREGATOR ? 'Create & Add (1-Tx)' : 'Link Proposal (1-Tx)')}
                </button>
            </div>
        );
    }

    // List View
    const items = mode === MODE.AGGREGATOR ? entity.organizations : entity.proposals;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold dark:text-white">
                    {items?.length || 0} {mode === MODE.AGGREGATOR ? 'Organizations' : 'Proposals'}
                </h3>
                {canEdit && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSubStep('create')}
                            className="px-3 py-1.5 bg-futarchyLavender text-white text-sm font-medium rounded-lg hover:brightness-110"
                        >
                            + {mode === MODE.AGGREGATOR ? 'Create New' : 'Add Proposal'}
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {items?.length === 0 && <div className="text-center text-futarchyGray11 py-8">No content found</div>}
                {items?.map(item => (
                    <div key={item.id} className="p-3 border border-futarchyGray6 dark:border-futarchyGray11 rounded-xl flex justify-between items-center bg-white dark:bg-futarchyDarkGray3">
                        <div>
                            <div className="font-medium dark:text-white">
                                {/* Organizations have 'name', proposals usually don't in this basic query but let's see */}
                                {item.name || item.title || item.id}
                            </div>
                            <div className="text-xs text-futarchyGray11 font-mono">
                                {mode === MODE.ORGANIZATION ? (
                                    <a
                                        href={`/market?proposalId=${item.id}&useContractSource=subgraph-100`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-futarchyLavender hover:underline cursor-pointer flex items-center gap-1"
                                    >
                                        {item.id} ↗
                                    </a>
                                ) : (
                                    item.id
                                )}
                            </div>
                            {item.metadataContract && (
                                <div className="text-[10px] text-futarchyGray11/60 font-mono mt-0.5 flex items-center gap-1">
                                    <span className="uppercase tracking-wider">Metadata:</span>
                                    {item.metadataContract}
                                </div>
                            )}
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => handleRemove(item)}
                                disabled={isTxPending || removingId === item.id}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Remove"
                            >
                                {removingId === item.id ? (
                                    <span className="animate-spin block">⏳</span>
                                ) : (
                                    '🗑️'
                                )}
                            </button>
                        )}
                    </div>
                ))}
                {items?.length > 0 && <div className="text-xs text-center text-futarchyGray11 pt-2">Showing {items.length} items</div>}
            </div>
        </div>
    );
}

function SettingsTab({ entity, isOwner, mode, onRefresh }) {
    const [editorAddr, setEditorAddr] = useState('');
    const [ownerAddr, setOwnerAddr] = useState('');

    const { writeContract, isPending, isSuccess, data: txData } = useWriteContract();
    const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txData });

    useEffect(() => {
        if (isConfirmed) {
            setEditorAddr('');
            setOwnerAddr('');
            onRefresh();
        }
    }, [isConfirmed]);

    const handleSetEditor = () => {
        writeContract({
            address: entity.id,
            abi: mode === MODE.AGGREGATOR ? CONTRACT_ABIS.AGGREGATOR : CONTRACT_ABIS.ORGANIZATION,
            functionName: 'setEditor',
            args: [editorAddr],
            chainId: 100
        });
    };

    const handleTransferOwnership = () => {
        if (!confirm('Are you sure you want to transfer ownership? This cannot be undone.')) return;
        writeContract({
            address: entity.id,
            abi: mode === MODE.AGGREGATOR ? CONTRACT_ABIS.AGGREGATOR : CONTRACT_ABIS.ORGANIZATION,
            functionName: 'transferOwnership',
            args: [ownerAddr],
            chainId: 100
        });
    };

    if (!isOwner) return <div className="p-8 text-center text-futarchyGray11">Settings are only available to the Owner.</div>;

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Editor Management */}
            <section className="space-y-3">
                <h3 className="font-semibold dark:text-white border-b border-futarchyGray6 pb-2">Manage Editor</h3>
                <p className="text-sm text-futarchyGray11">Editors can add/remove content but cannot change ownership.</p>
                <div className="flex gap-2">
                    <Input value={editorAddr} onChange={setEditorAddr} placeholder="0x..." mono />
                    <button
                        onClick={handleSetEditor}
                        disabled={!editorAddr || isPending}
                        className="px-4 bg-futarchyGray12 dark:bg-white text-white dark:text-black font-medium rounded-lg disabled:opacity-50"
                    >
                        Set
                    </button>
                    <button
                        onClick={() => {
                            writeContract({
                                address: entity.id,
                                abi: mode === MODE.AGGREGATOR ? CONTRACT_ABIS.AGGREGATOR : CONTRACT_ABIS.ORGANIZATION,
                                functionName: 'revokeEditor',
                                args: [],
                                chainId: 100
                            })
                        }}
                        disabled={isPending}
                        className="px-4 bg-red-100 text-red-600 font-medium rounded-lg hover:bg-red-200"
                    >
                        Revoke
                    </button>
                </div>
            </section>

            {/* Ownership Transfer */}
            <section className="space-y-3">
                <h3 className="font-semibold text-red-600 border-b border-red-200 pb-2">Transfer Ownership</h3>
                <p className="text-sm text-futarchyGray11">Permanently transfer full control of this entity.</p>
                <div className="flex gap-2">
                    <Input value={ownerAddr} onChange={setOwnerAddr} placeholder="New Owner Address (0x...)" mono />
                    <button
                        onClick={handleTransferOwnership}
                        disabled={!ownerAddr || isPending}
                        className="px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                        Transfer
                    </button>
                </div>
            </section>
        </div>
    );
}

// Helper Input
function Input({ label, value, onChange, placeholder, mono, isTextArea }) {
    return (
        <div className="w-full">
            {label && <label className="block text-xs font-semibold text-futarchyGray11 dark:text-futarchyGray6 mb-1 uppercase">{label}</label>}
            {isTextArea ? (
                <textarea
                    value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                    className={`w-full p-2.5 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 dark:text-white text-sm focus:outline-none focus:border-futarchyLavender ${mono ? 'font-mono' : ''}`}
                    rows={4}
                />
            ) : (
                <input
                    type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                    className={`w-full p-2.5 rounded-lg border border-futarchyGray6 dark:border-futarchyGray11 bg-white dark:bg-futarchyDarkGray3 dark:text-white text-sm focus:outline-none focus:border-futarchyLavender ${mono ? 'font-mono' : ''}`}
                />
            )}
        </div>
    );
}
