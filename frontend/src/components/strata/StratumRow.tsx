import { useFoundationStore } from '../../store/foundationStore';
import type { Stratum } from '../../types/geotechnical';

interface StratumRowProps {
  stratum: Stratum;
  index: number;
  canDelete: boolean;
}

export default function StratumRow({ stratum, index, canDelete }: StratumRowProps) {
  const updateStratum = useFoundationStore((s) => s.updateStratum);
  const removeStratum = useFoundationStore((s) => s.removeStratum);

  const handleChange = (field: keyof Stratum, value: string) => {
    const numVal = parseFloat(value);
    if (!isNaN(numVal)) {
      updateStratum(stratum.id, { [field]: numVal });
    }
  };

  return (
    <tr className="group border-b border-white/5 hover:bg-white/3 transition-colors">
      {/* Número de estrato */}
      <td className="px-3 py-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold">
          {index + 1}
        </span>
      </td>

      {/* Espesor */}
      <td className="px-2 py-2">
        <input
          id={`stratum-${index}-thickness`}
          type="number"
          value={stratum.thickness}
          onChange={(e) => handleChange('thickness', e.target.value)}
          min={0.01}
          step={0.1}
          className="stratum-input"
          title="Espesor (m)"
        />
      </td>

      {/* γ */}
      <td className="px-2 py-2">
        <input
          id={`stratum-${index}-gamma`}
          type="number"
          value={stratum.gamma}
          onChange={(e) => handleChange('gamma', e.target.value)}
          min={0.01}
          step={0.1}
          className="stratum-input"
          title="Peso unitario γ (kN/m³)"
        />
      </td>

      {/* c */}
      <td className="px-2 py-2">
        <input
          id={`stratum-${index}-c`}
          type="number"
          value={stratum.c}
          onChange={(e) => handleChange('c', e.target.value)}
          min={0}
          step={1}
          className="stratum-input"
          title="Cohesión c (kPa)"
        />
      </td>

      {/* φ */}
      <td className="px-2 py-2">
        <input
          id={`stratum-${index}-phi`}
          type="number"
          value={stratum.phi}
          onChange={(e) => handleChange('phi', e.target.value)}
          min={0}
          max={50}
          step={1}
          className="stratum-input"
          title="Ángulo de fricción φ (°)"
        />
      </td>

      {/* γsat */}
      <td className="px-2 py-2">
        <input
          id={`stratum-${index}-gammaSat`}
          type="number"
          value={stratum.gammaSat}
          onChange={(e) => handleChange('gammaSat', e.target.value)}
          min={0.01}
          step={0.1}
          className="stratum-input"
          title="Peso unitario saturado γsat (kN/m³)"
        />
      </td>

      {/* Botón eliminar */}
      <td className="px-2 py-2 text-center">
        <button
          id={`stratum-${index}-delete`}
          type="button"
          onClick={() => removeStratum(stratum.id)}
          disabled={!canDelete}
          className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 
                     disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
          title="Eliminar estrato"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
