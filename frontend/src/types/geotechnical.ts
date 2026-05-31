/**
 * Tipos e interfaces para el análisis geotécnico de cimentaciones.
 * Basado en la teoría de Terzaghi y extensiones de Meyerhof/Hansen.
 *
 * NOTA SOBRE UNIDADES:
 * - Los valores en el store del frontend se almacenan en las unidades de INPUT del usuario.
 * - Antes de enviar al backend, se convierten a SI vía inputToSI().
 * - Los resultados del backend siempre llegan en SI.
 * - Para mostrar resultados, se convierten a unidades de OUTPUT vía siToOutput().
 */

/** Tipos de cimentación soportados */
export type FoundationType = 'cuadrada' | 'rectangular' | 'franja' | 'circular';

/** Método de cálculo */
export type CalculationMethod = 'terzaghi' | 'general' | 'rne';

/** Criterio de aplicación de sumandos */
export type CriterionKey = 'general' | 'rne' | 'rne_corrected';

/** Estrato de suelo individual */
export interface Stratum {
  id: string;
  thickness: number;   // Espesor (unidades de input: length)
  gamma: number;       // Peso unitario natural γ (unidades de input: unitWeight)
  c: number;           // Cohesión c (unidades de input: pressure)
  phi: number;         // Ángulo de fricción interna φ (°)
  gammaSat: number;    // Peso unitario saturado γsat (unidades de input: unitWeight)
  // Asentamiento elástico
  Es?: number | null;  // Módulo de elasticidad (input: pressure, métrico t/m²) — opcional
  mu_s?: number | null;// Relación de Poisson (adim.) — opcional
  // Consolidación primaria (Das §2.7 / 8.2)
  is_clay?: boolean;          // Marca este estrato como arcilla (activa Sc)
  Cc?: number | null;         // Índice de compresión
  Cs?: number | null;         // Índice de recompresión
  e0?: number | null;         // Relación de vacíos inicial
  sigma_c?: number | null;    // σ'c preconsolidación (input: pressure, métrico t/m²)
  // Consolidación secundaria (Das Ecs. 9.91–9.92)
  Calpha?: number | null;     // Índice de compresión secundaria
  ep?: number | null;         // Relación de vacíos al fin de la consolidación primaria
}

/** Método para el área efectiva ante excentricidad */
export type EffectiveAreaMethod = 'rne' | 'highter_anders';

/** Modo de entrada de excentricidad */
export type EccentricityInputMode = 'M' | 'e';

/** Parámetros de cimentación */
export interface FoundationParams {
  type: FoundationType;
  B: number;           // Ancho o lado (unidades de input: length)
  L: number;           // Longitud (unidades de input: length) — solo para rectangular
  Df: number;          // Profundidad de desplante (unidades de input: length)
  FS: number;          // Factor de seguridad
  beta: number;        // Ángulo de inclinación de carga β (°)
  // Convención profesor / RNE:
  //   e1 = M1/Q (M1 sobre eje 1 horizontal) → reduce L
  //   e2 = M2/Q (M2 sobre eje 2 vertical)   → reduce B
  e1: number;          // Excentricidad que reduce L (m), default 0
  e2: number;          // Excentricidad que reduce B (m), default 0
  M1?: number | null;  // Momento M1 = M_x (input: force·length, métrico tnf·m)
  M2?: number | null;  // Momento M2 = M_y (input: force·length, métrico tnf·m)
  Q?: number | null;   // Carga aplicada (input: force, métrico tnf) — opcional
  // Método de cálculo del área efectiva ante excentricidad biaxial:
  //   "rne"            : RNE/Meyerhof (B' = B − 2e2, L' = L − 2e1) — default.
  //   "highter_anders" : H&A 1985 (4 casos). Casos II/III/IV requieren tablas
  //                      digitalizadas (pendientes); fallback automático a RNE.
  metodo_area?: EffectiveAreaMethod;
}

/** Condiciones especiales */
export interface SpecialConditions {
  hasWaterTable: boolean;
  waterTableDepth: number;  // Dw (m)
  hasBasement: boolean;
  basementDepth: number;    // Ds (m)
}

/** Factores de capacidad portante */
export interface BearingFactors {
  Nc: number;
  Nq: number;
  Ngamma: number;
}

/** Factores de forma */
export interface ShapeFactors {
  sc: number;
  sq: number;
  sgamma: number;
}

/** Factores de profundidad */
export interface DepthFactors {
  dc: number;
  dq: number;
  dgamma: number;
}

/** Factores de inclinación */
export interface InclinationFactors {
  ic: number;
  iq: number;
  igamma: number;
}

/** Resultado de un par método×criterio enriquecido con conversiones */
export interface EnrichedCriterionResult {
  qu: number;
  qa: number;
  qu_kPa: number;
  qu_tm2: number;
  qu_kgcm2: number;
  qa_kPa: number;
  qa_tm2: number;
  qa_kgcm2: number;
  Qmax: number;
}

