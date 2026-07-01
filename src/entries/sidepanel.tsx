import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanel } from '@/components/SidePanel';
import '@/styles/index.css';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SidePanel />
    </React.StrictMode>
  );
}
