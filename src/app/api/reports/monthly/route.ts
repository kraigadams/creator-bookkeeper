import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { and, gte, lte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ?? new Date().getFullYear().toString();

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.transactions)
    .where(and(gte(schema.transactions.date, `${year}-01-01`), lte(schema.transactions.date, `${year}-12-31`)));

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: new Date(2000, i).toLocaleString("en-US", { month: "short" }),
    income: 0,
    expenses: 0,
  }));

  for (const row of rows) {
    const m = parseInt(row.date.slice(5, 7)) - 1;
    if (row.type === "Income") months[m].income += row.amount;
    else if (row.type === "Expense") months[m].expenses += Math.abs(row.amount);
  }

  return NextResponse.json({ year, months });
}
