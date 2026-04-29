import { useFoundationStore } from '../../store/foundationStore';

export default function WaterTableInput() {
  const hasWaterTable = useFoundationStore((s) => s.conditions.hasWaterTable);
  const waterTableDepth = useFoundationStore((s) => s.conditions.waterTableDepth);
  const setCondition = useFoundationStore((s) => s.setCondition);

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <label className="relative inline-flex items-center cursor-pointer" htmlFor="toggle-water-table">
        <input
          id="toggle-water-table"
          type="checkbox"
          checked={hasWaterTable}
          onChange={(e) => setCondition('hasWaterTable', e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-10 h-5 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500 peer-checked:after:bg-white"></div>
        <span className="ml-3 text-sm font-medium text-slate-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
          Nivel freático
        </span>
      </label>

      {hasWaterTable && (
        <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
          <label htmlFor="input-Dw" className="text-xs text-slate-400">Profundidad Dw:</label>
          <input
            id="input-Dw"
            type="number"
            value={waterTableDepth}
            onChange={(e) => setCondition('waterTableDepth', parseFloat(e.target.value) || 0)}
            min={0}
            step={0.1}
            className="w-24 px-3 py-1.5 rounded-lg bg-white/5 border border-blue-500/30 text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all
                       [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-slate-500">m</span>
        </div>
      )}
    </div>
  );
}
