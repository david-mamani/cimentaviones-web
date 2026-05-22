"""
Tests del motor de asentamientos (`calculos/settlement.py`).

Cubre las decisiones D A.1 … D A.20 documentadas en
`MOTOR_ASENTAMIENTOS.md`.
"""
import math
import pytest

from calculos.settlement import (
    FOX_TABLE,
    steinbrenner_Is,
    If_factor,
    detect_rigid_stratum,
    equivalent_Es_multilayer,
    pick_mu_under_base,
    water_table_correction,
    elastic_settlement,
    qadm_from_settlement_limit,
    consolidation_settlement,
    Es_from_N60_kulhawy_mayne,
    KM_ALPHA_TABLE,
    design_qadm,
    angular_distortion,
    calculate_total_settlement,
    iterate_qadm_vs_B,
)


# ═══════════════════════════════════════════════════════════════
# 1. Steinbrenner Is (D A.5, D A.6)
# ═══════════════════════════════════════════════════════════════

class TestSteinbrenner:

    def test_basic_corner_case(self):
        """L/B=1, H/B=1, μ=0.30 — caso típico."""
        r = steinbrenner_Is(m_prime=1.0, n_prime=1.0, mu_s=0.30)
        assert r["F1"] > 0
        assert r["F2"] > 0
        assert r["Is"] > 0

    def test_mu_05_reduces_to_F1(self):
        """D A.6: μ=0.5 ⇒ Is = F1."""
        r = steinbrenner_Is(m_prime=2.0, n_prime=1.5, mu_s=0.5)
        assert r["Is"] == pytest.approx(r["F1"], abs=1e-9)

    def test_arctan_correction_when_m2n2_gt_m2n2p1(self):
        """D A.5: si m²·n² > m²+n²+1 ⇒ se aplica corrección."""
        # m=10, n=10 ⇒ 10000 > 201
        r = steinbrenner_Is(m_prime=10.0, n_prime=10.0, mu_s=0.30)
        assert r["arctan_correction_applied"] is True

    def test_arctan_no_correction_when_small(self):
        """m=1, n=1 ⇒ 1 < 3 ⇒ sin corrección."""
        r = steinbrenner_Is(m_prime=1.0, n_prime=1.0, mu_s=0.30)
        assert r["arctan_correction_applied"] is False

    def test_invalid_m_or_n_raises(self):
        with pytest.raises(ValueError):
            steinbrenner_Is(m_prime=0.0, n_prime=1.0, mu_s=0.30)
        with pytest.raises(ValueError):
            steinbrenner_Is(m_prime=1.0, n_prime=-0.5, mu_s=0.30)


# ═══════════════════════════════════════════════════════════════
# 2. Fox If (D A.7)
# ═══════════════════════════════════════════════════════════════

class TestFoxIf:

    def test_Df_zero_returns_1(self):
        """If(Df=0) = 1 para cualquier L/B y μ."""
        for lb in [1, 2, 5]:
            for mu in [0.30, 0.40, 0.50]:
                r = If_factor(Df=0.0, B=1.0, L=lb * 1.0, mu_s=mu)
                assert r["If"] == pytest.approx(1.0, abs=1e-9)

    def test_lookup_exact_table_value(self):
        """Df/B=1.0, L/B=1, μ=0.30 ⇒ 0.63 según la tabla."""
        r = If_factor(Df=1.0, B=1.0, L=1.0, mu_s=0.30)
        assert r["If"] == pytest.approx(0.63, abs=1e-9)

    def test_interpolate_in_DfB(self):
        """Df/B=0.5, L/B=1, μ=0.30 ⇒ entre 0.82 (0.4) y 0.74 (0.6)."""
        r = If_factor(Df=0.5, B=1.0, L=1.0, mu_s=0.30)
        # interp(0.5, 0.4→0.82, 0.6→0.74) = 0.78
        assert r["If"] == pytest.approx(0.78, abs=1e-3)

    def test_clamp_DfB_above_2(self):
        """Df/B > 2 ⇒ se congela al valor de 2 y emite out_of_range."""
        r = If_factor(Df=10.0, B=1.0, L=1.0, mu_s=0.30)
        # tabla en Df/B=2, L/B=1, μ=0.30 = 0.51
        assert r["If"] == pytest.approx(0.51, abs=1e-9)
        assert r["out_of_range"] is True

    def test_clamp_LB_above_5(self):
        """L/B > 5 ⇒ congelado a L/B=5."""
        r = If_factor(Df=1.0, B=1.0, L=10.0, mu_s=0.30)
        # tabla en Df/B=1, L/B=5, μ=0.30 = 0.74
        assert r["If"] == pytest.approx(0.74, abs=1e-9)
        assert r["out_of_range"] is True

    def test_interp_in_mu(self):
        """Df/B=1, L/B=1, μ=0.35 ⇒ entre 0.63 (0.30) y 0.67 (0.40)."""
        r = If_factor(Df=1.0, B=1.0, L=1.0, mu_s=0.35)
        assert r["If"] == pytest.approx(0.65, abs=1e-3)


