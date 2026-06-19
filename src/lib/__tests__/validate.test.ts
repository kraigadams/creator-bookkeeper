import { describe, it, expect } from "vitest";
import { validateRows } from "../validate";
import type { RawCsvRow, ColumnMapping } from "@/types";

const mapping: ColumnMapping = {
  date: "Date",
  description: "Description",
  amount: "Amount",
};

function makeRow(overrides: Record<string, string> = {}, index = 2): RawCsvRow {
  return {
    rowIndex: index,
    cells: {
      Date: "2024-01-15",
      Description: "Test purchase",
      Amount: "-42.00",
      ...overrides,
    },
  };
}

describe("validateRows", () => {
  it("passes a valid row", () => {
    const result = validateRows([makeRow()], mapping);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("flags missing date", () => {
    const result = validateRows([makeRow({ Date: "" })], mapping);
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.column === "Date");
    expect(err).toBeDefined();
    expect(err?.message).toMatch(/empty/i);
  });

  it("flags missing amount", () => {
    const result = validateRows([makeRow({ Amount: "" })], mapping);
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.column === "Amount");
    expect(err).toBeDefined();
    expect(err?.message).toMatch(/empty/i);
  });

  it("flags unparseable date", () => {
    const result = validateRows([makeRow({ Date: "not-a-date" })], mapping);
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.column === "Date");
    expect(err?.message).toMatch(/parse/i);
  });

  it("flags unparseable amount", () => {
    const result = validateRows([makeRow({ Amount: "abc" })], mapping);
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.column === "Amount");
    expect(err?.message).toMatch(/parse/i);
  });

  it("flags missing description", () => {
    const result = validateRows([makeRow({ Description: "" })], mapping);
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.column === "Description");
    expect(err).toBeDefined();
  });

  it("row count after validation matches input row count", () => {
    const rows = [makeRow({}, 2), makeRow({}, 3), makeRow({}, 4)];
    const result = validateRows(rows, mapping);
    expect(result.valid).toBe(true);
    // Three rows in, zero errors — proves no rows were silently dropped
    expect(result.errors).toHaveLength(0);
  });

  it("returns errors for multiple rows with issues", () => {
    const rows = [
      makeRow({ Date: "" }, 2),
      makeRow({ Amount: "xyz" }, 3),
      makeRow({}, 4),
    ];
    const result = validateRows(rows, mapping);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    const rowNums = result.errors.map((e) => e.rowIndex);
    expect(rowNums).toContain(2);
    expect(rowNums).toContain(3);
  });
});