/** Bloque por método con sus 3 criterios */
export interface MethodCriteriaBlock {
  S1: number;
  S2: number;
  S3: number;
  qu: number;
  factors: {
    Nc: number; Nq: number; Ngamma: number;
    Fcs?: number; Fqs?: number; Fgs?: number;
    Fcd?: number; Fqd?: number; Fgd?: number;
    Fci?: number; Fqi?: number; Fgi?: number;
    coef_c?: number; coef_gamma?: number;
    [k: string]: number | undefined;
  };
  criteria: Record<CriterionKey, EnrichedCriterionResult>;
}

/* ──────────────────────────────────────────────────────────────────
 * Asentamientos (Steinbrenner + Fox + Cw + Sc)  — MOTOR_ASENTAMIENTOS.md
 * ────────────────────────────────────────────────────────────────── */

export type SettlementPoint = 'centro' | 'esquina';
export type CwMethod = 'peck' | 'teng' | 'bowles' | 'off';

export interface SettlementParams {
  S_max: number;                // m (admisible)
  point: SettlementPoint;
  rigid: boolean;
  H_rigid?: number | null;      // m (manual; null ⇒ auto)
  Cw_method: CwMethod;
  consolidation: boolean;
  mu_s_override?: number | null;
  // Consolidación secundaria — tiempos globales en AÑOS.
  // Activa Sc_s si ambos > 0 y t2 > t1, y al menos un estrato arcilloso
  // tiene Cα y e_p definidos.
  t1?: number | null;
  t2?: number | null;
  // Factor de corrección 3D Skempton–Bjerrum para consolidación primaria.
  // Default 1.0; override manual hasta que se digitalice el ábaco.
  Kcr?: number;
}

export interface SettlementLayerContribution {
  stratum_index: number;
  Es: number;
  h_eff: number;
  weight: number;
}

export interface ConsolidationLayerResult {
  stratum_index: number;
  case: 'NC' | 'OC1' | 'OC2';
  Sc: number;
  Sc_mm: number;
  Hc_used: number;
  dsigma_av: number;
  formula_used: string;
  sigma_p0: number;
  sigma_final?: number;
  sigma_c?: number;
}

export interface SecondaryConsolidationLayerResult {
  stratum_index: number;
  Sc_s: number;
  Sc_s_mm: number;
  C_alpha_prime: number;
  Hc: number;
  t1: number;
  t2: number;
  formula_used: string;
}

export interface ElasticSettlementBlock {
  Se: number;
  Se_mm: number;
  Se_corr: number;
  Se_corr_mm: number;
  alpha: 1 | 4;
  B_used: number;
  m_prime: number;
  n_prime: number;
  point: SettlementPoint;
  rigid: boolean;
  rigid_factor: number | null;
  Is: number;
  F1: number;
  F2: number;
  A0: number;
  A1: number;
  A2: number;
  arctan_correction_applied: boolean;
  If: number;
  Df_over_B: number;
  L_over_B: number;
  If_out_of_range: boolean;
}

export interface DesignBlock {
  qadm_diseno: number;
  criterio_gobernante: 'falla_por_corte' | 'asentamiento';
  qadm_falla: number;
  qadm_settlement: number;
}

export interface SettlementResult {
  z_bar: number;
  H: number;
  H_auto_detected: boolean;
  H_rigid_layer_index: number | null;
  Es_eq: number;
  Es_data: {
    Es_eq: number;
    h_total_used: number;
    z_top: number;
    z_bot: number;
    layers: SettlementLayerContribution[];
  };
  mu_used: number;
  mu_source: 'override' | 'estrato_bajo_base' | 'default';
  Cw: number;
  Cw_method: CwMethod;
  Cw_label: string;
  Cw_forced_max: boolean;
  Cw_applied: boolean;
  point: SettlementPoint;
  rigid: boolean;
  elastic: ElasticSettlementBlock | null;
  Se: number | null;
  Se_mm: number | null;
  Se_corr: number | null;
  Se_corr_mm: number | null;
  consolidation_layers: ConsolidationLayerResult[];
  Sc: number | null;
  Sc_mm: number | null;
  // Consolidación primaria sin ajuste 3D Skempton–Bjerrum (Kcr); Sc = Sc_oedometrico · Kcr.
  Sc_oedometrico?: number | null;
  Sc_oedometrico_mm?: number | null;
  Kcr?: number;
  // Consolidación secundaria (Das Ecs. 9.91–9.92)
  secondary_layers?: SecondaryConsolidationLayerResult[];
  Sc_s?: number | null;
  Sc_s_mm?: number | null;
  t1?: number | null;
  t2?: number | null;
  S_total: number | null;
  S_total_mm: number | null;
  S_max: number;
  S_max_mm: number;
  Se_ok: boolean | null;
  qadm_settlement: number;
  qadm_falla: number | null;
  design: DesignBlock | null;
  FS_real_falla: number | null;
  q_aplicada_net?: number | null;
  warnings: string[];
}

