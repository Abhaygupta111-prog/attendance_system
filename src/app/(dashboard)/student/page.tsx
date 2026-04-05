
"use client"

import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Calendar, 
  CheckCircle2, 
  User as UserIcon, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Radio,
  Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { authService, dataStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import { LiveSession, User } from '@/lib/types';

export default function StudentDashboard() {
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  
  const totalClasses = 24;
  const attendancePercentage = attendance.length > 0 ? Math.round((attendance.length / totalClasses) * 100) : 0;

  const getAttendanceLabel = (pct: number) => {
    if (pct >= 85) return { label: 'Excellent', color: 'text-green-600' };
    if (pct >= 75) return { label: 'Good',      color: 'text-blue-600'  };
    if (pct >= 60) return { label: 'Average',   color: 'text-yellow-600'};
    return              { label: 'Low',       color: 'text-red-500'  };
  };
  const { label: attLabel, color: attColor } = getAttendanceLabel(attendancePercentage);

  useEffect(() => {
    const load = async () => {
      // Refresh from MongoDB so avatar/status changes appear immediately
      const currentUser = await authService.refreshCurrentUser() ?? authService.getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const records = await dataStore.getAttendance({ studentId: currentUser.id });
        setAttendance(records);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!user) return;

    const checkSessions = async () => {
      const academicGroup = `${user.course} ${user.semester}${user.section}`;
      const sessions = await dataStore.getLiveSessions();
      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
      const live = sessions.find(s =>
        s.isActive &&
        s.academicGroup === academicGroup &&
        new Date(s.startTime).getTime() > fourHoursAgo  // must be recent
      );

      setActiveSession(prev => {
        // Only update state if the session actually changed to avoid re-render loops
        if (live?.id === prev?.id && live?.isActive === prev?.isActive) return prev;
        return live || null;
      });
    };

    checkSessions();
    const interval = setInterval(checkSessions, 5000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Student Profile" />
      
      <div className="px-8 space-y-8">
        {activeSession && (
          <Card className="border-accent bg-accent/5 ring-1 ring-accent animate-pulse">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/10 text-accent rounded-full">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-accent">Live Attendance Session!</h3>
                  <p className="text-sm text-muted-foreground">
                    Teacher is taking attendance for <strong>{activeSession.subject}</strong>
                  </p>
                </div>
              </div>
              <Link href={`/student/verify?sessionId=${activeSession.id}`}>
                <Button className="bg-accent hover:bg-accent/90 gap-2">
                  <Camera size={18} /> Join & Verify Now
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 overflow-hidden">
            <div className="h-32 bg-primary relative">
               <div className="absolute -bottom-12 left-8 p-1 bg-white rounded-2xl shadow-lg">
                 <img src={user?.avatar || `https://picsum.photos/seed/${user?.id}/100/100`} alt={user?.name} className="w-24 h-24 rounded-xl border object-cover" />
               </div>
            </div>
            <CardContent className="pt-16 pb-8 space-y-6">
              <div>
                <h3 className="text-2xl font-bold">{user?.name}</h3>
                <p className="text-muted-foreground">Course: {user?.course} | Sec: {user?.section}</p>
              </div>
              <div className="space-y-3 pt-4 border-t">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-muted-foreground">Status</span>
                   <span className="text-accent font-semibold flex items-center gap-1">
                     <ShieldCheck className="w-4 h-4" /> Verified
                   </span>
                 </div>
              </div>
              <Link href="/student/enroll">
                <Button variant="outline" className="w-full mt-4">Update Face Data</Button>
              </Link>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      Attendance Health
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                     <div className="flex items-end gap-3">
                        <span className="text-4xl font-bold">{attendancePercentage}%</span>
                        <span className={`text-sm font-semibold pb-1 ${attColor}`}>{attLabel}</span>
                     </div>
                     <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                       <div
                         className={`h-full rounded-full transition-all duration-700 ${
                           attendancePercentage >= 85 ? 'bg-green-500' :
                           attendancePercentage >= 75 ? 'bg-blue-500' :
                           attendancePercentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                         }`}
                         style={{ width: `${attendancePercentage}%` }}
                       />
                     </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      Days Present
                      <Calendar className="w-4 h-4 text-primary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-3">
                       <span className="text-4xl font-bold">{attendance.length}</span>
                       <span className="text-sm text-muted-foreground pb-1">Records</span>
                    </div>
                  </CardContent>
                </Card>
             </div>

             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recent History</CardTitle>
                  <Link href="/student/history">
                    <Button variant="ghost" size="sm">View All <ArrowRight className="ml-1 w-4 h-4" /></Button>
                  </Link>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {attendance.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm italic">
                        No attendance records found yet.
                      </div>
                    ) : (
                      attendance.slice(-5).reverse().map((record: any) => (
                        <div key={record.id} className="flex items-center justify-between p-4 px-6 hover:bg-muted/30">
                          <div className="flex items-center gap-4">
                            <Clock className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-semibold">{record.classId.split('-').slice(3, -1).join(' ')}</p>
                              <p className="text-xs text-muted-foreground">{new Date(record.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-accent/10 text-accent rounded-full uppercase">
                            {record.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
