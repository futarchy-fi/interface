// Page for a multi-option futarchy market: the probability of each option, the company token's price
// under each option, and trading for both. All reads come straight from the chain.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { formatUnits } from "viem";
import { CHAINS } from "../../../config/chains";
import { useTheme } from "../../../contexts/ThemeContext";
import MultiOptionChart, { OPTION_COLORS } from "./MultiOptionChart";
import {
  parseAmount,
  planMerge,
  planRedeem,
  planTrade,
  quoteSwap,
  readBalances,
  readMarket,
  tradeRoute,
} from "../../../utils/multiOption.mjs";

const REFRESH_MS = 15000;
const SLIPPAGE_BPS = 100;

const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const signedPct = (x) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(2)}%`;
const money = (x) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount = (raw, decimals, digits = 4) => {
  const n = Number(formatUnits(raw, decimals));
  if (n === 0) return "0";
  if (n < 10 ** -digits) return `<${10 ** -digits}`;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
};

const card = "rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.03]";
const muted = "text-black/55 dark:text-white/55";
const linkClass = "underline decoration-black/25 underline-offset-4 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white";

function Stat({ label, value, note }) {
  return (
    <div className={`${card} px-4 py-3`}>
      <div className={`text-xs uppercase tracking-wider ${muted}`}>{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {note && <div className={`mt-0.5 text-xs ${muted}`}>{note}</div>}
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col rounded-lg bg-black/5 p-1 text-sm dark:bg-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            value === o.value ? "bg-white font-medium shadow-sm dark:bg-white/20" : `${muted} hover:text-black dark:hover:text-white`
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function MultiOptionMarket({ cfg, title, summary }) {
  const chain = CHAINS[cfg.chainId];
  const publicClient = usePublicClient({ chainId: cfg.chainId });
  const { address: account, chainId: walletChainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [market, setMarket] = useState(null);
  const [balances, setBalances] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [selected, setSelected] = useState(cfg.options[0].index);
  const [kind, setKind] = useState("price");
  const [side, setSide] = useState("buy");
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [busy, setBusy] = useState(null); // { steps: [label], done: number }
  const [notice, setNotice] = useState(null); // { ok: boolean, text: string }
  const [showRules, setShowRules] = useState(false);
  const [chartView, setChartView] = useState("price");
  const [tick, setTick] = useState(0); // bumps on every refresh so an open quote is re-priced
  const running = useRef(false); // set before the first await, so a double click cannot start two runs
  const quoteKey = useRef("");
  const { isDarkMode } = useTheme();

  const refresh = useCallback(async () => {
    if (!publicClient) return;
    try {
      const [m, b] = await Promise.all([
        readMarket(publicClient, cfg),
        account ? readBalances(publicClient, cfg, account) : Promise.resolve(null),
      ]);
      setMarket(m);
      setBalances(b);
      setTick((t) => t + 1);
      setLoadError(null);
    } catch (e) {
      setLoadError(e?.shortMessage || e?.message || "Could not read the market");
    }
  }, [publicClient, cfg, account]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const option = cfg.options.find((o) => o.index === selected);
  const route = useMemo(() => tradeRoute(cfg, option, kind, side), [cfg, option, kind, side]);
  const amountIn = useMemo(() => parseAmount(input, route.tokenIn.decimals), [input, route]);

  // What the account can spend on this trade: the input token it holds, plus what it could split.
  const spendable = useMemo(() => {
    if (!balances) return null;
    const held = (address) => {
      if (address === cfg.currency.address) return balances.currency;
      const b = balances.options.find((o) => o.index === option.index);
      return address === option.currencyToken ? b.currency : b.company;
    };
    const own = held(route.tokenIn.address);
    const fromSplit = route.tokenIn.collateral ? (route.tokenIn.collateral.address === cfg.currency.address ? balances.currency : balances.company) : 0n;
    return { own, fromSplit, total: own + fromSplit };
  }, [balances, route, option, cfg]);

  useEffect(() => {
    // Clear the quote when the trade itself changes; on a periodic refresh keep showing it until the new one arrives.
    const key = `${route.tokenIn.address}:${route.tokenOut.address}:${amountIn}`;
    if (key !== quoteKey.current) {
      quoteKey.current = key;
      setQuote(null);
      setQuoteError(null);
    }
    if (!publicClient || amountIn === 0n) return undefined;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const q = await quoteSwap(publicClient, cfg, route, amountIn, SLIPPAGE_BPS);
        if (!stale) { setQuote(q); setQuoteError(null); }
      } catch (e) {
        if (!stale) setQuoteError("No quote for this size. Try a smaller amount.");
      }
    }, 350);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [publicClient, cfg, route, amountIn, tick]);

  const run = useCallback(
    async (plan, doneText) => {
      if (!walletClient || !account || running.current) return;
      running.current = true;
      setNotice(null);
      let done = 0;
      let total = 0;
      try {
        if (walletChainId !== cfg.chainId) await switchChainAsync({ chainId: cfg.chainId });
        const calls = await plan();
        total = calls.length;
        const steps = calls.map((c) => c.label);
        setBusy({ steps, done: 0 });
        for (let i = 0; i < calls.length; i += 1) {
          // publicClient.chain is this market's chain: correct even when the wallet was just switched to it.
          const hash = await walletClient.sendTransaction({ account, to: calls[i].to, data: calls[i].data, chain: publicClient.chain });
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") throw new Error(`"${calls[i].label}" reverted (${hash})`);
          done = i + 1;
          setBusy({ steps, done });
        }
        setNotice({ ok: true, text: doneText });
        setInput("");
      } catch (e) {
        const reason = e?.shortMessage || e?.message || "The transaction failed";
        const partial = done > 0 && done < total
          ? ` Stopped after step ${done} of ${total}. Nothing is lost: what you hold is under "Your positions", and a token of every option can be converted back there.`
          : "";
        setNotice({ ok: false, text: `${reason}${partial}` });
      } finally {
        running.current = false;
        setBusy(null);
        refresh();
      }
    },
    [walletClient, account, walletChainId, cfg, switchChainAsync, publicClient, refresh]
  );

  const sorted = market ? [...market.options].sort((a, b) => b.probability - a.probability) : [];
  const live = market?.options.find((o) => o.index === selected);
  const name = option.name;
  const outSymbol = route.tokenOut.symbol;
  const inSymbol = route.tokenIn.collateral && spendable && spendable.own < amountIn ? route.tokenIn.collateral.symbol : route.tokenIn.symbol;
  const tooMuch = spendable && amountIn > spendable.total;

  const explain = {
    "price:buy": `You get ${name}'s ${cfg.company.symbol}: it becomes real ${cfg.company.symbol} if ${name} is the answer and is worth nothing otherwise. You also keep the ${cfg.currency.symbol} side of every other option, so you get your ${cfg.currency.symbol} back if the answer is anyone else.`,
    "price:sell": `You sell ${cfg.company.symbol} only in the world where ${name} is the answer. If the answer is anyone else you keep your ${cfg.company.symbol}.`,
    "probability:buy": `Each ${option.symbol}_${cfg.currency.symbol} pays 1 ${cfg.currency.symbol} if ${name} is the answer and nothing otherwise.`,
    "probability:sell": `You give up the payout if ${name} is the answer. If you hold none, ${cfg.currency.symbol} is split into every option and this one is sold, which is a bet against ${name}.`,
  }[`${kind}:${side}`];

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-sans text-[#151515] dark:bg-futarchyDarkGray2 dark:text-white/90">
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-5">
          <Link href="/" className="font-oxanium text-lg font-semibold">
            Futarchy
          </Link>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </header>

        <section className="pt-6 sm:pt-10">
          <p className={`text-xs uppercase tracking-[0.18em] ${muted}`}>NVIDIA · settles by Jan 1, 2027 · {chain?.name}</p>
          <h1 className="mt-3 font-oxanium text-3xl font-semibold leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-black/75 dark:text-white/75">{summary}</p>
        </section>

        {loadError && (
          <p className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            Could not read the market from {chain?.name}: {loadError}
          </p>
        )}

        <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label={`${cfg.company.symbol} now`} value={market ? `$${money(market.spot)}` : "…"} note="Spot price on the same chain" />
          <Stat
            label="Implied by the options"
            value={market ? `$${money(market.implied)}` : "…"}
            note={market ? `${signedPct(market.implied / market.spot - 1)} from spot. Arbitrage keeps these two together.` : " "}
          />
          <Stat
            label="Probabilities add to"
            value={market ? pct(market.sumProbability, 1) : "…"}
            note={market?.resolved ? `Resolved: ${cfg.options.find((o) => o.index === market.winner)?.name}` : "Should be 100%"}
          />
        </section>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-6">
          <section className={`${card} p-4`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className={`text-xs uppercase tracking-wider ${muted}`}>{chartView === "price" ? `${cfg.company.symbol} price under each option` : "Chance of each option"}</div>
              <div className="w-56 max-w-full">
                <Segmented
                  value={chartView}
                  onChange={setChartView}
                  options={[
                    { value: "price", label: `${cfg.company.symbol} if so` },
                    { value: "probability", label: "Chance" },
                  ]}
                />
              </div>
            </div>
            <MultiOptionChart cfg={cfg} market={market} view={chartView} selected={selected} dark={isDarkMode} />
          </section>

          {/* Options */}
          <section className={`${card} overflow-hidden`}>
            <div className={`grid grid-cols-[1fr_5.5rem_5.5rem] gap-2 border-b border-black/10 px-4 py-2.5 text-xs uppercase tracking-wider dark:border-white/10 sm:grid-cols-[1fr_9rem_7rem_6rem] ${muted}`}>
              <span>Next CEO</span>
              <span className="text-right">Chance</span>
              <span className="text-right">{cfg.company.symbol} if so</span>
              <span className="hidden text-right sm:block">vs now</span>
            </div>
            {!market && <div className={`px-4 py-10 text-center text-sm ${muted}`}>Reading prices from the chain…</div>}
            {sorted.map((o) => {
              const impact = o.price / market.spot - 1;
              const active = o.index === selected;
              return (
                <button
                  key={o.index}
                  type="button"
                  onClick={() => setSelected(o.index)}
                  className={`grid w-full grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2 border-b border-black/5 px-4 py-3.5 text-left transition-colors last:border-b-0 dark:border-white/5 sm:grid-cols-[1fr_9rem_7rem_6rem] ${
                    active ? "bg-black/[0.04] dark:bg-white/[0.07]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: OPTION_COLORS[cfg.options.findIndex((x) => x.index === o.index) % OPTION_COLORS.length] }} />
                      <span className="truncate">{o.name}</span>
                    </span>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <span className="block h-full rounded-full bg-[#151515] dark:bg-white/80" style={{ width: `${Math.min(100, o.probability * 100)}%` }} />
                    </span>
                  </span>
                  <span className="text-right text-lg font-semibold tabular-nums">{pct(o.probability)}</span>
                  <span className="text-right tabular-nums">
                    ${money(o.price)}
                    <span className={`block text-xs sm:hidden ${impact >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{signedPct(impact)}</span>
                  </span>
                  <span className={`hidden text-right tabular-nums sm:block ${impact >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {signedPct(impact)}
                  </span>
                </button>
              );
            })}
          </section>
          </div>

          {/* Trade */}
          <section className={`${card} h-fit p-4`}>
            <div className={`text-xs uppercase tracking-wider ${muted}`}>Trade</div>
            <select
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 font-medium dark:border-white/20"
            >
              {cfg.options.map((o) => (
                <option key={o.index} value={o.index} className="text-black">
                  {o.name}
                </option>
              ))}
            </select>

            <div className="mt-3 space-y-2">
              <Segmented
                value={kind}
                onChange={(v) => { setKind(v); setInput(""); }}
                options={[
                  { value: "price", label: `${cfg.company.symbol} if so` },
                  { value: "probability", label: "Chance" },
                ]}
              />
              <Segmented
                value={side}
                onChange={(v) => { setSide(v); setInput(""); }}
                options={[
                  { value: "buy", label: "Buy" },
                  { value: "sell", label: "Sell" },
                ]}
              />
            </div>

            <div className={`mt-3 text-sm ${muted}`}>
              {live && (kind === "price" ? `${cfg.company.symbol} if ${name}: $${money(live.price)}` : `Chance of ${name}: ${pct(live.probability, 2)}`)}
            </div>

            <label className="mt-3 block">
              <span className={`flex justify-between text-xs ${muted}`}>
                <span>You pay ({route.tokenIn.collateral ? `${route.tokenIn.collateral.symbol} or ${route.tokenIn.symbol}` : route.tokenIn.symbol})</span>
                {spendable && (
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => setInput(formatUnits(spendable.total, route.tokenIn.decimals))}>
                    Available {amount(spendable.total, route.tokenIn.decimals)}
                  </button>
                )}
              </span>
              <input
                inputMode="decimal"
                placeholder="0.0"
                value={input}
                onChange={(e) => setInput(e.target.value.replace(",", "."))}
                className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-lg tabular-nums outline-none focus:border-black/50 dark:border-white/20 dark:focus:border-white/60"
              />
            </label>

            <div className="mt-3 min-h-[3.25rem] text-sm">
              {quote && (
                <>
                  <div className="flex justify-between">
                    <span className={muted}>You receive about</span>
                    <span className="font-medium tabular-nums">
                      {amount(quote.amountOut, route.tokenOut.decimals, 6)} {outSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={muted}>Average price</span>
                    <span className="tabular-nums">
                      {(() => {
                        const inN = Number(formatUnits(amountIn, route.tokenIn.decimals));
                        const outN = Number(formatUnits(quote.amountOut, route.tokenOut.decimals));
                        if (kind === "price") return `$${money(side === "buy" ? inN / outN : outN / inN)}`;
                        return pct(side === "buy" ? inN / outN : outN / inN, 2);
                      })()}
                    </span>
                  </div>
                </>
              )}
              {quoteError && <span className="text-red-700 dark:text-red-400">{quoteError}</span>}
              {tooMuch && <span className="text-red-700 dark:text-red-400">More than you have available.</span>}
            </div>

            {!isConnected ? (
              <div className="mt-2 flex justify-center">
                <ConnectButton />
              </div>
            ) : (
              <button
                type="button"
                disabled={!quote || tooMuch || !!busy || market?.resolved}
                onClick={() => run(() => planTrade(publicClient, cfg, account, route, amountIn, quote.minAmountOut), `Done. You received ${outSymbol}.`)}
                className="mt-2 w-full rounded-lg bg-[#151515] px-4 py-3 font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
              >
                {busy ? `Step ${Math.min(busy.done + 1, busy.steps.length)} of ${busy.steps.length}: ${busy.steps[Math.min(busy.done, busy.steps.length - 1)]}` : `${side === "buy" ? "Buy" : "Sell"} with ${inSymbol}`}
              </button>
            )}

            {notice && (
              <p className={`mt-3 break-words text-sm ${notice.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{notice.text}</p>
            )}
            <p className={`mt-3 text-xs leading-relaxed ${muted}`}>{explain}</p>
            <p className={`mt-2 text-xs ${muted}`}>Up to {SLIPPAGE_BPS / 100}% slippage. Each step is a separate wallet confirmation.</p>
          </section>
        </div>

        {/* Positions */}
        {balances && (
          <section className={`${card} mt-6 p-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className={`text-xs uppercase tracking-wider ${muted}`}>Your positions</div>
              <div className={`text-sm ${muted}`}>
                Wallet: {amount(balances.currency, cfg.currency.decimals, 2)} {cfg.currency.symbol} · {amount(balances.company, cfg.company.decimals)} {cfg.company.symbol}
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className={`text-left text-xs ${muted}`}>
                    <th className="py-1.5 font-normal">If the answer is</th>
                    <th className="py-1.5 text-right font-normal">you get {cfg.company.symbol}</th>
                    <th className="py-1.5 text-right font-normal">and {cfg.currency.symbol}</th>
                    {market?.resolved && <th className="py-1.5" />}
                  </tr>
                </thead>
                <tbody>
                  {cfg.options.map((o) => {
                    const b = balances.options.find((x) => x.index === o.index);
                    const won = market?.resolved && market.winner === o.index;
                    return (
                      <tr key={o.index} className="border-t border-black/5 dark:border-white/5">
                        <td className="py-2">{o.name}</td>
                        <td className="py-2 text-right tabular-nums">{amount(b.company, cfg.company.decimals)}</td>
                        <td className="py-2 text-right tabular-nums">{amount(b.currency, cfg.currency.decimals, 2)}</td>
                        {market?.resolved && (
                          <td className="py-2 text-right">
                            {won && (b.company > 0n || b.currency > 0n) && (
                              <button
                                type="button"
                                disabled={!!busy}
                                className={linkClass}
                                onClick={() =>
                                  run(async () => [
                                    ...(b.company > 0n ? await planRedeem(publicClient, cfg, account, "company", o.index, b.company) : []),
                                    ...(b.currency > 0n ? await planRedeem(publicClient, cfg, account, "currency", o.index, b.currency) : []),
                                  ], "Redeemed.")
                                }
                              >
                                Redeem
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!market?.resolved && (balances.completeCurrency > 0n || balances.completeCompany > 0n) && (
              <div className={`mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-black/5 pt-3 text-sm dark:border-white/5 ${muted}`}>
                <span>A token of every option together is worth exactly one real token. Convert back:</span>
                {balances.completeCurrency > 0n && (
                  <button type="button" disabled={!!busy} className={linkClass} onClick={() => run(() => planMerge(publicClient, cfg, account, "currency", balances.completeCurrency), `Converted back to ${cfg.currency.symbol}.`)}>
                    {amount(balances.completeCurrency, cfg.currency.decimals, 2)} {cfg.currency.symbol}
                  </button>
                )}
                {balances.completeCompany > 0n && (
                  <button type="button" disabled={!!busy} className={linkClass} onClick={() => run(() => planMerge(publicClient, cfg, account, "company", balances.completeCompany), `Converted back to ${cfg.company.symbol}.`)}>
                    {amount(balances.completeCompany, cfg.company.decimals)} {cfg.company.symbol}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* How it works and rules */}
        <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-oxanium text-xl font-semibold">How to read this</h2>
            <ul className="mt-3 space-y-2 leading-relaxed text-black/75 dark:text-white/75">
              <li><strong>Chance</strong> is the market's probability that this person is the first announced successor.</li>
              <li><strong>{cfg.company.symbol} if so</strong> is what traders will pay for {cfg.company.symbol} in that world only. A trade made there is undone if the answer is someone else.</li>
              <li><strong>vs now</strong> is that price against today's {cfg.company.symbol}: the market's estimate of what the choice does to the stock.</li>
              <li>Today's price has to equal the chance-weighted average of the option prices. When it does not, arbitrage is profitable and pulls them back.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-oxanium text-xl font-semibold">Rules</h2>
            <p className="mt-3 leading-relaxed text-black/75 dark:text-white/75">
              The first person NVIDIA officially announces as successor wins; interim CEOs do not count. If nobody is announced by Jan 1, 2027 05:00 UTC, "No successor by Jan 1" wins. A person not listed counts as "Other". Anyone can report the answer on Reality.eth by posting a bond; a wrong answer can be challenged for 3.5 days.
            </p>
            <button type="button" className={`mt-3 text-sm ${linkClass}`} onClick={() => setShowRules((v) => !v)}>
              {showRules ? "Hide the exact question" : "Show the exact question"}
            </button>
            {showRules && <p className={`mt-3 text-sm leading-relaxed ${muted}`}>{cfg.marketName}</p>}
            <p className={`mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm ${muted}`}>
              <a className={linkClass} href={`${chain?.explorer}/address/${cfg.proposal}`} target="_blank" rel="noopener noreferrer">Market contract</a>
              <a className={linkClass} href={`${chain?.explorer}/address/${cfg.reality}`} target="_blank" rel="noopener noreferrer">Reality.eth</a>
              <a className={linkClass} href="https://github.com/futarchy-fi/futarchy/tree/master/multi-option" target="_blank" rel="noopener noreferrer">Source code</a>
            </p>
            <p className={`mt-4 text-sm ${muted}`}>Experimental. The contracts were reviewed adversarially but have not been audited. Only put in what you can afford to lose.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
