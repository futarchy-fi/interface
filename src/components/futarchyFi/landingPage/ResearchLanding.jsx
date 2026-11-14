// Research-oriented landing page for futarchy.fi.
// Same visual design as LandingPage.jsx (animated gradient hero, black card section, pastel diagram cards,
// Robin Hanson section, closing call to action); the content is about the research, led by Bayes Market.
import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import RootLayout from "../../layout/RootLayout";
import useHeroGradient from "./useHeroGradient";

const TypewriterEffect = dynamic(() => import("react-typewriter-effect"), { ssr: false });

const BAYES_MARKET_URL = "https://futarchy.ai";
const GITHUB_ORG = "https://github.com/futarchy-fi";

const RESEARCH_AREAS = [
  {
    title: "Bayesian-network markets",
    description:
      "Every question is a variable in one network. Move a probability, or a conditional one, and an inference engine keeps all the prices consistent.",
    pattern: "pattern-chart.svg",
    gradientColors: "from-[#1D4F73] via-[#000000] to-[#1D4F73]",
    link: { label: "Open Bayes Market", href: BAYES_MARKET_URL },
  },
  {
    title: "Decision markets",
    description:
      "One asset priced once per choice. The gap between the prices is the market's estimate of what the decision is worth.",
    pattern: "pattern-diamonds-2.svg",
    gradientColors: "from-[#F28C5A] via-[#000000] to-[#F28C5A]",
    link: { label: "See the markets", href: "/companies", internal: true },
  },
  {
    title: "Markets for AI agents",
    description:
      "Teams of autonomous agents whose choices are made by internal markets instead of a fixed chain of command.",
    pattern: "pattern-star-2.svg",
    gradientColors: "from-[#873dcc] via-[#000000] to-[#873dcc]",
    link: { label: "Agents", href: `${GITHUB_ORG}/agents` },
  },
  {
    title: "Mechanism design",
    description:
      "How much money a market needs behind it, who should supply it, and what it costs to push a price the wrong way. Tested in simulation first.",
    pattern: "pattern-bars.svg",
    gradientColors: "from-[#3C607A] via-[#000000] to-[#3C607A]",
    link: { label: "Simulations", href: `${GITHUB_ORG}/simulations` },
  },
];

const EXPERIMENTS = [
  { question: "What is NVIDIA stock worth under each possible next CEO?", where: "NVIDIA", status: "Open", href: "/ceo" },
  { question: "What is NVIDIA stock worth if Jensen Huang stops being CEO?", where: "NVIDIA", status: "Resolving", href: "/nvda" },
  { question: "What is an open-source protocol worth if a proposal to change it passes?", where: "Ethereum, Gnosis, Kleros", status: "Closed", href: "/companies" },
];

const CODE = [
  { name: "bayes-market", note: "Bayesian prediction market engine, event-sourced and combinatorial" },
  { name: "simulations", note: "Mechanism-design simulations for decision markets" },
  { name: "agents", note: "Agent teams governed by markets" },
  { name: "fire-the-ceo", note: "Robin Hanson's fire-the-CEO decision markets" },
  { name: "futarchy", note: "Conditional markets with two or more options" },
];

const TALKS = [
  { title: "Launching Futarchy", venue: "DappCon 2025, Kelvin Santos and Robin Hanson" },
  {
    title: "Does AI governance need a Federalist Papers debate?",
    venue: "LessWrong, 2023",
    href: "https://www.lesswrong.com/posts/YkrDKR7TyqDxwKj23/does-ai-governance-needs-a-federalist-papers-debate",
  },
  { title: "Price-Based Futarchy", venue: "Governance Day 2025", href: "https://www.youtube.com/watch?v=cXUDTWZkfIU" },
];

const NAVY = "#0B1B3A";
const BLUE = "#6F78F2";
const ORANGE = "#F28C5A";
const CYAN = "#45D9F3";

const linkClass = "underline decoration-black/30 underline-offset-4 hover:decoration-black transition-colors";

const TextLink = ({ href, internal, className = linkClass, children }) =>
  internal ? (
    <Link href={href} className={className}>{children}</Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
  );

