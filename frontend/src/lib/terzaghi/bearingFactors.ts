/**
 * Tabla de factores de capacidad portante de Terzaghi (Nc, Nq, Nγ).
 * 
 * Fuente: Terzaghi (1943), reproducida en Das (2015) "Principios de
 * Ingeniería de Cimentaciones", 8va edición.
 * 
 * La tabla contiene 51 entradas para φ = 0° a 50° (paso de 1°).
 * Para valores no enteros se usa interpolación lineal.
 */

import type { BearingFactors } from '../../types/geotechnical';

/** Tabla completa: índice = φ (°), valores = [Nc, Nq, Nγ] */
const TERZAGHI_TABLE: readonly [number, number, number][] = [
  // φ=0°
  [5.70,    1.00,    0.00],
  // φ=1°
  [6.00,    1.10,    0.01],
  // φ=2°
  [6.30,    1.22,    0.04],
  // φ=3°
  [6.62,    1.35,    0.06],
  // φ=4°
  [6.97,    1.49,    0.10],
  // φ=5°
  [7.34,    1.64,    0.14],
  // φ=6°
  [7.73,    1.81,    0.20],
  // φ=7°
  [8.15,    2.00,    0.27],
  // φ=8°
  [8.60,    2.21,    0.35],
  // φ=9°
  [9.09,    2.44,    0.44],
  // φ=10°
  [9.61,    2.69,    0.56],
  // φ=11°
  [10.16,   2.98,    0.69],
  // φ=12°
  [10.76,   3.29,    0.85],
  // φ=13°
  [11.41,   3.63,    1.04],
  // φ=14°
  [12.11,   4.02,    1.26],
  // φ=15°
  [12.86,   4.45,    1.52],
  // φ=16°
  [13.68,   4.92,    1.82],
  // φ=17°
  [14.60,   5.45,    2.18],
  // φ=18°
  [15.12,   6.04,    2.59],
  // φ=19°
  [16.56,   6.70,    3.07],
  // φ=20°
  [17.69,   7.44,    3.64],
  // φ=21°
  [18.92,   8.26,    4.31],
  // φ=22°
  [20.27,   9.19,    5.09],
  // φ=23°
  [21.75,  10.23,    6.00],
  // φ=24°
  [23.36,  11.40,    7.08],
  // φ=25°
  [25.13,  12.72,    8.34],
  // φ=26°
  [27.09,  14.21,    9.84],
  // φ=27°
  [29.24,  15.90,   11.60],
  // φ=28°
  [31.61,  17.81,   13.70],
  // φ=29°
  [34.24,  19.98,   16.18],
  // φ=30°
  [37.16,  22.46,   19.13],
  // φ=31°
  [40.41,  25.28,   22.65],
  // φ=32°
  [44.04,  28.52,   26.87],
  // φ=33°
  [48.09,  32.23,   31.94],
  // φ=34°
  [52.64,  36.50,   38.04],
  // φ=35°
  [57.75,  41.44,   45.41],
  // φ=36°
  [63.53,  47.16,   54.36],
  // φ=37°
  [70.01,  53.80,   65.27],
  // φ=38°
  [77.50,  61.55,   78.61],
  // φ=39°
  [85.97,  70.61,   95.03],
  // φ=40°
  [95.66,  81.27,  115.31],
  // φ=41°
  [106.81,  93.85,  140.51],
  // φ=42°
  [119.67, 108.75,  171.99],
  // φ=43°
  [134.58, 126.50,  211.56],
  // φ=44°
  [151.95, 147.74,  261.60],
  // φ=45°
  [172.28, 173.28,  325.34],
  // φ=46°
  [196.22, 204.19,  407.11],
  // φ=47°
  [224.55, 241.80,  512.84],
  // φ=48°
  [258.28, 287.85,  650.67],
  // φ=49°
  [298.71, 344.63,  831.99],
  // φ=50°
  [347.50, 415.14, 1042.80],
];

/**
 * Obtiene los factores de capacidad portante de Terzaghi para un φ dado.
 * 
 * Para valores enteros, retorna directamente de la tabla.
 * Para valores no enteros, usa interpolación lineal entre los dos
 * enteros adyacentes.
 * 
 * @param phi - Ángulo de fricción interna (°), debe estar entre 0 y 50
 * @returns Factores Nc, Nq, Nγ
 * @throws Error si φ está fuera del rango [0, 50]
 * 
 * @example
 * getBearingFactors(30) // → { Nc: 37.16, Nq: 22.46, Ngamma: 19.13 }
 * getBearingFactors(27.5) // → interpolación lineal entre φ=27° y φ=28°
 */
export function getBearingFactors(phi: number): BearingFactors {
  if (phi < 0 || phi > 50) {
    throw new Error(
      `El ángulo de fricción φ=${phi}° está fuera del rango válido [0°, 50°].`
    );
  }

  const phiLow = Math.floor(phi);
  const phiHigh = Math.ceil(phi);

  // Si es entero, retornar directamente
  if (phiLow === phiHigh) {
    const [Nc, Nq, Ngamma] = TERZAGHI_TABLE[phiLow];
    return { Nc, Nq, Ngamma };
  }

  // Interpolación lineal
  const fraction = phi - phiLow;
  const [NcLow, NqLow, NgLow] = TERZAGHI_TABLE[phiLow];
  const [NcHigh, NqHigh, NgHigh] = TERZAGHI_TABLE[phiHigh];

  return {
    Nc: NcLow + fraction * (NcHigh - NcLow),
    Nq: NqLow + fraction * (NqHigh - NqLow),
    Ngamma: NgLow + fraction * (NgHigh - NgLow),
  };
}

/**
 * Retorna la tabla completa para mostrar en la UI.
 */
export function getFullTable(): { phi: number; Nc: number; Nq: number; Ngamma: number }[] {
  return TERZAGHI_TABLE.map(([Nc, Nq, Ngamma], phi) => ({
    phi,
    Nc,
    Nq,
    Ngamma,
  }));
}
