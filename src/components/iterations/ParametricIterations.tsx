/**
 * ParametricIterations — CAD-styled iteration controls and chart.
 */
import { useState } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import { runParametricIterations, type IterationConfig, type IterationResult } from '../../lib/terzaghi/parametricIterations';
import CadNumericInput from '../common/CadNumericInput';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CHART_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
  '#e74c3c', '#3498db', '#2ecc71', '#e67e22', '#9b59b6',
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

  const handleRun = () => {
    if (!config.varyB && !config.varyDf) return;
    const result = runParametricIterations(
      { foundation, strata, conditions, method },
      config
    );
    setIterResult(result);
  };

  const getChartData = () => {
    if (!iterResult) return [];
    const data: Record<string, number | string>[] = [];
    for (let bi = 0; bi < iterResult.bValues.length; bi++) {
      const point: Record<string, number | string> = { B: iterResult.bValues[bi] };
      for (let di = 0; di < iterResult.dfValues.length; di++) {
        const key = `Df=${iterResult.dfValues[di].toFixed(2)}m`;
        const cell = iterResult.matrix[di]?.[bi];
        if (cell) {
          point[key] = chartMetric === 'qa' ? cell.result.qa : cell.Qmax;
        }
      }
      data.push(point);
    }
    return data;
  };

  return (
    <div>
      {/* Config */}
      <div style={{ padding: 12, borderBottom: '1px solid #505050' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Configuración de Iteraciones
        </p>

        {/* B variation */}
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

        {/* Df variation */}
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
          disabled={!config.varyB && !config.varyDf}
          style={{ width: '100%', padding: '6px 0', fontSize: 11 }}
        >
          ▶ Ejecutar Iteraciones
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

          {/* Chart */}
          <div style={{ height: 280, marginBottom: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                <XAxis dataKey="B" stroke="#888" tick={{ fontSize: 10 }}
                  label={{ value: 'B (m)', position: 'insideBottomRight', offset: -5, fill: '#888', fontSize: 10 }} />
                <YAxis stroke="#888" tick={{ fontSize: 10 }}
                  label={{ value: chartMetric === 'qa' ? 'q_adm (kPa)' : 'Q_max (kN)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #505050', borderRadius: 0, fontSize: 11 }}
                  labelStyle={{ color: '#c0392b' }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {iterResult.dfValues.map((df, i) => (
                  <Line key={df} type="monotone" dataKey={`Df=${df.toFixed(2)}m`}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2}
                    dot={{ r: 3 }} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
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
