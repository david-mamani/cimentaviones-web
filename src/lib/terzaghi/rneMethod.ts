/**
 * Método RNE (Norma E.050 - Reglamento Nacional de Edificaciones, Perú).
 * 
 * Factores de capacidad portante analíticos:
 *   Nq = e^(π·tan(φ)) · tan²(45 + φ/2)
 *   Nc = (Nq - 1) · cot(φ)       [para φ > 0]
 *   Nγ = (Nq - 1) · tan(1.4·φ)   [fórmula RNE específica]
 * 
 * Caso especial φ = 0: Nq = 5.14, Nc = 1, Nγ = 0
 * 
 * Factores de forma:
 *   Sc = 1 + 0.2·(B/L)
 *   Sγ = 1 - 0.2·(B/L)
 * 
 * Factores de inclinación:
 *   ic = iq = (1 - β/90)²
 *   iγ = (1 - β/φ)²   [si φ > 0]
 * 
 * Fórmula: qu = Sc·ic·c·Nc + iq·q·Nq + 0.5·Sγ·iγ·γ·B·Nγ
 */

import type { BearingFactors } from '../../types/geotechnical';

export interface RNEFactors extends BearingFactors {
  Sc: number;
  Sgamma: number;
  ic: number;
  iq: number;
  igamma: number;
}

/**
 * Calcula los factores Nc, Nq, Nγ según la norma RNE E.050.
 */
export function getRNEBearingFactors(phi: number): BearingFactors {
  if (phi === 0) {
    return { Nc: 5.14, Nq: 1, Ngamma: 0 };
  }

  const phiRad = (phi * Math.PI) / 180;
  const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.tan(Math.PI / 4 + phiRad / 2) ** 2;
  const Nc = (Nq - 1) * (1 / Math.tan(phiRad));
  const Ngamma = (Nq - 1) * Math.tan(1.4 * phiRad);

  return {
    Nc: Math.round(Nc * 100) / 100,
    Nq: Math.round(Nq * 100) / 100,
    Ngamma: Math.round(Ngamma * 100) / 100,
  };
}

/**
 * Calcula qu usando el método RNE.
 * qu = Sc·ic·c·Nc + iq·q·Nq + 0.5·Sγ·iγ·γ·B·Nγ
 */
export function calculateQuRNE(
  c: number,
  q: number,
  gamma: number,
  B: number,
  L: number,
  phi: number,
  beta: number
): { qu: number; factors: RNEFactors } {
  const bf = getRNEBearingFactors(phi);

  // Factores de forma
  const Sc = 1 + 0.2 * (B / L);
  const Sgamma = 1 - 0.2 * (B / L);

  // Factores de inclinación
  const ic = beta > 0 ? (1 - beta / 90) ** 2 : 1;
  const iq = ic;
  const igamma = beta > 0 && phi > 0 ? (1 - beta / phi) ** 2 : 1;

  const qu = Sc * ic * c * bf.Nc + iq * q * bf.Nq + 0.5 * Sgamma * igamma * gamma * B * bf.Ngamma;

  return {
    qu,
    factors: {
      ...bf,
      Sc,
      Sgamma,
      ic,
      iq,
      igamma,
    },
  };
}

/**
 * Consideración RNE: cálculos especiales para suelos cohesivos y friccionantes.
 * 
 * Suelo cohesivo (φ < 20°): Solo el término de cohesión con Nc = 5.14
 * Suelo friccionante (φ ≥ 20°): Términos 2 y 3 (sin cohesión)
 */
export function calculateRNEConsideration(
  c: number,
  q: number,
  gamma: number,
  B: number,
  L: number,
  phi: number,
  beta: number,
  _Df: number,
  isCohesive: boolean
): { qultRNE: number; qultRNECorrected: number } {
  const Sc = 1 + 0.2 * (B / L);
  const Sgamma = 1 - 0.2 * (B / L);
  const ic = beta > 0 ? (1 - beta / 90) ** 2 : 1;
  const iq = ic;
  const igamma = beta > 0 && phi > 0 ? (1 - beta / phi) ** 2 : 1;

  if (isCohesive) {
    // Solo término de cohesión con Nc = 5.14
    const qultRNE = Sc * ic * c * 5.14;
    const qultRNECorrected = qultRNE + iq * q * 1; // Nq = 1 para corrección
    return { qultRNE, qultRNECorrected };
  } else {
    // Friccionante: términos 2 y 3
    const bf = getRNEBearingFactors(phi);
    const F2 = iq * q * bf.Nq;
    const F3 = 0.5 * Sgamma * igamma * gamma * B * bf.Ngamma;
    return { qultRNE: F2 + F3, qultRNECorrected: F2 + F3 };
  }
}
