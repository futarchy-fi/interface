import Head from "next/head";
import Link from "next/link";

import RootLayout from "../../components/layout/RootLayout";

const DOCUMENT_GROUPS = [
  {
    title: "Start Here",
    description: "Core reading for understanding the product, the mechanism, and the trading surface.",
    links: [
      {
        label: "Docs README",
        href: "https://github.com/futarchy-fi/docs/blob/main/README.md",
      },
      {
        label: "How Futarchy Works",
        href: "https://github.com/futarchy-fi/docs/blob/main/how-futarchy-works.md",
      },
      {
        label: "Trading in Futarchy",
        href: "https://github.com/futarchy-fi/docs/blob/main/trading-in-futarchy.md",
      },
    ],
  },
  {
    title: "Protocol",
    description: "Implementation details for proposal lifecycles, pools, custody, and conditional assets.",
    links: [
      {
        label: "Market Implementation",
        href: "https://github.com/futarchy-fi/docs/blob/main/market-implementation.md",
      },
      {
        label: "Proposal Lifecycle",
        href: "https://github.com/futarchy-fi/docs/blob/main/protocol/proposal-lifecycle.md",
      },
      {
        label: "Liquidity Pools",
        href: "https://github.com/futarchy-fi/docs/blob/main/protocol/liquidity-pools.md",
      },
      {
        label: "Custody and Oracles",
        href: "https://github.com/futarchy-fi/docs/blob/main/protocol/custody-and-oracles.md",
      },
    ],
  },
  {
    title: "DAO Use",
    description: "Materials for teams evaluating integration, sponsorship, and rollout paths.",
    links: [
      {
        label: "DAO Overview",
        href: "https://github.com/futarchy-fi/docs/blob/main/dao/README.md",
      },
      {
        label: "DAO Integration",
        href: "https://github.com/futarchy-fi/docs/blob/main/dao/integration.md",
      },
      {
        label: "DAO FAQ",
        href: "https://github.com/futarchy-fi/docs/blob/main/dao/faq.md",
      },
      {
        label: "DAO Sponsorship",
        href: "https://github.com/futarchy-fi/docs/blob/main/dao/sponsorship.md",
      },
    ],
  },
  {
    title: "Reference",
    description: "Operational reference material, risk disclosures, and terminology.",
    links: [
      {
        label: "Deployment and Addresses",
        href: "https://github.com/futarchy-fi/docs/blob/main/deployment-and-addresses.md",
      },
      {
        label: "Risks and Guarantees",
        href: "https://github.com/futarchy-fi/docs/blob/main/appendices/risks-and-guarantees.md",
      },
      {
        label: "Glossary",
        href: "https://github.com/futarchy-fi/docs/blob/main/appendices/glossary.md",
      },
    ],
  },
];

const pageTitle = "Futarchy Documents";
const pageDescription =
  "A stable in-app landing page for Futarchy documentation, with direct links to the canonical docs repository.";

export default function DocumentsPage() {
  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </Head>

      <RootLayout headerConfig="landing">
        <section className="bg-white pt-28 pb-24 text-black">
          <div className="container mx-auto px-5">
            <div className="rounded-[32px] border border-black/10 bg-[#F5F7FB] p-8 md:p-12">
              <div className="max-w-3xl">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-black/55">
                  Documents
                </div>
                <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
                  Futarchy reading room
                </h1>
                <p className="mt-5 text-lg leading-8 text-black/70">
                  The live footer docs link now lands here first. If the external docs host does
                  not open cleanly in your browser or wallet webview, use the direct document links
                  below.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href="https://github.com/futarchy-fi/docs#readme"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-black px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-black/80"
                >
                  Open docs repository
                </a>
                <Link
                  href="/companies"
                  className="inline-flex items-center justify-center rounded-xl border border-black px-5 py-3 text-base font-semibold text-black transition-colors hover:bg-black hover:text-white"
                >
                  Launch app
                </Link>
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {DOCUMENT_GROUPS.map((group) => (
                <div
                  key={group.title}
                  className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
                >
                  <h2 className="text-2xl font-semibold">{group.title}</h2>
                  <p className="mt-3 text-base leading-7 text-black/65">{group.description}</p>

                  <div className="mt-6 flex flex-col gap-3">
                    {group.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between rounded-2xl border border-black/10 px-4 py-4 transition-colors hover:border-black hover:bg-black hover:text-white"
                      >
                        <span className="text-base font-medium">{link.label}</span>
                        <span className="text-sm text-black/45 transition-colors group-hover:text-white/70">
                          GitHub
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RootLayout>
    </>
  );
}
