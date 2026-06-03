
export type FoundationType = 'cuadrada' | 'rectangular' | 'franja' | 'circular';

export type CalculationMethod = 'terzaghi' | 'general' | 'rne';

export type CriterionKey = 'general' | 'rne' | 'rne_corrected';

export interface Stratum {
  id: string;
  thickness: number;
  gamma: number;
  c: number;
  phi: number;
  gammaSat: number;
  Es?: number | null;
  mu_s?: number | null;
  is_clay?: boolean;
  Cc?: number | null;
  Cs?: number | null;
  e0?: number | null;
  sigma_c?: number | null;
  Calpha?: number | null;
  ep?: number | null;
}

export type EffectiveAreaMethod = 'rne' | 'highter_anders';

export type EccentricityInputMode = 'M' | 'e';

export interface FoundationParams {
  type: FoundationType;
  B: number;
  L: number;
  Df: number;
  FS: number;
  beta: number;
  e1: number;
  e2: number;
  M1?: number | null;
  M2?: number | null;
  Q?: number | null;
  metodo_area?: EffectiveAreaMethod;
}

export interface SpecialConditions {
  hasWaterTable: boolean;
  waterTableDepth: number;
  hasBasement: boolean;
  basementDepth: number;
}

export interface BearingFactors {
  Nc: number;
  Nq: number;
  Ngamma: number;
}

export interface ShapeFactors {
  sc: number;
  sq: number;
  sgamma: number;
}

export interface DepthFactors {
  dc: number;
  dq: number;
  dgamma: number;
}

export interface InclinationFactors {
  ic: number;
  iq: number;
  igamma: number;
}

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


export type SettlementPoint = 'centro' | 'esquina';
export type CwMethod = 'peck' | 'teng' | 'bowles' | 'off';

export interface SettlementParams {
  S_max: number;
  point: SettlementPoint;
  rigid: boolean;
  H_rigid?: number | null;
  Cw_method: CwMethod;
  consolidation: boolean;
  mu_s_override?: number | null;
  t1?: number | null;
  t2?: number | null;
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
  Sc_oedometrico?: number | null;
  Sc_oedometrico_mm?: number | null;
  Kcr?: number;
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


export interface EccentricityInfo {
  hasEccentricity: boolean;
  e1: number;
  e2: number;
  M1?: number | null;
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

export interface CalculationResult {
  designStratumIndex: number;
  designStratum: Stratum;

  bearingFactors: BearingFactors;
  shapeFactors: ShapeFactors;
  depthFactors: DepthFactors;
  inclinationFactors: InclinationFactors;

  q: number;
  waterTableCase: number;

  gammaEffective: number;

  qu: number;
  qnet: number;
  qa: number;
  qaNet: number;

  method: CalculationMethod;

  Qmax: number;

  F1: number;
  F2: number;
  F3: number;

  soilType: 'Coh' | 'Fri';

  rneConsideration?: {
    qultRNE: number;
    qadmRNE: number;
    qultRNECorrected: number;
    qadmRNECorrected?: number;
  };

  methodCriteriaMatrix?: Partial<Record<'terzaghi' | 'general' | 'rne', MethodCriteriaBlock>>;

  eccentricity?: EccentricityInfo | null;

  warnings?: string[];

  resolution_md?: string;
}

export interface CalculationInput {
  foundation: FoundationParams;
  strata: Stratum[];
  conditions: SpecialConditions;
  method: CalculationMethod;
}

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

export interface IterationPoint {
  B: number;
  Df: number;
  result: CalculationResult;
  Qmax: number;
}

export interface IterationResult {
  bValues: number[];
  dfValues: number[];
  matrix: IterationPoint[][];
  annotations: string[];
}
