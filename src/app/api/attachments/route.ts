import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export async function GET(req: NextRequest) {
  const transactionId = req.nextUrl.searchParams.get("transactionId");
  const db = getDb();
  if (transactionId) {
    const rows = await db.select().from(schema.attachments).where(eq(schema.attachments.transactionId, Number(transactionId)));
    return NextResponse.json(rows);
  }
  // Return all attachments grouped by transactionId
  const rows = await db.select().from(schema.attachments);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const transactionId = form.get("transactionId");
  if (!file || !transactionId) return NextResponse.json({ error: "Missing file or transactionId" }, { status: 400 });

  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  const bytes = await file.arrayBuffer();
  await writeFile(path.join(UPLOADS_DIR, filename), Buffer.from(bytes));

  const db = getDb();
  const [row] = await db.insert(schema.attachments).values({
    transactionId: Number(transactionId),
    filename,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: bytes.byteLength,
    uploadedAt: new Date().toISOString(),
  }).returning();

  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: number };
  const db = getDb();
  const [row] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, id));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await unlink(path.join(UPLOADS_DIR, row.filename)).catch(() => {});
  await db.delete(schema.attachments).where(eq(schema.attachments.id, id));
  return NextResponse.json({ deleted: true });
}
