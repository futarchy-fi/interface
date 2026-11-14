// History of every option of a multi-option market: its chance, or the company token's price under it.
// One step line per option, from the candle indexer; the last point is the live on-chain value.
import React, { useEffect, useRef, useState } from "react";
import { createChart, LineSeries, LineType } from "lightweight-charts";

const CANDLES_URL = "https://api.futarchy.fi/candles/graphql";
const REFRESH_MS = 60000;
// Categorical palette that stays readable on light and dark backgrounds.
export const OPTION_COLORS = ["#2563eb", "#d97706", "#059669", "#db2777", "#7c3aed", "#6b7280", "#0891b2", "#dc2626", "#65a30d", "#9333ea", "#ea580c", "#0d9488", "#4f46e5", "#be123c", "#a16207", "#334155"];

async function fetchCandles(cfg, view, period) {
  const fields = cfg.options
    .map((o) => {
      const pool = (view === "probability" ? o.probPool : o.pricePool).address.toLowerCase();
      return `o${o.index}: candles(first: 1000, orderBy: periodStartUnix, orderDirection: desc, where: {pool: "${pool}", period: ${period}}) { periodStartUnix close }`;
    })
    .join("\n");
  const response = await fetch(`${CANDLES_URL}?chainId=${cfg.chainId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: `{ ${fields} }` }),
  });
  const json = await response.json();
  if (!json.data) throw new Error(json.errors?.[0]?.message || "No candle data");
  return json.data;
}

export default function MultiOptionChart({ cfg, market, view, selected, dark }) {
  const container = useRef(null);
  const chart = useRef(null);
  const series = useRef({});
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  // Five-minute candles while the market is young, hourly after a week.
  const period = Date.now() / 1000 - cfg.createdAt < 7 * 86400 ? 300 : 3600;

  useEffect(() => {
    let stale = false;
    const load = async () => {
      try {
        const data = await fetchCandles(cfg, view, period);
        if (!stale) { setHistory({ view, data }); setError(null); }
      } catch (e) {
        if (!stale) setError("Price history is unavailable right now.");
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { stale = true; clearInterval(timer); };
  }, [cfg, view, period]);

  useEffect(() => {
    if (!container.current) return undefined;
    const text = dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";
    const grid = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
    const c = createChart(container.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: text, attributionLogo: false },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      handleScroll: { vertTouchDrag: false },
    });
    chart.current = c;
    series.current = {};
    cfg.options.forEach((o, i) => {
      series.current[o.index] = c.addSeries(LineSeries, {
        color: OPTION_COLORS[i % OPTION_COLORS.length],
        lineType: LineType.WithSteps,
        priceLineVisible: false,
        lastValueVisible: false,
      });
    });
    return () => { c.remove(); chart.current = null; series.current = {}; };
  }, [cfg, dark]);

  useEffect(() => {
    if (!chart.current || !history || history.view !== view) return;
    const now = Math.floor(Date.now() / 1000);
    cfg.options.forEach((o) => {
      const s = series.current[o.index];
      if (!s) return;
      const scale = view === "probability" ? 100 : 1;
      const points = [...(history.data[`o${o.index}`] || [])]
        .sort((a, b) => a.periodStartUnix - b.periodStartUnix)
        .map((c) => ({ time: Number(c.periodStartUnix), value: Number(c.close) * scale }));
      const live = market?.options.find((x) => x.index === o.index);
      if (live && (!points.length || now > points[points.length - 1].time)) {
        points.push({ time: now, value: (view === "probability" ? live.probability : live.price) * scale });
      }
      s.setData(points);
      s.applyOptions({
        lineWidth: o.index === selected ? 3 : 1.5,
        // Never zoom in so far that noise looks like a move: show at least 1% of the price, or 2 points of chance.
        autoscaleInfoProvider: (original) => {
          const info = original();
          if (!info) return info;
          const { minValue, maxValue } = info.priceRange;
          const mid = (minValue + maxValue) / 2;
          const half = Math.max(((maxValue - minValue) / 2) * 1.1, view === "probability" ? 1 : mid * 0.005);
          return { ...info, priceRange: { minValue: view === "probability" ? Math.max(0, mid - half) : mid - half, maxValue: mid + half } };
        },
        priceFormat: view === "probability"
          ? { type: "custom", minMove: 0.01, formatter: (v) => `${v.toFixed(1)}%` }
          : { type: "custom", minMove: 0.01, formatter: (v) => `$${v.toFixed(2)}` },
      });
    });
    chart.current.timeScale().fitContent();
  }, [history, market, view, selected, cfg]);

  return (
    <div>
      <div ref={container} className="h-64 w-full sm:h-80" />
      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {cfg.options.map((o, i) => (
          <span key={o.index} className={`inline-flex items-center gap-1.5 ${o.index === selected ? "font-semibold" : "opacity-70"}`}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }} />
            {o.name}
          </span>
        ))}
      </div>
    </div>
  );
}
