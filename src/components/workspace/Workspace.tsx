/**
 * Workspace — Tabbed center area with optional horizontal split.
 * Tracks which side is "active" so new tabs go to the right place.
 */
import { useState, useCallback, useRef } from 'react';
import ResultsPanel from '../visualization/ResultsPanel';
import ParametricIterations from '../iterations/ParametricIterations';
import Viewer3D from '../viewer3d/Viewer3D';
import Viewer2D from '../viewer2d/Viewer2D';

export type TabType = '2d' | '3d' | 'charts' | 'results';

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
    { id: `tab-${++tabCounter}`, type: '3d', label: TAB_LABELS['3d'] },
  ]);
  const [rightTabs, setRightTabs] = useState<TabInfo[]>([
    { id: `tab-${++tabCounter}`, type: '2d', label: TAB_LABELS['2d'] },
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

  // Expose addTab to parent via window for toolbar
  (window as unknown as Record<string, unknown>).__workspaceAddTab = addTab;

  const setSlot = useCallback((slot: 'left' | 'right') => {
    activeSlotRef.current = slot;
    setActiveSlot(slot);
  }, []);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      background: '#252525',
      overflow: 'hidden',
    }}>
      {/* Left slot */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
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
          <div style={{ width: 3, background: '#505050', cursor: 'col-resize', flexShrink: 0 }} />
          <div
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
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
  const active = tabs.find(t => t.id === activeTab);

  return (
    <>
      {/* Tab bar */}
      <div className="tab-bar" style={{
        borderBottom: isActiveSlot ? '2px solid #c0392b' : '1px solid #505050',
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

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {active ? <TabContent type={active.type} tabId={active.id} /> : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#555', fontSize: 13,
          }}>
            No hay pestañas abiertas
          </div>
        )}
      </div>
    </>
  );
}

function TabContent({ type, tabId }: { type: TabType; tabId: string }) {
  switch (type) {
    case '2d':
      return <Viewer2D />;
    case '3d':
      return <Viewer3D key={tabId} tabId={tabId} />;
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
