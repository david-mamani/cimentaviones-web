/**
 * Correcciones por nivel freático.
 * 
 * Se distinguen 4 casos según la posición del nivel freático (Dw)
 * respecto a la profundidad de desplante (Df) y el ancho B.
 * 
 * γw = 9.81 kN/m³ (peso unitario del agua)
 * γ' = γsat - γw  (peso unitario sumergido o efectivo)
 */

import type { Stratum } from '../../types/geotechnical';

const GAMMA_W = 9.81; // kN/m³

export interface WaterTableResult {
  /** Caso aplicado: 0=sin NF, 1, 2, 3, 4 */
  case: number;
  /** Sobrecarga efectiva q corregida (kPa) */
  q: number;
  /** Peso unitario efectivo γ para el tercer término de Terzaghi */
  gammaEffective: number;
}

/**
 * Calcula la sobrecarga efectiva q y el γ efectivo considerando el nivel freático.
 * 
 * @param strata - Array de estratos del perfil
 * @param Df - Profundidad de desplante (m)
 * @param B - Ancho de la cimentación (m)
 * @param hasWaterTable - Si existe nivel freático
 * @param Dw - Profundidad del nivel freático (m)
 * @param designStratum - Estrato de diseño (al nivel de Df)
 */
export function applyWaterTableCorrection(
  strata: Stratum[],
  Df: number,
  B: number,
  hasWaterTable: boolean,
  Dw: number,
  designStratum: Stratum
): WaterTableResult {
  // Sin nivel freático → Caso 4 (sin corrección)
  if (!hasWaterTable) {
    const q = calculateOverburden(strata, Df, false, 0);
    return {
      case: 0,
      q,
      gammaEffective: designStratum.gamma,
    };
  }

  const gammaPrime = designStratum.gammaSat - GAMMA_W;

  // Caso 1: NF por encima de la cimentación (Dw < Df)
  if (Dw < Df) {
    const q = calculateOverburdenWithWaterTable(strata, Df, Dw);
    return {
      case: 1,
      q,
      gammaEffective: gammaPrime,
    };
  }

  // Caso 2: NF en la base de la cimentación (Dw = Df)
  if (Math.abs(Dw - Df) < 0.001) {
    const q = calculateOverburden(strata, Df, false, 0);
    return {
      case: 2,
      q,
      gammaEffective: gammaPrime,
    };
  }

  // Caso 3: NF entre Df y Df + B
  if (Dw > Df && Dw < Df + B) {
    const q = calculateOverburden(strata, Df, false, 0);
    const gammaEff = gammaPrime + ((Dw - Df) / B) * (designStratum.gamma - gammaPrime);
    return {
      case: 3,
      q,
      gammaEffective: gammaEff,
    };
  }

  // Caso 4: NF por debajo de Df + B (sin corrección)
  const q = calculateOverburden(strata, Df, false, 0);
  return {
    case: 4,
    q,
    gammaEffective: designStratum.gamma,
  };
}

/**
 * Calcula la sobrecarga q = Σ(γᵢ · hᵢ) para todos los estratos hasta Df.
 * Sin corrección por nivel freático.
 */
function calculateOverburden(
  strata: Stratum[],
  Df: number,
  hasBasement: boolean,
  Ds: number
): number {
  let q = 0;
  let depth = 0;

  for (const stratum of strata) {
    const top = depth;
    const bottom = depth + stratum.thickness;

    if (top >= Df) break;

    const effectiveThickness = Math.min(bottom, Df) - top;
    q += stratum.gamma * effectiveThickness;

    depth = bottom;
  }

  if (hasBasement && Ds > 0) {
    q -= 24 * Ds; // γconcreto ≈ 24 kN/m³
  }

  return q;
}

/**
 * Calcula la sobrecarga q con corrección por NF (Caso 1: Dw < Df).
 * Los estratos sobre el NF usan γ natural.
 * Los estratos bajo el NF pero sobre Df usan γ' = γsat - γw.
 */
function calculateOverburdenWithWaterTable(
  strata: Stratum[],
  Df: number,
  Dw: number
): number {
  let q = 0;
  let depth = 0;

  for (const stratum of strata) {
    const top = depth;
    const bottom = depth + stratum.thickness;

    if (top >= Df) break;

    const effectiveBottom = Math.min(bottom, Df);
    const gammaPrime = stratum.gammaSat - GAMMA_W;

    if (effectiveBottom <= Dw) {
      // Todo el segmento está sobre el NF → usar γ natural
      q += stratum.gamma * (effectiveBottom - top);
    } else if (top >= Dw) {
      // Todo el segmento está bajo el NF → usar γ'
      q += gammaPrime * (effectiveBottom - top);
    } else {
      // El NF cruza este estrato
      const dryPart = Dw - top;
      const wetPart = effectiveBottom - Dw;
      q += stratum.gamma * dryPart + gammaPrime * wetPart;
    }

    depth = bottom;
  }

  return q;
}

/**
 * Calcula la sobrecarga q considerando nivel freático y/o sótano.
 * Función pública que centraliza toda la lógica de sobrecarga.
 */
export function calculateEffectiveOverburden(
  strata: Stratum[],
  Df: number,
  hasWaterTable: boolean,
  Dw: number,
  hasBasement: boolean,
  Ds: number
): number {
  let q: number;

  if (hasWaterTable && Dw < Df) {
    q = calculateOverburdenWithWaterTable(strata, Df, Dw);
  } else {
    q = calculateOverburden(strata, Df, false, 0);
  }

  if (hasBasement && Ds > 0) {
    q -= 24 * Ds;
  }

  return Math.max(q, 0);
}
