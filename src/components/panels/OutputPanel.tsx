/**
 * OutputPanel — Right panel: output configuration and quick results.
 */
import { useFoundationStore } from '../../store/foundationStore';
import PDFReport from '../export/PDFReport';

const METHOD_LABELS: Record<string, string> = {
  terzaghi: 'Terzaghi',
  general: 'Ec. General (Das)',
  rne: 'RNE E.050',
};

export default function OutputPanel() {
  const result = useFoundationStore((s) => s.result);
  const errors = useFoundationStore((s) => s.errors);

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

      {/* Export actions */}
      <div style={{
        padding: 8,
        borderTop: '1px solid #505050',
      }}>
        <p style={{
          fontSize: 10, fontWeight: 600, color: '#888',
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
        }}>
          Exportar
        </p>
        <PDFReport />
      </div>
    </div>
  );
}

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
