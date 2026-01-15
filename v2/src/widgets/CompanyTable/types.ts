export interface Company {
    id: string;
    name: string;
    description: string;
    activeProposals: number;
    treasury: string; // e.g. "$5.2M"
    tokenSymbol: string;
}

export interface CompanyTableProps {
    companies: Company[];
    isLoading?: boolean;
}
