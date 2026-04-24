import { describe, it, expect } from 'vitest';
import { getBearingFactors } from '../bearingFactors';
import { calculateBearingCapacity } from '../bearingCapacity';
import type { CalculationInput, Stratum } from '../../../types/geotechnical';

describe('getBearingFactors', () => {
  it('devuelve factores correctos para φ=0°', () => {
    const f = getBearingFactors(0);
    expect(f.Nc).toBe(5.70);
    expect(f.Nq).toBe(1.00);
    expect(f.Ngamma).toBe(0.00);
  });

  it('devuelve factores correctos para φ=30°', () => {
    const f = getBearingFactors(30);
    expect(f.Nc).toBe(37.16);
    expect(f.Nq).toBe(22.46);
    expect(f.Ngamma).toBe(19.13);
  });

  it('devuelve factores correctos para φ=50°', () => {
    const f = getBearingFactors(50);
    expect(f.Nc).toBe(347.50);
    expect(f.Nq).toBe(415.14);
    expect(f.Ngamma).toBe(1042.80);
  });

  it('interpola linealmente para φ=27.5°', () => {
    const f = getBearingFactors(27.5);
    // φ=27: Nc=29.24, φ=28: Nc=31.61
    expect(f.Nc).toBeCloseTo((29.24 + 31.61) / 2, 2);
    // φ=27: Nq=15.90, φ=28: Nq=17.81
    expect(f.Nq).toBeCloseTo((15.90 + 17.81) / 2, 2);
    // φ=27: Ng=11.60, φ=28: Ng=13.70
    expect(f.Ngamma).toBeCloseTo((11.60 + 13.70) / 2, 2);
  });

  it('lanza error para φ fuera de rango', () => {
    expect(() => getBearingFactors(-1)).toThrow();
    expect(() => getBearingFactors(51)).toThrow();
  });
});

describe('Caso de prueba 1 — Suelo arcilloso, cimentación cuadrada', () => {
  // PRD: φ=0°, c=50 kPa, γ=18 kN/m³, B=2.0m, Df=1.5m, Sin NF
  // q = 18·1.5 = 27 kPa
  // qu = 1.3·50·5.7 + 27·1.0 + 0.4·18·2·0 = 370.5 + 27 = 397.5 kPa
  // qa = 397.5 / 3 = 132.5 kPa
  it('calcula qu=397.5 y qa=132.5 correctamente', () => {
    const stratum: Stratum = {
      id: 'test-1',
      thickness: 3.0, // > Df
      gamma: 18,
      c: 50,
      phi: 0,
      gammaSat: 20,
    };

    const input: CalculationInput = {
      foundation: {
        type: 'cuadrada',
        B: 2.0,
        L: 2.0,
        Df: 1.5,
        FS: 3.0,
        beta: 0,
      },
      strata: [stratum],
      conditions: {
        hasWaterTable: false,
        waterTableDepth: 0,
        hasBasement: false,
        basementDepth: 0,
      },
      method: 'terzaghi',
    };

    const result = calculateBearingCapacity(input);

    // q = γ · Df = 18 · 1.5 = 27
    expect(result.q).toBeCloseTo(27, 1);

    // qu = 1.3·50·5.7 + 27·1.0 + 0.4·18·2·0 = 397.5
    expect(result.qu).toBeCloseTo(397.5, 1);

    // qa = 397.5 / 3 = 132.5
    expect(result.qa).toBeCloseTo(132.5, 1);
  });
});

describe('Caso de prueba 2 — Arena limpia, cimentación cuadrada', () => {
  // PRD: φ=30°, c=0 kPa, γ=19 kN/m³, B=1.5m, Df=1.0m, Sin NF
  // Nc=37.16, Nq=22.46, Nγ=19.13
  // q = 19·1.0 = 19 kPa
  // qu = 0 + 1.0·19·22.46 + 0.4·19·1.5·19.13 = 426.74 + 218.084 = 644.824
  // qa = 644.824 / 3 ≈ 214.94
  it('calcula qu≈644.82 y qa≈214.94 correctamente', () => {
    const stratum: Stratum = {
      id: 'test-2',
      thickness: 3.0,
      gamma: 19,
      c: 0,
      phi: 30,
      gammaSat: 21,
    };

    const input: CalculationInput = {
      foundation: {
        type: 'cuadrada',
        B: 1.5,
        L: 1.5,
        Df: 1.0,
        FS: 3.0,
        beta: 0,
      },
      strata: [stratum],
      conditions: {
        hasWaterTable: false,
        waterTableDepth: 0,
        hasBasement: false,
        basementDepth: 0,
      },
      method: 'terzaghi',
    };

    const result = calculateBearingCapacity(input);

    // q = 19 · 1.0 = 19
    expect(result.q).toBeCloseTo(19, 1);

    // Verify factors
    expect(result.bearingFactors.Nc).toBeCloseTo(37.16, 2);
    expect(result.bearingFactors.Nq).toBeCloseTo(22.46, 2);
    expect(result.bearingFactors.Ngamma).toBeCloseTo(19.13, 2);

    // qu = 1.3·0·37.16 + 1.0·19·22.46 + 0.4·19·1.5·19.13
    // qu = 0 + 426.74 + 218.084 = 644.824
    // Note: PRD says "1.0·19·22.46" — the Terzaghi square formula has Nq coefficient = 1.0
    expect(result.qu).toBeCloseTo(644.824, 0);

    // qa = 644.824 / 3 ≈ 214.94
    expect(result.qa).toBeCloseTo(214.94, 0);
  });
});
