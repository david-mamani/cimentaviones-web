/**
 * Workspace — Tabbed center area with optional horizontal split.
 * Tracks which side is "active" so new tabs go to the right place.
 *
 * IMPORTANT: Tab contents are kept mounted (display:none) to preserve
 * state (3D model, iteration results) when switching tabs.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import ResultsPanel from '../visualization/ResultsPanel';
import ParametricIterations from '../iterations/ParametricIterations';
import IfcViewer from '../viewer3d/IfcViewer';
import Viewer2D from '../viewer2d/Viewer2D';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { TabType } from '../../store/workspaceStore';

interface TabInfo {
  id: string;
  type: TabType;
  label: string;
}

const TAB_LABELS: Record<TabType, string> = {
  '2d': 'Sección 2D',
  '3d': 'Vista 3D',
  charts: 'Gráficas',
  results: 'Resultados',
};

interface WorkspaceProps {
  splitMode: boolean;
}

let tabCounter = 0;

export default function Workspace({ splitMode }: WorkspaceProps) {
  const [leftTabs, setLeftTabs] = useState<TabInfo[]>([
    { id: `tab-${++tabCounter}`, type: '2d', label: TAB_LABELS['2d'] },
  ]);
  const [rightTabs, setRightTabs] = useState<TabInfo[]>([
    { id: `tab-${++tabCounter}`, type: '3d', label: TAB_LABELS['3d'] },
  ]);
  const [activeLeft, setActiveLeft] = useState(leftTabs[0]?.id || '');
  const [activeRight, setActiveRight] = useState(rightTabs[0]?.id || '');
  const [activeSlot, setActiveSlot] = useState<'left' | 'right'>('left');
  const activeSlotRef = useRef(activeSlot);
  activeSlotRef.current = activeSlot;

  const addTab = useCallback((type: TabType, slot?: 'left' | 'right') => {
    // Use specified slot, or the currently active slot (via ref to avoid stale closure)
    const targetSlot = slot || activeSlotRef.current;
    const newTab: TabInfo = {
      id: `tab-${++tabCounter}`,
      type,
      label: TAB_LABELS[type],
    };
    if (targetSlot === 'left' || !splitMode) {
      setLeftTabs(prev => [...prev, newTab]);
      setActiveLeft(newTab.id);
    } else {
      setRightTabs(prev => [...prev, newTab]);
      setActiveRight(newTab.id);
    }
  }, [splitMode]);

  const closeTab = useCallback((tabId: string, slot: 'left' | 'right') => {
    if (slot === 'left') {
      setLeftTabs(prev => {
        const next = prev.filter(t => t.id !== tabId);
        if (activeLeft === tabId && next.length > 0) {
          setActiveLeft(next[next.length - 1].id);
        }
        return next;
      });
    } else {
      setRightTabs(prev => {
        const next = prev.filter(t => t.id !== tabId);
        if (activeRight === tabId && next.length > 0) {
          setActiveRight(next[next.length - 1].id);
        }
        return next;
      });
    }
  }, [activeLeft, activeRight]);

  // Register addTab in workspace store for Toolbar/AppShell to consume
  const registerAddTab = useWorkspaceStore((s) => s.registerAddTab);
  const unregisterAddTab = useWorkspaceStore((s) => s.unregisterAddTab);
  useEffect(() => {
    registerAddTab(addTab);
    return () => unregisterAddTab();
  }, [addTab, registerAddTab, unregisterAddTab]);

  const setSlot = useCallback((slot: 'left' | 'right') => {
    activeSlotRef.current = slot;
    setActiveSlot(slot);
  }, []);

  const [leftFraction, setLeftFraction] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleDividerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handleDividerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    setLeftFraction(Math.max(0.2, Math.min(0.8, fraction)));
  }, []);

  const handleDividerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div ref={containerRef} style={{
      flex: 1,
      display: 'flex',
      background: 'var(--bg-viewport)',
      overflow: 'hidden',
    }}>
      {/* Left slot */}
      <div
        style={{ flex: splitMode ? leftFraction : 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
        onPointerDownCapture={() => setSlot('left')}
      >
        <TabSlot
          tabs={leftTabs}
          activeTab={activeLeft}
          isActiveSlot={activeSlot === 'left' && splitMode}
          onActivate={setActiveLeft}
          onClose={(id) => closeTab(id, 'left')}
        />
      </div>

      {/* Right slot (only in split mode) */}
      {splitMode && (
        <>
          {/* Draggable divider */}
          <div
            onPointerDown={handleDividerDown}
            onPointerMove={handleDividerMove}
            onPointerUp={handleDividerUp}
            style={{
              width: 5,
              background: 'var(--border)',
              cursor: 'col-resize',
              flexShrink: 0,
              transition: isDragging.current ? 'none' : 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
            onMouseLeave={(e) => { if (!isDragging.current) e.currentTarget.style.background = 'var(--border)'; }}
          />
          <div
            style={{ flex: 1 - leftFraction, display: 'flex', flexDirection: 'column', minWidth: 0 }}
            onPointerDownCapture={() => setSlot('right')}
          >
            <TabSlot
              tabs={rightTabs}
              activeTab={activeRight}
              isActiveSlot={activeSlot === 'right'}
              onActivate={setActiveRight}
              onClose={(id) => closeTab(id, 'right')}
            />
          </div>
        </>
      )}
    </div>
  );
}

function TabSlot({ tabs, activeTab, isActiveSlot, onActivate, onClose }: {
  tabs: TabInfo[];
  activeTab: string;
  isActiveSlot: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}) {
  return (
    <>
      {/* Tab bar */}
      <div className="tab-bar" style={{
        borderBottom: isActiveSlot ? '2px solid var(--accent)' : '1px solid var(--border)',
      }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTab ? 'active' : ''}`}
            onClick={() => onActivate(tab.id)}
          >
            <span>{tab.label}</span>
            {tabs.length > 1 && (
              <span
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              >
                ×
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Tab content — ALL tabs stay mounted, only active one is visible */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tabs.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-muted)', fontSize: 13,
          }}>
            No hay pestañas abiertas
          </div>
        ) : (
          tabs.map(tab => (
            <div
              key={tab.id}
              style={{
                position: 'absolute',
                inset: 0,
                display: tab.id === activeTab ? 'block' : 'none',
                overflow: 'hidden',
              }}
            >
              <TabContent type={tab.type} tabId={tab.id} />
            </div>
          ))
        )}
      </div>
    </>
  );
}

function TabContent({ type }: { type: TabType; tabId: string }) {
  switch (type) {
    case '2d':
      return <Viewer2D />;
    case '3d':
      return <IfcViewer />;
    case 'charts':
      return (
        <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
          <ParametricIterations />
        </div>
      );
    case 'results':
      return (
        <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
          <ResultsPanel />
        </div>
      );
    default:
      return null;
  }
}
