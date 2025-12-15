import { CompanyRepository, RawCompanyDTO } from "../data/repositories/CompanyRepository";

export interface CompanyModel {
    id: string;
    name: string;
    tokenSymbol: string;
    description: string;
    activeProposals: number;
    treasury: string; // Formatted currency
    slug?: string;
    website: string;
    fullDescription: string;
    proposals: any[]; // Mocking proposals array for now
}

export class CompanyService {
    private repo: CompanyRepository;

    constructor(repo: CompanyRepository) {
        this.repo = repo;
    }

    async getCompanies(): Promise<CompanyModel[]> {
        const raw = await this.repo.fetchCompanies();
        return raw.map(this.transformToModel);
    }

    async getCompany(id: string): Promise<CompanyModel | null> {
        const raw = await this.repo.fetchCompany(id);
        if (!raw) return null;
        return this.transformToModel(raw);
    }

    private transformToModel(dto: RawCompanyDTO): CompanyModel {
        // Business Logic: Format currency, enrich data
        return {
            id: dto.id,
            name: dto.n,
            tokenSymbol: dto.sym,
            description: dto.desc,
            activeProposals: dto.prop_count,
            treasury: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact" }).format(Number(dto.treasury_val)),
            slug: dto.slug,
            website: "https://gnosis.io",
            fullDescription: dto.desc, // Use short desc for now
            proposals: [
                {
                    id: "prop-1",
                    title: "GIP-88: Should GnosisDAO invest in Gnosis Pay?",
                    status: "active",
                    endDate: "12m 21d",
                    volume: "$1.2M"
                }
            ]
        };
    }
}
