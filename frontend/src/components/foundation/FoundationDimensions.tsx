import { useFoundationStore } from '../../store/foundationStore';

/** Componente input reutilizable con estilos consistentes */
function InputField({
  id,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  disabled = false,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm
                     placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 
                     focus:border-amber-500/50 transition-all duration-200
                     disabled:opacity-40 disabled:cursor-not-allowed
                     [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
          {unit}
        </span>
      </div>
    </div>
  );
}

export default function FoundationDimensions() {
  const foundation = useFoundationStore((s) => s.foundation);
  const setParam = useFoundationStore((s) => s.setFoundationParam);
  const method = useFoundationStore((s) => s.method);
  const setMethod = useFoundationStore((s) => s.setMethod);
  const lbLocked = useFoundationStore((s) => s.lbLocked);
  const lbRatio = useFoundationStore((s) => s.lbRatio);
  const setLbLocked = useFoundationStore((s) => s.setLbLocked);
  const setLbRatio = useFoundationStore((s) => s.setLbRatio);

  const isRectangular = foundation.type === 'rectangular';
  const currentRatio = foundation.B > 0 ? (foundation.L / foundation.B).toFixed(2) : '—';

  return (
    <div className="space-y-5">
      {/* Método de cálculo */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-3">
          Método de Cálculo
        </label>
        <div className="grid grid-cols-3 gap-3">
          <MethodButton
            id="method-terzaghi"
            active={method === 'terzaghi'}
            onClick={() => setMethod('terzaghi')}
            title="Terzaghi Clásico"
            desc="Tabla de factores"
          />
          <MethodButton
            id="method-general"
            active={method === 'general'}
            onClick={() => setMethod('general')}
            title="Ecuación General"
            desc="Das / Braja"
          />
          <MethodButton
            id="method-rne"
            active={method === 'rne'}
            onClick={() => setMethod('rne')}
            title="RNE E.050"
            desc="Norma peruana"
          />
        </div>
      </div>

      {/* Dimensiones dinámicas */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-3">
          Dimensiones de la Cimentación
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* B siempre visible */}
          <InputField
            id="input-B"
            label={foundation.type === 'circular' ? 'Diámetro B' : foundation.type === 'cuadrada' ? 'Lado B' : 'Ancho B'}
            unit="m"
            value={foundation.B}
            onChange={(v) => setParam('B', v)}
            min={0.01}
          />

          {/* L solo para rectangular */}
          {isRectangular && (
            <InputField
              id="input-L"
              label="Longitud L"
              unit="m"
              value={foundation.L}
              onChange={(v) => setParam('L', v)}
              min={0.01}
              disabled={lbLocked}
            />
          )}

          {/* Df siempre */}
          <InputField
            id="input-Df"
            label="Prof. desplante Df"
            unit="m"
            value={foundation.Df}
            onChange={(v) => setParam('Df', v)}
            min={0}
          />

          {/* FS */}
          <InputField
            id="input-FS"
            label="Factor de seguridad FS"
            unit=""
            value={foundation.FS}
            onChange={(v) => setParam('FS', v)}
            min={1.5}
            max={5.0}
            step={0.5}
          />

          {/* β */}
          <InputField
            id="input-beta"
            label="Ángulo inclinación β"
            unit="°"
            value={foundation.beta}
            onChange={(v) => setParam('beta', v)}
            min={0}
            max={45}
            step={1}
          />
        </div>

        {/* L/B ratio toggle — only for rectangular */}
        {isRectangular && (
          <div style={{
            marginTop: 12,
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', fontSize: 12, color: '#ccc',
            }}>
              <input
                type="checkbox"
                checked={lbLocked}
                onChange={(e) => setLbLocked(e.target.checked)}
                style={{ accentColor: '#c0392b' }}
              />
              L en función de B (L = k × B)
            </label>

            {lbLocked ? (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#888' }}>k =</span>
                <input
                  type="number"
                  value={lbRatio}
                  onChange={(e) => setLbRatio(parseFloat(e.target.value) || 1)}
                  min={1}
                  max={10}
                  step={0.1}
                  style={{
                    width: 60, padding: '3px 6px',
                    background: '#2a2a2a', border: '1px solid #505050',
                    color: '#fff', fontSize: 12, borderRadius: 4,
                  }}
                />
                <span style={{ fontSize: 11, color: '#666' }}>
                  → L = {(lbRatio * foundation.B).toFixed(2)} m
                </span>
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>
                Relación actual: L/B = {currentRatio}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MethodButton({
  id,
  active,
  onClick,
  title,
  desc,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={`
        flex flex-col items-start p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer
        ${active
          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
          : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
        }
      `}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs opacity-60 mt-0.5">{desc}</span>
    </button>
  );
}
