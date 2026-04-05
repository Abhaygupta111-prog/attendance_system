"use client"

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { PlusCircle, BookOpen, Users, Trash2, Plus, X, Search } from 'lucide-react';
import { dataStore, authService } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Class, User } from '@/lib/types';

export default function ManageClasses() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isViewStudentsOpen, setIsViewStudentsOpen] = useState(false);
  
  // Base fields
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  
  // Multiple subjects
  const [subjects, setSubjects] = useState<string[]>(['']);
  
  const { toast } = useToast();
  const user = authService.getCurrentUser();

  const [classStudentCache, setClassStudentCache] = useState<Record<string, User[]>>({});

  const loadClasses = async () => {
    const all = await dataStore.getClasses();
    const filtered = all.filter(c => c.teacherId === user?.id);
    setClasses(filtered);
    // Load students for class display
    const allUsers = await dataStore.getUsers();
    const cache: Record<string, User[]> = {};
    filtered.forEach(cls => {
      cache[cls.id] = allUsers.filter(u =>
        u.role === 'student' &&
        u.status === 'active' &&
        u.course === cls.course &&
        u.semester === cls.semester &&
        u.section === cls.section
      );
    });
    setClassStudentCache(cache);
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const handleAddSubjectField = () => {
    setSubjects([...subjects, '']);
  };

  const handleRemoveSubjectField = (index: number) => {
    if (subjects.length > 1) {
      const newSubjects = subjects.filter((_, i) => i !== index);
      setSubjects(newSubjects);
    }
  };

  const handleUpdateSubjectField = (index: number, value: string) => {
    const newSubjects = [...subjects];
    newSubjects[index] = value;
    setSubjects(newSubjects);
  };

  const handleCreateClass = async () => {
    const validSubjects = subjects.filter(s => s.trim() !== '');
    
    if (!course || !semester || !section || validSubjects.length === 0 || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all fields and at least one subject.' });
      return;
    }

    // Create a class record for each subject
    await Promise.all(validSubjects.map(subjectName =>
      dataStore.createClass(course, semester, section, subjectName, user.id)
    ));

    toast({
      title: "Classes Created",
      description: `Added ${validSubjects.length} subjects for ${course} ${semester}${section}.`,
    });
    
    // Reset state
    setCourse('');
    setSemester('');
    setSection('');
    setSubjects(['']);
    setIsDialogOpen(false);
    loadClasses();
  };

  const handleDeleteClass = async (classId: string) => {
    await dataStore.deleteClass(classId);
    toast({
      title: "Class Deleted",
      description: "The class has been successfully removed.",
    });
    loadClasses();
  };

  const getStudentsForClass = (cls: Class) => {
    return classStudentCache[cls.id] || [];
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Manage Classes" />
      
      <div className="px-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Classroom Management</h2>
            <p className="text-muted-foreground text-sm">Organize subjects by Course, Semester, and Section</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg">
                <PlusCircle size={18} />
                Create New Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Class</DialogTitle>
                <DialogDescription>Enter the academic details and subjects for this session.</DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="course">Course Name</Label>
                  <Input 
                    id="course" 
                    placeholder="e.g. BCA" 
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="semester">Semester</Label>
                  <Input 
                    id="semester" 
                    placeholder="e.g. 6" 
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="section">Section</Label>
                  <Input 
                    id="section" 
                    placeholder="e.g. A" 
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  />
                </div>
                
                <div className="col-span-2 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <Label>Subjects</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 gap-1 text-primary" 
                      onClick={handleAddSubjectField}
                    >
                      <Plus size={14} /> Add Subject
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {subjects.map((sub, index) => (
                      <div key={index} className="flex gap-2">
                        <Input 
                          placeholder="e.g. Programming" 
                          value={sub}
                          onChange={(e) => handleUpdateSubjectField(index, e.target.value)}
                        />
                        {subjects.length > 1 && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive h-10 w-10 shrink-0"
                            onClick={() => handleRemoveSubjectField(index)}
                          >
                            <X size={16} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateClass}>Create Class</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.length === 0 ? (
            <Card className="col-span-full border-dashed p-12 text-center text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>You haven't created any classes yet.</p>
              <Button variant="link" onClick={() => setIsDialogOpen(true)}>Create your first class now</Button>
            </Card>
          ) : (
            classes.map((cls) => {
              const classStudents = getStudentsForClass(cls);
              return (
                <Card key={cls.id} className="group hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <BookOpen size={20} />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-muted rounded uppercase">
                        {cls.course} {cls.semester}{cls.section}
                      </span>
                    </div>
                    <CardTitle className="pt-4">{cls.subject}</CardTitle>
                    <CardDescription>
                      Academic Group ID: {cls.id.split('-').slice(0, 3).join('-')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users size={14} />
                      {classStudents.length} Students enrolled
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedClass(cls);
                        setIsViewStudentsOpen(true);
                      }}
                    >
                      View Students
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteClass(cls.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={isViewStudentsOpen} onOpenChange={setIsViewStudentsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Students in {selectedClass?.subject}</DialogTitle>
            <DialogDescription>
              {selectedClass?.course} • Semester {selectedClass?.semester} • Section {selectedClass?.section}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            {selectedClass && getStudentsForClass(selectedClass).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground italic">
                No students enrolled in this academic group yet.
              </div>
            ) : (
              <div className="space-y-4">
                {selectedClass && getStudentsForClass(selectedClass).map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/20">
                    <div className="flex items-center gap-3">
                      <img src={student.avatar} className="w-10 h-10 rounded-full border bg-white" alt="" />
                      <div>
                        <p className="font-bold">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 bg-accent/10 text-accent rounded-full">ACTIVE</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsViewStudentsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}