# ═══════════════════════════════════════════════════════════════
# 3. detect_rigid_stratum (D A.18)
# ═══════════════════════════════════════════════════════════════

class TestRigidDetection:

    def test_detects_when_Es_jumps_10x(self):
        """Estrato bajo la base con Es=10× el anterior ⇒ detectado."""
        strata = [
            {"thickness": 1.0, "Es": 5000},     # arriba de la base
            {"thickness": 2.0, "Es": 10000},    # bajo la base
            {"thickness": 2.0, "Es": 150000},   # rígido (15×)
            {"thickness": 5.0, "Es": 200000},
        ]
        r = detect_rigid_stratum(strata, Df_abs=1.0, B=1.5)
        assert r["auto_detected"] is True
        # El estrato rígido está a profundidad 1+2=3 m, la base está a 1 m
        # H desde la base = 2.0 m
        assert r["H"] == pytest.approx(2.0, abs=1e-9)

    def test_falls_back_to_5B(self):
        """Sin estrato rígido dentro de Df + 5B ⇒ H = 5B."""
        strata = [
            {"thickness": 1.0, "Es": 5000},
            {"thickness": 20.0, "Es": 10000},  # uniforme, no salta
        ]
        r = detect_rigid_stratum(strata, Df_abs=1.0, B=1.0)
        assert r["auto_detected"] is False
        assert r["H"] == pytest.approx(5.0, abs=1e-9)


# ═══════════════════════════════════════════════════════════════
# 4. Es equivalente
# ═══════════════════════════════════════════════════════════════

class TestEquivalentEs:

    def test_single_layer_within_zone(self):
        strata = [{"thickness": 10.0, "Es": 12000}]
        r = equivalent_Es_multilayer(strata, Df_abs=1.0, B=1.0, z_bar=5.0)
        assert r["Es_eq"] == pytest.approx(12000.0, abs=1e-6)
        assert r["h_total_used"] == pytest.approx(5.0, abs=1e-9)

    def test_two_layers_weighted(self):
        # Estrato 1: 0-3m Es=10000; Estrato 2: 3-8m Es=20000
        strata = [
            {"thickness": 3.0, "Es": 10000},
            {"thickness": 10.0, "Es": 20000},
        ]
        # Df=1m, B=1m ⇒ zona [1, 1+5] = [1, 6]
        # Capa 1 aporta [1,3]=2 m → 10000·2 = 20000
        # Capa 2 aporta [3,6]=3 m → 20000·3 = 60000
        # Es_eq = 80000/5 = 16000
        r = equivalent_Es_multilayer(strata, Df_abs=1.0, B=1.0, z_bar=5.0)
        assert r["Es_eq"] == pytest.approx(16000.0, abs=1e-6)

    def test_raises_when_layer_missing_Es(self):
        strata = [{"thickness": 5.0}]   # sin Es
        with pytest.raises(ValueError):
            equivalent_Es_multilayer(strata, Df_abs=1.0, B=1.0, z_bar=5.0)


