/**
 * AppShell — Main layout container: Toolbar + Panels + Workspace + StatusBar.
 * Revit/AutoCAD style layout.
 */
import { useState, useCallback } from 'react';
import Toolbar from './Toolbar';
import StatusBar from './StatusBar';
import CollapsiblePanel from './CollapsiblePanel';
import PropertiesPanel from '../panels/PropertiesPanel';
import OutputPanel from '../panels/OutputPanel';
import Workspace from '../workspace/Workspace';
import type { TabType } from '../workspace/Workspace';

export default function AppShell() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'split'>('single');

  const handleOpenTab = useCallback((type: string) => {
    // Access workspace tab management via the global bridge
    const addTab = (window as unknown as Record<string, unknown>).__workspaceAddTab as
      ((type: TabType, slot?: 'left' | 'right') => void) | undefined;
    if (addTab) {
      addTab(type as TabType);
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: '#2d2d2d',
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
