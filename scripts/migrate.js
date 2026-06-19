const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(process.cwd(), "data", "ledger.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  original_description TEXT NOT NULL,
  clean_description TEXT,
  amount REAL NOT NULL,
  raw_amount TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Unknown' CHECK(type IN ('Income', 'Expense', 'Transfer', 'Refund', 'Unknown')),
  account TEXT,
  category TEXT,
  notes TEXT,
  source_file TEXT NOT NULL,
  import_batch_id INTEGER NOT NULL REFERENCES import_batches(id),
  reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_batch ON transactions(import_batch_id);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_transaction ON attachments(transaction_id);

-- Add columns introduced after initial release (safe to run on existing DBs)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_type TEXT;
`);

console.log("Database initialized at", DB_PATH);
db.close();
