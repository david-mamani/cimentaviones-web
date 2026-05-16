"""
Tests unitarios para el motor de cálculos de capacidad portante.

Cobertura:
  - Factores Nc/Nq/Nγ analíticos por método (Terzaghi, General, RNE)
  - Cálculos completos (cohesivo, friccionante, con/sin NF)
  - Matriz 3×3 (método × criterio)
  - Excentricidad: B'/L', kern, qmax/qmin, FS_real
  - Guards defensivos (B=0, FS=0, perfil insuficiente, etc.)
  - Iteraciones paramétricas
"""

import pytest
from calculos.factors import (
    get_terzaghi_bearing_factors,
    get_general_bearing_factors,
    get_rne_bearing_factors,
    get_inclination_factors,
)
from calculos.methods import apply_criterion, soil_type_from_phi
from calculos.bearing_capacity import calculate_bearing_capacity
from calculos.parametric_iterations import run_parametric_iterations


# ═══════════════════════════════════════════════════════════════
# 1. FACTORES Nc, Nq, Nγ
# ═══════════════════════════════════════════════════════════════

class TestTerzaghiFactors:
    """Factores analíticos de Terzaghi (Das 8ed)."""

    def test_phi_0(self):
        f = get_terzaghi_bearing_factors(0)
        assert f["Nc"] == 5.70
        assert f["Nq"] == 1.00
        assert f["Ngamma"] == 0.00

    def test_phi_30(self):
        f = get_terzaghi_bearing_factors(30)
        assert f["Nc"] == pytest.approx(37.16, abs=0.05)
        assert f["Nq"] == pytest.approx(22.46, abs=0.05)
        assert f["Ngamma"] == pytest.approx(19.32, abs=0.05)

    def test_monotonic(self):
        """A mayor φ, mayores factores."""
        f10 = get_terzaghi_bearing_factors(10)
        f20 = get_terzaghi_bearing_factors(20)
        f30 = get_terzaghi_bearing_factors(30)
        assert f10["Nc"] < f20["Nc"] < f30["Nc"]
        assert f10["Nq"] < f20["Nq"] < f30["Nq"]
        assert f10["Ngamma"] < f20["Ngamma"] < f30["Ngamma"]

    def test_out_of_range(self):
        with pytest.raises(ValueError):
            get_terzaghi_bearing_factors(-1)
        with pytest.raises(ValueError):
            get_terzaghi_bearing_factors(51)


class TestGeneralFactors:
    """Factores Vesic/Prandtl/Reissner."""

    def test_phi_0(self):
        f = get_general_bearing_factors(0)
        assert f["Nc"] == 5.14
        assert f["Nq"] == 1.00
        assert f["Ngamma"] == 0.00

    def test_phi_30(self):
        f = get_general_bearing_factors(30)
        # Vesic Nq ≈ 18.40, Nc ≈ 30.14, Nγ = 2(Nq+1)tanφ ≈ 22.40
        assert f["Nq"] == pytest.approx(18.40, abs=0.05)
        assert f["Nc"] == pytest.approx(30.14, abs=0.05)
        assert f["Ngamma"] == pytest.approx(22.40, abs=0.05)


class TestRNEFactors:
    """Factores RNE E.050."""

    def test_phi_0(self):
        f = get_rne_bearing_factors(0)
        assert f["Nc"] == 5.14
        assert f["Nq"] == 1.00
        assert f["Ngamma"] == 0.00

    def test_phi_30_shares_NcNq_with_general(self):
        """RNE comparte Nc, Nq con la Ec. General; difiere solo en Nγ."""
        rne = get_rne_bearing_factors(30)
        gen = get_general_bearing_factors(30)
        assert rne["Nc"] == pytest.approx(gen["Nc"], abs=0.01)
        assert rne["Nq"] == pytest.approx(gen["Nq"], abs=0.01)
        # Nγ_RNE = (Nq-1)·tan(1.4φ) ≈ 15.67 vs Nγ_gen ≈ 22.40
        assert rne["Ngamma"] != pytest.approx(gen["Ngamma"], abs=1.0)
        assert rne["Ngamma"] == pytest.approx(15.67, abs=0.05)


