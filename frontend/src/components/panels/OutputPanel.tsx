/**
 * OutputPanel — Right panel: botón Calcular + selector de criterio + resultados + export.
 *
 * Estructura:
 *   1. CalculateSection — botón Calcular y selector de criterio
 *   2. (si hay errores) — banner de errores
 *   3. (si hay resultado):
 *        QuickResultSection (con valores del criterio seleccionado)
 *        EccentricitySection (solo si eccentricity != null)
 *        FactorsSection
 *        WarningsSection
 *   4. ExportSection — opciones y botones de exportación
 *
 * Convención: todos los valores numéricos se muestran con 3 decimales.
 */
import { useState, useCallback } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
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

const CRITERION_LABELS: Record<CriterionKey, string> = {
  general: 'General (S₁+S₂+S₃)',
  rne: 'RNE',
  rne_corrected: 'RNE corregido',
};

/** Formato de 3 decimales para valores numéricos */
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

/* ═══════════════════════════════════════════════
 * CALCULATE: botón + selector de criterio
 * ═══════════════════════════════════════════════ */
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

      {/* Selector de criterio — Lucid pill group */}
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
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * QUICK RESULT — valores según método activo + criterio seleccionado
 * ═══════════════════════════════════════════════ */
function QuickResultSection({ result, method, criterion }: {
  result: CalculationResult; method: CalculationMethod; criterion: CriterionKey;
}) {
  // Obtener qu/qa del criterio seleccionado (de methodCriteriaMatrix si está disponible)
  const matrixBlock = result.methodCriteriaMatrix?.[method];
  const critData = matrixBlock?.criteria?.[criterion];

  // Fallback: si no hay matrixBlock (motor antiguo), usar campos top-level
  const qu = critData?.qu ?? result.qu;
  const qa = critData?.qa ?? result.qa;
  const Qmax = critData?.Qmax ?? result.Qmax;
  const S1 = matrixBlock?.S1 ?? result.F1;
  const S2 = matrixBlock?.S2 ?? result.F2;
  const S3 = matrixBlock?.S3 ?? result.F3;
  const qnet = qu - result.q;
  const qa_net = qnet / (qu > 0 ? (qu / qa) : 1);

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

        {/* Gran número Lucid: eyebrow + serif XL + unidad sans muted */}
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
            {fmt3(qa / G)}
          </div>
          <div style={{
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 11, color: 'var(--lucid-ink-muted)', marginTop: 6,
          }}>
            t/m²
          </div>
        </div>

        <ResultRow label="qu" value={qu / G} unit="t/m²" />
        <ResultRow label="qneta" value={qnet / G} unit="t/m²" />
        <ResultRow label="qa_neta" value={qa_net / G} unit="t/m²" />
        <div style={{ borderTop: '1px solid var(--lucid-rule-white)', margin: '8px 0' }} />
        <ResultRow label="Q_max" value={Qmax / G} unit="tnf" accent />

        <div style={{ borderTop: '1px solid var(--lucid-rule-white)', margin: '10px 0' }} />
        <div style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 10, fontWeight: 600, color: 'var(--lucid-ink-muted)',
          marginBottom: 6,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Sumandos
        </div>
        <div style={{
          display: 'flex', gap: 14,
          fontFamily: 'var(--lucid-font-serif)', fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{ color: 'var(--lucid-ink-body)' }}>S₁ = {fmt3(S1 / G)}</span>
          <span style={{ color: 'var(--lucid-ink-body)' }}>S₂ = {fmt3(S2 / G)}</span>
          <span style={{ color: 'var(--lucid-ink-body)' }}>S₃ = {fmt3(S3 / G)}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * ECCENTRICITY — Solo si hay e1, e2 o Q
 * ═══════════════════════════════════════════════ */
function EccentricitySection({ eccentricity }: { eccentricity: EccentricityInfo }) {
  const ec = eccentricity;
  return (
    <div style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Excentricidad
      </div>
      <div style={{ padding: '8px 14px 16px' }}>
        <div style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 11, color: 'var(--lucid-ink-muted)', marginBottom: 10,
        }}>
          Régimen: <strong style={{
            color: 'var(--lucid-ink-strong)',
            fontFamily: 'var(--lucid-font-serif)',
            fontStyle: 'italic',
            fontWeight: 500,
          }}>{ec.regime}</strong>
        </div>
        <ResultRow label="B'" value={ec.B_eff} unit="m" />
        <ResultRow label="L'" value={ec.L_eff} unit="m" />
        <ResultRow label="A'" value={ec.A_eff} unit="m²" />
        {ec.qmax != null && (
          <>
            <div style={{ borderTop: '1px solid var(--lucid-rule-white)', margin: '8px 0' }} />
            <ResultRow label="q_max" value={ec.qmax / G} unit="t/m²" />
            <ResultRow label="q_min" value={ec.qmin != null ? ec.qmin / G : 0} unit="t/m²" />
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

/* ═══════════════════════════════════════════════
 * FACTORS — Nc, Nq, Nγ y factores correctivos
 * ═══════════════════════════════════════════════ */
function FactorsSection({ result }: { result: CalculationResult }) {
  const bf = result.bearingFactors;
  return (
    <div style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Factores
      </div>
      <div style={{ padding: '8px 14px 16px' }}>
        <div style={{
          display: 'flex', gap: 16,
          fontFamily: 'var(--lucid-font-serif)', fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{ color: 'var(--lucid-ink-strong)' }}>
            <em style={{ color: 'var(--lucid-ink-muted)', fontStyle: 'italic' }}>Nc</em> = {fmt3(bf.Nc)}
          </span>
          <span style={{ color: 'var(--lucid-ink-strong)' }}>
            <em style={{ color: 'var(--lucid-ink-muted)', fontStyle: 'italic' }}>Nq</em> = {fmt3(bf.Nq)}
          </span>
          <span style={{ color: 'var(--lucid-ink-strong)' }}>
            <em style={{ color: 'var(--lucid-ink-muted)', fontStyle: 'italic' }}>Nγ</em> = {fmt3(bf.Ngamma)}
          </span>
        </div>
        <div style={{
          marginTop: 8,
          fontFamily: 'var(--lucid-font-serif)',
          fontSize: 12, color: 'var(--lucid-ink-body)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <em style={{ color: 'var(--lucid-ink-muted)', fontStyle: 'italic' }}>q</em> = {fmt3(result.q / G)} t/m²
          {' · '}
          <em style={{ color: 'var(--lucid-ink-muted)', fontStyle: 'italic' }}>γ</em><sub>eff</sub> = {fmt3(result.gammaEffective / G)} t/m³
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * WARNINGS — Avisos del motor
 * ═══════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════
 * RNE CONSIDERATION — info adicional
 * ═══════════════════════════════════════════════ */
function RNESection({ result }: { result: CalculationResult }) {
  if (!result.rneConsideration) return null;
  const rne = result.rneConsideration;
  return (
    <div style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Consideración RNE (método activo)
      </div>
      <div style={{ padding: '8px 14px 16px' }}>
        <ResultRow label="qu RNE" value={rne.qultRNE / G} unit="t/m²" />
        <ResultRow label="qa RNE" value={rne.qadmRNE / G} unit="t/m²" />
        <ResultRow label="qu RNE corr." value={rne.qultRNECorrected / G} unit="t/m²" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * UTILITY — fila de resultado
 * ═══════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════
 * EXPORT SECTION — (sin cambios funcionales)
 * ═══════════════════════════════════════════════ */
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
