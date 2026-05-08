/**
 * Toolbar — Minimalist top bar with Lucide icons.
 * All tools visible as icons. No dropdown.
 * Groups: Logo | Project | Calculate | Views | Info | Theme | Panels
 */
import { useState, useRef } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import type { ProjectData } from '../../store/foundationStore';
import { foundationSchema, stratumSchema, conditionsSchema, validateCalculationInput } from '../../lib/validation';
import CreditsModal from './CreditsModal';
import {
  Save, FolderOpen, Play, RotateCcw,
  Square, Box, SplitSquareHorizontal,
  BarChart3, Table2, Info,
  PanelLeft, PanelRight,
  Sun, Moon, Loader2,
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
  const calculate = useFoundationStore((s) => s.calculate);
  const setErrors = useFoundationStore((s) => s.setErrors);
  const reset = useFoundationStore((s) => s.reset);
  const loadProject = useFoundationStore((s) => s.loadProject);
  const lbLocked = useFoundationStore((s) => s.lbLocked);
  const lbRatio = useFoundationStore((s) => s.lbRatio);
  const isCalculating = useFoundationStore((s) => s.isCalculating);

  const [showCredits, setShowCredits] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCalculate = () => {
    const fResult = foundationSchema.safeParse(foundation);
    if (!fResult.success) {
      setErrors(fResult.error.issues.map((e: { message: string }) => e.message));
      return;
    }
    const strataErrors: string[] = [];
    strata.forEach((s, i) => {
      const sResult = stratumSchema.safeParse(s);
      if (!sResult.success) {
        sResult.error.issues.forEach((e: { message: string }) => {
          strataErrors.push(`Estrato ${i + 1}: ${e.message}`);
        });
      }
    });
    if (strataErrors.length > 0) { setErrors(strataErrors); return; }
    const cResult = conditionsSchema.safeParse(conditions);
    if (!cResult.success) {
      setErrors(cResult.error.issues.map((e: { message: string }) => e.message));
      return;
    }
    const crossErrors = validateCalculationInput(fResult.data, strata, cResult.data);
    if (crossErrors.length > 0) { setErrors(crossErrors); return; }
    calculate();
  };

  const handleSaveProject = () => {
    const data: ProjectData = {
      foundation, strata, conditions, method, lbLocked, lbRatio,
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
        padding: '0 12px',
        height: 44,
        background: 'var(--bg-surface-1)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <img
          src={lightMode ? '/assets/ucsm_logo_light.png' : '/assets/ucsm_logo_dark.png'}
          alt="UCSM"
          style={{
            height: 24,
            width: 'auto',
            flexShrink: 0,
            objectFit: 'contain',
          }}
        />

        <Sep />

        {/* Project */}
        <ToolBtn icon={<Save size={15} />} title="Guardar proyecto" onClick={handleSaveProject} />
        <ToolBtn icon={<FolderOpen size={15} />} title="Cargar proyecto" onClick={() => fileInputRef.current?.click()} />

        <Sep />

        {/* Calculate — Pill accent button */}
        <button
          onClick={handleCalculate}
          disabled={isCalculating}
          title="Ejecutar cálculo"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 16px',
            background: isCalculating ? 'var(--bg-surface-3)' : 'var(--accent)',
            border: 'none',
            borderRadius: 20,
            color: isCalculating ? 'var(--text-secondary)' : 'var(--bg-base)',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: isCalculating ? 'not-allowed' : 'pointer',
            transition: 'all var(--transition-fast)',
            opacity: isCalculating ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { if (!isCalculating) e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { if (!isCalculating) e.currentTarget.style.background = 'var(--accent)'; }}
        >
          {isCalculating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
          {isCalculating ? 'Calculando...' : 'Calcular'}
        </button>
        <ToolBtn icon={<RotateCcw size={15} />} title="Resetear todo" onClick={reset} />

        <Sep />

        {/* View buttons — all visible as icons */}
        <ToolBtn icon={<Square size={15} />} title="Vista 2D" onClick={() => onOpenTab('2d')} />
        <ToolBtn icon={<Box size={15} />} title="Vista 3D" onClick={() => onOpenTab('3d')} />
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

      {/* Spinner animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32,
        background: active ? 'var(--bg-surface-3)' : 'transparent',
        border: '1px solid ' + (active ? 'var(--border-active)' : 'transparent'),
        borderRadius: 'var(--radius-sm)',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all var(--transition-fast)',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!disabled && !active) { e.currentTarget.style.background = 'var(--bg-surface-2)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
      onMouseLeave={(e) => { if (!disabled && !active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
    >
      {icon}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 8px', flexShrink: 0 }} />;
}
