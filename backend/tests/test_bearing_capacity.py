"""
Tests unitarios para el motor de cálculos.
Casos idénticos a los del Vitest original (bearingCapacity.test.ts).
"""

import pytest
from calculos.bearing_factors import get_bearing_factors
from calculos.bearing_capacity import calculate_bearing_capacity


class TestBearingFactors:
    """Tests para la tabla de factores de Terzaghi."""

    def test_phi_0(self):
        """φ=0° → Nc=5.70, Nq=1.00, Nγ=0.00"""
        f = get_bearing_factors(0)
        assert f["Nc"] == 5.70
        assert f["Nq"] == 1.00
        assert f["Ngamma"] == 0.00

    def test_phi_30(self):
        """φ=30° → Nc=37.16, Nq=22.46, Nγ=19.13"""
        f = get_bearing_factors(30)
        assert f["Nc"] == 37.16
        assert f["Nq"] == 22.46
        assert f["Ngamma"] == 19.13

    def test_phi_50(self):
        """φ=50° → Nc=347.50, Nq=415.14, Nγ=1042.80"""
        f = get_bearing_factors(50)
        assert f["Nc"] == 347.50
        assert f["Nq"] == 415.14
        assert f["Ngamma"] == 1042.80

    def test_interpolation_phi_27_5(self):
        """φ=27.5° → Interpolación lineal entre φ=27° y φ=28°"""
        f = get_bearing_factors(27.5)
        assert f["Nc"] == pytest.approx((29.24 + 31.61) / 2, abs=0.01)
        assert f["Nq"] == pytest.approx((15.90 + 17.81) / 2, abs=0.01)
        assert f["Ngamma"] == pytest.approx((11.60 + 13.70) / 2, abs=0.01)

    def test_out_of_range(self):
        """φ fuera de [0, 50] lanza ValueError"""
        with pytest.raises(ValueError):
            get_bearing_factors(-1)
        with pytest.raises(ValueError):
            get_bearing_factors(51)


class TestBearingCapacity:
    """Tests de cálculos completos."""

    def test_clay_square(self):
        """
        Caso 1: Suelo arcilloso, cimentación cuadrada.
        φ=0°, c=50 kPa, γ=18 kN/m³, B=2.0m, Df=1.5m, FS=3, sin NF.

        q = 18·1.5 = 27 kPa
        qu = 1.3·50·5.7 + 27·1.0 + 0.4·18·2·0 = 370.5 + 27 + 0 = 397.5 kPa
        qa = 397.5 / 3 = 132.5 kPa
        """
        input_data = {
            "foundation": {
                "type": "cuadrada",
                "B": 2.0,
                "L": 2.0,
                "Df": 1.5,
                "FS": 3.0,
                "beta": 0,
            },
            "strata": [
                {
                    "id": "test-1",
                    "thickness": 3.0,
                    "gamma": 18,
                    "c": 50,
                    "phi": 0,
                    "gammaSat": 20,
                }
            ],
            "conditions": {
                "hasWaterTable": False,
                "waterTableDepth": 0,
                "hasBasement": False,
                "basementDepth": 0,
            },
            "method": "terzaghi",
        }

        result = calculate_bearing_capacity(input_data)

        assert result["q"] == pytest.approx(27, abs=0.1)
        assert result["qu"] == pytest.approx(397.5, abs=0.1)
        assert result["qa"] == pytest.approx(132.5, abs=0.1)

    def test_sand_square(self):
        """
        Caso 2: Arena limpia, cimentación cuadrada.
        φ=30°, c=0, γ=19 kN/m³, B=1.5m, Df=1.0m, FS=3, sin NF.

        q = 19·1.0 = 19 kPa
        qu = 0 + 19·22.46 + 0.4·19·1.5·19.13 = 426.74 + 218.084 = 644.824
        qa = 644.824 / 3 ≈ 214.94
        """
        input_data = {
            "foundation": {
                "type": "cuadrada",
                "B": 1.5,
                "L": 1.5,
                "Df": 1.0,
                "FS": 3.0,
                "beta": 0,
            },
            "strata": [
                {
                    "id": "test-2",
                    "thickness": 3.0,
                    "gamma": 19,
                    "c": 0,
                    "phi": 30,
                    "gammaSat": 21,
                }
            ],
            "conditions": {
                "hasWaterTable": False,
                "waterTableDepth": 0,
                "hasBasement": False,
                "basementDepth": 0,
            },
            "method": "terzaghi",
        }

        result = calculate_bearing_capacity(input_data)

        assert result["q"] == pytest.approx(19, abs=0.1)
        assert result["bearingFactors"]["Nc"] == pytest.approx(37.16, abs=0.01)
        assert result["bearingFactors"]["Nq"] == pytest.approx(22.46, abs=0.01)
        assert result["bearingFactors"]["Ngamma"] == pytest.approx(19.13, abs=0.01)
        assert result["qu"] == pytest.approx(644.824, abs=1)
        assert result["qa"] == pytest.approx(214.94, abs=1)
