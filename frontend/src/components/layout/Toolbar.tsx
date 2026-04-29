/**
 * Toolbar — Top ribbon bar in Revit style.
 * Groups: Proyecto | Análisis | Vista | Info
 */
import { useState, useRef } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import type { ProjectData } from '../../store/foundationStore';
import { foundationSchema, stratumSchema, conditionsSchema, validateCalculationInput } from '../../lib/validation';
import CreditsModal from './CreditsModal';

interface ToolbarProps {
  onToggleLeft: () => void;
  onToggleRight: () => void;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  viewMode: 'single' | 'split';
  onSetViewMode: (mode: 'single' | 'split') => void;
  onOpenTab: (type: string) => void;
}

export default function Toolbar({
  onToggleLeft, onToggleRight, leftCollapsed, rightCollapsed,
  viewMode, onSetViewMode, onOpenTab,
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
      foundation,
      strata,
      conditions,
      method,
      lbLocked,
      lbRatio,
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
        const data = JSON.parse(ev.target?.result as string) as ProjectData;
        if (!data.foundation || !data.strata || !data.conditions) {
          throw new Error('Archivo no válido');
        }
        loadProject(data);
      } catch {
        setErrors(['Error al cargar el archivo. Verifica que sea un proyecto válido.']);
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-loaded
    e.target.value = '';
  };

  return (
    <>
      <div style={{
        height: 40,
        background: '#333',
        borderBottom: '1px solid #505050',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 2,
        flexShrink: 0,
      }}>
        {/* Logo placeholder */}
        <div style={{
          width: 28, height: 28,
          background: '#c0392b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 12,
          marginRight: 8,
        }}>
          CA
        </div>

        <Separator />

        {/* Project group */}
        <ToolGroup label="Proyecto">
          <ToolBtn icon="💾" label="Guardar" onClick={handleSaveProject} />
          <ToolBtn icon="📂" label="Cargar" onClick={() => fileInputRef.current?.click()} />
        </ToolGroup>

        <Separator />

        {/* Analysis group */}
        <ToolGroup label="Análisis">
          <ToolBtn icon="▶" label="Calcular" accent onClick={handleCalculate} />
          <ToolBtn icon="↺" label="Reset" onClick={reset} />
        </ToolGroup>

        <Separator />

        {/* View group */}
        <ToolGroup label="Vista">
          <ToolBtn icon="□" label="2D" onClick={() => onOpenTab('2d')} />
          <ToolBtn icon="⬡" label="3D" onClick={() => onOpenTab('3d')} />
          <ToolBtn
            icon="▥"
            label="Split"
            active={viewMode === 'split'}
            onClick={() => onSetViewMode(viewMode === 'split' ? 'single' : 'split')}
          />
          <ToolBtn icon="⊞" label="Gráficas" onClick={() => onOpenTab('charts')} />
          <ToolBtn icon="≡" label="Resultados" onClick={() => onOpenTab('results')} />
        </ToolGroup>

        <Separator />

        {/* Info group */}
        <ToolGroup label="Info">
          <ToolBtn icon="ℹ" label="Créditos" onClick={() => setShowCredits(true)} />
        </ToolGroup>

        <div style={{ flex: 1 }} />

        {/* Panel toggles */}
        <ToolBtn
          icon="◧"
          label={leftCollapsed ? 'Propiedades' : ''}
          active={!leftCollapsed}
          onClick={onToggleLeft}
        />
        <ToolBtn
          icon="◨"
          label={rightCollapsed ? 'Salida' : ''}
          active={!rightCollapsed}
          onClick={onToggleRight}
        />
      </div>

      {/* Hidden file input for project loading */}
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

function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 1 }}>{children}</div>
      <span style={{ fontSize: 9, color: '#777', marginTop: -1 }}>{label}</span>
    </div>
  );
}

function ToolBtn({ icon, label, accent, active, onClick }: {
  icon: string; label?: string; accent?: boolean; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        padding: '4px 8px',
        background: accent ? '#c0392b' : active ? '#454545' : 'transparent',
        border: accent ? '1px solid #a93226' : active ? '1px solid #606060' : '1px solid transparent',
        color: accent ? 'white' : '#e0e0e0',
        cursor: 'pointer',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!accent && !active) e.currentTarget.style.background = '#454545';
      }}
      onMouseLeave={(e) => {
        if (!accent && !active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span>{icon}</span>
      {label && <span style={{ fontSize: 11 }}>{label}</span>}
    </button>
  );
}

function Separator() {
  return <div style={{ width: 1, height: 28, background: '#505050', margin: '0 6px' }} />;
}
