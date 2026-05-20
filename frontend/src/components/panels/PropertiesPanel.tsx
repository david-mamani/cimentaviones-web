/**
 * PropertiesPanel — Left panel reorganizado en 3 secciones:
 *   1. DATOS GENERALES — Estratos, condiciones (NF, sótano), Df, Q, β,
 *                        toggle Asentamiento (Es/μs/S_max)
 *   2. DISEÑO RÁPIDO   — Tipo, B, L, k, botón para abrir ventana de Diseño
 *   3. SOLUCIÓN        — FS, método (con bloqueo β para Terzaghi)
 */
import { useState } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { CalculationMethod, FoundationType } from '../../types/geotechnical';
import CadNumericInput from '../common/CadNumericInput';
import { useViewerSettings } from '../../store/viewerSettingsStore';
import { ChevronDown, ChevronRight, Plus, X, Frame } from 'lucide-react';

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
  // Toggle local de "Asentamiento" (no persistido; controla visibilidad de Es/μs/S_max)
  const [settlementEnabled, setSettlementEnabled] = useState(false);

  return (
    <div>
      {/* ────── 1. DATOS GENERALES ────── */}
      <SectionGroupHeader>Datos Generales</SectionGroupHeader>
      <StrataSection settlementEnabled={settlementEnabled} />
      <ConditionsSection />
      <SiteParamsSection />
      <SettlementToggleSection
        enabled={settlementEnabled}
        onToggle={setSettlementEnabled}
      />

      {/* ────── 2. DISEÑO RÁPIDO ────── */}
      <SectionGroupHeader>Diseño de Cimentación</SectionGroupHeader>
      <QuickDesignSection />

      {/* ────── 3. SOLUCIÓN ────── */}
      <SectionGroupHeader>Solución</SectionGroupHeader>
      <SolutionSection />
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * SECCIÓN: ESTRATOS (con Es/μs opcionales)
 * ═══════════════════════════════════════════════ */
function StrataSection({ settlementEnabled }: { settlementEnabled: boolean }) {
  const [open, setOpen] = useState(true);
  const strata = useFoundationStore((s) => s.strata);
  const addStratum = useFoundationStore((s) => s.addStratum);
  const removeStratum = useFoundationStore((s) => s.removeStratum);
  const updateStratum = useFoundationStore((s) => s.updateStratum);
  const strataColors = useViewerSettings((s) => s.strataColors);
  const setStrataColor = useViewerSettings((s) => s.setStrataColor);

  // Headers de la tabla: base + opcional Es, μs
  const headers = ['', 'h(m)', 'γ(t/m³)', 'c(t/m²)', 'φ°', 'γsat(t/m³)'];
  if (settlementEnabled) headers.push('Es(t/m²)', 'μs');
  headers.push('');

  return (
    <Section
      title={`Estratos del Suelo (${strata.length})`}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '6px 2px',
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'var(--lucid-ink-muted)',
                  textAlign: 'center',
                  borderBottom: '1px solid var(--lucid-rule-white)',
                  fontFamily: 'var(--lucid-font-sans)',
                  letterSpacing: '0.04em',
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
                  <td style={{ padding: '3px 2px', textAlign: 'center', width: 22 }}>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setStrataColor(i, e.target.value)}
                      style={{
                        width: 14, height: 14, padding: 0,
                        border: '1px solid var(--lucid-rule-cream)', background: 'none',
                        cursor: 'pointer', borderRadius: '50%',
                      }}
                    />
                  </td>
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.thickness} step={0.1}
                      onChange={(v) => updateStratum(s.id, { thickness: v })} />
                  </td>
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.gamma} step={0.5}
                      onChange={(v) => updateStratum(s.id, { gamma: v })} />
                  </td>
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.c} step={1}
                      onChange={(v) => updateStratum(s.id, { c: v })} />
                  </td>
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.phi} step={1}
                      onChange={(v) => updateStratum(s.id, { phi: v })} />
                  </td>
                  <td style={{ padding: '2px 1px' }}>
                    <CadNumericInput className="stratum-input" value={s.gammaSat} step={0.5}
                      onChange={(v) => updateStratum(s.id, { gammaSat: v })} />
                  </td>
                  {settlementEnabled && (
                    <>
                      <td style={{ padding: '2px 1px' }}>
                        <CadNumericInput
                          className="stratum-input"
                          value={s.Es ?? 0}
                          step={100}
                          onChange={(v) => updateStratum(s.id, { Es: v > 0 ? v : null })}
                        />
                      </td>
                      <td style={{ padding: '2px 1px' }}>
                        <CadNumericInput
                          className="stratum-input"
                          value={s.mu_s ?? 0}
                          step={0.05}
                          onChange={(v) => updateStratum(s.id, { mu_s: v > 0 ? v : null })}
                        />
                      </td>
                    </>
                  )}
                  <td style={{ padding: '2px 2px', textAlign: 'center', width: 20 }}>
                    {strata.length > 1 && (
                      <button
                        onClick={() => removeStratum(s.id)}
                        style={{
                          background: 'none', border: 'none',
                          color: 'var(--lucid-ink-faint)', cursor: 'pointer',
                          padding: 2, display: 'grid', placeItems: 'center', borderRadius: 3,
                          transition: 'color 160ms cubic-bezier(0.4,0,0.2,1), background 160ms cubic-bezier(0.4,0,0.2,1)',
                        }}
                        title="Eliminar estrato"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--lucid-acc-coral)';
                          e.currentTarget.style.background = 'var(--lucid-tint-coral)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--lucid-ink-faint)';
                          e.currentTarget.style.background = 'transparent';
                        }}
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

      <button
        onClick={addStratum}
        style={{
          width: '100%', marginTop: 10, padding: '8px 0',
          background: 'transparent',
          border: '1px dashed var(--lucid-rule-cream)',
          borderRadius: 4,
          color: 'var(--lucid-ink-muted)', fontSize: 12,
          fontFamily: 'var(--lucid-font-sans)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'border-color 160ms cubic-bezier(0.4,0,0.2,1), color 160ms cubic-bezier(0.4,0,0.2,1), background 160ms cubic-bezier(0.4,0,0.2,1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--lucid-ink-strong)';
          e.currentTarget.style.color = 'var(--lucid-ink-strong)';
          e.currentTarget.style.background = 'var(--lucid-surface-figure)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--lucid-rule-cream)';
          e.currentTarget.style.color = 'var(--lucid-ink-muted)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Plus size={13} /> Agregar estrato
      </button>
    </Section>
  );
}

