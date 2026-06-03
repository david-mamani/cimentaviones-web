import { useState, useCallback } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useUnitStore } from '../../store/unitStore';
import type { PressureUnit, ForceUnit } from '../../store/unitStore';
import { triggerCalculateWithValidation } from '../../lib/calculateHelper';
import type {
  FoundationParams,
  Stratum,
  SpecialConditions,
  CalculationResult,
  CalculationMethod,
  CriterionKey,
  EccentricityInfo,
} from '../../types/geotechnical';
import { Play, Loader2 } from 'lucide-react';

const PDF_RENDER_WIDTH = 1200;
const PDF_JPEG_QUALITY = 0.85;
const PDF_MIN_IMAGE_SIZE = 5000;
const ERROR_TRUNCATE_LENGTH = 200;
const PDF_BG_COLOR = '#ffffff';
const PDF_TEXT_COLOR = '#333333';
const G = 9.80665;

const METHOD_LABELS: Record<CalculationMethod, string> = {
  terzaghi: 'Terzaghi',
  general: 'Ec. General',
  rne: 'RNE E.050',
};

const WATER_TABLE_CASE_LABELS: Record<number, string> = {
  0: 'Sin NF',
  1: 'NF sobre la base (cimentación sumergida)',
  2: 'NF en la base',
  3: 'NF dentro del bulbo (γ interpolado)',
  4: 'NF por debajo del bulbo (sin efecto)',
};

const CRITERION_LABELS: Record<CriterionKey, string> = {
  general: 'General (S₁+S₂+S₃)',
  rne: 'RNE',
  rne_corrected: 'RNE corregido',
};

const fmt3 = (v: number | null | undefined): string =>
  (v == null || !isFinite(v)) ? '—' : v.toFixed(3);

export default function OutputPanel() {
  const result = useFoundationStore((s) => s.result);
  const errors = useFoundationStore((s) => s.errors);
  const foundation = useFoundationStore((s) => s.foundation);
  const strata = useFoundationStore((s) => s.strata);
  const conditions = useFoundationStore((s) => s.conditions);
  const method = useFoundationStore((s) => s.method);
  const selectedCriterion = useFoundationStore((s) => s.selectedCriterion);

  return (
    <div>
      <CalculateSection />

      {errors.length > 0 && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--lucid-tint-coral)',
          borderBottom: '1px solid var(--lucid-rule-white)',
        }}>
          <p style={{
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 10, fontWeight: 600, color: 'var(--lucid-acc-coral-text)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: 6,
          }}>
            Errores de validación
          </p>
          {errors.map((e, i) => (
            <p key={i} style={{
              fontFamily: 'var(--lucid-font-serif)',
              fontSize: 12, color: 'var(--lucid-acc-coral-text)', marginBottom: 4, lineHeight: 1.4,
            }}>
              · {e}
            </p>
          ))}
        </div>
      )}

      {result && (
        <>
          <QuickResultSection result={result} method={method} criterion={selectedCriterion} />
          <MethodCriterionMatrix result={result} method={method} criterion={selectedCriterion} />
          {result.eccentricity && <EccentricitySection eccentricity={result.eccentricity} />}
          <FactorsSection result={result} />
          {result.warnings && result.warnings.length > 0 && (
            <WarningsSection warnings={result.warnings} />
          )}
          <RNESection result={result} />
          <ExportSection
            foundation={foundation}
            strata={strata}
            conditions={conditions}
            method={method}
            result={result}
          />
        </>
      )}
    </div>
  );
}

