import type { RawCsvRow, ColumnMapping, ValidationError, ValidationResult } from "@/types";

function parseDate(val: string): boolean {
  const d = new Date(val);
  return !isNaN(d.getTime());
}

export function parseAmount(val: string): number {
  return Number(val.replace(/[$,\s]/g, ""));
}

function isValidAmount(val: string): boolean {
  const cleaned = val.replace(/[$,\s]/g, "");
  return cleaned !== "" && !isNaN(Number(cleaned));
}

export function validateRows(
  rows: RawCsvRow[],
  mapping: ColumnMapping
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const row of rows) {
    const ri = row.rowIndex;

    const dateVal = row.cells[mapping.date]?.trim() ?? "";
    if (!dateVal) {
      errors.push({ rowIndex: ri, column: mapping.date, message: "Date is empty" });
    } else if (!parseDate(dateVal)) {
      errors.push({ rowIndex: ri, column: mapping.date, message: `Cannot parse date: "${dateVal}"` });
    }

    const descVal = row.cells[mapping.description]?.trim() ?? "";
    if (!descVal) {
      errors.push({ rowIndex: ri, column: mapping.description, message: "Description is empty" });
    }

    if (mapping.amount) {
      const amtVal = row.cells[mapping.amount]?.trim() ?? "";
      if (!amtVal) {
        errors.push({ rowIndex: ri, column: mapping.amount, message: "Amount is empty" });
      } else if (!isValidAmount(amtVal)) {
        errors.push({ rowIndex: ri, column: mapping.amount, message: `Cannot parse amount: "${amtVal}"` });
      }
    } else if (mapping.debit || mapping.credit) {
      const debitVal = mapping.debit ? row.cells[mapping.debit]?.trim() ?? "" : "";
      const creditVal = mapping.credit ? row.cells[mapping.credit]?.trim() ?? "" : "";
      const combined = debitVal || creditVal;
      if (!combined) {
        errors.push({ rowIndex: ri, column: "debit/credit", message: "Both debit and credit are empty" });
      } else {
        if (debitVal && !isValidAmount(debitVal)) {
          errors.push({ rowIndex: ri, column: mapping.debit!, message: `Cannot parse debit: "${debitVal}"` });
        }
        if (creditVal && !isValidAmount(creditVal)) {
          errors.push({ rowIndex: ri, column: mapping.credit!, message: `Cannot parse credit: "${creditVal}"` });
        }
      }
    } else {
      errors.push({ rowIndex: ri, column: "amount", message: "No amount column mapped" });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function resolveAmount(
  row: Record<string, string>,
  mapping: ColumnMapping
): { amount: number; rawAmount: string } {
  if (mapping.amount) {
    const raw = row[mapping.amount]?.trim() ?? "";
    return { amount: parseAmount(raw), rawAmount: raw };
  }
  const creditRaw = mapping.credit ? row[mapping.credit]?.trim() ?? "" : "";
  const debitRaw = mapping.debit ? row[mapping.debit]?.trim() ?? "" : "";
  const credit = creditRaw ? parseAmount(creditRaw) : 0;
  const debit = debitRaw ? parseAmount(debitRaw) : 0;
  const amount = credit - debit;
  return { amount, rawAmount: `credit:${creditRaw}|debit:${debitRaw}` };
}
