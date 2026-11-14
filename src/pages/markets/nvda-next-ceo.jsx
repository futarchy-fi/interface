import dynamic from "next/dynamic";
import Head from "next/head";
import cfg from "../../config/multi/nvda-next-ceo.json";

// Wallet hooks and chain reads only work in the browser.
const MultiOptionMarket = dynamic(() => import("../../components/futarchyFi/multiOption/MultiOptionMarket"), { ssr: false });

const TITLE = "Who is the next CEO of NVIDIA?";
const SUMMARY =
  "A market for each candidate: the chance they are announced as Jensen Huang's successor, and what NVIDIA stock would be worth if they are.";
const URL = "https://futarchy.fi/markets/nvda-next-ceo";

export default function NvdaNextCeoPage() {
  return (
    <>
      <Head>
        <title>{`${TITLE} | Futarchy`}</title>
        <meta name="description" content={SUMMARY} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={SUMMARY} />
        <meta property="og:url" content={URL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Futarchy" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={SUMMARY} />
        <link rel="canonical" href={URL} />
      </Head>
      <MultiOptionMarket cfg={cfg} title={TITLE} summary={SUMMARY} />
    </>
  );
}
