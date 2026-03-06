import React from 'react';
import { UserButton } from '@clerk/clerk-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div className="absolute top-4 right-4 z-50">
        <UserButton />
      </div>
      {children}
    </div>
  );
}
