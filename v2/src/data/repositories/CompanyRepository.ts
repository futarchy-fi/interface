export interface RawCompanyDTO {
    id: string;
    slug: string;
    n: string; // name
    sym: string; // symbol
    desc: string;
    prop_count: number;
    treasury_val: string;
}

export class CompanyRepository {
    async fetchCompanies(): Promise<RawCompanyDTO[]> {
        console.log('[CompanyRepo] Fetching companies...');
        // Mock Data
        return [
            {
                id: "dao-1",
                slug: "gnosis",
                n: "Gnosis DAO",
                sym: "GNO",
                desc: "Building new market mechanisms for decentralized finance.",
                prop_count: 12,
                treasury_val: "150000000"
            },
            {
                id: "dao-2",
                slug: "uniswap",
                n: "Uniswap",
                sym: "UNI",
                desc: "A protocol for automated token exchange on Ethereum.",
                prop_count: 8,
                treasury_val: "2000000000"
            }
        ];
    }

    async fetchCompany(id: string): Promise<RawCompanyDTO | null> {
        // Mock Single Fetch
        const companies = await this.fetchCompanies();
        return companies.find(c => c.id === id) || null;
    }
}
