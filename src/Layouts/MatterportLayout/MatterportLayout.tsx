import React from 'react';
import Matterport from './components/Matterport.tsx';

interface MatterportLayoutProps {
  children?: React.ReactNode;
}

export function MatterportLayout({ children }: MatterportLayoutProps) {
  return (
    <div className="relative w-full h-screen">
      <Matterport>{children}</Matterport>
    </div>
  );
}
