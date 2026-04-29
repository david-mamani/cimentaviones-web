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

  // L/B ratio for rectangular foundations
  lbLocked: boolean;   // L = k × B mode
  lbRatio: number;     // k value (default 2.0)

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

  // Acciones - L/B ratio
  setLbLocked: (locked: boolean) => void;
  setLbRatio: (ratio: number) => void;

  // Acciones - Cálculo
  calculate: () => void;
  setErrors: (errors: string[]) => void;
  clearResult: () => void;
  reset: () => void;

  // Acciones - Proyecto
  loadProject: (data: ProjectData) => void;
}

/** Datos serializables del proyecto */
export interface ProjectData {
  foundation: FoundationParams;
  strata: Stratum[];
  conditions: SpecialConditions;
  method: CalculationMethod;
  lbLocked?: boolean;
  lbRatio?: number;
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
  lbLocked: false,
  lbRatio: 2.0,

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
    set((state) => {
      const updated = { ...state.foundation, [key]: value };
      // Auto-update L when B changes and lbLocked is active
      if (key === 'B' && state.lbLocked && state.foundation.type === 'rectangular') {
        updated.L = state.lbRatio * (value as number);
      }
      return {
        foundation: updated,
        result: null,
      };
    });
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

  setLbLocked: (locked) => {
    set((state) => {
      if (locked && state.foundation.type === 'rectangular') {
        // When locking, auto-update L = ratio × B
        return {
          lbLocked: locked,
          foundation: { ...state.foundation, L: state.lbRatio * state.foundation.B },
          result: null,
        };
      }
      return { lbLocked: locked, result: null };
    });
  },

  setLbRatio: (ratio) => {
    set((state) => {
      if (state.lbLocked && state.foundation.type === 'rectangular') {
        return {
          lbRatio: ratio,
          foundation: { ...state.foundation, L: ratio * state.foundation.B },
          result: null,
        };
      }
      return { lbRatio: ratio, result: null };
    });
  },

  calculate: async () => {
    const state = get();
    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foundation: state.foundation,
          strata: state.strata,
          conditions: state.conditions,
          method: state.method,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${response.status}`);
      }
      const result = await response.json();
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
      lbLocked: false,
      lbRatio: 2.0,
    });
  },

  loadProject: (data) => {
    stratumCounter = data.strata.length;
    set({
      foundation: data.foundation,
      strata: data.strata,
      conditions: data.conditions,
      method: data.method,
      lbLocked: data.lbLocked ?? false,
      lbRatio: data.lbRatio ?? 2.0,
      result: null,
      errors: [],
    });
  },
}));
