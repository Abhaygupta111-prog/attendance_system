
"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/store';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (!user) {
      router.push('/login');
    } else {
      if (user.role === 'admin') router.push('/admin');
      else if (user.role === 'teacher') router.push('/teacher');
      else router.push('/student');
    }
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse flex flex-col items-center">
         <div className="h-12 w-12 bg-primary rounded-xl mb-4"></div>
         <p className="text-muted-foreground font-medium">Loading AttendVerify...</p>
      </div>
    </div>
  );
}
