"""
Tests unitarios para el motor de cálculos.
Casos idénticos a los del Vitest original (bearingCapacity.test.ts).
+ Tests de edge cases y guards defensivos.
"""

import pytest
from calculos.bearing_factors import get_bearing_factors
from calculos.bearing_capacity import calculate_bearing_capacity
from calculos.parametric_iterations import run_parametric_iterations


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

    def _make_input(self, **overrides):
        """Helper para crear input base con defaults."""
        data = {
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
        # Apply overrides
        for key, value in overrides.items():
            if key in data:
                if isinstance(value, dict):
                    data[key] = {**data[key], **value}
                else:
                    data[key] = value
            elif "." in key:
                parts = key.split(".")
                data[parts[0]][parts[1]] = value
        return data

    def test_clay_square(self):
        """
        Caso 1: Suelo arcilloso, cimentación cuadrada.
        φ=0°, c=50 kPa, γ=18 kN/m³, B=2.0m, Df=1.5m, FS=3, sin NF.

        q = 18·1.5 = 27 kPa
        qu = 1.3·50·5.7 + 27·1.0 + 0.4·18·2·0 = 370.5 + 27 + 0 = 397.5 kPa
        qa = 397.5 / 3 = 132.5 kPa
        """
        input_data = self._make_input()
        result = calculate_bearing_capacity(input_data)

        assert result["q"] == pytest.approx(27, abs=0.1)
        assert result["qu"] == pytest.approx(397.5, abs=0.1)
        assert result["qa"] == pytest.approx(132.5, abs=0.1)

    def test_sand_square(self):
        """
        Caso 2: Arena limpia, cimentación cuadrada.
        φ=30°, c=0, γ=19 kN/m³, B=1.5m, Df=1.0m, FS=3, sin NF.
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


class TestEdgeCases:
    """Tests para guards defensivos — casos borde que deben fallar controladamente."""

    def _base_input(self):
        return {
            "foundation": {
                "type": "cuadrada",
                "B": 1.0,
                "L": 1.0,
                "Df": 1.0,
                "FS": 3.0,
                "beta": 0,
            },
            "strata": [
                {
                    "id": "s1",
                    "thickness": 3.0,
                    "gamma": 18,
                    "c": 10,
                    "phi": 25,
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

    def test_B_zero_raises(self):
        """B=0 debe lanzar ValueError."""
        data = self._base_input()
        data["foundation"]["B"] = 0
        with pytest.raises(ValueError, match="ancho B"):
            calculate_bearing_capacity(data)

    def test_L_zero_raises(self):
        """L=0 debe lanzar ValueError."""
        data = self._base_input()
        data["foundation"]["L"] = 0
        with pytest.raises(ValueError, match="longitud L"):
            calculate_bearing_capacity(data)

    def test_FS_zero_raises(self):
        """FS=0 debe lanzar ValueError."""
        data = self._base_input()
        data["foundation"]["FS"] = 0
        with pytest.raises(ValueError, match="factor de seguridad"):
            calculate_bearing_capacity(data)

    def test_empty_strata_raises(self):
        """Lista vacía de estratos debe lanzar ValueError."""
        data = self._base_input()
        data["strata"] = []
        with pytest.raises(ValueError, match="estrato"):
            calculate_bearing_capacity(data)

    def test_phi_out_of_range_raises(self):
        """φ=51° debe lanzar ValueError en bearing_factors."""
        with pytest.raises(ValueError, match="rango"):
            get_bearing_factors(51)

    def test_valid_input_succeeds(self):
        """Input válido debe completar sin error."""
        data = self._base_input()
        result = calculate_bearing_capacity(data)
        assert result["qa"] > 0
        assert result["Qmax"] > 0

    def test_general_method_works(self):
        """Método general debe completar sin error."""
        data = self._base_input()
        data["method"] = "general"
        result = calculate_bearing_capacity(data)
        assert result["qa"] > 0

    def test_rne_method_works(self):
        """Método RNE debe completar sin error."""
        data = self._base_input()
        data["method"] = "rne"
        result = calculate_bearing_capacity(data)
        assert result["qa"] > 0

    def test_water_table_case1(self):
        """NF sobre cimentación (Dw < Df) debe dar caso 1."""
        data = self._base_input()
        data["conditions"]["hasWaterTable"] = True
        data["conditions"]["waterTableDepth"] = 0.5  # < Df=1.0
        result = calculate_bearing_capacity(data)
        assert result["waterTableCase"] == 1

    def test_water_table_case4(self):
        """NF muy profundo (Dw > Df+B) debe dar caso 4."""
        data = self._base_input()
        data["conditions"]["hasWaterTable"] = True
        data["conditions"]["waterTableDepth"] = 10.0  # >> Df+B
        result = calculate_bearing_capacity(data)
        assert result["waterTableCase"] == 4


class TestParametricIterations:
    """Tests para iteraciones paramétricas."""

    def _base(self):
        return {
            "foundation": {
                "type": "cuadrada",
                "B": 1.0,
                "L": 1.0,
                "Df": 1.0,
                "FS": 3.0,
                "beta": 0,
            },
            "strata": [
                {
                    "id": "s1",
                    "thickness": 5.0,
                    "gamma": 18,
                    "c": 10,
                    "phi": 25,
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

    def test_basic_iteration(self):
        """Iteración básica con variación de B."""
        config = {
            "varyB": True, "bStart": 1.0, "bEnd": 2.0, "bStep": 0.5,
            "varyDf": False, "dfStart": 1.0, "dfEnd": 1.0, "dfStep": 0.5,
        }
        result = run_parametric_iterations(self._base(), config)
        assert len(result["bValues"]) == 3  # 1.0, 1.5, 2.0
        assert len(result["matrix"]) == 1
        assert len(result["matrix"][0]) == 3

    def test_too_many_points_raises(self):
        """Demasiados puntos debe lanzar ValueError."""
        config = {
            "varyB": True, "bStart": 0.1, "bEnd": 100, "bStep": 0.01,
            "varyDf": True, "dfStart": 0.1, "dfEnd": 100, "dfStep": 0.01,
        }
        with pytest.raises(ValueError, match="máximo"):
            run_parametric_iterations(self._base(), config)
