/**
 * ParametricIterations — Iteration controls + Plotly.js interactive chart.
 * Hardcoded to Metric units (m, tnf/m², tnf).
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import type { IterationResult } from '../../types/geotechnical';
import CadNumericInput from '../common/CadNumericInput';
// @ts-expect-error — plotly.js-basic-dist-min no publica tipos; se usa la build minificada para reducir bundle
import Plotly from 'plotly.js-basic-dist-min';
// @ts-expect-error — react-plotly.js/factory no exporta tipos; la interop ESM varía según bundler
import factoryModule from 'react-plotly.js/factory';
const createPlotlyComponent = (factoryModule as { default?: typeof factoryModule }).default ?? factoryModule;
const Plot = createPlotlyComponent(Plotly);

const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#bcbd22', '#17becf', '#7f7f7f',
];

const MARKERS: Array<'circle' | 'square' | 'triangle-up' | 'diamond' | 'cross'> = [
  'circle', 'square', 'triangle-up', 'diamond', 'cross',
];

// SI to Metric conversion factor
const G = 9.80665;

// Chart layout
const CHART_DEFAULT_HEIGHT = 320;
const CHART_MIN_HEIGHT = 180;
const CHART_MAX_HEIGHT = 700;

export default function ParametricIterations() {
  const foundation = useFoundationStore((s) => s.foundation);
  const strata = useFoundationStore((s) => s.strata);
  const conditions = useFoundationStore((s) => s.conditions);
  const method = useFoundationStore((s) => s.method);

  // Theme detection for chart colors
  const [isLight, setIsLight] = useState(() =>
    document.documentElement.classList.contains('light-mode')
  );
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsLight(root.classList.contains('light-mode'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const config = useFoundationStore((s) => s.iterationConfig);
  const setConfig = useFoundationStore((s) => s.setIterationConfig);

  const [iterResult, setIterResult] = useState<IterationResult | null>(null);
  const [chartMetric, setChartMetric] = useState<'qa' | 'Qmax'>('qa');
  const [loading, setLoading] = useState(false);
  const [chartHeight, setChartHeight] = useState(CHART_DEFAULT_HEIGHT);
  const chartHRef = useRef(CHART_DEFAULT_HEIGHT);
  const summaryTableRef = useRef<HTMLTableElement>(null);
  const plotRef = useRef<any>(null);

  const handleCopyChart = useCallback(async () => {
    if (!plotRef.current) return;
    try {
      const dataUrl = await Plotly.toImage(plotRef.current, { format: 'png', width: 1200, height: 700 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      alert('Gráfico copiado al portapapeles. Puedes pegarlo en Word o PowerPoint.');
    } catch (err) {
      console.error('Error copying chart:', err);
      alert('No se pudo copiar el gráfico. Tu navegador podría no soportar esta función.');
    }
  }, []);

  const handleCopyTable = useCallback(() => {
    if (!summaryTableRef.current) return;
    const range = document.createRange();
    range.selectNode(summaryTableRef.current);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      try {
        document.execCommand('copy');
        alert('Tabla copiada al portapapeles. Puedes pegarla en Word o Excel.');
      } catch (err) {
        console.error('Error al copiar', err);
        alert('No se pudo copiar automáticamente. Por favor, selecciona y copia la tabla manualmente.');
      }
      selection.removeAllRanges();
    }
  }, []);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = chartHRef.current;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const h = Math.max(CHART_MIN_HEIGHT, Math.min(CHART_MAX_HEIGHT, startH + (ev.clientY - startY)));
      chartHRef.current = h;
      setChartHeight(h);
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const lbLocked = useFoundationStore((s) => s.lbLocked);
  const lbRatio = useFoundationStore((s) => s.lbRatio);

  const handleRun = async () => {
    if (!config.varyB && !config.varyDf) return;
    setLoading(true);
    try {
      // Convertir strata a SI para la API (Métrico → SI)
      const strataForAPI = strata.map((s) => ({
        ...s,
        gamma: s.gamma * G,      // t/m³ → kN/m³
        c: s.c * G,              // t/m² → kPa
        gammaSat: s.gammaSat * G, // t/m³ → kN/m³
      }));
      // Dimensiones ya en metros
      const configForAPI: Record<string, unknown> = { ...config };
      // When lbLocked, pass ratio so backend computes L = k × B for each iteration
      if (lbLocked && foundation.type === 'rectangular') {
        configForAPI.lbRatio = lbRatio;
      }
      const response = await fetch('/api/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base: { foundation, strata: strataForAPI, conditions, method },
          config: configForAPI,
        }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const result = await response.json();
      setIterResult(result);
      // Save to global store for PDF export
      useFoundationStore.getState().setIterationResults(result);
    } catch (err) {
      console.error('Error en iteraciones:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Convert SI value to metric display */
  const toMetric = (val: number, _type: 'pressure' | 'force') => val / G;

  // Build Plotly traces — display in metric
  const getTraces = (): Partial<Plotly.Data>[] => {
    if (!iterResult) return [];
    return iterResult.dfValues.map((df, di) => {
      const row = iterResult.matrix[di];
      return {
        x: row.map((c) => c.B),
        y: row.map((c) => toMetric(chartMetric === 'qa' ? c.result.qa : c.Qmax, chartMetric === 'qa' ? 'pressure' : 'force')),
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        name: `D_f = ${df.toFixed(2)} m`,
        line: { color: COLORS[di % COLORS.length], width: 2 },
        marker: {
          symbol: MARKERS[di % MARKERS.length],
          size: 7,
          color: COLORS[di % COLORS.length],
          line: { color: COLORS[di % COLORS.length], width: 1 },
        },
        hovertemplate:
          `<b>B = %{x:.2f} m</b><br>` +
          `D<sub>f</sub> = ${df.toFixed(2)} m<br>` +
          `${chartMetric === 'qa' ? 'q<sub>adm</sub>' : 'Q<sub>max</sub>'} = %{y:.2f} ` +
          `${chartMetric === 'qa' ? 'tnf/m²' : 'tnf'}` +
          `<extra></extra>`,
      };
    });
  };

  // Theme-aware chart colors (only bg, text, grid — NOT chart data)
  const chartText = isLight ? '#4a4540' : '#ccc';
  const chartAxisLabel = isLight ? '#6b6358' : '#aaa';
  const chartAxisLine = isLight ? '#c4bdb3' : '#555';
  const chartGrid = isLight ? '#e8e3db' : '#2a2a2a';
  const chartMinorGrid = isLight ? '#f0ebe3' : '#1e1e1e';
  const chartTick = isLight ? '#8a8279' : '#999';
  const chartAxisText = isLight ? '#8a8279' : '#888';
  const chartPlotBg = isLight ? '#f7f3ed' : '#141414';
  const chartPaperBg = isLight ? '#f0ebe3' : '#111111';
  const chartLegendBg = isLight ? 'rgba(240,235,227,0.95)' : 'rgba(20,20,20,0.9)';
  const chartLegendBorder = isLight ? '#c4bdb3' : '#444';
  const chartLegendText = isLight ? '#6b6358' : '#bbb';

  const layout: Partial<Plotly.Layout> = {
    xaxis: {
      title: { text: 'B (m)', font: { size: 11, color: chartAxisLabel } },
      color: chartAxisText,
      gridcolor: chartGrid,
      gridwidth: 0.5,
      linecolor: chartAxisLine,
      linewidth: 1,
      zeroline: false,
      tickfont: { size: 10, color: chartTick },
      minor: { gridcolor: chartMinorGrid, gridwidth: 0.3 },
    },
    yaxis: {
      title: {
        text: chartMetric === 'qa' ? 'q<sub>adm</sub> (tnf/m²)' : 'Q<sub>max</sub> (tnf)',
        font: { size: 11, color: chartAxisLabel },
      },
      color: chartAxisText,
      gridcolor: chartGrid,
      gridwidth: 0.5,
      linecolor: chartAxisLine,
      linewidth: 1,
      zeroline: false,
      tickfont: { size: 10, color: chartTick },
      minor: { gridcolor: chartMinorGrid, gridwidth: 0.3 },
    },
    plot_bgcolor: chartPlotBg,
    paper_bgcolor: chartPaperBg,
    font: { color: chartText, size: 10 },
    legend: {
      bgcolor: chartLegendBg,
      bordercolor: chartLegendBorder,
      borderwidth: 1,
      font: { size: 10, color: chartLegendText },
      x: 0.01,
      y: 0.99,
    },
    margin: { t: 10, r: 16, b: 44, l: 56 },
    hovermode: 'closest' as const,
    dragmode: 'zoom' as const,
  };

  const plotConfig: Partial<Plotly.Config> = {
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
    displaylogo: false,
    toImageButtonOptions: {
      format: 'png',
      filename: `iteraciones_${method}_${chartMetric}`,
      width: 1200,
      height: 700,
      scale: 2,
    },
    responsive: true,
  };

  return (
    <div>
      {/* Config */}
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Configuración de Iteraciones
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', marginBottom: 6 }}>
          <input type="checkbox" className="cad-checkbox" checked={config.varyB}
            onChange={(e) => setConfig({ ...config, varyB: e.target.checked })} />
          Variación de base (B)
        </label>
        {config.varyB && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, marginLeft: 20 }}>
            <IterField label="Inicio" value={config.bStart} onChange={(v) => setConfig({ ...config, bStart: v })} />
            <IterField label="Final" value={config.bEnd} onChange={(v) => setConfig({ ...config, bEnd: v })} />
            <IterField label="ΔB" value={config.bStep} onChange={(v) => setConfig({ ...config, bStep: v })} />
          </div>
        )}

        {/* L info for rectangular foundations */}
        {config.varyB && foundation.type === 'rectangular' && (
          <div style={{
            marginBottom: 8, marginLeft: 20, padding: '5px 8px',
            background: 'rgba(192, 57, 43, 0.08)', border: '1px solid rgba(192, 57, 43, 0.2)',
            borderRadius: 'var(--radius-sm)', fontSize: 10, color: 'var(--text-secondary)',
          }}>
            {lbLocked
              ? `📐 L = ${lbRatio} × B (L varía automáticamente con B)`
              : `📐 L = ${foundation.L.toFixed(2)} m (fijo durante iteraciones)`
            }
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', marginBottom: 6 }}>
          <input type="checkbox" className="cad-checkbox" checked={config.varyDf}
            onChange={(e) => setConfig({ ...config, varyDf: e.target.checked })} />
          Variación de desplante (Df)
        </label>
        {config.varyDf && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, marginLeft: 20 }}>
            <IterField label="Inicio" value={config.dfStart} onChange={(v) => setConfig({ ...config, dfStart: v })} />
            <IterField label="Final" value={config.dfEnd} onChange={(v) => setConfig({ ...config, dfEnd: v })} />
            <IterField label="ΔDf" value={config.dfStep} onChange={(v) => setConfig({ ...config, dfStep: v })} />
          </div>
        )}

        <button
          className="cad-btn cad-btn-accent"
          onClick={handleRun}
          disabled={(!config.varyB && !config.varyDf) || loading}
          style={{ width: '100%', padding: '6px 0', fontSize: 11 }}
        >
          {loading ? '⏳ Calculando...' : '▶ Ejecutar Iteraciones'}
        </button>
      </div>

      {/* Results */}
      {iterResult && (
        <div style={{ padding: 12 }}>
          {/* Metric toggle & Copy Chart */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
            <button
              className={chartMetric === 'qa' ? 'cad-btn cad-btn-accent' : 'cad-btn'}
              onClick={() => setChartMetric('qa')}
              style={{ flex: 1, fontSize: 10 }}
            >
              q_adm (tnf/m²)
            </button>
            <button
              className={chartMetric === 'Qmax' ? 'cad-btn cad-btn-accent' : 'cad-btn'}
              onClick={() => setChartMetric('Qmax')}
              style={{ flex: 1, fontSize: 10 }}
            >
              Q_max (tnf)
            </button>
            <button
              className="cad-btn"
              onClick={handleCopyChart}
              style={{ padding: '6px 12px', fontSize: 10, flexShrink: 0 }}
              title="Copiar gráfico como imagen"
            >
              📸 Copiar Gráfico
            </button>
          </div>

          {/* Plotly Chart */}
          <div style={{ height: chartHeight, marginBottom: 0 }}>
            <Plot
              data={getTraces() as any[]}
              layout={{ ...layout, height: chartHeight }}
              config={plotConfig}
              useResizeHandler
              onInitialized={(_figure: any, graphDiv: any) => { plotRef.current = graphDiv; }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            style={{
              height: 7, cursor: 'ns-resize', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-viewport)',
            }}
          >
            <div style={{ width: 36, height: 3, borderRadius: 2, background: 'var(--bg-elevated)' }} />
          </div>

          {/* Annotations */}
          <div style={{
            maxHeight: 200, overflowY: 'auto',
            background: 'var(--bg-surface-1)', border: '1px solid var(--border)', padding: 8,
          }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Anotaciones ({iterResult.annotations.length} cálculos)
            </p>
            {iterResult.annotations.map((ann, i) => (
              <p key={i} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 1 }}>{ann}</p>
            ))}
          </div>

          {/* Export buttons */}
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Exportar Iteraciones
            </p>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="cad-btn" style={{ flex: 1, fontSize: 10 }}
                onClick={() => exportJSON(iterResult, foundation, method)}>
                📄 JSON
              </button>
              <button className="cad-btn" style={{ flex: 1, fontSize: 10 }}
                onClick={() => exportCSV(iterResult)}>
                📊 CSV
              </button>
              <button className="cad-btn" style={{ flex: 1, fontSize: 10 }}
                onClick={() => exportTXT(iterResult, foundation, method)}>
                📝 TXT
              </button>
            </div>
          </div>

          {/* Summary Table for Copy-Paste */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, margin: 0 }}>
                Tabla Resumen (Copiar y Pegar en Word)
              </p>
              <button className="cad-btn" style={{ fontSize: 10, padding: '4px 8px' }} onClick={handleCopyTable}>
                📋 Copiar Tabla
              </button>
            </div>
            <div style={{ overflowX: 'auto', background: 'white', border: '1px solid var(--border)' }}>
              {(() => {
                if (!iterResult || !iterResult.matrix.length || !iterResult.matrix[0]) return null;
                const bValues = iterResult.matrix[0].map(cell => cell.B);
                const dfValues = iterResult.dfValues;
                const metricU = chartMetric === 'qa' ? 'tnf/m²' : 'tnf';
                const metricName = chartMetric === 'qa' ? 'Q adm' : 'Q max';

                return (
                  <table ref={summaryTableRef} style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 12, color: 'black', fontFamily: 'Arial, sans-serif' }}>
                    <thead>
                      <tr>
                        {dfValues.map((df, i) => (
                          <th key={`df-${i}`} colSpan={2} style={{ border: '1px solid black', padding: '4px', backgroundColor: '#87CEEB', fontWeight: 'bold' }}>
                            Para un Df = {df.toFixed(2)} m
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {dfValues.map((_, i) => (
                          <React.Fragment key={`sub-${i}`}>
                            <th style={{ border: '1px solid black', padding: '4px', backgroundColor: '#87CEEB', fontWeight: 'bold' }}>
                              B (m)
                            </th>
                            <th style={{ border: '1px solid black', padding: '4px', backgroundColor: '#87CEEB', fontWeight: 'bold' }}>
                              {metricName} ({metricU})
                            </th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bValues.map((_, bi) => (
                        <tr key={`row-${bi}`}>
                          {dfValues.map((_df, di) => {
                            const cell = iterResult.matrix[di][bi];
                            if (!cell) return <React.Fragment key={`empty-${di}-${bi}`}><td style={{border:'1px solid black'}}>-</td><td style={{border:'1px solid black'}}>-</td></React.Fragment>;
                            const val = chartMetric === 'qa' ? cell.result.qa : cell.Qmax;
                            return (
                              <React.Fragment key={`cell-${di}-${bi}`}>
                                <td style={{ border: '1px solid black', padding: '4px' }}>
                                  {cell.B.toFixed(2)}
                                </td>
                                <td style={{ border: '1px solid black', padding: '4px' }}>
                                  {toMetric(val, chartMetric === 'qa' ? 'pressure' : 'force').toFixed(2)}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IterField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{label}</span>
      <CadNumericInput className="cad-input" value={value} step={0.1} min={0}
        style={{ fontSize: 10 }}
        onChange={onChange} />
    </div>
  );
}

// ─── Export helpers ───────────────────────────────────────────────

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(
  iterResult: IterationResult,
  foundation: { type: string; B: number; L: number; Df: number; FS: number; beta: number },
  method: string,
) {
  const data = {
    metadata: {
      generado: new Date().toISOString(),
      programa: 'Cimentaciones Web',
      metodo: method,
      cimentacion: foundation,
    },
    bValues: iterResult.bValues,
    dfValues: iterResult.dfValues,
    resultados: iterResult.matrix.map((row) =>
      row.map((cell) => ({
        B: cell.B, Df: cell.Df,
        qu: cell.result.qu, qa: cell.result.qa,
        qnet: cell.result.qnet, Qmax: cell.Qmax,
        factores: cell.result.bearingFactors,
      }))
    ),
  };
  downloadFile(JSON.stringify(data, null, 2), `iteraciones_${method}.json`, 'application/json');
}

function exportCSV(iterResult: IterationResult) {
  const header = `N°,B (m),Df (m),qu (tnf/m²),qa (tnf/m²),qnet (tnf/m²),Qmax (tnf),Nc,Nq,Nγ\n`;
  let n = 1;
  const rows = iterResult.matrix.flatMap((row) =>
    row.map((cell) => {
      const r = cell.result;
      return [
        n++, cell.B.toFixed(3), cell.Df.toFixed(3),
        (r.qu / G).toFixed(3), (r.qa / G).toFixed(3), (r.qnet / G).toFixed(3), (cell.Qmax / G).toFixed(3),
        r.bearingFactors.Nc, r.bearingFactors.Nq, r.bearingFactors.Ngamma,
      ].join(',');
    })
  );
  downloadFile(header + rows.join('\n'), 'iteraciones.csv', 'text/csv');
}

function exportTXT(
  iterResult: IterationResult,
  foundation: { type: string; B: number; L: number; Df: number; FS: number; beta: number },
  method: string,
) {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  Cimentaciones WEB — Reporte de Iteraciones Paramétricas');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  Fecha: ${new Date().toLocaleString()}`);
  lines.push(`  Método: ${method.toUpperCase()}`);
  lines.push(`  Tipo: ${foundation.type}  |  FS: ${foundation.FS}  |  β: ${foundation.beta}°`);
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');
  let n = 1;
  for (const row of iterResult.matrix) {
    for (const cell of row) {
      const r = cell.result;
      lines.push(`  Cálculo ${String(n).padStart(2, '0')}:`);
      lines.push(`    B  = ${cell.B.toFixed(3)} m    Df = ${cell.Df.toFixed(3)} m`);
      lines.push(`    qu = ${(r.qu / G).toFixed(3)} tnf/m²`);
      lines.push(`    qa = ${(r.qa / G).toFixed(3)} tnf/m²`);
      lines.push(`    qnet = ${(r.qnet / G).toFixed(3)} tnf/m²`);
      lines.push(`    Qmax = ${(cell.Qmax / G).toFixed(3)} tnf`);
      lines.push(`    Nc = ${r.bearingFactors.Nc}  Nq = ${r.bearingFactors.Nq}  Nγ = ${r.bearingFactors.Ngamma}`);
      lines.push('');
      n++;
    }
  }
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  Total: ${n - 1} cálculos`);
  lines.push('  Generado por Cimentaciones Web — UCSM 2026');
  lines.push('═══════════════════════════════════════════════════════════════');
  downloadFile(lines.join('\n'), `iteraciones_${method}.txt`, 'text/plain');
}
