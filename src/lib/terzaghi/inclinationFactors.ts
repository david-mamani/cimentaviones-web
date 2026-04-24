/**
 * Factores de inclinación de carga (ic, iq, iγ).
 * 
 * Ref: Meyerhof (1963) / Hansen (1970).
 */

import type { InclinationFactors } from '../../types/geotechnical';

/**
 * Calcula los factores de inclinación de carga.
 * 
 * ic = iq = (1 - β/90)²
 * iγ = (1 - β/φ)²
 * 
 * Caso especial: si φ = 0 y β > 0, iγ se fija en 1.0 porque Nγ = 0
 * (el término no contribuye).
 * Si β = 0, todos los factores son 1.0.
 * 
 * @param beta - Ángulo de inclinación de la carga (°)
 * @param phi - Ángulo de fricción interna del suelo (°)
 */
export function getInclinationFactors(beta: number, phi: number): InclinationFactors {
  if (beta === 0) {
    return { ic: 1.0, iq: 1.0, igamma: 1.0 };
  }

  const iciq = (1 - beta / 90) ** 2;

  // Si φ = 0, Nγ = 0, así que iγ no importa → usar 1.0
  const igamma = phi > 0 ? (1 - beta / phi) ** 2 : 1.0;

  return {
    ic: iciq,
    iq: iciq,
    igamma,
  };
}