class TestInclinationFactors:
    def test_beta_zero(self):
        f = get_inclination_factors(0, 30)
        assert f == {"ic": 1.0, "iq": 1.0, "igamma": 1.0}

    def test_phi_zero_beta_positive(self):
        """φ=0 ∧ β>0: Fqi=1 (convención), Fγi=0 (irrelevante)."""
        f = get_inclination_factors(10, 0)
        assert f["ic"] == pytest.approx((1 - 10/90) ** 2, abs=0.001)
        assert f["iq"] == 1.0
        assert f["igamma"] == 0.0

    def test_beta_lt_phi(self):
        f = get_inclination_factors(15, 30)
        expected_ic = (1 - 15/90) ** 2
        expected_ig = (1 - 15/30) ** 2
        assert f["ic"] == pytest.approx(expected_ic, abs=0.001)
        assert f["iq"] == pytest.approx(expected_ic, abs=0.001)
        assert f["igamma"] == pytest.approx(expected_ig, abs=0.001)

    def test_beta_ge_phi(self):
        f = get_inclination_factors(30, 30)
        assert f["igamma"] == 0.0


# ═══════════════════════════════════════════════════════════════
# 2. CRITERIOS Y CLASIFICACIÓN
# ═══════════════════════════════════════════════════════════════

class TestSoilClassification:
    def test_phi_20_is_cohesive(self):
        """φ=20° debe clasificar como cohesivo (≤ 20°)."""
        assert soil_type_from_phi(20) == "Coh"

    def test_phi_21_is_frictional(self):
        assert soil_type_from_phi(21) == "Fri"

    def test_phi_0_is_cohesive(self):
        assert soil_type_from_phi(0) == "Coh"


class TestCriterionApplication:
    """apply_criterion combina S1, S2, S3 según el criterio y tipo de suelo."""

    def test_general_cohesive(self):
        assert apply_criterion(100, 50, 20, "Coh", "general") == 170

    def test_general_frictional(self):
        assert apply_criterion(100, 50, 20, "Fri", "general") == 170

    def test_rne_cohesive_is_S1_only(self):
        assert apply_criterion(100, 50, 20, "Coh", "rne") == 100

    def test_rne_frictional_is_S2_plus_S3(self):
        assert apply_criterion(100, 50, 20, "Fri", "rne") == 70

    def test_rne_corrected_cohesive_is_S1_plus_S2(self):
        assert apply_criterion(100, 50, 20, "Coh", "rne_corrected") == 150

    def test_rne_corrected_frictional_is_S2_plus_S3(self):
        assert apply_criterion(100, 50, 20, "Fri", "rne_corrected") == 70


# ═══════════════════════════════════════════════════════════════
# 3. CÁLCULOS COMPLETOS DE CAPACIDAD PORTANTE
# ═══════════════════════════════════════════════════════════════

