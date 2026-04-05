
"use client"

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { FileDown, Filter, Calendar, MapPin, ExternalLink, Clock } from 'lucide-react';
import { dataStore, authService } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { User, Class, AttendanceRecord } from '@/lib/types';

export default function ClassReports() {
  const user = authService.getCurrentUser();
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);

  useEffect(() => {
    const load = async () => {
      const [allClasses, att, allUsers] = await Promise.all([
        dataStore.getClasses(),
        dataStore.getAttendance(),
        dataStore.getUsers(),
      ]);
      setClasses(allClasses.filter(c => c.teacherId === user?.id));
      setAttendance(att);
      setAllStudents(allUsers.filter(u => u.role === 'student'));
    };
    load();
  }, []);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<{
    student: User;
    classSubject: string;
    records: AttendanceRecord[];
  } | null>(null);

  const handleShowDetails = (student: User, cls: Class) => {

    const studentRecords = attendance
      .filter(a => a.studentId === student.id && a.classId === cls.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    setSelectedDetails({
      student,
      classSubject: cls.subject,
      records: studentRecords
    });
    setIsDetailsOpen(true);
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Class Reports" />
      
      <div className="px-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Attendance Analytics</h2>
            <p className="text-muted-foreground text-sm">Downloadable reports for your assigned classes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Filter size={18} /> Filter
            </Button>
            <Button className="gap-2 bg-accent hover:bg-accent/90">
              <FileDown size={18} /> Export All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {classes.length === 0 ? (
            <Card className="border-dashed p-12 text-center text-muted-foreground">
              <p>No classes found to generate reports.</p>
            </Card>
          ) : (
            classes.map(cls => {
              const classAttendance = attendance.filter(a => a.classId === cls.id);
              const classStudents = allStudents.filter(s => 
                s.course === cls.course && 
                s.semester === cls.semester && 
                s.section === cls.section
              );
              
              return (
                <Card key={cls.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{cls.subject}</CardTitle>
                      <CardDescription>
                        {cls.course} {cls.semester}{cls.section} • {classStudents.length} Students enrolled
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Calendar size={14} /> Full Schedule
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Attendance Rate</TableHead>
                          <TableHead>Latest Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStudents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">
                              No students enrolled in this group.
                            </TableCell>
                          </TableRow>
                        ) : (
                          classStudents.map(student => {
                            const studentAtt = classAttendance.filter(a => a.studentId === student.id);
                            // Simulating a base of 10 classes for rate calculation
                            const rate = Math.min(100, Math.round((studentAtt.length / 10) * 100));
                            const latest = studentAtt[studentAtt.length - 1];

                            return (
                              <TableRow key={student.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-3">
                                    <img 
                                      src={student.avatar || `https://picsum.photos/seed/${student.id}/40/40`} 
                                      className="w-8 h-8 rounded-full border bg-muted" 
                                      alt="" 
                                    />
                                    {student.name}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${rate > 80 ? 'bg-accent' : 'bg-primary'}`} 
                                        style={{ width: `${rate}%` }} 
                                      />
                                    </div>
                                    <span className="text-xs font-bold">{rate}%</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {latest ? (
                                    <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                                      {latest.status.toUpperCase()}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">No Data</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleShowDetails(student, cls)}
                                  >
                                    Details
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Attendance Details</DialogTitle>
            <DialogDescription>
              Detailed records for <strong>{selectedDetails?.student.name}</strong> in {selectedDetails?.classSubject}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedDetails?.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                      No attendance records found for this student.
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedDetails?.records.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {new Date(record.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-muted-foreground" />
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-accent/10 text-accent uppercase text-[10px]">
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.location ? (
                          <a 
                            href={`https://www.google.com/maps?q=${record.location.lat},${record.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium bg-primary/5 p-1.5 rounded"
                          >
                            <MapPin size={14} />
                            View on Map
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground italic px-1.5">N/A (Local Scan)</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="mt-6">
            <Button onClick={() => setIsDetailsOpen(false)}>Close Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
