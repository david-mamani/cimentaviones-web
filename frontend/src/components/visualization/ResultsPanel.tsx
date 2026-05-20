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
  terzaghi: 'Terzaghi clásico',
  general: 'Ecuación general (Das)',
  rne: 'RNE E.050',
};

export default function ResultsPanel() {
  const result = useFoundationStore((s) => s.result);
  if (!result) {
    return (
      <div style={{
        padding: '60px 24px',
        textAlign: 'center',
        fontFamily: 'var(--lucid-font-serif)',
        color: 'var(--lucid-ink-muted)',
        fontSize: 15,
        lineHeight: 1.6,
      }}>
        No hay resultados todavía. Presiona <strong style={{
          color: 'var(--lucid-ink-strong)', fontWeight: 600,
        }}>Calcular</strong> en la barra de herramientas para generar el análisis.
      </div>
    );
  }

  return (
    <div style={{
      background: '#fafaf7',
      minHeight: '100%',
      padding: '32px 40px 80px',
      overflow: 'auto',
    }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        {/* Eyebrow + Title */}
        <div style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--lucid-ink-muted)',
          marginBottom: 8,
        }}>
          Resultados del análisis
        </div>
        <h1 style={{
          fontFamily: 'var(--lucid-font-serif)',
          fontSize: 30, fontWeight: 700,
          lineHeight: 1.15, letterSpacing: '-0.012em',
          color: 'var(--lucid-ink-strong)',
          margin: '0 0 32px',
        }}>
          {METHOD_LABELS[result.method]?.split(' ')[0]}{' '}
          <em style={{
            color: 'var(--lucid-acc-coral)',
            fontStyle: 'italic', fontWeight: 600,
          }}>
            {METHOD_LABELS[result.method]?.split(' ').slice(1).join(' ') || ''}
          </em>
        </h1>

        {/* Resolución paso a paso (markdown del motor) */}
        {result.resolution_md && (
          <div className="markdown-body lucid-md" style={{
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 16,
            lineHeight: 1.6,
            color: 'var(--lucid-ink-body)',
            background: 'transparent',
            overflowX: 'auto',
          }}>
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
            >
              {result.resolution_md}
            </ReactMarkdown>
          </div>
        )}

        {/* Warnings — bloque Lucid con borde coral */}
        {result.warnings && result.warnings.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{
              fontFamily: 'var(--lucid-font-sans)',
              fontSize: 10, fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--lucid-ink-muted)',
              marginBottom: 10,
            }}>
              Advertencias ({result.warnings.length})
            </div>
            {result.warnings.map((w, i) => (
              <div key={i} style={{
                fontFamily: 'var(--lucid-font-serif)',
                fontSize: 14,
                color: 'var(--lucid-ink-body)',
                paddingLeft: 12,
                marginBottom: 8,
                borderLeft: '2px solid var(--lucid-acc-coral)',
                lineHeight: 1.5,
              }}>
                {w}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estilos específicos del markdown Lucid */}
      <style>{`
        .lucid-md h1, .lucid-md h2, .lucid-md h3, .lucid-md h4 {
          font-family: var(--lucid-font-serif);
          color: var(--lucid-ink-strong);
          font-weight: 600;
          letter-spacing: -0.01em;
          line-height: 1.25;
          border-bottom: none;
          margin: 32px 0 12px;
        }
        .lucid-md h1 { font-size: 28px; font-weight: 700; }
        .lucid-md h2 { font-size: 22px; }
        .lucid-md h3 { font-size: 18px; }
        .lucid-md h4 { font-size: 15px; }

        .lucid-md p { font-family: var(--lucid-font-serif); margin: 0 0 14px; }
        .lucid-md em { color: var(--lucid-ink-strong); }
        .lucid-md strong { color: var(--lucid-ink-strong); font-weight: 600; }

        .lucid-md a {
          color: var(--lucid-ink-body);
          text-decoration: none;
          border-bottom: 1px dotted var(--lucid-ink-muted);
        }
        .lucid-md a:hover { color: var(--lucid-acc-coral); border-color: var(--lucid-acc-coral); }

        .lucid-md hr {
          border: none;
          border-top: 1px solid var(--lucid-rule-white);
          margin: 32px 0;
        }

        .lucid-md code {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.92em;
          background: var(--lucid-surface-figure-deep);
          padding: 1px 5px;
          border-radius: 4px;
          color: var(--lucid-ink-strong);
        }
        .lucid-md pre {
          background: var(--lucid-surface-figure);
          border: 1px solid var(--lucid-rule-cream);
          border-radius: 6px;
          padding: 16px 20px;
        }
        .lucid-md pre code { background: transparent; padding: 0; }

        .lucid-md table {
          width: 100%;
          border-collapse: collapse;
          margin: 14px 0;
          background: #fff;
          border: 1px solid var(--lucid-rule-cream);
          border-radius: 6px;
          overflow: hidden;
        }
        .lucid-md table th {
          font-family: var(--lucid-font-sans);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--lucid-ink-strong);
          padding: 10px 14px;
          text-align: left;
          background: var(--lucid-surface-figure);
          border-bottom: 1px solid var(--lucid-rule-cream);
        }
        .lucid-md table td {
          padding: 10px 14px;
          font-family: var(--lucid-font-serif);
          font-size: 14px;
          color: var(--lucid-ink-body);
          border-bottom: 1px solid var(--lucid-rule-white);
          font-variant-numeric: tabular-nums;
        }
        .lucid-md table tr:last-child td { border-bottom: none; }

        .lucid-md blockquote {
          border-left: 2px solid var(--lucid-rule-cream);
          padding: 4px 18px;
          color: var(--lucid-ink-muted);
          font-style: italic;
          margin: 16px 0;
        }

        /* KaTeX display ecuaciones — eq-card Lucid */
        .lucid-md .katex-display {
          background: var(--lucid-surface-figure);
          border: 1px solid var(--lucid-rule-cream);
          border-radius: 6px;
          padding: 22px 28px;
          margin: 16px 0;
          overflow-x: auto;
        }
        .lucid-md .katex { font-size: 1.05em; }

        .lucid-md ul, .lucid-md ol {
          padding-left: 28px;
          margin: 0 0 14px;
        }
        .lucid-md li { margin-bottom: 6px; }
      `}</style>
    </div>
  );
}


