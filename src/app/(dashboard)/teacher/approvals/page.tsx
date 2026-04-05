
"use client"

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { UserCheck, UserX, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { dataStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/lib/types';

export default function StudentApprovals() {
  const [pendingStudents, setPendingStudents] = useState<User[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const loadStudents = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const users = await dataStore.getUsers();
      setPendingStudents(users.filter(u => u.role === 'student' && u.status === 'pending'));
      setLastUpdated(new Date());
    } finally {
      if (showSpinner) setIsRefreshing(false);
    }
  }, []);

  // Load on mount + auto-poll every 10 seconds for new registrations
  useEffect(() => {
    loadStudents();
    const interval = setInterval(() => loadStudents(), 10000);
    return () => clearInterval(interval);
  }, [loadStudents]);

  const handleApprove = async (studentId: string) => {
    await dataStore.approveStudent(studentId);
    toast({
      title: "Student Approved",
      description: "The student can now sign in to the system.",
    });
    loadStudents();
  };

  const handleReject = async (studentId: string) => {
    await dataStore.rejectStudent(studentId);
    toast({
      variant: "destructive",
      title: "Student Rejected",
      description: "The registration request has been dismissed.",
    });
    loadStudents();
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Student Approvals" />
      
      <div className="px-8 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Registration Requests</h2>
            <p className="text-muted-foreground text-sm">
              Approve new students to allow them access to the platform
              {lastUpdated && (
                <span className="ml-2 text-xs opacity-60">
                  · Last checked {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => loadStudents(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course / Section</TableHead>
                  <TableHead>Requested On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-accent/50" />
                        <p>No pending registration requests</p>
                        <p className="text-xs">Auto-refreshes every 10 seconds</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <img 
                            src={student.avatar} 
                            alt={student.name} 
                            className="w-10 h-10 rounded-full border bg-muted object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${student.id}/40/40`; }}
                          />
                          <div>
                            <p className="font-bold">{student.name}</p>
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-bold uppercase">
                              <Clock size={10} /> Pending
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{student.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.course ? (
                          <span className="text-xs font-medium">
                            {student.course} · Sem {student.semester} · Sec {student.section}
                          </span>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">Recent</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10"
                            onClick={() => handleReject(student.id)}
                          >
                            <UserX size={14} /> Reject
                          </Button>
                          <Button 
                            size="sm" 
                            className="gap-2"
                            onClick={() => handleApprove(student.id)}
                          >
                            <UserCheck size={14} /> Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
