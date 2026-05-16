/**
 * Helper compartido para disparar el cálculo con validación previa.
 * Usado por Toolbar y OutputPanel para evitar duplicar lógica de validación.
 */

import { useFoundationStore } from '../store/foundationStore';
import {
  foundationSchema,
  stratumSchema,
  conditionsSchema,
  validateCalculationInput,
} from './validation';

export function triggerCalculateWithValidation(): void {
  const state = useFoundationStore.getState();
  const { foundation, strata, conditions, calculate, setErrors } = state;

  const fResult = foundationSchema.safeParse(foundation);
  if (!fResult.success) {
    setErrors(fResult.error.issues.map((e: { message: string }) => e.message));
    return;
  }

  const strataErrors: string[] = [];
  strata.forEach((s, i) => {
    const sResult = stratumSchema.safeParse(s);
    if (!sResult.success) {
      sResult.error.issues.forEach((e: { message: string }) => {
        strataErrors.push(`Estrato ${i + 1}: ${e.message}`);
      });
    }
  });
  if (strataErrors.length > 0) {
    setErrors(strataErrors);
    return;
  }

  const cResult = conditionsSchema.safeParse(conditions);
  if (!cResult.success) {
    setErrors(cResult.error.issues.map((e: { message: string }) => e.message));
    return;
  }

  const crossErrors = validateCalculationInput(fResult.data, strata, cResult.data);
  if (crossErrors.length > 0) {
    setErrors(crossErrors);
    return;
  }

  calculate();
}
