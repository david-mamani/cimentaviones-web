"""
Cimentaciones Backend — Servidor FastAPI.

Endpoints:
  POST /api/calculate  → Cálculo individual de capacidad portante
  POST /api/iterate    → Iteraciones paramétricas (variar B y/o Df)
  POST /api/export-ifc → Generar archivo IFC del modelo
  POST /api/export-pdf → Generar reporte PDF via LaTeX
"""

import os
import sys
import math
from pathlib import Path

# Agregar directorio raíz al path para importar calculos/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from models import (
    CalculationInput, IterationInput, IFCExportInput, PDFExportInput,
    SettlementInput, SettlementIterationInput, CompareSettlementsInput,
)
from calculos.bearing_capacity import calculate_bearing_capacity
from calculos.parametric_iterations import run_parametric_iterations
from calculos.settlement import (
    calculate_total_settlement, iterate_qadm_vs_B,
    clasificar_bjerrum, cumple_sin_grietas,
)
from services.ifc_generator import generate_ifc
from services.latex_generator import generate_latex, compile_latex_to_pdf

app = FastAPI(
    title="Cimentaciones API",
    description="Motor de cálculos geotécnicos — Capacidad portante",
    version="1.1.0",
)

# CORS: en producción, definir ALLOWED_ORIGINS como lista separada por comas
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
_allowed_origins: list[str] = (
    ["*"] if _raw_origins == "*" else [o.strip() for o in _raw_origins.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


@app.post("/api/calculate")
def calculate(input_data: CalculationInput):
    """
    Ejecuta el cálculo de capacidad portante.

    Recibe los parámetros de cimentación, estratos, condiciones
    especiales y método de cálculo. Retorna todos los resultados.
    """
    try:
        raw = input_data.model_dump()
        result = calculate_bearing_capacity(raw)

        # Guard: valores numéricos críticos no deben ser NaN ni Infinity
        for key in ("qu", "qa", "qnet", "qaNet"):
            val = result.get(key)
            if val is not None and (math.isnan(val) or math.isinf(val)):
                raise ValueError(f"El resultado '{key}' es inválido ({val}). Revise los parámetros de entrada.")

        from services.markdown_generator import generate_resolution_md
        result["resolution_md"] = generate_resolution_md(raw, result, raw.get("unit_config"))

        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el cálculo: {str(e)}")


@app.post("/api/iterate")
def iterate(input_data: IterationInput):
    """
    Ejecuta iteraciones paramétricas.

    Varía B y/o Df en un rango y retorna una matriz de resultados.
    """
    try:
        base = input_data.base.model_dump()
        config = input_data.config.model_dump()
        result = run_parametric_iterations(base, config)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en iteraciones: {str(e)}")


@app.post("/api/export-ifc")
def generate_ifc_endpoint(input_data: IFCExportInput):
    """
    Genera un archivo IFC del modelo geotécnico.

    Recibe los datos del modelo (estratos, cimentación, condiciones)
    y retorna un archivo .ifc binario para descarga o visualización.
    """
    raw = input_data.model_dump()
    ifc_bytes = generate_ifc(
        strata=raw["strata"],
        foundation=raw["foundation"],
        conditions=raw["conditions"],
        unit_config=raw.get("unit_config"),
    )
    return Response(
        content=ifc_bytes,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": "attachment; filename=Cimentaciones_model.ifc",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@app.post("/api/export-pdf")
def export_pdf(input_data: PDFExportInput):
    """
    Genera un reporte PDF profesional via LaTeX.

    1. Genera el contenido .tex con ecuaciones, tablas e imágenes
    2. Compila con pdflatex
    3. Retorna el PDF compilado
    """
    try:
        raw = input_data.model_dump()
        options = raw.get("options", {})
        images = raw.get("images") or {}

        tex_content = generate_latex(
            foundation=raw["foundation"],
            strata=raw["strata"],
            conditions=raw["conditions"],
            method=raw["method"],
            result=raw["result"],
            options=options,
            images=images,
            iteration_results=raw.get("iteration_results"),
            unit_config=raw.get("unit_config"),
        )

        pdf_bytes = compile_latex_to_pdf(
            tex_content,
            images,
            iteration_results=raw.get("iteration_results"),
            options=options,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=reporte-cimentaciones.pdf",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")


def _run_settlement_from_raw(raw: dict) -> dict:
    """
    Ejecuta `calculate_total_settlement` a partir de un dict (model_dump de
    SettlementInput o NamedSettlementInput). Devuelve el resultado con
    `q_aplicada_net` adjunto. Helper compartido por los endpoints individual
    y de comparación multi-zapata.
    """
    f = raw["foundation"]
    Ds = raw["conditions"]["basementDepth"] if raw["conditions"]["hasBasement"] else 0.0
    Df_abs = f["Df"] + Ds

    # q aplicada NETA: q_total − γ·Df. Si Q no se provee, se omite S_total.
    q_net = None
    if isinstance(f.get("Q"), (int, float)) and f["Q"] > 0:
        # área = B·L (Meyerhof B' NO acopla con asentamiento, D A.13)
        area = f["B"] * f["L"]
        q_total = f["Q"] / area
        depth = 0.0
        gamma_sum = 0.0
        depth_sum = 0.0
        for s in raw["strata"]:
            top = depth
            bot = depth + s["thickness"]
            depth = bot
            if top >= Df_abs:
                break
            h = min(bot, Df_abs) - top
            if h > 0:
                gamma_sum += s["gamma"] * h
                depth_sum += h
        gamma_avg = (gamma_sum / depth_sum) if depth_sum > 0 else 18.0
        q_net = q_total - gamma_avg * Df_abs
        if q_net < 0:
            q_net = 0.0

    result = calculate_total_settlement(
        foundation=f,
        strata=raw["strata"],
        Df_abs=Df_abs,
        settlement_params=raw["settlement"],
        conditions=raw["conditions"],
        qadm_falla=raw.get("qadm_falla"),
        q_aplicada_net=q_net,
    )
    result["q_aplicada_net"] = q_net
    return result


@app.post("/api/calculate-settlement")
def calculate_settlement_endpoint(input_data: SettlementInput):
    """
    Cálculo del bloque de asentamientos (Steinbrenner + Fox + Cw + Sc).

    Ver `MOTOR_ASENTAMIENTOS.md` para el contrato detallado.
    """
    try:
        return _run_settlement_from_raw(input_data.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en asentamiento: {str(e)}")


@app.post("/api/compare-settlements")
def compare_settlements_endpoint(input_data: CompareSettlementsInput):
    """
    Compara N zapatas: calcula S_total para cada una y devuelve la matriz
    de asentamientos diferenciales (δ_ij), distorsiones angulares (β_ij),
    el peor par y la clasificación Bjerrum.

    Convención de unidades:
      - δ_ij en metros (igual que S_total).
      - β_ij = δ_ij / spans_ij  (adimensional).
      - spans en metros (input).
    """
    try:
        raw = input_data.model_dump()
        footings_raw = raw["footings"]
        spans = raw["spans"]
        n = len(footings_raw)

        # 1. Calcular cada zapata.
        per_footing = []
        for f_raw in footings_raw:
            res = _run_settlement_from_raw(f_raw)
            S_total = res.get("S_total")
            if S_total is None:
                # Si no hay Q, no podemos comparar asentamientos. Forzar Q.
                raise ValueError(
                    f"Zapata {f_raw['id']!r}: falta `Q` en foundation "
                    f"(necesario para calcular S_total)."
                )
            per_footing.append({
                "id": f_raw["id"],
                "S_total": S_total,
                "S_total_mm": S_total * 1000.0,
                "Se": res.get("Se_corr"),
                "Sc_p": res.get("Sc"),
                "Sc_s": res.get("Sc_s"),
                "warnings": res.get("warnings", []),
            })

        # 2. Matrices δ_ij y β_ij.
        delta_matrix: list[list[float]] = [[0.0] * n for _ in range(n)]
        beta_matrix: list[list[float]] = [[0.0] * n for _ in range(n)]
        worst = {"i": 0, "j": 0, "beta": 0.0, "delta": 0.0,
                 "id_a": None, "id_b": None, "span": 0.0}
        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                d = abs(per_footing[i]["S_total"] - per_footing[j]["S_total"])
                L_span = spans[i][j]
                b = d / L_span if L_span > 0 else 0.0
                delta_matrix[i][j] = d
                beta_matrix[i][j] = b
                if b > worst["beta"]:
                    worst = {
                        "i": i, "j": j, "beta": b, "delta": d,
                        "id_a": per_footing[i]["id"],
                        "id_b": per_footing[j]["id"],
                        "span": L_span,
                    }

        # 3. Clasificación Bjerrum del peor par.
        bjerrum = clasificar_bjerrum(worst["beta"])
        bjerrum["cumple_sin_grietas"] = cumple_sin_grietas(worst["beta"])
        bjerrum["beta"] = worst["beta"]
        bjerrum["beta_1_over_N"] = (1.0 / worst["beta"]) if worst["beta"] > 0 else float("inf")

        return {
            "footings": per_footing,
            "spans": spans,
            "delta_matrix": delta_matrix,
            "delta_matrix_mm": [[v * 1000.0 for v in row] for row in delta_matrix],
            "beta_matrix": beta_matrix,
            "worst": worst,
            "bjerrum": bjerrum,
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en comparación: {str(e)}")


@app.post("/api/iterate-settlement")
def iterate_settlement_endpoint(input_data: SettlementIterationInput):
    """
    Iteración paramétrica qadm(B) del bloque de asentamientos.

    Re-computa z̄ y Es_eq para cada B (D A.10).
    """
    try:
        raw = input_data.model_dump()
        f = raw["foundation"]
        Ds = raw["conditions"]["basementDepth"] if raw["conditions"]["hasBasement"] else 0.0
        Df_abs = f["Df"] + Ds

        q_net = None
        if isinstance(f.get("Q"), (int, float)) and f["Q"] > 0:
            # q_aplicada varía con B (Q/(B·L)); para iteración mantenemos Q
            # constante y dejamos que el motor recalcule el área por B.
            # Aquí pasamos q_net = None para que iter no chequee S_total
            # (la iteración se usa para qadm, no para S_total).
            q_net = None

        foundation_for_iter = {"L": f["L"], "Df": f["Df"]}

        result = iterate_qadm_vs_B(
            B_start=raw["B_start"],
            B_end=raw["B_end"],
            B_step=raw["B_step"],
            foundation=foundation_for_iter,
            strata=raw["strata"],
            Df_abs=Df_abs,
            settlement_params=raw["settlement"],
            conditions=raw["conditions"],
            qadm_falla_fn=(lambda B: raw["qadm_falla"]) if raw.get("qadm_falla") else None,
            q_aplicada_net=q_net,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en iteración asentamiento: {str(e)}")


@app.get("/api/health")
def health():
    """Health check."""
    return {
        "status": "ok",
        "engine": "Cimentaciones v1.1",
        "methods": ["terzaghi", "general", "rne"],
        "limits": {"max_iteration_points": 500, "phi_range": [0, 50]},
    }

