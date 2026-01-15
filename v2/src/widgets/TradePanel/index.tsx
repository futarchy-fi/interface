"use client";

import React, { useState } from "react";

import { TradePanelUI } from "./internal/ui/PanelUI";
import { TradePanelProps } from "./types";
import { useEventBus } from "@/core/bus";
import { useExecutor } from "@/hooks/useExecutor";
import { useMarketService } from "@/hooks/useMarketService";
import { MarketModel } from "@/services/MarketService";

export const TradePanelWidget: React.FC<TradePanelProps> = ({ proposalId }) => {
    const [isTrading, setIsTrading] = useState(false);
    const { emit } = useEventBus();
    const { executor } = useExecutor();
    const { getMarket } = useMarketService(""); // orgId not strictly needed for getMarket
    const [market, setMarket] = useState<MarketModel | null>(null);

    React.useEffect(() => {
        if (!getMarket || !proposalId) return;
        getMarket(proposalId, 'TRADING').then(setMarket);
    }, [getMarket, proposalId]);

    const handleRequestTrade = (details: any) => {
        // Emit Event for Global Transaction Modal
        emit('market:transaction:open', details);
    };

    return <TradePanelUI
        proposalId={proposalId}
        onRequestTrade={handleRequestTrade}
        isTrading={isTrading}
        executor={executor}
        market={market}
    />;
};