/* ═══════════════════════════════════════════════
 * SECCIÓN: CONDICIONES (NF y sótano)
 * ═══════════════════════════════════════════════ */
function ConditionsSection() {
  const [open, setOpen] = useState(true);
  const cond = useFoundationStore((s) => s.conditions);
  const setCond = useFoundationStore((s) => s.setCondition);

  return (
    <Section title="Nivel Freático y Sótano" open={open} onToggle={() => setOpen(!open)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={checkboxLabelStyle}>
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
        <label style={checkboxLabelStyle}>
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

/* ═══════════════════════════════════════════════
 * SECCIÓN: PARÁMETROS DEL SITIO (Df, Q, β)
 * ═══════════════════════════════════════════════ */
function SiteParamsSection() {
  const [open, setOpen] = useState(true);
  const f = useFoundationStore((s) => s.foundation);
  const setParam = useFoundationStore((s) => s.setFoundationParam);
  const method = useFoundationStore((s) => s.method);
  const betaDisabled = method === 'terzaghi';

  return (
    <Section title="Parámetros del Sitio" open={open} onToggle={() => setOpen(!open)}>
      <PropRow label="Prof. desplante Df (m)">
        <CadNumericInput value={f.Df} step={0.1} min={0}
          onChange={(v) => setParam('Df', v)} />
      </PropRow>
      <PropRow label="Carga Q (tnf)">
        <CadNumericInput
          value={f.Q ?? 0}
          step={1}
          min={0}
          onChange={(v) => setParam('Q', v > 0 ? v : null)}
        />
      </PropRow>
      <PropRow label="Inclin. β (°)">
        <CadNumericInput
          value={f.beta}
          step={1}
          min={0}
          onChange={(v) => setParam('beta', v)}
          disabled={betaDisabled}
        />
      </PropRow>
      {betaDisabled && (
        <div style={hintStyle}>
          β deshabilitado: Terzaghi no usa factores de inclinación.
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════
 * SECCIÓN: ASENTAMIENTO (toggle)
 * ═══════════════════════════════════════════════ */
function SettlementToggleSection({ enabled, onToggle }: {
  enabled: boolean; onToggle: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  // S_max es UI-only por ahora (motor de asentamiento pendiente)
  const [sMax, setSMax] = useState(25);

  return (
    <Section title="Asentamiento" open={open} onToggle={() => setOpen(!open)}>
      <label style={checkboxLabelStyle}>
        <input type="checkbox" className="cad-checkbox" checked={enabled}
          onChange={(e) => onToggle(e.target.checked)} />
        Habilitar módulo de asentamiento
      </label>
      {enabled && (
        <>
          <PropRow label="S_max (mm)">
            <CadNumericInput value={sMax} step={5} min={0}
              onChange={(v) => setSMax(v)} />
          </PropRow>
          <div style={hintStyle}>
            Las columnas Es, μs aparecen en la tabla de estratos.
            <br />Motor de asentamiento aún no implementado en el backend.
          </div>
        </>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════
 * SECCIÓN: DISEÑO RÁPIDO (tipo + B/L/k + botón ventana)
 * ═══════════════════════════════════════════════ */
function QuickDesignSection() {
  const [open, setOpen] = useState(true);
  const f = useFoundationStore((s) => s.foundation);
  const setType = useFoundationStore((s) => s.setFoundationType);
  const setParam = useFoundationStore((s) => s.setFoundationParam);
  const lbLocked = useFoundationStore((s) => s.lbLocked);
  const lbRatio = useFoundationStore((s) => s.lbRatio);
  const setLbLocked = useFoundationStore((s) => s.setLbLocked);
  const setLbRatio = useFoundationStore((s) => s.setLbRatio);
  const addTab = useWorkspaceStore((s) => s.addTab);

  return (
    <Section title="Geometría Rápida" open={open} onToggle={() => setOpen(!open)}>
      {/* Type segmented control (Lucid pill group) */}
      <div style={{
        display: 'flex',
        background: 'var(--lucid-surface-figure)',
        border: '1px solid var(--lucid-rule-cream)',
        borderRadius: 4,
        padding: 2,
        gap: 2,
        marginBottom: 10,
      }}>
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: f.type === t.value ? '#fff' : 'transparent',
              border: 'none',
              boxShadow: f.type === t.value ? '0 0 0 1px var(--lucid-rule-cream) inset' : 'none',
              borderRadius: 3,
              color: f.type === t.value ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-body)',
              fontSize: 13,
              fontFamily: 'var(--lucid-font-serif)',
              cursor: 'pointer',
              transition: 'all 160ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <PropRow label="Lado B (m)">
        <CadNumericInput value={f.B} step={0.1} min={0}
          onChange={(v) => setParam('B', v)} />
      </PropRow>

      {f.type === 'rectangular' && (
        <>
          <PropRow label="Lado L (m)">
            <CadNumericInput value={f.L} step={0.1} min={0}
              onChange={(v) => setParam('L', v)}
              disabled={lbLocked} />
          </PropRow>
          <div style={{ marginBottom: 6, padding: '4px 0' }}>
            <label style={checkboxLabelStyle}>
              <input type="checkbox" className="cad-checkbox" checked={lbLocked}
                onChange={(e) => setLbLocked(e.target.checked)} />
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

      <button
        onClick={() => addTab?.('foundation-design')}
        style={{
          width: '100%', marginTop: 8, padding: '8px 10px',
          background: '#fff',
          border: '1px solid var(--lucid-rule-cream)',
          borderRadius: 4,
          color: 'var(--lucid-ink-strong)',
          fontSize: 12,
          fontFamily: 'var(--lucid-font-sans)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'background 160ms cubic-bezier(0.4,0,0.2,1), border-color 160ms cubic-bezier(0.4,0,0.2,1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--lucid-surface-figure)';
          e.currentTarget.style.borderColor = 'var(--lucid-ink-strong)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fff';
          e.currentTarget.style.borderColor = 'var(--lucid-rule-cream)';
        }}
        title="Abrir ventana de Diseño de Cimentación (excentricidades, vista en planta)"
      >
        <Frame size={13} style={{ color: 'var(--lucid-acc-coral)' }} />
        Abrir Diseño de Cimentación
      </button>
    </Section>
  );
}

/* ═══════════════════════════════════════════════
 * SECCIÓN: SOLUCIÓN (FS, método)
 * ═══════════════════════════════════════════════ */
function SolutionSection() {
  const [open, setOpen] = useState(true);
  const f = useFoundationStore((s) => s.foundation);
  const setParam = useFoundationStore((s) => s.setFoundationParam);
  const method = useFoundationStore((s) => s.method);
  const setMethod = useFoundationStore((s) => s.setMethod);
  const fType = useFoundationStore((s) => s.foundation.type);
  const isRectangular = fType === 'rectangular';

  // Auto-switch a General si Terzaghi+rectangular
  if (isRectangular && method === 'terzaghi') {
    setMethod('general');
  }

  return (
    <Section title="Factor y Método" open={open} onToggle={() => setOpen(!open)}>
      <PropRow label="Factor Seguridad">
        <CadNumericInput value={f.FS} step={0.5} min={1}
          onChange={(v) => setParam('FS', v)} />
      </PropRow>

      <div style={{
        marginTop: 10, fontSize: 10, fontWeight: 600,
        color: 'var(--lucid-ink-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
        fontFamily: 'var(--lucid-font-sans)',
      }}>
        Método
      </div>
      <div style={{
        display: 'flex',
        background: 'var(--lucid-surface-figure)',
        border: '1px solid var(--lucid-rule-cream)',
        borderRadius: 4,
        padding: 2,
        gap: 2,
      }}>
        {METHODS.map(m => {
          const isBlocked = m.value === 'terzaghi' && isRectangular;
          const isActive = method === m.value;
          return (
            <button
              key={m.value}
              onClick={() => !isBlocked && setMethod(m.value)}
              title={isBlocked ? 'Terzaghi no aplica para cimentaciones rectangulares' : undefined}
              style={{
                flex: 1, padding: '6px 4px',
                background: isActive ? '#fff' : 'transparent',
                boxShadow: isActive ? '0 0 0 1px var(--lucid-rule-cream) inset' : 'none',
                border: 'none',
                borderRadius: 3,
                color: isBlocked
                  ? 'var(--lucid-ink-faint)'
                  : isActive ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-body)',
                fontSize: 12,
                fontFamily: 'var(--lucid-font-serif)',
                cursor: isBlocked ? 'not-allowed' : 'pointer',
                opacity: isBlocked ? 0.5 : 1,
                transition: 'all 160ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {isRectangular && (
        <div style={hintStyle}>Terzaghi no disponible para cimentación rectangular.</div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════
 * SUB-COMPONENTES REUSABLES
 * ═══════════════════════════════════════════════ */

function SectionGroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 14px 6px',
      background: 'var(--lucid-surface-page)',
      fontFamily: 'var(--lucid-font-sans)',
      fontSize: 10,
      fontWeight: 600,
      color: 'var(--lucid-ink-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
    }}>
      {children}
    </div>
  );
}

function Section({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="section-header"
        onClick={onToggle}
        style={{ justifyContent: 'space-between', textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {title}
        </span>
        <span style={{
          display: 'grid', placeItems: 'center',
          color: 'var(--lucid-ink-muted)',
        }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </div>
      {open && <div className="section-content">{children}</div>}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{
        fontFamily: 'var(--lucid-font-sans)',
        fontSize: 11,
        color: 'var(--lucid-ink-body)',
        minWidth: 110, flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: 'var(--lucid-font-sans)',
  fontSize: 12,
  cursor: 'pointer',
  color: 'var(--lucid-ink-body)',
  padding: '4px 0',
  userSelect: 'none',
};

const hintStyle: React.CSSProperties = {
  marginTop: 6,
  fontFamily: 'var(--lucid-font-sans)',
  fontSize: 10,
  color: 'var(--lucid-ink-muted)',
  fontStyle: 'italic',
  lineHeight: 1.4,
};
