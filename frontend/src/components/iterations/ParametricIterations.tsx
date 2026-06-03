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
  const parametricUiConfig = useFoundationStore((s) => s.parametricUiConfig);
  const setParametricUiConfig = useFoundationStore((s) => s.setParametricUiConfig);

  const [iterResult, setIterResult] = useState<IterationResult | null>(null);
  // Modo familia: corre múltiples L/B en una sola pasada.
  const [familyResult, setFamilyResult] = useState<any | null>(null);
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
  const { familyMode, familyRatios, chartMetric } = parametricUiConfig;

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
      const configForAPI: Record<string, unknown> = { ...config };
      if (familyMode) {
        // Modo familia: corre N relaciones L/B en una sola pasada.
        const resp = await fetch('/api/iterate-family', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base: { foundation, strata: strataForAPI, conditions, method },
            config: configForAPI,
            lb_ratios: familyRatios,
          }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: 'Error servidor' }));
          throw new Error(err.detail || `Error ${resp.status}`);
        }
        const data = await resp.json();
        setFamilyResult(data);
        setIterResult(null);
      } else {
        // Modo simple (1 corrida)
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
        setFamilyResult(null);
        useFoundationStore.getState().setIterationResults(result);
      }
    } catch (err) {
      console.error('Error en iteraciones:', err);
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  /** Convert SI value to metric display */
  const toMetric = (val: number, _type: 'pressure' | 'force') => val / G;

  // Build Plotly traces — display in metric.
  // En modo familia, generamos una curva por cada (lbRatio, df) — si hay más
  // de 1 Df, agrupa por familia con colores y por Df con marcadores.
  const getTraces = (): Partial<Plotly.Data>[] => {
    if (familyMode && familyResult) {
      const traces: Partial<Plotly.Data>[] = [];
      familyResult.families.forEach((fam: any, fi: number) => {
        fam.dfValues.forEach((df: number, di: number) => {
          const row = fam.matrix[di];
          traces.push({
            x: row.map((c: any) => c.B),
            y: row.map((c: any) => toMetric(
              chartMetric === 'qa' ? c.result.qa : c.Qmax,
              chartMetric === 'qa' ? 'pressure' : 'force',
            )),
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: fam.dfValues.length > 1
              ? `${fam.label} · Df=${df.toFixed(1)}`
              : fam.label,
            line: { color: COLORS[fi % COLORS.length], width: 2 },
            marker: {
              symbol: MARKERS[di % MARKERS.length],
              size: 6,
            },
          });
        });
      });
      return traces;
    }
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

  // Plotly chart colors — theme-aware (Plotly SVG no resuelve CSS vars,
  // así que las leemos a mano según el modo activo).
  const chartText        = isLight ? '#4a4a4a' : '#cccccc';
  const chartAxisLabel   = isLight ? '#4a4a4a' : '#cccccc';
  const chartAxisLine    = isLight ? '#c8c8c8' : '#555555';
  const chartGrid        = isLight ? '#e8e8e8' : '#2a2a2a';
  const chartMinorGrid   = isLight ? '#f3eed7' : '#1e1e1e';
  const chartTick        = isLight ? '#8a8a8a' : '#999999';
  const chartAxisText    = isLight ? '#8a8a8a' : '#888888';
  const chartPlotBg      = isLight ? '#ffffff' : '#1e1e1e';
  const chartPaperBg     = isLight ? '#f8f5e8' : '#2b2b2b';
  const chartLegendBg    = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(43,43,43,0.92)';
  const chartLegendBorder = isLight ? '#d6d0bf' : '#444444';
  const chartLegendText  = isLight ? '#4a4a4a' : '#bbbbbb';

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
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Eyebrow + Title */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--lucid-ink-muted)',
          marginBottom: 6,
        }}>
          Iteraciones paramétricas
        </div>
        <h2 style={{
          fontFamily: 'var(--lucid-font-serif)',
          fontSize: 22, fontWeight: 600,
          color: 'var(--lucid-ink-strong)',
          margin: 0, letterSpacing: '-0.01em',
        }}>
          Variación de <em style={{ color: 'var(--lucid-acc-coral)', fontStyle: 'italic' }}>B</em> y{' '}
          <em style={{ color: 'var(--lucid-acc-coral)', fontStyle: 'italic' }}>Dƒ</em>
        </h2>
      </div>

      {/* Config — figure card */}
      <div style={{
        background: 'var(--lucid-surface-figure)',
        border: '1px solid var(--lucid-rule-cream)',
        borderRadius: 6,
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        <p style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 11, fontWeight: 600, color: 'var(--lucid-ink-muted)',
          marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.10em',
        }}>
          Configuración
        </p>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--lucid-font-sans)', fontSize: 13,
          color: 'var(--lucid-ink-strong)', cursor: 'pointer', marginBottom: 8,
        }}>
          <input type="checkbox" className="cad-checkbox" checked={config.varyB}
            onChange={(e) => setConfig({ ...config, varyB: e.target.checked })} />
          Variación de base (B)
        </label>
        {config.varyB && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, marginLeft: 24 }}>
            <IterField label="Inicio" value={config.bStart} onChange={(v) => setConfig({ ...config, bStart: v })} />
            <IterField label="Final" value={config.bEnd} onChange={(v) => setConfig({ ...config, bEnd: v })} />
            <IterField label="ΔB" value={config.bStep} onChange={(v) => setConfig({ ...config, bStep: v })} />
          </div>
        )}

        {/* L info — Lucid note */}
        {config.varyB && foundation.type === 'rectangular' && (
          <div style={{
            marginBottom: 12, marginLeft: 24,
            padding: '8px 12px',
            background: 'var(--lucid-surface-page)',
            border: '1px solid var(--lucid-rule-cream)',
            borderRadius: 4,
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 13, fontStyle: 'italic', color: 'var(--lucid-ink-body)',
          }}>
            {lbLocked
              ? `L = ${lbRatio} × B (varía automáticamente con B)`
              : `L = ${foundation.L.toFixed(2)} m (fijo durante iteraciones)`
            }
          </div>
        )}

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--lucid-font-sans)', fontSize: 13,
          color: 'var(--lucid-ink-strong)', cursor: 'pointer', marginBottom: 8,
        }}>
          <input type="checkbox" className="cad-checkbox" checked={config.varyDf}
            onChange={(e) => setConfig({ ...config, varyDf: e.target.checked })} />
          Variación de desplante (Dƒ)
        </label>
        {config.varyDf && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, marginLeft: 24 }}>
            <IterField label="Inicio" value={config.dfStart} onChange={(v) => setConfig({ ...config, dfStart: v })} />
            <IterField label="Final" value={config.dfEnd} onChange={(v) => setConfig({ ...config, dfEnd: v })} />
            <IterField label="ΔDƒ" value={config.dfStep} onChange={(v) => setConfig({ ...config, dfStep: v })} />
          </div>
        )}

        {/* Modo familia L/B */}
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: familyMode ? 'var(--lucid-tint-coral)' : 'var(--lucid-surface-figure)',
          border: `1px solid ${familyMode ? 'var(--lucid-acc-coral-border)' : 'var(--lucid-rule-cream)'}`,
          borderRadius: 4,
        }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--lucid-font-sans)', fontSize: 12,
            cursor: 'pointer',
          }}>
            <input
              type="checkbox" className="cad-checkbox"
              checked={familyMode}
              onChange={(e) => setParametricUiConfig({ familyMode: e.target.checked })}
            />
            Modo familia: correr múltiples L/B en una pasada
          </label>
          {familyMode && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                fontFamily: 'var(--lucid-font-sans)', fontSize: 10,
                color: 'var(--lucid-ink-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
              }}>
                Relaciones L/B (separadas por coma)
              </div>
              <input
                type="text"
                value={familyRatios.join(', ')}
                onChange={(e) => {
                  const parsed = e.target.value.split(',')
                    .map((s) => parseFloat(s.trim()))
                    .filter((n) => isFinite(n) && n > 0);
                  if (parsed.length > 0) setParametricUiConfig({ familyRatios: parsed });
                }}
                style={{
                  width: '100%', padding: '6px 8px',
                  background: 'var(--lucid-surface-page)',
                  border: '1px solid var(--lucid-rule-cream)',
                  borderRadius: 3,
                  fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
                  color: 'var(--lucid-ink-strong)',
                }}
              />
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--lucid-ink-muted)', fontFamily: 'var(--lucid-font-sans)' }}>
                Default: 1, 2, 3, 5, 10 (cuadrada + 4 rectangulares). Una curva por L/B.
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleRun}
          disabled={(!config.varyB && !config.varyDf) || loading}
          style={{
            width: '100%', padding: '11px 0',
            background: loading ? 'var(--lucid-surface-figure-deep)' : 'var(--lucid-button-primary-bg)',
            color: loading ? 'var(--lucid-ink-muted)' : 'var(--lucid-button-primary-fg)',
            border: 'none', borderRadius: 4,
            fontFamily: 'var(--lucid-font-sans)', fontSize: 13, fontWeight: 500,
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 8,
            transition: 'background 160ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <span style={{
            display: 'inline-grid', placeItems: 'center',
            color: loading ? 'var(--lucid-ink-muted)' : 'var(--lucid-acc-coral)',
            fontSize: 14,
          }}>
            ▶
          </span>
          {loading ? 'Calculando…' : 'Ejecutar iteraciones'}
        </button>
      </div>

      {/* Results */}
      {(iterResult || familyResult) && (
        <div>
          {/* Chart card */}
          <div style={{
            background: 'var(--lucid-surface-figure)',
            border: '1px solid var(--lucid-rule-cream)',
            borderRadius: 6,
            padding: '20px 24px',
            marginBottom: 18,
          }}>
            {/* Chart tabs + copy */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 14, alignItems: 'center' }}>
              <button
                onClick={() => setParametricUiConfig({ chartMetric: 'qa' })}
                style={{
                  padding: '6px 18px',
                  background: 'transparent', border: 'none',
                  fontFamily: 'var(--lucid-font-serif)', fontSize: 14,
                  color: chartMetric === 'qa' ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-muted)',
                  borderBottom: `2px solid ${chartMetric === 'qa' ? 'var(--lucid-acc-coral)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                q<sub>adm</sub> (tnf/m²)
              </button>
              <button
                onClick={() => setParametricUiConfig({ chartMetric: 'Qmax' })}
                style={{
                  padding: '6px 18px',
                  background: 'transparent', border: 'none',
                  fontFamily: 'var(--lucid-font-serif)', fontSize: 14,
                  color: chartMetric === 'Qmax' ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-muted)',
                  borderBottom: `2px solid ${chartMetric === 'Qmax' ? 'var(--lucid-acc-coral)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                Q<sub>max</sub> (tnf)
              </button>
              <button
                onClick={handleCopyChart}
                style={{
                  marginLeft: 'auto',
                  padding: '5px 12px',
                  background: 'var(--lucid-surface-page)', border: '1px solid var(--lucid-rule-cream)',
                  borderRadius: 4,
                  fontFamily: 'var(--lucid-font-sans)', fontSize: 11,
                  color: 'var(--lucid-ink-body)', cursor: 'pointer',
                  transition: 'background 160ms cubic-bezier(0.4,0,0.2,1)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--lucid-surface-figure-deep)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--lucid-surface-page)'; }}
                title="Copiar gráfico como imagen"
              >
                Copiar gráfico
              </button>
            </div>

            {/* Plotly Chart */}
            <div style={{ height: chartHeight, background: 'var(--lucid-surface-page)', borderRadius: 4, overflow: 'hidden' }}>
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
                height: 8, cursor: 'ns-resize', marginTop: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ width: 32, height: 2, borderRadius: 2, background: 'var(--lucid-rule-cream)' }} />
            </div>
          </div>

          {/* Annotations — log Lucid (sólo en modo simple) */}
          {iterResult && (<>
          <div style={{
            background: 'var(--lucid-surface-page)',
            border: '1px solid var(--lucid-rule-cream)',
            borderRadius: 6,
            padding: '14px 18px',
            marginBottom: 18,
            maxHeight: 220, overflowY: 'auto',
          }}>
            <p style={{
              fontFamily: 'var(--lucid-font-sans)',
              fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.10em',
              color: 'var(--lucid-ink-muted)',
              marginBottom: 10,
            }}>
              Anotaciones ({iterResult.annotations.length} cálculos)
            </p>
            {iterResult.annotations.map((ann, i) => (
              <p key={i} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--lucid-ink-body)',
                marginBottom: 2, lineHeight: 1.7,
              }}>
                {ann}
              </p>
            ))}
          </div>

          {/* Export buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
            <ExportIterBtn label="JSON" onClick={() => exportJSON(iterResult, foundation, method)} />
            <ExportIterBtn label="CSV" onClick={() => exportCSV(iterResult)} />
            <ExportIterBtn label="TXT" onClick={() => exportTXT(iterResult, foundation, method)} />
          </div>

          {/* Summary Table for Copy-Paste */}
          <div style={{
            background: 'var(--lucid-surface-figure)',
            border: '1px solid var(--lucid-rule-cream)',
            borderRadius: 6,
            padding: '20px 24px',
            marginBottom: 24,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 14,
            }}>
              <div>
                <p style={{
                  fontFamily: 'var(--lucid-font-sans)',
                  fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.10em',
                  color: 'var(--lucid-ink-strong)',
                  margin: 0,
                }}>
                  Tabla resumen
                </p>
                <span style={{
                  fontFamily: 'var(--lucid-font-serif)',
                  fontSize: 11, fontStyle: 'italic',
                  color: 'var(--lucid-ink-muted)',
                }}>
                  Copiar y pegar en Word
                </span>
              </div>
              <button
                onClick={handleCopyTable}
                style={{
                  padding: '5px 14px',
                  background: 'var(--lucid-surface-page)', border: '1px solid var(--lucid-rule-cream)',
                  borderRadius: 4,
                  fontFamily: 'var(--lucid-font-sans)', fontSize: 11,
                  color: 'var(--lucid-ink-strong)', cursor: 'pointer',
                }}
              >
                Copiar tabla
              </button>
            </div>
            <div style={{ overflowX: 'auto', background: 'var(--lucid-surface-page)', border: '1px solid var(--lucid-rule-cream)', borderRadius: 4 }}>
              {(() => {
                if (!iterResult || !iterResult.matrix.length || !iterResult.matrix[0]) return null;
                const bValues = iterResult.matrix[0].map(cell => cell.B);
                const dfValues = iterResult.dfValues;
                const metricU = chartMetric === 'qa' ? 'tnf/m²' : 'tnf';
                const metricName = chartMetric === 'qa' ? 'Q adm' : 'Q max';

                // NOTA: Esta tabla es para visualizacion ademas de copy-paste
                // a Word/Excel. Usamos tokens Lucid para integrarse al tema; al
                // copiar a Word los colores de tema se pegan tal cual. Si se
                // requiere un azul-Word fijo se sugiere copiar el screenshot.
                const thBg = 'var(--lucid-acc-slate-bg)';
                const thColor = 'var(--lucid-acc-slate-text)';
                const cellBorder = '1px solid var(--lucid-rule-cream)';
                const tdColor = 'var(--lucid-ink-body)';
                return (
                  <table
                    ref={summaryTableRef}
                    style={{
                      width: '100%', borderCollapse: 'collapse', textAlign: 'center',
                      fontSize: 12, color: tdColor,
                      fontFamily: 'var(--lucid-font-serif)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <thead>
                      <tr>
                        {dfValues.map((df, i) => (
                          <th key={`df-${i}`} colSpan={2} style={{ border: cellBorder, padding: '6px', background: thBg, color: thColor, fontWeight: 600, fontFamily: 'var(--lucid-font-serif)' }}>
                            Para un Dƒ = {df.toFixed(2)} m
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {dfValues.map((_, i) => (
                          <React.Fragment key={`sub-${i}`}>
                            <th style={{ border: cellBorder, padding: '6px', background: thBg, color: thColor, fontFamily: 'var(--lucid-font-sans)', fontSize: 11, fontWeight: 500 }}>
                              B (m)
                            </th>
                            <th style={{ border: cellBorder, padding: '6px', background: thBg, color: thColor, fontFamily: 'var(--lucid-font-sans)', fontSize: 11, fontWeight: 500 }}>
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
                            if (!cell) return <React.Fragment key={`empty-${di}-${bi}`}><td style={{ border: cellBorder, color: tdColor }}>—</td><td style={{ border: cellBorder, color: tdColor }}>—</td></React.Fragment>;
                            const val = chartMetric === 'qa' ? cell.result.qa : cell.Qmax;
                            return (
                              <React.Fragment key={`cell-${di}-${bi}`}>
                                <td style={{ border: cellBorder, padding: '6px', color: tdColor }}>
                                  {cell.B.toFixed(2)}
                                </td>
                                <td style={{ border: cellBorder, padding: '6px', color: 'var(--lucid-ink-strong)' }}>
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
          </>)}
        </div>
      )}
    </div>
  );
}

function IterField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <span style={{
        fontFamily: 'var(--lucid-font-sans)',
        fontSize: 10, color: 'var(--lucid-ink-muted)',
        display: 'block', marginBottom: 4,
      }}>
        {label}
      </span>
      <CadNumericInput
        className="cad-input"
        value={value} step={0.1} min={0}
        onChange={onChange}
      />
    </div>
  );
}

function ExportIterBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 0',
        background: 'var(--lucid-surface-page)', border: '1px solid var(--lucid-rule-cream)',
        borderRadius: 4,
        fontFamily: 'var(--lucid-font-sans)', fontSize: 12,
        color: 'var(--lucid-ink-strong)', cursor: 'pointer',
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
