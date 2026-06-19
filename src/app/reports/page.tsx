"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface PnLData {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  incomeByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
  topIncomeSources: Record<string, number>;
  from: string | null;
  to: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function preset(id: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (id === "month") return { from: new Date(y, m, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) };
  if (id === "quarter") { const q = Math.floor(m / 3); return { from: new Date(y, q * 3, 1).toISOString().slice(0, 10), to: new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10) }; }
  if (id === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  return { from: "", to: "" };
}

// 2026 quarterly estimate due dates
const QUARTERS = [
  { label: "Q1", period: "Jan 1 – Mar 31", due: "2026-04-15", dueLabel: "Apr 15, 2026" },
  { label: "Q2", period: "Apr 1 – May 31", due: "2026-06-16", dueLabel: "Jun 16, 2026" },
  { label: "Q3", period: "Jun 1 – Aug 31", due: "2026-09-15", dueLabel: "Sep 15, 2026" },
  { label: "Q4", period: "Sep 1 – Dec 31", due: "2027-01-15", dueLabel: "Jan 15, 2027" },
];

function calcEstimates(netProfit: number) {
  // Half of SE tax is deductible
  const seTaxRate = 0.9235 * 0.153;
  const halfSE = netProfit * seTaxRate / 2;
  const taxableIncome = netProfit - halfSE;

  // Federal income tax — 2026 single filer brackets (approx)
  let fedIncomeTax = 0;
  const brackets = [
    { limit: 11925, rate: 0.10 },
    { limit: 48475, rate: 0.12 },
    { limit: 103350, rate: 0.22 },
    { limit: 197300, rate: 0.24 },
    { limit: 250525, rate: 0.32 },
    { limit: 626350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ];
  let prev = 0;
  for (const b of brackets) {
    if (taxableIncome <= prev) break;
    fedIncomeTax += (Math.min(taxableIncome, b.limit) - prev) * b.rate;
    prev = b.limit;
  }

  const seTax = netProfit * seTaxRate;
  const fedTotal = fedIncomeTax + seTax;
  const nyRate = taxableIncome > 215400 ? 0.0685 : taxableIncome > 161550 ? 0.0645 : taxableIncome > 80650 ? 0.0585 : 0.0490;
  const nyTotal = taxableIncome * nyRate;

  return {
    seTax,
    fedIncomeTax,
    fedTotal,
    nyTotal,
    totalEstimated: fedTotal + nyTotal,
    fedPerQuarter: fedTotal / 4,
    nyPerQuarter: nyTotal / 4,
  };
}

function ytdRange() {
  const now = new Date();
  const y = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return { from: `${y}-01-01`, to: `${y}-${mm}-${dd}` };
}

const SCHEDULE_C_LABELS: Record<string, string> = {
  "Advertising": "Advertising (Line 8)",
  "Contractor / Editor": "Contract Labor (Line 11)",
  "Insurance": "Insurance (Line 15)",
  "Internet / Phone": "Utilities / Phone (Line 25)",
  "Professional Services": "Legal & Professional (Line 17)",
  "Office / Rent": "Rent / Office (Line 20b)",
  "Supplies": "Supplies (Line 22)",
  "Taxes & Licenses": "Taxes & Licenses (Line 23)",
  "Travel": "Travel (Line 24a)",
  "Meals & Entertainment": "Meals 50% (Line 24b)",
  "Software": "Other Expenses — Software",
  "Gear / Equipment": "Other Expenses — Gear & Equipment",
  "Bank Fees": "Other Expenses — Bank Fees",
  "Subscriptions": "Other Expenses — Subscriptions",
};

export default function ReportsPage() {
  const defaultRange = ytdRange();
  const [from, setFrom] = useState<string>(defaultRange.from);
  const [to, setTo] = useState<string>(defaultRange.to);
  const [data, setData] = useState<PnLData | null>(null);
  const [priorData, setPriorData] = useState<PnLData | null>(null);
  const [taxPayments, setTaxPayments] = useState<Record<string, { federal: number; state: number }>>({});
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async (f: string, t: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    if (t) params.set("to", t);

    // Build matching prior-year range for comparison
    const priorParams = new URLSearchParams();
    if (f && t) {
      const fromDate = new Date(f);
      const toDate = new Date(t);
      priorParams.set("from", new Date(fromDate.getFullYear() - 1, fromDate.getMonth(), fromDate.getDate()).toISOString().slice(0, 10));
      priorParams.set("to", new Date(toDate.getFullYear() - 1, toDate.getMonth(), toDate.getDate()).toISOString().slice(0, 10));
    }

    const fetches: Promise<Response>[] = [
      fetch(`/api/reports/pnl?${params}`),
      fetch(`/api/reports/tax-payments`),
    ];
    if (priorParams.toString()) fetches.push(fetch(`/api/reports/pnl?${priorParams}`));

    const [res, taxRes, priorRes] = await Promise.all(fetches);
    setData(await res.json());
    const taxJson = await taxRes.json();
    setTaxPayments(taxJson.byQuarter ?? {});
    setPriorData(priorRes ? await priorRes.json() : null);
    setLoading(false);
  }, []);

  useEffect(() => { loadReport(from, to); }, [from, to, loadReport]);

  function exportScheduleC() {
    if (!data) return;
    const rows: string[][] = [
      ["Schedule C Category", "Line", "Amount"],
    ];
    const sorted = Object.entries(data.expensesByCategory).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    for (const [cat, total] of sorted) {
      const line = SCHEDULE_C_LABELS[cat] ?? "Other Expenses";
      rows.push([cat, line, Math.abs(total).toFixed(2)]);
    }
    rows.push([]);
    rows.push(["Total Expenses", "", Math.abs(data.totalExpenses).toFixed(2)]);
    rows.push(["Total Income", "", data.totalIncome.toFixed(2)]);
    rows.push(["Net Profit", "", data.netProfit.toFixed(2)]);

    const range = from && to ? `${from}_to_${to}` : "all";
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-c-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyPreset(id: string) {
    if (id === "all") { setFrom(""); setTo(""); return; }
    const { from: f, to: t } = preset(id);
    setFrom(f); setTo(t);
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  // For quarterly estimates always use YTD data (the current view when showing YTD, else same)
  const ytdData = data;
  const annualizedNet = ytdData ? (ytdData.netProfit / dayOfYear) * 365 : 0;
  const estimates = ytdData ? calcEstimates(Math.max(annualizedNet, 0)) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-widest mb-0.5">Kraig Adams</p>
          <h1 className="text-2xl font-bold">Profit & Loss</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm items-center">
          {["all", "month", "quarter", "year"].map((p) => (
            <button key={p} onClick={() => applyPreset(p)} className="btn-secondary text-sm">
              {p === "all" ? "All time" : p === "month" ? "This month" : p === "quarter" ? "This quarter" : "This year"}
            </button>
          ))}
          <input type="date" className="border border-stone-300 dark:border-stone-600 rounded px-2 py-1 text-sm dark:bg-stone-800 dark:text-stone-100" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-stone-400">–</span>
          <input type="date" className="border border-stone-300 dark:border-stone-600 rounded px-2 py-1 text-sm dark:bg-stone-800 dark:text-stone-100" value={to} onChange={(e) => setTo(e.target.value)} />
          {data && <button onClick={exportScheduleC} className="btn-secondary text-sm">Schedule C CSV</button>}
          <Link href="/" className="btn-secondary text-sm">← Ledger</Link>
        </div>
      </div>

      {loading && <p className="text-stone-400">Loading…</p>}

      {data && !loading && (
        <div className="space-y-8">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="Total Income" value={fmt(data.totalIncome)} color="green" prior={priorData?.totalIncome} priorLabel="prior yr" />
            <SummaryCard label="Total Expenses" value={fmt(Math.abs(data.totalExpenses))} color="red" prior={priorData ? Math.abs(priorData.totalExpenses) : undefined} priorLabel="prior yr" invertDelta />
            <SummaryCard label="Net Profit" value={fmt(data.netProfit)} color={data.netProfit >= 0 ? "green" : "red"} prior={priorData?.netProfit} priorLabel="prior yr" />
          </div>

          {/* Income + Expenses side by side */}
          {(Object.keys(data.incomeByCategory).length > 0 || Object.keys(data.expensesByCategory).length > 0) && (
            <div className="grid grid-cols-2 gap-6">
              <section>
                <h2 className="font-semibold mb-2 text-stone-700 dark:text-stone-300 text-sm uppercase tracking-wide">Income</h2>
                {Object.keys(data.topIncomeSources ?? {}).length > 0
                  ? <CategoryTable rows={data.topIncomeSources} />
                  : Object.keys(data.incomeByCategory).length > 0
                  ? <CategoryTable rows={data.incomeByCategory} />
                  : <p className="text-stone-400 text-sm">None</p>}
              </section>
              <section>
                <h2 className="font-semibold mb-2 text-stone-700 dark:text-stone-300 text-sm uppercase tracking-wide">Expenses <span className="font-normal text-stone-400 normal-case">(Schedule C)</span></h2>
                {Object.keys(data.expensesByCategory).length > 0
                  ? <CategoryTable rows={data.expensesByCategory} abs scheduleC />
                  : <p className="text-stone-400 text-sm">None</p>}
              </section>
            </div>
          )}

          {Object.keys(data.incomeByCategory).length === 0 && Object.keys(data.expensesByCategory).length === 0 && (
            <p className="text-stone-400 text-sm">No transactions in selected range.</p>
          )}

          {/* Quarterly Estimates */}
          {data && (
            <section>
              <h2 className="font-semibold mb-1 text-stone-700 dark:text-stone-300">
                {new Date().getFullYear()} Quarterly Estimates
                <span className="text-xs font-normal text-stone-400 ml-2">
                  YTD net {fmt(data.netProfit)} → annualized {fmt(annualizedNet)}
                </span>
              </h2>
              {annualizedNet <= 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 mb-3">
                  Net profit is negative or zero — estimates show $0. Check categorization or switch to YTD view.
                </p>
              )}
              <p className="text-xs text-stone-400 mb-3">Annualized from {dayOfYear} days of data. Consult your accountant for exact amounts.</p>

              {/* Tax breakdown */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-4 py-3">
                  <p className="text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1">Federal (Annual est.)</p>
                  <p className="text-lg font-bold text-stone-900 dark:text-stone-100">{fmt(estimates.fedTotal)}</p>
                  <p className="text-xs text-stone-400 mt-1">SE tax {fmt(estimates.seTax)} + income tax {fmt(estimates.fedIncomeTax)}</p>
                </div>
                <div className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-4 py-3">
                  <p className="text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1">New York State (Annual est.)</p>
                  <p className="text-lg font-bold text-stone-900 dark:text-stone-100">{fmt(estimates.nyTotal)}</p>
                  <p className="text-xs text-stone-400 mt-1">Based on NY marginal rate</p>
                </div>
              </div>

              {/* Quarter schedule */}
              <div className="border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Quarter</th>
                      <th className="px-3 py-2 text-left">Period</th>
                      <th className="px-3 py-2 text-left">Due Date</th>
                      <th className="px-3 py-2 text-right">Est. Federal</th>
                      <th className="px-3 py-2 text-right">Est. NY State</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {QUARTERS.map((q) => {
                      const isPast = q.due < today;
                      const isNext = !isPast && QUARTERS.filter(x => x.due >= today)[0]?.label === q.label;
                      const year = new Date().getFullYear();
                      const paidKey = `${year}-${q.label}`;
                      const paid = taxPayments[paidKey] ?? { federal: 0, state: 0, annual: 0 };
                      const totalPaid = paid.federal + paid.state;
                      const totalEst = estimates.fedPerQuarter + estimates.nyPerQuarter;
                      const remaining = Math.max(totalEst - totalPaid, 0);
                      const overpaid = totalPaid > totalEst;
                      return (
                        <tr key={q.label} className={`border-t border-stone-100 dark:border-stone-800 ${isNext ? "bg-blue-50 dark:bg-blue-950" : ""}`}>
                          <td className="px-3 py-2 font-medium">
                            {q.label}
                            {isNext && <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5">Next due</span>}
                            {isPast && <span className="ml-2 text-xs text-stone-300 dark:text-stone-600">Past</span>}
                          </td>
                          <td className="px-3 py-2 text-stone-500 dark:text-stone-400">{q.period}</td>
                          <td className={`px-3 py-2 font-medium ${isNext ? "text-blue-700 dark:text-blue-300" : isPast ? "text-stone-300 dark:text-stone-600" : "text-stone-700 dark:text-stone-300"}`}>
                            {q.dueLabel}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-stone-600 dark:text-stone-400">{fmt(estimates.fedPerQuarter)}</td>
                          <td className="px-3 py-2 text-right font-mono text-stone-600 dark:text-stone-400">{fmt(estimates.nyPerQuarter)}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            <div className="flex flex-col items-end gap-0.5">
                              {totalPaid > 0 && <span className="text-green-600 dark:text-green-400 font-medium">{fmt(totalPaid)}</span>}
                              {(paid as {annual?: number}).annual ? (
                                <span className="text-xs text-stone-400" title="Annual return payment — not counted toward estimates">
                                  + {fmt((paid as {annual?: number}).annual!)} annual
                                </span>
                              ) : null}
                              {totalPaid === 0 && !(paid as {annual?: number}).annual && <span className="text-stone-300 dark:text-stone-600">—</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {overpaid
                              ? <span className="text-green-600 dark:text-green-400">Overpaid {fmt(totalPaid - totalEst)}</span>
                              : totalPaid > 0 && remaining === 0
                              ? <span className="text-green-600 dark:text-green-400">✓ Paid</span>
                              : <span className={isPast && remaining > 0 ? "text-red-500 dark:text-red-400" : ""}>{fmt(remaining)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-stone-400 mt-2">Pay federal estimates at <strong>irs.gov/payments</strong> · NY state at <strong>tax.ny.gov</strong></p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, prior, priorLabel, invertDelta }: {
  label: string; value: string; color: "green" | "red";
  prior?: number; priorLabel?: string; invertDelta?: boolean;
}) {
  let delta: { pct: number; up: boolean; good: boolean } | null = null;
  if (prior !== undefined && prior !== 0) {
    const current = parseFloat(value.replace(/[^0-9.-]/g, ""));
    const pct = ((current - prior) / Math.abs(prior)) * 100;
    const up = pct >= 0;
    delta = { pct: Math.abs(pct), up, good: invertDelta ? !up : up };
  }
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-4 py-4">
      <p className="text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${color === "green" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
        {value}
        {delta && (
          <span className={`text-xs font-medium ml-2 ${delta.good ? "text-green-500 dark:text-green-400" : "text-red-400"}`}>
            {delta.up ? "▲" : "▼"}{delta.pct.toFixed(0)}%
          </span>
        )}
      </p>
      {prior !== undefined && (
        <p className="text-xs text-stone-400 mt-1">{priorLabel}: {fmt(prior < 0 ? Math.abs(prior) : prior)}</p>
      )}
    </div>
  );
}

function CategoryTable({ rows, abs, scheduleC }: { rows: Record<string, number>; abs?: boolean; scheduleC?: boolean }) {
  const sorted = Object.entries(rows).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const fmtAmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(abs ? Math.abs(n) : n);
  return (
    <div className="border border-stone-200 dark:border-stone-700 rounded overflow-hidden text-sm">
      <table className="w-full">
        <tbody>
          {sorted.map(([cat, total]) => (
            <tr key={cat} className="border-t border-stone-100 dark:border-stone-800 first:border-0">
              <td className="px-3 py-2">
                {scheduleC && SCHEDULE_C_LABELS[cat] ? (
                  <span>{cat} <span className="text-xs text-stone-400 ml-1">{SCHEDULE_C_LABELS[cat]}</span></span>
                ) : cat}
              </td>
              <td className="px-3 py-2 text-right font-mono">{fmtAmt(total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
