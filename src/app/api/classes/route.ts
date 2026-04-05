export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    // Only return documents that have our custom `id` field
    // (excludes old Python/FastAPI backend documents which use only _id)
    const classes = await db
      .collection('classes')
      .find({ id: { $exists: true, $type: 'string' } }, { projection: { _id: 0 } })
      .toArray();
    return NextResponse.json(classes);
  } catch (error: any) {
    console.error('[API /classes GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { course, semester, section, subject, teacherId } = body;

    const id = `${course}-${semester}-${section}-${subject}-${Date.now()}`
      .replace(/\s+/g, '-')
      .toUpperCase();

    const newClass = { id, course, semester, section, subject, teacherId, studentIds: [] };
    await db.collection('classes').insertOne({ ...newClass });

    return NextResponse.json(newClass, { status: 201 });
  } catch (error: any) {
    console.error('[API /classes POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

