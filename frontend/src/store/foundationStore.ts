/**
 * Store global con Zustand.
 * Gestiona el estado completo de la aplicación Cimentaciones.
 */

import { create } from 'zustand';
import type {
  FoundationType,
  CalculationMethod,
  Stratum,
  FoundationParams,
  SpecialConditions,
  CalculationResult,
  IterationResult,
  CriterionKey,
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

  // Criterio seleccionado para display de resultados (no afecta el cálculo)
  selectedCriterion: CriterionKey;

  // Resultado
  result: CalculationResult | null;

  // Errores de validación
  errors: string[];

  // Selection (synced across all views)
  selectedIds: string[];  // stratum IDs or 'foundation'

  // L/B ratio for rectangular foundations
  lbLocked: boolean;   // L = k × B mode
  lbRatio: number;     // k value (default 2.0)

  // Iteration results (for PDF export)
  iterationResults: IterationResult | null;

  // Iteration config
  iterationConfig: IterationConfig;

  // Loading state
  isCalculating: boolean;

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

  // Acciones - Criterio
  setSelectedCriterion: (criterion: CriterionKey) => void;

  // Acciones - L/B ratio
  setLbLocked: (locked: boolean) => void;
  setLbRatio: (ratio: number) => void;

  // Acciones - Cálculo
  calculate: () => void;
  setErrors: (errors: string[]) => void;
  clearResult: () => void;
  reset: () => void;

  // Acciones - Iterations
  setIterationResults: (data: IterationResult) => void;
  clearIterationResults: () => void;
  setIterationConfig: (config: IterationConfig) => void;

  // Acciones - Proyecto
  loadProject: (data: ProjectData) => void;
}

/** Configuración de iteraciones paramétricas */
export interface IterationConfig {
  varyB: boolean; bStart: number; bEnd: number; bStep: number;
  varyDf: boolean; dfStart: number; dfEnd: number; dfStep: number;
}

/** Datos serializables del proyecto */
export interface ProjectData {
  foundation: FoundationParams;
  strata: Stratum[];
  conditions: SpecialConditions;
  method: CalculationMethod;
  lbLocked?: boolean;
  lbRatio?: number;
  iterationConfig?: IterationConfig;
  selectedCriterion?: CriterionKey;
}

const defaultFoundation: FoundationParams = {
  type: 'cuadrada',
  B: 1.0,
  L: 1.0,
  Df: 1.0,
  FS: 3.0,
  beta: 0,
  e1: 0,
  e2: 0,
  Q: null,
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
    gamma: 1.8,       // t/m³ (default métrico)
    c: 0,
    phi: 30,
    gammaSat: 2.0,    // t/m³ (default métrico)
    Es: null,
    mu_s: null,
  };
}

// Constante de conversión Métrico ↔ SI
const G = 9.80665;

export const useFoundationStore = create<FoundationState>((set, get) => ({
  foundation: { ...defaultFoundation },
  strata: [createDefaultStratum()],
  conditions: { ...defaultConditions },
  method: 'terzaghi',
  selectedCriterion: 'general',
  result: null,
  errors: [],
  selectedIds: [],
  lbLocked: false,
  lbRatio: 2.0,
  iterationResults: null,
  iterationConfig: {
    varyB: true, bStart: 1.0, bEnd: 3.0, bStep: 0.5,
    varyDf: false, dfStart: 1.0, dfEnd: 3.0, dfStep: 0.5,
  },
  isCalculating: false,

  toggleSelection: (id, multi) => {
    set((state) => {
      if (multi) {
        const has = state.selectedIds.includes(id);
        return { selectedIds: has ? state.selectedIds.filter(x => x !== id) : [...state.selectedIds, id] };
      }
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

  setSelectedCriterion: (criterion) => {
    set({ selectedCriterion: criterion });
  },

  setLbLocked: (locked) => {
    set((state) => {
      if (locked && state.foundation.type === 'rectangular') {
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
    if (get().isCalculating) return;
    set({ isCalculating: true, errors: [] });
    const state = get();

    // Conversión Métrico → SI antes de enviar al motor
    const strataForAPI = state.strata.map((s) => ({
      id: s.id,
      thickness: s.thickness,
      gamma: s.gamma * G,
      c: s.c * G,
      phi: s.phi,
      gammaSat: s.gammaSat * G,
      // Es y mu_s: opcionales, solo se envían si el usuario los proveyó
      ...(typeof s.Es === 'number' && s.Es > 0 ? { Es: s.Es * G } : {}),
      ...(typeof s.mu_s === 'number' ? { mu_s: s.mu_s } : {}),
    }));

    const f = state.foundation;
    const foundationForAPI = {
      type: f.type,
      B: f.B,
      L: f.L,
      Df: f.Df,
      FS: f.FS,
      beta: f.beta,
      e1: f.e1 ?? 0,
      e2: f.e2 ?? 0,
      // Q: tnf → kN (multiplicar por G). Si no fue provista, se omite.
      ...(typeof f.Q === 'number' && f.Q > 0 ? { Q: f.Q * G } : {}),
    };

    const controller = new AbortController();
    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          foundation: foundationForAPI,
          strata: strataForAPI,
          conditions: state.conditions,
          method: state.method,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${response.status}`);
      }
      const result = await response.json();
      set({ result, errors: [], isCalculating: false });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'Error desconocido en el cálculo';
      set({ errors: [message], result: null, isCalculating: false });
    }
  },

  setErrors: (errors) => set({ errors }),
  clearResult: () => set({ result: null }),

  setIterationResults: (data) => set({ iterationResults: data }),
  clearIterationResults: () => set({ iterationResults: null }),
  setIterationConfig: (config) => set({ iterationConfig: config }),

  reset: () => {
    stratumCounter = 0;
    set({
      foundation: { ...defaultFoundation },
      strata: [createDefaultStratum()],
      conditions: { ...defaultConditions },
      method: 'terzaghi',
      selectedCriterion: 'general',
      result: null,
      errors: [],
      lbLocked: false,
      lbRatio: 2.0,
      iterationResults: null,
      iterationConfig: {
        varyB: true, bStart: 1.0, bEnd: 3.0, bStep: 0.5,
        varyDf: false, dfStart: 1.0, dfEnd: 3.0, dfStep: 0.5,
      },
      isCalculating: false,
    });
  },

  loadProject: (data) => {
    stratumCounter = data.strata.length;
    // Backfill nuevos campos si vienen de un proyecto antiguo
    const foundationLoaded: FoundationParams = {
      ...defaultFoundation,
      ...data.foundation,
      e1: data.foundation.e1 ?? 0,
      e2: data.foundation.e2 ?? 0,
      Q: data.foundation.Q ?? null,
    };
    const strataLoaded = data.strata.map((s) => ({
      ...s,
      Es: s.Es ?? null,
      mu_s: s.mu_s ?? null,
    }));
    set({
      foundation: foundationLoaded,
      strata: strataLoaded,
      conditions: data.conditions,
      method: data.method,
      selectedCriterion: data.selectedCriterion ?? 'general',
      lbLocked: data.lbLocked ?? false,
      lbRatio: data.lbRatio ?? 2.0,
      iterationConfig: data.iterationConfig ?? {
        varyB: true, bStart: 1.0, bEnd: 3.0, bStep: 0.5,
        varyDf: false, dfStart: 1.0, dfEnd: 3.0, dfStep: 0.5,
      },
      result: null,
      errors: [],
    });
  },
}));
