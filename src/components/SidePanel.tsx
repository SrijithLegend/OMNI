import { ProjectDashboard } from '@/components/ProjectDashboard';
import { useEffect } from 'react';
import { useProjectStore } from '@/state';

export function SidePanel() {
  return (
    <div className="min-h-screen bg-omni-50">
      <ProjectDashboard />
    </div>
  );
}
