// Research-oriented landing page for futarchy.fi.
// Plain text and links on purpose: no animation, no marketing cards.
import React from "react";
import Head from "next/head";
import Link from "next/link";
import RootLayout from "../../layout/RootLayout";

const BAYES_MARKET_URL = "https://futarchy.ai";
const GITHUB_ORG = "https://github.com/futarchy-fi";

const RESEARCH_AREAS = [
  {
    title: "Decision markets",
    body: [
      "A conditional market prices the same asset twice: once in the world where a decision goes one way, once in the world where it goes the other. The gap between the two prices is the market's estimate of what the decision is worth.",
      "We have run these markets on governance votes at Gnosis DAO and Kleros, on an Ethereum protocol decision, and on the leadership of a public company.",
    ],
    links: [{ label: "Live and past markets", href: "/companies", internal: true }],
  },
  {
    title: "Bayesian-network markets",
    body: [
      "In Bayes Market every question is a variable in a Bayesian network. Traders can move a probability directly, or move a conditional one: if A happens, B is 70% likely. An inference engine keeps every price consistent with a single joint distribution.",
      "The aim is a market where a belief about one question updates the questions it bears on, the way it would in a careful forecaster's head.",
    ],
    links: [
      { label: "Open Bayes Market", href: BAYES_MARKET_URL },
      { label: "Engine source", href: `${GITHUB_ORG}/bayes-market` },
    ],
  },
  {
    title: "Mechanism design",
    body: [
      "How much liquidity does a decision market need, who should supply it, and what does it cost to push a price the wrong way? We test designs in simulation before they hold money, and we keep the contracts small enough to audit.",
    ],
    links: [
      { label: "Simulations", href: `${GITHUB_ORG}/simulations` },
      { label: "Liquidity manager", href: `${GITHUB_ORG}/futarchy-liquidity-manager` },
      { label: "Multi-option markets", href: `${GITHUB_ORG}/futarchy/tree/master/multi-option` },
    ],
  },
  {
    title: "Markets for AI agents",
    body: [
      "Groups of autonomous agents face the problem every organisation faces: turning disagreement into a decision. We are building agent teams whose choices are made by internal markets instead of a fixed chain of command.",
    ],
    links: [{ label: "Agents", href: `${GITHUB_ORG}/agents` }],
  },
];

const EXPERIMENTS = [
  {
    question: "What is NVDA worth if Jensen Huang stops being CEO?",
    where: "NVIDIA",
    chain: "Robinhood Chain",
  },
  {
    question: "What is ETH worth if EIP-8363 is scheduled for the Hegotá upgrade?",
    where: "Ethereum",
    chain: "Ethereum",
  },
  {
    question: "What is GNO worth if a Gnosis Improvement Proposal passes?",
    where: "Gnosis DAO",
    chain: "Gnosis Chain",
  },
  {
    question: "What is PNK worth if a Kleros Improvement Proposal passes?",
    where: "Kleros",
    chain: "Gnosis Chain",
  },
];

const CODE = [
  { name: "futarchy", note: "Contracts for conditional and multi-option markets" },
  { name: "bayes-market", note: "Bayesian prediction market engine, event-sourced and combinatorial" },
  { name: "simulations", note: "Mechanism-design simulations for futarchy governance" },
  { name: "futarchy-liquidity-manager", note: "Liquidity manager contracts, written to be audited" },
  { name: "futarchy-arb", note: "Arbitrage contracts that keep conditional prices consistent with spot" },
  { name: "fire-the-ceo", note: "Robin Hanson's fire-the-CEO decision markets, on a test network" },
  { name: "agents", note: "Agent teams governed by markets" },
  { name: "interface", note: "This site" },
];

const TALKS = [
  {
    title: "Launching Futarchy",
    venue: "DappCon 2025, Kelvin Santos and Robin Hanson",
  },
  {
    title: "Price-Based Futarchy: A Tool for Smarter DAO Decisions",
    venue: "Governance Day 2025",
    href: "https://www.youtube.com/watch?v=cXUDTWZkfIU",
  },
  {
    title: "Does AI governance need a Federalist Papers debate?",
    venue: "LessWrong, 2023",
    href: "https://www.lesswrong.com/posts/YkrDKR7TyqDxwKj23/does-ai-governance-needs-a-federalist-papers-debate",
  },
];

const linkClass =
  "underline decoration-black/25 underline-offset-4 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white transition-colors";

const TextLink = ({ href, internal, children }) =>
  internal ? (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  );

const SectionLabel = ({ number, children }) => (
  <div className="flex items-baseline gap-3 text-xs uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
    <span className="tabular-nums">{number}</span>
    <span>{children}</span>
  </div>
);

