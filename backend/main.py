"""
CimentAviones Backend — Servidor FastAPI.

Endpoints:
  POST /api/calculate  → Cálculo individual de capacidad portante
  POST /api/iterate    → Iteraciones paramétricas (variar B y/o Df)
  POST /api/export-ifc → Generar archivo IFC del modelo
"""

import sys
from pathlib import Path

# Agregar directorio raíz al path para importar calculos/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from models import CalculationInput, IterationInput, IFCExportInput
from calculos.bearing_capacity import calculate_bearing_capacity
from calculos.parametric_iterations import run_parametric_iterations
from calculos.ifc_generator import generate_ifc

app = FastAPI(
    title="CimentAviones API",
    description="Motor de cálculos geotécnicos — Capacidad portante",
    version="1.0.0",
)

# CORS para desarrollo local (frontend en otro puerto)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/calculate")
def calculate(input_data: CalculationInput):
    """
    Ejecuta el cálculo de capacidad portante.

    Recibe los parámetros de cimentación, estratos, condiciones
    especiales y método de cálculo. Retorna todos los resultados.
    """
    raw = input_data.model_dump()
    result = calculate_bearing_capacity(raw)
    return result


@app.post("/api/iterate")
def iterate(input_data: IterationInput):
    """
    Ejecuta iteraciones paramétricas.

    Varía B y/o Df en un rango y retorna una matriz de resultados.
    """
    base = input_data.base.model_dump()
    config = input_data.config.model_dump()

    result = run_parametric_iterations(base, config)
    return result


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
    )
    return Response(
        content=ifc_bytes,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": "attachment; filename=cimentaviones_model.ifc",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@app.get("/api/health")
def health():
    """Health check."""
    return {"status": "ok", "engine": "CimentAviones v1.0"}
