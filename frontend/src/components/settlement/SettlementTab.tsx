/**
 * SettlementTab — Pestaña dedicada "Asentamientos".
 *
 * Convención del curso (Das §9 + RNE E.050), MOTOR_ASENTAMIENTOS.md:
 *   - z̄ = min(H, 5·B); Es_eq promedio ponderado por espesor
 *   - μ del estrato bajo la base (NO se promedia)
 *   - Steinbrenner Is con fix arctan; Is = F1 si μ=0.5
 *   - Fox If interpolado del ábaco Das Fig. 9.6
 *   - Cw: Peck/Teng/Bowles; Cw=2 si Dw ≤ Df
 *   - q₀ NETA: qadm_asent = NETA
 *   - rigid + esquina ⇒ forzar centro
 *   - qadm_diseño = min(qadm_falla, qadm_asent)
 *
 * Layout:
 *   ┌──────────────────────────────────────┬──────────────────────┐
 *   │  Perfil del suelo  /  qadm(B)        │  Inputs + outputs    │
 *   │  (toggle en cabecera)                │  + botón "Calcular"  │
 *   └──────────────────────────────────────┴──────────────────────┘
 */
import { useState } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import CadNumericInput from '../common/CadNumericInput';
import { ArrowDownToLine, Play, Loader2 } from 'lucide-react';
import type { SettlementPoint, CwMethod } from '../../types/geotechnical';

const G = 9.80665;  // tnf → kN

