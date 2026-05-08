/**
 * ResultsPanel — Full results view for workspace tab display.
 * Uses CSS variables for theme support.
 * Uses unitStore for dynamic unit labels and conversions.
 */
import { useFoundationStore } from '../../store/foundationStore';
import { useUnitStore } from '../../store/unitStore';

const METHOD_LABELS: Record<string, string> = {
  terzaghi: 'Terzaghi Clásico',
  general: 'Ecuación General (Das)',
  rne: 'RNE E.050',
};

const WATER_CASE_LABELS: Record<number, string> = {
  0: 'Sin nivel freático',
  1: 'NF sobre cimentación',
  2: 'NF en la base',
  3: 'NF entre Df y Df+B',
  4: 'NF debajo de Df+B',
};

export default function ResultsPanel() {
  const result = useFoundationStore((s) => s.result);
  const siToOutput = useUnitStore((s) => s.siToOutput);
  const outputLabel = useUnitStore((s) => s.outputLabel);
  const inputLabel = useUnitStore((s) => s.inputLabel);
  const fmt = useUnitStore((s) => s.fmt);

  if (!result) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
        No hay resultados. Presiona <strong style={{ color: 'var(--accent)' }}>Calcular</strong> en la barra de herramientas.
      </div>
    );
  }

  const ds = result.designStratum;
  const bf = result.bearingFactors;

  // Output unit labels
  const pu = outputLabel('pressure');
  const fu = outputLabel('force');
  const wu = outputLabel('unitWeight');
  // Input unit labels (for design stratum data, since those are input values)
  const iwu = inputLabel('unitWeight');
  const ipu = inputLabel('pressure');

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Title */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-surface-1)',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--accent)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
      }}>
        Resultados del Análisis — {METHOD_LABELS[result.method]}
      </div>

      {/* Design stratum — shows INPUT units since these are user-entered values */}
      <ResultSection title="Estrato de Diseño">
        <Row label="Estrato" value={`N° ${result.designStratumIndex + 1}`} />
        <Row label="Tipo de suelo" value={result.soilType === 'Coh' ? 'Cohesivo' : 'Friccionante'} accent />
        <Row label="φ" value={`${ds.phi}°`} />
        <Row label="c" value={`${ds.c} ${ipu}`} />
        <Row label="γ" value={`${ds.gamma} ${iwu}`} />
        <Row label="γsat" value={`${ds.gammaSat} ${iwu}`} />
      </ResultSection>

      {/* Bearing factors — dimensionless */}
      <ResultSection title="Factores de Capacidad Portante">
        <Row label="Nc" value={fmt(bf.Nc)} mono />
        <Row label="Nq" value={fmt(bf.Nq)} mono />
        <Row label="Nγ" value={fmt(bf.Ngamma)} mono />
      </ResultSection>

      {/* Overburden — OUTPUT units */}
      <ResultSection title="Sobrecarga y Correcciones">
        <Row label="q (sobrecarga)" value={`${fmt(siToOutput(result.q, 'pressure'))} ${pu}`} mono />
        <Row label="γ efectivo" value={`${fmt(siToOutput(result.gammaEffective, 'unitWeight'))} ${wu}`} mono />
        <Row label="Caso NF" value={WATER_CASE_LABELS[result.waterTableCase]} />
      </ResultSection>

      {/* Individual terms — OUTPUT units */}
      <ResultSection title="Términos Individuales">
        <Row label="Término 1 (F1)" value={`${fmt(siToOutput(result.F1, 'pressure'))} ${pu}`} mono />
        <Row label="Término 2 (F2)" value={`${fmt(siToOutput(result.F2, 'pressure'))} ${pu}`} mono />
        <Row label="Término 3 (F3)" value={`${fmt(siToOutput(result.F3, 'pressure'))} ${pu}`} mono />
      </ResultSection>

      {/* Final results — OUTPUT units */}
      <ResultSection title="Capacidades Portantes" highlight>
        <Row label="qu (cap. última)" value={`${fmt(siToOutput(result.qu, 'pressure'))} ${pu}`} accent mono />
        <Row label="qneta (cap. neta última)" value={`${fmt(siToOutput(result.qnet, 'pressure'))} ${pu}`} mono />
        <Row label="qa (cap. admisible)" value={`${fmt(siToOutput(result.qa, 'pressure'))} ${pu}`} accent mono />
        <Row label="qa_neta (cap. neta admisible)" value={`${fmt(siToOutput(result.qaNet, 'pressure'))} ${pu}`} mono />
        <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
        <Row label="Q_max (carga máxima)" value={`${fmt(siToOutput(result.Qmax, 'force'))} ${fu}`} accent mono />
      </ResultSection>

      {/* RNE Consideration — OUTPUT units */}
      {result.rneConsideration && (
        <ResultSection title="Consideración RNE">
          <Row label="qu RNE" value={`${fmt(siToOutput(result.rneConsideration.qultRNE, 'pressure'))} ${pu}`} mono />
          <Row label="qa RNE" value={`${fmt(siToOutput(result.rneConsideration.qadmRNE, 'pressure'))} ${pu}`} mono />
          <Row label="qu RNE corregido" value={`${fmt(siToOutput(result.rneConsideration.qultRNECorrected, 'pressure'))} ${pu}`} mono />
        </ResultSection>
      )}

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <ResultSection title={`⚠ Advertencias (${result.warnings.length})`}>
          {result.warnings.map((w, i) => (
            <div key={i} style={{
              padding: '4px 8px',
              marginBottom: 4,
              background: 'rgba(255, 191, 0, 0.08)',
              border: '1px solid rgba(255, 191, 0, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 10,
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}>
              {w}
            </div>
          ))}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, highlight, children }: {
  title: string; highlight?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{
        padding: '6px 12px',
        background: highlight ? 'var(--accent-bg)' : 'var(--bg-surface-1)',
        fontSize: 10,
        fontWeight: 600,
        color: highlight ? 'var(--accent)' : 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
      }}>
        {title}
      </div>
      <div style={{ padding: '6px 12px' }}>{children}</div>
    </div>
  );
}

function Row({ label, value, accent, mono }: {
  label: string; value: string; accent?: boolean; mono?: boolean;
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
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        color: accent ? 'var(--accent)' : 'var(--text-primary)',
        fontWeight: accent ? 700 : 500,
      }}>
        {value}
      </span>
    </div>
  );
}
