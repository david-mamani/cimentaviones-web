import { useFoundationStore } from '../../store/foundationStore';

export default function BasementInput() {
  const hasBasement = useFoundationStore((s) => s.conditions.hasBasement);
  const basementDepth = useFoundationStore((s) => s.conditions.basementDepth);
  const setCondition = useFoundationStore((s) => s.setCondition);

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <label className="relative inline-flex items-center cursor-pointer" htmlFor="toggle-basement">
        <input
          id="toggle-basement"
          type="checkbox"
          checked={hasBasement}
          onChange={(e) => setCondition('hasBasement', e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-10 h-5 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/50 rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500 peer-checked:after:bg-white"></div>
        <span className="ml-3 text-sm font-medium text-slate-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Sótano
        </span>
      </label>

      {hasBasement && (
        <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
          <label htmlFor="input-Ds" className="text-xs text-slate-400">Profundidad Ds:</label>
          <input
            id="input-Ds"
            type="number"
            value={basementDepth}
            onChange={(e) => setCondition('basementDepth', parseFloat(e.target.value) || 0)}
            min={0}
            step={0.1}
            className="w-24 px-3 py-1.5 rounded-lg bg-white/5 border border-purple-500/30 text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all
                       [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-slate-500">m</span>
        </div>
      )}
    </div>
  );
}
