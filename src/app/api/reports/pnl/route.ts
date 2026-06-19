import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { and, gte, lte, gt, lt } from "drizzle-orm";

const SOURCE_BUCKETS: Array<{ label: string; keywords: string[] }> = [
  { label: "YouTube / Ad Revenue", keywords: ["google", "adsense", "youtube"] },
  { label: "Affiliate Income", keywords: ["avant link", "avantlink", "impact radius", "shareasale", "rakuten", "skimlinks", "cj affiliate", "linktree", "amazon associates"] },
  { label: "Amazon Associates", keywords: ["amazon.com", "amazon servi", "amazon europe", "amazon japan"] },
  { label: "Sponsorship / Brand Deals", keywords: ["ayzenberg", "pitchblend", "icon talents", "fiorellapc", "saily", "facebook payout", "meta payout", "stripe"] },
  { label: "Wire / Direct Deposit", keywords: ["fedwire", "foreign remittance", "real time", "incoming wire", "fedwire credit"] },
  { label: "Remote Deposit", keywords: ["remote online deposit"] },
  { label: "Transfer from Savings", keywords: ["transfer from chk", "transfer from sav", "online transfer from"] },
];

function bucketSource(desc: string): string {
  const lower = desc.toLowerCase();
  for (const bucket of SOURCE_BUCKETS) {
    if (bucket.keywords.some((kw) => lower.includes(kw))) return bucket.label;
  }
  return "Other Income";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const db = getDb();
  const conditions = [];
  if (from) conditions.push(gte(schema.transactions.date, from));
  if (to) conditions.push(lte(schema.transactions.date, to));

  const rows = await db
    .select()
    .from(schema.transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  let totalIncome = 0;
  let totalExpenses = 0;
  const incomeByCategory: Record<string, number> = {};
  const expensesByCategory: Record<string, number> = {};
  const incomeBySource: Record<string, number> = {};

  for (const row of rows) {
    if (row.type === "Income") {
      totalIncome += row.amount;
      const cat = row.category ?? "Uncategorized";
      incomeByCategory[cat] = (incomeByCategory[cat] ?? 0) + row.amount;
      const rawName = (row.cleanDescription || row.originalDescription).trim();
      const source = bucketSource(rawName);
      incomeBySource[source] = (incomeBySource[source] ?? 0) + row.amount;
    } else if (row.type === "Expense") {
      totalExpenses += row.amount;
      const cat = row.category ?? "Uncategorized";
      expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + row.amount;
    }
  }

  const topIncomeSources = Object.entries(incomeBySource)
    .sort((a, b) => b[1] - a[1])
    .reduce<Record<string, number>>((acc, [k, v]) => { acc[k] = v; return acc; }, {});

  return NextResponse.json({
    totalIncome,
    totalExpenses,
    netProfit: totalIncome + totalExpenses,
    incomeByCategory,
    expensesByCategory,
    topIncomeSources,
    from,
    to,
  });
}
