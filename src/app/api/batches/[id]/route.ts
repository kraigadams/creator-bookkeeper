import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  const deleted = await db.delete(schema.transactions).where(eq(schema.transactions.importBatchId, id));
  await db.delete(schema.importBatches).where(eq(schema.importBatches.id, id));

  return NextResponse.json({ ok: true });
}