function CalculateSection() {
  const isCalculating = useFoundationStore((s) => s.isCalculating);
  const selectedCriterion = useFoundationStore((s) => s.selectedCriterion);
  const setSelectedCriterion = useFoundationStore((s) => s.setSelectedCriterion);

  return (
    <div style={{
      padding: '14px 14px 16px',
      borderBottom: '1px solid var(--lucid-rule-white)',
      background: 'var(--lucid-surface-page)',
    }}>
      <button
        onClick={() => triggerCalculateWithValidation()}
        disabled={isCalculating}
        style={{
          width: '100%', padding: '10px 0',
          background: isCalculating ? 'var(--lucid-surface-figure)' : 'var(--lucid-button-primary-bg)',
          border: 'none', borderRadius: 999,
          color: isCalculating ? 'var(--lucid-ink-muted)' : 'var(--lucid-button-primary-fg)',
          fontSize: 13, fontWeight: 500,
          fontFamily: 'var(--lucid-font-sans)',
          cursor: isCalculating ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 160ms cubic-bezier(0.4,0,0.2,1)',
        }}
        onMouseEnter={(e) => { if (!isCalculating) e.currentTarget.style.background = 'var(--lucid-button-primary-bg-hover)'; }}
        onMouseLeave={(e) => { if (!isCalculating) e.currentTarget.style.background = 'var(--lucid-button-primary-bg)'; }}
      >
        {isCalculating
          ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          : <Play size={12} fill="currentColor" style={{ color: 'var(--lucid-acc-coral)' }} />}
        {isCalculating ? 'Calculando...' : 'Calcular'}
      </button>

      <div style={{ marginTop: 14 }}>
        <div style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 10, fontWeight: 600, color: 'var(--lucid-ink-muted)',
          textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
        }}>
          Criterio a mostrar
        </div>
        <div style={{
          display: 'flex',
          border: '1px solid var(--lucid-rule-cream)',
          borderRadius: 999,
          padding: 2,
          background: 'var(--lucid-surface-page)',
        }}>
          {(['general', 'rne', 'rne_corrected'] as CriterionKey[]).map((c) => {
            const isActive = selectedCriterion === c;
            return (
              <button
                key={c}
                onClick={() => setSelectedCriterion(c)}
                style={{
                  flex: 1, padding: '5px 8px',
                  background: isActive ? 'var(--lucid-ink-strong)' : 'transparent',
                  border: 'none',
                  borderRadius: 999,
                  color: isActive ? 'var(--lucid-ink-invert)' : 'var(--lucid-ink-body)',
                  fontSize: 11,
                  fontFamily: 'var(--lucid-font-serif)',
                  cursor: 'pointer',
                  transition: 'all 160ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {CRITERION_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      <OutputUnitSelector />
    </div>
  );
}

function OutputUnitSelector() {
  const pressure = useUnitStore((s) => s.output.pressure);
  const force = useUnitStore((s) => s.output.force);
  const setOutput = useUnitStore((s) => s.setOutput);
  return (
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <div>
        <div style={{
          fontFamily: 'var(--lucid-font-sans)', fontSize: 9, fontWeight: 600,
          color: 'var(--lucid-ink-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
        }}>Presión</div>
        <div style={{
          display: 'flex',
          background: 'var(--lucid-surface-figure)',
          border: '1px solid var(--lucid-rule-cream)',
          borderRadius: 4, padding: 2, gap: 2,
        }}>
          {(['t/m²', 'kPa', 'kg/cm²'] as PressureUnit[]).map((u) => (
            <UnitPill key={u} active={pressure === u} onClick={() => setOutput({ pressure: u })}>{u}</UnitPill>
          ))}
        </div>
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--lucid-font-sans)', fontSize: 9, fontWeight: 600,
          color: 'var(--lucid-ink-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
        }}>Fuerza</div>
        <div style={{
          display: 'flex',
          background: 'var(--lucid-surface-figure)',
          border: '1px solid var(--lucid-rule-cream)',
          borderRadius: 4, padding: 2, gap: 2,
        }}>
          {(['t', 'kN', 'kgf'] as ForceUnit[]).map((u) => (
            <UnitPill key={u} active={force === u} onClick={() => setOutput({ force: u })}>{u}</UnitPill>
          ))}
        </div>
      </div>
    </div>
  );
}

function UnitPill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '4px 6px',
        background: active ? 'var(--lucid-surface-page)' : 'transparent',
        boxShadow: active ? '0 0 0 1px var(--lucid-rule-cream) inset' : 'none',
        border: 'none', borderRadius: 3,
        color: active ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-body)',
        fontSize: 10, fontFamily: 'var(--lucid-font-mono, monospace)',
        cursor: 'pointer',
      }}
    >{children}</button>
  );
}