export interface SettlementIterationRow {
  B: number;
  L: number;
  z_bar: number;
  Es_eq: number;
  mu_used: number;
  Cw: number;
  qadm_settlement: number;
  qadm_falla: number | null;
  qadm_diseno: number | null;
  criterio_gobernante: 'falla_por_corte' | 'asentamiento' | null;
  S_total_mm: number | null;
  Se_ok: boolean | null;
}

export interface SettlementIterationResult {
  rows: SettlementIterationRow[];
  B_start: number;
  B_end: number;
  B_step: number;
}


/** Información de excentricidad (bloque 11 del flujo) */
export interface EccentricityInfo {
  hasEccentricity: boolean;
  e1: number;          // reduce L
  e2: number;          // reduce B
  M1?: number | null;  // si el cálculo se hizo con momentos (kN·m, SI)
  M2?: number | null;
  Q: number | null;
  B_eff: number;
  L_eff: number;
  A_eff: number;
  regime: 'uniforme' | 'trapezoidal' | 'triangular';
  caso_carga?: 'uniaxial' | 'biaxial' | null;
  dentro_kern?: boolean | null;
  kern_metric?: number | null;
  intercambio_aplicado?: boolean;
  metodo_area?: EffectiveAreaMethod;
  metodo_area_solicitado?: EffectiveAreaMethod;
  caso_HA?: 'I' | 'II' | 'III' | 'IV' | null;
  qmax: number | null;
  qmin: number | null;
  Qu: number;
  FS_real: number | null;
  valid: boolean | null;
}

/** Resultado completo del cálculo */
export interface CalculationResult {
  // Estrato de diseño
  designStratumIndex: number;
  designStratum: Stratum;

  // Factores (método activo)
  bearingFactors: BearingFactors;
  shapeFactors: ShapeFactors;
  depthFactors: DepthFactors;
  inclinationFactors: InclinationFactors;

  // Sobrecarga
  q: number;              // Sobrecarga efectiva (kPa)
  waterTableCase: number; // Caso de NF aplicado (0=sin NF, 1-4)

  // Peso unitario efectivo para el tercer término
  gammaEffective: number;

  // Resultados finales (siempre en SI desde el backend) — método activo, criterio General
  qu: number;             // Capacidad portante última (SI: kPa)
  qnet: number;           // Capacidad portante neta última (SI: kPa)
  qa: number;             // Capacidad portante admisible (SI: kPa)
  qaNet: number;          // Capacidad portante neta admisible (SI: kPa)

  // Método usado
  method: CalculationMethod;

  // Q_max
  Qmax: number;             // Q_max = qa × B × L (SI: kN)

  // Términos individuales F1, F2, F3 (= S1, S2, S3 del método activo)
  F1: number;
  F2: number;
  F3: number;

  // Tipo de suelo (φ ≤ 20° = Coh)
  soilType: 'Coh' | 'Fri';

  // Consideración RNE (método activo aplicado con criterios RNE / RNE-Corregido)
  rneConsideration?: {
    qultRNE: number;
    qadmRNE: number;
    qultRNECorrected: number;
    qadmRNECorrected?: number;
  };

  // Matriz 3×3 método × criterio (9 combinaciones)
  methodCriteriaMatrix?: Partial<Record<'terzaghi' | 'general' | 'rne', MethodCriteriaBlock>>;

  // Información de excentricidad (null si no hay e1, e2 ni Q)
  eccentricity?: EccentricityInfo | null;

  // Advertencias del motor de cálculo (condiciones inusuales)
  warnings?: string[];

  // Resolución paso a paso en Markdown/LaTeX
  resolution_md?: string;
}

/** Input completo para el cálculo */
export interface CalculationInput {
  foundation: FoundationParams;
  strata: Stratum[];
  conditions: SpecialConditions;
  method: CalculationMethod;
}

/** Configuración de iteraciones paramétricas */
export interface IterationConfig {
  varyB: boolean;
  bStart: number;
  bEnd: number;
  bStep: number;
  varyDf: boolean;
  dfStart: number;
  dfEnd: number;
  dfStep: number;
}

/** Punto individual de una iteración */
export interface IterationPoint {
  B: number;
  Df: number;
  result: CalculationResult;
  Qmax: number;
}

/** Resultado completo de iteraciones paramétricas */
export interface IterationResult {
  bValues: number[];
  dfValues: number[];
  matrix: IterationPoint[][];
  annotations: string[];
}
