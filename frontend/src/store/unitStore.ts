/**
 * unitStore — Sistema de unidades dual (Input / Output).
 *
 * Soporta 5 categorías de unidades configurables independientemente
 * para entrada (inputs del usuario) y salida (resultados/exports):
 *
 *   - Longitud   : m | cm | ft
 *   - Ángulos    : ° (solo grados)
 *   - Fuerza     : kN | t | kgf
 *   - Presión    : kPa | t/m² | kg/cm²
 *   - Peso unit. : kN/m³ | t/m³
 *
 * Internamente el backend siempre opera en SI (m, kN, kPa, kN/m³).
 * Las funciones de conversión transforman:
 *   - inputToSI()  : valor en unidades de input → SI (para enviar al backend)
 *   - siToOutput() : valor en SI → unidades de output (para mostrar resultados)
 */
import { create } from 'zustand';

/* ══════════════════════════════════════
 * TYPES
 * ══════════════════════════════════════ */

export type LengthUnit = 'm' | 'cm' | 'ft';
export type AngleUnit = '°';
export type ForceUnit = 'kN' | 't' | 'kgf';
export type PressureUnit = 'kPa' | 't/m²' | 'kg/cm²';
export type UnitWeightUnit = 'kN/m³' | 't/m³';

export type UnitCategory = 'length' | 'angle' | 'force' | 'pressure' | 'unitWeight';

export interface UnitConfig {
  length: LengthUnit;
  angle: AngleUnit;
  force: ForceUnit;
  pressure: PressureUnit;
  unitWeight: UnitWeightUnit;
}

export type UnitPreset = 'metric' | 'SI';

/* ══════════════════════════════════════
 * CONVERSION FACTORS → SI
 *
 * Multiply by factor to get SI value.
 * Divide by factor to get display value.
 * ══════════════════════════════════════ */

const LENGTH_TO_SI: Record<LengthUnit, number> = {
  'm': 1,
  'cm': 0.01,
  'ft': 0.3048,
};

const FORCE_TO_SI: Record<ForceUnit, number> = {
  'kN': 1,
  't': 9.80665,
  'kgf': 0.00980665,
};

const PRESSURE_TO_SI: Record<PressureUnit, number> = {
  'kPa': 1,
  't/m²': 9.80665,
  'kg/cm²': 98.0665,
};

const UNIT_WEIGHT_TO_SI: Record<UnitWeightUnit, number> = {
  'kN/m³': 1,
  't/m³': 9.80665,
};

/* ══════════════════════════════════════
 * PRESETS
 * ══════════════════════════════════════ */

const METRIC_CONFIG: UnitConfig = {
  length: 'm',
  angle: '°',
  force: 't',
  pressure: 't/m²',
  unitWeight: 't/m³',
};

const SI_CONFIG: UnitConfig = {
  length: 'm',
  angle: '°',
  force: 'kN',
  pressure: 'kPa',
  unitWeight: 'kN/m³',
};

export const PRESETS: Record<UnitPreset, UnitConfig> = {
  metric: METRIC_CONFIG,
  SI: SI_CONFIG,
};

/* ══════════════════════════════════════
 * HELPERS
 * ══════════════════════════════════════ */

/** Returns the SI conversion factor for a given unit config + category */
function getFactor(config: UnitConfig, category: UnitCategory): number {
  switch (category) {
    case 'length': return LENGTH_TO_SI[config.length];
    case 'angle': return 1; // always degrees
    case 'force': return FORCE_TO_SI[config.force];
    case 'pressure': return PRESSURE_TO_SI[config.pressure];
    case 'unitWeight': return UNIT_WEIGHT_TO_SI[config.unitWeight];
  }
}

/** Returns the label string for a category in a given config */
function getLabel(config: UnitConfig, category: UnitCategory): string {
  switch (category) {
    case 'length': return config.length;
    case 'angle': return config.angle;
    case 'force': return config.force;
    case 'pressure': return config.pressure;
    case 'unitWeight': return config.unitWeight;
  }
}

