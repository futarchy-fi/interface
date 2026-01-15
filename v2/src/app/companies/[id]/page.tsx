import { SimpleGrid } from "@/core/layouts/DraggableGrid";
import { CompanyDetailWidget } from "@/widgets/CompanyDetail";

// This is a Server Component, but we are using client-side widgets.
// In Next.js 16, params are async.
interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function CompanyPage({ params }: PageProps) {
    const { id } = await params;

    return (
        <main className="min-h-screen bg-[#0a0a0a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="absolute top-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px] opacity-20"></div>

            <div className="container mx-auto py-10">
                <SimpleGrid>
                    <CompanyDetailWidget companyId={id} />
                </SimpleGrid>
            </div>
        </main>
    );
}
