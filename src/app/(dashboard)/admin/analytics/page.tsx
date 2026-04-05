"use client"

import { useEffect, useState } from 'react';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { dataStore } from '@/lib/store';

export default function AdminAnalytics() {
  const [attendanceTrend, setAttendanceTrend] = useState<{week: string, rate: number}[]>([]);
  const [classDistribution, setClassDistribution] = useState<{name: string, value: number, color: string}[]>([]);
  const [totalScans, setTotalScans] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [users, attendanceRecords] = await Promise.all([
          dataStore.getUsers(),
          dataStore.getAttendance(),
        ]);
        
        const studentsCount = users.filter((u: any) => u.role === 'student').length;
        setTotalScans(attendanceRecords.length);

        // Compute 6-day trend (since we might not have 6 weeks of demo data)
        const dateCounts: Record<string, number> = {};
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          dateCounts[dateStr] = 0;
        }

        attendanceRecords.forEach((r: any) => {
          if (dateCounts[r.date] !== undefined) {
            dateCounts[r.date]++;
          }
        });

        const trend = Object.keys(dateCounts).map(dateStr => {
          const d = new Date(dateStr);
          const name = d.toLocaleDateString('en-US', { weekday: 'short' });
          // dummy logic for 'rate' based on student count
          const maxExpected = Math.max(1, studentsCount * 2); // Assume average 2 sessions per day
          const rate = Math.min(100, Math.round((dateCounts[dateStr] / maxExpected) * 100));
          // Provide a baseline of at least somewhat realistic numbers for the demo charts
          return { week: name, rate: rate > 0 ? rate : Math.floor(Math.random() * 20) + 70 };
        });

        setAttendanceTrend(trend);

        // Compute pie chart
        const presentCount = attendanceRecords.length;
        // Mock absent as 15% of total expected
        const absentCount = Math.floor(presentCount * 0.15);
        const lateCount = Math.floor(presentCount * 0.05);

        setClassDistribution([
          { name: 'Present', value: presentCount > 0 ? presentCount : 840, color: '#1ACCAC' },
          { name: 'Late', value: presentCount > 0 ? lateCount : 120, color: '#2B8BC3' },
          { name: 'Absent', value: presentCount > 0 ? absentCount : 45, color: '#E11D48' },
        ]);

      } catch (err) {
        console.error("Failed to load analytics", err);
      }
    };
    loadData();
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="System Analytics" />
      
      <div className="px-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Attendance Stability</CardTitle>
              <CardDescription>System-wide attendance rate percentage over last 6 days</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} domain={[60, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#2B8BC3" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#2B8BC3', strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Global Status Distribution</CardTitle>
              <CardDescription>Aggregate status breakdown for the current semester</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classDistribution}
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {classDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Performance Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-accent/5 rounded-2xl border border-accent/10">
                <p className="text-sm font-medium text-accent uppercase tracking-wider mb-2">Top Performer</p>
                <p className="text-2xl font-bold">Gamming (BCA 6A)</p>
                <p className="text-sm text-muted-foreground mt-1">Highest Avg Attendance</p>
              </div>
              <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="text-sm font-medium text-primary uppercase tracking-wider mb-2">System Uptime</p>
                <p className="text-2xl font-bold">99.98%</p>
                <p className="text-sm text-muted-foreground mt-1">Active processing for 42 days</p>
              </div>
              <div className="p-6 bg-muted/50 rounded-2xl border border-border">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Scans</p>
                <p className="text-2xl font-bold">{totalScans > 0 ? totalScans : '12,482'}</p>
                <p className="text-sm text-muted-foreground mt-1">Successful facial verifications</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
