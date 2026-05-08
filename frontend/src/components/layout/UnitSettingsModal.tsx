/**
 * UnitSettingsModal — Modal for configuring input/output unit systems.
 * Follows CreditsModal glassmorphism design pattern.
 */
import { useUnitStore, detectPreset, PRESETS } from '../../store/unitStore';
import type {
  UnitPreset, UnitConfig,
  LengthUnit, ForceUnit, PressureUnit, UnitWeightUnit,
  UnitCategory,
} from '../../store/unitStore';

interface UnitSettingsModalProps {
  onClose: () => void;
}

const LENGTH_OPTIONS: LengthUnit[] = ['m', 'cm', 'ft'];
const FORCE_OPTIONS: ForceUnit[] = ['kN', 't', 'kgf'];
const PRESSURE_OPTIONS: PressureUnit[] = ['kPa', 't/m²', 'kg/cm²'];
const UNIT_WEIGHT_OPTIONS: UnitWeightUnit[] = ['kN/m³', 't/m³'];

const PRESET_LABELS: Record<UnitPreset, string> = {
  metric: 'Métrico',
  SI: 'SI',
};

const CATEGORY_LABELS: Record<Exclude<UnitCategory, 'angle'>, string> = {
  length: 'Longitud',
  force: 'Fuerza',
  pressure: 'Presión',
  unitWeight: 'Peso unitario',
};

export default function UnitSettingsModal({ onClose }: UnitSettingsModalProps) {
  const input = useUnitStore((s) => s.input);
  const output = useUnitStore((s) => s.output);
  const setInputPreset = useUnitStore((s) => s.setInputPreset);
  const setOutputPreset = useUnitStore((s) => s.setOutputPreset);

  const inputPreset = detectPreset(input);
  const outputPreset = detectPreset(output);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface-1)',
          border: '1px solid var(--border-active)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          width: 420,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Title */}
        <h2 style={{
          fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
          marginBottom: 4, fontFamily: 'var(--font-sans)',
          textAlign: 'center',
        }}>
          Configuración de Unidades
        </h2>
        <p style={{
          fontSize: 10, color: 'var(--text-muted)', marginBottom: 20,
          textAlign: 'center',
        }}>
          Configura las unidades de entrada y salida de forma independiente
        </p>

        {/* ── INPUT Section ── */}
        <UnitSection
          title="Unidades de Entrada"
          subtitle="Los valores que introduces en los inputs"
          config={input}
          preset={inputPreset}
          onPreset={setInputPreset}
        />

        {/* Divider */}
        <div style={{
          height: 1,
          background: 'var(--border)',
          margin: '16px 0',
        }} />

        {/* ── OUTPUT Section ── */}
        <UnitSection
          title="Unidades de Salida"
          subtitle="Resultados, gráficas y exportaciones"
          config={output}
          preset={outputPreset}
          onPreset={setOutputPreset}
        />

        {/* Input ≠ Output notice */}
        {inputPreset !== outputPreset && (
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'rgba(192, 57, 43, 0.08)',
            border: '1px solid rgba(192, 57, 43, 0.2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 10,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}>
            ⚡ Las unidades de entrada y salida son diferentes. Los resultados se convertirán automáticamente. En el PDF se incluirá una sección de conversión.
          </div>
        )}

        {/* Close button */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 24px',
              background: 'var(--accent)',
              border: 'none',
              color: 'var(--bg-base)',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 20,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
 * SUB-COMPONENTS
 * ═══════════════════════════════════════ */

function UnitSection({ title, subtitle, config, preset, onPreset }: {
  title: string;
  subtitle: string;
  config: UnitConfig;
  preset: UnitPreset | null;
  onPreset: (p: UnitPreset) => void;
}) {
  return (
    <div>
      {/* Section header */}
      <p style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-primary)',
        marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        {title}
      </p>
      <p style={{
        fontSize: 10, color: 'var(--text-muted)', marginBottom: 10,
      }}>
        {subtitle}
      </p>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(Object.keys(PRESETS) as UnitPreset[]).map((key) => (
          <button
            key={key}
            onClick={() => onPreset(key)}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: preset === key ? 'var(--accent-bg)' : 'var(--bg-surface-2)',
              border: `1px solid ${preset === key ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: preset === key ? 'var(--accent)' : 'var(--text-primary)',
              fontSize: 11,
              fontWeight: preset === key ? 700 : 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (preset !== key) {
                e.currentTarget.style.borderColor = 'var(--border-active)';
                e.currentTarget.style.background = 'var(--bg-surface-3)';
              }
            }}
            onMouseLeave={(e) => {
              if (preset !== key) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg-surface-2)';
              }
            }}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Category dropdowns */}
      <div style={{
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
      }}>
        <UnitDropdown
          label={CATEGORY_LABELS.length}
          value={config.length}
          options={LENGTH_OPTIONS}
        />
        <UnitDropdown
          label={CATEGORY_LABELS.force}
          value={config.force}
          options={FORCE_OPTIONS}
        />
        <UnitDropdown
          label={CATEGORY_LABELS.pressure}
          value={config.pressure}
          options={PRESSURE_OPTIONS}
        />
        <UnitDropdown
          label={CATEGORY_LABELS.unitWeight}
          value={config.unitWeight}
          options={UNIT_WEIGHT_OPTIONS}
          last
        />
      </div>
    </div>
  );
}

function UnitDropdown({ label, value, options, last }: {
  label: string;
  value: string;
  options: string[];
  last?: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '5px 0',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{
        fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500,
      }}>
        {label}
      </span>
      <select
        value={value}
        disabled
        style={{
          background: 'var(--bg-surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          padding: '3px 6px',
          cursor: 'pointer',
          outline: 'none',
          minWidth: 80,
          textAlign: 'center',
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