// A small Bayesian network: two causes, one effect, each with its current probability.
const BayesNetworkDiagram = () => (
  <svg viewBox="0 0 640 300" role="img" aria-label="Three questions linked in a Bayesian network" className="w-full h-auto">
    <defs>
      <marker id="bn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={NAVY} />
      </marker>
    </defs>
    <path d="M250 76 C 320 76, 330 150, 392 150" fill="none" stroke={NAVY} strokeWidth="2" markerEnd="url(#bn-arrow)" />
    <path d="M250 224 C 320 224, 330 150, 392 150" fill="none" stroke={NAVY} strokeWidth="2" markerEnd="url(#bn-arrow)" />
    {[
      { x: 20, y: 36, w: 230, text: ["Central bank cuts rates", "in March?"], p: "62%", color: BLUE },
      { x: 20, y: 184, w: 230, text: ["Oil above $100", "this year?"], p: "18%", color: ORANGE },
      { x: 396, y: 110, w: 224, text: ["Recession", "next year?"], p: "27%", color: NAVY },
    ].map((n) => (
      <g key={n.text[0]}>
        <rect x={n.x} y={n.y} width={n.w} height="80" rx="16" fill="white" stroke={n.color} strokeWidth="2.5" />
        <text x={n.x + 18} y={n.y + 34} fontSize="16" fill={NAVY} fontWeight="600">{n.text[0]}</text>
        <text x={n.x + 18} y={n.y + 56} fontSize="16" fill={NAVY} fontWeight="600">{n.text[1]}</text>
        <rect x={n.x + n.w - 70} y={n.y - 14} width="58" height="28" rx="14" fill={n.color} />
        <text x={n.x + n.w - 41} y={n.y + 5} fontSize="14" fill="white" fontWeight="700" textAnchor="middle">{n.p}</text>
      </g>
    ))}
    <text x="320" y="288" fontSize="13" fill="#555" textAnchor="middle">Move one probability and the linked ones update. Illustrative numbers.</text>
  </svg>
);

// A decision market: one stock today, and its price in each world the decision could lead to.
const DecisionMarketDiagram = () => (
  <svg viewBox="0 0 640 300" role="img" aria-label="One stock priced under each possible choice" className="w-full h-auto">
    <defs>
      <marker id="dm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={NAVY} />
      </marker>
    </defs>
    <rect x="20" y="104" width="180" height="84" rx="16" fill={NAVY} />
    <text x="110" y="138" fontSize="15" fill="white" textAnchor="middle" opacity="0.8">The stock today</text>
    <text x="110" y="168" fontSize="24" fill="white" textAnchor="middle" fontWeight="700">$162</text>
    {[
      { y: 22, label: "If candidate A is chosen", price: "$165", delta: "+1.9%", color: CYAN },
      { y: 110, label: "If candidate B is chosen", price: "$160", delta: "−1.2%", color: ORANGE },
      { y: 198, label: "If nobody is chosen", price: "$162", delta: "0.0%", color: BLUE },
    ].map((b) => (
      <g key={b.label}>
        <path d={`M200 146 C 260 146, 250 ${b.y + 36}, 316 ${b.y + 36}`} fill="none" stroke={NAVY} strokeWidth="2" markerEnd="url(#dm-arrow)" />
        <rect x="320" y={b.y} width="300" height="72" rx="16" fill="white" stroke={b.color} strokeWidth="2.5" />
        <text x="338" y={b.y + 30} fontSize="15" fill={NAVY} fontWeight="600">{b.label}</text>
        <text x="338" y={b.y + 54} fontSize="18" fill={NAVY} fontWeight="700">{b.price}</text>
        <text x="398" y={b.y + 54} fontSize="15" fill="#555">{b.delta}</text>
      </g>
    ))}
    <text x="320" y="292" fontSize="13" fill="#555" textAnchor="middle">The differences are what the market thinks each choice is worth. Illustrative numbers.</text>
  </svg>
);

