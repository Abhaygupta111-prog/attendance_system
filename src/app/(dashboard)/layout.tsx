
"use client"

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { authService } from '@/lib/store';
import { User } from '@/lib/types';
import { Toaster } from '@/components/ui/toaster';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const load = async () => {
      const cached = authService.getCurrentUser();
      if (!cached) {
        router.push('/login');
        return;
      }
      // Always show cached first (instant), then refresh from MongoDB in background
      setUser(cached);
      const fresh = await authService.refreshCurrentUser();
      if (fresh) setUser(fresh);
    };
    load();
  }, [router, pathname]); // re-run on route change so avatar updates after enrollment

  if (!user) return null;

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 ml-64 min-h-screen">
        {children}
        <Toaster />
      </main>
    </div>
  );
}
