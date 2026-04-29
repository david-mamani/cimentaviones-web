/**
 * ParametricIterations — Iteration controls + Plotly.js interactive chart.
 */
import { useState, useRef, useCallback } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import type { IterationConfig, IterationResult } from '../../lib/terzaghi/parametricIterations';
import CadNumericInput from '../common/CadNumericInput';
// @ts-ignore — plotly.js-basic-dist-min has no types
import Plotly from 'plotly.js-basic-dist-min';
// @ts-ignore — factory export
import factoryModule from 'react-plotly.js/factory';
// @ts-ignore — ESM interop
const createPlotlyComponent = factoryModule.default || factoryModule;
const Plot = createPlotlyComponent(Plotly);

const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#bcbd22', '#17becf', '#7f7f7f',
];

const MARKERS: Array<'circle' | 'square' | 'triangle-up' | 'diamond' | 'cross'> = [
  'circle', 'square', 'triangle-up', 'diamond', 'cross',
];

export default function ParametricIterations() {
  const foundation = useFoundationStore((s) => s.foundation);
  const strata = useFoundationStore((s) => s.strata);
  const conditions = useFoundationStore((s) => s.conditions);
  const method = useFoundationStore((s) => s.method);

  const [config, setConfig] = useState<IterationConfig>({
    varyB: true,
    bStart: foundation.B,
    bEnd: foundation.B + 2,
    bStep: 0.5,
    varyDf: false,
    dfStart: foundation.Df,
    dfEnd: foundation.Df + 2,
    dfStep: 0.5,
  });

  const [iterResult, setIterResult] = useState<IterationResult | null>(null);
  const [chartMetric, setChartMetric] = useState<'qa' | 'Qmax'>('qa');
  const [loading, setLoading] = useState(false);
  const [chartHeight, setChartHeight] = useState(320);
  const chartHRef = useRef(320);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = chartHRef.current;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const h = Math.max(180, Math.min(700, startH + (ev.clientY - startY)));
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
      const iterConfig: Record<string, unknown> = { ...config };
      // When lbLocked, pass ratio so backend computes L = k × B for each iteration
      if (lbLocked && foundation.type === 'rectangular') {
        iterConfig.lbRatio = lbRatio;
      }
      const response = await fetch('/api/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base: { foundation, strata, conditions, method },
          config: iterConfig,
        }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const result = await response.json();
      setIterResult(result);
    } catch (err) {
      console.error('Error en iteraciones:', err);
    } finally {
      setLoading(false);
    }
  };

  // Build Plotly traces
  const getTraces = (): Partial<Plotly.Data>[] => {
    if (!iterResult) return [];
    return iterResult.dfValues.map((df, di) => {
      const row = iterResult.matrix[di];
      return {
        x: row.map((c) => c.B),
        y: row.map((c) => chartMetric === 'qa' ? c.result.qa : c.Qmax),
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
          `${chartMetric === 'qa' ? 'kPa' : 'kN'}` +
          `<extra></extra>`,
      };
    });
  };

  const layout: Partial<Plotly.Layout> = {
    xaxis: {
      title: { text: 'B (m)', font: { size: 11, color: '#aaa' } },
      color: '#888',
      gridcolor: '#2a2a2a',
      gridwidth: 0.5,
      linecolor: '#555',
      linewidth: 1,
      zeroline: false,
      tickfont: { size: 10, color: '#999' },
      minor: { gridcolor: '#1e1e1e', gridwidth: 0.3 },
    },
    yaxis: {
      title: {
        text: chartMetric === 'qa' ? 'q<sub>adm</sub> (kPa)' : 'Q<sub>max</sub> (kN)',
        font: { size: 11, color: '#aaa' },
      },
      color: '#888',
      gridcolor: '#2a2a2a',
      gridwidth: 0.5,
      linecolor: '#555',
      linewidth: 1,
      zeroline: false,
      tickfont: { size: 10, color: '#999' },
      minor: { gridcolor: '#1e1e1e', gridwidth: 0.3 },
    },
    plot_bgcolor: '#141414',
    paper_bgcolor: '#111111',
    font: { color: '#ccc', size: 10 },
    legend: {
      bgcolor: 'rgba(20,20,20,0.9)',
      bordercolor: '#444',
      borderwidth: 1,
      font: { size: 10, color: '#bbb' },
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
      <div style={{ padding: 12, borderBottom: '1px solid #505050' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
            borderRadius: 4, fontSize: 10, color: '#bbb',
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
          {/* Metric toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button
              className={chartMetric === 'qa' ? 'cad-btn cad-btn-accent' : 'cad-btn'}
              onClick={() => setChartMetric('qa')}
              style={{ flex: 1, fontSize: 10 }}
            >
              q_adm (kPa)
            </button>
            <button
              className={chartMetric === 'Qmax' ? 'cad-btn cad-btn-accent' : 'cad-btn'}
              onClick={() => setChartMetric('Qmax')}
              style={{ flex: 1, fontSize: 10 }}
            >
              Q_max (kN)
            </button>
          </div>

          {/* Plotly Chart */}
          <div style={{ height: chartHeight, marginBottom: 0 }}>
            <Plot
              data={getTraces() as any[]}
              layout={{ ...layout, height: chartHeight }}
              config={plotConfig}
              useResizeHandler
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            style={{
              height: 7, cursor: 'ns-resize', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#1a1a1a',
            }}
          >
            <div style={{ width: 36, height: 3, borderRadius: 2, background: '#444' }} />
          </div>

          {/* Annotations */}
          <div style={{
            maxHeight: 200, overflowY: 'auto',
            background: '#2a2a2a', border: '1px solid #505050', padding: 8,
          }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4 }}>
              Anotaciones ({iterResult.annotations.length} cálculos)
            </p>
            {iterResult.annotations.map((ann, i) => (
              <p key={i} style={{ fontSize: 10, fontFamily: 'Consolas, monospace', color: '#aaa', marginBottom: 1 }}>{ann}</p>
            ))}
          </div>

          {/* Export buttons */}
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
        </div>
      )}
    </div>
  );
}

