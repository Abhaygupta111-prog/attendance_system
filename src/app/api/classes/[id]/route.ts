export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;

    // Delete by our custom id field
    // Idempotent: treat "not found" as success to avoid errors from stale IDs
    await db.collection('classes').deleteOne({ id });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API /classes/[id] DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    const body = await request.json();

    await db.collection('classes').updateOne({ id }, { $set: body });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API /classes/[id] PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