export default function SettlementTab() {
  const f = useFoundationStore((s) => s.foundation);
  const strata = useFoundationStore((s) => s.strata);
  const conditions = useFoundationStore((s) => s.conditions);
  const result = useFoundationStore((s) => s.result);
  const settlementParams = useFoundationStore((s) => s.settlementParams);
  const setSettlementParam = useFoundationStore((s) => s.setSettlementParam);
  const settlementResult = useFoundationStore((s) => s.settlementResult);
  const settlementIteration = useFoundationStore((s) => s.settlementIteration);
  const isCalculating = useFoundationStore((s) => s.isCalculatingSettlement);
  const calculateSettlement = useFoundationStore((s) => s.calculateSettlement);
  const calculateSettlementIteration = useFoundationStore(
    (s) => s.calculateSettlementIteration,
  );

  const [viewMode, setViewMode] = useState<'perfil' | 'qadm'>('perfil');
  const [iterRange, setIterRange] = useState({ B_start: 1.0, B_end: 3.0, B_step: 0.2 });

  const Ds = conditions.hasBasement ? conditions.basementDepth : 0;
  const Df_abs = f.Df + Ds;

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      background: 'var(--lucid-surface-page-warm)',
      overflow: 'hidden',
    }}>
      {/* ─── Izquierda: visualización ─── */}
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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowDownToLine size={14} style={{ color: 'var(--lucid-acc-coral)' }} />
            Asentamientos — {viewMode === 'perfil' ? 'perfil del suelo' : 'qadm(B)'}
          </span>
          <div style={{
            display: 'flex',
            background: 'var(--lucid-surface-figure)',
            border: '1px solid var(--lucid-rule-cream)',
            borderRadius: 4,
            padding: 2,
            gap: 2,
          }}>
            <ViewBtn active={viewMode === 'perfil'} onClick={() => setViewMode('perfil')}>Perfil</ViewBtn>
            <ViewBtn active={viewMode === 'qadm'} onClick={() => setViewMode('qadm')}>qadm(B)</ViewBtn>
          </div>
        </div>
        <div style={{
          flex: 1, padding: 24, minHeight: 0, overflow: 'auto',
          background: 'var(--lucid-surface-page-warm)',
        }}>
          {viewMode === 'perfil' ? (
            <ProfileView
              strata={strata}
              Df_abs={Df_abs}
              hasWaterTable={conditions.hasWaterTable}
              Dw={conditions.waterTableDepth}
              B={f.B}
              z_bar={settlementResult?.z_bar ?? Math.min(5 * f.B, totalDepth(strata) - Df_abs)}
              H={settlementResult?.H ?? null}
              H_auto={settlementResult?.H_auto_detected ?? true}
            />
          ) : (
            <QadmChart
              iteration={settlementIteration}
              onRun={() => calculateSettlementIteration(iterRange.B_start, iterRange.B_end, iterRange.B_step)}
              range={iterRange}
              setRange={setIterRange}
            />
          )}
        </div>
      </div>

      {/* ─── Derecha: inputs + outputs ─── */}
      <div style={{
        width: 360,
        flexShrink: 0,
        overflowY: 'auto',
        background: 'var(--lucid-surface-page)',
      }}>
        <SectionTitle>Modo de análisis</SectionTitle>
        <SectionBody>
          <Row label="Punto">
            <div style={pillGroupStyle}>
              <ModeBtn active={settlementParams.point === 'centro'} onClick={() => setSettlementParam('point', 'centro' as SettlementPoint)}>Centro</ModeBtn>
              <ModeBtn active={settlementParams.point === 'esquina'} onClick={() => setSettlementParam('point', 'esquina' as SettlementPoint)}>Esquina</ModeBtn>
            </div>
          </Row>
          <Row label="Rigidez">
            <div style={pillGroupStyle}>
              <ModeBtn active={!settlementParams.rigid} onClick={() => setSettlementParam('rigid', false)}>Flexible</ModeBtn>
              <ModeBtn active={settlementParams.rigid} onClick={() => setSettlementParam('rigid', true)}>Rígida (×0.93)</ModeBtn>
            </div>
          </Row>
          <Row label="Cw">
            <select
              value={settlementParams.Cw_method}
              onChange={(e) => setSettlementParam('Cw_method', e.target.value as CwMethod)}
              style={selectStyle}
            >
              <option value="peck">Peck-Hansen-Thornburn</option>
              <option value="teng">Teng (1982)</option>
              <option value="bowles">Bowles (1977)</option>
              <option value="off">Desactivado</option>
            </select>
          </Row>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              className="cad-checkbox"
              checked={settlementParams.consolidation}
              onChange={(e) => setSettlementParam('consolidation', e.target.checked)}
            />
            Sumar consolidación (Sc) en arcillas
          </label>
        </SectionBody>

        <SectionTitle>Límites</SectionTitle>
        <SectionBody>
          <Row label="S_max (mm)">
            <CadNumericInput
              value={settlementParams.S_max * 1000}
              step={5}
              min={0}
              onChange={(v) => setSettlementParam('S_max', v / 1000)}
            />
          </Row>
          <Row label="H rígido (m)">
            <CadNumericInput
              value={settlementParams.H_rigid ?? 0}
              step={0.5}
              min={0}
              onChange={(v) => setSettlementParam('H_rigid', v > 0 ? v : null)}
            />
          </Row>
          {!settlementParams.H_rigid && settlementResult && (
            <Note>
              H = {settlementResult.H.toFixed(2)} m
              {' '}{settlementResult.H_auto_detected ? '(auto-detectado, Es ≥ 10·Es_arriba)' : '(no se halló rígido → 5B)'}
            </Note>
          )}
          <Row label="μ override">
            <CadNumericInput
              value={settlementParams.mu_s_override ?? 0}
              step={0.05}
              min={0}
              onChange={(v) => setSettlementParam('mu_s_override', v > 0 ? v : null)}
            />
          </Row>
        </SectionBody>

        <SectionTitle>Geometría / carga</SectionTitle>
        <SectionBody>
          <KV label="B" value={`${f.B.toFixed(3)} m`} />
          <KV label="L" value={`${f.L.toFixed(3)} m`} />
          <KV label="Df_abs" value={`${Df_abs.toFixed(3)} m`} />
          <KV
            label="Q aplicada"
            value={f.Q ? `${f.Q.toFixed(2)} tnf (${(f.Q * G).toFixed(1)} kN)` : '—'}
          />
          {result?.qa != null && (
            <KV label="qa (falla, kPa)" value={`${result.qa.toFixed(1)} kPa`} hint="del bloque de capacidad" />
          )}
        </SectionBody>

        {/* Botón Calcular */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--lucid-rule-white)' }}>
          <button
            onClick={() => calculateSettlement()}
            disabled={isCalculating}
            style={{
              width: '100%', padding: '10px 12px',
              background: isCalculating ? 'var(--lucid-surface-figure)' : 'var(--lucid-acc-coral)',
              color: isCalculating ? 'var(--lucid-ink-muted)' : 'white',
              border: 'none', borderRadius: 4,
              fontFamily: 'var(--lucid-font-sans)',
              fontSize: 13, fontWeight: 600,
              cursor: isCalculating ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isCalculating ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
            {isCalculating ? 'Calculando…' : 'Calcular asentamiento'}
          </button>
        </div>

        {/* Resultado del backend */}
        {settlementResult && (
          <>
            <SectionTitle>Resultado</SectionTitle>
            <SectionBody>
              <KV label="z̄ = min(H, 5B)" value={`${settlementResult.z_bar.toFixed(3)} m`} />
              <KV label="H" value={`${settlementResult.H.toFixed(3)} m`}
                  hint={settlementResult.H_auto_detected ? 'auto-detectado' : 'manual'} />
              <KV label="Es_eq" value={`${settlementResult.Es_eq.toFixed(0)} kPa`} />
              <KV label="μ usado" value={settlementResult.mu_used.toFixed(3)}
                  hint={settlementResult.mu_source} />
              <KV label="Cw" value={settlementResult.Cw.toFixed(3)}
                  hint={settlementResult.Cw_label} />

              {settlementResult.elastic && (
                <>
                  <hr style={dividerStyle} />
                  <KV label="α" value={String(settlementResult.elastic.alpha)} />
                  <KV label="B_used" value={`${settlementResult.elastic.B_used.toFixed(3)} m`} />
                  <KV label="Is" value={settlementResult.elastic.Is.toFixed(4)}
                      hint={settlementResult.elastic.arctan_correction_applied ? 'arctan corregido' : undefined} />
                  <KV label="If (Fox)" value={settlementResult.elastic.If.toFixed(4)}
                      hint={settlementResult.elastic.If_out_of_range ? 'fuera de rango (clamped)' : undefined} />
                </>
              )}

              {settlementResult.Se_corr_mm != null && (
                <>
                  <hr style={dividerStyle} />
                  <KV label="Se (puro)" value={`${(settlementResult.Se_mm ?? 0).toFixed(2)} mm`} />
                  <KV label="Se·Cw" value={`${settlementResult.Se_corr_mm.toFixed(2)} mm`} />
                  {settlementResult.Sc_mm != null && (
                    <KV label="Sc (consol.)" value={`${settlementResult.Sc_mm.toFixed(2)} mm`} />
                  )}
                  <KV
                    label="S_total"
                    value={`${(settlementResult.S_total_mm ?? 0).toFixed(2)} mm`}
                    strong
                    hint={settlementResult.Se_ok ? `≤ S_max=${settlementResult.S_max_mm.toFixed(0)} mm ✓` : `> S_max=${settlementResult.S_max_mm.toFixed(0)} mm ✗`}
                  />
                </>
              )}

              <hr style={dividerStyle} />
              <KV label="qadm asent." value={`${settlementResult.qadm_settlement.toFixed(1)} kPa`} hint="NETA" strong />
              {settlementResult.qadm_falla != null && (
                <KV label="qadm falla" value={`${settlementResult.qadm_falla.toFixed(1)} kPa`} hint="del bloque de capacidad" />
              )}
              {settlementResult.design && (
                <KV
                  label="qadm diseño"
                  value={`${settlementResult.design.qadm_diseno.toFixed(1)} kPa`}
                  strong
                  hint={`gobierna: ${settlementResult.design.criterio_gobernante}`}
                />
              )}
              {settlementResult.FS_real_falla != null && (
                <KV label="FS real (falla)" value={settlementResult.FS_real_falla.toFixed(2)} hint="qadm_falla / q_aplicada" />
              )}
            </SectionBody>

            {settlementResult.warnings.length > 0 && (
              <SectionBody>
                <Note variant="warn">
                  {settlementResult.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                </Note>
              </SectionBody>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Visualizaciones
 * ────────────────────────────────────────────────────────────────── */

function totalDepth(strata: any[]): number {
  return strata.reduce((s, x) => s + x.thickness, 0);
}

interface ProfileViewProps {
  strata: any[];
  Df_abs: number;
  hasWaterTable: boolean;
  Dw: number;
  B: number;
  z_bar: number;
  H: number | null;
  H_auto: boolean;
}

function ProfileView({ strata, Df_abs, hasWaterTable, Dw, B, z_bar, H, H_auto }: ProfileViewProps) {
  const td = Math.max(totalDepth(strata), Df_abs + z_bar + 1);
  const widthM = Math.max(B * 2.5, 4);
  const margin = 0.6;
  const vbX = -widthM / 2 - margin;
  const vbY = -margin;
  const vbW = widthM + 2 * margin;
  const vbH = td + 2 * margin;

  const colors = ['#dcd0a8', '#c8b482', '#a99366', '#876d4a', '#634d33', '#3f2f1e'];
  const tops: number[] = [];
  {
    let d = 0;
    for (const s of strata) { tops.push(d); d += s.thickness; }
  }

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {strata.map((s, i) => {
        const top = tops[i];
        return (
          <g key={i}>
            <rect
              x={-widthM / 2} y={top} width={widthM} height={s.thickness}
              fill={colors[i % colors.length]} opacity={0.5}
              stroke="var(--text-secondary)" strokeWidth={0.005 * widthM}
            />
            <text
              x={-widthM / 2 + 0.1}
              y={top + s.thickness / 2 + 0.05}
              fontSize={widthM * 0.04}
              fill="var(--text-secondary)"
              fontFamily="var(--font-mono, monospace)"
            >
              Estrato {i + 1}{typeof s.Es === 'number' ? ` · Es=${s.Es.toFixed(0)} t/m²` : ''}
            </text>
          </g>
        );
      })}

      {z_bar > 0 && (
        <rect
          x={-B / 2} y={Df_abs} width={B} height={z_bar}
          fill="rgba(255, 140, 0, 0.12)"
          stroke="var(--accent, #ff8c00)"
          strokeWidth={0.008 * widthM}
          strokeDasharray={`${0.04 * widthM} ${0.02 * widthM}`}
        />
      )}

      <rect
        x={-B / 2} y={Df_abs} width={B} height={0.5}
        fill="rgba(60, 60, 60, 0.35)"
        stroke="var(--text-strong, black)"
        strokeWidth={0.008 * widthM}
      />

      <line
        x1={-widthM / 2 - margin * 0.3} y1={Df_abs}
        x2={widthM / 2 + margin * 0.3} y2={Df_abs}
        stroke="var(--text-secondary)" strokeWidth={0.006 * widthM}
        strokeDasharray={`${0.03 * widthM} ${0.02 * widthM}`}
      />
      <text x={widthM / 2 + margin * 0.35} y={Df_abs + 0.05} fontSize={widthM * 0.04}
            fill="var(--text-secondary)" fontFamily="var(--font-mono, monospace)">
        Df_abs = {Df_abs.toFixed(2)} m
      </text>

      {hasWaterTable && (
        <>
          <line x1={-widthM / 2} y1={Dw} x2={widthM / 2} y2={Dw}
                stroke="#3a87cf" strokeWidth={0.008 * widthM} />
          <text x={-widthM / 2 - margin * 0.2} y={Dw + 0.05} fontSize={widthM * 0.04}
                fill="#3a87cf" fontFamily="var(--font-mono, monospace)" textAnchor="end">
            NF
          </text>
        </>
      )}

      {H != null && (
        <>
          <line
            x1={-widthM / 2} y1={Df_abs + H}
            x2={widthM / 2} y2={Df_abs + H}
            stroke="#c93c3c" strokeWidth={0.008 * widthM}
            strokeDasharray={`${0.04 * widthM} ${0.03 * widthM}`}
          />
          <text x={widthM / 2 + margin * 0.35} y={Df_abs + H + 0.05}
                fontSize={widthM * 0.04} fill="#c93c3c"
                fontFamily="var(--font-mono, monospace)">
            H {H_auto ? '(auto)' : '(manual)'} = {H.toFixed(2)} m
          </text>
        </>
      )}
    </svg>
  );
}

function QadmChart({
  iteration, onRun, range, setRange,
}: {
  iteration: any | null;
  onRun: () => void;
  range: { B_start: number; B_end: number; B_step: number };
  setRange: (r: any) => void;
}) {
  const rows = iteration?.rows ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: 12,
        background: 'var(--lucid-surface-page)',
        border: '1px solid var(--lucid-rule-white)',
        borderRadius: 4,
      }}>
        <RangeInput label="B inicio (m)" value={range.B_start}
                    onChange={(v) => setRange({ ...range, B_start: v })} />
        <RangeInput label="B fin (m)" value={range.B_end}
                    onChange={(v) => setRange({ ...range, B_end: v })} />
        <RangeInput label="Paso (m)" value={range.B_step}
                    onChange={(v) => setRange({ ...range, B_step: v })} />
        <button
          onClick={onRun}
          style={{
            padding: '8px 14px',
            background: 'var(--lucid-acc-coral)',
            color: 'white',
            border: 'none', borderRadius: 4,
            fontFamily: 'var(--lucid-font-sans)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Play size={12} /> Iterar
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--lucid-surface-page)', borderRadius: 4 }}>
        {rows.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--lucid-ink-muted)',
            fontFamily: 'var(--lucid-font-serif)',
            fontStyle: 'italic',
            fontSize: 13,
          }}>
            Sin iteración aún — haz clic en "Iterar" arriba.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--lucid-surface-figure)' }}>
              <tr>
                <Th>B (m)</Th>
                <Th>z̄ (m)</Th>
                <Th>Es_eq (kPa)</Th>
                <Th>Cw</Th>
                <Th>qadm asent (kPa)</Th>
                <Th>qadm falla (kPa)</Th>
                <Th>qadm diseño (kPa)</Th>
                <Th>gobierna</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--lucid-rule-white)' }}>
                  <Td>{r.B.toFixed(2)}</Td>
                  <Td>{r.z_bar.toFixed(2)}</Td>
                  <Td>{r.Es_eq.toFixed(0)}</Td>
                  <Td>{r.Cw.toFixed(2)}</Td>
                  <Td>{r.qadm_settlement.toFixed(1)}</Td>
                  <Td>{r.qadm_falla != null ? r.qadm_falla.toFixed(1) : '—'}</Td>
                  <Td><strong>{r.qadm_diseno != null ? r.qadm_diseno.toFixed(1) : '—'}</strong></Td>
                  <Td>{r.criterio_gobernante ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RangeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--lucid-ink-muted)' }}>
      <span style={{ fontFamily: 'var(--lucid-font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <CadNumericInput value={value} step={0.1} min={0} onChange={onChange} />
    </label>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--lucid-ink-strong)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</th>
);
const Td = ({ children }: { children: React.ReactNode }) => (
  <td style={{ padding: '5px 8px', color: 'var(--lucid-ink-body)' }}>{children}</td>
);

/* ──────────────────────────────────────────────────────────────────
 * UI helpers
 * ────────────────────────────────────────────────────────────────── */

const pillGroupStyle: React.CSSProperties = {
  display: 'flex',
  background: 'var(--lucid-surface-figure)',
  border: '1px solid var(--lucid-rule-cream)',
  borderRadius: 4,
  padding: 2,
  gap: 2,
  width: '100%',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: 'var(--lucid-surface-page)',
  border: '1px solid var(--lucid-rule-cream)',
  borderRadius: 3,
  color: 'var(--lucid-ink-strong)',
  fontSize: 12,
  fontFamily: 'var(--lucid-font-serif)',
  cursor: 'pointer',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: 'var(--lucid-font-sans)',
  fontSize: 12,
  cursor: 'pointer',
  color: 'var(--lucid-ink-body)',
  padding: '4px 0',
  userSelect: 'none',
};

const dividerStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid var(--lucid-rule-white)',
  margin: '8px 0',
};

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '5px 6px',
        background: active ? 'var(--lucid-surface-page)' : 'transparent',
        boxShadow: active ? '0 0 0 1px var(--lucid-rule-cream) inset' : 'none',
        border: 'none', borderRadius: 3,
        color: active ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-body)',
        fontSize: 11, fontFamily: 'var(--lucid-font-serif)', cursor: 'pointer',
        transition: 'all 160ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {children}
    </button>
  );
}

function ViewBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        background: active ? 'var(--lucid-surface-page)' : 'transparent',
        boxShadow: active ? '0 0 0 1px var(--lucid-rule-cream) inset' : 'none',
        border: 'none', borderRadius: 3,
        color: active ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-body)',
        fontSize: 11, fontFamily: 'var(--lucid-font-sans)',
        textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
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
      fontSize: 11, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.10em',
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{
        fontFamily: 'var(--lucid-font-serif)',
        fontSize: 13, color: 'var(--lucid-ink-body)',
        minWidth: 90, flexShrink: 0,
      }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function KV({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: 10, padding: '4px 0',
      borderBottom: '1px dashed var(--lucid-rule-white)',
    }}>
      <span style={{ fontFamily: 'var(--lucid-font-serif)', fontSize: 12, color: 'var(--lucid-ink-body)' }}>{label}</span>
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
            display: 'block', fontSize: 10,
            color: 'var(--lucid-ink-muted)',
            fontFamily: 'var(--lucid-font-sans)',
            fontWeight: 400, fontStyle: 'italic',
          }}>{hint}</span>
        )}
      </span>
    </div>
  );
}

function Note({ children, variant }: { children: React.ReactNode; variant?: 'warn' }) {
  if (variant === 'warn') {
    return (
      <div style={{
        marginTop: 8, padding: '8px 12px',
        background: 'var(--lucid-tint-coral)',
        border: '1px solid var(--lucid-acc-coral-border)',
        borderRadius: 4,
        fontFamily: 'var(--lucid-font-serif)',
        fontSize: 12, lineHeight: 1.5,
        color: 'var(--lucid-acc-coral-text)',
      }}>{children}</div>
    );
  }
  return (
    <div style={{
      marginTop: 8,
      fontFamily: 'var(--lucid-font-serif)',
      fontSize: 12, lineHeight: 1.5,
      color: 'var(--lucid-ink-muted)', fontStyle: 'italic',
    }}>{children}</div>
  );
}