function QuickResultSection({ result, method, criterion }: {
  result: CalculationResult; method: CalculationMethod; criterion: CriterionKey;
}) {
  const matrixBlock = result.methodCriteriaMatrix?.[method];
  const critData = matrixBlock?.criteria?.[criterion];

  const qu = critData?.qu ?? result.qu;
  const qa = critData?.qa ?? result.qa;
  const Qmax = critData?.Qmax ?? result.Qmax;
  const S1 = matrixBlock?.S1 ?? result.F1;
  const S2 = matrixBlock?.S2 ?? result.F2;
  const S3 = matrixBlock?.S3 ?? result.F3;
  const qnet = qu - result.q;
  const qa_net = qnet / (qu > 0 ? (qu / qa) : 1);

  const siToOutput = useUnitStore((s) => s.siToOutput);
  const pUnit = useUnitStore((s) => s.outputLabel('pressure'));
  const fUnit = useUnitStore((s) => s.outputLabel('force'));
  const toP = (v: number) => siToOutput(v, 'pressure');
  const toF = (v: number) => siToOutput(v, 'force');

  return (
    <div style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Resultados — {METHOD_LABELS[method]} / {CRITERION_LABELS[criterion]}
      </div>
      <div style={{ padding: '8px 14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px',
            background: result.soilType === 'Coh' ? 'var(--lucid-acc-slate-bg)' : 'var(--lucid-tint-coral)',
            color: result.soilType === 'Coh' ? 'var(--lucid-acc-slate-text)' : 'var(--lucid-acc-coral-text)',
            border: `1px solid ${result.soilType === 'Coh' ? 'var(--lucid-acc-slate-border)' : 'var(--lucid-acc-coral-border)'}`,
            borderRadius: 999,
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 11, fontWeight: 500,
          }}>
            {result.soilType === 'Coh' ? 'Cohesivo' : 'Friccionante'}
          </span>
          <span style={{
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 11, color: 'var(--lucid-ink-muted)',
          }}>
            Estrato {result.designStratumIndex + 1}
          </span>
        </div>

        <div style={{ textAlign: 'center', padding: '14px 0 18px' }}>
          <div style={{
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 10, fontWeight: 600, color: 'var(--lucid-ink-muted)',
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6,
          }}>
            Capacidad admisible
          </div>
          <div style={{
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 48, fontWeight: 400, color: 'var(--lucid-ink-strong)',
            letterSpacing: '-0.02em', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt3(toP(qa))}
          </div>
          <div style={{
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 11, color: 'var(--lucid-ink-muted)', marginTop: 6,
          }}>
            {pUnit}
          </div>
        </div>

        <ResultRow label="qu" value={toP(qu)} unit={pUnit} />
        <ResultRow label="qneta" value={toP(qnet)} unit={pUnit} />
        <ResultRow label="qa_neta" value={toP(qa_net)} unit={pUnit} />
        <div style={{ borderTop: '1px solid var(--lucid-rule-white)', margin: '8px 0' }} />
        <ResultRow label="Q_max" value={toF(Qmax)} unit={fUnit} accent />

        <div style={{ borderTop: '1px solid var(--lucid-rule-white)', margin: '10px 0' }} />
        <div style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 10, fontWeight: 600, color: 'var(--lucid-ink-muted)',
          marginBottom: 6,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Sumandos ({pUnit})
        </div>
        <div style={{
          display: 'flex', gap: 14,
          fontFamily: 'var(--lucid-font-serif)', fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{ color: 'var(--lucid-ink-body)' }}>S₁ = {fmt3(toP(S1))}</span>
          <span style={{ color: 'var(--lucid-ink-body)' }}>S₂ = {fmt3(toP(S2))}</span>
          <span style={{ color: 'var(--lucid-ink-body)' }}>S₃ = {fmt3(toP(S3))}</span>
        </div>
      </div>
    </div>
  );
}

function MethodCriterionMatrix({ result, method, criterion }: {
  result: CalculationResult; method: CalculationMethod; criterion: CriterionKey;
}) {
  const matrix = result.methodCriteriaMatrix;
  const [metric, setMetric] = useState<'qa' | 'qu' | 'Qmax'>('qa');
  const [open, setOpen] = useState(true);
  const siToOutput = useUnitStore((s) => s.siToOutput);
  const pUnit = useUnitStore((s) => s.outputLabel('pressure'));
  const fUnit = useUnitStore((s) => s.outputLabel('force'));
  if (!matrix) return null;

  const availableMethods = (['terzaghi', 'general', 'rne'] as CalculationMethod[])
    .filter((m) => matrix[m]);

  const criteria: CriterionKey[] = ['general', 'rne', 'rne_corrected'];

  const unit = metric === 'Qmax' ? fUnit : pUnit;
  const getVal = (m: CalculationMethod, c: CriterionKey): number | null => {
    const block = matrix[m];
    if (!block) return null;
    const v = block.criteria?.[c]?.[metric];
    if (typeof v !== 'number') return null;
    return metric === 'Qmax'
      ? siToOutput(v, 'force')
      : siToOutput(v, 'pressure');
  };

  const minByCol: Partial<Record<CriterionKey, CalculationMethod>> = {};
  for (const c of criteria) {
    let bestM: CalculationMethod | null = null;
    let bestV = Infinity;
    for (const m of availableMethods) {
      const v = getVal(m, c);
      if (v == null) continue;
      if (v < bestV) { bestV = v; bestM = m; }
    }
    if (bestM) minByCol[c] = bestM;
  }

  return (
    <div style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
      <div
        className="section-header"
        onClick={() => setOpen(!open)}
        style={{ justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <span>Matriz método × criterio (3×3)</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            display: 'flex',
            background: 'var(--lucid-surface-figure)',
            border: '1px solid var(--lucid-rule-cream)',
            borderRadius: 4, padding: 2, gap: 2,
            fontFamily: 'var(--lucid-font-sans)', fontSize: 10,
          }} onClick={(e) => e.stopPropagation()}>
            {(['qa', 'qu', 'Qmax'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMetric(k)}
                style={{
                  padding: '3px 8px',
                  background: metric === k ? 'var(--lucid-ink-strong)' : 'transparent',
                  color: metric === k ? 'var(--lucid-ink-invert)' : 'var(--lucid-ink-body)',
                  border: 'none', borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 'inherit',
                }}
              >{k}</button>
            ))}
          </div>
          <span style={{ color: 'var(--lucid-ink-muted)' }}>
            {open ? '−' : '+'}
          </span>
        </span>
      </div>
      {open && (
        <div style={{ padding: '8px 14px 16px', overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontFamily: 'var(--lucid-font-serif)', fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <thead>
              <tr>
                <th style={matrixHeaderStyle}>{metric} ({unit})</th>
                {criteria.map((c) => (
                  <th key={c} style={matrixHeaderStyle}>
                    {CRITERION_LABELS[c].split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {availableMethods.map((m) => (
                <tr key={m}>
                  <td style={{
                    ...matrixCellStyle,
                    fontFamily: 'var(--lucid-font-sans)',
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--lucid-ink-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {METHOD_LABELS[m]}
                  </td>
                  {criteria.map((c) => {
                    const v = getVal(m, c);
                    const isSelected = m === method && c === criterion;
                    const isColMin = minByCol[c] === m;
                    return (
                      <td key={c} style={{
                        ...matrixCellStyle,
                        background: isSelected ? 'var(--lucid-tint-coral)' : 'transparent',
                        color: isSelected ? 'var(--lucid-acc-coral-text)' : 'var(--lucid-ink-strong)',
                        fontWeight: isSelected ? 600 : 400,
                        position: 'relative',
                      }}>
                        {v == null ? '—' : fmt3(v)}
                        {isColMin && !isSelected && (
                          <span style={{
                            position: 'absolute', top: 3, right: 4,
                            fontSize: 8, color: 'var(--lucid-ink-muted)',
                          }} title="menor en la columna (más conservador)">▼</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{
            marginTop: 8,
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 10, color: 'var(--lucid-ink-muted)', lineHeight: 1.5,
          }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8,
              background: 'var(--lucid-tint-coral)',
              border: '1px solid var(--lucid-acc-coral-border)',
              marginRight: 4, verticalAlign: 'middle',
            }} />
            Selección activa
            <span style={{ marginLeft: 12 }}>▼ menor por columna (más conservador)</span>
          </div>
        </div>
      )}
    </div>
  );
}

const matrixHeaderStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--lucid-rule-cream)',
  textAlign: 'right',
  fontFamily: 'var(--lucid-font-sans)',
  fontSize: 10, fontWeight: 600,
  color: 'var(--lucid-ink-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
const matrixCellStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px dashed var(--lucid-rule-white)',
  textAlign: 'right',
};

function EccentricitySection({ eccentricity }: { eccentricity: EccentricityInfo }) {
  const ec = eccentricity;
  const fellBack = ec.metodo_area === 'rne' && ec.metodo_area_solicitado === 'highter_anders';
  const siToOutput = useUnitStore((s) => s.siToOutput);
  const pUnit = useUnitStore((s) => s.outputLabel('pressure'));
  const toP = (v: number) => siToOutput(v, 'pressure');
  return (
    <div style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Excentricidad
      </div>
      <div style={{ padding: '8px 14px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {ec.caso_carga && (
            <Chip variant="neutral">
              Carga: <strong>{ec.caso_carga}</strong>
            </Chip>
          )}
          <Chip variant="neutral">
            Régimen: <strong>{ec.regime}</strong>
          </Chip>
          {ec.dentro_kern != null && (
            <Chip variant={ec.dentro_kern ? 'ok' : 'warn'}>
              {ec.dentro_kern ? 'Dentro del kern' : 'Fuera del kern'}
              {ec.kern_metric != null && ` (${ec.kern_metric.toFixed(3)})`}
            </Chip>
          )}
          {ec.metodo_area && (
            <Chip variant={fellBack ? 'warn' : 'neutral'}>
              Método: <strong>{ec.metodo_area === 'highter_anders' ? 'H&A' : 'RNE'}</strong>
              {ec.caso_HA && ` · Caso ${ec.caso_HA}`}
              {fellBack && ' (fallback)'}
            </Chip>
          )}
          {ec.intercambio_aplicado && (
            <Chip variant="neutral">
              Swap B'↔L' aplicado
            </Chip>
          )}
        </div>
        <ResultRow label="B'" value={ec.B_eff} unit="m" />
        <ResultRow label="L'" value={ec.L_eff} unit="m" />
        <ResultRow label="A'" value={ec.A_eff} unit="m²" />
        {ec.qmax != null && (
          <>
            <div style={{ borderTop: '1px solid var(--lucid-rule-white)', margin: '8px 0' }} />
            <ResultRow label="q_max" value={toP(ec.qmax)} unit={pUnit} />
            <ResultRow label="q_min" value={ec.qmin != null ? toP(ec.qmin) : 0} unit={pUnit} />
            <ContactPressureDiagram
              qmax={ec.qmax}
              qmin={ec.qmin}
              B_eff={ec.B_eff}
              regime={ec.regime}
            />
          </>
        )}
        {ec.FS_real != null && (
          <>
            <div style={{ borderTop: '1px solid var(--lucid-rule-white)', margin: '8px 0' }} />
            <ResultRow label="FS_real" value={ec.FS_real} unit="" accent />
            <div style={{ marginTop: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px',
                fontFamily: 'var(--lucid-font-sans)',
                fontSize: 11, fontWeight: 500,
                background: ec.valid ? 'var(--lucid-acc-sage-bg)' : 'var(--lucid-tint-coral)',
                color: ec.valid ? 'var(--lucid-acc-sage-text)' : 'var(--lucid-acc-coral-text)',
                border: `1px solid ${ec.valid ? 'var(--lucid-acc-sage-border)' : 'var(--lucid-acc-coral-border)'}`,
                borderRadius: 999,
              }}>
                {ec.valid ? 'Diseño válido' : 'Falla — FS insuficiente'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ContactPressureDiagram({ qmax, qmin, B_eff, regime }: {
  qmax: number | null;
  qmin: number | null;
  B_eff: number;
  regime: 'uniforme' | 'trapezoidal' | 'triangular';
}) {
  if (qmax == null || qmax <= 0) return null;
  const qmn = qmin ?? 0;
  const pUnit = useUnitStore((s) => s.outputLabel('pressure'));
  const siToOutput = useUnitStore((s) => s.siToOutput);

  const W = 240;
  const H = 90;
  const padL = 10, padR = 10, padT = 8, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const baseY = padT + innerH;

  const hMax = innerH;
  const hMin = qmax > 0 ? (qmn / qmax) * innerH : 0;

  const triCoverage = 0.75;
  const triLeft = padL + (innerW * (1 - triCoverage)) / 2;
  const triRight = padL + innerW - (innerW * (1 - triCoverage)) / 2;

  let path: string;
  if (regime === 'uniforme') {
    path = `M ${padL} ${baseY - hMax} L ${padL + innerW} ${baseY - hMax} L ${padL + innerW} ${baseY} L ${padL} ${baseY} Z`;
  } else if (regime === 'trapezoidal') {
    path = `M ${padL} ${baseY - hMin} L ${padL + innerW} ${baseY - hMax} L ${padL + innerW} ${baseY} L ${padL} ${baseY} Z`;
  } else {
    path = `M ${triLeft} ${baseY} L ${triRight} ${baseY - hMax} L ${triRight} ${baseY} Z`;
  }

  const fmtP = (v: number) => siToOutput(v, 'pressure').toFixed(2);

  return (
    <div style={{
      marginTop: 12, padding: 8,
      background: 'var(--lucid-surface-figure)',
      border: '1px solid var(--lucid-rule-white)',
      borderRadius: 4,
    }}>
      <div style={{
        fontFamily: 'var(--lucid-font-sans)', fontSize: 9, fontWeight: 600,
        color: 'var(--lucid-ink-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
      }}>
        Presiones de contacto ({regime})
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <line x1={padL - 4} y1={padT - 2} x2={padL + innerW + 4} y2={padT - 2}
              stroke="var(--lucid-ink-strong)" strokeWidth={2} />
        <path d={path} fill="var(--lucid-acc-coral)" fillOpacity={0.35}
              stroke="var(--lucid-acc-coral)" strokeWidth={1.5} />
        <line x1={padL - 4} y1={baseY} x2={padL + innerW + 4} y2={baseY}
              stroke="var(--lucid-ink-body)" strokeWidth={1} />
        {regime === 'uniforme' ? (
          <text x={W / 2} y={baseY - hMax / 2}
                fontSize={10} textAnchor="middle"
                fill="var(--lucid-ink-strong)"
                fontFamily="var(--lucid-font-mono, monospace)">
            q = {fmtP(qmax)} {pUnit}
          </text>
        ) : (
          <>
            <text x={padL + innerW} y={baseY - hMax - 3}
                  fontSize={9} textAnchor="end"
                  fill="var(--lucid-acc-coral-text)"
                  fontFamily="var(--lucid-font-mono, monospace)">
              q_max = {fmtP(qmax)}
            </text>
            <text x={padL} y={baseY - hMin - 3}
                  fontSize={9} textAnchor="start"
                  fill="var(--lucid-ink-body)"
                  fontFamily="var(--lucid-font-mono, monospace)">
              q_min = {fmtP(qmn)}
            </text>
          </>
        )}
        <text x={W / 2} y={baseY + 14}
              fontSize={9} textAnchor="middle"
              fill="var(--lucid-ink-muted)"
              fontFamily="var(--lucid-font-mono, monospace)">
          B' = {B_eff.toFixed(2)} m · unidad: {pUnit}
        </text>
      </svg>
    </div>
  );
}

function FactorsSection({ result }: { result: CalculationResult }) {
  const bf = result.bearingFactors;
  const sf = result.shapeFactors;
  const df = result.depthFactors;
  const inc = result.inclinationFactors;
  const siToOutput = useUnitStore((s) => s.siToOutput);
  const pUnit = useUnitStore((s) => s.outputLabel('pressure'));
  const uwUnit = useUnitStore((s) => s.outputLabel('unitWeight'));
  return (
    <div style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Factores
      </div>
      <div style={{ padding: '8px 14px 16px' }}>
        <FactorRow label="Capacidad" items={[
          { sym: 'Nc', val: bf.Nc },
          { sym: 'Nq', val: bf.Nq },
          { sym: 'Nγ', val: bf.Ngamma },
        ]} />
        {sf && (sf.sc !== 1 || sf.sq !== 1 || sf.sgamma !== 1) && (
          <FactorRow label="Forma" items={[
            { sym: 'Fcs', val: sf.sc },
            { sym: 'Fqs', val: sf.sq },
            { sym: 'Fγs', val: sf.sgamma },
          ]} />
        )}
        {df && (df.dc !== 1 || df.dq !== 1 || df.dgamma !== 1) && (
          <FactorRow label="Profundidad" items={[
            { sym: 'Fcd', val: df.dc },
            { sym: 'Fqd', val: df.dq },
            { sym: 'Fγd', val: df.dgamma },
          ]} />
        )}
        {inc && (inc.ic !== 1 || inc.iq !== 1 || inc.igamma !== 1) && (
          <FactorRow label="Inclinación" items={[
            { sym: 'Fci', val: inc.ic },
            { sym: 'Fqi', val: inc.iq },
            { sym: 'Fγi', val: inc.igamma },
          ]} />
        )}
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px solid var(--lucid-rule-white)',
          fontFamily: 'var(--lucid-font-serif)',
          fontSize: 12, color: 'var(--lucid-ink-body)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <em style={{ color: 'var(--lucid-ink-muted)', fontStyle: 'italic' }}>q</em> = {fmt3(siToOutput(result.q, 'pressure'))} {pUnit}
          {' · '}
          <em style={{ color: 'var(--lucid-ink-muted)', fontStyle: 'italic' }}>γ</em><sub>eff</sub> = {fmt3(siToOutput(result.gammaEffective, 'unitWeight'))} {uwUnit}
        </div>
        {result.waterTableCase != null && (
          <div style={{
            marginTop: 6,
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 11, color: 'var(--lucid-ink-muted)',
          }}>
            NF: caso {result.waterTableCase} — <span style={{ color: 'var(--lucid-ink-body)' }}>
              {WATER_TABLE_CASE_LABELS[result.waterTableCase] ?? 'desconocido'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function FactorRow({ label, items }: {
  label: string;
  items: Array<{ sym: string; val: number }>;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 14,
      marginBottom: 6,
      fontFamily: 'var(--lucid-font-serif)', fontSize: 12,
      fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{
        fontFamily: 'var(--lucid-font-sans)',
        fontSize: 10, fontWeight: 600,
        color: 'var(--lucid-ink-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        minWidth: 80,
      }}>{label}</span>
      {items.map((it) => (
        <span key={it.sym} style={{ color: 'var(--lucid-ink-strong)' }}>
          <em style={{ color: 'var(--lucid-ink-muted)', fontStyle: 'italic' }}>{it.sym}</em> = {fmt3(it.val)}
        </span>
      ))}
    </div>
  );
}

function WarningsSection({ warnings }: { warnings: string[] }) {
  return (
    <div style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Advertencias ({warnings.length})
      </div>
      <div style={{ padding: '8px 14px 16px' }}>
        {warnings.map((w, i) => (
          <div key={i} style={{
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 12, color: 'var(--lucid-ink-body)',
            marginBottom: 6,
            paddingLeft: 10, borderLeft: '2px solid var(--lucid-acc-coral)',
            lineHeight: 1.5,
          }}>
            {w}
          </div>
        ))}
      </div>
    </div>
  );
}

function RNESection({ result }: { result: CalculationResult }) {
  if (!result.rneConsideration) return null;
  const rne = result.rneConsideration;
  const siToOutput = useUnitStore((s) => s.siToOutput);
  const pUnit = useUnitStore((s) => s.outputLabel('pressure'));
  const toP = (v: number) => siToOutput(v, 'pressure');
  return (
    <div style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Consideración RNE (método activo)
      </div>
      <div style={{ padding: '8px 14px 16px' }}>
        <ResultRow label="qu RNE" value={toP(rne.qultRNE)} unit={pUnit} />
        <ResultRow label="qa RNE" value={toP(rne.qadmRNE)} unit={pUnit} />
        <ResultRow label="qu RNE corr." value={toP(rne.qultRNECorrected)} unit={pUnit} />
      </div>
    </div>
  );
}

function Chip({ variant, children }: {
  variant: 'ok' | 'warn' | 'neutral';
  children: React.ReactNode;
}) {
  const palette = variant === 'ok'
    ? { bg: 'var(--lucid-acc-sage-bg)', fg: 'var(--lucid-acc-sage-text)', bd: 'var(--lucid-acc-sage-border)' }
    : variant === 'warn'
    ? { bg: 'var(--lucid-tint-coral)', fg: 'var(--lucid-acc-coral-text)', bd: 'var(--lucid-acc-coral-border)' }
    : { bg: 'var(--lucid-surface-figure)', fg: 'var(--lucid-ink-body)', bd: 'var(--lucid-rule-cream)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', fontFamily: 'var(--lucid-font-sans)',
      fontSize: 11, background: palette.bg, color: palette.fg,
      border: `1px solid ${palette.bd}`, borderRadius: 999,
    }}>{children}</span>
  );
}

function ResultRow({ label, value, unit, accent }: {
  label: string; value: number; unit: string; accent?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '4px 0',
    }}>
      <span style={{
        fontFamily: 'var(--lucid-font-sans)',
        fontSize: 11,
        color: 'var(--lucid-ink-muted)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--lucid-font-serif)',
        color: accent ? 'var(--lucid-acc-coral)' : 'var(--lucid-ink-strong)',
        fontSize: accent ? 15 : 14,
        fontWeight: accent ? 600 : 400,
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
      }}>
        {fmt3(value)}
        <span style={{
          fontSize: 11,
          color: 'var(--lucid-ink-muted)',
          fontFamily: 'var(--lucid-font-sans)',
          marginLeft: 4,
        }}>
          {unit}
        </span>
      </span>
    </div>
  );
}

function ExportSection({ foundation, strata, conditions, method, result }: {
  foundation: FoundationParams;
  strata: Stratum[];
  conditions: SpecialConditions;
  method: CalculationMethod;
  result: CalculationResult;
}) {
  const iterationResults = useFoundationStore((s) => s.iterationResults);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    include_calculations: true,
    include_strata: true,
    include_iterations: false,
    include_charts: false,
    include_2d: false,
    include_3d: false,
  });

  const toggleOption = (key: string) => {
    setPdfOptions(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const captureImages = useCallback(async () => {
    const images: Record<string, string> = {};
    const hiddenPanes: HTMLElement[] = [];
    document.querySelectorAll('[style*="display: none"]').forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.querySelector('svg, canvas, .js-plotly-plot')) {
        htmlEl.style.display = 'block';
        hiddenPanes.push(htmlEl);
      }
    });
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 100));
    try {
      if (pdfOptions.include_2d) {
        const targetSvg = document.querySelector('svg[data-viewer2d="true"]') as SVGSVGElement | null;
        if (targetSvg) {
          try {
            const svgClone = targetSvg.cloneNode(true) as SVGSVGElement;
            const totalDepth = strata.reduce((sum: number, s) => sum + s.thickness, 0);
            const SOIL_SIDE_PADDING = 2;
            const VIEWBOX_MARGIN = 2;
            const LABEL_SPACE = 5;
            const VIEWBOX_RIGHT_PAD = 8;
            const soilW = foundation.B + SOIL_SIDE_PADDING * 2;
            const halfW = soilW / 2;
            const stdViewBox = {
              x: -halfW - VIEWBOX_MARGIN - LABEL_SPACE,
              y: -VIEWBOX_MARGIN,
              w: soilW + VIEWBOX_MARGIN * 2 + LABEL_SPACE + VIEWBOX_RIGHT_PAD,
              h: totalDepth + VIEWBOX_MARGIN * 2 + 1,
            };
            svgClone.setAttribute('viewBox', `${stdViewBox.x} ${stdViewBox.y} ${stdViewBox.w} ${stdViewBox.h}`);
            const renderW = PDF_RENDER_WIDTH;
            const renderH = Math.round(renderW * (stdViewBox.h / stdViewBox.w));
            svgClone.setAttribute('width', String(renderW));
            svgClone.setAttribute('height', String(renderH));
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('x', String(stdViewBox.x));
            bgRect.setAttribute('y', String(stdViewBox.y));
            bgRect.setAttribute('width', String(stdViewBox.w));
            bgRect.setAttribute('height', String(stdViewBox.h));
            bgRect.setAttribute('fill', PDF_BG_COLOR);
            svgClone.insertBefore(bgRect, svgClone.firstChild);
            svgClone.querySelectorAll('text').forEach((t) => {
              const fill = t.getAttribute('fill');
              if (fill && (fill.startsWith('#a') || fill.startsWith('#b') || fill.startsWith('#c') || fill.startsWith('#d') || fill.startsWith('#e') || fill.startsWith('#f') || fill === 'white' || fill === '#fff' || fill === '#ffffff')) {
                t.setAttribute('fill', PDF_TEXT_COLOR);
              }
            });
            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = reject;
              img.src = url;
            });
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = renderW * 2;
            tempCanvas.height = renderH * 2;
            const ctx = tempCanvas.getContext('2d')!;
            ctx.fillStyle = PDF_BG_COLOR;
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, renderW, renderH);
            const dataUrl = tempCanvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);
            if (dataUrl.length > PDF_MIN_IMAGE_SIZE) {
              images.view2d_b64 = dataUrl;
            }
            URL.revokeObjectURL(url);
          } catch (e) {
            console.warn('Could not capture 2D view:', e);
          }
        }
      }

      if (pdfOptions.include_3d) {
        try {
          const capture = useWorkspaceStore.getState().captureView3D;
          if (typeof capture === 'function') {
            const dataUrl = capture();
            if (dataUrl && dataUrl.length > PDF_MIN_IMAGE_SIZE) {
              images.view3d_b64 = dataUrl;
            }
          }
        } catch (e) {
          console.warn('Could not capture 3D view:', e);
        }
      }
    } finally {
      hiddenPanes.forEach((el) => { el.style.display = 'none'; });
    }
    return images;
  }, [pdfOptions, foundation.B, strata]);

  const handleExportPDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      const images = await captureImages();
      const body: Record<string, unknown> = {
        foundation,
        strata: strata.map((s) => ({
          id: s.id, thickness: s.thickness, gamma: s.gamma,
          c: s.c, phi: s.phi, gammaSat: s.gammaSat,
        })),
        conditions, method, result, options: pdfOptions,
        images: Object.keys(images).length > 0 ? images : null,
      };
      if (iterationResults) body.iteration_results = iterationResults;

      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reporte-cimentaciones.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error('PDF export error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const short = msg.length > ERROR_TRUNCATE_LENGTH ? msg.slice(0, ERROR_TRUNCATE_LENGTH) + '...' : msg;
      alert(`Error al exportar PDF: ${short}`);
    } finally {
      setPdfLoading(false);
    }
  }, [foundation, strata, conditions, method, result, pdfOptions, iterationResults, captureImages]);

  const handleExportIFC = useCallback(async () => {
    try {
      const body = {
        foundation: {
          type: foundation.type, B: foundation.B,
          L: foundation.type === 'cuadrada' ? foundation.B : foundation.L,
          Df: foundation.Df, FS: foundation.FS, beta: foundation.beta,
        },
        strata: strata.map((s) => ({
          id: s.id, thickness: s.thickness, gamma: s.gamma,
          c: s.c, phi: s.phi, gammaSat: s.gammaSat,
        })),
        conditions,
      };
      const response = await fetch('/api/export-ifc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('IFC export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Cimentaciones_model.ifc';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('IFC export error:', err);
    }
  }, [foundation, strata, conditions]);

  const handleExportCSV = useCallback(() => {
    const rows = [
      ['Parámetro', 'Valor', 'Unidad'],
      ['Tipo', foundation.type, ''],
      ['B', foundation.B, 'm'],
      ['L', foundation.L, 'm'],
      ['Df', foundation.Df, 'm'],
      ['FS', foundation.FS, ''],
      ['qu', (result.qu / G).toFixed(3), 't/m²'],
      ['qnet', (result.qnet / G).toFixed(3), 't/m²'],
      ['qa', (result.qa / G).toFixed(3), 't/m²'],
      ['qaNet', (result.qaNet / G).toFixed(3), 't/m²'],
      ['Qmax', (result.Qmax / G).toFixed(3), 'tnf'],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resultados-cimentaciones.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [foundation, result]);

  const handleExportTXT = useCallback(() => {
    const lines = [
      '═══════════════════════════════════════',
      '  Cimentaciones WEB — Reporte',
      '═══════════════════════════════════════',
      '',
      `Tipo: ${foundation.type}`,
      `B = ${foundation.B} m, L = ${foundation.L} m, Df = ${foundation.Df} m`,
      `FS = ${foundation.FS}, β = ${foundation.beta}°`,
      '',
      '── Resultados ──',
      `qu = ${(result.qu / G).toFixed(3)} t/m²`,
      `qneta = ${(result.qnet / G).toFixed(3)} t/m²`,
      `qa = ${(result.qa / G).toFixed(3)} t/m²`,
      `qa_neta = ${(result.qaNet / G).toFixed(3)} t/m²`,
      `Qmax = ${(result.Qmax / G).toFixed(3)} tnf`,
      '',
      '── Factores ──',
      `Nc = ${result.bearingFactors.Nc.toFixed(3)}`,
      `Nq = ${result.bearingFactors.Nq.toFixed(3)}`,
      `Nγ = ${result.bearingFactors.Ngamma.toFixed(3)}`,
      '',
      'Generado por Cimentaciones Web v2',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resultados-cimentaciones.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [foundation, result]);

  return (
    <div style={{ borderTop: '1px solid var(--lucid-rule-white)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>Exportar</div>

      <div style={{ padding: '8px 14px 6px' }}>
        <p style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 10, fontWeight: 600, color: 'var(--lucid-ink-muted)',
          textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
        }}>
          Opciones del PDF
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { key: 'include_calculations', label: 'Ecuaciones y cálculos' },
            { key: 'include_strata', label: 'Datos de estratos' },
            { key: 'include_iterations', label: 'Tabla de iteraciones' },
            { key: 'include_2d', label: 'Vista 2D' },
            { key: 'include_3d', label: 'Vista 3D' },
            { key: 'include_charts', label: 'Gráfico de iteraciones' },
          ].map(({ key, label }) => (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--lucid-font-sans)',
              fontSize: 12, color: 'var(--lucid-ink-body)',
              cursor: 'pointer', padding: '2px 0',
              userSelect: 'none',
            }}>
              <input
                type="checkbox"
                className="cad-checkbox"
                checked={pdfOptions[key as keyof typeof pdfOptions]}
                onChange={() => toggleOption(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={handleExportPDF}
          disabled={pdfLoading}
          style={{
            width: '100%', padding: '10px 0',
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 13, fontWeight: 500,
            background: pdfLoading ? 'var(--lucid-surface-figure)' : 'var(--lucid-button-primary-bg)',
            border: 'none', color: pdfLoading ? 'var(--lucid-ink-muted)' : 'var(--lucid-button-primary-fg)',
            borderRadius: 4,
            cursor: pdfLoading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 160ms cubic-bezier(0.4,0,0.2,1)',
          }}
          onMouseEnter={(e) => { if (!pdfLoading) e.currentTarget.style.background = 'var(--lucid-button-primary-bg-hover)'; }}
          onMouseLeave={(e) => { if (!pdfLoading) e.currentTarget.style.background = 'var(--lucid-button-primary-bg)'; }}
        >
          {pdfLoading ? 'Generando PDF...' : 'Exportar PDF'}
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <ExportBtn label="IFC" onClick={handleExportIFC} />
          <ExportBtn label="CSV" onClick={handleExportCSV} />
          <ExportBtn label="TXT" onClick={handleExportTXT} />
        </div>
      </div>
    </div>
  );
}

function ExportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 0',
        fontFamily: 'var(--lucid-font-sans)',
        fontSize: 11,
        background: 'var(--lucid-surface-page)',
        border: '1px solid var(--lucid-rule-cream)',
        borderRadius: 3,
        color: 'var(--lucid-ink-strong)',
        cursor: 'pointer',
        display: 'grid', placeItems: 'center',
        transition: 'background 160ms cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--lucid-surface-figure)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--lucid-surface-page)'; }}
    >
      {label}
    </button>
  );
}
