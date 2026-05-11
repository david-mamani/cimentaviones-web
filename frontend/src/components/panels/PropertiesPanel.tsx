/**
 * PropertiesPanel — Left panel: all input sections with card-based design.
 * Uses CadNumericInput for all numeric fields.
 */
import { useState } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import type { CalculationMethod, FoundationType } from '../../types/geotechnical';
import CadNumericInput from '../common/CadNumericInput';
import { useViewerSettings } from '../../store/viewerSettingsStore';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';

const TYPES: { value: FoundationType; label: string }[] = [
  { value: 'cuadrada', label: 'Cuadrada' },
  { value: 'rectangular', label: 'Rectangular' },
];

const METHODS: { value: CalculationMethod; label: string }[] = [
  { value: 'terzaghi', label: 'Terzaghi' },
  { value: 'general', label: 'Ec. General' },
  { value: 'rne', label: 'RNE E.050' },
];

export default function PropertiesPanel() {
  return (
    <div>
      <TypeSection />
      <DimensionsSection />
      <MethodSection />
      <ConditionsSection />
      <StrataSection />
    </div>
  );
}

/* ─── Foundation Type — Cards ─── */
function TypeSection() {
  const [open, setOpen] = useState(true);
  const type = useFoundationStore((s) => s.foundation.type);
  const setType = useFoundationStore((s) => s.setFoundationType);

  return (
    <Section title="Tipo de Cimentación" open={open} onToggle={() => setOpen(!open)}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            style={{
              padding: '10px 8px',
              background: type === t.value ? 'var(--accent-bg)' : 'var(--bg-surface-2)',
              border: `1px solid ${type === t.value ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              color: type === t.value ? 'var(--accent)' : 'var(--text-primary)',
              fontSize: 11,
              fontWeight: type === t.value ? 600 : 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
            onMouseEnter={(e) => {
              if (type !== t.value) {
                e.currentTarget.style.borderColor = 'var(--border-active)';
                e.currentTarget.style.background = 'var(--bg-surface-3)';
              }
            }}
            onMouseLeave={(e) => {
              if (type !== t.value) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg-surface-2)';
              }
            }}
          >
            {/* Mini SVG icon */}
            <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
              {t.value === 'cuadrada' && <rect x="4" y="2" width="16" height="12" rx="1" fill={type === t.value ? 'var(--accent)' : 'var(--text-muted)'} />}
              {t.value === 'rectangular' && <rect x="2" y="4" width="20" height="8" rx="1" fill={type === t.value ? 'var(--accent)' : 'var(--text-muted)'} />}
              {t.value === 'circular' && <circle cx="12" cy="8" r="7" fill={type === t.value ? 'var(--accent)' : 'var(--text-muted)'} />}
              {t.value === 'franja' && <rect x="1" y="5" width="22" height="6" rx="1" fill={type === t.value ? 'var(--accent)' : 'var(--text-muted)'} />}
            </svg>
            {t.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

/* ─── Dimensions ─── */
function DimensionsSection() {
  const [open, setOpen] = useState(true);
  const f = useFoundationStore((s) => s.foundation);
  const setParam = useFoundationStore((s) => s.setFoundationParam);
  const lbLocked = useFoundationStore((s) => s.lbLocked);
  const lbRatio = useFoundationStore((s) => s.lbRatio);
  const setLbLocked = useFoundationStore((s) => s.setLbLocked);
  const setLbRatio = useFoundationStore((s) => s.setLbRatio);

  return (
    <Section title="Dimensiones" open={open} onToggle={() => setOpen(!open)}>
      <PropRow label="Lado B (m)">
        <CadNumericInput value={f.B} step={0.1} min={0}
          onChange={(v) => setParam('B', v)} />
      </PropRow>
      {(f.type === 'rectangular') && (
        <>
          <PropRow label="Lado L (m)">
            <CadNumericInput value={f.L} step={0.1} min={0}
              onChange={(v) => setParam('L', v)}
              disabled={lbLocked} />
          </PropRow>
          {/* L/B ratio lock */}
          <div style={{ marginBottom: 6, padding: '4px 0' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)',
            }}>
              <input
                type="checkbox"
                className="cad-checkbox"
                checked={lbLocked}
                onChange={(e) => setLbLocked(e.target.checked)}
              />
              L = k × B
            </label>
            {lbLocked && (
              <div style={{ marginTop: 4, marginLeft: 22 }}>
                <PropRow label="k (L/B)">
                  <CadNumericInput value={lbRatio} step={0.1} min={1}
                    onChange={(v) => setLbRatio(v)} />
                </PropRow>
              </div>
            )}
          </div>
        </>
      )}
      <PropRow label="Prof. desplante Df (m)">
        <CadNumericInput value={f.Df} step={0.1} min={0}
          onChange={(v) => setParam('Df', v)} />
      </PropRow>
      <PropRow label="Factor de Seguridad">
        <CadNumericInput value={f.FS} step={0.5} min={1}
          onChange={(v) => setParam('FS', v)} />
      </PropRow>
      <PropRow label="Ángulo inclinación β (°)">
        <CadNumericInput value={f.beta} step={1} min={0}
          onChange={(v) => setParam('beta', v)} />
      </PropRow>
    </Section>
  );
}

/* ─── Method ─── */
function MethodSection() {
  const [open, setOpen] = useState(true);
  const method = useFoundationStore((s) => s.method);
  const setMethod = useFoundationStore((s) => s.setMethod);
  const fType = useFoundationStore((s) => s.foundation.type);

  // Rectangular no soporta Terzaghi — auto-switch a General
  const isRectangular = fType === 'rectangular';
  if (isRectangular && method === 'terzaghi') {
    setMethod('general');
  }

  return (
    <Section title="Método de Cálculo" open={open} onToggle={() => setOpen(!open)}>
      <div style={{ display: 'flex', gap: 4 }}>
        {METHODS.map(m => {
          const isBlocked = m.value === 'terzaghi' && isRectangular;
          return (
            <button
              key={m.value}
              onClick={() => !isBlocked && setMethod(m.value)}
              title={isBlocked ? 'Terzaghi no aplica para cimentaciones rectangulares' : undefined}
              style={{
                flex: 1,
                padding: '6px 4px',
                background: method === m.value ? 'var(--accent-bg)' : 'var(--bg-surface-2)',
                border: `1px solid ${method === m.value ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: isBlocked ? 'var(--text-muted)' : method === m.value ? 'var(--accent)' : 'var(--text-primary)',
                fontSize: 10,
                fontWeight: method === m.value ? 600 : 500,
                fontFamily: 'var(--font-sans)',
                cursor: isBlocked ? 'not-allowed' : 'pointer',
                opacity: isBlocked ? 0.5 : 1,
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                if (method !== m.value && !isBlocked) e.currentTarget.style.borderColor = 'var(--border-active)';
              }}
              onMouseLeave={(e) => {
                if (method !== m.value && !isBlocked) e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {isRectangular && (
        <div style={{
          marginTop: 6, fontSize: 9, color: 'var(--text-muted)',
          fontStyle: 'italic', lineHeight: 1.3,
        }}>
          Terzaghi no disponible para cimentación rectangular
        </div>
      )}
    </Section>
  );
}

/* ─── Conditions ─── */
function ConditionsSection() {
  const [open, setOpen] = useState(true);
  const cond = useFoundationStore((s) => s.conditions);
  const setCond = useFoundationStore((s) => s.setCondition);

  return (
    <Section title="Condiciones Especiales" open={open} onToggle={() => setOpen(!open)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <input type="checkbox" className="cad-checkbox" checked={cond.hasWaterTable}
            onChange={(e) => setCond('hasWaterTable', e.target.checked)} />
          Nivel freático
        </label>
        {cond.hasWaterTable && (
          <PropRow label="Prof. NF Dw (m)">
            <CadNumericInput value={cond.waterTableDepth} step={0.1} min={0}
              onChange={(v) => setCond('waterTableDepth', v)} />
          </PropRow>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <input type="checkbox" className="cad-checkbox" checked={cond.hasBasement}
            onChange={(e) => setCond('hasBasement', e.target.checked)} />
          Sótano
        </label>
        {cond.hasBasement && (
          <PropRow label="Prof. sótano Ds (m)">
            <CadNumericInput value={cond.basementDepth} step={0.1} min={0}
              onChange={(v) => setCond('basementDepth', v)} />
          </PropRow>
        )}
      </div>
    </Section>
  );
}

/* ─── Strata — Table ─── */
function StrataSection() {
  const [open, setOpen] = useState(true);
  const strata = useFoundationStore((s) => s.strata);
  const addStratum = useFoundationStore((s) => s.addStratum);
  const removeStratum = useFoundationStore((s) => s.removeStratum);
  const updateStratum = useFoundationStore((s) => s.updateStratum);
  const strataColors = useViewerSettings((s) => s.strataColors);
  const setStrataColor = useViewerSettings((s) => s.setStrataColor);


  return (
    <Section
      title={`Estratos del Suelo (${strata.length})`}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        }}>
          <thead>
            <tr>
              {['', 'h(m)', 'γ(t/m³)', 'c(t/m²)', 'φ°', 'γsat(t/m³)', ''].map((h, i) => (
                <th key={i} style={{
                  padding: '4px 2px',
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  borderBottom: '1px solid var(--border)',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: 0.3,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strata.map((s, i) => {
              const color = strataColors[i % strataColors.length];
              return (
                <tr key={s.id}>
                  {/* Color */}
                  <td style={{ padding: '3px 2px', textAlign: 'center', width: 22 }}>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setStrataColor(i, e.target.value)}
                      style={{
                        width: 14, height: 14, padding: 0,
                        border: '1px solid var(--border)', background: 'none',
                        cursor: 'pointer', borderRadius: '50%',
                      }}
                    />
                  </td>
                  {/* h */}
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.thickness} step={0.1}
                      onChange={(v) => updateStratum(s.id, { thickness: v })} />
                  </td>
                  {/* gamma */}
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.gamma} step={0.5}
                      onChange={(v) => updateStratum(s.id, { gamma: v })} />
                  </td>
                  {/* c */}
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.c} step={1}
                      onChange={(v) => updateStratum(s.id, { c: v })} />
                  </td>
                  {/* phi */}
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.phi} step={1}
                      onChange={(v) => updateStratum(s.id, { phi: v })} />
                  </td>
                  {/* gammaSat */}
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.gammaSat} step={0.5}
                      onChange={(v) => updateStratum(s.id, { gammaSat: v })} />
                  </td>
                  {/* Delete */}
                  <td style={{ padding: '2px 2px', textAlign: 'center', width: 20 }}>
                    {strata.length > 1 && (
                      <button
                        onClick={() => removeStratum(s.id)}
                        style={{
                          background: 'none', border: 'none',
                          color: 'var(--text-muted)', cursor: 'pointer',
                          padding: 2, display: 'flex', borderRadius: 'var(--radius-sm)',
                          transition: 'color var(--transition-fast)',
                        }}
                        title="Eliminar estrato"
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add button */}
      <button
        onClick={addStratum}
        style={{
          width: '100%',
          marginTop: 8,
          padding: '6px 0',
          background: 'var(--bg-surface-2)',
          border: '1px dashed var(--border-active)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 11,
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-active)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <Plus size={14} /> Agregar estrato
      </button>
    </Section>
  );
}

/* ─── Reusable section wrapper ─── */
function Section({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="section-header" onClick={onToggle}>
        <span style={{
          display: 'flex', alignItems: 'center',
          transition: 'transform var(--transition-fast)',
          color: 'var(--text-muted)',
        }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        {title}
      </div>
      {open && <div className="section-content">{children}</div>}
    </div>
  );
}

/* ─── Property row ─── */
function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 5,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 110, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
