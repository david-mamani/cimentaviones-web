"""
Highter & Anders (1985) — Área efectiva para cimentaciones rectangulares con
excentricidad biaxial. Das, Sección 6.12 (Figs. 6.27, 6.28, 6.29).
**SCAFFOLD**: este módulo está parcialmente implementado.
  -  Selector de caso `select_ha_case` con condiciones mutuamente excluyentes.
  -  Validación previa `e/dim < 0.5` (rechazo físicamente inadmisible).
  -  Caso I (fórmula cerrada, Das Ec. 6.71–6.74).
  -  Swap final `B' ≤ L'` aplicado a todos los casos.
Convención del proyecto:
  - `e1` (= eL) reduce L (eje 1 horizontal).
  - `e2` (= eB) reduce B (eje 2 vertical).
  - "eB/B" del libro corresponde a `e2/B` en código.
  - "eL/L" del libro corresponde a `e1/L` en código.
"""
from typing import Literal

HACase = Literal["I", "II", "III", "IV"]


def _swap_if_needed(B_eff: float, L_eff: float) -> tuple[float, float, bool]:
    """Garantiza B' ≤ L'. Devuelve (B', L', intercambio_aplicado)."""
    if B_eff > L_eff:
        return L_eff, B_eff, True
    return B_eff, L_eff, False


def validate_eccentricity(B: float, L: float, e1: float, e2: float) -> None:
    """
    Rechaza inputs con `e/dim ≥ 0.5` (físicamente inadmisible — 2e ≥ dim).
    Esta validación es más estricta que la de `models.py` (que rechaza
    `2e ≥ dim`); ambas son equivalentes. Repetida aquí para uso directo
    del módulo sin pasar por Pydantic.
    """
    if B <= 0 or L <= 0:
        raise ValueError(f"B y L deben ser > 0 (B={B}, L={L}).")
    if e1 < 0 or e2 < 0:
        raise ValueError(f"e1, e2 deben ser ≥ 0 (e1={e1}, e2={e2}).")
    if 2.0 * e1 >= L:
        raise ValueError(
            f"e1/L = {e1/L:.3f} ≥ 0.5: excentricidad físicamente inadmisible."
        )
    if 2.0 * e2 >= B:
        raise ValueError(
            f"e2/B = {e2/B:.3f} ≥ 0.5: excentricidad físicamente inadmisible."
        )


def select_ha_case(eL_L: float, eB_B: float) -> HACase:
    """
    Devuelve el caso H&A según las relaciones `eL/L` y `eB/B`.
    Condiciones **mutuamente excluyentes** (Das Sección 6.12):
      Caso I   : eL/L ≥ 1/6  AND  eB/B ≥ 1/6
      Caso II  : eL/L ≥ 1/6  AND  eB/B < 1/6
      Caso III : eL/L < 1/6  AND  eB/B ≥ 1/6
      Caso IV  : eL/L < 1/6  AND  eB/B < 1/6
    Pre-condición (validada aguas arriba): eL/L < 0.5 y eB/B < 0.5.
    """
    if eL_L < 0 or eB_B < 0:
        raise ValueError(f"eL/L y eB/B deben ser ≥ 0 (eL/L={eL_L}, eB/B={eB_B}).")
    one_sixth = 1.0 / 6.0
    if eL_L >= one_sixth and eB_B >= one_sixth:
        return "I"
    if eL_L >= one_sixth and eB_B < one_sixth:
        return "II"
    if eL_L < one_sixth and eB_B >= one_sixth:
        return "III"
    return "IV"


def _case_I(B: float, L: float, e1: float, e2: float) -> dict:
    """
    Geometría triangular: A' = ½·B1·L1.
      B1 = B · (1.5 − 3·eB/B)   con eB = e2
      L1 = L · (1.5 − 3·eL/L)   con eL = e1
      A' = ½·B1·L1
      L' = max(B1, L1)
      B' = A' / L'
    """
    B1 = B * (1.5 - 3.0 * e2 / B)
    L1 = L * (1.5 - 3.0 * e1 / L)
    if B1 <= 0 or L1 <= 0:
        raise ValueError(
            f"Caso I: B1={B1:.3f}, L1={L1:.3f} no son positivos. Revise e1, e2."
        )
    A_eff = 0.5 * B1 * L1
    L_eff = max(B1, L1)
    B_eff = A_eff / L_eff
    B_eff, L_eff, swap = _swap_if_needed(B_eff, L_eff)
    return {
        "B_eff": B_eff,
        "L_eff": L_eff,
        "A_eff": A_eff,
        "caso_HA": "I",
        "geometria": "triangulo",
        "B1": B1,
        "L1": L1,
        "intercambio_aplicado": swap,
    }


_BLOCKED_MSG = (
    "Highter & Anders caso {case}: requiere digitalización de los ábacos "
    "de Das Fig. {fig} (pendiente). Use `metodo_area='rne'` como fallback "
    "hasta cargar las tablas en `HA_CASE_{case}_TABLE`."
)


def _case_II(B: float, L: float, e1: float, e2: float) -> dict:
    """
    Geometría trapecial:
      A' = ½·(L1 + L2)·B,   con L1/L y L2/L leídos de Das Fig. 6.27b.
    **Pendiente** hasta tener el JSON digitalizado.
    """
    raise NotImplementedError(_BLOCKED_MSG.format(case="II", fig="6.27b"))


def _case_III(B: float, L: float, e1: float, e2: float) -> dict:
    """
    Geometría trapecial:
      A' = ½·(B1 + B2)·L,   con B1/B y B2/B leídos de Das Fig. 6.28b.
    **Pendiente** hasta tener el JSON digitalizado.
    """
    raise NotImplementedError(_BLOCKED_MSG.format(case="III", fig="6.28b"))


def _case_IV(B: float, L: float, e1: float, e2: float) -> dict:
    """
    Geometría pentagonal:
      A' = L2·B + ½·(B + B2)·(L − L2),
      con B2/B y L2/L leídos de Das Fig. 6.29b.
    **Pendiente** hasta tener el JSON digitalizado.
    """
    raise NotImplementedError(_BLOCKED_MSG.format(case="IV", fig="6.29b"))


def compute_effective_dimensions_ha(
    B: float,
    L: float,
    e1: float,
    e2: float,
) -> dict:
    """
    Calcula (B', L', A') por Highter & Anders.
    Devuelve dict con `B_eff, L_eff, A_eff, caso_HA, intercambio_aplicado` y
    metadatos del caso.
    Lanza NotImplementedError para Casos II/III/IV mientras no se carguen los
    ábacos digitalizados. El llamante puede capturarlo y hacer fallback a
    `_compute_effective_dimensions` (RNE/Meyerhof).
    """
    validate_eccentricity(B, L, e1, e2)
    case = select_ha_case(eL_L=e1 / L, eB_B=e2 / B)
    if case == "I":
        return _case_I(B, L, e1, e2)
    if case == "II":
        return _case_II(B, L, e1, e2)
    if case == "III":
        return _case_III(B, L, e1, e2)
    return _case_IV(B, L, e1, e2)
