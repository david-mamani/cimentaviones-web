/**
 * ResultsPanel — Full results view for workspace tab display.
 * Uses CSS variables for theme support.
 */
import { useFoundationStore } from '../../store/foundationStore';

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
  if (!result) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
        No hay resultados. Presiona <strong style={{ color: 'var(--accent)' }}>Calcular</strong> en la barra de herramientas.
      </div>
    );
  }

  const ds = result.designStratum;
  const bf = result.bearingFactors;

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

      {/* Design stratum */}
      <ResultSection title="Estrato de Diseño">
        <Row label="Estrato" value={`N° ${result.designStratumIndex + 1}`} />
        <Row label="Tipo de suelo" value={result.soilType === 'Coh' ? 'Cohesivo' : 'Friccionante'} accent />
        <Row label="φ" value={`${ds.phi}°`} />
        <Row label="c" value={`${ds.c} kPa`} />
        <Row label="γ" value={`${ds.gamma} kN/m³`} />
        <Row label="γsat" value={`${ds.gammaSat} kN/m³`} />
      </ResultSection>

      {/* Bearing factors */}
      <ResultSection title="Factores de Capacidad Portante">
        <Row label="Nc" value={bf.Nc.toFixed(2)} mono />
        <Row label="Nq" value={bf.Nq.toFixed(2)} mono />
        <Row label="Nγ" value={bf.Ngamma.toFixed(2)} mono />
      </ResultSection>

      {/* Overburden */}
      <ResultSection title="Sobrecarga y Correcciones">
        <Row label="q (sobrecarga)" value={`${result.q.toFixed(2)} kPa`} mono />
        <Row label="γ efectivo" value={`${result.gammaEffective.toFixed(2)} kN/m³`} mono />
        <Row label="Caso NF" value={WATER_CASE_LABELS[result.waterTableCase]} />
      </ResultSection>

      {/* Individual terms */}
      <ResultSection title="Términos Individuales">
        <Row label="Término 1 (F1)" value={result.F1.toFixed(2)} mono />
        <Row label="Término 2 (F2)" value={result.F2.toFixed(2)} mono />
        <Row label="Término 3 (F3)" value={result.F3.toFixed(2)} mono />
      </ResultSection>

      {/* Final results */}
      <ResultSection title="Capacidades Portantes" highlight>
        <Row label="qu (cap. última)" value={`${result.qu.toFixed(2)} kPa`} accent mono />
        <Row label="qneta (cap. neta última)" value={`${result.qnet.toFixed(2)} kPa`} mono />
        <Row label="qa (cap. admisible)" value={`${result.qa.toFixed(2)} kPa`} accent mono />
        <Row label="qa_neta (cap. neta admisible)" value={`${result.qaNet.toFixed(2)} kPa`} mono />
        <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
        <Row label="Q_max (carga máxima)" value={`${result.Qmax.toFixed(2)} kN`} accent mono />
      </ResultSection>

      {/* RNE Consideration */}
      {result.rneConsideration && (
        <ResultSection title="Consideración RNE">
          <Row label="qu RNE" value={`${result.rneConsideration.qultRNE.toFixed(2)} kPa`} mono />
          <Row label="qa RNE" value={`${result.rneConsideration.qadmRNE.toFixed(2)} kPa`} mono />
          <Row label="qu RNE corregido" value={`${result.rneConsideration.qultRNECorrected.toFixed(2)} kPa`} mono />
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
