/**
 * Motor de iteraciones paramétricas.
 * 
 * Permite variar B y/o Df en un rango y calcular una matriz
 * de resultados (q_adm, Q_max, etc.) para cada combinación.
 */

import type { CalculationInput, CalculationResult } from '../../types/geotechnical';
import { calculateBearingCapacity } from './bearingCapacity';

export interface IterationConfig {
  // Variación de B
  varyB: boolean;
  bStart: number;
  bEnd: number;
  bStep: number;

  // Variación de Df
  varyDf: boolean;
  dfStart: number;
  dfEnd: number;
  dfStep: number;
}

export interface IterationPoint {
  B: number;
  Df: number;
  result: CalculationResult;
  Qmax: number; // qa × B × L
}

export interface IterationResult {
  /** Array de valores de B usados */
  bValues: number[];
  /** Array de valores de Df usados */
  dfValues: number[];
  /** Matriz [dfIndex][bIndex] de resultados */
  matrix: IterationPoint[][];
  /** Lista plana de anotaciones */
  annotations: string[];
}

/**
 * Genera un array de valores desde start hasta end con paso step.
 */
function generateRange(start: number, end: number, step: number): number[] {
  if (step <= 0 || end < start) return [start];
  const values: number[] = [];
  let val = start;
  while (val <= end + 0.0001) {
    values.push(Math.round(val * 10000) / 10000);
    val += step;
  }
  return values;
}

/**
 * Ejecuta iteraciones paramétricas.
 * 
 * @param baseInput - Input base (se modificarán B y Df)
 * @param config - Configuración de las iteraciones
 */
export function runParametricIterations(
  baseInput: CalculationInput,
  config: IterationConfig
): IterationResult {
  const bValues = config.varyB
    ? generateRange(config.bStart, config.bEnd, config.bStep)
    : [baseInput.foundation.B];

  const dfValues = config.varyDf
    ? generateRange(config.dfStart, config.dfEnd, config.dfStep)
    : [baseInput.foundation.Df];

  const matrix: IterationPoint[][] = [];
  const annotations: string[] = [];
  let iteration = 1;

  for (const df of dfValues) {
    const row: IterationPoint[] = [];
    for (const b of bValues) {
      // Construir input con B y Df modificados
      const input: CalculationInput = {
        ...baseInput,
        foundation: {
          ...baseInput.foundation,
          B: b,
          L: baseInput.foundation.type === 'cuadrada' || baseInput.foundation.type === 'circular'
            ? b
            : baseInput.foundation.L,
          Df: df,
        },
      };

      try {
        const result = calculateBearingCapacity(input);
        const L = input.foundation.L;
        const Qmax = result.qa * b * L;

        row.push({ B: b, Df: df, result, Qmax });

        annotations.push(
          `Cálculo ${String(iteration).padStart(2, '0')}: ` +
          `B = ${b.toFixed(3)} m, Df = ${df.toFixed(3)} m → ` +
          `q_adm = ${result.qa.toFixed(3)} kPa, Q_max = ${Qmax.toFixed(3)} kN`
        );
      } catch {
        annotations.push(
          `Cálculo ${String(iteration).padStart(2, '0')}: ` +
          `B = ${b.toFixed(3)} m, Df = ${df.toFixed(3)} m → ERROR`
        );
      }

      iteration++;
    }
    matrix.push(row);
  }

  return { bValues, dfValues, matrix, annotations };
}
