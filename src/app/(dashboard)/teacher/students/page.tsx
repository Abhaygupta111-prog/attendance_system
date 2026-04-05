
"use client"

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRightLeft, Trash2, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { dataStore } from '@/lib/store';
import { User, Class } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const ALL = '__all__';

export default function StudentDirectory() {
  const [students, setStudents] = useState<User[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter state
  const [filterCourse, setFilterCourse] = useState(ALL);
  const [filterSemester, setFilterSemester] = useState(ALL);
  const [filterSection, setFilterSection] = useState(ALL);

  // Edit dialog
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editCourse, setEditCourse] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editSection, setEditSection] = useState('');

  // Delete dialog
  const [deletingStudent, setDeletingStudent] = useState<User | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  const loadData = async () => {
    const allUsers = await dataStore.getUsers();
    const activeStudents = allUsers.filter(u => u.role === 'student' && u.status === 'active');
    setStudents(activeStudents);
    const classes = await dataStore.getClasses();
    setAllClasses(classes);
  };

  useEffect(() => { loadData(); }, []);

  // Derive unique filter options from all students + classes
  const { courseOptions, semesterOptions, sectionOptions } = useMemo(() => {
    const source = [
      ...allClasses.map(c => ({ course: c.course, semester: c.semester, section: c.section })),
      ...students.map(s => ({ course: s.course, semester: s.semester, section: s.section })),
    ];
    return {
      courseOptions: Array.from(new Set(source.map(d => d.course).filter(Boolean) as string[])).sort(),
      semesterOptions: Array.from(new Set(source.map(d => d.semester).filter(Boolean) as string[])).sort(),
      sectionOptions: Array.from(new Set(source.map(d => d.section).filter(Boolean) as string[])).sort(),
    };
  }, [students, allClasses]);

  // ── Filtered students ──────────────────────────────────────────
  const filteredStudents = useMemo(() => students.filter(s => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.course ?? '').toLowerCase().includes(q);
    const matchCourse   = filterCourse   === ALL || s.course   === filterCourse;
    const matchSemester = filterSemester === ALL || s.semester === filterSemester;
    const matchSection  = filterSection  === ALL || s.section  === filterSection;
    return matchSearch && matchCourse && matchSemester && matchSection;
  }), [students, searchTerm, filterCourse, filterSemester, filterSection]);

  const activeFilters = [filterCourse, filterSemester, filterSection].filter(v => v !== ALL).length;

  const clearFilters = () => {
    setFilterCourse(ALL);
    setFilterSemester(ALL);
    setFilterSection(ALL);
    setSearchTerm('');
  };

  // ── Reassign ───────────────────────────────────────────────────
  const handleEditClick = (student: User) => {
    setEditingStudent(student);
    setEditCourse(student.course || '');
    setEditSemester(student.semester || '');
    setEditSection(student.section || '');
    setIsEditOpen(true);
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    await dataStore.updateStudentAcademic(editingStudent.id, {
      course: editCourse,
      semester: editSemester,
      section: editSection,
    });
    toast({ title: 'Student Updated', description: `${editingStudent.name} reassigned to ${editCourse} Sem ${editSemester} Sec ${editSection}.` });
    setIsEditOpen(false);
    loadData();
  };

  // ── Delete ─────────────────────────────────────────────────────
  const handleDeleteClick = (student: User) => {
    setDeletingStudent(student);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deletingStudent.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error);
      }
      toast({ title: '🗑️ Student Deleted', description: `${deletingStudent.name} has been removed.` });
      setIsDeleteOpen(false);
      setDeletingStudent(null);
      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      <Header title="Student Directory" />

      <div className="px-8 space-y-5">
        {/* ── Header row ─────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Manage Students</h2>
            <p className="text-muted-foreground text-sm">
              {filteredStudents.length} of {students.length} students shown
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, course..."
              className="pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* ── Filter bar ─────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs font-medium text-muted-foreground">Course</Label>
                <Select value={filterCourse} onValueChange={setFilterCourse}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Courses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Courses</SelectItem>
                    {courseOptions.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 min-w-[130px]">
                <Label className="text-xs font-medium text-muted-foreground">Semester</Label>
                <Select value={filterSemester} onValueChange={setFilterSemester}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Semesters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Semesters</SelectItem>
                    {semesterOptions.map(s => (
                      <SelectItem key={s} value={s}>Semester {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 min-w-[120px]">
                <Label className="text-xs font-medium text-muted-foreground">Section</Label>
                <Select value={filterSection} onValueChange={setFilterSection}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Sections</SelectItem>
                    {sectionOptions.map(s => (
                      <SelectItem key={s} value={s}>Section {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={clearFilters}>
                  <X size={14} /> Clear filters
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeFilters}</Badge>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Table ──────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Face</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                      No students match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map(student => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={student.avatar || `https://picsum.photos/seed/${student.id}/40/40`}
                            alt={student.name}
                            className="w-10 h-10 rounded-full border bg-muted object-cover"
                          />
                          <div>
                            <p className="font-semibold">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-primary uppercase text-sm">{student.course || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{student.semester ? `Sem ${student.semester}` : 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold uppercase">{student.section || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        {student.faceEnrolled
                          ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><ShieldCheck size={13} /> Enrolled</span>
                          : <span className="flex items-center gap-1 text-xs text-muted-foreground">Not enrolled</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-primary hover:bg-primary/5"
                            onClick={() => handleEditClick(student)}
                          >
                            <ArrowRightLeft size={13} /> Reassign
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-destructive hover:bg-destructive/5"
                            onClick={() => handleDeleteClick(student)}
                          >
                            <Trash2 size={13} /> Delete
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

      {/* ── Reassign Dialog ──────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Student</DialogTitle>
            <DialogDescription>Move <strong>{editingStudent?.name}</strong> to a different academic group.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select onValueChange={setEditCourse} value={editCourse}>
                <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                <SelectContent>
                  {courseOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Semester</Label>
                <Select onValueChange={setEditSemester} value={editSemester}>
                  <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                  <SelectContent>
                    {semesterOptions.map(s => <SelectItem key={s} value={s}>Sem {s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select onValueChange={setEditSection} value={editSection}>
                  <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
                  <SelectContent>
                    {sectionOptions.map(s => <SelectItem key={s} value={s}>Sec {s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateStudent} disabled={!editCourse || !editSemester || !editSection}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────────── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="text-destructive" size={20} />
              </div>
              <DialogTitle>Delete Student</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deletingStudent?.name}</strong>? This will remove their account and all attendance records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting} className="gap-2">
              <Trash2 size={14} />
              {isDeleting ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