# ═══════════════════════════════════════════════════════════════
# 5. μ (D A.4)
# ═══════════════════════════════════════════════════════════════

class TestMuSelection:

    def test_picks_layer_below_base(self):
        strata = [
            {"thickness": 1.0, "mu_s": 0.20},   # arriba
            {"thickness": 5.0, "mu_s": 0.35},   # bajo la base
        ]
        r = pick_mu_under_base(strata, Df_abs=1.0)
        assert r["mu_s"] == 0.35
        assert r["source"] == "estrato_bajo_base"

    def test_default_when_missing(self):
        strata = [{"thickness": 10.0}]
        r = pick_mu_under_base(strata, Df_abs=1.0, default=0.30)
        assert r["mu_s"] == 0.30
        assert r["source"] == "default"


# ═══════════════════════════════════════════════════════════════
# 6. Cw (D A.9, D A.15)
# ═══════════════════════════════════════════════════════════════

class TestCw:

    def test_no_water_table(self):
        r = water_table_correction(Dw=0, Df=1, B=1, method="peck", has_water_table=False)
        assert r["Cw"] == 1.0

    def test_peck_below_base(self):
        """Dw=1.5, Df=1, B=1 ⇒ Cw = 1/(0.5 + 0.5·1.5/2) = 1/(0.5+0.375) = 1/0.875 ≈ 1.143."""
        r = water_table_correction(Dw=1.5, Df=1.0, B=1.0, method="peck", has_water_table=True)
        assert r["Cw"] == pytest.approx(1.0 / 0.875, abs=1e-6)

    def test_Dw_above_base_forces_Cw_2(self):
        """D A.15: Dw ≤ Df ⇒ Cw forzado a 2."""
        r = water_table_correction(Dw=0.5, Df=1.0, B=1.0, method="peck", has_water_table=True)
        assert r["Cw"] == 2.0
        assert r["forced_max"] is True

    def test_teng_clamped_to_2(self):
        """Teng ≤ 2 incluso cerca de la superficie."""
        r = water_table_correction(Dw=1.2, Df=1.0, B=1.0, method="teng", has_water_table=True)
        assert r["Cw"] <= 2.0

    def test_off_method(self):
        r = water_table_correction(Dw=1.5, Df=1.0, B=1.0, method="off", has_water_table=True)
        assert r["Cw"] == 1.0


# ═══════════════════════════════════════════════════════════════
# 7. Elastic settlement (D A.16, D A.17)
# ═══════════════════════════════════════════════════════════════

class TestElasticSettlement:

    def test_centro_flexible_uses_alpha_4(self):
        r = elastic_settlement(q0_net=100, B=2.0, L=2.0, Es=20000, mu_s=0.30,
                                H=10.0, Df=1.0, point="centro", rigid=False)
        assert r["alpha"] == 4
        assert r["B_used"] == pytest.approx(1.0, abs=1e-9)
        assert r["Se"] > 0

    def test_esquina_flexible_uses_alpha_1(self):
        r = elastic_settlement(q0_net=100, B=2.0, L=2.0, Es=20000, mu_s=0.30,
                                H=10.0, Df=1.0, point="esquina", rigid=False)
        assert r["alpha"] == 1
        assert r["B_used"] == pytest.approx(2.0, abs=1e-9)

    def test_rigid_applies_093(self):
        flex = elastic_settlement(q0_net=100, B=2.0, L=2.0, Es=20000, mu_s=0.30,
                                   H=10.0, Df=1.0, point="centro", rigid=False)
        rig = elastic_settlement(q0_net=100, B=2.0, L=2.0, Es=20000, mu_s=0.30,
                                  H=10.0, Df=1.0, point="centro", rigid=True)
        assert rig["Se"] == pytest.approx(0.93 * flex["Se"], abs=1e-9)
        assert rig["rigid_factor"] == 0.93

    def test_rigid_corner_forces_centro(self):
        """D A.17: rigid + esquina ⇒ se fuerza centro."""
        r = elastic_settlement(q0_net=100, B=2.0, L=2.0, Es=20000, mu_s=0.30,
                                H=10.0, Df=1.0, point="esquina", rigid=True)
        assert r["point"] == "centro"
        assert any("rigid" in w.lower() for w in r["warnings"])


