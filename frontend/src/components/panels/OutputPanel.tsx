/**
 * OutputPanel — Right panel: output configuration, quick results, and all export actions.
 */
import { useState, useCallback } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type {
  FoundationParams,
  Stratum,
  SpecialConditions,
  CalculationResult,
  CalculationMethod,
} from '../../types/geotechnical';

const API_BASE = '';

// PDF export configuration
const PDF_RENDER_WIDTH = 1200;
const PDF_JPEG_QUALITY = 0.85;
const PDF_MIN_IMAGE_SIZE = 5000;  // bytes — below this it's likely a blank image
const ERROR_TRUNCATE_LENGTH = 200;
const PDF_BG_COLOR = '#ffffff';
const PDF_TEXT_COLOR = '#333333';

const METHOD_LABELS: Record<string, string> = {
  terzaghi: 'Terzaghi',
  general: 'Ec. General (Das)',
  rne: 'RNE E.050',
};

export default function OutputPanel() {
  const result = useFoundationStore((s) => s.result);
  const errors = useFoundationStore((s) => s.errors);
  const foundation = useFoundationStore((s) => s.foundation);
  const strata = useFoundationStore((s) => s.strata);
  const conditions = useFoundationStore((s) => s.conditions);
  const method = useFoundationStore((s) => s.method);

  return (
    <div>
      {/* Errors */}
      {errors.length > 0 && (
        <div style={{
          padding: 10,
          background: 'var(--accent-bg)',
          borderBottom: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--error)', marginBottom: 4 }}>
            ⚠ Errores de validación
          </p>
          {errors.map((e, i) => (
            <p key={i} style={{ fontSize: 10, color: 'var(--error)', marginBottom: 2 }}>• {e}</p>
          ))}
        </div>
      )}

      {/* Quick results */}
      {result && (
        <>
          <QuickResultSection result={result} />
          <FactorsSection result={result} />
          <RNESection result={result} />
        </>
      )}

      {/* Export actions — only when there are results */}
      {result && (
        <ExportSection
          foundation={foundation}
          strata={strata}
          conditions={conditions}
          method={method}
          result={result}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * EXPORT SECTION
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

  // Capture standardized images for PDF (white backgrounds, clean renders)
  // Temporarily reveals hidden tabs to ensure correct rendering dimensions
  const captureImages = useCallback(async () => {
    const images: Record<string, string> = {};

    // ── Temporarily show ALL hidden tab panes so canvases/SVGs have dimensions ──
    const hiddenPanes: HTMLElement[] = [];
    document.querySelectorAll('[style*="display: none"]').forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.querySelector('svg, canvas, .js-plotly-plot')) {
        htmlEl.style.display = 'block';
        hiddenPanes.push(htmlEl);
      }
    });

    // Wait a frame for layout recalculation
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 100));

    try {
      // ── 2D: SVG → Canvas with white background ──
      if (pdfOptions.include_2d) {
        // Use the unique data-viewer2d attribute to find the correct SVG
        const targetSvg = document.querySelector('svg[data-viewer2d="true"]') as SVGSVGElement | null;
        if (targetSvg) {
          try {
            const svgClone = targetSvg.cloneNode(true) as SVGSVGElement;

            // Compute standardized viewBox (same formula as Viewer2D init)
            const totalDepth = strata.reduce((sum: number, s: any) => sum + s.thickness, 0);
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

            // Set fixed render dimensions
            const renderW = PDF_RENDER_WIDTH;
            const renderH = Math.round(renderW * (stdViewBox.h / stdViewBox.w));
            svgClone.setAttribute('width', String(renderW));
            svgClone.setAttribute('height', String(renderH));

            // Force white background as first element
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('x', String(stdViewBox.x));
            bgRect.setAttribute('y', String(stdViewBox.y));
            bgRect.setAttribute('width', String(stdViewBox.w));
            bgRect.setAttribute('height', String(stdViewBox.h));
            bgRect.setAttribute('fill', PDF_BG_COLOR);
            svgClone.insertBefore(bgRect, svgClone.firstChild);

            // Make all text dark for white background readability
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

      // ── 3D: Use workspace store captureView3D (white bg, 0.15 strata, no grid) ──
      if (pdfOptions.include_3d) {
        try {
          const capture = useWorkspaceStore.getState().captureView3D;
          if (typeof capture === 'function') {
            const dataUrl = capture();
            // Validate: must be > 5KB to be a real image
            if (dataUrl && dataUrl.length > PDF_MIN_IMAGE_SIZE) {
              images.view3d_b64 = dataUrl;
            }
          }
        } catch (e) {
          console.warn('Could not capture 3D view:', e);
        }
      }

      // ── Charts: Will be generated server-side with matplotlib ──
      // No frontend capture needed for charts
    } finally {
      // ── Restore hidden panes ──
      hiddenPanes.forEach((el) => {
        el.style.display = 'none';
      });
    }

    return images;
  }, [pdfOptions]);

  const handleExportPDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      const images = await captureImages();

      const body: Record<string, unknown> = {
        foundation,
        strata: strata.map((s: any) => ({
          id: s.id, thickness: s.thickness, gamma: s.gamma,
          c: s.c, phi: s.phi, gammaSat: s.gammaSat,
        })),
        conditions,
        method,
        result,
        options: pdfOptions,
        images: Object.keys(images).length > 0 ? images : null,
      };

      // Always include iteration results if available (needed for table AND chart)
      if (iterationResults) {
        body.iteration_results = iterationResults;
      }

      const response = await fetch(`${API_BASE}/api/export-pdf`, {
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
    } catch (err: any) {
      console.error('PDF export error:', err);
      // Show a short, user-friendly message instead of full pdflatex output
      const msg = String(err.message || '');
      const short = msg.length > ERROR_TRUNCATE_LENGTH
        ? msg.slice(0, ERROR_TRUNCATE_LENGTH) + '...'
        : msg;
      alert(`Error al exportar PDF: ${short}`);
    } finally {
      setPdfLoading(false);
    }
  }, [foundation, strata, conditions, method, result, pdfOptions, captureImages]);

  const handleExportIFC = useCallback(async () => {
    try {
      const body = {
        foundation: {
          type: foundation.type, B: foundation.B,
          L: foundation.type === 'cuadrada' ? foundation.B : foundation.L,
          Df: foundation.Df, FS: foundation.FS, beta: foundation.beta,
        },
        strata: strata.map((s: any) => ({
          id: s.id, thickness: s.thickness, gamma: s.gamma,
          c: s.c, phi: s.phi, gammaSat: s.gammaSat,
        })),
        conditions,
      };
      const response = await fetch(`${API_BASE}/api/export-ifc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('IFC export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cimentaviones_model.ifc';
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
      ['qu', result.qu.toFixed(2), 'kPa'],
      ['qnet', result.qnet.toFixed(2), 'kPa'],
      ['qa', result.qa.toFixed(2), 'kPa'],
      ['qaNet', result.qaNet.toFixed(2), 'kPa'],
      ['Qmax', result.Qmax.toFixed(2), 'kN'],
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
      '  CIMENTAVIONES WEB — Reporte',
      '═══════════════════════════════════════',
      '',
      `Tipo: ${foundation.type}`,
      `B = ${foundation.B} m, L = ${foundation.L} m, Df = ${foundation.Df} m`,
      `FS = ${foundation.FS}, β = ${foundation.beta}°`,
      '',
      '── Resultados ──',
      `qu = ${result.qu.toFixed(2)} kPa`,
      `qneta = ${result.qnet.toFixed(2)} kPa`,
      `qa = ${result.qa.toFixed(2)} kPa`,
      `qa_neta = ${result.qaNet.toFixed(2)} kPa`,
      `Qmax = ${result.Qmax.toFixed(2)} kN`,
      '',
      '── Factores ──',
      `Nc = ${result.bearingFactors.Nc.toFixed(2)}`,
      `Nq = ${result.bearingFactors.Nq.toFixed(2)}`,
      `Nγ = ${result.bearingFactors.Ngamma.toFixed(2)}`,
      '',
      `Generado por CimentAviones Web v1.1`,
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
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Exportar
      </div>

      {/* PDF Options */}
      <div style={{ padding: '10px 10px 6px' }}>
        <p style={{
          fontSize: 9, fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
        }}>
          Opciones del PDF
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { key: 'include_calculations', label: 'Ecuaciones y cálculos' },
            { key: 'include_strata', label: 'Datos de estratos' },
            { key: 'include_iterations', label: 'Tabla de iteraciones' },
            { key: 'include_2d', label: 'Vista 2D' },
            { key: 'include_3d', label: 'Vista 3D' },
            { key: 'include_charts', label: 'Gráfico de iteraciones' },
          ].map(({ key, label }) => (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer',
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

      {/* Export buttons */}
      <div style={{ padding: '8px 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={handleExportPDF}
          disabled={pdfLoading}
          style={{
            width: '100%', padding: '8px 0', fontSize: 11, fontWeight: 600,
            background: pdfLoading ? 'var(--bg-surface-3)' : 'var(--accent)',
            border: 'none',
            color: 'var(--bg-base)', borderRadius: 20, cursor: pdfLoading ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => { if (!pdfLoading) e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { if (!pdfLoading) e.currentTarget.style.background = 'var(--accent)'; }}
        >
          {pdfLoading ? '⏳ Generando PDF...' : '📄 Exportar PDF'}
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          <ExportBtn icon="📁" label="IFC" onClick={handleExportIFC} />
          <ExportBtn icon="📊" label="CSV" onClick={handleExportCSV} />
          <ExportBtn icon="📋" label="TXT" onClick={handleExportTXT} />
        </div>
      </div>
    </div>
  );
}

function ExportBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 0', fontSize: 10, fontWeight: 500,
        background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-secondary)', cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-3)'; e.currentTarget.style.borderColor = 'var(--border-active)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface-2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {icon} {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════
 * RESULT SECTIONS
 * ═══════════════════════════════════════════════ */

function QuickResultSection({ result }: { result: NonNullable<ReturnType<typeof useFoundationStore.getState>['result']> }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Resultados — {METHOD_LABELS[result.method]}
      </div>
      <div style={{ padding: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '3px 8px',
            background: result.soilType === 'Coh' ? 'rgba(93, 173, 226, 0.12)' : 'var(--accent-bg)',
            color: result.soilType === 'Coh' ? 'var(--info)' : 'var(--accent)',
            border: `1px solid ${result.soilType === 'Coh' ? 'rgba(93, 173, 226, 0.25)' : 'var(--border-accent)'}`,
            borderRadius: 'var(--radius-sm)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {result.soilType === 'Coh' ? 'Cohesivo' : 'Friccionante'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            Estrato {result.designStratumIndex + 1}
          </span>
        </div>

        {/* Hero result */}
        <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Capacidad admisible</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
            {result.qa.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>kPa</div>
        </div>

        <ResultRow label="qu" value={result.qu} unit="kPa" />
        <ResultRow label="qneta" value={result.qnet} unit="kPa" />
        <ResultRow label="qa_neta" value={result.qaNet} unit="kPa" />
        <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
        <ResultRow label="Q_max" value={result.Qmax} unit="kN" accent />

        <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
        <p style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Términos</p>
        <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>F1={result.F1.toFixed(2)}</span>
          <span style={{ color: 'var(--text-secondary)' }}>F2={result.F2.toFixed(2)}</span>
          <span style={{ color: 'var(--text-secondary)' }}>F3={result.F3.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function FactorsSection({ result }: { result: NonNullable<ReturnType<typeof useFoundationStore.getState>['result']> }) {
  const bf = result.bearingFactors;
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Factores
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-primary)' }}>Nc={bf.Nc.toFixed(2)}</span>
          <span style={{ color: 'var(--text-primary)' }}>Nq={bf.Nq.toFixed(2)}</span>
          <span style={{ color: 'var(--text-primary)' }}>Nγ={bf.Ngamma.toFixed(2)}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-secondary)' }}>
          q = {result.q.toFixed(2)} kPa · γeff = {result.gammaEffective.toFixed(2)} kN/m³
        </div>
      </div>
    </div>
  );
}

function RNESection({ result }: { result: NonNullable<ReturnType<typeof useFoundationStore.getState>['result']> }) {
  if (!result.rneConsideration) return null;
  const rne = result.rneConsideration;
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Consideración RNE
      </div>
      <div style={{ padding: 10 }}>
        <ResultRow label="qu RNE" value={rne.qultRNE} unit="kPa" />
        <ResultRow label="qa RNE" value={rne.qadmRNE} unit="kPa" />
        <ResultRow label="qu RNE corr." value={rne.qultRNECorrected} unit="kPa" />
      </div>
    </div>
  );
}

function ResultRow({ label, value, unit, accent }: {
  label: string; value: number; unit: string; accent?: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '3px 0',
      fontSize: 11,
    }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        color: accent ? 'var(--accent)' : 'var(--text-primary)',
        fontWeight: accent ? 700 : 500,
      }}>
        {value.toFixed(2)} <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{unit}</span>
      </span>
    </div>
  );
}
