import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [row] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, Number(id)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = await readFile(path.join(UPLOADS_DIR, row.filename));
  return new NextResponse(buf, {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Disposition": `inline; filename="${row.originalName}"`,
    },
  });
}
