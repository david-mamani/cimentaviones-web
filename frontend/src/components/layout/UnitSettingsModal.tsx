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
        background: 'rgba(43, 43, 43, 0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--lucid-surface-page)',
          border: '1px solid var(--lucid-rule-cream)',
          borderRadius: 6,
          padding: '28px 32px',
          width: 460,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {/* Eyebrow + Title */}
        <div style={{
          fontFamily: 'var(--lucid-font-sans)',
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--lucid-ink-muted)',
          marginBottom: 6,
          textAlign: 'center',
        }}>
          Preferencias
        </div>
        <h2 style={{
          fontFamily: 'var(--lucid-font-serif)',
          fontSize: 22, fontWeight: 700,
          color: 'var(--lucid-ink-strong)',
          marginBottom: 6,
          textAlign: 'center',
          letterSpacing: '-0.01em',
        }}>
          Configuración de unidades
        </h2>
        <p style={{
          fontFamily: 'var(--lucid-font-serif)',
          fontSize: 13, fontStyle: 'italic',
          color: 'var(--lucid-ink-muted)',
          marginBottom: 24,
          textAlign: 'center',
        }}>
          Configura las unidades de entrada y salida de forma independiente.
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
          background: 'var(--lucid-rule-white)',
          margin: '20px 0',
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
            marginTop: 14,
            padding: '10px 14px',
            background: 'var(--lucid-tint-coral)',
            border: '1px solid #efd9cd',
            borderRadius: 4,
            fontFamily: 'var(--lucid-font-serif)',
            fontSize: 12, fontStyle: 'italic',
            color: '#b5563f',
            lineHeight: 1.5,
          }}>
            Las unidades de entrada y salida son diferentes. Los resultados se convertirán automáticamente; en el PDF se incluirá una sección de conversión.
          </div>
        )}

        {/* Close button */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 28px',
              background: 'var(--lucid-surface-page)',
              border: '1.5px solid var(--lucid-ink-strong)',
              color: 'var(--lucid-ink-strong)',
              fontSize: 14,
              fontFamily: 'var(--lucid-font-serif)',
              borderRadius: 999,
              cursor: 'pointer',
              transition: 'background 160ms cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--lucid-surface-figure)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--lucid-surface-page)'; }}
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
        fontFamily: 'var(--lucid-font-sans)',
        fontSize: 11, fontWeight: 600,
        color: 'var(--lucid-ink-strong)',
        marginBottom: 2,
        textTransform: 'uppercase', letterSpacing: '0.10em',
      }}>
        {title}
      </p>
      <p style={{
        fontFamily: 'var(--lucid-font-serif)',
        fontSize: 12, fontStyle: 'italic',
        color: 'var(--lucid-ink-muted)',
        marginBottom: 12,
      }}>
        {subtitle}
      </p>

      {/* Preset segmented control */}
      <div style={{
        display: 'flex',
        background: 'var(--lucid-surface-figure)',
        border: '1px solid var(--lucid-rule-cream)',
        borderRadius: 4,
        padding: 2,
        gap: 2,
        marginBottom: 14,
      }}>
        {(Object.keys(PRESETS) as UnitPreset[]).map((key) => {
          const isActive = preset === key;
          return (
            <button
              key={key}
              onClick={() => onPreset(key)}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: isActive ? '#fff' : 'transparent',
                boxShadow: isActive ? '0 0 0 1px var(--lucid-rule-cream) inset' : 'none',
                border: 'none',
                borderRadius: 3,
                color: isActive ? 'var(--lucid-ink-strong)' : 'var(--lucid-ink-body)',
                fontSize: 13,
                fontFamily: 'var(--lucid-font-serif)',
                cursor: 'pointer',
                transition: 'all 160ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {PRESET_LABELS[key]}
            </button>
          );
        })}
      </div>

      {/* Category dropdowns */}
      <div style={{
        background: 'var(--lucid-surface-figure)',
        border: '1px solid var(--lucid-rule-cream)',
        borderRadius: 4,
        padding: '4px 14px',
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
      padding: '8px 0',
      borderBottom: last ? 'none' : '1px solid var(--lucid-rule-white)',
    }}>
      <span style={{
        fontFamily: 'var(--lucid-font-serif)',
        fontSize: 13, color: 'var(--lucid-ink-body)',
      }}>
        {label}
      </span>
      <select
        value={value}
        disabled
        style={{
          background: '#fff',
          border: '1px solid var(--lucid-rule-cream)',
          borderRadius: 3,
          color: 'var(--lucid-ink-strong)',
          fontSize: 12,
          fontFamily: 'var(--lucid-font-serif)',
          padding: '4px 8px',
          cursor: 'pointer',
          outline: 'none',
          minWidth: 90,
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
