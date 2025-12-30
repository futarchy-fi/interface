

export interface Proposal {
    id: string;
    title: string;
    status: 'active' | 'passed' | 'failed';
    endDate: string;
    volume: string;
}

export interface CompanyDetail {
    id: string;
    name: string;
    description: string;
    activeProposals: number;
    treasury: string;
    tokenSymbol: string;
    fullDescription: string;
    website: string;
    proposals: Proposal[];
}

export interface CompanyDetailProps {
    companyId: string;
}
