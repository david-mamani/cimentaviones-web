/**
 * ResultsPanel — Full results view for workspace tab display.
 * Uses CSS variables for theme support.
 * Uses unitStore for dynamic unit labels and conversions.
 */
import { useFoundationStore } from '../../store/foundationStore';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';

const METHOD_LABELS: Record<string, string> = {
  terzaghi: 'Terzaghi Clásico',
  general: 'Ecuación General (Das)',
  rne: 'RNE E.050',
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

      {/* Resolución Paso a Paso */}
      {result.resolution_md && (
        <div style={{ marginTop: 12, padding: '0 12px 24px 12px' }}>
          <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.6, overflowX: 'auto', background: 'transparent', color: 'var(--text-primary)' }}>
            <ReactMarkdown 
              remarkPlugins={[remarkMath, remarkGfm]} 
              rehypePlugins={[rehypeKatex]}
            >
              {result.resolution_md}
            </ReactMarkdown>
          </div>
        </div>
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


