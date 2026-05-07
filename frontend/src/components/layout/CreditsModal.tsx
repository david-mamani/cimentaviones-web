/**
 * CreditsModal — Modal overlay showing app credits and author info.
 * Glassmorphism design.
 */

interface CreditsModalProps {
  onClose: () => void;
}

export default function CreditsModal({ onClose }: CreditsModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface-1)',
          border: '1px solid var(--border-active)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          width: 380,
          maxWidth: '90vw',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
        }}
      >
        {/* App icon */}
        <div style={{
          width: 52, height: 52,
          background: 'var(--accent)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 22, fontWeight: 800, color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
        }}>
          CA
        </div>

        <h2 style={{
          fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
          marginBottom: 4, fontFamily: 'var(--font-sans)',
        }}>
          CimentAviones Web
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Versión 1.1 — Motor de Análisis Geotécnico
        </p>

        <div style={{
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
            Desarrollado por
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
            David Mamani
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Ingeniería Civil
          </p>
        </div>

        <div style={{
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
            Universidad
          </p>
          <div style={{
            width: 60, height: 60,
            background: 'var(--bg-surface-3)',
            borderRadius: 'var(--radius-md)',
            margin: '0 auto 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: 'var(--text-muted)',
          }}>
            LOGO
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            Universidad Católica de Santa María
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
            Arequipa, Perú
          </p>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
          Análisis de capacidad portante según Terzaghi, Meyerhof/Hansen (Das), y RNE E.050.
          <br />
          Visualización BIM con IFC2X3 • Gráficos con Plotly.js
        </div>

        <button
          onClick={onClose}
          style={{
            padding: '6px 24px',
            background: 'var(--accent)',
            border: 'none',
            color: 'var(--bg-base)',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 20,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
