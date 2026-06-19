import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import * as XLSX from "xlsx";

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.transactions)
    .orderBy(schema.transactions.date);

  const data = rows.map((r) => ({
    ID: r.id,
    Date: r.date,
    "Original Description": r.originalDescription,
    "Clean Description": r.cleanDescription,
    Amount: r.amount,
    "Raw Amount": r.rawAmount,
    Type: r.type,
    Account: r.account,
    Category: r.category,
    Notes: r.notes,
    "Source File": r.sourceFile,
    "Import Batch ID": r.importBatchId,
    Reviewed: r.reviewed ? "Yes" : "No",
    "Created At": r.createdAt,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Ledger");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ledger-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
