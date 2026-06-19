import { describe, it, expect } from "vitest";
import Papa from "papaparse";

interface LedgerRow {
  id: number;
  date: string;
  originalDescription: string;
  cleanDescription: string | null;
  amount: number;
  rawAmount: string;
  type: string;
  account: string | null;
  category: string | null;
  notes: string | null;
  sourceFile: string;
  importBatchId: number;
  reviewed: boolean;
  createdAt: string;
}

function buildCsvExport(rows: LedgerRow[]): string {
  return Papa.unparse(
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
      reviewed: r.reviewed ? "Yes" : "No",
      created_at: r.createdAt,
    }))
  );
}

function parseCsv(csv: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true });
  return result.data;
}

const sampleRows: LedgerRow[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  date: `2024-0${Math.floor(i / 10) + 1}-${String((i % 28) + 1).padStart(2, "0")}`,
  originalDescription: `Transaction ${i + 1}`,
  cleanDescription: `Transaction ${i + 1}`,
  amount: i % 2 === 0 ? 100 + i : -(50 + i),
  rawAmount: String(i % 2 === 0 ? 100 + i : -(50 + i)),
  type: i % 2 === 0 ? "Income" : "Expense",
  account: "Checking",
  category: i % 2 === 0 ? "Business Income" : "Meals",
  notes: null,
  sourceFile: "test.csv",
  importBatchId: 1,
  reviewed: false,
  createdAt: new Date().toISOString(),
}));

describe("CSV export", () => {
  it("exports all rows with no omissions", () => {
    const csv = buildCsvExport(sampleRows);
    const parsed = parseCsv(csv);
    expect(parsed).toHaveLength(sampleRows.length);
  });

  it("preserves every id in order", () => {
    const csv = buildCsvExport(sampleRows);
    const parsed = parseCsv(csv);
    const exportedIds = parsed.map((r) => Number(r.id));
    const originalIds = sampleRows.map((r) => r.id);
    expect(exportedIds).toEqual(originalIds);
  });

  it("preserves amount values", () => {
    const csv = buildCsvExport(sampleRows);
    const parsed = parseCsv(csv);
    sampleRows.forEach((row, i) => {
      expect(Number(parsed[i].amount)).toBeCloseTo(row.amount, 5);
    });
  });

  it("includes all required columns", () => {
    const csv = buildCsvExport(sampleRows.slice(0, 1));
    const parsed = parseCsv(csv);
    const keys = Object.keys(parsed[0]);
    for (const col of [
      "id", "date", "original_description", "amount", "raw_amount",
      "type", "category", "source_file", "import_batch_id", "reviewed", "created_at",
    ]) {
      expect(keys).toContain(col);
    }
  });
});
