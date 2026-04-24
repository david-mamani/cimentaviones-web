import { useFoundationStore } from '../../store/foundationStore';
import type { FoundationType } from '../../types/geotechnical';

const TYPES: { value: FoundationType; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    value: 'cuadrada',
    label: 'Cuadrada',
    desc: 'B × B',
    icon: (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        <rect x="8" y="8" width="24" height="24" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2" />
        <text x="20" y="24" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="bold">B</text>
      </svg>
    ),
  },
  {
    value: 'rectangular',
    label: 'Rectangular',
    desc: 'B × L',
    icon: (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        <rect x="4" y="10" width="32" height="20" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2" />
        <text x="20" y="24" textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="bold">B×L</text>
      </svg>
    ),
  },
  {
    value: 'franja',
    label: 'Franja',
    desc: 'L → ∞',
    icon: (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        <rect x="2" y="14" width="36" height="12" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2" />
        <text x="20" y="24" textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="bold">∞</text>
      </svg>
    ),
  },
  {
    value: 'circular',
    label: 'Circular',
    desc: 'Ø = B',
    icon: (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="12" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2" />
        <text x="20" y="24" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="bold">Ø</text>
      </svg>
    ),
  },
];

export default function FoundationTypeSelector() {
  const type = useFoundationStore((s) => s.foundation.type);
  const setType = useFoundationStore((s) => s.setFoundationType);

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-3">
        Tipo de Cimentación
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TYPES.map((t) => {
          const isSelected = type === t.value;
          return (
            <button
              key={t.value}
              id={`foundation-type-${t.value}`}
              type="button"
              onClick={() => setType(t.value)}
              className={`
                relative group flex flex-col items-center gap-2 p-4 rounded-xl border-2 
                transition-all duration-300 cursor-pointer
                ${isSelected
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/10'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/8 hover:text-slate-300'
                }
              `}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                </div>
              )}
              <div className={isSelected ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'}>
                {t.icon}
              </div>
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-xs opacity-60">{t.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
