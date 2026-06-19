import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { suggestCategoryAndType } from "@/lib/categorize";

// In-memory snapshot for undo (until next recategorize or server restart)
let undoSnapshot: Array<{ id: number; category: string | null; type: string }> | null = null;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const onlyUncategorized = body.onlyUncategorized ?? true;
  const db = getDb();

  const rows = await db.select({
    id: schema.transactions.id,
    date: schema.transactions.date,
    originalDescription: schema.transactions.originalDescription,
    amount: schema.transactions.amount,
    category: schema.transactions.category,
    type: schema.transactions.type,
    reviewed: schema.transactions.reviewed,
  }).from(schema.transactions);

  // Save full snapshot for undo
  undoSnapshot = rows.map((r) => ({ id: r.id, category: r.category, type: r.type }));

  const changedRows: Array<{ id: number; date: string; description: string; amount: number; oldCategory: string | null; newCategory: string; oldType: string; newType: string }> = [];

  for (const row of rows) {
    if (row.reviewed) continue;
    if (onlyUncategorized && row.category !== "Uncategorized" && row.category !== null) continue;
    const { category: newCategory, type: newType } = suggestCategoryAndType(row.originalDescription, row.amount);
    if (newCategory !== row.category || newType !== row.type) {
      await db.update(schema.transactions)
        .set({ category: newCategory, type: newType })
        .where(eq(schema.transactions.id, row.id));
      changedRows.push({
        id: row.id,
        date: row.date,
        description: row.originalDescription,
        amount: row.amount,
        oldCategory: row.category,
        newCategory,
        oldType: row.type,
        newType,
      });
    }
  }

  return NextResponse.json({ changed: changedRows.length, total: rows.length, changedRows });
}

export async function DELETE() {
  if (!undoSnapshot) {
    return NextResponse.json({ error: "No undo snapshot available" }, { status: 400 });
  }
  const db = getDb();
  for (const row of undoSnapshot) {
    await db.update(schema.transactions)
      .set({ category: row.category, type: row.type })
      .where(eq(schema.transactions.id, row.id));
  }
  const count = undoSnapshot.length;
  undoSnapshot = null;
  return NextResponse.json({ restored: count });
}
