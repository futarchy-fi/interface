import { MarketChartWidget, MarketStatsWidget, MarketActivityWidget } from "@/widgets/MarketChart";
import { TradePanelWidget } from "@/widgets/TradePanel";
import { MarketPulseWidget } from "@/widgets/MarketPulse";
import { MarketHeroWidget } from "@/widgets/MarketHero";
import { TransactionModalWidget } from "@/widgets/TransactionModal";
import { MobileNavWidget } from "@/widgets/MobileNav";

interface PageProps {
    params: Promise<{ proposalId: string }>;
}

export default async function MarketPage({ params }: PageProps) {
    const { proposalId } = await params;

    return (
        <main className="min-h-screen bg-[#0a0a0a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="absolute top-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px] opacity-20"></div>
            <div id="hero">
                <MarketHeroWidget proposalId={proposalId} />
            </div>

            <div className="container mx-auto py-8 px-4 md:px-6">

                {/* Stats Bar */}
                <MarketStatsWidget />

                {/* Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                    {/* Left Column: Chart & Activity (8 cols) */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        <div id="chart">
                            <MarketChartWidget proposalId={proposalId} />
                        </div>
                        <div id="activity">
                            <MarketActivityWidget proposalId={proposalId} />
                        </div>
                    </div>

                    {/* Right Column: Trading & Pulse (4 cols) */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <TradePanelWidget proposalId={proposalId} />
                        <div className="h-[400px]">
                            <MarketPulseWidget proposalId={proposalId} />
                        </div>
                    </div>
                </div>
            </div>

            <TransactionModalWidget />
            <MobileNavWidget />
        </main >
    );
}
