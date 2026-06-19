import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceFile: text("source_file").notNull(),
  importedAt: text("imported_at").notNull(),
  rowCount: integer("row_count").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "cancelled"] })
    .notNull()
    .default("pending"),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  originalDescription: text("original_description").notNull(),
  cleanDescription: text("clean_description"),
  amount: real("amount").notNull(),
  rawAmount: text("raw_amount").notNull(),
  type: text("type", {
    enum: ["Income", "Expense", "Transfer", "Refund", "Unknown"],
  })
    .notNull()
    .default("Unknown"),
  account: text("account"),
  category: text("category"),
  notes: text("notes"),
  bankType: text("bank_type"),
  sourceFile: text("source_file").notNull(),
  importBatchId: integer("import_batch_id")
    .notNull()
    .references(() => importBatches.id),
  reviewed: integer("reviewed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transactionId: integer("transaction_id").notNull().references(() => transactions.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  uploadedAt: text("uploaded_at").notNull(),
});

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

export type ImportBatch = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
