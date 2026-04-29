import { useFoundationStore } from '../../store/foundationStore';
import StratumRow from './StratumRow';

export default function StratumTable() {
  const strata = useFoundationStore((s) => s.strata);
  const addStratum = useFoundationStore((s) => s.addStratum);

  const totalThickness = strata.reduce((sum, s) => sum + s.thickness, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-300">
            Estratos del Suelo
          </h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-slate-400">
            {strata.length} {strata.length === 1 ? 'estrato' : 'estratos'}
          </span>
          <span className="text-xs text-slate-500">
            Espesor total: {totalThickness.toFixed(2)} m
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 w-12">N°</th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400">
                Espesor
                <span className="block text-[10px] font-normal text-slate-500">m</span>
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400">
                γ
                <span className="block text-[10px] font-normal text-slate-500">kN/m³</span>
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400">
                c
                <span className="block text-[10px] font-normal text-slate-500">kPa</span>
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400">
                φ
                <span className="block text-[10px] font-normal text-slate-500">°</span>
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400">
                γ<sub>sat</sub>
                <span className="block text-[10px] font-normal text-slate-500">kN/m³</span>
              </th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-400 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {strata.map((stratum, index) => (
              <StratumRow
                key={stratum.id}
                stratum={stratum}
                index={index}
                canDelete={strata.length > 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Botón agregar */}
      <button
        id="btn-add-stratum"
        type="button"
        onClick={addStratum}
        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl 
                   border-2 border-dashed border-white/10 text-slate-400 text-sm font-medium
                   hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/5
                   transition-all duration-200 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Agregar estrato
      </button>
    </div>
  );
}
