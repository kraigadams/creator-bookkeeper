import { NextRequest, NextResponse } from "next/server";
import { validateRows, resolveAmount } from "@/lib/validate";
import { suggestCategoryAndType } from "@/lib/categorize";
import { createSession } from "@/lib/importSession";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import type { RawCsvRow, ColumnMapping, NormalizedRow } from "@/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rows, mapping, filename, accountName, invertAmounts } = body as {
    rows: RawCsvRow[];
    mapping: ColumnMapping;
    filename: string;
    accountName?: string;
    invertAmounts?: boolean;
  };

  if (!rows || !mapping || !filename) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate
  const validation = validateRows(rows, mapping);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed", validationErrors: validation.errors },
      { status: 422 }
    );
  }

  // Load existing transactions for duplicate detection
  const db = getDb();
  const existing = await db
    .select({
      id: schema.transactions.id,
      date: schema.transactions.date,
      amount: schema.transactions.amount,
      originalDescription: schema.transactions.originalDescription,
    })
    .from(schema.transactions);

  const dupKey = (date: string, amount: number, desc: string) =>
    `${date}|${amount}|${desc.toLowerCase().trim()}`;

  const existingKeys = new Map<string, number>();
  for (const t of existing) {
    existingKeys.set(dupKey(t.date, t.amount, t.originalDescription), t.id);
  }

  // Normalize rows
  const normalized: NormalizedRow[] = rows.map((row) => {
    const dateRaw = row.cells[mapping.date]?.trim() ?? "";
    const desc = row.cells[mapping.description]?.trim() ?? "";
    const { amount: rawAmt, rawAmount } = resolveAmount(row.cells, mapping);
    const amount = invertAmounts ? -rawAmt : rawAmt;
    const account = (mapping.account ? row.cells[mapping.account]?.trim() : "") || accountName || "";
    const bankType = mapping.bankType ? row.cells[mapping.bankType]?.trim() ?? "" : "";

    const date = new Date(dateRaw).toISOString().slice(0, 10);
    const key = dupKey(date, amount, desc);
    const dupId = existingKeys.get(key);

    const { category, type } = suggestCategoryAndType(desc, amount);

    return {
      rowIndex: row.rowIndex,
      date,
      description: desc,
      amount,
      rawAmount,
      account,
      bankType,
      category,
      type,
      isDuplicate: dupId !== undefined,
      duplicateOf: dupId,
    };
  });

  const sessionId = createSession(filename, normalized);

  return NextResponse.json({
    sessionId,
    rows: normalized,
    totalRows: normalized.length,
  });
}
