/**
 * PropertiesPanel — Left panel: all input sections in Revit property-palette style.
 * Uses CadNumericInput for all numeric fields (allows clearing to empty/dash).
 */
import { useState } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import type { CalculationMethod, FoundationType } from '../../types/geotechnical';
import CadNumericInput from '../common/CadNumericInput';
import { useViewerSettings } from '../../store/viewerSettingsStore';

const TYPES: { value: FoundationType; label: string }[] = [
  { value: 'cuadrada', label: 'Cuadrada' },
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'circular', label: 'Circular' },
  { value: 'franja', label: 'Franja' },
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

/* ─── Foundation Type ─── */
function TypeSection() {
  const [open, setOpen] = useState(true);
  const type = useFoundationStore((s) => s.foundation.type);
  const setType = useFoundationStore((s) => s.setFoundationType);

  return (
    <Section title="Tipo de Cimentación" open={open} onToggle={() => setOpen(!open)}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
        {TYPES.map(t => (
          <button
            key={t.value}
            className={type === t.value ? 'cad-btn cad-btn-accent' : 'cad-btn'}
            onClick={() => setType(t.value)}
            style={{ fontSize: 11, padding: '5px 4px' }}
          >
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

  return (
    <Section title="Dimensiones" open={open} onToggle={() => setOpen(!open)}>
      <PropRow label="Lado B (m)">
        <CadNumericInput value={f.B} step={0.1} min={0}
          onChange={(v) => setParam('B', v)} />
      </PropRow>
      {(f.type === 'rectangular') && (
        <PropRow label="Lado L (m)">
          <CadNumericInput value={f.L} step={0.1} min={0}
            onChange={(v) => setParam('L', v)} />
        </PropRow>
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

  return (
    <Section title="Método de Cálculo" open={open} onToggle={() => setOpen(!open)}>
      <div style={{ display: 'flex', gap: 3 }}>
        {METHODS.map(m => (
          <button
            key={m.value}
            className={method === m.value ? 'cad-btn cad-btn-accent' : 'cad-btn'}
            onClick={() => setMethod(m.value)}
            style={{ flex: 1, fontSize: 10, padding: '5px 2px' }}
          >
            {m.label}
          </button>
        ))}
      </div>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
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

/* ─── Strata ─── */
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ color: '#888' }}>
            <th style={{ padding: '2px 4px', width: 24 }}>N°</th>
            <th style={{ padding: '2px 2px' }}>h(m)</th>
            <th style={{ padding: '2px 2px' }}>γ</th>
            <th style={{ padding: '2px 2px' }}>c</th>
            <th style={{ padding: '2px 2px' }}>φ</th>
            <th style={{ padding: '2px 2px' }}>γsat</th>
            <th style={{ padding: '2px 2px', width: 20 }}></th>
          </tr>
        </thead>
        <tbody>
          {strata.map((s, i) => (
            <tr key={s.id}>
              <td style={{ textAlign: 'center', position: 'relative' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <input
                    type="color"
                    value={strataColors[i % strataColors.length]}
                    onChange={(e) => setStrataColor(i, e.target.value)}
                    style={{
                      width: 10, height: 10, padding: 0, border: 'none',
                      background: 'none', cursor: 'pointer',
                    }}
                  />
                  <span style={{ color: '#c0392b', fontWeight: 700, fontSize: 11 }}>{i + 1}</span>
                </label>
              </td>
              <td><CadNumericInput className="stratum-input" value={s.thickness} step={0.1}
                onChange={(v) => updateStratum(s.id, { thickness: v })} /></td>
              <td><CadNumericInput className="stratum-input" value={s.gamma} step={0.5}
                onChange={(v) => updateStratum(s.id, { gamma: v })} /></td>
              <td><CadNumericInput className="stratum-input" value={s.c} step={1}
                onChange={(v) => updateStratum(s.id, { c: v })} /></td>
              <td><CadNumericInput className="stratum-input" value={s.phi} step={1}
                onChange={(v) => updateStratum(s.id, { phi: v })} /></td>
              <td><CadNumericInput className="stratum-input" value={s.gammaSat} step={0.5}
                onChange={(v) => updateStratum(s.id, { gammaSat: v })} /></td>
              <td>
                {strata.length > 1 && (
                  <button
                    onClick={() => removeStratum(s.id)}
                    style={{
                      background: 'none', border: 'none', color: '#777', cursor: 'pointer',
                      fontSize: 12, padding: 0,
                    }}
                    title="Eliminar estrato"
                  >×</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="cad-btn"
        onClick={addStratum}
        style={{ width: '100%', marginTop: 6, fontSize: 10, padding: '3px 0' }}
      >
        + Agregar estrato
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
          fontSize: 8,
          transition: 'transform 0.15s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>▶</span>
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
      marginBottom: 4,
    }}>
      <span style={{ fontSize: 11, color: '#aaa', minWidth: 110, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
