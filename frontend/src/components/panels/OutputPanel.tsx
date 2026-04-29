/**
 * OutputPanel — Right panel: output configuration, quick results, and all export actions.
 */
import { useState, useCallback } from 'react';
import { useFoundationStore } from '../../store/foundationStore';

const API_BASE = '';

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
          padding: 8,
          background: 'rgba(231, 76, 60, 0.1)',
          borderBottom: '1px solid #505050',
        }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#e74c3c', marginBottom: 4 }}>
            ⚠ Errores de validación
          </p>
          {errors.map((e, i) => (
            <p key={i} style={{ fontSize: 10, color: '#e74c3c', marginBottom: 2 }}>• {e}</p>
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
  foundation: any;
  strata: any;
  conditions: any;
  method: string;
  result: any;
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
  const captureImages = useCallback(async () => {
    const images: Record<string, string> = {};

    // Helper: resize canvas to max dimensions and output as JPEG
    const toJpeg = (canvas: HTMLCanvasElement, maxW = 1400, maxH = 900): string => {
      let w = canvas.width;
      let h = canvas.height;
      if (w > maxW || h > maxH) {
        const scale = Math.min(maxW / w, maxH / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(canvas, 0, 0, w, h);
      return out.toDataURL('image/jpeg', 0.85);
    };

    // ── 2D: SVG → Canvas with white background ──
    if (pdfOptions.include_2d) {
      const svg = document.querySelector('svg') as SVGSVGElement;
      if (svg) {
        try {
          const svgClone = svg.cloneNode(true) as SVGSVGElement;
          const bbox = svg.getBoundingClientRect();
          svgClone.setAttribute('width', String(bbox.width));
          svgClone.setAttribute('height', String(bbox.height));
          // Force white background on the SVG clone
          const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bgRect.setAttribute('width', '100%');
          bgRect.setAttribute('height', '100%');
          bgRect.setAttribute('fill', '#ffffff');
          svgClone.insertBefore(bgRect, svgClone.firstChild);

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
          tempCanvas.width = bbox.width * 2;
          tempCanvas.height = bbox.height * 2;
          const ctx = tempCanvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0);
          images.view2d_b64 = toJpeg(tempCanvas);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn('Could not capture 2D view:', e);
        }
      }
    }

    // ── 3D: Use global __captureView3D (white bg, 0.15 strata, no grid) ──
    if (pdfOptions.include_3d) {
      try {
        const capture = (window as any).__captureView3D;
        if (typeof capture === 'function') {
          const dataUrl = capture();
          if (dataUrl) {
            images.view3d_b64 = dataUrl;
          }
        }
      } catch (e) {
        console.warn('Could not capture 3D view:', e);
      }
    }

    // ── Charts: Generate both qa and Qmax charts with white bg ──
    if (pdfOptions.include_charts) {
      const plotlyDiv = document.querySelector('.js-plotly-plot') as HTMLElement;
      if (plotlyDiv && (window as any).Plotly) {
        try {
          // Current chart (whatever metric is active)
          const dataUrl = await (window as any).Plotly.toImage(plotlyDiv, {
            format: 'png', width: 1000, height: 500,
          });
          images.chart_b64 = dataUrl;
        } catch { /* ignore */ }
      }
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

      // Include iteration results if option is checked
      if (pdfOptions.include_iterations && iterationResults) {
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
      const short = msg.length > 200
        ? msg.slice(0, 200) + '...'
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
    <div style={{ borderTop: '1px solid #505050' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Exportar
      </div>

      {/* PDF Options */}
      <div style={{ padding: '8px 8px 4px' }}>
        <p style={{
          fontSize: 9, fontWeight: 600, color: '#666',
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
        }}>
          Opciones del PDF
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
              fontSize: 11, color: '#bbb', cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={pdfOptions[key as keyof typeof pdfOptions]}
                onChange={() => toggleOption(key)}
                style={{ accentColor: '#c0392b' }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Export buttons */}
      <div style={{ padding: '6px 8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          onClick={handleExportPDF}
          disabled={pdfLoading}
          style={{
            width: '100%', padding: '7px 0', fontSize: 11, fontWeight: 600,
            background: pdfLoading ? '#555' : '#c0392b',
            border: '1px solid ' + (pdfLoading ? '#666' : '#a93226'),
            color: '#fff', borderRadius: 3, cursor: pdfLoading ? 'wait' : 'pointer',
          }}
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
        padding: '5px 0', fontSize: 10,
        background: '#3a3a3a', border: '1px solid #505050',
        color: '#ccc', borderRadius: 3, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#454545'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#3a3a3a'; }}
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
    <div style={{ borderBottom: '1px solid #505050' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Resultados — {METHOD_LABELS[result.method]}
      </div>
      <div style={{ padding: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px',
            background: result.soilType === 'Coh' ? 'rgba(41, 128, 185, 0.2)' : 'rgba(192, 57, 43, 0.15)',
            color: result.soilType === 'Coh' ? '#5dade2' : '#e74c3c',
            border: `1px solid ${result.soilType === 'Coh' ? 'rgba(41, 128, 185, 0.3)' : 'rgba(192, 57, 43, 0.3)'}`,
            textTransform: 'uppercase',
          }}>
            {result.soilType === 'Coh' ? 'Cohesivo' : 'Friccionante'}
          </span>
          <span style={{ fontSize: 10, color: '#888' }}>
            Estrato {result.designStratumIndex + 1}
          </span>
        </div>

        <ResultRow label="qu" value={result.qu} unit="kPa" />
        <ResultRow label="qneta" value={result.qnet} unit="kPa" />
        <ResultRow label="qa" value={result.qa} unit="kPa" accent />
        <ResultRow label="qa_neta" value={result.qaNet} unit="kPa" />
        <div style={{ borderTop: '1px solid #404040', margin: '4px 0' }} />
        <ResultRow label="Q_max" value={result.Qmax} unit="kN" accent />

        <div style={{ borderTop: '1px solid #404040', margin: '6px 0' }} />
        <p style={{ fontSize: 10, color: '#777', marginBottom: 4 }}>Términos</p>
        <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: 'Consolas, monospace' }}>
          <span style={{ color: '#ccc' }}>F1={result.F1.toFixed(2)}</span>
          <span style={{ color: '#ccc' }}>F2={result.F2.toFixed(2)}</span>
          <span style={{ color: '#ccc' }}>F3={result.F3.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function FactorsSection({ result }: { result: NonNullable<ReturnType<typeof useFoundationStore.getState>['result']> }) {
  const bf = result.bearingFactors;
  return (
    <div style={{ borderBottom: '1px solid #505050' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Factores
      </div>
      <div style={{ padding: 8 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: 'Consolas, monospace' }}>
          <span style={{ color: '#ccc' }}>Nc={bf.Nc.toFixed(2)}</span>
          <span style={{ color: '#ccc' }}>Nq={bf.Nq.toFixed(2)}</span>
          <span style={{ color: '#ccc' }}>Nγ={bf.Ngamma.toFixed(2)}</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: '#888' }}>
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
    <div style={{ borderBottom: '1px solid #505050' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        Consideración RNE
      </div>
      <div style={{ padding: 8 }}>
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
      padding: '2px 0',
      fontSize: 11,
    }}>
      <span style={{ color: '#999' }}>{label}</span>
      <span style={{
        fontFamily: 'Consolas, monospace',
        color: accent ? '#e74c3c' : '#e0e0e0',
        fontWeight: accent ? 700 : 400,
      }}>
        {value.toFixed(2)} <span style={{ fontSize: 9, color: '#777' }}>{unit}</span>
      </span>
    </div>
  );
}