const ResearchLanding = () => (
  <RootLayout headerConfig="landing">
    <Head>
      <title>Futarchy Labs: research on decision markets</title>
      <meta
        name="description"
        content="We study markets that answer what-if questions: conditional markets, Bayesian-network markets and the mechanisms behind them. We run them with real money and publish the code."
      />
    </Head>

    <div className="bg-[#FAFAF7] text-[#151515] dark:bg-futarchyDarkGray2 dark:text-white/90 font-sans">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        {/* Hero */}
        <section className="pt-36 pb-20 sm:pt-44 sm:pb-28">
          <p className="text-xs uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
            Futarchy Labs · research on decision markets
          </p>
          <h1 className="mt-6 font-oxanium text-4xl leading-[1.1] sm:text-6xl sm:leading-[1.05] font-semibold">
            Markets that answer <span className="whitespace-nowrap">“what if?”</span>
          </h1>
          <p className="mt-8 text-lg leading-relaxed sm:text-xl sm:leading-relaxed text-black/75 dark:text-white/75">
            Most markets tell you what something is worth. We study markets that tell you what it would be worth under
            each choice a group could make, so the choice can be informed by the price. We build them, run them with
            real money, and publish the code.
          </p>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-base">
            <a
              href={BAYES_MARKET_URL}
              className="inline-flex items-center gap-2 rounded-full bg-[#151515] px-5 py-2.5 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 transition-colors"
            >
              Open Bayes Market <span aria-hidden="true">→</span>
            </a>
            <Link href="/companies" className={`inline-flex items-center py-2.5 ${linkClass}`}>
              See the live markets
            </Link>
          </div>
        </section>

        {/* Research */}
        <section className="border-t border-black/10 dark:border-white/10 py-16 sm:py-20">
          <SectionLabel number="01">Research</SectionLabel>
          <div className="mt-10 space-y-14">
            {RESEARCH_AREAS.map((area) => (
              <article key={area.title} className="sm:grid sm:grid-cols-[13rem_1fr] sm:gap-8">
                <h2 className="font-oxanium text-xl font-semibold leading-snug">{area.title}</h2>
                <div className="mt-3 sm:mt-0">
                  {area.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)} className="mb-4 leading-relaxed text-black/75 dark:text-white/75">
                      {paragraph}
                    </p>
                  ))}
                  <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {area.links.map((link) => (
                      <TextLink key={link.href} href={link.href} internal={link.internal}>
                        {link.label}
                      </TextLink>
                    ))}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Field experiments */}
        <section className="border-t border-black/10 dark:border-white/10 py-16 sm:py-20">
          <SectionLabel number="02">Field experiments</SectionLabel>
          <p className="mt-8 leading-relaxed text-black/75 dark:text-white/75">
            Each of these ran on a public chain with real money, and each asked the same kind of question about a
            different decision.
          </p>
          <ul className="mt-8 divide-y divide-black/10 dark:divide-white/10 border-y border-black/10 dark:border-white/10">
            {EXPERIMENTS.map((experiment) => (
              <li
                key={experiment.question}
                className="py-4 sm:grid sm:grid-cols-[1fr_9rem_9rem] sm:items-baseline sm:gap-6"
              >
                <span className="leading-snug">{experiment.question}</span>
                <span className="mt-1 block text-sm text-black/55 dark:text-white/55 sm:mt-0">{experiment.where}</span>
                <span className="block text-sm text-black/55 dark:text-white/55">{experiment.chain}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm">
            <TextLink href="/companies" internal>
              All markets, with prices and outcomes
            </TextLink>
          </p>
        </section>

        {/* Code */}
        <section className="border-t border-black/10 dark:border-white/10 py-16 sm:py-20">
          <SectionLabel number="03">Code</SectionLabel>
          <ul className="mt-8 space-y-3">
            {CODE.map((repo) => (
              <li key={repo.name} className="sm:grid sm:grid-cols-[13rem_1fr] sm:gap-8">
                <span className="font-mono text-sm">
                  <TextLink href={`${GITHUB_ORG}/${repo.name}`}>{repo.name}</TextLink>
                </span>
                <span className="block text-black/65 dark:text-white/65">{repo.note}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Talks and writing */}
        <section className="border-t border-black/10 dark:border-white/10 py-16 sm:py-20">
          <SectionLabel number="04">Talks and writing</SectionLabel>
          <ul className="mt-8 space-y-5">
            {TALKS.map((talk) => (
              <li key={talk.title}>
                <span className="block leading-snug">
                  {talk.href ? <TextLink href={talk.href}>{talk.title}</TextLink> : talk.title}
                </span>
                <span className="block text-sm text-black/55 dark:text-white/55">{talk.venue}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Closing */}
        <section className="border-t border-black/10 dark:border-white/10 py-16 sm:py-20">
          <p className="leading-relaxed text-black/75 dark:text-white/75">
            Everything here is open source. To run a decision market for your organisation, or to work on the research,
            open an issue on{" "}
            <TextLink href={`${GITHUB_ORG}/interface/issues`}>GitHub</TextLink>.
          </p>
        </section>
      </div>
    </div>
  </RootLayout>
);

export default ResearchLanding;
