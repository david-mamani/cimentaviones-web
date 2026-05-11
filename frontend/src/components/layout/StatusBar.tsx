/**
 * StatusBar — Bottom bar showing current state info.
 * Hardcoded to Metric units.
 */
import { useFoundationStore } from '../../store/foundationStore';

const G = 9.80665;

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
      height: 26,
      background: 'var(--bg-surface-1)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 16,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
      flexShrink: 0,
    }}>
      <span>Método: <strong style={{ color: 'var(--text-primary)' }}>{METHOD_LABELS[method]}</strong></span>
      <span>FS: <strong style={{ color: 'var(--text-primary)' }}>{foundation.FS}</strong></span>
      <span>B: <strong style={{ color: 'var(--text-primary)' }}>{foundation.B}m</strong></span>
      <span>Df: <strong style={{ color: 'var(--text-primary)' }}>{foundation.Df}m</strong></span>
      {result && (
        <>
          <span style={{ color: 'var(--success)' }}>
            qa = {(result.qa / G).toFixed(2)} t/m²
          </span>
          <span>Estrato: {result.designStratumIndex + 1} ({result.soilType})</span>
        </>
      )}
      {errors.length > 0 && (
        <span style={{ color: 'var(--error)' }}>⚠ {errors.length} error(es)</span>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ color: 'var(--text-muted)' }}>UCSM — Ingeniería de cimentaciones — 2026</span>
    </div>
  );
}
