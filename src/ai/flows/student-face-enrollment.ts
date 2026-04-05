'use server';
/**
 * Student face enrollment — saves face data directly to MongoDB.
 * Uses the MongoDB client directly (no inter-service HTTP calls)
 * so it works in both local dev and Vercel serverless production.
 */

import { getDb } from '@/lib/mongodb';

export interface StudentFaceEnrollmentInput {
  studentId: string;
  photoDataUri: string;
}

export interface StudentFaceEnrollmentOutput {
  success: boolean;
  embeddingId?: string;
  message?: string;
}

export async function studentFaceEnrollment(
  input: StudentFaceEnrollmentInput
): Promise<StudentFaceEnrollmentOutput> {
  try {
    const { studentId, photoDataUri } = input;

    if (!studentId || !photoDataUri) {
      return { success: false, message: 'Missing studentId or photo.' };
    }

    const db = await getDb();
    const result = await db.collection('users').updateOne(
      { id: studentId },
      {
        $set: {
          faceData: photoDataUri,
          faceEnrolled: true,
          avatar: photoDataUri, // update profile photo too
        },
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'Student not found.' };
    }

    return {
      success: true,
      embeddingId: `face-${studentId}-${Date.now()}`,
      message: 'Face enrolled successfully.',
    };
  } catch (error: any) {
    console.error('[studentFaceEnrollment]', error);
    return { success: false, message: error.message || 'Failed to enroll face.' };
  }
}
