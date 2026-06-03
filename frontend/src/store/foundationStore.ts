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
  EccentricityInputMode,
  SettlementParams,
  SettlementResult,
  SettlementIterationResult,
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

  // Modo de entrada de excentricidad: 'M' (momentos) o 'e' (excentricidades)
  eccentricityInputMode: EccentricityInputMode;

  // Bloque de asentamientos
  settlementParams: SettlementParams;
  settlementResult: SettlementResult | null;
  settlementIteration: SettlementIterationResult | null;
  isCalculatingSettlement: boolean;

  // Iteration results (for PDF export)
  iterationResults: IterationResult | null;

  // Iteration config
  iterationConfig: IterationConfig;
  parametricUiConfig: ParametricUiConfig;
  settlementUiConfig: SettlementUiConfig;
  compareSettlementConfig: CompareSettlementConfig;

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

  // Acciones - modo de excentricidad
  setEccentricityInputMode: (mode: EccentricityInputMode) => void;

  // Acciones - asentamientos
  setSettlementParam: <K extends keyof SettlementParams>(key: K, value: SettlementParams[K]) => void;
  calculateSettlement: () => void;
  calculateSettlementIteration: (B_start: number, B_end: number, B_step: number) => void;
  clearSettlement: () => void;

  // Acciones - Cálculo
  calculate: () => void;
  setErrors: (errors: string[]) => void;
  clearResult: () => void;
  reset: () => void;

  // Acciones - Iterations
  setIterationResults: (data: IterationResult) => void;
  clearIterationResults: () => void;
  setIterationConfig: (config: IterationConfig) => void;
  setParametricUiConfig: (config: Partial<ParametricUiConfig>) => void;
  setSettlementUiConfig: (config: Partial<SettlementUiConfig>) => void;
  setCompareSettlementConfig: (config: CompareSettlementConfig) => void;

  // Acciones - Proyecto
  loadProject: (data: ProjectData) => void;
}

/** Configuración de iteraciones paramétricas */
export interface IterationConfig {
  varyB: boolean; bStart: number; bEnd: number; bStep: number;
  varyDf: boolean; dfStart: number; dfEnd: number; dfStep: number;
}

export interface ParametricUiConfig {
  familyMode: boolean;
  familyRatios: number[];
  chartMetric: 'qa' | 'Qmax';
}

export interface SettlementRange1D {
  B_start: number;
  B_end: number;
  B_step: number;
}

export interface SettlementRange2D extends SettlementRange1D {
  Df_start: number;
  Df_end: number;
  Df_step: number;
}

export interface SettlementUiConfig {
  viewMode: 'perfil' | 'qadm' | 'qadm2d';
  iterRange: SettlementRange1D;
  iter2D: SettlementRange2D;
}

export interface CompareSettlementFooting {
  id: string;
  B: number;
  L: number;
  Df: number;
  Q: number;
}

export interface CompareSettlementConfig {
  footings: CompareSettlementFooting[];
  spans: number[][];
}

/** Datos serializables del proyecto */
export interface ProjectData {
  foundation: FoundationParams;
  strata: Stratum[];
  conditions: SpecialConditions;
  method: CalculationMethod;
  lbLocked?: boolean;
  lbRatio?: number;
  eccentricityInputMode?: EccentricityInputMode;
  iterationConfig?: IterationConfig;
  selectedCriterion?: CriterionKey;
  settlementParams?: SettlementParams;
  parametricUiConfig?: ParametricUiConfig;
  settlementUiConfig?: SettlementUiConfig;
  compareSettlementConfig?: CompareSettlementConfig;
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
  M1: null,
  M2: null,
  Q: null,
  metodo_area: 'rne',
};

const defaultConditions: SpecialConditions = {
  hasWaterTable: false,
  waterTableDepth: 0,
  hasBasement: false,
  basementDepth: 0,
};

