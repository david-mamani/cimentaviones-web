/**
 * FoundationDesignTab — Pestaña "Excentricidad".
 *
 * Convención del curso (profesor / RNE):
 *   - Eje 1 horizontal, eje 2 vertical.
 *   - B paralelo al eje 1, L paralelo al eje 2.
 *   - M1 = M_x sobre eje 1 → e1 = M1/Q → reduce L  → L' = L − 2·e1
 *   - M2 = M_y sobre eje 2 → e2 = M2/Q → reduce B  → B' = B − 2·e2
 *   - Swap final si B' > L' (B' siempre el menor).
 *
 * Layout:
 *   ┌─────────────────────────────┬──────────────────┐
 *   │                             │  Modo input      │
 *   │      FoundationPlanView     │  M / e           │
 *   │      con ejes 1, 2          │  (M1, M2, Q)     │
 *   │                             │  ó (e1, e2)      │
 *   │                             │  Outputs: B', L' │
 *   └─────────────────────────────┴──────────────────┘
 *
 * Geometría (Tipo, B, L, k, Df) y Carga (Q, β) viven en el panel izquierdo
 * (PropertiesPanel). Q también puede editarse aquí porque es necesaria
 * para derivar e = M/Q.
 */
import { useFoundationStore } from '../../store/foundationStore';
import CadNumericInput from '../common/CadNumericInput';
import FoundationPlanView from './FoundationPlanView';
import type { EffectiveAreaMethod } from '../../types/geotechnical';

export default function FoundationDesignTab() {
  const f = useFoundationStore((s) => s.foundation);
  const setParam = useFoundationStore((s) => s.setFoundationParam);
  const mode = useFoundationStore((s) => s.eccentricityInputMode);
  const setMode = useFoundationStore((s) => s.setEccentricityInputMode);

  // Vista en planta: usar siempre e1, e2 (sea que el usuario los haya
  // ingresado directamente o derivados de M/Q en modo "M").
  const Q = typeof f.Q === 'number' && f.Q > 0 ? f.Q : 0;
  const e1Computed =
    mode === 'M'
      ? (typeof f.M1 === 'number' && f.M1 > 0 && Q > 0 ? f.M1 / Q : 0)
      : (f.e1 ?? 0);
  const e2Computed =
    mode === 'M'
      ? (typeof f.M2 === 'number' && f.M2 > 0 && Q > 0 ? f.M2 / Q : 0)
      : (f.e2 ?? 0);

  // Magnitudes derivadas (antes del swap de capacidad)
  const Beff = f.B - 2 * e2Computed;
  const Leff = f.L - 2 * e1Computed;
  const swapped = Beff > Leff;
  const BeffFinal = swapped ? Leff : Beff;
  const LeffFinal = swapped ? Beff : Leff;

  const kernMetric =
    f.B > 0 && f.L > 0
      ? (6 * e1Computed) / f.L + (6 * e2Computed) / f.B
      : 0;
  const inKern = kernMetric <= 1 + 1e-9;
  const hasEccentricity = e1Computed > 0 || e2Computed > 0;

  const needsQForM = mode === 'M' && Q <= 0 && (
    (typeof f.M1 === 'number' && f.M1 > 0) ||
    (typeof f.M2 === 'number' && f.M2 > 0)
  );

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      background: 'var(--lucid-surface-page-warm)',
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
          background: 'var(--lucid-surface-page)',
        }}>
          Vista en planta — ejes 1 / 2
        </div>
        <div style={{ flex: 1, padding: 24, minHeight: 0, background: 'var(--lucid-surface-page-warm)' }}>
          <FoundationPlanView
            B={f.B}
            L={f.L}
            e1={e1Computed}
            e2={e2Computed}
          />
        </div>
      </div>

      {/* ─── Lado derecho: inputs de excentricidad ─── */}
      <div style={{
        width: 360,
        flexShrink: 0,
        overflowY: 'auto',
        background: 'var(--lucid-surface-page)',
      }}>
        {/* ─ Modo de input ─ */}
        <SectionTitle>Modo de entrada</SectionTitle>
        <SectionBody>
          <div style={{
            display: 'flex',
            background: 'var(--lucid-surface-figure)',
            border: '1px solid var(--lucid-rule-cream)',
            borderRadius: 4,
            padding: 2,
            gap: 2,
          }}>
            <ModeBtn active={mode === 'M'} onClick={() => setMode('M')}>
              Momentos (M₁, M₂)
            </ModeBtn>
            <ModeBtn active={mode === 'e'} onClick={() => setMode('e')}>
              Excentricidad (e₁, e₂)
            </ModeBtn>
          </div>
          <Note>
            Convención: <b>e₁ = M₁/Q</b> reduce <b>L</b> (eje 1 horizontal);
            {' '}<b>e₂ = M₂/Q</b> reduce <b>B</b> (eje 2 vertical).
          </Note>
        </SectionBody>

        {/* ─ Inputs: M ó e ─ */}
        <SectionTitle>Excentricidad</SectionTitle>
        <SectionBody>
          {mode === 'M' ? (
            <>
              <Row label="M₁ (tnf·m)">
                <CadNumericInput
                  value={f.M1 ?? 0}
                  step={0.1}
                  min={0}
                  onChange={(v) => setParam('M1', v > 0 ? v : null)}
                />
              </Row>
              <Row label="M₂ (tnf·m)">
                <CadNumericInput
                  value={f.M2 ?? 0}
                  step={0.1}
                  min={0}
                  onChange={(v) => setParam('M2', v > 0 ? v : null)}
                />
              </Row>
              <Row label="Q (tnf)">
                <CadNumericInput
                  value={f.Q ?? 0}
                  step={1}
                  min={0}
                  onChange={(v) => setParam('Q', v > 0 ? v : null)}
                />
              </Row>
              {needsQForM && (
                <Note variant="warn">
                  Se requiere Q &gt; 0 para derivar las excentricidades a partir de los momentos.
                </Note>
              )}
            </>
          ) : (
            <>
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
              <Row label="Q (tnf)">
                <CadNumericInput
                  value={f.Q ?? 0}
                  step={1}
                  min={0}
                  onChange={(v) => setParam('Q', v > 0 ? v : null)}
                />
              </Row>
            </>
          )}
        </SectionBody>

        {/* ─ Método del área efectiva ─ */}
        <SectionTitle>Método del área efectiva</SectionTitle>
        <SectionBody>
          <div style={{
            display: 'flex',
            background: 'var(--lucid-surface-figure)',
            border: '1px solid var(--lucid-rule-cream)',
            borderRadius: 4,
            padding: 2,
            gap: 2,
          }}>
            <ModeBtn
              active={(f.metodo_area ?? 'rne') === 'rne'}
              onClick={() => setParam('metodo_area', 'rne' as EffectiveAreaMethod)}
            >
              RNE / Meyerhof
            </ModeBtn>
            <ModeBtn
              active={(f.metodo_area ?? 'rne') === 'highter_anders'}
              onClick={() => setParam('metodo_area', 'highter_anders' as EffectiveAreaMethod)}
            >
              Highter & Anders
            </ModeBtn>
          </div>
          <Note>
            <b>RNE/Meyerhof</b>: B' = B − 2e₂, L' = L − 2e₁ + swap.<br />
            <b>Highter & Anders (1985)</b>: 4 casos según (eL/L, eB/B). Casos II/III/IV requieren
            tablas digitalizadas (pendientes); el motor hace fallback automático a RNE con warning.
          </Note>
        </SectionBody>

        {/* ─ Outputs derivados ─ */}
        <SectionTitle>Resultado</SectionTitle>
        <SectionBody>
          <KV label="e₁" value={`${e1Computed.toFixed(3)} m`} hint="reduce L" />
          <KV label="e₂" value={`${e2Computed.toFixed(3)} m`} hint="reduce B" />
          <KV
            label="B − 2·e₂"
            value={`${Beff.toFixed(3)} m`}
            hint="dim. reducida en dirección B"
          />
          <KV
            label="L − 2·e₁"
            value={`${Leff.toFixed(3)} m`}
            hint="dim. reducida en dirección L"
          />
          <KV
            label="B' (cálculo)"
            value={`${BeffFinal.toFixed(3)} m`}
            hint={swapped ? 'tras swap (B′ ≤ L′)' : 'sin swap'}
            strong
          />
          <KV
            label="L' (cálculo)"
            value={`${LeffFinal.toFixed(3)} m`}
            strong
          />
          <KV
            label="A' = B'·L'"
            value={`${(BeffFinal * LeffFinal).toFixed(3)} m²`}
            strong
          />

          {hasEccentricity && (
            <>
              <KV
                label="6·e₁/L + 6·e₂/B"
                value={kernMetric.toFixed(3)}
                hint={inKern ? '≤ 1 → dentro del rombo del kern' : '> 1 → fuera del kern'}
              />
              {!inKern && (
                <Note variant="warn">
                  Excentricidad fuera del kern central (rombo): se produce
                  levantamiento. Régimen triangular.
                </Note>
              )}
              {e1Computed > f.L / 6 && (
                <Note variant="warn">
                  e₁ &gt; L/6 ({(f.L / 6).toFixed(3)} m)
                </Note>
              )}
              {e2Computed > f.B / 6 && (
                <Note variant="warn">
                  e₂ &gt; B/6 ({(f.B / 6).toFixed(3)} m)
                </Note>
              )}
            </>
          )}
        </SectionBody>
      </div>
    </div>
  );
}

