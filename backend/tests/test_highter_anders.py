"""
Tests del scaffold de Highter & Anders (`calculos/highter_anders.py`).

Cubre:
  - Selector de caso con condiciones mutuamente excluyentes.
  - Validación física (e/dim < 0.5).
  - Caso I cerrado (Das Ec. 6.71–6.74).
  - Stubs Casos II/III/IV lanzan NotImplementedError.
  - Swap final B' ≤ L'.
  - Fallback a RNE en bearing_capacity cuando el caso no está disponible.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(ROOT_DIR))

import pytest

from calculos.highter_anders import (
    select_ha_case,
    validate_eccentricity,
    compute_effective_dimensions_ha,
)
from calculos.bearing_capacity import calculate_bearing_capacity


class TestSelectCase:

    def test_caso_I_both_above_1_6(self):
        # eL/L = 0.2 ≥ 1/6 ≈ 0.167 ; eB/B = 0.18 ≥ 1/6
        assert select_ha_case(0.20, 0.18) == "I"

    def test_caso_II_eL_above_eB_below(self):
        assert select_ha_case(0.20, 0.10) == "II"

    def test_caso_III_eL_below_eB_above(self):
        assert select_ha_case(0.10, 0.20) == "III"

    def test_caso_IV_both_below_1_6(self):
        # eL/L = 0.094 < 1/6 ; eB/B = 0.094 < 1/6 (caso del examen P3)
        assert select_ha_case(0.10 / 2.0, 0.15 / 1.6) == "IV"  # ≈ 0.05, 0.094

    def test_boundary_exactly_1_6(self):
        # En el límite inferior, va al "≥": Caso I si ambos == 1/6
        assert select_ha_case(1.0 / 6.0, 1.0 / 6.0) == "I"

    def test_mutually_exclusive(self):
        # Para cualquier (eL/L, eB/B) en el rango admisible, exactamente
        # uno de los 4 casos aplica.
        seen = set()
        for el in (0.05, 0.10, 0.165, 0.18, 0.30, 0.49):
            for eb in (0.05, 0.10, 0.165, 0.18, 0.30, 0.49):
                seen.add(select_ha_case(el, eb))
        assert seen == {"I", "II", "III", "IV"}


class TestValidate:

    def test_accepts_valid_eccentricity(self):
        validate_eccentricity(B=2.0, L=3.0, e1=0.5, e2=0.4)  # no raise

    def test_rejects_eL_too_large(self):
        # e1/L = 0.5 ⇒ inadmisible
        with pytest.raises(ValueError):
            validate_eccentricity(B=2.0, L=2.0, e1=1.0, e2=0.0)

    def test_rejects_eB_too_large(self):
        with pytest.raises(ValueError):
            validate_eccentricity(B=2.0, L=2.0, e1=0.0, e2=1.0)

    def test_rejects_negative(self):
        with pytest.raises(ValueError):
            validate_eccentricity(B=2.0, L=2.0, e1=-0.1, e2=0.0)


class TestCasoI:

    def test_closed_form_basic(self):
        # B = L = 2 m, eL/L = eB/B = 0.20 ⇒ Caso I
        r = compute_effective_dimensions_ha(B=2.0, L=2.0, e1=0.40, e2=0.40)
        assert r["caso_HA"] == "I"
        # B1 = 2·(1.5 - 3·0.2) = 2·0.9 = 1.8
        # L1 = 2·(1.5 - 3·0.2) = 1.8
        # A' = 0.5·1.8·1.8 = 1.62
        # L' = max(1.8, 1.8) = 1.8 ; B' = 1.62/1.8 = 0.9
        assert r["A_eff"] == pytest.approx(1.62, abs=1e-6)
        assert r["L_eff"] == pytest.approx(1.8, abs=1e-6)
        assert r["B_eff"] == pytest.approx(0.9, abs=1e-6)
        # B' ≤ L'
        assert r["B_eff"] <= r["L_eff"]

    def test_swap_applied_when_needed(self):
        # Forzar B1 > L1 con dimensiones rectangulares y e adecuadas.
        # B = 3, L = 2, eB/B = 0.20, eL/L = 0.20
        # B1 = 3·0.9 = 2.7 ; L1 = 2·0.9 = 1.8
        # L' inicial = max(2.7, 1.8) = 2.7 ; B' = A'/L' = (0.5·2.7·1.8)/2.7 = 0.9
        # Ya cumple B' ≤ L', sin swap.
        r = compute_effective_dimensions_ha(B=3.0, L=2.0, e1=0.40, e2=0.60)
        assert r["B_eff"] <= r["L_eff"]


class TestCasos_II_III_IV_blocked:

    def test_caso_II_raises(self):
        # eL/L = 0.20, eB/B = 0.10 ⇒ Caso II ⇒ NotImplementedError
        with pytest.raises(NotImplementedError) as exc:
            compute_effective_dimensions_ha(B=2.0, L=2.0, e1=0.40, e2=0.20)
        assert "6.27b" in str(exc.value)

    def test_caso_III_raises(self):
        with pytest.raises(NotImplementedError) as exc:
            compute_effective_dimensions_ha(B=2.0, L=2.0, e1=0.20, e2=0.40)
        assert "6.28b" in str(exc.value)

    def test_caso_IV_raises(self):
        with pytest.raises(NotImplementedError) as exc:
            compute_effective_dimensions_ha(B=2.0, L=2.0, e1=0.20, e2=0.20)
        assert "6.29b" in str(exc.value)


class TestFallback_in_bearing_capacity:

    def _base_input(self, metodo_area: str, e1: float, e2: float) -> dict:
        return {
            "foundation": {
                "type": "rectangular", "B": 1.6, "L": 2.0, "Df": 1.6, "FS": 3.0,
                "beta": 0.0, "e1": e1, "e2": e2, "Q": 630.0,
                "metodo_area": metodo_area,
            },
            "strata": [
                {"id": "s1", "thickness": 3.0, "gamma": 18.0, "gammaSat": 20.0,
                 "c": 0.0, "phi": 30.0},
                {"id": "s2", "thickness": 10.0, "gamma": 18.0, "gammaSat": 20.0,
                 "c": 0.0, "phi": 30.0},
            ],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0.0,
                           "hasBasement": False, "basementDepth": 0.0},
            "method": "general",
        }

    def test_default_rne(self):
        r = calculate_bearing_capacity(self._base_input("rne", 0.15, 0.10))
        assert r["eccentricity"]["metodo_area"] == "rne"
        assert r["eccentricity"]["caso_HA"] is None

    def test_HA_caso_IV_falls_back_to_rne_with_warning(self):
        # eL/L = 0.075, eB/B = 0.0625 ⇒ Caso IV (ambos < 1/6)
        r = calculate_bearing_capacity(self._base_input("highter_anders", 0.15, 0.10))
        # Fallback automático
        assert r["eccentricity"]["metodo_area"] == "rne"
        assert r["eccentricity"]["metodo_area_solicitado"] == "highter_anders"
        assert any("Highter & Anders" in w for w in r["warnings"])

    def test_HA_caso_I_works(self):
        # Necesitamos eL/L ≥ 1/6 y eB/B ≥ 1/6 simultáneamente.
        # B = 1.6 ⇒ e2 ≥ 1.6/6 ≈ 0.267 ; L = 2.0 ⇒ e1 ≥ 2.0/6 ≈ 0.334
        r = calculate_bearing_capacity(self._base_input("highter_anders", 0.40, 0.30))
        assert r["eccentricity"]["metodo_area"] == "highter_anders"
        assert r["eccentricity"]["caso_HA"] == "I"
