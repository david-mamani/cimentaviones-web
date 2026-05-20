/**
 * FoundationDesignTab — Vista dedicada para diseñar la cimentación.
 *
 * Layout:
 *   ┌─────────────────────────────┬──────────────────┐
 *   │                             │  Geometría       │
 *   │      FoundationPlanView     │  Carga           │
 *   │      (SVG en planta)        │  Excentricidad   │
 *   │                             │                  │
 *   └─────────────────────────────┴──────────────────┘
 *
 * Todos los inputs están sincronizados con el store global; al editar aquí,
 * también se reflejan en el panel izquierdo.
 */
import { useFoundationStore } from '../../store/foundationStore';
import CadNumericInput from '../common/CadNumericInput';
import FoundationPlanView from './FoundationPlanView';

export default function FoundationDesignTab() {
  const f = useFoundationStore((s) => s.foundation);
  const setParam = useFoundationStore((s) => s.setFoundationParam);
  const lbLocked = useFoundationStore((s) => s.lbLocked);
  const lbRatio = useFoundationStore((s) => s.lbRatio);
  const setLbLocked = useFoundationStore((s) => s.setLbLocked);
  const setLbRatio = useFoundationStore((s) => s.setLbRatio);
  const method = useFoundationStore((s) => s.method);

  const isRectangular = f.type === 'rectangular';
  const isCircular = f.type === 'circular';
  const betaDisabled = method === 'terzaghi';

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      background: '#fafaf7',
      overflow: 'hidden',
    }}>
      {/* ─── Lado izquierdo: vista en planta ─── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        borderRight: '1px solid var(--lucid-rule-white)',
      }}>
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--lucid-rule-white)',
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.10em',
          color: 'var(--lucid-ink-strong)',
          background: '#fff',
        }}>
          Vista en planta
        </div>
        <div style={{ flex: 1, padding: 24, minHeight: 0, background: '#fafaf7' }}>
          <FoundationPlanView
            B={f.B}
            L={isCircular ? f.B : f.L}
            e1={f.e1 || 0}
            e2={f.e2 || 0}
          />
        </div>
      </div>

      {/* ─── Lado derecho: inputs ─── */}
      <div style={{
        width: 360,
        flexShrink: 0,
        overflowY: 'auto',
        background: 'var(--lucid-surface-page)',
      }}>
        {/* ─ Geometría ─ */}
        <SectionTitle>Geometría</SectionTitle>
        <SectionBody>
          <Row label="Tipo">
            <select
              value={f.type}
              onChange={(e) => setParam('type', e.target.value as typeof f.type)}
              style={selectStyle}
            >
              <option value="cuadrada">Cuadrada</option>
              <option value="rectangular">Rectangular</option>
            </select>
          </Row>
          <Row label="B (m)">
            <CadNumericInput value={f.B} step={0.1} min={0}
              onChange={(v) => setParam('B', v)} />
          </Row>
          <Row label="L (m)">
            <CadNumericInput
              value={f.L}
              step={0.1}
              min={0}
              onChange={(v) => setParam('L', v)}
              disabled={!isRectangular || lbLocked}
            />
          </Row>

          {isRectangular && (
            <>
              <label style={checkRow}>
                <input
                  type="checkbox"
                  className="cad-checkbox"
                  checked={lbLocked}
                  onChange={(e) => setLbLocked(e.target.checked)}
                />
                L = k × B
              </label>
              {lbLocked && (
                <Row label="k (L/B)">
                  <CadNumericInput value={lbRatio} step={0.1} min={1}
                    onChange={(v) => setLbRatio(v)} />
                </Row>
              )}
            </>
          )}

          <Row label="Df (m)">
            <CadNumericInput value={f.Df} step={0.1} min={0}
              onChange={(v) => setParam('Df', v)} />
          </Row>
        </SectionBody>

        {/* ─ Carga aplicada ─ */}
        <SectionTitle>Carga</SectionTitle>
        <SectionBody>
          <Row label="Q (tnf)">
            <CadNumericInput
              value={f.Q ?? 0}
              step={1}
              min={0}
              onChange={(v) => setParam('Q', v > 0 ? v : null)}
            />
          </Row>
          <Row label="β (°)">
            <CadNumericInput
              value={f.beta}
              step={1}
              min={0}
              onChange={(v) => setParam('beta', v)}
              disabled={betaDisabled}
            />
          </Row>
          {betaDisabled && (
            <Note>Terzaghi no usa β (factores de inclinación). Use Ec. General o RNE.</Note>
          )}
        </SectionBody>

        {/* ─ Excentricidad ─ */}
        <SectionTitle>Excentricidad</SectionTitle>
        <SectionBody>
          <Row label="e₁ (m)">
            <CadNumericInput
              value={f.e1 ?? 0}
              step={0.05}
              min={0}
              onChange={(v) => setParam('e1', v)}
            />
          </Row>
          <Row label="e₂ (m)">
            <CadNumericInput
              value={f.e2 ?? 0}
              step={0.05}
              min={0}
              onChange={(v) => setParam('e2', v)}
            />
          </Row>
          <Note>
            B' = B − 2·e₁ = {(f.B - 2 * (f.e1 ?? 0)).toFixed(3)} m<br />
            L' = L − 2·e₂ = {(f.L - 2 * (f.e2 ?? 0)).toFixed(3)} m
          </Note>
          {f.e1 != null && f.e1 > f.B / 6 && (
            <Note variant="warn">
              e₁ &gt; B/6 ({(f.B / 6).toFixed(3)} m): fuera del kern → distribución triangular
            </Note>
          )}
          {f.e2 != null && f.e2 > f.L / 6 && (
            <Note variant="warn">
              e₂ &gt; L/6 ({(f.L / 6).toFixed(3)} m): fuera del kern → distribución triangular
            </Note>
          )}
        </SectionBody>
      </div>
    </div>
  );
}

