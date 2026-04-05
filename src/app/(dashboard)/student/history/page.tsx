
"use client"

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Clock, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { dataStore, authService } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { AttendanceRecord } from '@/lib/types';

export default function StudentHistory() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (!user) return;
    dataStore.getAttendance({ studentId: user.id }).then(records => {
      const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAttendance(sorted);
    });
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Attendance History" />
      
      <div className="px-8 space-y-6">
        <div className="flex items-center gap-4">
          <Card className="flex-1 bg-accent/5 border-accent/10">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-accent/10 text-accent rounded-xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total Present</p>
                <p className="text-2xl font-black">{attendance.filter(a => a.status === 'present').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 bg-primary/5 border-primary/10">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Late Arrivals</p>
                <p className="text-2xl font-black">{attendance.filter(a => a.status === 'late').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 bg-muted">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-muted-foreground/10 text-muted-foreground rounded-xl">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Recent Streak</p>
                <p className="text-2xl font-black">5 Days</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detailed Log</CardTitle>
            <CardDescription>A complete list of your verified attendance sessions</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Verification Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      No records found yet. Start attending classes to see your history.
                    </TableCell>
                  </TableRow>
                ) : (
                  attendance.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {new Date(record.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-primary">{record.classId}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock size={14} />
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={record.status === 'present' ? 'default' : 'secondary'}
                          className={record.status === 'present' ? 'bg-accent hover:bg-accent' : ''}
                        >
                          {record.status.toUpperCase()}
                        </Badge>
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
