import React, { useState } from 'react';
import { clearRpcCache, getBestRpc } from '../../utils/getBestRpc';

const RefreshIcon = ({ className, fill }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={fill} className={className}>
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
    </svg>
);

const RpcRefreshButton = ({ chain, isDarkMode, className, showLabel = true }) => {
    const [isRefreshingRpc, setIsRefreshingRpc] = useState(false);

    const handleRefreshRpc = async () => {
        setIsRefreshingRpc(true);
        try {
            console.log('Refreshing RPC connection...');
            clearRpcCache();
            if (chain?.id) {
                await getBestRpc(chain.id);
                console.log('RPC connection refreshed!');
            }
        } catch (error) {
            console.error('Failed to refresh RPC:', error);
        } finally {
            setIsRefreshingRpc(false);
        }
    };

    return (
        <button
            onClick={handleRefreshRpc}
            disabled={isRefreshingRpc}
            className={`flex items-center gap-2 transition-colors ${className || ''} ${isRefreshingRpc ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Refresh RPC Connection"
        >
            <RefreshIcon
                className={`w-4 h-4 ${isRefreshingRpc ? 'animate-spin' : ''}`}
                fill={isDarkMode ? "white" : "currentColor"}
            />
            {showLabel && <span>{isRefreshingRpc ? 'Refreshing...' : 'Refresh RPC'}</span>}
        </button>
    );
};

export default RpcRefreshButton;
