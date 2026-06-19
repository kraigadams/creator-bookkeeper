"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import type { ColumnMapping, NormalizedRow, ValidationError } from "@/types";

type Step = "upload" | "map" | "preview" | "done";

interface UploadResult {
  filename: string;
  headers: string[];
  rows: Array<{ rowIndex: number; cells: Record<string, string> }>;
  totalRows: number;
  isCreditCard: boolean;
}

interface PreviewResult {
  sessionId: string;
  rows: NormalizedRow[];
  totalRows: number;
}

// Auto-detect column mapping from common bank CSV header names
function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const lower = headers.map((h) => ({ original: h, l: h.toLowerCase() }));
  // Iterate terms in priority order, return first header that matches
  const find = (...terms: string[]) => {
    for (const term of terms) {
      const match = lower.find(({ l }) => l.includes(term));
      if (match) return match.original;
    }
    return undefined;
  };

  const mapping: Partial<ColumnMapping> = {};

  mapping.date =
    find("transaction date", "trans date", "posting date", "date") ?? undefined;

  mapping.description =
    find("description", "memo", "payee", "merchant", "narrative", "particulars", "name", "details") ?? undefined;

  // Prefer a single signed amount column; fall back to debit/credit pair
  const singleAmount = find("amount", "transaction amount", "net amount") ?? undefined;
  const debit = find("debit", "withdrawal", "charge", "out") ?? undefined;
  const credit = find("credit", "deposit", "payment", "in") ?? undefined;

  if (singleAmount) {
    mapping.amount = singleAmount;
  } else if (debit || credit) {
    mapping.debit = debit;
    mapping.credit = credit;
  }

  mapping.account =
    find("account", "account name", "account number") ?? undefined;

  // Bank transaction type (e.g. ACH_DEBIT, ACH_CREDIT, ATM, MISC_CREDIT)
  mapping.bankType =
    find("type", "transaction type", "trans type", "tran type") ?? undefined;

  return mapping;
}

// Extract a human-readable account name from a filename.
// "Chase7565_Activity_20260618.CSV" → "Chase7565"
// "bofa_checking_2024.csv" → "bofa checking"
function extractAccountName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, ""); // strip extension
  // Split on underscores/hyphens/spaces, drop pure-numeric and date-like segments
  const parts = base.split(/[_\-\s]+/).filter((p) => !/^\d{4,}$/.test(p));
  // Take the first 1-2 meaningful parts (skip generic words like "activity", "export", "transactions")
  const skip = new Set(["activity", "export", "transactions", "statement", "history", "download", "data"]);
  const meaningful = parts.filter((p) => !skip.has(p.toLowerCase()));
  return meaningful.slice(0, 2).join(" ") || base;
}

