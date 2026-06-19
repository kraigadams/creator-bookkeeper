# Bookkeeper

Local-first bookkeeping for a one-owner creator/filmmaker business. Import CSVs, maintain a master ledger, categorize transactions, and generate a P&L — entirely on your machine. No cloud, no login, no syncing.

---

## Tech choices

- **Drizzle ORM** over Prisma — lighter, no separate runtime, no Prisma Client codegen step, and it wraps `better-sqlite3` cleanly for synchronous SQLite access from Next.js route handlers.
- **PapaParse** for CSV parsing — well-maintained, handles edge cases (quoted fields, BOM, different line endings), browser and Node compatible.
- **SheetJS (xlsx)** for XLSX export — the most widely used JS spreadsheet library.

---

## Requirements

- Node.js 20+
- npm

Node is not in the system PATH by default on this machine. Use the toolchain at:

```
/Users/kraigadams/Library/Mobile Documents/com~apple~CloudDocs/Documents/Test/.toolchain/node-v22.14.0-darwin-arm64/bin
```

Add it to your shell profile permanently:

```bash
# Add to ~/.zshrc
export PATH="/Users/kraigadams/Library/Mobile Documents/com~apple~CloudDocs/Documents/Test/.toolchain/node-v22.14.0-darwin-arm64/bin:$PATH"
```

---

## Install

```bash
cd /Users/kraigadams/Desktop/Books/bookkeeper
npm install
```

---

## Database setup

Run once to create `data/ledger.db`:

```bash
node scripts/migrate.js
```

The database file lives at `./data/ledger.db`. Never delete it — it is your master ledger.

---

## Run (dev)

```bash
npm run dev
```

Open http://localhost:3000

---

## Run (production)

```bash
npm run build
npm start
```

---

## Tests

```bash
npm test
```

Covers: missing date, missing amount, unparseable date, unparseable amount, row count integrity, CSV export completeness (12 test cases).

---

## Architecture

### Folder structure

```
src/
  app/
    page.tsx              # Dashboard
    import/page.tsx       # Import wizard (upload → map → preview → confirm)
    ledger/page.tsx       # Full ledger table with inline editing
    reports/page.tsx      # P&L report with date range presets
    api/
      upload/route.ts     # Parses CSV, returns headers + rows
      preview/route.ts    # Validates + normalizes rows, flags duplicates, creates session
      import/route.ts     # Commits session to SQLite
      transactions/       # GET all (with batch/date filters), PATCH editable fields
      batches/route.ts    # List import batches
      export/csv/         # Full ledger as CSV download
      export/xlsx/        # Full ledger as XLSX download
      reports/pnl/        # P&L aggregation by date range
  db/
    schema.ts             # Drizzle table definitions
    index.ts              # DB connection singleton (WAL mode)
  lib/
    validate.ts           # Row validation + amount parsing
    categorize.ts         # Keyword category rules + type inference
    importSession.ts      # In-memory session store bridging parse → confirm steps
  types/index.ts          # Shared TypeScript interfaces
scripts/
  migrate.js              # One-time DB init (plain CommonJS, no build step needed)
data/
  ledger.db               # SQLite master ledger
  seed.csv                # Sample CSV with edge cases for testing
```

### Data flow: CSV upload → ledger append

1. **Upload** (`POST /api/upload`) — client sends the file as `multipart/form-data`. PapaParse parses it server-side. Headers are trimmed of whitespace. Duplicate column names are rejected immediately before any mapping. Returns raw rows + headers.

2. **Map** (client only) — user maps CSV columns to Date / Description / Amount (or Debit + Credit) / Account. No server call yet.

3. **Preview** (`POST /api/preview`) — server validates every row: date exists + parseable, description non-empty, amount exists + parseable. If any row fails, the entire import stops and all errors are returned with exact row number and column name. On success, rows are normalized (date → ISO 8601, amount signed with credit positive/debit negative), existing transactions are queried to flag duplicates (matching date + amount + description). A session is created in memory holding the normalized rows. Returns `sessionId` + normalized rows.

4. **Confirm** (`POST /api/import`) — client sends `sessionId` + list of row indices the user chose to skip. Server looks up the session, creates an `import_batches` record, inserts one `transactions` row per non-skipped row. Category is inferred by keyword matching; type is inferred from category + sign. Session is deleted. Returns batch ID + counts.

### How batches relate to transactions

Every transaction has `import_batch_id` pointing to an `import_batches` row. A batch captures: source filename, timestamp, row count, and status. The Ledger view filters by batch ID. Batches are immutable after creation and are never deleted automatically.

---

## Seed CSV

`data/seed.csv` has 25 rows covering:
- Mixed Income (Stripe, YouTube, sponsor, affiliate) and Expense rows
- A likely duplicate (row 21 repeats row 1 with same date/amount/description)
- A row with a missing Description (row 22)
- A row with an unparseable date (row 24)
- Multiple accounts (Checking + Credit Card)
- Keyword-matched categories: Travel, Lodging, Software, Meals, Owner Draw, etc.

The validator will flag rows 22 and 24 and block the import — remove or fix them to complete the import.
