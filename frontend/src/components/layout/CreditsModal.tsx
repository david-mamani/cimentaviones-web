/**
 * CreditsModal — Modal overlay showing app credits and author info.
 * Glassmorphism design.
 */
import { useState, useEffect } from 'react';

interface CreditsModalProps {
  onClose: () => void;
}

export default function CreditsModal({ onClose }: CreditsModalProps) {
  const [isLight, setIsLight] = useState(() =>
    document.documentElement.classList.contains('light-mode')
  );
  useEffect(() => {
    const root = document.documentElement;
    const obs = new MutationObserver(() => setIsLight(root.classList.contains('light-mode')));
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const logoSrc = isLight ? '/assets/ucsm_logo_light.png' : '/assets/ucsm_logo_dark.png';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(43, 43, 43, 0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--lucid-surface-page)',
          border: '1px solid var(--lucid-rule-cream)',
          borderRadius: 6,
          padding: '32px 36px',
          width: 420,
          maxWidth: '90vw',
          textAlign: 'center',
        }}
      >
        <div style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--lucid-ink-muted)',
          marginBottom: 8,
        }}>
          Créditos
        </div>

        <h2 style={{
          fontFamily: 'var(--lucid-font-serif)',
          fontSize: 24, fontWeight: 700,
          color: 'var(--lucid-ink-strong)',
          marginBottom: 4,
          letterSpacing: '-0.01em',
        }}>
          Cimentaciones <em style={{ color: 'var(--lucid-acc-coral)', fontStyle: 'italic', fontWeight: 600 }}>Web</em>
        </h2>
        <p style={{
          fontFamily: 'var(--lucid-font-serif)',
          fontSize: 13, fontStyle: 'italic',
          color: 'var(--lucid-ink-muted)',
          marginBottom: 24,
        }}>
          Versión 1.1 — Motor de análisis geotécnico
        </p>

        <div style={{
          background: 'var(--lucid-surface-figure)',
          border: '1px solid var(--lucid-rule-cream)',
          borderRadius: 6,
          padding: '18px 20px',
          marginBottom: 14,
        }}>
          <p style={{
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 10, fontWeight: 600,
            color: 'var(--lucid-ink-muted)',
            textTransform: 'uppercase', letterSpacing: '0.12em',
            marginBottom: 10,
          }}>
            Desarrollado por
          </p>
          <p style={{
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 15, color: 'var(--lucid-ink-strong)',
            marginBottom: 4,
          }}>
            David Mamani
          </p>
          <p style={{
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 15, color: 'var(--lucid-ink-strong)',
          }}>
            Gaudy Platero
          </p>
          <p style={{
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 12, fontStyle: 'italic',
            color: 'var(--lucid-ink-muted)',
            marginTop: 6,
          }}>
            Ingeniería Civil
          </p>
        </div>

        <div style={{
          background: 'var(--lucid-surface-figure)',
          border: '1px solid var(--lucid-rule-cream)',
          borderRadius: 6,
          padding: '18px 20px',
          marginBottom: 20,
        }}>
          <p style={{
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 10, fontWeight: 600,
            color: 'var(--lucid-ink-muted)',
            textTransform: 'uppercase', letterSpacing: '0.12em',
            marginBottom: 10,
          }}>
            Universidad
          </p>
          <img
            src={logoSrc}
            alt="Universidad Católica de Santa María"
            style={{
              height: 60,
              width: 'auto',
              objectFit: 'contain',
              margin: '0 auto 10px',
              display: 'block',
            }}
          />
          <p style={{
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 14, color: 'var(--lucid-ink-strong)',
          }}>
            Universidad Católica de Santa María
          </p>
          <p style={{
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 12, fontStyle: 'italic',
            color: 'var(--lucid-ink-muted)',
            marginTop: 4,
          }}>
            Arequipa, Perú
          </p>
        </div>

        <p style={{
          fontFamily: 'var(--lucid-font-serif)',
          fontSize: 12, fontStyle: 'italic',
          color: 'var(--lucid-ink-muted)',
          marginBottom: 24,
          lineHeight: 1.5,
        }}>
          Análisis de capacidad portante según Terzaghi, Meyerhof/Hansen (Das) y RNE E.050.
          <br />
          Visualización BIM con IFC2X3 · gráficos con Plotly.js.
        </p>

        <button
          onClick={onClose}
          style={{
            padding: '8px 28px',
            background: 'var(--lucid-surface-page)',
            border: '1.5px solid var(--lucid-ink-strong)',
            color: 'var(--lucid-ink-strong)',
            fontSize: 14,
            fontFamily: 'var(--lucid-font-serif)',
            borderRadius: 999,
            cursor: 'pointer',
            transition: 'background 160ms cubic-bezier(0.4,0,0.2,1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--lucid-surface-figure)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--lucid-surface-page)'; }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
