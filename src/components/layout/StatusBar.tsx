/**
 * StatusBar — Bottom bar showing current state info.
 */
import { useFoundationStore } from '../../store/foundationStore';

const METHOD_LABELS: Record<string, string> = {
  terzaghi: 'Terzaghi',
  general: 'Ec. General',
  rne: 'RNE E.050',
};

export default function StatusBar() {
  const method = useFoundationStore((s) => s.method);
  const foundation = useFoundationStore((s) => s.foundation);
  const result = useFoundationStore((s) => s.result);
  const errors = useFoundationStore((s) => s.errors);

  return (
    <div style={{
      height: 24,
      background: '#2a2a2a',
      borderTop: '1px solid #505050',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 16,
      fontSize: 10,
      color: '#999',
      flexShrink: 0,
    }}>
      <span>Método: <strong style={{ color: '#e0e0e0' }}>{METHOD_LABELS[method]}</strong></span>
      <span>FS: <strong style={{ color: '#e0e0e0' }}>{foundation.FS}</strong></span>
      <span>B: <strong style={{ color: '#e0e0e0' }}>{foundation.B}m</strong></span>
      <span>Df: <strong style={{ color: '#e0e0e0' }}>{foundation.Df}m</strong></span>
      {result && (
        <>
          <span style={{ color: '#27ae60' }}>
            qa = {result.qa.toFixed(2)} kPa
          </span>
          <span>Estrato: {result.designStratumIndex + 1} ({result.soilType})</span>
        </>
      )}
      {errors.length > 0 && (
        <span style={{ color: '#e74c3c' }}>⚠ {errors.length} error(es)</span>
      )}
      <div style={{ flex: 1 }} />
      <span>CimentAviones Web v1.0</span>
    </div>
  );
}