/* ────────── Sub-componentes ────────── */

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: '#fff',
  border: '1px solid var(--lucid-rule-cream)',
  borderRadius: 3,
  color: 'var(--lucid-ink-strong)',
  fontSize: 14,
  fontFamily: 'var(--lucid-font-serif)',
  cursor: 'pointer',
};

const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: 'var(--lucid-font-sans)',
  fontSize: 12,
  cursor: 'pointer',
  color: 'var(--lucid-ink-body)',
  marginBottom: 8,
  padding: '4px 0',
  userSelect: 'none',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 18px',
      borderTop: '1px solid var(--lucid-rule-white)',
      fontFamily: 'var(--lucid-font-sans)',
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.10em',
      color: 'var(--lucid-ink-strong)',
      background: 'var(--lucid-surface-page)',
    }}>
      {children}
    </div>
  );
}

function SectionBody({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '8px 18px 16px' }}>{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    }}>
      <span style={{
        fontFamily: 'var(--lucid-font-serif)',
        fontSize: 14,
        color: 'var(--lucid-ink-body)',
        minWidth: 80,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Note({ children, variant }: { children: React.ReactNode; variant?: 'warn' }) {
  if (variant === 'warn') {
    return (
      <div style={{
        marginTop: 8,
        padding: '8px 12px',
        background: 'var(--lucid-tint-coral)',
        border: '1px solid #efd9cd',
        borderRadius: 4,
        fontFamily: 'var(--lucid-font-serif)',
        fontSize: 12,
        lineHeight: 1.5,
        color: '#b5563f',
      }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{
      marginTop: 8,
      fontFamily: 'var(--lucid-font-serif)',
      fontSize: 12,
      lineHeight: 1.5,
      color: 'var(--lucid-ink-muted)',
      fontStyle: 'italic',
    }}>
      {children}
    </div>
  );
}
