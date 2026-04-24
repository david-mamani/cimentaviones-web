/**
 * Store global con Zustand.
 * Gestiona el estado completo de la aplicación CimentAviones.
 */

import { create } from 'zustand';
import type {
  FoundationType,
  CalculationMethod,
  Stratum,
  FoundationParams,
  SpecialConditions,
  CalculationResult,
} from '../types/geotechnical';
import { calculateBearingCapacity } from '../lib/terzaghi/bearingCapacity';

/** Genera un ID único para cada estrato */
let stratumCounter = 0;
function generateId(): string {
  return `stratum-${++stratumCounter}-${Date.now()}`;
}

/** Estado de la aplicación */
interface FoundationState {
  // Parámetros de cimentación
  foundation: FoundationParams;

  // Estratos
  strata: Stratum[];

  // Condiciones especiales
  conditions: SpecialConditions;

  // Método de cálculo
  method: CalculationMethod;

  // Resultado
  result: CalculationResult | null;

  // Errores de validación
  errors: string[];

  // Selection (synced across all views)
  selectedIds: string[];  // stratum IDs or 'foundation'

  // Acciones - Selección
  toggleSelection: (id: string, multi: boolean) => void;
  clearSelection: () => void;

  // Acciones - Cimentación
  setFoundationType: (type: FoundationType) => void;
  setFoundationParam: <K extends keyof FoundationParams>(key: K, value: FoundationParams[K]) => void;

  // Acciones - Estratos
  addStratum: () => void;
  removeStratum: (id: string) => void;
  updateStratum: (id: string, updates: Partial<Stratum>) => void;

  // Acciones - Condiciones
  setCondition: <K extends keyof SpecialConditions>(key: K, value: SpecialConditions[K]) => void;

  // Acciones - Método
  setMethod: (method: CalculationMethod) => void;

  // Acciones - Cálculo
  calculate: () => void;
  setErrors: (errors: string[]) => void;
  clearResult: () => void;
  reset: () => void;
}

const defaultFoundation: FoundationParams = {
  type: 'cuadrada',
  B: 1.0,
  L: 1.0,
  Df: 1.0,
  FS: 3.0,
  beta: 0,
};

const defaultConditions: SpecialConditions = {
  hasWaterTable: false,
  waterTableDepth: 0,
  hasBasement: false,
  basementDepth: 0,
};

function createDefaultStratum(): Stratum {
  return {
    id: generateId(),
    thickness: 1.0,
    gamma: 18.0,
    c: 0,
    phi: 30,
    gammaSat: 20.0,
  };
}

export const useFoundationStore = create<FoundationState>((set, get) => ({
  foundation: { ...defaultFoundation },
  strata: [createDefaultStratum()],
  conditions: { ...defaultConditions },
  method: 'terzaghi',
  result: null,
  errors: [],
  selectedIds: [],

  toggleSelection: (id, multi) => {
    set((state) => {
      if (multi) {
        // Ctrl+click: toggle in/out of selection
        const has = state.selectedIds.includes(id);
        return { selectedIds: has ? state.selectedIds.filter(x => x !== id) : [...state.selectedIds, id] };
      }
      // Single click: select only this
      return { selectedIds: [id] };
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  setFoundationType: (type) => {
    set((state) => ({
      foundation: { ...state.foundation, type },
      result: null,
    }));
  },

  setFoundationParam: (key, value) => {
    set((state) => ({
      foundation: { ...state.foundation, [key]: value },
      result: null,
    }));
  },

  addStratum: () => {
    set((state) => ({
      strata: [...state.strata, createDefaultStratum()],
      result: null,
    }));
  },

  removeStratum: (id) => {
    set((state) => {
      if (state.strata.length <= 1) return state;
      return {
        strata: state.strata.filter((s) => s.id !== id),
        result: null,
      };
    });
  },

  updateStratum: (id, updates) => {
    set((state) => ({
      strata: state.strata.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
      result: null,
    }));
  },

  setCondition: (key, value) => {
    set((state) => ({
      conditions: { ...state.conditions, [key]: value },
      result: null,
    }));
  },

  setMethod: (method) => {
    set(() => ({
      method,
      result: null,
    }));
  },

  calculate: () => {
    const state = get();
    try {
      const result = calculateBearingCapacity({
        foundation: state.foundation,
        strata: state.strata,
        conditions: state.conditions,
        method: state.method,
      });
      set({ result, errors: [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido en el cálculo';
      set({ errors: [message], result: null });
    }
  },

  setErrors: (errors) => set({ errors }),
  clearResult: () => set({ result: null }),

  reset: () => {
    stratumCounter = 0;
    set({
      foundation: { ...defaultFoundation },
      strata: [createDefaultStratum()],
      conditions: { ...defaultConditions },
      method: 'terzaghi',
      result: null,
      errors: [],
    });
  },
}));
