/**
 * Tipos e interfaces para el análisis geotécnico de cimentaciones.
 * Basado en la teoría de Terzaghi y extensiones de Meyerhof/Hansen.
 */

/** Tipos de cimentación soportados */
export type FoundationType = 'cuadrada' | 'rectangular' | 'franja' | 'circular';

/** Método de cálculo */
export type CalculationMethod = 'terzaghi' | 'general' | 'rne';

/** Estrato de suelo individual */
export interface Stratum {
  id: string;
  thickness: number;   // Espesor (m)
  gamma: number;       // Peso unitario natural γ (kN/m³)
  c: number;           // Cohesión c (kPa)
  phi: number;         // Ángulo de fricción interna φ (°)
  gammaSat: number;    // Peso unitario saturado γsat (kN/m³)
}

/** Parámetros de cimentación */
export interface FoundationParams {
  type: FoundationType;
  B: number;           // Ancho o lado (m)
  L: number;           // Longitud (m) — solo para rectangular
  Df: number;          // Profundidad de desplante (m)
  FS: number;          // Factor de seguridad
  beta: number;        // Ángulo de inclinación de carga β (°)
}

/** Condiciones especiales */
export interface SpecialConditions {
  hasWaterTable: boolean;
  waterTableDepth: number;  // Dw (m)
  hasBasement: boolean;
  basementDepth: number;    // Ds (m)
}

/** Factores de capacidad portante de Terzaghi */
export interface BearingFactors {
  Nc: number;
  Nq: number;
  Ngamma: number;
}

/** Factores de forma (Meyerhof) */
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

/** Resultado completo del cálculo */
export interface CalculationResult {
  // Estrato de diseño
  designStratumIndex: number;
  designStratum: Stratum;

  // Factores
  bearingFactors: BearingFactors;
  shapeFactors: ShapeFactors;
  depthFactors: DepthFactors;
  inclinationFactors: InclinationFactors;

  // Sobrecarga
  q: number;              // Sobrecarga efectiva (kPa)
  waterTableCase: number; // Caso de NF aplicado (0=sin NF, 1-4)

  // Peso unitario efectivo para el tercer término
  gammaEffective: number;

  // Resultados finales
  qu: number;             // Capacidad portante última (kPa)
  qnet: number;           // Capacidad portante neta última (kPa)
  qa: number;             // Capacidad portante admisible (kPa)
  qaNet: number;          // Capacidad portante neta admisible (kPa)

  // Método usado
  method: CalculationMethod;

  // Q_max
  Qmax: number;             // Q_max = qa × B × L (kN)

  // Términos individuales F1, F2, F3
  F1: number;
  F2: number;
  F3: number;

  // Tipo de suelo
  soilType: 'Coh' | 'Fri';  // Cohesivo (φ<20°) o Friccionante

  // Consideración RNE
  rneConsideration?: {
    qultRNE: number;
    qadmRNE: number;
    qultRNECorrected: number;
  };
}

/** Input completo para el cálculo */
export interface CalculationInput {
  foundation: FoundationParams;
  strata: Stratum[];
  conditions: SpecialConditions;
  method: CalculationMethod;
}
