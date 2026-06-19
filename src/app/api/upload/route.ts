import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

export const config = { api: { bodyParser: false } };

// Chase and some other banks prepend metadata lines before the real header row.
// Find the first line that looks like a CSV header (contains a comma and recognizable column words).
function findHeaderRow(text: string): string {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || !line.includes(",")) continue;
    const lower = line.toLowerCase();
    // Accept this line as the header if it contains at least one known column keyword
    const knownKeywords = [
      "date", "description", "amount", "debit", "credit",
      "memo", "payee", "balance", "type", "category",
    ];
    if (knownKeywords.some((kw) => lower.includes(kw))) {
      // Return from this line onward
      return lines.slice(i).join("\n");
    }
  }
  // Fall back to full text
  return text;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const rawText = await file.text();
  const filename = file.name;

  const text = findHeaderRow(rawText);

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  // PapaParse reports errors but still parses most rows — only hard-fail if
  // we got zero rows and zero fields (truly unreadable file).
  const rawHeaders: string[] = result.meta.fields ?? [];
  if (rawHeaders.length === 0) {
    return NextResponse.json(
      { error: "CSV parse error — no columns detected", details: result.errors },
      { status: 400 }
    );
  }

  // Check for duplicate column names
  const headerSet = new Set<string>();
  const duplicateHeaders: string[] = [];
  for (const h of rawHeaders) {
    if (headerSet.has(h)) duplicateHeaders.push(h);
    headerSet.add(h);
  }
  if (duplicateHeaders.length > 0) {
    return NextResponse.json(
      {
        error: "Duplicate column names detected. Please fix your CSV before importing.",
        duplicateHeaders,
      },
      { status: 400 }
    );
  }

  const rows = result.data.map((cells, i) => ({ rowIndex: i + 2, cells }));

  // Auto-detect credit card statements (positive = charge, needs sign flip)
  const isCreditCard = detectCreditCard(filename, rawHeaders, result.data);

  return NextResponse.json({
    filename,
    headers: rawHeaders,
    rows,
    totalRows: rows.length,
    isCreditCard,
  });
}

function detectCreditCard(filename: string, headers: string[], rows: Record<string, string>[]): boolean {
  // Filename hints
  const fn = filename.toLowerCase();
  if (/amex|american.express|credit.card|mastercard|discover/.test(fn)) return true;

  // AMEX-specific column headers
  const headerStr = headers.join(" ").toLowerCase();
  if (headerStr.includes("extended details") || headerStr.includes("appears on your statement")) return true;

  // Pattern: if we see payment confirmation rows, it's a credit card
  const descCol = headers.find((h) => /description|memo|payee/i.test(h));
  if (descCol) {
    const paymentPattern = /payment.*thank you|autopay payment|online payment|payment received/i;
    if (rows.some((r) => paymentPattern.test(r[descCol] ?? ""))) return true;
  }

  // Pattern: no debit/credit split columns AND a plain "amount" column where
  // most non-payment rows are positive (bank checking is mostly negative for debits)
  const amountCol = headers.find((h) => /^amount$/i.test(h));
  const hasDebitCredit = headers.some((h) => /^(debit|credit)$/i.test(h));
  if (amountCol && !hasDebitCredit && rows.length >= 3) {
    const amounts = rows.map((r) => parseFloat((r[amountCol] ?? "0").replace(/[$,]/g, ""))).filter((n) => !isNaN(n));
    const positiveCount = amounts.filter((n) => n > 0).length;
    // If >70% of amounts are positive, likely a credit card (charges show as positive)
    if (positiveCount / amounts.length > 0.7) return true;
  }

  return false;
}
