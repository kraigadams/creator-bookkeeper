// Demo seed — realistic YouTube creator transactions for screenshots
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "../data/ledger.db"));
db.pragma("journal_mode = WAL");

// Wipe existing data
db.exec(`DELETE FROM attachments; DELETE FROM transactions; DELETE FROM import_batches;`);

// Create two import batches
const batch1 = db.prepare(`INSERT INTO import_batches (source_file, imported_at, row_count, status) VALUES (?, ?, ?, 'confirmed')`);
const b1 = batch1.run("Chase7565_Activity_2026.csv", "2026-06-01T10:00:00Z", 40);
const b2 = batch1.run("AMEX_Delta_2026.csv", "2026-06-01T10:05:00Z", 18);

const insert = db.prepare(`
  INSERT INTO transactions
    (date, original_description, clean_description, amount, raw_amount, type, account, category, notes, bank_type, source_file, import_batch_id, reviewed, created_at)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const now = "2026-06-18T10:00:00Z";

const transactions = [
  // === INCOME ===
  // YouTube / Ad Revenue
  ["2026-06-15", "GOOGLE PAYMENT CORP GOOGLE PAY", "Google / YouTube Ad Revenue", 8420.55, "$8,420.55", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-05-15", "GOOGLE PAYMENT CORP GOOGLE PAY", "Google / YouTube Ad Revenue", 7985.30, "$7,985.30", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-04-15", "GOOGLE PAYMENT CORP GOOGLE PAY", "Google / YouTube Ad Revenue", 9102.44, "$9,102.44", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-03-15", "GOOGLE PAYMENT CORP GOOGLE PAY", "Google / YouTube Ad Revenue", 6750.18, "$6,750.18", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-02-15", "GOOGLE PAYMENT CORP GOOGLE PAY", "Google / YouTube Ad Revenue", 5980.90, "$5,980.90", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-01-15", "GOOGLE PAYMENT CORP GOOGLE PAY", "Google / YouTube Ad Revenue", 11240.75, "$11,240.75", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Sponsorships
  ["2026-06-10", "ICON TALENTS LLC PAYMENT", "Icon Talents LLC / Brand Deal", 18500.00, "$18,500.00", "Income", "Chase7565", "Business Income", "Q2 sponsor campaign", "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-05-22", "SQUARESPACE INC CREATOR PMT", "Squarespace / Sponsorship", 6000.00, "$6,000.00", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-04-08", "NORDVPN CREATOR PAYMENT", "NordVPN / Sponsorship", 4500.00, "$4,500.00", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-03-01", "RIDGE WALLET SPONSOR PMT", "Ridge Wallet / Sponsorship", 7500.00, "$7,500.00", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Affiliate / Amazon
  ["2026-06-05", "AMAZON ASSOCIATES PAYMENT", "Amazon Associates", 1240.38, "$1,240.38", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-05-05", "AMAZON ASSOCIATES PAYMENT", "Amazon Associates", 980.14, "$980.14", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-06-01", "LTKN LIKETOKNOWIT PAYOUT", "LTK Affiliate Payout", 320.50, "$320.50", "Income", "Chase7565", "Business Income", null, "ACH_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Transfers / Savings
  ["2026-06-01", "ONLINE TRANSFER FROM SAV ...4821", "Transfer from Savings", 5000.00, "$5,000.00", "Transfer", "Chase7565", "Transfer", null, "MISC_CREDIT", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // === EXPENSES ===
  // Gear & Equipment
  ["2026-06-12", "BHPHOTOVIDEO.COM", "B&H Photo / Camera Gear", -2840.00, "-$2,840.00", "Expense", "Chase7565", "Gear / Equipment", "Sony FX3 accessories", null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-05-18", "APPLE.COM/BILL", "Apple / MacBook Pro", -3499.00, "-$3,499.00", "Expense", "Chase7565", "Gear / Equipment", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-04-03", "AMAZON.COM", "Amazon / Studio Lighting", -389.99, "-$389.99", "Expense", "Chase7565", "Gear / Equipment", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Software & Subscriptions
  ["2026-06-01", "ADOBE SYSTEMS INC", "Adobe Creative Cloud", -59.99, "-$59.99", "Expense", "Chase7565", "Software", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-06-01", "NOTION LABS INC", "Notion", -16.00, "-$16.00", "Expense", "Chase7565", "Software", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-06-01", "FRAME.IO SUBSCRIPTION", "Frame.io", -25.00, "-$25.00", "Expense", "Chase7565", "Software", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-06-01", "EPIDEMIC SOUND AB", "Epidemic Sound", -15.00, "-$15.00", "Expense", "Chase7565", "Subscriptions", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-06-01", "DROPBOX INC", "Dropbox / Storage", -11.99, "-$11.99", "Expense", "Chase7565", "Software", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Contractors / Editors
  ["2026-06-08", "ZELLE PAYMENT TO MARCUS E", "Marcus / Video Editor", -1800.00, "-$1,800.00", "Expense", "Chase7565", "Contractor / Editor", "June editing — 4 videos", null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-05-08", "ZELLE PAYMENT TO MARCUS E", "Marcus / Video Editor", -1800.00, "-$1,800.00", "Expense", "Chase7565", "Contractor / Editor", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-06-05", "ZELLE PAYMENT TO SARA K", "Sara K / Thumbnail Design", -400.00, "-$400.00", "Expense", "Chase7565", "Contractor / Editor", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Travel
  ["2026-05-10", "UNITED AIRLINES", "United Airlines", -640.00, "-$640.00", "Expense", "AMEX Delta", "Travel", "NYC → LA for collab shoot", null, "AMEX_Delta_2026.csv", b2.lastInsertRowid, 1, now],
  ["2026-05-11", "MARRIOTT HOTELS", "Marriott / Hotel LA", -890.00, "-$890.00", "Expense", "AMEX Delta", "Travel", null, null, "AMEX_Delta_2026.csv", b2.lastInsertRowid, 1, now],
  ["2026-04-22", "DELTA AIR LINES", "Delta Airlines", -520.00, "-$520.00", "Expense", "AMEX Delta", "Travel", null, null, "AMEX_Delta_2026.csv", b2.lastInsertRowid, 1, now],
  ["2026-06-14", "ATM WITHDRAWAL 06/14", "ATM Withdrawal", -200.00, "-$200.00", "Expense", "Chase7565", "Travel", "Cash for shoot day", "ATM", "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Meals
  ["2026-06-10", "NOBU RESTAURANT NYC", "Nobu / Client Dinner", -320.00, "-$320.00", "Expense", "AMEX Delta", "Meals & Entertainment", "Sponsor meeting dinner", null, "AMEX_Delta_2026.csv", b2.lastInsertRowid, 1, now],
  ["2026-05-15", "SWEETGREEN", "Sweetgreen", -18.40, "-$18.40", "Expense", "Chase7565", "Meals & Entertainment", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Professional Services
  ["2026-04-15", "ACCOUNTANT WIRE PAYMENT", "CPA / Tax Preparation", -1200.00, "-$1,200.00", "Expense", "Chase7565", "Professional Services", "2025 tax return prep", null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Internet / Phone
  ["2026-06-05", "VERIZON WIRELESS", "Verizon", -95.00, "-$95.00", "Expense", "Chase7565", "Internet / Phone", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-06-01", "SPECTRUM INTERNET", "Spectrum / Internet", -79.99, "-$79.99", "Expense", "Chase7565", "Internet / Phone", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Bank Fees / Card
  ["2026-06-01", "AMEX ANNUAL FEE", "AMEX / Annual Card Fee", -695.00, "-$695.00", "Expense", "AMEX Delta", "Bank Fees", null, null, "AMEX_Delta_2026.csv", b2.lastInsertRowid, 1, now],

  // Tax Payments
  ["2026-06-16", "IRS USATAXPYMT", "IRS / Q2 Estimated Tax", -8500.00, "-$8,500.00", "Transfer", "Chase7565", "Tax Payment – Estimated", "Q2 2026 federal estimated", null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-06-16", "NYS DTF PIT", "NYS / Q2 Estimated Tax", -2200.00, "-$2,200.00", "Transfer", "Chase7565", "Tax Payment – Estimated", "Q2 2026 NY state estimated", null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-04-15", "IRS USATAXPYMT", "IRS / Q1 Estimated Tax", -8500.00, "-$8,500.00", "Transfer", "Chase7565", "Tax Payment – Estimated", "Q1 2026 federal estimated", null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-04-15", "NYS DTF PIT", "NYS / Q1 Estimated Tax", -2200.00, "-$2,200.00", "Transfer", "Chase7565", "Tax Payment – Estimated", "Q1 2026 NY state estimated", null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],

  // Owner Draw
  ["2026-06-01", "ONLINE TRANSFER TO CHK ...9821", "Transfer to Personal", -8000.00, "-$8,000.00", "Transfer", "Chase7565", "Owner Draw", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
  ["2026-05-01", "ONLINE TRANSFER TO CHK ...9821", "Transfer to Personal", -8000.00, "-$8,000.00", "Transfer", "Chase7565", "Owner Draw", null, null, "Chase7565_Activity_2026.csv", b1.lastInsertRowid, 1, now],
];

for (const t of transactions) {
  insert.run(...t);
}

console.log(`Seeded ${transactions.length} demo transactions.`);
db.close();
