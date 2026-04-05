"use client"

import { useEffect, useState } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  GraduationCap, 
  CheckCircle2, 
  TrendingUp,
  FileDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { dataStore } from '@/lib/store';

export default function AdminDashboard() {
  const [teachersCount, setTeachersCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [activeSessionsCount, setActiveSessionsCount] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState("0%");
  const [chartData, setChartData] = useState<{name: string, count: number}[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [users, sessions, attendanceRecords] = await Promise.all([
          dataStore.getUsers(),
          dataStore.getLiveSessions(),
          dataStore.getAttendance()
        ]);

        setTeachersCount(users.filter((u: any) => u.role === 'teacher').length);
        const students = users.filter((u: any) => u.role === 'student');
        setStudentsCount(students.length);
        
        setActiveSessionsCount(sessions.filter((s: any) => s.isActive).length);

        // Compute avg attendance based on present records vs total student base
        // In a real app we'd map this per class schedule. 
        if (students.length > 0 && attendanceRecords.length > 0) {
          // Just a proxy metric for demo: Present Records per student limit to 100%
          const pct = Math.min(100, Math.round((attendanceRecords.length / (students.length * 5)) * 100));
          setAvgAttendance(`${pct}%`);
        } else {
          setAvgAttendance("0%");
        }

        // Build chart data - group attendance by date
        const dateCounts: Record<string, number> = {};
        const today = new Date();
        
        for (let i = 4; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const shortDay = d.toLocaleDateString('en-US', { weekday: 'short' });
          dateCounts[dateStr] = 0; // Initialize
          // we map this to shortDay later
        }

        attendanceRecords.forEach((r: any) => {
          if (dateCounts[r.date] !== undefined) {
            dateCounts[r.date]++;
          }
        });

        const newChartData = Object.keys(dateCounts).map(dateStr => {
          const d = new Date(dateStr);
          return {
            name: d.toLocaleDateString('en-US', { weekday: 'short' }),
            count: dateCounts[dateStr]
          };
        });

        setChartData(newChartData);

        // Build recent activities (Latest 4 sessions or attendance marks)
        const recent = sessions.slice(-4).reverse().map((s: any) => ({
          user: users.find(u => u.id === s.teacherId)?.name || 'Teacher',
          action: `started session for ${s.academicGroup}`,
          time: new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          role: 'Teacher'
        }));
        // Fallback info if 0 records
        if(recent.length === 0) {
            recent.push({ user: 'System', action: 'Ready for operation', time: 'Just now', role: 'Admin' });
        }
        setRecentActivities(recent.slice(0, 4));

      } catch (err) {
        console.error("Dashboard error", err);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Admin Overview" />
      
      <div className="px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teachersCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Active faculty</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <GraduationCap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{studentsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Enrolled globally</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgAttendance}</div>
              <p className="text-xs text-muted-foreground mt-1">Based on recent data</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSessionsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently live</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Attendance Trends</CardTitle>
                <p className="text-sm text-muted-foreground">Daily attendance counts for the last 5 days</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <FileDown className="w-4 h-4" />
                Export Data
              </Button>
            </CardHeader>
            <CardContent className="pt-4 h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f5f5f5'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#1ACCAC' : '#2B8BC3'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {recentActivities.map((activity, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">
                      <span className="font-semibold">{activity.user}</span> {activity.action}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-1.5 py-0.5 bg-muted rounded">{activity.role}</span>
                      <span>•</span>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
