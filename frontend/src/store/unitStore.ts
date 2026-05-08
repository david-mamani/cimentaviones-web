/**
 * unitStore — Sistema de unidades (SI ↔ Métrico).
 *
 * Internamente, todos los valores se almacenan en SI (kN/m³, kPa).
 * Cuando el usuario selecciona "metric", los valores se muestran
 * divididos por 9.81 (t/m³, t/m²) y se multiplican al guardar.
 *
 * Factor de conversión: 1 t/m² = 9.81 kPa, 1 t/m³ = 9.81 kN/m³
 */
import { create } from 'zustand';

export type UnitSystem = 'SI' | 'metric';

interface UnitLabels {
  gamma: string;      // kN/m³ | t/m³
  c: string;          // kPa   | t/m²
  pressure: string;   // kPa   | t/m²
  force: string;      // kN    | t
  forcePerArea: string; // kPa | t/m²
}

interface UnitState {
  unitSystem: UnitSystem;
  toggleUnitSystem: () => void;
  setUnitSystem: (system: UnitSystem) => void;

  /** Factor para convertir de SI a display: valor_display = valor_SI / factor */
  displayFactor: number;

  /** Labels actuales según el sistema */
  labels: UnitLabels;

  /** Convierte un valor de SI a unidades de display */
  toDisplay: (siValue: number) => number;

  /** Convierte un valor de display a SI */
  toSI: (displayValue: number) => number;
}

const SI_LABELS: UnitLabels = {
  gamma: 'kN/m³',
  c: 'kPa',
  pressure: 'kPa',
  force: 'kN',
  forcePerArea: 'kPa',
};

const METRIC_LABELS: UnitLabels = {
  gamma: 't/m³',
  c: 't/m²',
  pressure: 't/m²',
  force: 't',
  forcePerArea: 't/m²',
};

const FACTOR = 9.81; // 1 t/m³ = 9.81 kN/m³

export const useUnitStore = create<UnitState>((set, get) => ({
  unitSystem: 'SI',
  displayFactor: 1,
  labels: SI_LABELS,

  toggleUnitSystem: () => {
    const current = get().unitSystem;
    const next: UnitSystem = current === 'SI' ? 'metric' : 'SI';
    set({
      unitSystem: next,
      displayFactor: next === 'SI' ? 1 : FACTOR,
      labels: next === 'SI' ? SI_LABELS : METRIC_LABELS,
    });
  },

  setUnitSystem: (system) =>
    set({
      unitSystem: system,
      displayFactor: system === 'SI' ? 1 : FACTOR,
      labels: system === 'SI' ? SI_LABELS : METRIC_LABELS,
    }),

  toDisplay: (siValue) => {
    const factor = get().displayFactor;
    return factor === 1 ? siValue : siValue / factor;
  },

  toSI: (displayValue) => {
    const factor = get().displayFactor;
    return factor === 1 ? displayValue : displayValue * factor;
  },
}));
