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
  Es?: number | null;  // Módulo de elasticidad (input: pressure, métrico t/m²) — opcional
  mu_s?: number | null;// Relación de Poisson (adim.) — opcional
}

/** Parámetros de cimentación */
export interface FoundationParams {
  type: FoundationType;
  B: number;           // Ancho o lado (unidades de input: length)
  L: number;           // Longitud (unidades de input: length) — solo para rectangular
  Df: number;          // Profundidad de desplante (unidades de input: length)
  FS: number;          // Factor de seguridad
  beta: number;        // Ángulo de inclinación de carga β (°)
  e1: number;          // Excentricidad en dirección B (m), default 0
  e2: number;          // Excentricidad en dirección L (m), default 0
  Q?: number | null;   // Carga aplicada (input: force, métrico tnf) — opcional
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

/** Información de excentricidad (bloque 11 del flujo) */
export interface EccentricityInfo {
  hasEccentricity: boolean;
  e1: number;
  e2: number;
  Q: number | null;
  B_eff: number;
  L_eff: number;
  A_eff: number;
  regime: 'uniforme' | 'trapezoidal' | 'triangular';
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
