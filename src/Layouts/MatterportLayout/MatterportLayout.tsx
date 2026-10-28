import React from 'react';
import { ViewerSwitch } from '../../features/splat/ViewerSwitch';

interface MatterportLayoutProps {
  children?: React.ReactNode;
}

export function MatterportLayout({ children }: MatterportLayoutProps) {
  return (
    <div className="relative w-full h-dvh">
      <ViewerSwitch>{children}</ViewerSwitch>
    </div>
  );
}
