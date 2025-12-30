"use client";

import React, { useState, useEffect } from "react";
import { TransactionModalUI } from "./internal/ui/TransactionModalUI";
import { useEventBus } from "@/core/bus";
import { BuySellWorkflow } from "./internal/workflows/BuySellWorkflow";
import { MergeWorkflow } from "./internal/workflows/MergeWorkflow";
import { SplitWorkflow } from "./internal/workflows/SplitWorkflow";
import { SwapWorkflow } from "./internal/workflows/SwapWorkflow";
import { TransactionWorkflow } from "./internal/types";

import { useExecutor } from "@/hooks/useExecutor";

export const TransactionModalWidget: React.FC = () => {
    const { on, off } = useEventBus();
    const [isOpen, setIsOpen] = useState(false);
    const [tradeDetails, setTradeDetails] = useState<any>(null);
    const [activeWorkflow, setActiveWorkflow] = useState<TransactionWorkflow>(BuySellWorkflow);

    // Inject Executor
    const { executor } = useExecutor();

    useEffect(() => {
        // ... (existing event logic)
        const handleOpen = (details: any) => {
            if (details.mode === 'MERGE') {
                setActiveWorkflow(MergeWorkflow);
            } else if (details.mode === 'SPLIT') {
                setActiveWorkflow(SplitWorkflow);
            } else if (details.mode === 'SWAP') {
                setActiveWorkflow(SwapWorkflow);
            } else {
                setActiveWorkflow(BuySellWorkflow);
            }

            setTradeDetails(details);
            setIsOpen(true);
        };

        on('market:transaction:open', handleOpen);
        return () => {
            off('market:transaction:open', handleOpen);
        };
    }, [on, off]);

    if (!isOpen || !tradeDetails) return null;

    return (
        <TransactionModalUI
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            tradeDetails={tradeDetails}
            workflow={activeWorkflow}
            executor={executor} // Pass to UI
        />
    );

};