/* ────────── Sub-componentes ────────── */

function ModeBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '6px 8px',
        background: active ? 'var(--lucid-surface-page)' : 'transparent',
        boxShadow: active ? '0 0 0 1px var(--lucid-rule-cream) inset' : 'none',
        border: 'none',
        borderRadius: 3,
        color: active ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-body)',
        fontSize: 12,
        fontFamily: 'var(--lucid-font-serif)',
        cursor: 'pointer',
        transition: 'all 160ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {children}
    </button>
  );
}

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
        minWidth: 90,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function KV({
  label, value, hint, strong,
}: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 10,
      padding: '4px 0',
      borderBottom: '1px dashed var(--lucid-rule-white)',
    }}>
      <span style={{
        fontFamily: 'var(--lucid-font-serif)',
        fontSize: 12,
        color: 'var(--lucid-ink-body)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--lucid-font-mono, var(--font-mono, monospace))',
        fontSize: strong ? 13 : 12,
        fontWeight: strong ? 600 : 400,
        color: strong ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-body)',
        textAlign: 'right',
      }}>
        {value}
        {hint && (
          <span style={{
            display: 'block',
            fontSize: 10,
            color: 'var(--lucid-ink-muted)',
            fontFamily: 'var(--lucid-font-sans)',
            fontWeight: 400,
            fontStyle: 'italic',
          }}>
            {hint}
          </span>
        )}
      </span>
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
        border: '1px solid var(--lucid-acc-coral-border)',
        borderRadius: 4,
        fontFamily: 'var(--lucid-font-serif)',
        fontSize: 12,
        lineHeight: 1.5,
        color: 'var(--lucid-acc-coral-text)',
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
