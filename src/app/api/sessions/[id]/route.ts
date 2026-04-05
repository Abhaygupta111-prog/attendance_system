export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    const body = await request.json();

    const result = await db.collection('sessions').updateOne(
      { id },
      { $set: body }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API /sessions/[id] PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
