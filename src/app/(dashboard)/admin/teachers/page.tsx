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
import { UserPlus, MoreHorizontal, Mail, BookOpen, Loader2 } from 'lucide-react';
import { dataStore, authService } from '@/lib/store';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Class } from '@/lib/types';
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
import Link from 'next/link';

export default function ManageTeachers() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const loadData = async () => {
    const [users, cls] = await Promise.all([dataStore.getUsers(), dataStore.getClasses()]);
    setTeachers(users.filter((u: any) => u.role === 'teacher'));
    setClasses(cls);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await authService.signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'teacher',
      });

      if (res.success) {
        toast({ title: "Success", description: "Teacher registered successfully." });
        setIsRegisterOpen(false);
        setFormData({ name: '', email: '', password: '' });
        loadData();
      } else {
        toast({ variant: "destructive", title: "Error", description: res.error || "Failed to register" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove teacher ${name}? This cannot be undone.`)) return;
    try {
      await dataStore.deleteUser(id);
      toast({ title: "Removed", description: `Teacher ${name} removed from system.` });
      // If we remove teacher, they stay assigned to old classes, which might be okay.
      // But we just refresh UI
      loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not delete teacher." });
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Manage Teachers" />
      
      <div className="px-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Faculty Directory</h2>
            <p className="text-muted-foreground text-sm">Manage teaching staff and class assignments</p>
          </div>
          <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus size={18} />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Teacher</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRegister} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={6} />
                </div>
                <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  Register Teacher
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
                  <TableHead className="w-[300px]">Teacher</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Assigned Classes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher: any) => {
                  const teacherClasses = classes.filter(c => c.teacherId === teacher.id);
                  return (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <img 
                            src={teacher.avatar || `https://picsum.photos/seed/${teacher.id}/40/40`} 
                            alt={teacher.name} 
                            className="w-10 h-10 rounded-full border bg-muted object-cover"
                          />
                          <div>
                            <p className="font-bold">{teacher.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{teacher.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail size={14} />
                          {teacher.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {teacherClasses.map(c => (
                            <span key={c.id} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
                              {c.subject} ({c.course} {c.semester}{c.section})
                            </span>
                          ))}
                          {teacherClasses.length === 0 && <span className="text-xs text-muted-foreground italic">None</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal size={18} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Link href="/admin/classes" passHref>
                              <DropdownMenuItem className="gap-2 cursor-pointer">
                                <BookOpen size={14} /> Assign Class
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeactivate(teacher.id, teacher.name)}>
                              Remove Access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {teachers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">
                      No teachers registered yet.
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
