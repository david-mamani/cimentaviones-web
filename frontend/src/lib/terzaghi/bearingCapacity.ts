/**
 * Cálculo de capacidad portante usando múltiples métodos:
 * 1. "terzaghi" — Fórmulas clásicas de Terzaghi con coeficientes fijos
 * 2. "general" — Ecuación general con factores analíticos (Das/Braja)
 * 3. "rne" — Norma E.050 (RNE Perú)
 * 
 * El usuario elige qué método usar.
 */

import type {
  CalculationInput,
  CalculationResult,
  FoundationType,
  Stratum,
} from '../../types/geotechnical';
import { getBearingFactors } from './bearingFactors';
import { getShapeFactors } from './shapeFactors';
import { getDepthFactors } from './depthFactors';
import { getInclinationFactors } from './inclinationFactors';
import { applyWaterTableCorrection } from './waterTableCorrection';
import { calculateQuGeneral as calcGeneral, calculateGeneralRNEConsideration } from './generalMethod';
import { calculateQuRNE, calculateRNEConsideration } from './rneMethod';

/**
 * Determina el estrato de diseño (el que se encuentra al nivel Df).
 */
export function findDesignStratum(
  strata: Stratum[],
  Df: number
): { index: number; stratum: Stratum } {
  let depth = 0;
  for (let i = 0; i < strata.length; i++) {
    depth += strata[i].thickness;
    if (depth >= Df - 0.001) {
      return { index: i, stratum: strata[i] };
    }
  }
  return {
    index: strata.length - 1,
    stratum: strata[strata.length - 1],
  };
}

/**
 * Calcula qu usando las fórmulas clásicas de Terzaghi.
 */
function calculateQuTerzaghi(
  type: FoundationType,
  c: number, Nc: number,
  q: number, Nq: number,
  gamma: number, B: number, Ngamma: number,
  L: number
): { qu: number; F1: number; F2: number; F3: number } {
  let F1: number, F2: number, F3: number;

  switch (type) {
    case 'franja':
      F1 = c * Nc;
      F2 = q * Nq;
      F3 = 0.5 * gamma * B * Ngamma;
      break;
    case 'cuadrada':
      F1 = 1.3 * c * Nc;
      F2 = q * Nq;
      F3 = 0.4 * gamma * B * Ngamma;
      break;
    case 'circular':
      F1 = 1.3 * c * Nc;
      F2 = q * Nq;
      F3 = 0.3 * gamma * B * Ngamma;
      break;
    case 'rectangular':
      F1 = c * Nc * (1 + 0.3 * (B / L));
      F2 = q * Nq;
      F3 = 0.5 * gamma * B * Ngamma * (1 - 0.2 * (B / L));
      break;
    default:
      throw new Error(`Tipo no soportado: ${type}`);
  }

  return { qu: F1 + F2 + F3, F1, F2, F3 };
}

/**
 * Función principal de cálculo. Ejecuta el análisis completo.
 */
