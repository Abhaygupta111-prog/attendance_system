
"use client"

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, StopCircle, Radio, Send, Clock, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dataStore, authService } from '@/lib/store';
import { User, Class, LiveSession } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';

export default function AttendanceSession() {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classes, setClasses] = useState<Class[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [checkedInStudents, setCheckedInStudents] = useState<User[]>([]);
  const [attendanceSubmitted, setAttendanceSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const teacher = authService.getCurrentUser();
  const { toast } = useToast();

  // Load classes and users on mount
  useEffect(() => {
    const load = async () => {
      const [cls, users] = await Promise.all([dataStore.getClasses(), dataStore.getUsers()]);
      setClasses(cls);
      setAllUsers(users);
    };
    load();
  }, []);

  // Poll for students who have verified attendance during this session
  useEffect(() => {
    if (!activeSession || !selectedClassId) return;

    const fetchCheckedIn = async () => {
      const records = await dataStore.getAttendance({ classId: selectedClassId });
      // Only show students who checked in today
      const today = new Date().toDateString();
      const todayRecords = records.filter(r =>
        new Date(r.date).toDateString() === today && r.status === 'present'
      );
      const studentIds = new Set(todayRecords.map((r: any) => r.studentId));
      const present = allUsers.filter(u => studentIds.has(u.id));
      setCheckedInStudents(present);
    };

    fetchCheckedIn();
    const interval = setInterval(fetchCheckedIn, 4000); // poll every 4 seconds
    return () => clearInterval(interval);
  }, [activeSession, selectedClassId, allUsers]);

  const startBroadcast = async () => {
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls || !teacher) return;
    setIsLoading(true);
    try {
      const session = await dataStore.startSession(
        cls.id,
        teacher.id,
        cls.subject,
        `${cls.course} ${cls.semester}${cls.section}`
      );
      setActiveSession(session);
      setCheckedInStudents([]);
      setAttendanceSubmitted(false);
      toast({ title: '📡 Broadcast Started', description: `Students in ${cls.subject} have been notified. They can now verify attendance.` });
    } finally {
      setIsLoading(false);
    }
  };

  const endBroadcast = async () => {
    if (!activeSession) return;
    await dataStore.endSession(activeSession.id);
    setActiveSession(null);
    toast({ title: 'Broadcast Ended', description: 'Session closed. Students can no longer check in.' });
  };

  const handleSubmitAttendance = async () => {
    if (checkedInStudents.length === 0) return;
    setAttendanceSubmitted(true);
    toast({
      title: '✅ Attendance Submitted',
      description: `${checkedInStudents.length} student(s) marked present for today.`,
    });
    await endBroadcast();
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Attendance Session" />

      <div className="px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left column: Session control ───────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2 border-primary/10">
            <CardHeader className="bg-muted/30">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Live Attendance Session</CardTitle>
                  <CardDescription>
                    {activeSession
                      ? `Broadcasting — students can verify via their devices`
                      : `Select a class and start broadcasting to allow student check-ins`}
                  </CardDescription>
                </div>
                <Select onValueChange={setSelectedClassId} value={selectedClassId} disabled={!!activeSession}>
                  <SelectTrigger className="w-64 bg-white">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c, idx) => (
                      <SelectItem key={`${c.id}-${idx}`} value={c.id}>
                        {c.subject} ({c.course} {c.semester}{c.section})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            {/* Session status banner */}
            <CardContent className="p-6 space-y-6">
              <div className={`rounded-2xl p-6 flex items-center gap-6 transition-all ${
                activeSession
                  ? 'bg-accent/5 border-2 border-accent/30'
                  : 'bg-muted/50 border-2 border-dashed border-muted-foreground/20'
              }`}>
                <div className={`p-4 rounded-full ${activeSession ? 'bg-accent/10' : 'bg-muted'}`}>
                  <Radio className={`w-8 h-8 ${activeSession ? 'text-accent animate-pulse' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  {activeSession ? (
                    <>
                      <p className="font-bold text-lg text-accent">Session Active</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Students in <strong>{activeSession.academicGroup}</strong> can see the notification and verify attendance from their devices.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <RefreshCw size={11} className="animate-spin" />
                        Auto-refreshing check-ins every 4 seconds
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-muted-foreground">No active session</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select a class above, then click "Start Broadcast" to notify students.
                      </p>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant={activeSession ? 'destructive' : 'default'}
                    className="gap-2 min-w-[160px]"
                    onClick={activeSession ? endBroadcast : startBroadcast}
                    disabled={!selectedClassId || isLoading}
                  >
                    {activeSession
                      ? <><StopCircle size={16} /> End Broadcast</>
                      : <><Radio size={16} /> Start Broadcast</>
                    }
                  </Button>
                </div>
              </div>

              {/* How it works */}
              {!activeSession && (
                <div className="grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
                  {[
                    { step: '1', label: 'Select class & start broadcast' },
                    { step: '2', label: 'Students see notification on their dashboard' },
                    { step: '3', label: 'Students verify face + GPS on their device' },
                  ].map(({ step, label }) => (
                    <div key={step} className="bg-muted/40 rounded-xl p-4">
                      <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mx-auto mb-2">{step}</div>
                      <p>{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            {/* Status bar */}
            <div className="px-6 py-3 bg-muted/30 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedClass
                  ? `Class: ${selectedClass.subject} · ${selectedClass.course} Sem ${selectedClass.semester} Sec ${selectedClass.section}`
                  : 'No class selected'}
              </span>
              <div className="flex items-center gap-2 font-medium uppercase">
                <div className={`w-2 h-2 rounded-full ${activeSession ? 'bg-accent animate-pulse' : 'bg-muted-foreground'}`} />
                {activeSession ? 'BROADCASTING' : 'IDLE'}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right column: Verified students ─────────────────── */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Verified Students
              {checkedInStudents.length > 0 && (
                <Badge variant="secondary" className="text-accent border-accent/30">
                  {checkedInStudents.length} present
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {activeSession
                ? 'Students who completed face + GPS verification'
                : 'Start a session to track check-ins'}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto">
            {checkedInStudents.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Users className="w-10 h-10 opacity-20" />
                <p className="text-sm italic">
                  {activeSession ? 'Waiting for students to check in...' : 'No session active'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {checkedInStudents.map(student => (
                  <div key={student.id} className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl">
                    <img
                      src={student.avatar || `https://picsum.photos/seed/${student.id}/40/40`}
                      className="w-10 h-10 rounded-full border object-cover"
                      alt={student.name}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{student.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock size={9} /> Verified today
                      </p>
                    </div>
                    <CheckCircle className="text-green-500 w-5 h-5 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <div className="p-4 border-t">
            <Button
              className="w-full h-11 gap-2"
              disabled={checkedInStudents.length === 0 || attendanceSubmitted}
              onClick={handleSubmitAttendance}
            >
              <Send size={15} />
              {attendanceSubmitted
                ? 'Attendance Submitted ✓'
                : `Submit Attendance (${checkedInStudents.length})`}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
