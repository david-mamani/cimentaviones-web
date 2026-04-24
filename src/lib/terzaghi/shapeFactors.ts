/**
 * Factores de forma de Meyerhof (sc, sq, sγ).
 * 
 * Ref: Meyerhof, G.G. (1963). "Some Recent Research on the Bearing
 * Capacity of Foundations." Canadian Geotechnical Journal, 1(1).
 */

import type { FoundationType, ShapeFactors } from '../../types/geotechnical';

/**
 * Calcula los factores de forma según Meyerhof.
 * 
 * | Factor | Cuadrada/Circular | Rectangular     | Franja |
 * |--------|-------------------|-----------------|--------|
 * | sc     | 1.3               | 1 + 0.3·(B/L)   | 1.0    |
 * | sq     | 1.0               | 1.0              | 1.0    |
 * | sγ     | 0.8               | 1 - 0.2·(B/L)   | 1.0    |
 * 
 * @param type - Tipo de cimentación
 * @param B - Ancho de la cimentación (m)
 * @param L - Longitud de la cimentación (m), solo para rectangular
 */
export function getShapeFactors(
  type: FoundationType,
  B: number,
  L: number = B
): ShapeFactors {
  switch (type) {
    case 'cuadrada':
    case 'circular':
      return { sc: 1.3, sq: 1.0, sgamma: 0.8 };

    case 'rectangular': {
      const ratio = B / L;
      return {
        sc: 1 + 0.3 * ratio,
        sq: 1.0,
        sgamma: 1 - 0.2 * ratio,
      };
    }

    case 'franja':
      return { sc: 1.0, sq: 1.0, sgamma: 1.0 };

    default:
      return { sc: 1.0, sq: 1.0, sgamma: 1.0 };
  }
}