# ═══════════════════════════════════════════════════════════════
# 8. qadm_from_settlement_limit  (q neta, D A.16)
# ═══════════════════════════════════════════════════════════════

class TestQadmSettlement:

    def test_inverse_consistency(self):
        """Se(qadm) debe igualar S_max (linealidad)."""
        params = dict(B=2.0, L=2.0, Es=20000, mu_s=0.30, H=10.0, Df=1.0)
        S_max = 0.025
        q = qadm_from_settlement_limit(Se_max=S_max, Cw=1.0, **params)
        se = elastic_settlement(q0_net=q["qadm_settlement"], **params,
                                 point="centro", rigid=False)
        assert se["Se"] == pytest.approx(S_max, abs=1e-9)

    def test_with_Cw_2_halves_qadm(self):
        params = dict(B=2.0, L=2.0, Es=20000, mu_s=0.30, H=10.0, Df=1.0,
                      point="centro", rigid=False)
        q1 = qadm_from_settlement_limit(Se_max=0.025, Cw=1.0, **params)
        q2 = qadm_from_settlement_limit(Se_max=0.025, Cw=2.0, **params)
        assert q2["qadm_settlement"] == pytest.approx(q1["qadm_settlement"] / 2.0, rel=1e-9)


# ═══════════════════════════════════════════════════════════════
# 9. Consolidation
# ═══════════════════════════════════════════════════════════════

class TestConsolidation:

    def test_NC_case(self):
        r = consolidation_settlement(Hc=2.0, e0=0.8, Cc=0.3,
                                      sigma_p0=100.0, dsigma_av=50.0)
        # Sc = 0.3·2/(1+0.8) · log10(150/100) = 0.333·0.1761 = 0.0587 m
        assert r["case"] == "NC"
        assert r["Sc"] == pytest.approx(0.0587, abs=1e-3)

    def test_OC1_case(self):
        r = consolidation_settlement(Hc=2.0, e0=0.8, Cc=0.3, Cs=0.05,
                                      sigma_p0=100.0, dsigma_av=30.0,
                                      sigma_c=200.0)
        # 100+30 = 130 < 200 ⇒ OC1
        assert r["case"] == "OC1"

    def test_OC2_case(self):
        r = consolidation_settlement(Hc=2.0, e0=0.8, Cc=0.3, Cs=0.05,
                                      sigma_p0=100.0, dsigma_av=300.0,
                                      sigma_c=150.0)
        # 100+300 = 400 > 150 ⇒ OC2
        assert r["case"] == "OC2"


# ═══════════════════════════════════════════════════════════════
# 10. Kulhawy-Mayne (D A.20)
# ═══════════════════════════════════════════════════════════════

class TestKulhawyMayne:

    def test_alpha_values(self):
        assert KM_ALPHA_TABLE["with_fines"] == 5.0
        assert KM_ALPHA_TABLE["clean_NC"] == 10.0
        assert KM_ALPHA_TABLE["clean_OC"] == 15.0

    def test_Es_calculation(self):
        # N60=20, clean NC ⇒ Es = 10·20·101.325 = 20265 kPa
        Es = Es_from_N60_kulhawy_mayne(20, "clean_NC")
        assert Es == pytest.approx(20265.0, abs=0.1)


# ═══════════════════════════════════════════════════════════════
# 11. design_qadm (D A.12)
# ═══════════════════════════════════════════════════════════════

class TestDesignQadm:

    def test_failure_governs(self):
        r = design_qadm(qadm_falla=200, qadm_settlement=300)
        assert r["criterio_gobernante"] == "falla_por_corte"
        assert r["qadm_diseno"] == 200

    def test_settlement_governs(self):
        r = design_qadm(qadm_falla=400, qadm_settlement=250)
        assert r["criterio_gobernante"] == "asentamiento"
        assert r["qadm_diseno"] == 250


