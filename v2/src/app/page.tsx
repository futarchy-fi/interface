import { SimpleGrid } from "@/core/layouts/DraggableGrid";
import { CompanyTableWidget } from "@/widgets/CompanyTable";
import { MarketPulseWidget } from "@/widgets/MarketPulse";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
      <div className="absolute top-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px] opacity-20"></div>

      <div className="container mx-auto py-10">
        <header className="mb-8 px-6">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500 mb-2">
            Futarchy Dashboard
          </h1>
          <p className="text-slate-400 max-w-2xl">
            Real-time governance markets and decision intelligence.
            Select a DAO to view active prediction markets.
          </p>
        </header>

        <SimpleGrid sidebar={<MarketPulseWidget />}>
          <CompanyTableWidget />
        </SimpleGrid>
      </div>
    </main>
  );
}
