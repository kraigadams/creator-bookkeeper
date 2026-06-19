"use client";
import Link from "next/link";
import { Fragment } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { useEffect, useState, useCallback, useMemo } from "react";
import { DEFAULT_CATEGORIES } from "@/lib/categorize";

const TYPES = ["Income", "Expense", "Transfer", "Refund", "Unknown"] as const;

interface Transaction {
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
  bankType: string | null;
  sourceFile: string;
  importBatchId: number;
  reviewed: boolean;
  createdAt: string;
}

interface Batch {
  id: number;
  sourceFile: string;
  importedAt: string;
  rowCount: number;
}

type SortKey = "date" | "amount" | "type" | "category";
type SortDir = "asc" | "desc";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function fileLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("invoice")) return "Invoice";
  if (lower.includes("agreement") || lower.includes("contract")) return "Agreement";
  if (lower.includes("receipt")) return "Receipt";
  if (lower.includes("statement")) return "Statement";
  if (lower.includes("proposal")) return "Proposal";
  if (lower.includes("w9") || lower.includes("w-9")) return "W-9";
  if (lower.includes("1099")) return "1099";
  // Fall back to filename without extension, truncated
  return name.replace(/\.[^.]+$/, "").slice(0, 18);
}

const shortDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

export default function LedgerPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchFilter, setBatchFilter] = useState<string>("");
  const [fromFilter, setFromFilter] = useState<string>("");
  const [toFilter, setToFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [recatLoading, setRecatLoading] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [recatChanges, setRecatChanges] = useState<Array<{
    id: number; date: string; description: string; amount: number;
    oldCategory: string | null; newCategory: string; oldType: string; newType: string;
  }> | null>(null);

  const [recatKept, setRecatKept] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [attachments, setAttachments] = useState<Record<number, Array<{ id: number; originalName: string; mimeType: string; fileSize: number }>>>({});
  const [attachUploading, setAttachUploading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showRawDesc, setShowRawDesc] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [bulkWorking, setBulkWorking] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (batchFilter) params.set("batchId", batchFilter);
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    const [txRes, batchRes, attachRes] = await Promise.all([
      fetch(`/api/transactions?${params}`),
      fetch("/api/batches"),
      fetch("/api/attachments"),
    ]);
    setTransactions(await txRes.json());
    setBatches(await batchRes.json());
    const allAttachments: Array<{ id: number; transactionId: number; originalName: string; mimeType: string; fileSize: number }> = await attachRes.json();
    const grouped: Record<number, typeof allAttachments> = {};
    for (const a of allAttachments) {
      if (!grouped[a.transactionId]) grouped[a.transactionId] = [];
      grouped[a.transactionId].push(a);
    }
    setAttachments(grouped);
    setLoading(false);
    setSelected(new Set());
  }, [batchFilter, fromFilter, toFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  async function deleteBatch(id: string) {
    if (!confirm("Delete all transactions from this import batch? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/batches/${id}`, { method: "DELETE" });
    setBatchFilter("");
    await loadData();
    setDeleting(false);
  }

  async function recategorize() {
    setRecatLoading(true);
    setRecatChanges(null);
    const res = await fetch("/api/recategorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onlyUncategorized: false }),
    });
    const data = await res.json();
    setRecatChanges(data.changedRows);
    setRecatKept(new Set((data.changedRows as {id: number}[]).map((r) => r.id)));
    setCanUndo(true);
    await loadData();
    setRecatLoading(false);
  }

  async function applyRecatSelection() {
    if (!recatChanges) return;
    const toRevert = recatChanges.filter((r) => !recatKept.has(r.id));
    if (toRevert.length > 0) {
      await Promise.all(toRevert.map((r) =>
        fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [r.id], fields: { category: r.oldCategory, type: r.oldType } }),
        })
      ));
    }
    setRecatChanges(null);
    setCanUndo(false);
    await loadData();
  }

  async function undoRecategorize() {
    setRecatLoading(true);
    await fetch("/api/recategorize", { method: "DELETE" });
    setCanUndo(false);
    setRecatChanges(null);
    await loadData();
    setRecatLoading(false);
  }

  async function updateField(id: number, field: string, value: unknown) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} transaction${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkWorking(true);
    await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    await loadData();
    setBulkWorking(false);
  }

  async function markAsTransfer() {
    setBulkWorking(true);
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], fields: { type: "Transfer", category: "Transfer" } }),
    });
    setTransactions((prev) =>
      prev.map((t) => selected.has(t.id) ? { ...t, type: "Transfer", category: "Transfer" } : t)
    );
    setSelected(new Set());
    setBulkWorking(false);
  }

  async function applyBulkCategory() {
    if (!bulkCategory) return;
    setBulkWorking(true);
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], fields: { category: bulkCategory } }),
    });
    setTransactions((prev) =>
      prev.map((t) => selected.has(t.id) ? { ...t, category: bulkCategory } : t)
    );
    setSelected(new Set());
    setBulkCategory("");
    setBulkWorking(false);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = q
      ? transactions.filter((t) =>
          (t.cleanDescription || t.originalDescription).toLowerCase().includes(q) ||
          (t.category ?? "").toLowerCase().includes(q) ||
          (t.account ?? "").toLowerCase().includes(q)
        )
      : transactions;

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "type") cmp = (a.type ?? "").localeCompare(b.type ?? "");
      else if (sortKey === "category") cmp = (a.category ?? "").localeCompare(b.category ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [transactions, search, sortKey, sortDir]);

  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((t) => t.id)));
  }

  async function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
          resolve(compressed.size < file.size ? compressed : file);
        }, "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function uploadAttachment(transactionId: number, rawFile: File) {
    const MB = rawFile.size / 1024 / 1024;
    const isImage = rawFile.type.startsWith("image/");

    if (!isImage && MB > 5) {
      const ok = confirm(
        `This file is ${MB.toFixed(1)} MB. Large files are stored as-is and may slow things down.\n\nFor PDFs, consider running "Reduce File Size" in Preview (macOS) before uploading.\n\nUpload anyway?`
      );
      if (!ok) return;
    }

    setAttachUploading(true);
    let file = rawFile;
    if (isImage) {
      const before = MB;
      file = await compressImage(rawFile);
      const after = file.size / 1024 / 1024;
      if (before - after > 0.1) console.info(`Image compressed: ${before.toFixed(1)} MB → ${after.toFixed(1)} MB`);
    }

    const form = new FormData();
    form.append("file", file);
    form.append("transactionId", String(transactionId));
    const res = await fetch("/api/attachments", { method: "POST", body: form });
    const row = await res.json();
    setAttachments((prev) => ({ ...prev, [transactionId]: [...(prev[transactionId] ?? []), row] }));
    setAttachUploading(false);
  }

  async function deleteAttachment(transactionId: number, attachId: number) {
    await fetch("/api/attachments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: attachId }) });
    setAttachments((prev) => ({ ...prev, [transactionId]: prev[transactionId].filter((a) => a.id !== attachId) }));
  }

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      className={`px-3 py-2 cursor-pointer select-none hover:text-stone-700 dark:hover:text-stone-300 ${right ? "text-right" : "text-left"}`}
      onClick={() => toggleSort(k)}
    >
      {label}<SortIcon k={k} />
    </th>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-widest mb-0.5">Kraig Adams</p>
          <h1 className="text-2xl font-bold">Ledger</h1>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <button onClick={recategorize} disabled={recatLoading} className="btn-secondary text-sm">
              {recatLoading ? "Running…" : "Auto-categorize"}
            </button>
            {(() => {
              const n = transactions.filter(t => !t.reviewed && (!t.category || t.category === "Uncategorized")).length;
              return n > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                  {n}
                </span>
              ) : null;
            })()}
          </div>
          <a href="/api/export/csv" className="btn-secondary text-sm">Export CSV</a>
          <Link href="/import" className="btn-primary text-sm">Import CSV</Link>
          <Link href="/reports" className="btn-secondary text-sm">P&L Report</Link>
          <ThemeToggle />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 text-sm items-center">
        <input
          type="search"
          placeholder="Search…"
          className="border border-stone-300 dark:border-stone-600 rounded px-2 py-1 w-48 dark:bg-stone-800 dark:text-stone-100"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-stone-300 dark:border-stone-600 rounded px-2 py-1 dark:bg-stone-800 dark:text-stone-100"
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
        >
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.sourceFile} — {new Date(b.importedAt).toLocaleDateString()} ({b.rowCount} rows)
            </option>
          ))}
        </select>
        {batches.length > 0 && batchFilter === "" && (
          <button className="btn-secondary text-xs" onClick={() => setBatchFilter(String(batches[0].id))}>
            Last import
          </button>
        )}
        <label className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
          From
          <input type="date" className="border border-stone-300 dark:border-stone-600 rounded px-2 py-1 dark:bg-stone-800 dark:text-stone-100" value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
          To
          <input type="date" className="border border-stone-300 dark:border-stone-600 rounded px-2 py-1 dark:bg-stone-800 dark:text-stone-100" value={toFilter} onChange={(e) => setToFilter(e.target.value)} />
        </label>
        {(batchFilter || fromFilter || toFilter || search) && (
          <button onClick={() => { setBatchFilter(""); setFromFilter(""); setToFilter(""); setSearch(""); }} className="text-stone-400 underline">
            Clear
          </button>
        )}
      </div>

      {batchFilter && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 text-sm">
          <span className="text-amber-700 dark:text-amber-300">Viewing one import batch.</span>
          <button onClick={() => deleteBatch(batchFilter)} disabled={deleting} className="text-red-600 dark:text-red-400 underline font-medium disabled:opacity-50">
            {deleting ? "Deleting…" : "Undo this import"}
          </button>
        </div>
      )}

      {recatChanges && (
        <div className="mb-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-blue-100 dark:bg-blue-900">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {recatChanges.length} transaction{recatChanges.length !== 1 ? "s" : ""} auto-categorized
              <span className="text-xs font-normal text-blue-600 dark:text-blue-400 ml-2">Uncheck any to revert</span>
            </span>
            <div className="flex gap-3 items-center">
              {canUndo && (
                <button onClick={undoRecategorize} disabled={recatLoading} className="text-xs text-red-600 dark:text-red-400 underline font-medium">
                  {recatLoading ? "Undoing…" : "Undo all"}
                </button>
              )}
              <button
                onClick={applyRecatSelection}
                disabled={recatLoading}
                className="text-xs bg-blue-600 text-white rounded px-2.5 py-1 font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {recatKept.size < recatChanges.length
                  ? `Apply (revert ${recatChanges.length - recatKept.size})`
                  : "Looks good"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 uppercase sticky top-0">
                <tr>
                  <th className="px-3 py-1 w-8">
                    <input type="checkbox"
                      checked={recatKept.size === recatChanges.length}
                      onChange={() => setRecatKept(
                        recatKept.size === recatChanges.length
                          ? new Set()
                          : new Set(recatChanges.map((r) => r.id))
                      )}
                    />
                  </th>
                  <th className="px-3 py-1 text-left">Date</th>
                  <th className="px-3 py-1 text-left">Description</th>
                  <th className="px-3 py-1 text-right">Amount</th>
                  <th className="px-3 py-1 text-left">Was</th>
                  <th className="px-3 py-1 text-left">Now</th>
                </tr>
              </thead>
              <tbody>
                {recatChanges.map((r) => {
                  const kept = recatKept.has(r.id);
                  return (
                  <tr key={r.id} className={`border-t border-blue-100 dark:border-blue-800 ${!kept ? "opacity-40" : ""}`}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={kept} onChange={() => setRecatKept((prev) => {
                        const next = new Set(prev);
                        next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                        return next;
                      })} />
                    </td>
                    <td className="px-3 py-1.5 text-stone-400 whitespace-nowrap">{shortDate(r.date)}</td>
                    <td className="px-3 py-1.5 max-w-xs truncate text-stone-700 dark:text-stone-300">{r.description}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${r.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(r.amount)}
                    </td>
                    <td className="px-3 py-1.5 text-stone-400">{r.oldCategory ?? "—"}</td>
                    <td className="px-3 py-1.5 font-medium text-stone-800 dark:text-stone-200">{kept ? r.newCategory : <span className="line-through text-stone-400">{r.newCategory}</span>}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-stone-900 dark:bg-stone-800 text-white rounded-lg px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <span className="text-stone-500">·</span>
          <button onClick={markAsTransfer} disabled={bulkWorking} className="hover:text-blue-300 disabled:opacity-50">
            Mark as Transfer
          </button>
          <span className="text-stone-500">·</span>
          <div className="flex items-center gap-1.5">
            <select
              className="bg-stone-800 dark:bg-stone-700 border border-stone-700 dark:border-stone-600 rounded px-2 py-0.5 text-sm text-white"
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
            >
              <option value="">Set category…</option>
              {DEFAULT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            {bulkCategory && (
              <button onClick={applyBulkCategory} disabled={bulkWorking} className="text-blue-300 hover:text-blue-200 font-medium disabled:opacity-50">
                Apply
              </button>
            )}
          </div>
          <span className="text-stone-500">·</span>
          <button onClick={deleteSelected} disabled={bulkWorking} className="text-red-400 hover:text-red-300 disabled:opacity-50">
            Delete
          </button>
          <span className="text-stone-500">·</span>
          {selected.size === 1 && (() => {
            const txId = [...selected][0];
            return (
              <>
                <span className="text-stone-500">·</span>
                <label className={`cursor-pointer hover:text-blue-300 disabled:opacity-50 ${attachUploading ? "opacity-50 pointer-events-none" : ""}`}>
                  {attachUploading ? "Uploading…" : "Attach file"}
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.doc,.docx"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await uploadAttachment(txId, f); } e.target.value = ""; }} />
                </label>
              </>
            );
          })()}
          <span className="text-stone-500">·</span>
          <button onClick={() => setSelected(new Set())} className="text-stone-400 hover:text-white">
            Clear
          </button>
        </div>
      )}

      <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">
        {filtered.length}{filtered.length !== transactions.length ? ` of ${transactions.length}` : ""} transaction(s)
      </p>

      {loading ? (
        <p className="text-stone-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400 text-xs uppercase sticky top-0">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <Th k="date" label="Date" />
                <th className="px-3 py-2 text-left">Description</th>
                <Th k="amount" label="Amount" right />
                <Th k="type" label="Type" />
                <Th k="category" label="Category" />
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 w-16 text-xs text-stone-400 font-normal">Lock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <Fragment key={t.id}>
                <tr
                  className={`border-t border-stone-100 dark:border-stone-800 transition-opacity ${selected.has(t.id) ? "bg-blue-50 dark:bg-blue-950" : ""} ${t.reviewed ? "opacity-40" : ""}`}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleRow(t.id)} />
                  </td>
                  <td className="px-3 py-2 text-stone-400 whitespace-nowrap text-xs">{shortDate(t.date)}</td>
                  <td className="px-3 py-2 max-w-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => setShowRawDesc(prev => { const next = new Set(prev); next.has(t.id) ? next.delete(t.id) : next.add(t.id); return next; })}
                          className="truncate text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-full"
                        >
                          {showRawDesc.has(t.id)
                            ? <span className="text-xs text-stone-400 dark:text-stone-500 break-all whitespace-normal">{t.originalDescription}</span>
                            : (t.cleanDescription || t.originalDescription)
                          }
                        </button>
                      </div>
                      <button
                        onClick={() => setExpandedRow(expandedRow === t.id ? null : t.id)}
                        className="flex-shrink-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                        title="Attachments"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${expandedRow === t.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {(attachments[t.id]?.length ?? 0) > 0 && (
                        <span className="flex-shrink-0 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5 font-medium">
                          {attachments[t.id].length} file{attachments[t.id].length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${t.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {fmt(t.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <select className="border-0 bg-transparent text-sm w-full dark:text-stone-200" value={t.type} onChange={(e) => updateField(t.id, "type", e.target.value)}>
                      {TYPES.map((ty) => <option key={ty}>{ty}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select className="border-0 bg-transparent text-sm w-full dark:text-stone-200" value={t.category ?? ""} onChange={(e) => updateField(t.id, "category", e.target.value)}>
                      <option value="">—</option>
                      {DEFAULT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-stone-400 text-xs">{t.account ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      role="switch"
                      aria-checked={t.reviewed}
                      onClick={() => updateField(t.id, "reviewed", !t.reviewed)}
                      title={t.reviewed ? "Locked — auto-categorize skips this row" : "Unlocked — click to lock"}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${t.reviewed ? "bg-stone-500" : "bg-stone-200 dark:bg-stone-600"}`}
                    >
                      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform ${t.reviewed ? "translate-x-3.5" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                </tr>
                {expandedRow === t.id && (
                  <tr className="bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800">
                    <td colSpan={9} className="px-8 py-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        {(attachments[t.id] ?? []).length === 0 && (
                          <span className="text-xs text-stone-400">No files attached</span>
                        )}
                        {(attachments[t.id] ?? []).map((a) => (
                          <div key={a.id} className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-1.5 text-sm">
                            <span className="font-medium text-stone-700 dark:text-stone-300">{fileLabel(a.originalName)}</span>
                            <span className="text-stone-400 text-xs">{a.fileSize ? `${(a.fileSize / 1024).toFixed(0)} KB` : ""}</span>
                            <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-xs">View</a>
                            <button onClick={() => deleteAttachment(t.id, a.id)} className="text-stone-300 hover:text-red-500 dark:hover:text-red-400 text-xs">Delete</button>
                          </div>
                        ))}
                        <label className={`cursor-pointer text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5 bg-white dark:bg-stone-800 ${attachUploading ? "opacity-50 pointer-events-none" : ""}`}>
                          {attachUploading ? "Uploading…" : "+ Attach file"}
                          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.doc,.docx"
                            onChange={async (e) => { const f = e.target.files?.[0]; if (f) await uploadAttachment(t.id, f); e.target.value = ""; }} />
                        </label>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