export function calculateBearingCapacity(input: CalculationInput): CalculationResult {
  const { foundation, strata, conditions, method } = input;
  const { type, B, L, Df, FS, beta } = foundation;
  const { hasWaterTable, waterTableDepth: Dw, hasBasement, basementDepth: Ds } = conditions;

  // 1. Encontrar estrato de diseño
  const { index: designIndex, stratum: designStratum } = findDesignStratum(strata, Df);
  const isCohesive = designStratum.phi < 20;
  const soilType = isCohesive ? 'Coh' : 'Fri';

  // 2. Corrección por nivel freático → q y γ efectivo
  const waterResult = applyWaterTableCorrection(strata, Df, B, hasWaterTable, Dw, designStratum);

  // 3. Corregir q por sótano
  let q = waterResult.q;
  if (hasBasement && Ds > 0) {
    q = Math.max(q - 24 * Ds, 0);
  }
  const gammaEffective = waterResult.gammaEffective;

  // 4. Factores base (always computed for display)
  const shapeFactors = getShapeFactors(type, B, L);
  const depthFactors = getDepthFactors(designStratum.phi, Df, B);
  const inclinationFactors = getInclinationFactors(beta, designStratum.phi);

  // 5. Calcular según método
  let qu: number;
  let bearingFactors;
  let F1: number, F2: number, F3: number;
  let rneConsideration: CalculationResult['rneConsideration'];

  if (method === 'terzaghi') {
    bearingFactors = getBearingFactors(designStratum.phi);
    const tResult = calculateQuTerzaghi(
      type, designStratum.c, bearingFactors.Nc,
      q, bearingFactors.Nq,
      gammaEffective, B, bearingFactors.Ngamma, L
    );
    qu = tResult.qu;
    F1 = tResult.F1;
    F2 = tResult.F2;
    F3 = tResult.F3;

    // RNE consideration for Terzaghi
    if (isCohesive) {
      const rneQult = 1.3 * designStratum.c * 5.7;
      const rneQultC = rneQult + q * 1;
      rneConsideration = {
        qultRNE: rneQult,
        qadmRNE: rneQult / FS,
        qultRNECorrected: rneQultC,
      };
    } else {
      rneConsideration = {
        qultRNE: F2 + F3,
        qadmRNE: (F2 + F3) / FS,
        qultRNECorrected: F2 + F3,
      };
    }

  } else if (method === 'general') {
    const gResult = calcGeneral(
      designStratum.c, q, gammaEffective, B, L,
      designStratum.phi, beta, Df
    );
    qu = gResult.qu;
    bearingFactors = {
      Nc: gResult.factors.Nc,
      Nq: gResult.factors.Nq,
      Ngamma: gResult.factors.Ngamma,
    };
    // Extract F1, F2, F3
    F1 = designStratum.c * gResult.factors.Nc * gResult.factors.Fcs * gResult.factors.Fcd * gResult.factors.Fci;
    F2 = q * gResult.factors.Nq * gResult.factors.Fqs * gResult.factors.Fqd * gResult.factors.Fqi;
    F3 = 0.5 * gammaEffective * B * gResult.factors.Ngamma * gResult.factors.Fgs * gResult.factors.Fgd * gResult.factors.Fgi;

    // RNE consideration for General
    const rneC = calculateGeneralRNEConsideration(
      designStratum.c, q, gammaEffective, B, L,
      designStratum.phi, beta, Df, isCohesive
    );
    rneConsideration = {
      qultRNE: rneC.qultRNE,
      qadmRNE: rneC.qultRNE / FS,
      qultRNECorrected: rneC.qultRNECorrected,
    };

  } else {
    // RNE method
    const rResult = calculateQuRNE(
      designStratum.c, q, gammaEffective, B, L,
      designStratum.phi, beta
    );
    qu = rResult.qu;
    bearingFactors = {
      Nc: rResult.factors.Nc,
      Nq: rResult.factors.Nq,
      Ngamma: rResult.factors.Ngamma,
    };
    F1 = rResult.factors.Sc * rResult.factors.ic * designStratum.c * rResult.factors.Nc;
    F2 = rResult.factors.iq * q * rResult.factors.Nq;
    F3 = 0.5 * rResult.factors.Sgamma * rResult.factors.igamma * gammaEffective * B * rResult.factors.Ngamma;

    const rneC = calculateRNEConsideration(
      designStratum.c, q, gammaEffective, B, L,
      designStratum.phi, beta, Df, isCohesive
    );
    rneConsideration = {
      qultRNE: rneC.qultRNE,
      qadmRNE: rneC.qultRNE / FS,
      qultRNECorrected: rneC.qultRNECorrected,
    };
  }

  // 6. Valores derivados
  const qnet = qu - q;
  const qa = qu / FS;
  const qaNet = qnet / FS;
  const Qmax = qa * B * L;

  return {
    designStratumIndex: designIndex,
    designStratum,
    bearingFactors,
    shapeFactors,
    depthFactors,
    inclinationFactors,
    q,
    waterTableCase: waterResult.case,
    gammaEffective,
    qu,
    qnet,
    qa,
    qaNet,
    method,
    Qmax,
    F1,
    F2,
    F3,
    soilType,
    rneConsideration,
  };
}
