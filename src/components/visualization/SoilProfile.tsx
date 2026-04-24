import { useFoundationStore } from '../../store/foundationStore';

export default function SoilProfile() {
  const strata = useFoundationStore((s) => s.strata);
  const Df = useFoundationStore((s) => s.foundation.Df);
  const hasWT = useFoundationStore((s) => s.conditions.hasWaterTable);
  const Dw = useFoundationStore((s) => s.conditions.waterTableDepth);
  const result = useFoundationStore((s) => s.result);

  if (strata.length === 0) return null;
  const total = strata.reduce((s, st) => s + st.thickness, 0);
  if (total === 0) return null;

  const W = 500, H = 400, mL = 60, mR = 200, mT = 40, mB = 30;
  const pW = W - mL - mR, pH = H - mT - mB;
  const sc = pH / total;
  const COLORS = ['#8B7355','#A0926B','#6B5B4A','#9C8B70','#7A6B5A','#B8A88A','#5C4E3C','#A39478','#8D7E6A','#6E5F4E'];

  let cy = mT;
  const layers = strata.map((st, i) => {
    const h = st.thickness * sc;
    const y = cy;
    cy += h;
    const isDesign = result?.designStratumIndex === i;
    return { st, i, y, h, isDesign, color: COLORS[i % COLORS.length] };
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Perfil Estratigráfico</h3>
      <div className="rounded-xl border border-white/10 bg-white/3 p-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg mx-auto" style={{ minWidth: 320 }}>
          <text x={W/2} y={20} textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="bold">PERFIL ESTRATIGRÁFICO</text>
          <line x1={mL-5} y1={mT} x2={mL-5} y2={mT+pH} stroke="#475569" strokeWidth="1"/>
          
          {layers.map(({ st, i, y, h, isDesign, color }) => (
            <g key={st.id}>
              <rect x={mL} y={y} width={pW} height={h} fill={color} stroke={isDesign?'#f59e0b':'#334155'} strokeWidth={isDesign?2.5:1} rx="2" opacity="0.85"/>
              <text x={mL-10} y={y+4} textAnchor="end" fill="#94a3b8" fontSize="9">
                {strata.slice(0,i).reduce((s,st)=>s+st.thickness,0).toFixed(1)}m
              </text>
              <text x={mL+pW+8} y={y+14} fill="#e2e8f0" fontSize="9" fontWeight={isDesign?'bold':'normal'}>
                {isDesign?'★ ':''}Estrato {i+1}
              </text>
              <text x={mL+pW+8} y={y+27} fill="#94a3b8" fontSize="8">
                h={st.thickness}m γ={st.gamma} kN/m³
              </text>
              <text x={mL+pW+8} y={y+39} fill="#94a3b8" fontSize="8">
                c={st.c}kPa φ={st.phi}°
              </text>
            </g>
          ))}

          <text x={mL-10} y={mT+pH+4} textAnchor="end" fill="#94a3b8" fontSize="9">{total.toFixed(1)}m</text>

          {Df > 0 && Df <= total && (
            <g>
              <line x1={mL-10} y1={mT+Df*sc} x2={mL+pW+5} y2={mT+Df*sc} stroke="#ef4444" strokeWidth="2" strokeDasharray="6,3"/>
              <rect x={mL-55} y={mT+Df*sc-8} width={42} height={16} rx="3" fill="#ef4444" opacity="0.9"/>
              <text x={mL-34} y={mT+Df*sc+4} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">Df={Df}m</text>
            </g>
          )}

          {hasWT && Dw <= total && (
            <g>
              <line x1={mL-10} y1={mT+Dw*sc} x2={mL+pW+5} y2={mT+Dw*sc} stroke="#3b82f6" strokeWidth="2" strokeDasharray="8,4"/>
              <rect x={mL+pW+8} y={mT+Dw*sc-8} width={55} height={16} rx="3" fill="#3b82f6" opacity="0.9"/>
              <text x={mL+pW+35} y={mT+Dw*sc+4} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">NF={Dw}m</text>
            </g>
          )}

          <rect x={mL+pW/2-25} y={mT+(Df>0&&Df<=total?Df*sc:0)-6} width={50} height={6} rx="1" fill="#f59e0b" opacity="0.9"/>
        </svg>
      </div>
    </div>
  );
}
