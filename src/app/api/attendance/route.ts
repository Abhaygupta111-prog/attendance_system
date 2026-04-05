export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const classId = searchParams.get('classId');

    const filter: Record<string, string> = {};
    if (studentId) filter.studentId = studentId;
    if (classId) filter.classId = classId;

    const records = await db
      .collection('attendance')
      .find(filter, { projection: { _id: 0 } })
      .toArray();

    return NextResponse.json(records);
  } catch (error: any) {
    console.error('[API /attendance GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    // body can be a single record or an array
    const records = Array.isArray(body) ? body : [body];

    if (records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 });
    }

    await db.collection('attendance').insertMany(records);
    return NextResponse.json({ success: true, inserted: records.length }, { status: 201 });
  } catch (error: any) {
    console.error('[API /attendance POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