# ═══════════════════════════════════════════════════════════════
# 12. Calculate total + iteración B
# ═══════════════════════════════════════════════════════════════

class TestTotalSettlement:

    def _base_strata(self):
        return [
            {"thickness": 2.0, "gamma": 18.0, "gammaSat": 20.0,
             "Es": 15000, "mu_s": 0.30},
            {"thickness": 10.0, "gamma": 18.0, "gammaSat": 20.0,
             "Es": 18000, "mu_s": 0.30},
        ]

    def test_smoke_no_consolidation(self):
        r = calculate_total_settlement(
            foundation={"B": 2.0, "L": 2.0, "Df": 1.0},
            strata=self._base_strata(),
            Df_abs=1.0,
            settlement_params={"S_max": 0.025, "point": "centro",
                               "rigid": False, "Cw_method": "peck"},
            conditions={"hasWaterTable": False, "waterTableDepth": 0.0},
            qadm_falla=None,
            q_aplicada_net=80.0,
        )
        assert r["Es_eq"] > 0
        assert r["z_bar"] == pytest.approx(min(r["H"], 5.0 * 2.0))
        assert r["Se"] is not None and r["Se"] > 0
        assert r["qadm_settlement"] > 0

    def test_design_min_with_qadm_falla(self):
        r = calculate_total_settlement(
            foundation={"B": 2.0, "L": 2.0, "Df": 1.0},
            strata=self._base_strata(),
            Df_abs=1.0,
            settlement_params={"S_max": 0.025, "point": "centro",
                               "rigid": False, "Cw_method": "off"},
            qadm_falla=150.0,
            q_aplicada_net=80.0,
        )
        assert r["design"] is not None
        assert r["design"]["criterio_gobernante"] in ("falla_por_corte", "asentamiento")
        assert r["design"]["qadm_diseno"] == min(150.0, r["qadm_settlement"])

    def test_iterate_recomputes_Es_per_B(self):
        """D A.10: cada B re-computa la zona de influencia."""
        # 3 estratos con Es muy distintos: el bulbo debe cambiar al variar B
        strata = [
            {"thickness": 2.0, "gamma": 18, "gammaSat": 20, "Es": 10000, "mu_s": 0.30},
            {"thickness": 3.0, "gamma": 18, "gammaSat": 20, "Es": 30000, "mu_s": 0.30},
            {"thickness": 20.0, "gamma": 18, "gammaSat": 20, "Es": 50000, "mu_s": 0.30},
        ]
        r = iterate_qadm_vs_B(
            B_start=0.5, B_end=2.0, B_step=0.5,
            foundation={"L": 1.0, "Df": 1.0},
            strata=strata,
            Df_abs=1.0,
            settlement_params={"S_max": 0.025, "point": "centro",
                               "rigid": False, "Cw_method": "off"},
            q_aplicada_net=80.0,
        )
        # Diferentes B ⇒ diferentes Es_eq (porque la zona [1, 1+5B] cambia)
        es_values = [row["Es_eq"] for row in r["rows"]]
        assert len(set(round(e, 1) for e in es_values)) > 1


# ═══════════════════════════════════════════════════════════════
# 13. Distorsión angular (RNE)
# ═══════════════════════════════════════════════════════════════

class TestAngularDistortion:

    def test_safe(self):
        # δ = 1 mm sobre L = 5 m ⇒ α = 1/5000 — más estricto que 1/500
        r = angular_distortion(delta_a=0.0, delta_b=0.001, L_columns=5.0)
        assert r["is_safe_no_cracks"] is True

    def test_exceeds_structural(self):
        # δ = 50 mm sobre L = 5 m ⇒ α = 1/100 > 1/150
        r = angular_distortion(delta_a=0.0, delta_b=0.050, L_columns=5.0)
        assert r["is_below_structural_damage"] is False
        assert "danio_estructural_edif_convencional" in r["limits_exceeded"]