const defaultSettlementParams: SettlementParams = {
  S_max: 0.025,           // 25 mm
  point: 'centro',
  rigid: false,
  H_rigid: null,
  Cw_method: 'peck',
  consolidation: false,
  mu_s_override: null,
  t1: null,
  t2: null,
  Kcr: 1.0,
};

const defaultIterationConfig: IterationConfig = {
  varyB: true, bStart: 1.0, bEnd: 3.0, bStep: 0.5,
  varyDf: false, dfStart: 1.0, dfEnd: 3.0, dfStep: 0.5,
};

const defaultParametricUiConfig: ParametricUiConfig = {
  familyMode: false,
  familyRatios: [1, 2, 3, 5, 10],
  chartMetric: 'qa',
};

const defaultSettlementUiConfig: SettlementUiConfig = {
  viewMode: 'perfil',
  iterRange: { B_start: 1.0, B_end: 3.0, B_step: 0.2 },
  iter2D: {
    B_start: 1.0, B_end: 3.0, B_step: 0.2,
    Df_start: 1.0, Df_end: 3.0, Df_step: 0.2,
  },
};

const defaultCompareSettlementConfig: CompareSettlementConfig = {
  footings: [
    { id: 'Z1', B: 1.6, L: 2.0, Df: 1.6, Q: 50 },
    { id: 'Z2', B: 1.6, L: 2.0, Df: 1.6, Q: 70 },
  ],
  spans: [
    [0, 5.8],
    [5.8, 0],
  ],
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
    is_clay: false,
    Cc: null,
    Cs: null,
    e0: null,
    sigma_c: null,
    Calpha: null,
    ep: null,
  };
}

// Constante de conversión Métrico ↔ SI
const G = 9.80665;

/**
 * Serializa estratos a SI para enviar al backend.
 * Conversiones:
 *   - γ, γsat: t/m³ → kN/m³ (×G)
 *   - c, σ'c: t/m² → kPa (×G)
 *   - Es: t/m² → kPa (×G)
 *   - φ, μs, Cc, Cs, e0, Cα, ep, is_clay: adimensionales (sin conversión)
 * Los campos opcionales se omiten si vienen `null`/`undefined`.
 */
