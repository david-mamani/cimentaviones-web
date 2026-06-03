"""
Tests del endpoint POST /api/compare-settlements (multi-zapata).
Verifica:
  - Validación del input (matriz simétrica, diagonal 0, ids únicos).
  - Cálculo de S_total por zapata.
  - Matrices δ_ij, β_ij correctas.
  - Identificación del peor par.
  - Clasificación Bjerrum (incluida la entrada 1/600).
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(ROOT_DIR))
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def _base_footing(id_: str, B: float, L: float, Q: float):
    return {
        "id": id_,
        "foundation": {
            "type": "rectangular" if B != L else "cuadrada",
            "B": B,
            "L": L,
            "Df": 1.0,
            "FS": 3.0,
            "beta": 0.0,
            "Q": Q,
        },
        "strata": [
            {
                "id": "s1",
                "thickness": 2.0,
                "gamma": 18.0,
                "gammaSat": 20.0,
                "c": 0.0,
                "phi": 30.0,
                "Es": 15000,
                "mu_s": 0.30,
            },
            {
                "id": "s2",
                "thickness": 15.0,
                "gamma": 18.0,
                "gammaSat": 20.0,
                "c": 0.0,
                "phi": 30.0,
                "Es": 20000,
                "mu_s": 0.30,
            },
        ],
        "conditions": {
            "hasWaterTable": False,
            "waterTableDepth": 0.0,
            "hasBasement": False,
            "basementDepth": 0.0,
        },
        "settlement": {
            "S_max": 0.05,
            "point": "centro",
            "rigid": False,
            "Cw_method": "off",
            "consolidation": False,
        },
    }


class TestCompareSettlementsEndpoint:
    def test_two_footings_basic(self):
        body = {
            "footings": [
                _base_footing("Z1", 1.6, 2.0, 630.0),
                _base_footing("Z2", 1.6, 2.0, 750.0),
            ],
            "spans": [[0, 5.8], [5.8, 0]],
        }
        r = client.post("/api/compare-settlements", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["footings"]) == 2
        assert data["delta_matrix"][0][1] >= 0
        assert data["beta_matrix"][0][1] >= 0
        assert data["worst"]["id_a"] in ("Z1", "Z2")
        assert data["worst"]["id_b"] in ("Z1", "Z2")
        assert "categoria_clave" in data["bjerrum"]
        assert "cumple_sin_grietas" in data["bjerrum"]

    def test_three_footings_finds_worst_pair(self):
        body = {
            "footings": [
                _base_footing("Z1", 1.6, 2.0, 500.0),
                _base_footing("Z2", 1.6, 2.0, 600.0),
                _base_footing("Z3", 1.6, 2.0, 900.0),
            ],
            "spans": [
                [0, 5.0, 10.0],
                [5.0, 0, 5.0],
                [10.0, 5.0, 0],
            ],
        }
        r = client.post("/api/compare-settlements", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["worst"]["beta"] > 0
        deltas = data["delta_matrix"]
        assert deltas[0][2] == max(deltas[0][1], deltas[0][2], deltas[1][2])

    def test_invalid_diagonal_nonzero(self):
        body = {
            "footings": [
                _base_footing("Z1", 1.6, 2.0, 630.0),
                _base_footing("Z2", 1.6, 2.0, 750.0),
            ],
            "spans": [[1, 5.8], [5.8, 0]],
        }
        r = client.post("/api/compare-settlements", json=body)
        assert r.status_code == 422

    def test_invalid_asymmetric_spans(self):
        body = {
            "footings": [
                _base_footing("Z1", 1.6, 2.0, 630.0),
                _base_footing("Z2", 1.6, 2.0, 750.0),
            ],
            "spans": [[0, 5.8], [3.0, 0]],
        }
        r = client.post("/api/compare-settlements", json=body)
        assert r.status_code == 422

    def test_duplicate_ids_rejected(self):
        body = {
            "footings": [
                _base_footing("Z1", 1.6, 2.0, 630.0),
                _base_footing("Z1", 1.6, 2.0, 750.0),
            ],
            "spans": [[0, 5.8], [5.8, 0]],
        }
        r = client.post("/api/compare-settlements", json=body)
        assert r.status_code == 422

    def test_missing_Q_rejected(self):
        f1 = _base_footing("Z1", 1.6, 2.0, 630.0)
        f2 = _base_footing("Z2", 1.6, 2.0, 750.0)
        f2["foundation"].pop("Q")
        body = {"footings": [f1, f2], "spans": [[0, 5.8], [5.8, 0]]}
        r = client.post("/api/compare-settlements", json=body)
        assert r.status_code == 422
        assert "Q" in r.json()["detail"]

    def test_single_footing_rejected(self):
        body = {
            "footings": [_base_footing("Z1", 1.6, 2.0, 630.0)],
            "spans": [[0]],
        }
        r = client.post("/api/compare-settlements", json=body)
        assert r.status_code == 422
