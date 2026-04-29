/**
 * CreditsModal — Modal overlay showing app credits and author info.
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
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#2a2a2a',
          border: '1px solid #505050',
          borderRadius: 10,
          padding: '28px 32px',
          width: 380,
          maxWidth: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          textAlign: 'center',
        }}
      >
        {/* App icon */}
        <div style={{
          width: 52, height: 52,
          background: '#c0392b',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 22, fontWeight: 800, color: '#fff',
        }}>
          CA
        </div>

        <h2 style={{
          fontSize: 18, fontWeight: 700, color: '#fff',
          marginBottom: 4,
        }}>
          CimentAviones Web
        </h2>
        <p style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>
          Versión 1.1 — Motor de Análisis Geotécnico
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          padding: '14px 16px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, color: '#ccc', marginBottom: 8, fontWeight: 600 }}>
            Desarrollado por
          </p>
          <p style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>
            {/* Placeholder — el usuario lo actualizará */}
            David Mamani
          </p>
          <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            Ingeniería Civil
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          padding: '14px 16px',
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 12, color: '#ccc', marginBottom: 6, fontWeight: 600 }}>
            Universidad
          </p>
          {/* Placeholder for university logo */}
          <div style={{
            width: 60, height: 60,
            background: '#3a3a3a',
            borderRadius: 6,
            margin: '0 auto 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#666',
          }}>
            LOGO
          </div>
          <p style={{ fontSize: 13, color: '#ccc' }}>
            Universidad Católica de Santa María
          </p>
          <p style={{ fontSize: 10, color: '#777', marginTop: 2 }}>
            Arequipa, Perú
          </p>
        </div>

        <div style={{ fontSize: 10, color: '#555', marginBottom: 16, lineHeight: 1.5 }}>
          Análisis de capacidad portante según Terzaghi, Meyerhof/Hansen (Das), y RNE E.050.
          <br />
          Visualización BIM con IFC2X3 • Gráficos con Plotly.js
        </div>

        <button
          onClick={onClose}
          style={{
            padding: '6px 24px',
            background: '#c0392b',
            border: 'none',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
