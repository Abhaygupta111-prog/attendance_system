export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

// Only admin and teacher are system-seeded — students are NOT seeded
// so they can be deleted permanently by the teacher.
const SEED_USERS = [
  { id: 'admin-1',   name: 'Admin User',    email: 'admin@attendverify.com',  role: 'admin',   avatar: 'https://picsum.photos/seed/admin/100/100',    status: 'active' },
  { id: 'teacher-1', name: 'Sarah Wilson',  email: 'sarah@attendverify.com',  role: 'teacher', avatar: 'https://picsum.photos/seed/teacher1/100/100', status: 'active' },
];



export async function GET() {
  try {
    const db = await getDb();
    const col = db.collection('users');

    // Upsert seed users by email — ensures demo users always exist
    // even if the DB was previously used by another backend  
    for (const seedUser of SEED_USERS) {
      await col.updateOne(
        { email: seedUser.email },
        { $setOnInsert: seedUser },
        { upsert: true }
      );
    }



    // Only return documents that have our custom `id` field
    // (excludes old Python/FastAPI backend users which use only _id with bcrypt passwords)
    const users = await col
      .find({ id: { $exists: true, $type: 'string' } }, { projection: { _id: 0 } })
      .toArray();
    return NextResponse.json(users);
  } catch (error: any) {
    console.error('[API /users GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const col = db.collection('users');
    const body = await request.json();

    // Check for duplicate email
    const existing = await col.findOne({ email: { $regex: new RegExp(`^${body.email}$`, 'i') } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'User with this email already exists.' }, { status: 409 });
    }

    const role = body.role || 'student';
    // Validate role
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role.' }, { status: 400 });
    }

    const uniqueSeed = Date.now();
    const fallbackAvatar = `https://picsum.photos/seed/${uniqueSeed}/100/100`;

    const newUser: Record<string, any> = {
      id: `${role}-${uniqueSeed}`,
      role: role,
      status: role === 'student' ? 'pending' : 'active', // Teachers are active by default
      ...body,
      avatar: body.avatar || fallbackAvatar,
    };

    await col.insertOne({ ...newUser });
    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error: any) {
    console.error('[API /users POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

