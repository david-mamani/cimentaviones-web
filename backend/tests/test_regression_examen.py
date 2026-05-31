"""
Tests de regresión contra el examen 2da fase del curso.

Cifras esperadas (del documento de auditoría):

  P1 — Capacidad: zapata 1.6 × 2.0, Df = 1.6
       qu  ≈ 215 t/m²    ⇒ ≈ 215 · 9.81 = 2109 kPa
       Qadm ≈ 229 t      (FS ≈ 3.2 sobre área real)

  P2 — Asentamiento: Se(Q=63 t), Se(Q=75 t), δ = |Se2 − Se1|,
       β = δ / 5.80 m, comparar con 1/500.

  P3 — Excentricidad biaxial: e1 = 0.15, e2 = 0.10 → caso IV (H&A)
       FS_real ≈ 7.6 ; qmax ≈ 36.7 ; qmin ≈ 2.7 t/m².
       BLOQUEADO hasta que se carguen las tablas digitalizadas de H&A
       Casos II/III/IV.

Las cifras del enunciado son referencia (dependen de lectura manual de
ábacos del libro). El motor las recalcula automáticamente; se espera
±5–10% por la diferencia entre digitalización y lectura humana.

TODO: completar el perfil de suelos del examen aquí cuando esté disponible.
      Hoy se usa un perfil placeholder consistente con la geometría dada
      (granular φ=30°, γ=18 kN/m³, sin nivel freático). Los tests verifican
      la *forma* del output y que el motor corre sin errores; los rangos
      numéricos son provisionales hasta validar contra el examen oficial.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(ROOT_DIR))

import pytest

from calculos.bearing_capacity import calculate_bearing_capacity


# ───────────────────────────────────────────────────────────────────
# Perfil placeholder (granular). TODO: reemplazar por el del examen.
# ───────────────────────────────────────────────────────────────────
_PROFILE_PLACEHOLDER = [
    {"id": "s1", "thickness": 3.0, "gamma": 18.0, "gammaSat": 20.0,
     "c": 0.0, "phi": 30.0},
    {"id": "s2", "thickness": 10.0, "gamma": 18.0, "gammaSat": 20.0,
     "c": 0.0, "phi": 30.0},
]


class TestP1_Capacidad:
    """Zapata 1.6 × 2.0, Df = 1.6. Esperado: qu ≈ 215 t/m², Qadm ≈ 229 t."""

    def _input(self) -> dict:
        return {
            "foundation": {
                "type": "rectangular", "B": 1.6, "L": 2.0, "Df": 1.6,
                "FS": 3.0, "beta": 0.0,
            },
            "strata": _PROFILE_PLACEHOLDER,
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0.0,
                           "hasBasement": False, "basementDepth": 0.0},
            "method": "general",
        }

    def test_runs_without_error(self):
        r = calculate_bearing_capacity(self._input())
        assert r["qu"] > 0
        assert r["qa"] > 0
        assert r["Qmax"] > 0

    @pytest.mark.skip(reason="TODO: requiere perfil real del examen para validar cifra")
    def test_qu_matches_expected(self):
        # qu ≈ 215 t/m² ≈ 2109 kPa
        r = calculate_bearing_capacity(self._input())
        qu_tm2 = r["qu"] / 9.81
        assert qu_tm2 == pytest.approx(215.0, rel=0.10)

    @pytest.mark.skip(reason="TODO: requiere perfil real del examen para validar cifra")
    def test_Qadm_matches_expected(self):
        # Qadm ≈ 229 t = 229·9.81 = 2246 kN
        r = calculate_bearing_capacity(self._input())
        Qadm_t = r["Qmax"] / 9.81
        assert Qadm_t == pytest.approx(229.0, rel=0.10)


class TestP3_Excentricidad_Biaxial:
    """e1 = 0.15, e2 = 0.10 → caso IV. FS≈7.6, qmax≈36.7, qmin≈2.7 t/m².

    BLOQUEADO: requiere las tablas digitalizadas H&A para Caso IV.
    """

    def _input(self, metodo_area: str = "rne") -> dict:
        return {
            "foundation": {
                "type": "rectangular", "B": 1.6, "L": 2.0, "Df": 1.6,
                "FS": 3.0, "beta": 0.0,
                "e1": 0.15, "e2": 0.10, "Q": 630.0,
                "metodo_area": metodo_area,
            },
            "strata": _PROFILE_PLACEHOLDER,
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0.0,
                           "hasBasement": False, "basementDepth": 0.0},
            "method": "general",
        }

    def test_rne_runs_without_error(self):
        """Referencia con RNE/Meyerhof (mientras H&A está bloqueado)."""
        r = calculate_bearing_capacity(self._input("rne"))
        ecc = r["eccentricity"]
        assert ecc["caso_carga"] == "biaxial"
        assert ecc["FS_real"] is not None
        assert ecc["qmax"] is not None and ecc["qmin"] is not None

    def test_HA_falls_back_to_rne(self):
        """Caso IV con H&A: se hace fallback a RNE y se reporta el warning."""
        r = calculate_bearing_capacity(self._input("highter_anders"))
        assert r["eccentricity"]["metodo_area"] == "rne"
        assert r["eccentricity"]["metodo_area_solicitado"] == "highter_anders"
        assert any("Highter & Anders" in w for w in r["warnings"])

    @pytest.mark.skip(reason="Bloqueado: H&A Caso IV requiere tabla digitalizada")
    def test_HA_caso_IV_matches_expected(self):
        r = calculate_bearing_capacity(self._input("highter_anders"))
        ecc = r["eccentricity"]
        assert ecc["caso_HA"] == "IV"
        assert ecc["FS_real"] == pytest.approx(7.6, rel=0.10)
        qmax_tm2 = ecc["qmax"] / 9.81
        qmin_tm2 = ecc["qmin"] / 9.81
        assert qmax_tm2 == pytest.approx(36.7, rel=0.10)
        assert qmin_tm2 == pytest.approx(2.7, rel=0.10)


# Test P2 (asentamiento diferencial) — pendiente de definir el perfil de
# suelos arcilloso del examen. Habilitado por las Tandas 4.1 + 4.2;
# falta solo el dato del examen oficial.
@pytest.mark.skip(reason="TODO: definir perfil arcilloso del examen para validar cifras P2")
def test_P2_asentamiento_diferencial():
    """Se(63 t), Se(75 t), δ, β = δ/5.80m comparado con 1/500."""
    pass
