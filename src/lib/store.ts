
import { User, Class, AttendanceRecord, LiveSession } from './types';

// ──────────────────────────────────────────────────────────────
// Helper: base URL that works on both server and client
// ──────────────────────────────────────────────────────────────
function apiBase() {
  if (typeof window !== 'undefined') return ''; // browser: relative URLs work
  // SSR: need absolute URL
  const port = process.env.PORT || 9002;
  return `http://localhost:${port}`;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────────────────────
// dataStore — all methods are now async, backed by MongoDB
// ──────────────────────────────────────────────────────────────
export const dataStore = {
  // Users
  getUsers: (): Promise<User[]> => apiFetch<User[]>('/api/users'),

  saveUsers: async (_users: User[]) => {
    // Bulk replace not needed — individual updates via updateUser
    console.warn('saveUsers is deprecated; use updateUser / approveStudent / rejectStudent instead');
  },

  // Classes
  getClasses: (): Promise<Class[]> => apiFetch<Class[]>('/api/classes'),

  saveClasses: async (_classes: Class[]) => {
    console.warn('saveClasses is deprecated; use createClass / deleteClass instead');
  },

  // Attendance
  getAttendance: (filter?: { studentId?: string; classId?: string }): Promise<AttendanceRecord[]> => {
    const params = new URLSearchParams();
    if (filter?.studentId) params.set('studentId', filter.studentId);
    if (filter?.classId) params.set('classId', filter.classId);
    const qs = params.toString();
    return apiFetch<AttendanceRecord[]>(`/api/attendance${qs ? `?${qs}` : ''}`);
  },

  saveAttendance: async (_records: AttendanceRecord[]) => {
    console.warn('saveAttendance is deprecated; use markAttendance instead');
  },

  // Live Sessions
  getLiveSessions: (): Promise<LiveSession[]> => apiFetch<LiveSession[]>('/api/sessions'),

  saveLiveSessions: async (_sessions: LiveSession[]) => {
    console.warn('saveLiveSessions is deprecated; use startSession / endSession instead');
  },

  // ── Session management ──
  startSession: async (classId: string, teacherId: string, subject: string, academicGroup: string): Promise<LiveSession> => {
    return apiFetch<LiveSession>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ classId, teacherId, subject, academicGroup }),
    });
  },

  endSession: async (sessionId: string): Promise<void> => {
    await apiFetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
  },

  // ── Attendance marking ──
  markAttendance: async (studentIds: string[], classId: string, location?: { lat: number; lng: number }): Promise<void> => {
    const today = new Date().toISOString().split('T')[0];
    const records: AttendanceRecord[] = studentIds.map(sid => ({
      id: `att-${Date.now()}-${sid}`,
      studentId: sid,
      classId,
      date: today,
      status: 'present' as const,
      timestamp: new Date().toISOString(),
      location,
    }));
    await apiFetch('/api/attendance', {
      method: 'POST',
      body: JSON.stringify(records),
    });
  },

  // ── User mutations ──
  updateStudentAcademic: async (studentId: string, updates: Partial<User>): Promise<void> => {
    await apiFetch(`/api/users/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  approveStudent: async (studentId: string): Promise<void> => {
    await apiFetch(`/api/users/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });
  },

  rejectStudent: async (studentId: string): Promise<void> => {
    await apiFetch(`/api/users/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' }),
    });
  },

  deleteUser: async (userId: string): Promise<void> => {
    await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
  },


  // ── Class management ──
  createClass: async (course: string, semester: string, section: string, subject: string, teacherId: string): Promise<Class> => {
    return apiFetch<Class>('/api/classes', {
      method: 'POST',
      body: JSON.stringify({ course, semester, section, subject, teacherId }),
    });
  },

  deleteClass: async (classId: string): Promise<void> => {
    await apiFetch(`/api/classes/${classId}`, { method: 'DELETE' });
  },
};

// ──────────────────────────────────────────────────────────────
// authService — login looks up from MongoDB via API
// ──────────────────────────────────────────────────────────────
export const authService = {
  signup: async (userData: Partial<User> & { email: string }): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      return await apiFetch<{ success: boolean; user?: User; error?: string }>('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  login: async (email: string): Promise<User | null> => {
    const users = await dataStore.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      if (user.status === 'pending') throw new Error('Account pending approval.');
      if (user.status === 'rejected') throw new Error('Account rejected.');
      if (typeof window !== 'undefined') {
        localStorage.setItem('av_current_user', JSON.stringify(user));
      }
      return user;
    }
    return null;
  },

  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('av_current_user');
  },

  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('av_current_user');
    return stored ? JSON.parse(stored) : null;
  },

  /** Re-fetches the current user from MongoDB and updates localStorage. */
  refreshCurrentUser: async (): Promise<User | null> => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('av_current_user');
    if (!stored) return null;
    const cached: User = JSON.parse(stored);
    try {
      const users = await dataStore.getUsers();
      const fresh = users.find(u => u.id === cached.id);
      if (fresh) {
        localStorage.setItem('av_current_user', JSON.stringify(fresh));
        return fresh;
      }
    } catch {
      // Return cached if API fails
    }
    return cached;
  },
};
