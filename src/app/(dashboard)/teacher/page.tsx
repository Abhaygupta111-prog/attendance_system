
"use client"

import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Camera, Users, History, Play, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { dataStore, authService } from '@/lib/store';
import { useEffect, useState } from 'react';
import { Class } from '@/lib/types';

export default function TeacherDashboard() {
  const [user, setUser] = useState<any>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
      
      const allClasses = await dataStore.getClasses();
      setClasses(allClasses.filter((c: any) => c.teacherId === currentUser?.id));
      
      const allUsers = await dataStore.getUsers();
      setPendingCount(allUsers.filter(u => u.role === 'student' && u.status === 'pending').length);
    };
    load();
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Teacher Dashboard" />
      
      <div className="px-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0]}!</h2>
            <p className="text-muted-foreground">You have {classes.length} active classes today.</p>
          </div>
          <Link href="/teacher/attendance">
            <Button size="lg" className="gap-2 shadow-lg hover:shadow-primary/20">
              <Camera className="w-5 h-5" />
              Start Attendance
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary text-primary-foreground border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-80">Assigned Classes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{classes.length}</div>
              <div className="mt-4 flex items-center gap-2 text-xs opacity-70">
                <BookOpen className="w-3 h-3" />
                Updated this semester
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Class Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">92%</div>
              <div className="mt-4 flex items-center gap-2 text-xs text-accent font-medium">
                <TrendingUp className="w-3 h-3" />
                Above target (85%)
              </div>
            </CardContent>
          </Card>

          <Card className={pendingCount > 0 ? "border-accent ring-1 ring-accent/20" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${pendingCount > 0 ? "text-accent" : ""}`}>
                {pendingCount}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                {pendingCount > 0 ? "New students awaiting review" : "All registration requests cleared"}
              </div>
            </CardContent>
          </Card>
        </div>

        <h3 className="text-lg font-semibold mt-12 mb-4">Your Classes</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {classes.length === 0 ? (
            <Card className="col-span-full border-dashed p-12 text-center text-muted-foreground">
              <p>No classes assigned yet.</p>
              <Link href="/teacher/classes">
                <Button variant="link">Create your first class</Button>
              </Link>
            </Card>
          ) : (
            classes.map((cls: Class) => (
              <Card key={cls.id} className="hover:shadow-md transition-shadow group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-white transition-colors">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-muted rounded-full">
                      {cls.course} {cls.semester}{cls.section}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold mb-1">{cls.subject}</h4>
                  <p className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {cls.studentIds?.length || 0} Students enrolled
                  </p>
                  <div className="flex gap-3">
                    <Link href={`/teacher/attendance?classId=${cls.id}`} className="flex-1">
                      <Button className="w-full gap-2" variant="default">
                        <Play className="w-4 h-4 fill-current" />
                        Mark Attendance
                      </Button>
                    </Link>
                    <Button variant="outline" size="icon">
                      <History className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
