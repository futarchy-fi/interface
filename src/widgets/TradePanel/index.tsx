"use client";

import React, { useState } from "react";

import { TradePanelUI } from "./internal/ui/PanelUI";
import { TradePanelProps } from "./types";
import { useEventBus } from "@/core/bus";

import { useExecutor } from "@/hooks/useExecutor";

export const TradePanelWidget: React.FC<TradePanelProps> = ({ proposalId }) => {
    const [isTrading, setIsTrading] = useState(false);
    const { emit } = useEventBus();
    const { executor } = useExecutor();

    const handleRequestTrade = (details: any) => {
        // Emit Event for Global Transaction Modal
        emit('market:transaction:open', details);
    };

    return <TradePanelUI proposalId={proposalId} onRequestTrade={handleRequestTrade} isTrading={isTrading} executor={executor} />;
};
