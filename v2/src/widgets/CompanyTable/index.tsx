"use client";

import { useCompanyService } from "@/hooks/useCompanyService";
import { CompanyTableUI } from "./internal/ui/Table";
import { useEventBus } from "@/core/bus";
import { useRouter } from "next/navigation";

export const CompanyTableWidget = () => {
    const { companies, isLoading } = useCompanyService();
    const router = useRouter();

    // Connect to the Event Bus
    const { emit } = useEventBus();

    // Data flow handled by hook now


    const handleSelect = (companyId: string) => {
        // 2. Emit Event instead of direct navigation
        const company = companies.find(c => c.id === companyId);
        emit('company:selected', {
            companyId,
            companyName: company?.name || 'Unknown'
        });

        // 3. Navigate
        router.push(`/companies/${companyId}`);
    };

    return (
        <div className="h-full w-full">
            <CompanyTableUI
                companies={companies}
                isLoading={isLoading}
                onSelect={handleSelect}
            />
        </div>
    );
};
