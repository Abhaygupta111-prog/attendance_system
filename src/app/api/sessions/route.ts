export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const col = db.collection('sessions');

    // Auto-expire any active sessions older than 4 hours
    // This cleans up sessions the teacher forgot to end
    const expiryTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    await col.updateMany(
      { isActive: true, startTime: { $lt: expiryTime } },
      { $set: { isActive: false, endTime: new Date().toISOString() } }
    );

    const sessions = await col
      .find({}, { projection: { _id: 0 } })
      .toArray();
    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error('[API /sessions GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    // ── Close ALL previously active sessions before starting a new one ──
    // Prevents stale sessions (like a previous DSA session) from still
    // appearing as active while a new one (e.g. Gamming) is broadcast.
    await db.collection('sessions').updateMany(
      { isActive: true },
      { $set: { isActive: false, endTime: new Date().toISOString() } }
    );

    const newSession = {
      id: `session-${Date.now()}`,
      ...body,
      startTime: new Date().toISOString(),
      isActive: true,
    };

    await db.collection('sessions').insertOne({ ...newSession });
    return NextResponse.json(newSession, { status: 201 });
  } catch (error: any) {
    console.error('[API /sessions POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
