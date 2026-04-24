/**
 * Factores de profundidad de Meyerhof (dc, dq, dγ).
 * 
 * Ref: Meyerhof, G.G. (1963).
 */

import type { DepthFactors } from '../../types/geotechnical';

/**
 * Calcula los factores de profundidad según Meyerhof.
 * 
 * dc = 1 + 0.4·(Df/B)
 * dq = dγ = 1 + 0.1·tan²(45 + φ/2)·(Df/B)   para φ > 10°
 * dq = dγ = 1.0                                para φ ≤ 10°
 * 
 * @param phi - Ángulo de fricción interna (°)
 * @param Df - Profundidad de desplante (m)
 * @param B - Ancho de la cimentación (m)
 */
export function getDepthFactors(phi: number, Df: number, B: number): DepthFactors {
  const ratio = Df / B;
  const dc = 1 + 0.4 * ratio;

  let dq: number;
  if (phi > 10) {
    const angle = ((45 + phi / 2) * Math.PI) / 180; // Convertir a radianes
    const tanSquared = Math.tan(angle) ** 2;
    dq = 1 + 0.1 * tanSquared * ratio;
  } else {
    dq = 1.0;
  }

  return {
    dc,
    dq,
    dgamma: dq, // dγ = dq en Meyerhof
  };
}
