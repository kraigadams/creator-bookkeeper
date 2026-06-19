import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { desc } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const batches = await db
    .select()
    .from(schema.importBatches)
    .orderBy(desc(schema.importBatches.importedAt));
  return NextResponse.json(batches);
}
