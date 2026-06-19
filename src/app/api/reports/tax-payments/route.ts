import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { inArray } from "drizzle-orm";

const ESTIMATED_CATEGORIES = ["Tax Payment – Estimated"];
const ANNUAL_CATEGORIES = ["Tax Payment – Annual Return"];

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(schema.transactions).where(
    inArray(schema.transactions.category, [...ESTIMATED_CATEGORIES, ...ANNUAL_CATEGORIES])
  );

  const byQuarter: Record<string, { federal: number; state: number; annual: number }> = {};
  const payments: Array<{ date: string; amount: number; description: string; kind: "estimated" | "annual"; agency: "federal" | "state" }> = [];

  for (const row of rows) {
    if (row.amount >= 0) continue;
    const amt = Math.abs(row.amount);
    const isAnnual = ANNUAL_CATEGORIES.includes(row.category ?? "");
    const desc = (row.originalDescription || "").toLowerCase();
    const agency = desc.includes("irs") || desc.includes("usataxpymt") || desc.includes("irs treas") ? "federal" : "state";

    const d = new Date(row.date + "T00:00:00");
    const y = d.getFullYear();
    const q = Math.floor(d.getMonth() / 3) + 1;
    const key = `${y}-Q${q}`;
    if (!byQuarter[key]) byQuarter[key] = { federal: 0, state: 0, annual: 0 };

    if (isAnnual) {
      byQuarter[key].annual += amt;
    } else {
      byQuarter[key][agency] += amt;
    }

    payments.push({ date: row.date, amount: amt, description: row.cleanDescription || row.originalDescription, kind: isAnnual ? "annual" : "estimated", agency });
  }

  return NextResponse.json({ byQuarter, payments });
}
