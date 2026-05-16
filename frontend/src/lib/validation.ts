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

  // Inputs de asentamiento (opcionales; reservados para módulo futuro)
  Es: z.number().check(z.positive('Es debe ser > 0')).nullable().optional(),
  mu_s: z.number().check(z.gte(0, 'μs ≥ 0'), z.lt(0.5, 'μs < 0.5')).nullable().optional(),
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

  e1: z.number({ error: 'e1 debe ser un número' })
    .check(z.gte(0, 'La excentricidad e1 debe ser ≥ 0'))
    .default(0),

  e2: z.number({ error: 'e2 debe ser un número' })
    .check(z.gte(0, 'La excentricidad e2 debe ser ≥ 0'))
    .default(0),

  Q: z.number().check(z.positive('La carga Q debe ser > 0')).nullable().optional(),
}).refine(
  (data) => data.type !== 'rectangular' || data.L >= data.B,
  {
    message: 'Para cimentación rectangular, L debe ser ≥ B',
    path: ['L'],
  }
).refine(
  (data) => 2 * data.e1 < data.B,
  {
    message: 'La excentricidad e1 es demasiado grande: 2·e1 debe ser < B',
    path: ['e1'],
  }
).refine(
  (data) => 2 * data.e2 < data.L,
  {
    message: 'La excentricidad e2 es demasiado grande: 2·e2 debe ser < L',
    path: ['e2'],
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
 * Verifica restricciones cruzadas como Σ espesores ≥ Df_abs y β < φ.
 */
export function validateCalculationInput(
  foundation: z.infer<typeof foundationSchema>,
  strata: z.infer<typeof stratumSchema>[],
  conditions: z.infer<typeof conditionsSchema>
): string[] {
  const errors: string[] = [];

  if (strata.length === 0) {
    errors.push('Se requiere al menos un estrato de suelo.');
  }

  // Df_abs incluye el sótano si está activo
  const Ds = conditions.hasBasement ? conditions.basementDepth : 0;
  const Df_abs = foundation.Df + Ds;

  const totalThickness = strata.reduce((sum, s) => sum + s.thickness, 0);
  if (totalThickness < Df_abs) {
    errors.push(
      `La suma de espesores (${totalThickness.toFixed(2)} m) debe ser ≥ ` +
      `Df_abs = Ds + Df (${Df_abs.toFixed(2)} m).`
    );
  }

  if (foundation.beta > 0 && strata.length > 0) {
    let depth = 0;
    let designPhi = strata[strata.length - 1].phi;
    for (const stratum of strata) {
      depth += stratum.thickness;
      if (depth >= Df_abs - 0.001) {
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
