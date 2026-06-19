import { NextRequest, NextResponse } from "next/server";
import { getSession, deleteSession } from "@/lib/importSession";
import { suggestCategoryAndType } from "@/lib/categorize";
import { cleanDescription } from "@/lib/cleanDescription";
import { getDb, schema } from "@/db";

// Use the bank's own transaction type label to break ties when keyword rules return Uncategorized
function inferTypeWithBankHint(
  amount: number,
  category: string,
  bankType: string
): "Income" | "Expense" | "Transfer" | "Unknown" {
  const base = inferType(amount, category);
  if (base !== "Unknown") return base;
  const bt = bankType.toUpperCase();
  if (bt.includes("CREDIT") || bt.includes("DEPOSIT")) return "Income";
  if (bt.includes("DEBIT") || bt.includes("WITHDRAW") || bt.includes("ATM") || bt.includes("CHECK")) return "Expense";
  return base;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, skippedRowIndices = [] } = body as {
    sessionId: string;
    skippedRowIndices: number[];
  };

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  const skipped = new Set<number>(skippedRowIndices);
  const toImport = session.rows.filter((r) => !skipped.has(r.rowIndex));

  const db = getDb();
  const now = new Date().toISOString();

  // Create batch
  const [batch] = await db
    .insert(schema.importBatches)
    .values({
      sourceFile: session.sourceFile,
      importedAt: now,
      rowCount: toImport.length,
      status: "confirmed",
    })
    .returning();

  // Insert transactions
  for (const row of toImport) {
    const { category, type } = suggestCategoryAndType(row.description, row.amount);
    await db.insert(schema.transactions).values({
      date: row.date,
      originalDescription: row.description,
      cleanDescription: cleanDescription(row.description),
      amount: row.amount,
      rawAmount: row.rawAmount,
      type,
      account: row.account || null,
      category,
      notes: null,
      bankType: row.bankType || null,
      sourceFile: session.sourceFile,
      importBatchId: batch.id,
      reviewed: false,
      createdAt: now,
    });
  }

  deleteSession(sessionId);

  return NextResponse.json({
    batchId: batch.id,
    imported: toImport.length,
    skipped: skipped.size,
  });
}