class TestBearingCapacity:

    def test_clay_square_terzaghi(self):
        """Arcilla pura (φ=0) cuadrada con Terzaghi.

        c=50 kPa, γ=18 kN/m³, B=2 m, Df=1.5 m, FS=3, sin NF
        q = 18·1.5 = 27 kPa
        qu = 1.3·50·5.70 + 27·1 + 0 = 397.5 kPa
        qa = 132.5 kPa
        """
        data = {
            "foundation": {"type": "cuadrada", "B": 2.0, "L": 2.0, "Df": 1.5, "FS": 3.0, "beta": 0},
            "strata": [{"id": "1", "thickness": 3.0, "gamma": 18, "c": 50, "phi": 0, "gammaSat": 20}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "terzaghi",
        }
        r = calculate_bearing_capacity(data)
        assert r["q"] == pytest.approx(27, abs=0.1)
        assert r["qu"] == pytest.approx(397.5, abs=0.5)
        assert r["qa"] == pytest.approx(132.5, abs=0.5)
        assert r["soilType"] == "Coh"

    def test_sand_square_terzaghi(self):
        """Arena pura (φ=30, c=0) cuadrada con Terzaghi.

        Con fórmula analítica: Nq≈22.46, Nc≈37.16, Nγ≈19.32
        S2 = 19·22.46, S3 = 0.4·19·1.5·19.32, qu ≈ 646.9 kPa
        """
        data = {
            "foundation": {"type": "cuadrada", "B": 1.5, "L": 1.5, "Df": 1.0, "FS": 3.0, "beta": 0},
            "strata": [{"id": "1", "thickness": 3.0, "gamma": 19, "c": 0, "phi": 30, "gammaSat": 21}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "terzaghi",
        }
        r = calculate_bearing_capacity(data)
        assert r["q"] == pytest.approx(19, abs=0.1)
        assert r["bearingFactors"]["Nc"] == pytest.approx(37.16, abs=0.05)
        assert r["bearingFactors"]["Nq"] == pytest.approx(22.46, abs=0.05)
        assert r["bearingFactors"]["Ngamma"] == pytest.approx(19.32, abs=0.05)
        assert r["qu"] == pytest.approx(646.9, abs=2)
        assert r["soilType"] == "Fri"


# ═══════════════════════════════════════════════════════════════
# 4. MATRIZ 3×3 (MÉTODO × CRITERIO)
# ═══════════════════════════════════════════════════════════════

class TestMethodCriteriaMatrix:

    def _clay_input(self, method="terzaghi"):
        return {
            "foundation": {"type": "cuadrada", "B": 2.0, "L": 2.0, "Df": 1.5, "FS": 3.0, "beta": 0},
            "strata": [{"id": "1", "thickness": 3.0, "gamma": 18, "c": 50, "phi": 0, "gammaSat": 20}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": method,
        }

    def test_matrix_has_three_methods_three_criteria(self):
        r = calculate_bearing_capacity(self._clay_input())
        m = r["methodCriteriaMatrix"]
        assert set(m.keys()) == {"terzaghi", "general", "rne"}
        for method_blk in m.values():
            assert set(method_blk["criteria"].keys()) == {"general", "rne", "rne_corrected"}

    def test_cohesive_rne_drops_q_term(self):
        """Suelo cohesivo: criterio RNE descarta S2 (= q·Nq·...)."""
        r = calculate_bearing_capacity(self._clay_input())
        terz = r["methodCriteriaMatrix"]["terzaghi"]
        # RNE solo S1; RNE_corr S1+S2; General S1+S2+S3
        assert terz["criteria"]["rne"]["qu"] == pytest.approx(terz["S1"], abs=0.1)
        assert terz["criteria"]["rne_corrected"]["qu"] == pytest.approx(terz["S1"] + terz["S2"], abs=0.1)
        assert terz["criteria"]["general"]["qu"] == pytest.approx(terz["S1"] + terz["S2"] + terz["S3"], abs=0.1)

    def test_frictional_rne_drops_S1(self):
        """Suelo friccionante: criterio RNE descarta S1 (cohesión despreciable)."""
        sand = {
            "foundation": {"type": "cuadrada", "B": 1.5, "L": 1.5, "Df": 1.0, "FS": 3.0, "beta": 0},
            "strata": [{"id": "1", "thickness": 3.0, "gamma": 19, "c": 10, "phi": 30, "gammaSat": 21}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "general",
        }
        r = calculate_bearing_capacity(sand)
        assert r["soilType"] == "Fri"
        gen_blk = r["methodCriteriaMatrix"]["general"]
        # Friccionante: RNE y RNE_corr ambos = S2+S3
        expected_rne = gen_blk["S2"] + gen_blk["S3"]
        assert gen_blk["criteria"]["rne"]["qu"] == pytest.approx(expected_rne, abs=0.1)
        assert gen_blk["criteria"]["rne_corrected"]["qu"] == pytest.approx(expected_rne, abs=0.1)

    def test_terzaghi_block_omitted_for_rectangular(self):
        """Con cimentación rectangular, terzaghi se debe omitir de la matriz."""
        rect = {
            "foundation": {"type": "rectangular", "B": 1.5, "L": 3.0, "Df": 1.0, "FS": 3.0, "beta": 0},
            "strata": [{"id": "1", "thickness": 5.0, "gamma": 19, "c": 10, "phi": 25, "gammaSat": 21}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "general",
        }
        r = calculate_bearing_capacity(rect)
        assert "terzaghi" not in r["methodCriteriaMatrix"]
        assert "general" in r["methodCriteriaMatrix"]
        assert "rne" in r["methodCriteriaMatrix"]


# ═══════════════════════════════════════════════════════════════
# 5. EXCENTRICIDAD
# ═══════════════════════════════════════════════════════════════

class TestEccentricity:

    def test_no_eccentricity_returns_none(self):
        data = {
            "foundation": {"type": "cuadrada", "B": 2.0, "L": 2.0, "Df": 1.5, "FS": 3.0, "beta": 0},
            "strata": [{"id": "1", "thickness": 3.0, "gamma": 18, "c": 50, "phi": 0, "gammaSat": 20}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "terzaghi",
        }
        r = calculate_bearing_capacity(data)
        assert r["eccentricity"] is None

    def test_trapezoidal_regime_inside_kern(self):
        """e1=0.2 < B/6≈0.33 y e2=0.1 < L/6=0.5 → trapezoidal."""
        data = {
            "foundation": {"type": "rectangular", "B": 2.0, "L": 3.0, "Df": 1.5,
                           "FS": 3.0, "beta": 0, "e1": 0.2, "e2": 0.1, "Q": 500},
            "strata": [{"id": "1", "thickness": 5.0, "gamma": 18, "c": 10, "phi": 25, "gammaSat": 20}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "general",
        }
        r = calculate_bearing_capacity(data)
        ec = r["eccentricity"]
        assert ec["regime"] == "trapezoidal"
        assert ec["B_eff"] == pytest.approx(1.6, abs=0.01)
        assert ec["L_eff"] == pytest.approx(2.8, abs=0.01)
        assert ec["A_eff"] == pytest.approx(4.48, abs=0.01)
        # qmax = (500/6)·(1 + 0.6 + 0.2) = 150.00
        assert ec["qmax"] == pytest.approx(150.0, abs=0.5)
        # qmin = (500/6)·(1 - 0.6 - 0.2) = 16.67
        assert ec["qmin"] == pytest.approx(16.67, abs=0.5)
        assert ec["FS_real"] is not None
        assert ec["FS_real"] > 3.0  # válido
        assert ec["valid"] is True

    def test_triangular_regime_outside_kern(self):
        """e1=0.5 > B/6=0.333 → régimen triangular con warning."""
        data = {
            "foundation": {"type": "cuadrada", "B": 2.0, "L": 2.0, "Df": 1.0,
                           "FS": 3.0, "beta": 0, "e1": 0.5, "e2": 0.0, "Q": 200},
            "strata": [{"id": "1", "thickness": 5.0, "gamma": 18, "c": 10, "phi": 25, "gammaSat": 20}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "general",
        }
        r = calculate_bearing_capacity(data)
        ec = r["eccentricity"]
        assert ec["regime"] == "triangular"
        assert ec["qmin"] == 0.0
        # qmax = 4·200 / (3 · 2 · (2 - 1)) = 800/6 = 133.33
        assert ec["qmax"] == pytest.approx(133.33, abs=0.5)
        assert any("kern" in w.lower() or "núcleo" in w.lower() for w in r["warnings"])

    def test_eccentricity_too_large_raises(self):
        """2·e1 ≥ B debe lanzar ValueError en el motor."""
        data = {
            "foundation": {"type": "rectangular", "B": 2.0, "L": 3.0, "Df": 1.0,
                           "FS": 3.0, "beta": 0, "e1": 1.0, "e2": 0.0, "Q": 200},
            "strata": [{"id": "1", "thickness": 5.0, "gamma": 18, "c": 10, "phi": 25, "gammaSat": 20}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "general",
        }
        with pytest.raises(ValueError):
            calculate_bearing_capacity(data)


# ═══════════════════════════════════════════════════════════════
# 6. GUARDS DEFENSIVOS Y WARNINGS
# ═══════════════════════════════════════════════════════════════

class TestEdgeCases:

    def _base(self):
        return {
            "foundation": {"type": "cuadrada", "B": 1.0, "L": 1.0, "Df": 1.0, "FS": 3.0, "beta": 0},
            "strata": [{"id": "1", "thickness": 3.0, "gamma": 18, "c": 10, "phi": 25, "gammaSat": 20}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "terzaghi",
        }

    def test_B_zero_raises(self):
        d = self._base(); d["foundation"]["B"] = 0
        with pytest.raises(ValueError, match="ancho B"):
            calculate_bearing_capacity(d)

    def test_L_zero_raises(self):
        d = self._base(); d["foundation"]["L"] = 0
        with pytest.raises(ValueError, match="longitud L"):
            calculate_bearing_capacity(d)

    def test_FS_zero_raises(self):
        d = self._base(); d["foundation"]["FS"] = 0
        with pytest.raises(ValueError, match="factor de seguridad"):
            calculate_bearing_capacity(d)

    def test_empty_strata_raises(self):
        d = self._base(); d["strata"] = []
        with pytest.raises(ValueError, match="estrato"):
            calculate_bearing_capacity(d)

    def test_Df_exceeds_profile_raises(self):
        d = self._base(); d["foundation"]["Df"] = 10.0  # > 3.0 thickness
        with pytest.raises(ValueError, match="perfil"):
            calculate_bearing_capacity(d)

    def test_terzaghi_rectangular_raises(self):
        d = self._base()
        d["foundation"]["type"] = "rectangular"
        d["foundation"]["L"] = 2.0
        d["method"] = "terzaghi"
        with pytest.raises(ValueError, match="rectangular"):
            calculate_bearing_capacity(d)

    def test_df_over_b_greater_than_5_warning(self):
        d = self._base()
        d["foundation"]["B"] = 0.5
        d["foundation"]["Df"] = 3.0
        d["strata"][0]["thickness"] = 5.0
        d["method"] = "general"
        r = calculate_bearing_capacity(d)
        assert any("Df/B" in w for w in r["warnings"])

    def test_water_table_case1(self):
        """NF sobre la cimentación (Dw < Df) → caso 1."""
        d = self._base()
        d["conditions"]["hasWaterTable"] = True
        d["conditions"]["waterTableDepth"] = 0.5
        r = calculate_bearing_capacity(d)
        assert r["waterTableCase"] == 1

    def test_water_table_case4(self):
        """NF muy profundo (Dw >> Df+B) → caso 4."""
        d = self._base()
        d["conditions"]["hasWaterTable"] = True
        d["conditions"]["waterTableDepth"] = 2.5
        r = calculate_bearing_capacity(d)
        assert r["waterTableCase"] == 4

    def test_general_method_works(self):
        d = self._base(); d["method"] = "general"
        r = calculate_bearing_capacity(d)
        assert r["qa"] > 0

    def test_rne_method_works(self):
        d = self._base(); d["method"] = "rne"
        r = calculate_bearing_capacity(d)
        assert r["qa"] > 0


# ═══════════════════════════════════════════════════════════════
# 7. ITERACIONES PARAMÉTRICAS
# ═══════════════════════════════════════════════════════════════

class TestParametricIterations:

    def _base(self):
        return {
            "foundation": {"type": "cuadrada", "B": 1.0, "L": 1.0, "Df": 1.0, "FS": 3.0, "beta": 0},
            "strata": [{"id": "1", "thickness": 5.0, "gamma": 18, "c": 10, "phi": 25, "gammaSat": 20}],
            "conditions": {"hasWaterTable": False, "waterTableDepth": 0, "hasBasement": False, "basementDepth": 0},
            "method": "terzaghi",
        }

    def test_basic_iteration(self):
        config = {
            "varyB": True, "bStart": 1.0, "bEnd": 2.0, "bStep": 0.5,
            "varyDf": False, "dfStart": 1.0, "dfEnd": 1.0, "dfStep": 0.5,
        }
        r = run_parametric_iterations(self._base(), config)
        assert len(r["bValues"]) == 3
        assert len(r["matrix"]) == 1
        assert len(r["matrix"][0]) == 3

    def test_too_many_points_raises(self):
        config = {
            "varyB": True, "bStart": 0.1, "bEnd": 100, "bStep": 0.01,
            "varyDf": True, "dfStart": 0.1, "dfEnd": 100, "dfStep": 0.01,
        }
        with pytest.raises(ValueError, match="máximo"):
            run_parametric_iterations(self._base(), config)
