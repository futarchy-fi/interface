import { SimpleGrid } from "@/core/layouts/DraggableGrid";
import { PortfolioPositionsWidget } from "@/widgets/PortfolioPositions";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PortfolioPage() {
    return (
        <main className="min-h-screen bg-[#0a0a0a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="absolute top-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px] opacity-20"></div>

            <div className="container mx-auto py-10 px-6">
                <header className="mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500 mb-2">
                        My Portfolio
                    </h1>
                </header>

                <SimpleGrid>
                    <PortfolioPositionsWidget />
                </SimpleGrid>
            </div>
        </main>
    );
}
