"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Camera, 
  History, 
  Settings, 
  LogOut,
  BarChart3,
  UserCircle,
  UserCheck,
  PlusCircle,
  GraduationCap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { authService } from '@/lib/store';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  user: User;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    authService.logout();
    router.push('/login');
  };

  const navItems = {
    admin: [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { name: 'Manage Teachers', href: '/admin/teachers', icon: Users },
      { name: 'Manage Students', href: '/admin/students', icon: UserCircle },
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    ],
    teacher: [
      { name: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
      { name: 'Attendance Session', href: '/teacher/attendance', icon: Camera },
      { name: 'Student Approvals', href: '/teacher/approvals', icon: UserCheck },
      { name: 'Student Directory', href: '/teacher/students', icon: GraduationCap },
      { name: 'Manage Classes', href: '/teacher/classes', icon: PlusCircle },
      { name: 'Class Reports', href: '/teacher/reports', icon: BookOpen },
    ],
    student: [
      { name: 'My Profile', href: '/student', icon: UserCircle },
      { name: 'Attendance History', href: '/student/history', icon: History },
      { name: 'Enroll Face', href: '/student/enroll', icon: Camera },
    ]
  };

  const currentNav = navItems[user.role as keyof typeof navItems] || [];

  return (
    <aside className="w-64 bg-white border-r h-screen flex flex-col fixed left-0 top-0 z-40">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">V</div>
          <span className="text-xl font-bold text-primary">AttendVerify</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
        {currentNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
              pathname === item.href 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t space-y-4">
        <div className="flex items-center gap-3 px-4 py-2">
          <img 
            src={user.avatar || `https://picsum.photos/seed/${user.id}/40/40`} 
            alt={user.name} 
            className="w-10 h-10 rounded-full bg-muted border"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
