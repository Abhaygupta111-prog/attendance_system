export type Role = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  avatar?: string;
  status?: UserStatus;
  course?: string;
  semester?: string;
  section?: string;
  faceData?: string;         // 200×200 JPEG data URI of enrolled face
  faceEnrolled?: boolean;    // true once face has been enrolled
  faceDescriptor?: number[]; // 128-d embedding vector from face-api.js
}

export interface Class {
  id: string;
  course: string;
  semester: string;
  section: string;
  subject: string;
  teacherId: string;
  studentIds: string[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  timestamp: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface LiveSession {
  id: string;
  classId: string;
  teacherId: string;
  startTime: string;
  isActive: boolean;
  subject: string;
  academicGroup: string; // e.g. "BCA 6A"
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
