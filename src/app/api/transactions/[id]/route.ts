import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import type { NewTransaction } from "@/db/schema";

type EditableFields = Pick<NewTransaction, "category" | "type" | "notes" | "cleanDescription" | "reviewed">;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const update: Partial<EditableFields> = {};
  if ("category" in body) update.category = body.category;
  if ("type" in body) update.type = body.type;
  if ("notes" in body) update.notes = body.notes;
  if ("cleanDescription" in body) update.cleanDescription = body.cleanDescription;
  if ("reviewed" in body) update.reviewed = body.reviewed;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  await db
    .update(schema.transactions)
    .set(update)
    .where(eq(schema.transactions.id, Number(id)));

  return NextResponse.json({ ok: true });
}
