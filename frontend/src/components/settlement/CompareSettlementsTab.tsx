import { useState } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import type { CompareSettlementFooting } from '../../store/foundationStore';
import { useUnitStore } from '../../store/unitStore';
import CadNumericInput from '../common/CadNumericInput';
import { Play, Plus, X, Loader2 } from 'lucide-react';

const G = 9.80665;

function makeFooting(existing: CompareSettlementFooting[]): CompareSettlementFooting {
  const used = new Set(existing.map((f) => f.id));
  let n = existing.length + 1;
  while (used.has(`Z${n}`)) n += 1;
  return { id: `Z${n}`, B: 1.6, L: 2.0, Df: 1.6, Q: 50 };
}

export default function CompareSettlementsTab() {
  const strata = useFoundationStore((s) => s.strata);
  const conditions = useFoundationStore((s) => s.conditions);
  const settlementParams = useFoundationStore((s) => s.settlementParams);
  const fStore = useFoundationStore((s) => s.foundation);
  const compareSettlementConfig = useFoundationStore((s) => s.compareSettlementConfig);
  const setCompareSettlementConfig = useFoundationStore((s) => s.setCompareSettlementConfig);

  const { footings, spans } = compareSettlementConfig;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pUnit = useUnitStore((s) => s.outputLabel('pressure'));

  function resizeSpans(newSize: number, current: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < newSize; i++) {
      const row: number[] = [];
      for (let j = 0; j < newSize; j++) {
        if (i === j) row.push(0);
        else if (current[i]?.[j] != null) row.push(current[i][j]);
        else row.push(5);
      }
      result.push(row);
    }
    return result;
  }

  const addFooting = () => {
    const next = [...footings, makeFooting(footings)];
    setCompareSettlementConfig({ footings: next, spans: resizeSpans(next.length, spans) });
  };

  const removeFooting = (idx: number) => {
    if (footings.length <= 2) return;
    const next = footings.filter((_, i) => i !== idx);
    const nextSpans = spans
      .filter((_, i) => i !== idx)
      .map((row) => row.filter((_, j) => j !== idx));
    setCompareSettlementConfig({ footings: next, spans: nextSpans });
  };

  const updateFooting = (idx: number, patch: Partial<CompareSettlementFooting>) => {
    setCompareSettlementConfig({
      footings: footings.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
      spans,
    });
  };

  const updateSpan = (i: number, j: number, value: number) => {
    if (i === j) return;
    const next = spans.map((row) => [...row]);
    next[i][j] = value;
    next[j][i] = value;
    setCompareSettlementConfig({ footings, spans: next });
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const strataForAPI = strata.map((s) => {
        const out: Record<string, unknown> = {
          id: s.id, thickness: s.thickness,
          gamma: s.gamma * G, c: s.c * G,
          phi: s.phi, gammaSat: s.gammaSat * G,
        };
        if (typeof s.Es === 'number' && s.Es > 0) out.Es = s.Es * G;
        if (typeof s.mu_s === 'number') out.mu_s = s.mu_s;
        if (s.is_clay) out.is_clay = true;
        if (typeof s.Cc === 'number' && s.Cc > 0) out.Cc = s.Cc;
        if (typeof s.Cs === 'number' && s.Cs > 0) out.Cs = s.Cs;
        if (typeof s.e0 === 'number' && s.e0 > 0) out.e0 = s.e0;
        if (typeof s.sigma_c === 'number' && s.sigma_c > 0) out.sigma_c = s.sigma_c * G;
        if (typeof s.Calpha === 'number' && s.Calpha > 0) out.Calpha = s.Calpha;
        if (typeof s.ep === 'number' && s.ep > 0) out.ep = s.ep;
        return out;
      });
      const footingsPayload = footings.map((f) => ({
        id: f.id,
        foundation: {
          type: f.B === f.L ? 'cuadrada' : 'rectangular',
          B: f.B, L: f.L, Df: f.Df,
          FS: fStore.FS, beta: fStore.beta,
          Q: f.Q * G,
        },
        strata: strataForAPI,
        conditions,
        settlement: settlementParams,
      }));
      const resp = await fetch('/api/compare-settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ footings: footingsPayload, spans }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Error servidor' }));
        throw new Error(err.detail || `Error ${resp.status}`);
      }
      setResult(await resp.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--lucid-surface-page-warm)',
      overflow: 'auto', padding: 24,
    }}>
      <div style={{
        maxWidth: 1000, margin: '0 auto',
        fontFamily: 'var(--lucid-font-serif)',
      }}>
        <h2 style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 14, fontWeight: 600,
          color: 'var(--lucid-ink-strong)',
          textTransform: 'uppercase', letterSpacing: '0.10em',
          marginBottom: 16,
        }}>
          Comparar zapatas — asentamiento diferencial y distorsión (Bjerrum)
        </h2>

        <Section title="Zapatas">
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>B (m)</Th>
                <Th>L (m)</Th>
                <Th>Df (m)</Th>
                <Th>Q (tnf)</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {footings.map((f, i) => (
                <tr key={f.id}>
                  <Td><input
                    value={f.id}
                    onChange={(e) => updateFooting(i, { id: e.target.value })}
                    style={textInputStyle}
                  /></Td>
                  <Td><CadNumericInput value={f.B} step={0.1} min={0}
                    onChange={(v) => updateFooting(i, { B: v })} /></Td>
                  <Td><CadNumericInput value={f.L} step={0.1} min={0}
                    onChange={(v) => updateFooting(i, { L: v })} /></Td>
                  <Td><CadNumericInput value={f.Df} step={0.1} min={0}
                    onChange={(v) => updateFooting(i, { Df: v })} /></Td>
                  <Td><CadNumericInput value={f.Q} step={5} min={0}
                    onChange={(v) => updateFooting(i, { Q: v })} /></Td>
                  <Td>{footings.length > 2 && (
                    <button onClick={() => removeFooting(i)}
                            style={iconBtnStyle} title="Eliminar zapata">
                      <X size={11} />
                    </button>
                  )}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addFooting} style={addBtnStyle}>
            <Plus size={12} /> Agregar zapata
          </button>
        </Section>

        <Section title="Matriz de luces L_ij (m)">
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th> </Th>
                {footings.map((f) => <Th key={f.id}>{f.id}</Th>)}
              </tr>
            </thead>
            <tbody>
              {footings.map((fi, i) => (
                <tr key={fi.id}>
                  <Th>{fi.id}</Th>
                  {footings.map((fj, j) => (
                    <Td key={fj.id}>
                      {i === j ? (
                        <span style={{ color: 'var(--lucid-ink-faint)' }}>—</span>
                      ) : (
                        <CadNumericInput value={spans[i]?.[j] ?? 0} step={0.5} min={0.1}
                          onChange={(v) => updateSpan(i, j, v)} />
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--lucid-ink-muted)' }}>
            Matriz simétrica con diagonal cero (al editar L_ij, L_ji se actualiza automáticamente).
          </div>
        </Section>

        <button
          onClick={run}
          disabled={loading}
          style={{
            ...runBtnStyle,
            background: loading ? 'var(--lucid-surface-figure)' : 'var(--lucid-acc-coral)',
            color: loading ? 'var(--lucid-ink-muted)' : 'white',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
          {loading ? 'Calculando…' : 'Comparar zapatas'}
        </button>

        {error && (
          <div style={errorBoxStyle}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <>
            <Section title="Asentamiento total por zapata">
              <table style={tableStyle}>
                <thead>
                  <tr><Th>ID</Th><Th>S_total (mm)</Th><Th>Se (mm)</Th><Th>Sc_p (mm)</Th><Th>Sc_s (mm)</Th></tr>
                </thead>
                <tbody>
                  {result.footings.map((r: any) => (
                    <tr key={r.id}>
                      <Td><strong>{r.id}</strong></Td>
                      <Td>{r.S_total_mm.toFixed(2)}</Td>
                      <Td>{r.Se != null ? (r.Se * 1000).toFixed(2) : '—'}</Td>
                      <Td>{r.Sc_p != null ? (r.Sc_p * 1000).toFixed(2) : '—'}</Td>
                      <Td>{r.Sc_s != null ? (r.Sc_s * 1000).toFixed(2) : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Matriz de asentamientos diferenciales δ_ij (mm)">
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th> </Th>
                    {result.footings.map((r: any) => <Th key={r.id}>{r.id}</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.delta_matrix_mm.map((row: number[], i: number) => (
                    <tr key={i}>
                      <Th>{result.footings[i].id}</Th>
                      {row.map((v, j) => (
                        <Td key={j} style={i === j ? { color: 'var(--lucid-ink-faint)' } : undefined}>
                          {i === j ? '—' : v.toFixed(2)}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Matriz de distorsión angular β_ij (1/N)">
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th> </Th>
                    {result.footings.map((r: any) => <Th key={r.id}>{r.id}</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.beta_matrix.map((row: number[], i: number) => (
                    <tr key={i}>
                      <Th>{result.footings[i].id}</Th>
                      {row.map((v, j) => (
                        <Td key={j} style={i === j ? { color: 'var(--lucid-ink-faint)' } : undefined}>
                          {i === j ? '—' : v > 0 ? `1 / ${(1 / v).toFixed(0)}` : '∞'}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Peor par y clasificación Bjerrum">
              <div style={{
                padding: 14,
                background: result.bjerrum.cumple_sin_grietas ? 'var(--lucid-acc-sage-bg)' : 'var(--lucid-tint-coral)',
                border: `1px solid ${result.bjerrum.cumple_sin_grietas ? 'var(--lucid-acc-sage-border)' : 'var(--lucid-acc-coral-border)'}`,
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--lucid-ink-strong)' }}>
                  Par crítico: {result.worst.id_a} ↔ {result.worst.id_b}
                </div>
                <div style={{ fontSize: 13, color: 'var(--lucid-ink-body)', lineHeight: 1.8 }}>
                  δ = <strong>{(result.worst.delta * 1000).toFixed(2)} mm</strong>{' '}
                  · L = <strong>{result.worst.span.toFixed(2)} m</strong>{' '}
                  · β = <strong>1/{result.bjerrum.beta_1_over_N.toFixed(0)}</strong>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--lucid-ink-strong)' }}>
                  <strong>{result.bjerrum.categoria_label}</strong>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--lucid-ink-body)' }}>
                  {result.bjerrum.cumple_sin_grietas
                    ? '✓ Cumple β ≤ 1/500 (límite seguro sin grietas)'
                    : '✗ Excede β = 1/500 (límite seguro sin grietas)'}
                </div>
              </div>
            </Section>

            <div style={{ fontSize: 10, color: 'var(--lucid-ink-muted)', marginTop: 12 }}>
              qa (falla, del cálculo principal): {result.footings.some((r: any) => r.warnings.length) && '— hay warnings, revisar.'}
              {pUnit && ` Unidad de presión seleccionada: ${pUnit}`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontFamily: 'var(--lucid-font-sans)',
        fontSize: 11, fontWeight: 600,
        color: 'var(--lucid-ink-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8,
      }}>{title}</div>
      <div style={{
        padding: 12,
        background: 'var(--lucid-surface-page)',
        border: '1px solid var(--lucid-rule-white)',
        borderRadius: 4,
      }}>{children}</div>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 11,
};

const Th = ({ children }: { children: React.ReactNode }) => (
  <th style={{
    padding: '6px 8px',
    textAlign: 'center', fontWeight: 600,
    color: 'var(--lucid-ink-muted)',
    fontFamily: 'var(--lucid-font-sans)',
    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--lucid-rule-cream)',
  }}>{children}</th>
);
const Td = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{
    padding: '4px 8px', textAlign: 'center',
    color: 'var(--lucid-ink-body)',
    borderBottom: '1px dashed var(--lucid-rule-white)',
    ...style,
  }}>{children}</td>
);

const textInputStyle: React.CSSProperties = {
  width: 60, padding: '4px 6px',
  background: 'var(--lucid-surface-page)',
  border: '1px solid var(--lucid-rule-cream)',
  borderRadius: 3,
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 11, color: 'var(--lucid-ink-strong)',
  textAlign: 'center',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: 2,
  color: 'var(--lucid-ink-faint)', cursor: 'pointer',
};

const addBtnStyle: React.CSSProperties = {
  marginTop: 10, padding: '6px 12px',
  background: 'transparent',
  border: '1px dashed var(--lucid-rule-cream)',
  borderRadius: 4,
  color: 'var(--lucid-ink-body)',
  fontFamily: 'var(--lucid-font-sans)', fontSize: 12,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
};

const runBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  border: 'none', borderRadius: 4,
  fontFamily: 'var(--lucid-font-sans)',
  fontSize: 13, fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 8,
  margin: '12px 0',
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: 8, padding: '10px 14px',
  background: 'var(--lucid-tint-coral)',
  border: '1px solid var(--lucid-acc-coral-border)',
  borderRadius: 4,
  color: 'var(--lucid-acc-coral-text)',
  fontFamily: 'var(--lucid-font-serif)', fontSize: 13,
};
