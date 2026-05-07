/**
 * AppShell — Main layout container: Toolbar + Panels + Workspace + StatusBar.
 * Supports dark (Photoshop grays) and light (cream) themes.
 */
import { useState, useCallback, useEffect } from 'react';
import Toolbar from './Toolbar';
import StatusBar from './StatusBar';
import CollapsiblePanel from './CollapsiblePanel';
import PropertiesPanel from '../panels/PropertiesPanel';
import OutputPanel from '../panels/OutputPanel';
import Workspace from '../workspace/Workspace';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { TabType } from '../../store/workspaceStore';

export default function AppShell() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'split'>('single');
  const [lightMode, setLightMode] = useState(() => {
    return localStorage.getItem('ca-theme') === 'light';
  });

  const addTab = useWorkspaceStore((s) => s.addTab);

  const handleOpenTab = useCallback((type: string) => {
    addTab?.(type as TabType);
  }, [addTab]);

  // Apply theme class to root element
  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', lightMode);
    localStorage.setItem('ca-theme', lightMode ? 'light' : 'dark');
  }, [lightMode]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* Toolbar */}
      <Toolbar
        onToggleLeft={() => setLeftCollapsed(!leftCollapsed)}
        onToggleRight={() => setRightCollapsed(!rightCollapsed)}
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onOpenTab={handleOpenTab}
        lightMode={lightMode}
        onToggleTheme={() => setLightMode(!lightMode)}
      />

      {/* Main area: Left panel + Workspace + Right panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel — Properties */}
        <CollapsiblePanel
          side="left"
          title="Propiedades"
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed(!leftCollapsed)}
          defaultWidth={300}
          minWidth={220}
          maxWidth={500}
        >
          <PropertiesPanel />
        </CollapsiblePanel>

        {/* Center — Workspace */}
        <Workspace splitMode={viewMode === 'split'} />

        {/* Right Panel — Output */}
        <CollapsiblePanel
          side="right"
          title="Salida"
          collapsed={rightCollapsed}
          onToggle={() => setRightCollapsed(!rightCollapsed)}
          defaultWidth={320}
          minWidth={250}
          maxWidth={500}
        >
          <OutputPanel />
        </CollapsiblePanel>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
