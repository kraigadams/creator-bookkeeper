import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import Papa from "papaparse";

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.transactions)
    .orderBy(schema.transactions.date);

  const csv = Papa.unparse(
    rows.map((r) => ({
      id: r.id,
      date: r.date,
      original_description: r.originalDescription,
      clean_description: r.cleanDescription,
      amount: r.amount,
      raw_amount: r.rawAmount,
      type: r.type,
      account: r.account,
      category: r.category,
      notes: r.notes,
      source_file: r.sourceFile,
      import_batch_id: r.importBatchId,
      reviewed: r.reviewed,
      created_at: r.createdAt,
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="ledger-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
