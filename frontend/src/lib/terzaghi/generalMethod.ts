/**
 * "Ecuación General" — Factores analíticos de Das/Braja.
 * 
 * A diferencia del método Terzaghi que usa tabla, la Ecuación General
 * calcula Nc, Nq, Nγ analíticamente:
 * 
 *   Nq = tan²(45 + φ/2) · e^(π·tan(φ))
 *   Nc = (Nq - 1) · cot(φ)
 *   Nγ = 2·(Nq + 1)·tan(φ)
 * 
 * Caso φ = 0: Nq = 1, Nc = 5.14, Nγ = 0
 * 
 * Factores de forma (Das):
 *   Fcs = 1 + (B/L)·(Nq/Nc)
 *   Fqs = 1 + (B/L)·tan(φ)
 *   Fγs = 1 - 0.4·(B/L)
 * 
 * Factores de profundidad (Das):
 *   Si Df/B ≤ 1:
 *     Fcd = 1 + 0.4·(Df/B)                               [φ = 0]
 *     Fqd = 1 + 2·tan(φ)·(1-sin(φ))²·(Df/B)              [φ > 0]
 *     Fcd = Fqd - (1-Fqd)/(Nc·tan(φ))                     [φ > 0]
 *     Fγd = 1
 *   Si Df/B > 1:
 *     Fcd = 1 + 0.4·atan(Df/B)                            [φ = 0]
 *     Fqd = 1 + 2·tan(φ)·(1-sin(φ))²·atan(Df/B)          [φ > 0]
 *     Fcd = Fqd - (1-Fqd)/(Nc·tan(φ))                     [φ > 0]
 *     Fγd = 1
 * 
 * Factores de inclinación:
 *   Fci = Fqi = (1 - β/90)²
 *   Fγi = (1 - β/φ)²                                      [φ > 0]
 * 
 * qu = c·Nc·Fcs·Fcd·Fci + q·Nq·Fqs·Fqd·Fqi + 0.5·γ·B·Nγ·Fγs·Fγd·Fγi
 */

import type { BearingFactors } from '../../types/geotechnical';

export interface GeneralFactors {
  Nc: number;
  Nq: number;
  Ngamma: number;
  Fcs: number;
  Fqs: number;
  Fgs: number;
  Fcd: number;
  Fqd: number;
  Fgd: number;
  Fci: number;
  Fqi: number;
  Fgi: number;
}

/**
 * Calcula factores Nc, Nq, Nγ analíticamente (Das/Braja).
 */
export function getGeneralBearingFactors(phi: number): BearingFactors {
  if (phi === 0) {
    return { Nc: 5.14, Nq: 1, Ngamma: 0 };
  }

  const phiRad = (phi * Math.PI) / 180;
  const Nq = Math.tan(Math.PI / 4 + phiRad / 2) ** 2 * Math.exp(Math.PI * Math.tan(phiRad));
  const Nc = (Nq - 1) * (1 / Math.tan(phiRad));
  const Ngamma = 2 * (Nq + 1) * Math.tan(phiRad);

  return {
    Nc: Math.round(Nc * 100) / 100,
    Nq: Math.round(Nq * 100) / 100,
    Ngamma: Math.round(Ngamma * 100) / 100,
  };
}

/**
 * Calcula todos los factores y qu usando la Ecuación General (Das).
 */
export function calculateQuGeneral(
  c: number,
  q: number,
  gamma: number,
  B: number,
  L: number,
  phi: number,
  beta: number,
  Df: number
): { qu: number; factors: GeneralFactors } {
  const bf = getGeneralBearingFactors(phi);
  const phiRad = (phi * Math.PI) / 180;

  // Shape factors
  let Fcs: number, Fqs: number, Fgs: number;
  if (phi === 0) {
    Fcs = 1 + (B / L) * (1 / 5.14);
    Fqs = 1;
    Fgs = 1 - 0.4 * (B / L);
  } else {
    Fcs = 1 + (B / L) * (bf.Nq / bf.Nc);
    Fqs = 1 + (B / L) * Math.tan(phiRad);
    Fgs = 1 - 0.4 * (B / L);
  }

  // Depth factors
  let Fcd: number, Fqd: number, Fgd: number;
  const ratio = Df / B;

  if (phi === 0) {
    Fcd = ratio <= 1 ? 1 + 0.4 * ratio : 1 + 0.4 * Math.atan(ratio);
    Fqd = 1;
    Fgd = 1;
  } else {
    const tanPhi = Math.tan(phiRad);
    const sinPhi = Math.sin(phiRad);
    const depthTerm = 2 * tanPhi * (1 - sinPhi) ** 2;

    if (ratio <= 1) {
      Fqd = 1 + depthTerm * ratio;
    } else {
      Fqd = 1 + depthTerm * Math.atan(ratio);
    }
    Fcd = Fqd - (1 - Fqd) / (bf.Nc * tanPhi);
    Fgd = 1;
  }

  // Inclination factors
  const Fci = beta > 0 ? (1 - beta / 90) ** 2 : 1;
  const Fqi = Fci;
  const Fgi = beta > 0 && phi > 0 ? (1 - beta / phi) ** 2 : 1;

  // qu calculation
  const qu =
    c * bf.Nc * Fcs * Fcd * Fci +
    q * bf.Nq * Fqs * Fqd * Fqi +
    0.5 * gamma * B * bf.Ngamma * Fgs * Fgd * Fgi;

  return {
    qu,
    factors: {
      ...bf,
      Fcs,
      Fqs,
      Fgs,
      Fcd,
      Fqd,
      Fgd,
      Fci,
      Fqi,
      Fgi,
    },
  };
}

/**
 * Consideración RNE para la Ecuación General.
 */
export function calculateGeneralRNEConsideration(
  c: number,
  q: number,
  gamma: number,
  B: number,
  L: number,
  phi: number,
  beta: number,
  Df: number,
  isCohesive: boolean
): { qultRNE: number; qultRNECorrected: number } {
  const phiRad = (phi * Math.PI) / 180;
  const Fci = beta > 0 ? (1 - beta / 90) ** 2 : 1;
  const Fqi = Fci;
  const Fgi = beta > 0 && phi > 0 ? (1 - beta / phi) ** 2 : 1;
  const ratio = Df / B;

  if (isCohesive) {
    const Fcs0 = 1 + (B / L) * (1 / 5.14);
    const Fcd0 = ratio <= 1 ? 1 + 0.4 * ratio : 1 + 0.4 * Math.atan(ratio);
    const qultRNE = c * 5.14 * Fcs0 * Fcd0 * Fci;
    const qultRNECorrected = qultRNE + q * 1 * 1 * 1 * Fqi;
    return { qultRNE, qultRNECorrected };
  } else {
    const bf = getGeneralBearingFactors(phi);
    const Fqs = 1 + (B / L) * Math.tan(phiRad);
    const Fgs = 1 - 0.4 * (B / L);
    const tanPhi = Math.tan(phiRad);
    const sinPhi = Math.sin(phiRad);
    const depthTerm = 2 * tanPhi * (1 - sinPhi) ** 2;
    const Fqd = ratio <= 1 ? 1 + depthTerm * ratio : 1 + depthTerm * Math.atan(ratio);
    const F2 = q * bf.Nq * Fqs * Fqd * Fqi;
    const F3 = 0.5 * gamma * B * bf.Ngamma * Fgs * 1 * Fgi;
    return { qultRNE: F2 + F3, qultRNECorrected: F2 + F3 };
  }
}