/** Detects which preset (if any) matches a config */
export function detectPreset(config: UnitConfig): UnitPreset | null {
  for (const [key, preset] of Object.entries(PRESETS) as [UnitPreset, UnitConfig][]) {
    if (
      config.length === preset.length &&
      config.force === preset.force &&
      config.pressure === preset.pressure &&
      config.unitWeight === preset.unitWeight
    ) {
      return key;
    }
  }
  return null;
}

/* ══════════════════════════════════════
 * STORE
 * ══════════════════════════════════════ */

interface UnitState {
  /** Unidades de entrada (lo que el usuario escribe) */
  input: UnitConfig;
  /** Unidades de salida (lo que se muestra en resultados/exports) */
  output: UnitConfig;
  /** Controla visibilidad del modal de configuración */
  showModal: boolean;
  /** Número de decimales para mostrar resultados */
  displayDecimals: number;

  // ── Setters ──
  setInput: (config: Partial<UnitConfig>) => void;
  setOutput: (config: Partial<UnitConfig>) => void;
  setInputPreset: (preset: UnitPreset) => void;
  setOutputPreset: (preset: UnitPreset) => void;
  toggleModal: () => void;
  setDisplayDecimals: (n: number) => void;

  // ── Conversión ──
  /** Convierte un valor de unidades de input → SI */
  inputToSI: (value: number, category: UnitCategory) => number;
  /** Convierte un valor de SI → unidades de output */
  siToOutput: (value: number, category: UnitCategory) => number;

  // ── Labels ──
  /** Label de la unidad de input para una categoría */
  inputLabel: (category: UnitCategory) => string;
  /** Label de la unidad de output para una categoría */
  outputLabel: (category: UnitCategory) => string;

  // ── Formatting ──
  /** Formatea un número al número de decimales configurado */
  fmt: (value: number) => string;

  // ── Shorthand labels object (for components that need all at once) ──
  inputLabels: () => Record<UnitCategory, string>;
  outputLabels: () => Record<UnitCategory, string>;
}

export const useUnitStore = create<UnitState>((set, get) => ({
  input: { ...METRIC_CONFIG },
  output: { ...METRIC_CONFIG },
  showModal: false,
  displayDecimals: 2,

  setInput: (partial) =>
    set((state) => ({ input: { ...state.input, ...partial } })),

  setOutput: (partial) =>
    set((state) => ({ output: { ...state.output, ...partial } })),

  setInputPreset: (preset) =>
    set({ input: { ...PRESETS[preset] } }),

  setOutputPreset: (preset) =>
    set({ output: { ...PRESETS[preset] } }),

  toggleModal: () =>
    set((state) => ({ showModal: !state.showModal })),

  setDisplayDecimals: (n) =>
    set({ displayDecimals: Math.max(0, Math.min(8, n)) }),

  inputToSI: (value, category) => {
    const factor = getFactor(get().input, category);
    return value * factor;
  },

  siToOutput: (value, category) => {
    const factor = getFactor(get().output, category);
    return value / factor;
  },

  inputLabel: (category) => getLabel(get().input, category),
  outputLabel: (category) => getLabel(get().output, category),

  fmt: (value) => {
    const d = get().displayDecimals;
    return value.toFixed(d);
  },

  inputLabels: () => {
    const cfg = get().input;
    return {
      length: getLabel(cfg, 'length'),
      angle: getLabel(cfg, 'angle'),
      force: getLabel(cfg, 'force'),
      pressure: getLabel(cfg, 'pressure'),
      unitWeight: getLabel(cfg, 'unitWeight'),
    };
  },

  outputLabels: () => {
    const cfg = get().output;
    return {
      length: getLabel(cfg, 'length'),
      angle: getLabel(cfg, 'angle'),
      force: getLabel(cfg, 'force'),
      pressure: getLabel(cfg, 'pressure'),
      unitWeight: getLabel(cfg, 'unitWeight'),
    };
  },
}));
