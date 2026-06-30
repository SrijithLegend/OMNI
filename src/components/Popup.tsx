import { ProjectDashboard } from '@/components/ProjectDashboard';
import { useEffect } from 'react';

export function Popup() {
  return (
    <div className="w-[380px] max-h-[600px] overflow-y-auto bg-omni-50">
      <ProjectDashboard />
    </div>
  );
}