const ResearchLanding = ({ useStorybookUrl = false }) => {
  const canvasRef = useRef(null);
  const robinSectionRef = useRef(null);
  const [isTextVisible, setIsTextVisible] = useState(false);
  const [isRobinSectionVisible, setIsRobinSectionVisible] = useState(false);

  useHeroGradient(canvasRef);

  useEffect(() => {
    // Matches the end of the typewriter headline.
    const timer = setTimeout(() => setIsTextVisible(true), 2400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => setIsRobinSectionVisible(entry.isIntersecting)),
      { threshold: 0.1, rootMargin: "50px" }
    );
    if (robinSectionRef.current) observer.observe(robinSectionRef.current);
    return () => observer.disconnect();
  }, []);

  const rise = (delay = "") =>
    `transition-all duration-700 ${delay} ${isRobinSectionVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;
  const headline = { fontFamily: "var(--font-oxanium)", fontSize: "64px", fontWeight: "600", lineHeight: "1.2", color: "#000000" };

  return (
    <RootLayout headerConfig="landing" footerConfig="landing" useStorybookUrl={useStorybookUrl}>
      <Head>
        <title>Futarchy Labs: research on decision markets</title>
        <meta
          name="description"
          content="We study markets that answer what-if questions: Bayesian-network markets, decision markets and the mechanisms behind them. We run them with real money and publish the code."
        />
      </Head>

      <div>
        {/* Hero: the animated gradient field of the original landing page */}
        <div className="relative w-full bg-white overflow-hidden">
          <div className="w-full h-full relative">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.7 }} />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/20 to-white/50" />

            <div className="relative h-screen md:flex-col px-16 hidden md:flex place-content-center py-20" id="interactive-area-desktop">
              <div className="flex flex-col w-full gap-8">
                <p className="text-sm uppercase tracking-[0.2em] text-futarchyGray11">Futarchy Labs · research on decision markets</p>
                <div className="flex flex-row gap-4 flex-wrap">
                  <TypewriterEffect textStyle={headline} startDelay={100} cursorColor="transparent" text="Markets that answer" typeSpeed={35} />
                  <TypewriterEffect textStyle={{ ...headline, color: BLUE }} startDelay={1100} cursorColor="transparent" text="“what if?”" typeSpeed={35} />
                </div>
                <div className={`text-[22px] font-normal text-futarchyGray11 transition-opacity duration-1000 flex flex-col gap-8 max-w-4xl ${isTextVisible ? "opacity-100" : "opacity-0"}`}>
                  Most markets tell you what something is worth. We study markets that tell you what it would be worth
                  under each choice a group could make. We build them, run them with real money, and publish the code.
                  <div className="flex gap-4">
                    <a
                      href={BAYES_MARKET_URL}
                      className="h-12 border-2 border-black bg-black px-5 py-3 rounded-xl text-base font-semibold text-white hover:bg-transparent hover:text-black transition-colors shadow-xs flex items-center gap-3 group"
                    >
                      Open Bayes Market
                      <img src="/assets/ArrowUpRight.svg" alt="" className="group-hover:invert" />
                    </a>
                    <Link
                      href="/companies"
                      className="h-12 border-2 border-black bg-transparent px-5 py-3 rounded-xl text-base font-semibold text-black hover:bg-black hover:text-white transition-colors shadow-xs flex items-center justify-center"
                    >
                      See the markets
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative min-h-screen flex flex-col justify-center px-8 pt-28 pb-16 md:hidden" id="interactive-area-mobile">
              <p className="text-xs uppercase tracking-[0.2em] text-futarchyGray11">Futarchy Labs · research on decision markets</p>
              <h1 className="mt-5 font-oxanium text-[44px] leading-[1.1] font-semibold text-[#1F1F1F]">
                Markets that answer <span style={{ color: "#E68556" }}>“what if?”</span>
              </h1>
              <p className="mt-6 text-lg text-futarchyGray11">
                Most markets tell you what something is worth. We study markets that tell you what it would be worth
                under each choice a group could make. We build them, run them with real money, and publish the code.
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <a href={BAYES_MARKET_URL} className="h-12 border-2 border-black bg-black px-5 rounded-xl text-base font-semibold text-white flex items-center justify-center">
                  Open Bayes Market →
                </a>
                <Link href="/companies" className="h-12 border-2 border-black px-5 rounded-xl text-base font-semibold text-black flex items-center justify-center">
                  See the markets
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Research areas: the black card section */}
        <div className="min-h-screen bg-black py-20 relative overflow-hidden content-center">
          <div className="absolute top-0 left-0 right-0 h-[16px] square-dotted-line" />
          <div className="absolute inset-0 flex items-center justify-start pointer-events-none">
            <Image src="/assets/futarchy-logo-white.svg" alt="" width={600} height={600} className="opacity-[0.1] ml-16 watermark-blur" />
          </div>
          <div className="container mx-auto px-8 md:px-16 relative z-10">
            <div className="mb-16 text-center">
              <h2 className="text-4xl md:text-5xl font-oxanium text-white mb-4">What we research</h2>
              <p className="text-lg md:text-xl text-white/80 mx-auto max-w-4xl">
                Markets as instruments for reasoning: what a group believes, how its beliefs fit together, and what its
                choices are worth.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 pb-4">
              {RESEARCH_AREAS.map((card) => (
                <div key={card.title} className="flex flex-col group relative h-full rounded-xl bg-white overflow-hidden">
                  <div className="bg-lightGray rounded-t-lg p-8 flex items-center justify-center h-48 relative">
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${card.gradientColors} blur-xl`} />
                    <div className="relative z-10 transform transition-transform duration-300 group-hover:-translate-y-2">
                      <Image src={`/assets/${card.pattern}`} alt="" width={96} height={96} />
                    </div>
                  </div>
                  <div className="bg-white rounded-b-lg p-8 flex-1 flex flex-col relative -mt-6 z-20 transform transition-all duration-300 group-hover:-translate-y-4">
                    <h3 className="text-2xl font-semibold text-black mb-4">{card.title}</h3>
                    <p className="text-black text-lg mb-6">{card.description}</p>
                    <span className="mt-auto text-base font-semibold text-black">
                      <TextLink href={card.link.href} internal={card.link.internal}>{card.link.label}</TextLink>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How it works: sticky text and pastel diagram cards */}
        <div className="bg-white py-20 relative">
          <div className="mx-auto px-8 md:px-16 relative" style={{ zIndex: 1 }}>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3 md:sticky md:top-20 md:self-start">
                <h2 className="text-3xl font-oxanium text-black">How the markets work</h2>
                <p className="text-lg text-black/80 mt-6">
                  A price is a forecast that someone paid to make.<br />
                  We design markets where those forecasts answer the questions a decision depends on.
                </p>
              </div>
              <div className="md:w-2/3">
                <div className="space-y-8 text-black">
                  <div className="bg-[#F0F0FF] p-8">
                    <h3 className="text-2xl font-semibold mb-4">Bayes Market links questions in one network</h3>
                    <p className="text-lg text-gray-700 mb-6">
                      Traders can say "if A happens, B is 70% likely", not only "B is 40% likely". A belief about one
                      question updates the questions it bears on, the way it would in a careful forecaster's head.
                    </p>
                    <div className="bg-white/70 rounded-xl p-4 md:p-6"><BayesNetworkDiagram /></div>
                    <p className="mt-5 text-base font-semibold"><TextLink href={BAYES_MARKET_URL}>Open Bayes Market</TextLink></p>
                  </div>

                  <div className="bg-[#E6FFF9] p-8">
                    <h3 className="text-2xl font-semibold mb-4">A decision market prices one stock under each choice</h3>
                    <p className="text-lg text-gray-700 mb-6">
                      Each trade only counts in the world it was made for and is undone otherwise, so every price is an
                      honest answer to "what if this is chosen?".
                    </p>
                    <div className="bg-white/70 rounded-xl p-4 md:p-6"><DecisionMarketDiagram /></div>
                    <p className="mt-5 text-base font-semibold"><TextLink href="/ceo" internal>Live: who is the next CEO of NVIDIA?</TextLink></p>
                  </div>

                  <div className="bg-[#E6F7FF] p-8">
                    <h3 className="text-2xl font-semibold mb-4">People trade instead of voting</h3>
                    <p className="text-lg text-gray-700 mb-4">
                      Anyone who thinks a price is wrong can correct it and is paid if they were right. Knowledge moves
                      the price whoever holds it.
                    </p>
                    <Image src="/assets/card3-logo.webp" alt="" width={900} height={600} className="w-full max-h-80 object-cover" />
                  </div>

                  <div className="bg-[#FFF0F0] p-8">
                    <h3 className="text-2xl font-semibold mb-4">Arbitrage keeps the prices honest</h3>
                    <p className="text-lg text-gray-700 mb-4">
                      Today's price has to equal the chance-weighted average of the prices under each choice. When it
                      does not, correcting it is profitable.
                    </p>
                    <Image src="/assets/card4-logo.webp" alt="" width={900} height={600} className="w-full max-h-80 object-cover" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Field experiments, code, talks */}
        <div className="bg-[#F7F7F5] py-20">
          <div className="mx-auto px-8 md:px-16">
            <h2 className="text-3xl font-oxanium text-black">Field experiments</h2>
            <p className="text-lg text-black/80 mt-4 max-w-3xl">Each of these ran with real money, and each asked the same kind of question about a different decision.</p>
            <ul className="mt-8 divide-y divide-black/10 border-y border-black/10">
              {EXPERIMENTS.map((e) => (
                <li key={e.question} className="py-5 md:grid md:grid-cols-[1fr_14rem_8rem] md:items-baseline md:gap-6">
                  <Link href={e.href} className="text-xl font-semibold text-black hover:underline underline-offset-4">{e.question}</Link>
                  <span className="mt-1 block text-black/60 md:mt-0">{e.where}</span>
                  <span className="block text-black/60">{e.status}</span>
                </li>
              ))}
            </ul>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h2 className="text-3xl font-oxanium text-black">Code</h2>
                <ul className="mt-6 space-y-4">
                  {CODE.map((repo) => (
                    <li key={repo.name}>
                      <span className="font-mono text-base text-black"><TextLink href={`${GITHUB_ORG}/${repo.name}`}>{repo.name}</TextLink></span>
                      <span className="block text-black/65">{repo.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-3xl font-oxanium text-black">Talks and writing</h2>
                <ul className="mt-6 space-y-4">
                  {TALKS.map((talk) => (
                    <li key={talk.title}>
                      <span className="block text-lg text-black">{talk.href ? <TextLink href={talk.href}>{talk.title}</TextLink> : talk.title}</span>
                      <span className="block text-black/60">{talk.venue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Robin Hanson */}
        <div ref={robinSectionRef} className="w-full relative md:min-h-screen">
          <div className="absolute inset-0 right-0 bg-white" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#1D4F73]/45 to-[#1D4F73]" />
          <div className="relative py-16 md:py-8 md:h-screen content-center">
            <div className="flex flex-col w-full gap-8 px-8 md:px-[100px] max-w-[1440px] mx-auto">
              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 justify-between">
                <div className="flex flex-col text-left gap-4 w-full md:w-1/2">
                  <h3 className={`text-4xl font-bold font-oxanium text-white ${rise()}`}>Guided by the Inventor of Futarchy</h3>
                  <h4 className={`text-xl font-medium text-white ${rise("delay-100")}`}>Robin Hanson - Chief Scientific Officer</h4>
                  <p className={`text-white/90 text-lg leading-relaxed ${rise("delay-200")}`}>
                    Robin Hanson created the concept of futarchy in 2000 - using prediction markets for governance. As a
                    professor at George Mason University and research associate at Oxford's Future of Humanity
                    Institute, he developed the foundational theory of how markets can make better decisions than
                    traditional voting or expert opinions. His paper "Shall We Vote on Values, But Bet on Beliefs?"
                    shaped the field.
                  </p>
                  <div className={`mt-4 text-white/80 italic ${rise("delay-300")}`}>
                    "To embed such markets in the core of our form of government, we could 'vote on values, but bet on beliefs.'"
                  </div>
                </div>
                <div
                  className={`flex flex-col gap-4 w-full md:w-[480px] p-8 rounded-xl border border-futarchyGray4/30 text-futarchyGray4 bg-white/15 transition-all duration-1000 ease-out ${
                    isRobinSectionVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
                  }`}
                >
                  <div className="text-4xl font-bold text-futarchyDarkBlue text-right">2000</div>
                  <div className="text-base font-medium text-white text-right">Robin Hanson introduces futarchy, governance through prediction markets.</div>
                </div>
              </div>
              <div className={`flex flex-row flex-wrap gap-4 md:gap-8 transition-all duration-1000 ease-out delay-300 ${isRobinSectionVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}>
                <a href={BAYES_MARKET_URL} className="h-12 bg-black px-4 py-3 rounded-xl text-base font-semibold text-white hover:bg-white hover:text-black transition-colors shadow-xs">
                  Open Bayes Market
                </a>
                <a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer" className="h-12 bg-white px-4 py-3 rounded-xl text-base font-semibold text-black hover:bg-black hover:text-white transition-colors shadow-xs">
                  Read the code
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Closing */}
        <div className="bg-black pt-12 pb-24 relative">
          <div className="container px-8 md:px-[100px] relative z-10">
            <div className="flex flex-col items-start text-left gap-6">
              <Image src="/assets/futarchy-fi-full-logo-white.svg" alt="Futarchy" width={275} height={85} />
              <h2 className="text-3xl font-oxanium text-white">
                Major events shouldn't surprise us.<br />
                Neither should their impact.
              </h2>
              <a
                href={BAYES_MARKET_URL}
                className="h-12 border-2 border-black hover:border-white bg-white px-4 py-3 rounded-xl text-base font-semibold text-black hover:bg-black hover:text-white transition-colors shadow-xs"
              >
                Open Bayes Market
              </a>
            </div>
          </div>
        </div>
      </div>
    </RootLayout>
  );
};

export default ResearchLanding;