const MAPPING_LABELS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "date", label: "Date", required: true },
  { key: "description", label: "Description", required: true },
  { key: "amount", label: "Amount (single column)", required: false },
  { key: "debit", label: "Debit column", required: false },
  { key: "credit", label: "Credit column", required: false },
  { key: "account", label: "Account", required: false },
  { key: "bankType", label: "Transaction Type", required: false },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [invertAmounts, setInvertAmounts] = useState(false);
  const [isCreditCard, setIsCreditCard] = useState(false);
  const [accountName, setAccountName] = useState<string>("");
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [doneResult, setDoneResult] = useState<{ imported: number; skipped: number; batchId: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error + (data.duplicateHeaders ? `: ${data.duplicateHeaders.join(", ")}` : ""));
      return;
    }
    setUploadResult(data);
    setMapping(autoDetectMapping(data.headers));
    setAccountName(extractAccountName(data.filename));
    setIsCreditCard(data.isCreditCard);
    setInvertAmounts(data.isCreditCard);
    setStep("map");
  }

  async function handlePreview() {
    if (!uploadResult) return;
    const m = mapping as ColumnMapping;
    if (!m.date || !m.description) {
      setError("Date and Description columns are required.");
      return;
    }
    if (!m.amount && !m.debit && !m.credit) {
      setError("Map either an Amount column or Debit/Credit columns.");
      return;
    }
    setLoading(true);
    setError("");
    setValidationErrors([]);
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: uploadResult.rows, mapping: m, filename: uploadResult.filename, accountName, invertAmounts }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (data.validationErrors) {
        setValidationErrors(data.validationErrors);
        setError(`Validation failed: ${data.validationErrors.length} error(s). Fix your CSV and re-upload.`);
      } else {
        setError(data.error);
      }
      return;
    }
    setPreviewResult(data);
    setSkipped(new Set());
    setStep("preview");
  }

  async function handleConfirm() {
    if (!previewResult) return;
    setLoading(true);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: previewResult.sessionId,
        skippedRowIndices: Array.from(skipped),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setDoneResult(data);
    setStep("done");
  }

  function toggleSkip(rowIndex: number) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  function reset() {
    setStep("upload");
    setUploadResult(null);
    setMapping({});
    setPreviewResult(null);
    setSkipped(new Set());
    setValidationErrors([]);
    setError("");
    setDoneResult(null);
    setAccountName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold">Import CSV</h1><Link href="/" className="btn-secondary text-sm">← Ledger</Link></div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8 text-sm">
        {(["upload", "map", "preview", "done"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-stone-300">›</span>}
            <span className={step === s ? "font-semibold text-blue-600" : "text-stone-400"}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </span>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* STEP: Upload */}
      {step === "upload" && (
        <div>
          <label className="btn-primary cursor-pointer inline-block">
            {loading ? "Uploading…" : "Choose CSV File"}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              disabled={loading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </label>
        </div>
      )}

      {/* STEP: Map columns */}
      {step === "map" && uploadResult && (
        <div>
          <p className="text-sm text-stone-500 mb-4">
            File: <strong>{uploadResult.filename}</strong> — {uploadResult.totalRows} data rows detected.
          </p>

          {/* Raw CSV preview */}
          <details className="mb-6">
            <summary className="cursor-pointer text-sm text-blue-600 underline mb-2">Show raw CSV preview (first 5 rows)</summary>
            <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded text-xs">
              <table className="w-full">
                <thead className="bg-stone-50 dark:bg-stone-900">
                  <tr>
                    <th className="px-2 py-1 text-left text-stone-500 dark:text-stone-400">#</th>
                    {uploadResult.headers.map((h) => (
                      <th key={h} className="px-2 py-1 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadResult.rows.slice(0, 5).map((row) => (
                    <tr key={row.rowIndex} className="border-t border-stone-100 dark:border-stone-800">
                      <td className="px-2 py-1 text-stone-400">{row.rowIndex}</td>
                      {uploadResult.headers.map((h) => (
                        <td key={h} className="px-2 py-1">{row.cells[h] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* Account name */}
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-stone-200 dark:border-stone-700">
            <label className="w-48 text-sm font-medium shrink-0">
              Account name<span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              className="border border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-700 rounded px-2 py-1 text-sm min-w-[200px] dark:text-stone-100 text-stone-900"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">from filename</span>
          </div>

          <div className="space-y-3 mb-6">
            {MAPPING_LABELS.map(({ key, label, required }) => {
              const val = (mapping as Record<string, string>)[key] ?? "";
              const autoDetected = !!val;
              // Hide optional rows that weren't auto-detected — reduces clutter
              if (!required && !autoDetected) return null;
              return (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-48 text-sm font-medium shrink-0">
                    {label}{required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <select
                    className={`border rounded px-2 py-1 text-sm min-w-[200px] dark:text-stone-100 ${autoDetected ? "border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-700" : "border-stone-300 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"}`}
                    value={val}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [key]: e.target.value || undefined }))
                    }
                  >
                    <option value="">— not mapped —</option>
                    {uploadResult.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {autoDetected && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">auto-detected</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-sm mb-6">
            {isCreditCard ? (
              <span className="text-blue-600">Credit card statement detected — signs will be flipped automatically.</span>
            ) : (
              <span className="text-stone-400">Bank/checking account detected.</span>
            )}
            {" "}<button className="underline text-stone-500 text-xs" onClick={() => setInvertAmounts(!invertAmounts)}>
              {invertAmounts ? "undo flip" : "flip signs instead"}
            </button>
          </p>

          <div className="flex gap-3">
            <button onClick={reset} className="btn-secondary">Back</button>
            <button onClick={handlePreview} className="btn-primary" disabled={loading}>
              {loading ? "Validating…" : "Validate & Preview"}
            </button>
          </div>

          {/* Validation errors table */}
          {validationErrors.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">Validation Errors ({validationErrors.length})</h3>
              <div className="overflow-x-auto border border-red-200 dark:border-red-800 rounded text-sm">
                <table className="w-full">
                  <thead className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Row</th>
                      <th className="px-3 py-2 text-left">Column</th>
                      <th className="px-3 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationErrors.map((e, i) => (
                      <tr key={i} className="border-t border-red-100 dark:border-red-900">
                        <td className="px-3 py-2 font-mono">{e.rowIndex}</td>
                        <td className="px-3 py-2">{e.column}</td>
                        <td className="px-3 py-2 text-red-600 dark:text-red-400">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP: Preview */}
      {step === "preview" && previewResult && (
        <div>
          <p className="text-sm text-stone-500 mb-2">
            {previewResult.totalRows} rows ready to import.{" "}
            {previewResult.rows.filter((r) => r.isDuplicate).length > 0 && (
              <span className="text-amber-600 font-medium">
                {previewResult.rows.filter((r) => r.isDuplicate).length} possible duplicate(s) flagged.
              </span>
            )}
          </p>
          <p className="text-xs text-stone-400 mb-4">
            Check "Skip" on any row you don't want to import. Duplicates are flagged but not auto-skipped.
          </p>

          {(() => {
            const hasDuplicates = previewResult.rows.some((r) => r.isDuplicate);
            return (
          <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded text-sm mb-6">
            <table className="w-full">
              <thead className="bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Row</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  {hasDuplicates && <th className="px-3 py-2 text-left">⚠︎</th>}
                  <th className="px-3 py-2 text-center">Skip</th>
                </tr>
              </thead>
              <tbody>
                {previewResult.rows.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={`border-t border-stone-100 dark:border-stone-800 ${skipped.has(row.rowIndex) ? "opacity-40" : ""} ${row.isDuplicate ? "bg-amber-50 dark:bg-amber-950" : ""}`}
                  >
                    <td className="px-3 py-2 text-stone-400 font-mono">{row.rowIndex}</td>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{row.description}</td>
                    <td className={`px-3 py-2 text-right font-mono ${row.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {fmt(row.amount)}
                    </td>
                    <td className="px-3 py-2 text-stone-500 dark:text-stone-400">{row.account || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${
                        row.type === "Income" ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" :
                        row.type === "Expense" ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300" :
                        row.type === "Transfer" ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" :
                        "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
                      }`}>{row.type ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-stone-500 dark:text-stone-400 text-xs">{row.category ?? "—"}</td>
                    {hasDuplicates && (
                      <td className="px-3 py-2">
                        {row.isDuplicate && (
                          <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded px-1.5 py-0.5">
                            dup #{row.duplicateOf}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={skipped.has(row.rowIndex)}
                        onChange={() => toggleSkip(row.rowIndex)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          );})()}

          <div className="flex gap-3">
            <button onClick={() => setStep("map")} className="btn-secondary">Back</button>
            <button onClick={handleConfirm} className="btn-primary" disabled={loading}>
              {loading ? "Importing…" : `Confirm Import (${previewResult.totalRows - skipped.size} rows)`}
            </button>
          </div>
        </div>
      )}

      {/* STEP: Done */}
      {step === "done" && doneResult && (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded px-4 py-4">
            <p className="font-semibold text-green-800 dark:text-green-200">Import complete</p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              {doneResult.imported} rows imported, {doneResult.skipped} skipped. Batch #{doneResult.batchId}.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="btn-secondary">Import Another File</button>
            <a href="/" className="btn-primary">View Ledger</a>
          </div>
        </div>
      )}
    </div>
  );
}
