// In-memory store for import sessions (server-side, single process)
// Sessions hold parsed+normalized rows until user confirms import.

import type { NormalizedRow } from "@/types";

interface ImportSession {
  id: string;
  sourceFile: string;
  rows: NormalizedRow[];
  createdAt: number;
}

const sessions = new Map<string, ImportSession>();

export function createSession(
  sourceFile: string,
  rows: NormalizedRow[]
): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessions.set(id, { id, sourceFile, rows, createdAt: Date.now() });
  // Purge sessions older than 2 hours
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [k, v] of sessions) {
    if (v.createdAt < cutoff) sessions.delete(k);
  }
  return id;
}

export function getSession(id: string): ImportSession | undefined {
  return sessions.get(id);
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}