function serializeStratumForAPI(s: Stratum): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: s.id,
    thickness: s.thickness,
    gamma: s.gamma * G,
    c: s.c * G,
    phi: s.phi,
    gammaSat: s.gammaSat * G,
  };
  if (typeof s.Es === 'number' && s.Es > 0) out.Es = s.Es * G;
  if (typeof s.mu_s === 'number') out.mu_s = s.mu_s;
  if (s.is_clay) out.is_clay = true;
  if (typeof s.Cc === 'number' && s.Cc > 0) out.Cc = s.Cc;
  if (typeof s.Cs === 'number' && s.Cs > 0) out.Cs = s.Cs;
  if (typeof s.e0 === 'number' && s.e0 > 0) out.e0 = s.e0;
  if (typeof s.sigma_c === 'number' && s.sigma_c > 0) out.sigma_c = s.sigma_c * G;
  if (typeof s.Calpha === 'number' && s.Calpha > 0) out.Calpha = s.Calpha;
  if (typeof s.ep === 'number' && s.ep > 0) out.ep = s.ep;
  return out;
}

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
  eccentricityInputMode: 'M',
  settlementParams: { ...defaultSettlementParams },
  settlementResult: null,
  settlementIteration: null,
  isCalculatingSettlement: false,
  iterationResults: null,
  iterationConfig: { ...defaultIterationConfig },
  parametricUiConfig: { ...defaultParametricUiConfig },
  settlementUiConfig: {
    ...defaultSettlementUiConfig,
    iterRange: { ...defaultSettlementUiConfig.iterRange },
    iter2D: { ...defaultSettlementUiConfig.iter2D },
  },
  compareSettlementConfig: {
    footings: defaultCompareSettlementConfig.footings.map((f) => ({ ...f })),
    spans: defaultCompareSettlementConfig.spans.map((row) => [...row]),
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

  setEccentricityInputMode: (mode) => {
    set({ eccentricityInputMode: mode, result: null });
  },

  setSettlementParam: (key, value) => {
    set((state) => ({
      settlementParams: { ...state.settlementParams, [key]: value },
      settlementResult: null,
    }));
  },

  clearSettlement: () => set({
    settlementResult: null,
    settlementIteration: null,
  }),

  calculateSettlement: async () => {
    if (get().isCalculatingSettlement) return;
    set({ isCalculatingSettlement: true });
    const state = get();

    // Conversión Métrico → SI
    const strataForAPI = state.strata.map(serializeStratumForAPI);

    const f = state.foundation;
    const foundationForAPI: any = {
      type: f.type,
      B: f.B,
      L: f.L,
      Df: f.Df,
      FS: f.FS,
      beta: f.beta,
      e1: f.e1 ?? 0,
      e2: f.e2 ?? 0,
    };
    if (typeof f.Q === 'number' && f.Q > 0) {
      foundationForAPI.Q = f.Q * G;
    }

    // qadm_falla (kPa) si ya hay resultado del bloque de capacidad
    const qadm_falla_kPa = state.result?.qa ?? null;

    try {
      const response = await fetch('/api/calculate-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foundation: foundationForAPI,
          strata: strataForAPI,
          conditions: state.conditions,
          settlement: state.settlementParams,
          ...(qadm_falla_kPa ? { qadm_falla: qadm_falla_kPa } : {}),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${response.status}`);
      }
      const result = await response.json();
      set({ settlementResult: result, isCalculatingSettlement: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido en asentamientos';
      set({
        errors: [message],
        settlementResult: null,
        isCalculatingSettlement: false,
      });
    }
  },

  calculateSettlementIteration: async (B_start, B_end, B_step) => {
    const state = get();
    const strataForAPI = state.strata.map(serializeStratumForAPI);
    const f = state.foundation;
    const foundationForAPI: any = {
      type: f.type, B: f.B, L: f.L, Df: f.Df, FS: f.FS,
      beta: f.beta, e1: f.e1 ?? 0, e2: f.e2 ?? 0,
    };
    const qadm_falla_kPa = state.result?.qa ?? null;
    try {
      const response = await fetch('/api/iterate-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foundation: foundationForAPI,
          strata: strataForAPI,
          conditions: state.conditions,
          settlement: state.settlementParams,
          B_start, B_end, B_step,
          ...(qadm_falla_kPa ? { qadm_falla: qadm_falla_kPa } : {}),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${response.status}`);
      }
      const data = await response.json();
      set({ settlementIteration: data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido en iteración asentamiento';
      set({ errors: [message], settlementIteration: null });
    }
  },

  calculate: async () => {
    if (get().isCalculating) return;
    set({ isCalculating: true, errors: [] });
    const state = get();

    // Conversión Métrico → SI antes de enviar al motor
    const strataForAPI = state.strata.map(serializeStratumForAPI);

    const f = state.foundation;
    const mode = state.eccentricityInputMode;
    // En modo "M" enviamos M1, M2 (tnf·m → kN·m × G) y dejamos que el
    // motor derive e1=M1/Q, e2=M2/Q. En modo "e" enviamos e1, e2 directos.
    const eccentricityPayload =
      mode === 'M'
        ? {
            e1: 0,
            e2: 0,
            ...(typeof f.M1 === 'number' && f.M1 > 0 ? { M1: f.M1 * G } : {}),
            ...(typeof f.M2 === 'number' && f.M2 > 0 ? { M2: f.M2 * G } : {}),
          }
        : { e1: f.e1 ?? 0, e2: f.e2 ?? 0 };

    const foundationForAPI = {
      type: f.type,
      B: f.B,
      L: f.L,
      Df: f.Df,
      FS: f.FS,
      beta: f.beta,
      ...eccentricityPayload,
      // Q: tnf → kN (multiplicar por G). Si no fue provista, se omite.
      ...(typeof f.Q === 'number' && f.Q > 0 ? { Q: f.Q * G } : {}),
      ...(f.metodo_area ? { metodo_area: f.metodo_area } : {}),
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
  setParametricUiConfig: (config) => set((state) => ({
    parametricUiConfig: { ...state.parametricUiConfig, ...config },
  })),
  setSettlementUiConfig: (config) => set((state) => ({
    settlementUiConfig: {
      ...state.settlementUiConfig,
      ...config,
      iterRange: config.iterRange
        ? { ...state.settlementUiConfig.iterRange, ...config.iterRange }
        : state.settlementUiConfig.iterRange,
      iter2D: config.iter2D
        ? { ...state.settlementUiConfig.iter2D, ...config.iter2D }
        : state.settlementUiConfig.iter2D,
    },
  })),
  setCompareSettlementConfig: (config) => set({
    compareSettlementConfig: {
      footings: config.footings.map((f) => ({ ...f })),
      spans: config.spans.map((row) => [...row]),
    },
  }),

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
      eccentricityInputMode: 'M',
      settlementParams: { ...defaultSettlementParams },
      settlementResult: null,
      settlementIteration: null,
      isCalculatingSettlement: false,
      iterationResults: null,
      iterationConfig: { ...defaultIterationConfig },
      parametricUiConfig: { ...defaultParametricUiConfig },
      settlementUiConfig: {
        ...defaultSettlementUiConfig,
        iterRange: { ...defaultSettlementUiConfig.iterRange },
        iter2D: { ...defaultSettlementUiConfig.iter2D },
      },
      compareSettlementConfig: {
        footings: defaultCompareSettlementConfig.footings.map((f) => ({ ...f })),
        spans: defaultCompareSettlementConfig.spans.map((row) => [...row]),
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
      M1: data.foundation.M1 ?? null,
      M2: data.foundation.M2 ?? null,
      Q: data.foundation.Q ?? null,
      metodo_area: data.foundation.metodo_area ?? 'rne',
    };
    const strataLoaded = data.strata.map((s) => ({
      ...s,
      Es: s.Es ?? null,
      mu_s: s.mu_s ?? null,
      is_clay: s.is_clay ?? false,
      Cc: s.Cc ?? null,
      Cs: s.Cs ?? null,
      e0: s.e0 ?? null,
      sigma_c: s.sigma_c ?? null,
      Calpha: s.Calpha ?? null,
      ep: s.ep ?? null,
    }));
    set({
      foundation: foundationLoaded,
      strata: strataLoaded,
      conditions: data.conditions,
      method: data.method,
      selectedCriterion: data.selectedCriterion ?? 'general',
      lbLocked: data.lbLocked ?? false,
      lbRatio: data.lbRatio ?? 2.0,
      eccentricityInputMode: data.eccentricityInputMode ?? 'M',
      settlementParams: { ...defaultSettlementParams, ...(data.settlementParams ?? {}) },
      iterationConfig: data.iterationConfig ?? { ...defaultIterationConfig },
      parametricUiConfig: {
        ...defaultParametricUiConfig,
        ...(data.parametricUiConfig ?? {}),
        familyRatios: data.parametricUiConfig?.familyRatios ?? defaultParametricUiConfig.familyRatios,
      },
      settlementUiConfig: {
        ...defaultSettlementUiConfig,
        ...(data.settlementUiConfig ?? {}),
        iterRange: {
          ...defaultSettlementUiConfig.iterRange,
          ...(data.settlementUiConfig?.iterRange ?? {}),
        },
        iter2D: {
          ...defaultSettlementUiConfig.iter2D,
          ...(data.settlementUiConfig?.iter2D ?? {}),
        },
      },
      compareSettlementConfig: {
        footings: (data.compareSettlementConfig?.footings ?? defaultCompareSettlementConfig.footings)
          .map((f) => ({ ...f })),
        spans: (data.compareSettlementConfig?.spans ?? defaultCompareSettlementConfig.spans)
          .map((row) => [...row]),
      },
      result: null,
      errors: [],
    });
  },
}));
