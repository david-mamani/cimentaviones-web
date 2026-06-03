/**
 * Toolbar — Minimalist top bar with Lucide icons.
 * All tools visible as icons. No dropdown.
 * Groups: Logo | Project | Calculate | Views | UnitSettings | Info | Theme | Panels
 */
import { useState, useRef } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import type { ProjectData } from '../../store/foundationStore';
import CreditsModal from './CreditsModal';
import {
  Save, FolderOpen, RotateCcw,
  Square, Box, SplitSquareHorizontal,
  BarChart3, Table2, Info,
  PanelLeft, PanelRight,
  Sun, Moon, Frame, ArrowDownToLine,
} from 'lucide-react';

interface ToolbarProps {
  onToggleLeft: () => void;
  onToggleRight: () => void;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  viewMode: 'single' | 'split';
  onSetViewMode: (mode: 'single' | 'split') => void;
  onOpenTab: (type: string) => void;
  lightMode: boolean;
  onToggleTheme: () => void;
}

export default function Toolbar({
  onToggleLeft, onToggleRight, leftCollapsed, rightCollapsed,
  viewMode, onSetViewMode, onOpenTab, lightMode, onToggleTheme,
}: ToolbarProps) {
  const foundation = useFoundationStore((s) => s.foundation);
  const strata = useFoundationStore((s) => s.strata);
  const conditions = useFoundationStore((s) => s.conditions);
  const method = useFoundationStore((s) => s.method);
  const reset = useFoundationStore((s) => s.reset);
  const loadProject = useFoundationStore((s) => s.loadProject);
  const lbLocked = useFoundationStore((s) => s.lbLocked);
  const lbRatio = useFoundationStore((s) => s.lbRatio);
  const eccentricityInputMode = useFoundationStore((s) => s.eccentricityInputMode);
  const selectedCriterion = useFoundationStore((s) => s.selectedCriterion);
  const iterationConfig = useFoundationStore((s) => s.iterationConfig);
  const settlementParams = useFoundationStore((s) => s.settlementParams);
  const parametricUiConfig = useFoundationStore((s) => s.parametricUiConfig);
  const settlementUiConfig = useFoundationStore((s) => s.settlementUiConfig);
  const compareSettlementConfig = useFoundationStore((s) => s.compareSettlementConfig);

  const [showCredits, setShowCredits] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProject = () => {
    const data: ProjectData = {
      foundation,
      strata,
      conditions,
      method,
      lbLocked,
      lbRatio,
      eccentricityInputMode,
      selectedCriterion,
      iterationConfig,
      settlementParams,
      parametricUiConfig,
      settlementUiConfig,
      compareSettlementConfig,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proyecto-cimentaciones.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        loadProject(data);
      } catch {
        alert('Archivo de proyecto inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 14px',
        height: 44,
        background: 'var(--lucid-surface-page)',
        borderBottom: '1px solid var(--lucid-rule-white)',
        flexShrink: 0,
      }}>
        {/* Brand — logo + serif name + sans tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginRight: 6 }}>
          <img
            src={lightMode ? '/assets/ucsm_logo_light.png' : '/assets/ucsm_logo_dark.png'}
            alt="UCSM"
            style={{ height: 24, width: 'auto', objectFit: 'contain' }}
          />
        </div>

        <Sep />

        {/* Project */}
        <ToolBtn icon={<Save size={15} />} title="Guardar proyecto" onClick={handleSaveProject} />
        <ToolBtn icon={<FolderOpen size={15} />} title="Cargar proyecto" onClick={() => fileInputRef.current?.click()} />

        <ToolBtn icon={<RotateCcw size={15} />} title="Resetear todo" onClick={reset} />

        <Sep />

        {/* View buttons — all visible as icons */}
        <ToolBtn icon={<Square size={15} />} title="Vista 2D" onClick={() => onOpenTab('2d')} />
        <ToolBtn icon={<Box size={15} />} title="Vista 3D" onClick={() => onOpenTab('3d')} />
        <ToolBtn icon={<Frame size={15} />} title="Excentricidad" onClick={() => onOpenTab('foundation-design')} />
        <ToolBtn icon={<ArrowDownToLine size={15} />} title="Asentamientos" onClick={() => onOpenTab('settlement')} />
        <ToolBtn
          icon={<SplitSquareHorizontal size={15} />}
          title={viewMode === 'split' ? 'Desactivar Split' : 'Activar Split'}
          active={viewMode === 'split'}
          onClick={() => onSetViewMode(viewMode === 'split' ? 'single' : 'split')}
        />
        <ToolBtn icon={<BarChart3 size={15} />} title="Gráficas" onClick={() => onOpenTab('charts')} />
        <ToolBtn icon={<Table2 size={15} />} title="Resultados" onClick={() => onOpenTab('results')} />

        <Sep />

        <ToolBtn icon={<Info size={15} />} title="Créditos" onClick={() => setShowCredits(true)} />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Theme toggle */}
        <ToolBtn
          icon={lightMode ? <Moon size={15} /> : <Sun size={15} />}
          title={lightMode ? 'Modo oscuro' : 'Modo claro'}
          onClick={onToggleTheme}
        />

        <Sep />

        {/* Panel toggles */}
        <ToolBtn
          icon={<PanelLeft size={15} />}
          title={leftCollapsed ? 'Mostrar propiedades' : 'Ocultar propiedades'}
          active={!leftCollapsed}
          onClick={onToggleLeft}
        />
        <ToolBtn
          icon={<PanelRight size={15} />}
          title={rightCollapsed ? 'Mostrar salida' : 'Ocultar salida'}
          active={!rightCollapsed}
          onClick={onToggleRight}
        />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleLoadProject}
        style={{ display: 'none' }}
      />

      {/* Credits modal */}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
    </>
  );
}

/* ─── Sub-components ─── */

function ToolBtn({ icon, title, active, onClick, disabled }: {
  icon: React.ReactNode; title: string; active?: boolean;
  onClick?: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        display: 'grid', placeItems: 'center',
        width: 30, height: 30,
        background: active ? 'var(--lucid-surface-figure)' : 'transparent',
        border: 'none',
        borderRadius: 4,
        color: active ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 160ms cubic-bezier(0.4,0,0.2,1), color 160ms cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'var(--lucid-surface-figure)';
          e.currentTarget.style.color = 'var(--lucid-ink-strong)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--lucid-ink-muted)';
        }
      }}
    >
      {icon}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: 'var(--lucid-rule-white)', margin: '0 4px', flexShrink: 0 }} />;
}