function IterField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <span style={{ fontSize: 9, color: '#777', display: 'block', marginBottom: 2 }}>{label}</span>
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
      programa: 'CimentAviones Web',
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
  const header = 'N°,B (m),Df (m),qu (kPa),qa (kPa),qnet (kPa),Qmax (kN),Nc,Nq,Nγ\n';
  let n = 1;
  const rows = iterResult.matrix.flatMap((row) =>
    row.map((cell) => {
      const r = cell.result;
      return [
        n++, cell.B.toFixed(3), cell.Df.toFixed(3),
        r.qu.toFixed(3), r.qa.toFixed(3), r.qnet.toFixed(3), cell.Qmax.toFixed(3),
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
  lines.push('  CIMENTAVIONES WEB — Reporte de Iteraciones Paramétricas');
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
      lines.push(`    qu = ${r.qu.toFixed(3)} kPa`);
      lines.push(`    qa = ${r.qa.toFixed(3)} kPa`);
      lines.push(`    qnet = ${r.qnet.toFixed(3)} kPa`);
      lines.push(`    Qmax = ${cell.Qmax.toFixed(3)} kN`);
      lines.push(`    Nc = ${r.bearingFactors.Nc}  Nq = ${r.bearingFactors.Nq}  Nγ = ${r.bearingFactors.Ngamma}`);
      lines.push('');
      n++;
    }
  }
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  Total: ${n - 1} cálculos`);
  lines.push('  Generado por CimentAviones Web — UCSM 2026');
  lines.push('═══════════════════════════════════════════════════════════════');
  downloadFile(lines.join('\n'), `iteraciones_${method}.txt`, 'text/plain');
}
