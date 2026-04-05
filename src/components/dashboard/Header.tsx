
"use client"

import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function Header({ title }: { title: string }) {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-8 sticky top-0 z-30">
      <h1 className="text-xl font-semibold">{title}</h1>
      
      <div className="flex items-center gap-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            className="pl-9 bg-muted/50 border-none h-9 focus-visible:ring-1" 
            placeholder="Search record..."
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-white"></span>
          </Button>
        </div>
      </div>
    </header>
  );
}
