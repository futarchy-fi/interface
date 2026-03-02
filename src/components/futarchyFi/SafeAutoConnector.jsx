import { useEffect } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { useSafeDetection } from '../../hooks/useSafeDetection';

const SafeAutoConnector = () => {
    const { isSafe, isLoading } = useSafeDetection();
    const { connect, connectors } = useConnect();
    const { isConnected, connector } = useAccount();

    useEffect(() => {
        // Only proceed if SDK says we are in a Safe, we aren't loading, 
        // and we aren't already connected to the Safe connector.
        if (isSafe && !isLoading) {
            const safeConnector = connectors.find((c) => c.id === 'safe');

            const isAlreadySafeConnected = isConnected && connector?.id === 'safe';

            if (safeConnector && !isAlreadySafeConnected) {
                console.log('[SafeAutoConnector] Safe environment detected. Forcing connection to Safe Connector...');
                connect({ connector: safeConnector });
            }
        }
    }, [isSafe, isLoading, connectors, connect, isConnected, connector]);

    return null; // This component renders nothing
};

export default SafeAutoConnector;
