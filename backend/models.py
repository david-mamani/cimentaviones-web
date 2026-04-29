"""
Modelos Pydantic para validación de datos de entrada/salida.
Equivalente a types/geotechnical.ts del frontend.
"""

from pydantic import BaseModel
from typing import Literal, Optional, Any


class Stratum(BaseModel):
    """Estrato de suelo individual."""
    id: str
    thickness: float   # Espesor (m)
    gamma: float       # Peso unitario natural γ (kN/m³)
    c: float           # Cohesión c (kPa)
    phi: float         # Ángulo de fricción interna φ (°)
    gammaSat: float    # Peso unitario saturado γsat (kN/m³)


class FoundationParams(BaseModel):
    """Parámetros de cimentación."""
    type: Literal["cuadrada", "rectangular", "franja", "circular"]
    B: float           # Ancho o lado (m)
    L: float           # Longitud (m)
    Df: float          # Profundidad de desplante (m)
    FS: float          # Factor de seguridad
    beta: float        # Ángulo de inclinación de carga β (°)


class SpecialConditions(BaseModel):
    """Condiciones especiales."""
    hasWaterTable: bool
    waterTableDepth: float  # Dw (m)
    hasBasement: bool
    basementDepth: float    # Ds (m)


class CalculationInput(BaseModel):
    """Input completo para el cálculo."""
    foundation: FoundationParams
    strata: list[Stratum]
    conditions: SpecialConditions
    method: Literal["terzaghi", "general", "rne"]


class IterationConfig(BaseModel):
    """Configuración de iteraciones paramétricas."""
    varyB: bool
    bStart: float
    bEnd: float
    bStep: float
    varyDf: bool
    dfStart: float
    dfEnd: float
    dfStep: float
    lbRatio: Optional[float] = None  # L = lbRatio × B (for locked rectangular)


class IterationInput(BaseModel):
    """Input para iteraciones paramétricas."""
    base: CalculationInput
    config: IterationConfig


class IFCExportInput(BaseModel):
    """Input para exportación IFC — solo datos del modelo, sin método de cálculo."""
    foundation: FoundationParams
    strata: list[Stratum]
    conditions: SpecialConditions


class PDFExportOptions(BaseModel):
    """Opciones de contenido para el reporte PDF."""
    include_calculations: bool = True
    include_strata: bool = True
    include_iterations: bool = False
    include_charts: bool = False
    include_2d: bool = False
    include_3d: bool = False


class PDFExportInput(BaseModel):
    """Input para exportación PDF via LaTeX."""
    foundation: FoundationParams
    strata: list[Stratum]
    conditions: SpecialConditions
    method: Literal["terzaghi", "general", "rne"]
    result: dict[str, Any]
    options: PDFExportOptions = PDFExportOptions()
    images: Optional[dict[str, str]] = None  # {chart_b64, view2d_b64, view3d_b64}
