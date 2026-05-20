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
      height: 28,
      background: 'var(--lucid-surface-page)',
      borderTop: '1px solid var(--lucid-rule-white)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 18,
      fontSize: 11,
      fontFamily: 'var(--lucid-font-sans)',
      color: 'var(--lucid-ink-muted)',
      flexShrink: 0,
    }}>
      <StatusItem label="Método" value={METHOD_LABELS[method]} />
      <StatusItem label="FS" value={String(foundation.FS)} />
      <StatusItem label="B" value={`${foundation.B} m`} />
      <StatusItem label="Df" value={`${foundation.Df} m`} />
      {result && (
        <>
          <span style={{
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 13,
            color: 'var(--lucid-acc-coral)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            qa = {(result.qa / G).toFixed(2)} t/m²
          </span>
          <StatusItem label="Estrato" value={`${result.designStratumIndex + 1} (${result.soilType})`} />
        </>
      )}
      {errors.length > 0 && (
        <span style={{
          color: '#b5563f',
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 11,
        }}>
          ⚠ {errors.length} error(es)
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span style={{
        color: 'var(--lucid-ink-faint)',
        fontFamily: 'var(--lucid-font-serif)',
        fontStyle: 'italic',
        fontSize: 11,
      }}>
        UCSM · Ingeniería de cimentaciones · 2026
      </span>
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{
        fontFamily: 'var(--lucid-font-sans)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--lucid-ink-muted)',
      }}>
        {label}
      </span>
      <strong style={{
        fontFamily: 'var(--lucid-font-serif)',
        fontWeight: 500,
        fontSize: 13,
        color: 'var(--lucid-ink-strong)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </strong>
    </span>
  );
}
