"use client";

import React, { useState, useEffect } from "react";
import { useCompanyService } from "@/hooks/useCompanyService";
import { CompanyDetailUI } from "./internal/ui/DetailView";
import { CompanyDetailProps } from "./types";

export const CompanyDetailWidget: React.FC<CompanyDetailProps> = ({ companyId }) => {
    const { getCompany } = useCompanyService();
    // Use 'any' for now to bypass strict type mismatch with legacy CompanyDetail type
    // In a full refactor we would unify the types (PositionModel/CompanyModel vs legacy types)
    const [company, setCompany] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const data = await getCompany(companyId);
            setCompany(data);
            setIsLoading(false);
        };
        load();
    }, [companyId]);

    return <CompanyDetailUI company={company} isLoading={isLoading} />;
};


