"use client";

import React, { useEffect, useState } from "react";
import { usePositionService } from "@/hooks/usePositionService";
import { PositionsTableUI } from "./internal/ui/PositionsTable";
import { PortfolioPositionsProps } from "./types";

export const PortfolioPositionsWidget: React.FC<PortfolioPositionsProps> = ({ userAddress }) => {
    // In real app, userAddress would come from context if not passed prop, or hook handles it
    const activeUser = userAddress || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const { positions, isLoading } = usePositionService(activeUser);

    return <PositionsTableUI positions={positions} isLoading={isLoading} />;
};
