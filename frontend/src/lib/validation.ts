/**
 * Esquemas de validación con Zod v4.
 * Todos los mensajes de error en español.
 */

import { z } from 'zod';

/** Validación de un estrato individual */
export const stratumSchema = z.object({
  id: z.string(),
  thickness: z.number({ error: 'El espesor debe ser un número' })
    .check(z.positive('El espesor debe ser mayor a 0')),

  gamma: z.number({ error: 'El peso unitario debe ser un número' })
    .check(z.positive('El peso unitario γ debe ser mayor a 0')),

  c: z.number({ error: 'La cohesión debe ser un número' })
    .check(z.gte(0, 'La cohesión c debe ser ≥ 0')),

  phi: z.number({ error: 'El ángulo de fricción debe ser un número' })
    .check(
      z.gte(0, 'El ángulo de fricción φ debe estar entre 0° y 50°'),
      z.lte(50, 'El ángulo de fricción φ debe estar entre 0° y 50°'),
    ),

  gammaSat: z.number({ error: 'El peso unitario saturado debe ser un número' })
    .check(z.positive('El peso unitario saturado γsat debe ser mayor a 0')),
}).refine(
  (data) => data.gammaSat >= data.gamma,
  {
    message: 'El peso unitario saturado (γsat) debe ser ≥ al peso unitario natural (γ)',
    path: ['gammaSat'],
  }
);

/** Validación de los parámetros de cimentación */
export const foundationSchema = z.object({
  type: z.enum(['cuadrada', 'rectangular', 'franja', 'circular'], {
    error: 'Seleccione un tipo de cimentación válido',
  }),

  B: z.number({ error: 'El ancho B debe ser un número' })
    .check(z.positive('El ancho B debe ser mayor a 0')),

  L: z.number({ error: 'La longitud L debe ser un número' })
    .check(z.positive('La longitud L debe ser mayor a 0')),

  Df: z.number({ error: 'La profundidad de desplante debe ser un número' })
    .check(z.gte(0, 'La profundidad de desplante Df debe ser ≥ 0')),

  FS: z.number({ error: 'El factor de seguridad debe ser un número' })
    .check(
      z.gte(1.5, 'El FS debe estar entre 1.5 y 5.0'),
      z.lte(5.0, 'El FS debe estar entre 1.5 y 5.0'),
    ),

  beta: z.number({ error: 'El ángulo β debe ser un número' })
    .check(
      z.gte(0, 'El ángulo de inclinación β debe ser ≥ 0°'),
      z.lte(45, 'El ángulo de inclinación β debe ser ≤ 45°'),
    ),
}).refine(
  (data) => data.type !== 'rectangular' || data.L >= data.B,
  {
    message: 'Para cimentación rectangular, L debe ser ≥ B',
    path: ['L'],
  }
);

/** Validación de condiciones especiales */
export const conditionsSchema = z.object({
  hasWaterTable: z.boolean(),
  waterTableDepth: z.number().check(z.gte(0, 'La profundidad del NF debe ser ≥ 0')).default(0),
  hasBasement: z.boolean(),
  basementDepth: z.number().check(z.gte(0, 'La profundidad del sótano debe ser ≥ 0')).default(0),
});

/**
 * Validación global del input completo.
 * Verifica restricciones cruzadas como Σ espesores ≥ Df y β < φ.
 */
export function validateCalculationInput(
  foundation: z.infer<typeof foundationSchema>,
  strata: z.infer<typeof stratumSchema>[],
  _conditions: z.infer<typeof conditionsSchema>
): string[] {
  const errors: string[] = [];

  if (strata.length === 0) {
    errors.push('Se requiere al menos un estrato de suelo.');
  }

  const totalThickness = strata.reduce((sum, s) => sum + s.thickness, 0);
  if (totalThickness < foundation.Df) {
    errors.push(
      `La suma de espesores (${totalThickness.toFixed(2)} m) debe ser ≥ ` +
      `la profundidad de desplante Df (${foundation.Df.toFixed(2)} m).`
    );
  }

  if (foundation.beta > 0 && strata.length > 0) {
    let depth = 0;
    let designPhi = strata[strata.length - 1].phi;
    for (const stratum of strata) {
      depth += stratum.thickness;
      if (depth >= foundation.Df - 0.001) {
        designPhi = stratum.phi;
        break;
      }
    }
    if (foundation.beta >= designPhi) {
      errors.push(
        `El ángulo de inclinación β (${foundation.beta}°) debe ser menor ` +
        `que el ángulo de fricción φ (${designPhi}°) del estrato de diseño.`
      );
    }
  }

  return errors;
}
