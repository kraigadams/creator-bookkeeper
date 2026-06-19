import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq, gte, lte, and, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const db = getDb();
  const conditions = [];

  if (batchId) conditions.push(eq(schema.transactions.importBatchId, Number(batchId)));
  if (from) conditions.push(gte(schema.transactions.date, from));
  if (to) conditions.push(lte(schema.transactions.date, to));

  const rows = await db
    .select()
    .from(schema.transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(schema.transactions.date);

  return NextResponse.json(rows);
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json() as { ids: number[] };
  if (!ids?.length) return NextResponse.json({ error: "No ids" }, { status: 400 });
  const db = getDb();
  await db.delete(schema.transactions).where(inArray(schema.transactions.id, ids));
  return NextResponse.json({ deleted: ids.length });
}

export async function PATCH(req: NextRequest) {
  const { ids, fields } = await req.json() as { ids: number[]; fields: Record<string, unknown> };
  if (!ids?.length || !fields) return NextResponse.json({ error: "Missing ids or fields" }, { status: 400 });
  const db = getDb();
  await db.update(schema.transactions).set(fields as never).where(inArray(schema.transactions.id, ids));
  return NextResponse.json({ updated: ids.length });
}
