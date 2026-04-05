export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const col = db.collection('users');
    const { id } = await params;
    const body = await request.json();

    const result = await col.updateOne(
      { id },
      { $set: body }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API /users/[id] PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;
    // Prevent deleting seed/demo users
    const protected_ids = ['admin-1', 'teacher-1'];
    if (protected_ids.includes(id)) {
      return NextResponse.json({ error: 'Cannot delete system users.' }, { status: 403 });
    }
    await db.collection('users').deleteOne({ id });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API /users/[id] DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
