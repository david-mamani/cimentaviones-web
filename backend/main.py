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
    SettlementInput, SettlementIterationInput,
)
from calculos.bearing_capacity import calculate_bearing_capacity
from calculos.parametric_iterations import run_parametric_iterations
from calculos.settlement import calculate_total_settlement, iterate_qadm_vs_B
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


@app.post("/api/calculate-settlement")
def calculate_settlement_endpoint(input_data: SettlementInput):
    """
    Cálculo del bloque de asentamientos (Steinbrenner + Fox + Cw + Sc).

    Ver `MOTOR_ASENTAMIENTOS.md` para el contrato detallado.
    """
    try:
        raw = input_data.model_dump()
        f = raw["foundation"]
        Ds = raw["conditions"]["basementDepth"] if raw["conditions"]["hasBasement"] else 0.0
        Df_abs = f["Df"] + Ds

        # q aplicada NETA: q_total − γ·Df. Usamos γ del estrato bajo la base
        # como aproximación. Si Q no se provee, se omite el cálculo de S_total.
        q_net = None
        if isinstance(f.get("Q"), (int, float)) and f["Q"] > 0:
            # área = B·L (Meyerhof B' NO acopla con asentamiento, D A.13)
            area = f["B"] * f["L"]
            q_total = f["Q"] / area
            # γ promedio en [0, Df_abs] (aproximación)
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
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en asentamiento: {str(e)}")


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

