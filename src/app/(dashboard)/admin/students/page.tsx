"use client"

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { UserPlus, MoreHorizontal, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { dataStore, authService } from '@/lib/store';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function ManageStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    course: '',
    semester: '',
    section: '',
    password: ''
  });

  const loadStudents = async () => {
    const users = await dataStore.getUsers();
    setStudents(users.filter((u: any) => u.role === 'student'));
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await authService.signup({
        name: formData.name,
        email: formData.email,
        password: formData.password as any, // bypassing ts check for password
        role: 'student',
        course: formData.course,
        semester: formData.semester,
        section: formData.section
      });

      if (res.success) {
        toast({ title: "Success", description: "Student registered successfully." });
        setIsRegisterOpen(false);
        setFormData({ name: '', email: '', course: '', semester: '', section: '', password: '' });
        loadStudents();
      } else {
        toast({ variant: "destructive", title: "Error", description: res.error || "Failed to register" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFace = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to reset face data for ${name}? They will need to re-enroll.`)) return;
    try {
      await dataStore.updateStudentAcademic(id, { descriptor: null as any, avatar: null as any });
      toast({ title: "Reset Complete", description: `Face data removed for ${name}` });
      loadStudents();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "Could not reset face data." });
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely sure you want to delete ${name}? This cannot be undone.`)) return;
    try {
      await dataStore.deleteUser(id);
      toast({ title: "Deleted", description: `Student ${name} removed from system.` });
      loadStudents();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "Could not delete student." });
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Manage Students" />
      
      <div className="px-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Student Registry</h2>
            <p className="text-muted-foreground text-sm">Monitor student enrollment and face data status</p>
          </div>
          <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus size={18} />
                Register Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Student</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRegister} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={6} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Input placeholder="e.g. BCA" value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Semester</Label>
                    <Input placeholder="e.g. 6" value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Input placeholder="e.g. A" value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} required />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  Register
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Student</TableHead>
                  <TableHead>Course/Sem/Sec</TableHead>
                  <TableHead>Face Enrollment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student: any) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <img 
                          src={student.avatar || `https://picsum.photos/seed/${student.id}/40/40`} 
                          alt={student.name} 
                          className="w-10 h-10 rounded-full border bg-muted object-cover"
                        />
                        <div>
                          <p className="font-bold">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-primary">
                        {student.course} {student.semester}-{student.section}
                      </span>
                    </TableCell>
                    <TableCell>
                      {student.descriptor ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="uppercase">Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-500">
                          <ShieldAlert className="w-4 h-4" />
                          <span className="uppercase">Pending</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleResetFace(student.id, student.name)}>
                            Reset Face Data
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeactivate(student.id, student.name)}>
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">
                      No students registered yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
