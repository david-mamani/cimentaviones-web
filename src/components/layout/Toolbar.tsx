/**
 * Toolbar — Top ribbon bar in Revit style.
 * Groups: Análisis | Vista | Exportar
 */
import { useFoundationStore } from '../../store/foundationStore';
import { foundationSchema, stratumSchema, conditionsSchema, validateCalculationInput } from '../../lib/validation';

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
  const calculate = useFoundationStore((s) => s.calculate);
  const setErrors = useFoundationStore((s) => s.setErrors);
  const reset = useFoundationStore((s) => s.reset);

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

  return (
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

      {/* Export group */}
      <ToolGroup label="Exportar">
        <ToolBtn icon="⎙" label="PDF" onClick={() => {
          const btn = document.getElementById('btn-export-pdf');
          if (btn) btn.click();
        }} />
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
