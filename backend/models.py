"""
Modelos Pydantic para validación de datos de entrada/salida.
Equivalente a types/geotechnical.ts del frontend.

Todas las restricciones de rango se aplican aquí para rechazar
datos inválidos ANTES de que lleguen al motor de cálculos.
"""

from pydantic import BaseModel, Field, model_validator
from typing import Literal, Optional, Any


class Stratum(BaseModel):
    """Estrato de suelo individual."""
    id: str
    thickness: float = Field(gt=0, description="Espesor (m)")
    gamma: float = Field(gt=0, description="Peso unitario natural γ (kN/m³)")
    c: float = Field(ge=0, description="Cohesión c (kPa)")
    phi: float = Field(ge=0, le=50, description="Ángulo de fricción interna φ (°)")
    gammaSat: float = Field(gt=0, description="Peso unitario saturado γsat (kN/m³)")

    @model_validator(mode="after")
    def validate_gammaSat_gte_gamma(self):
        if self.gammaSat < self.gamma:
            raise ValueError(
                f"γsat ({self.gammaSat}) debe ser ≥ γ ({self.gamma})"
            )
        return self


class FoundationParams(BaseModel):
    """Parámetros de cimentación."""
    type: Literal["cuadrada", "rectangular", "franja", "circular"]
    B: float = Field(gt=0, description="Ancho o lado (m)")
    L: float = Field(gt=0, description="Longitud (m)")
    Df: float = Field(ge=0, description="Profundidad de desplante (m)")
    FS: float = Field(ge=1.0, le=10.0, description="Factor de seguridad")
    beta: float = Field(ge=0, le=45, description="Ángulo de inclinación de carga β (°)")

    @model_validator(mode="after")
    def validate_rectangular_L_gte_B(self):
        if self.type == "rectangular" and self.L < self.B:
            raise ValueError(
                f"Para cimentación rectangular, L ({self.L}) debe ser ≥ B ({self.B})"
            )
        return self


class SpecialConditions(BaseModel):
    """Condiciones especiales."""
    hasWaterTable: bool
    waterTableDepth: float = Field(ge=0, description="Dw (m)")
    hasBasement: bool
    basementDepth: float = Field(ge=0, description="Ds (m)")


class CalculationInput(BaseModel):
    """Input completo para el cálculo."""
    foundation: FoundationParams
    strata: list[Stratum] = Field(min_length=1, description="Al menos 1 estrato")
    conditions: SpecialConditions
    method: Literal["terzaghi", "general", "rne"]

    @model_validator(mode="after")
    def validate_cross_field(self):
        # Validar que la suma de espesores cubra Df
        total_thickness = sum(s.thickness for s in self.strata)
        if total_thickness < self.foundation.Df - 0.001:
            raise ValueError(
                f"La suma de espesores ({total_thickness:.2f} m) debe ser ≥ "
                f"Df ({self.foundation.Df:.2f} m)"
            )
        # Validar β < φ del estrato de diseño
        if self.foundation.beta > 0:
            depth = 0.0
            design_phi = self.strata[-1].phi
            for stratum in self.strata:
                depth += stratum.thickness
                if depth >= self.foundation.Df - 0.001:
                    design_phi = stratum.phi
                    break
            if design_phi > 0 and self.foundation.beta >= design_phi:
                raise ValueError(
                    f"β ({self.foundation.beta}°) debe ser < φ ({design_phi}°) "
                    f"del estrato de diseño"
                )
        return self


class IterationConfig(BaseModel):
    """Configuración de iteraciones paramétricas."""
    varyB: bool
    bStart: float = Field(gt=0, description="B inicio (m)")
    bEnd: float = Field(gt=0, description="B final (m)")
    bStep: float = Field(gt=0, description="Paso de B (m)")
    varyDf: bool
    dfStart: float = Field(ge=0, description="Df inicio (m)")
    dfEnd: float = Field(ge=0, description="Df final (m)")
    dfStep: float = Field(gt=0, description="Paso de Df (m)")
    lbRatio: Optional[float] = Field(
        default=None, gt=0,
        description="L = lbRatio × B (for locked rectangular)"
    )

    @model_validator(mode="after")
    def validate_ranges(self):
        if self.varyB and self.bEnd < self.bStart:
            raise ValueError(
                f"bEnd ({self.bEnd}) debe ser ≥ bStart ({self.bStart})"
            )
        if self.varyDf and self.dfEnd < self.dfStart:
            raise ValueError(
                f"dfEnd ({self.dfEnd}) debe ser ≥ dfStart ({self.dfStart})"
            )
        return self


class IterationInput(BaseModel):
    """Input para iteraciones paramétricas."""
    base: CalculationInput
    config: IterationConfig


class IFCExportInput(BaseModel):
    """Input para exportación IFC — solo datos del modelo, sin método de cálculo."""
    foundation: FoundationParams
    strata: list[Stratum] = Field(min_length=1)
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
    strata: list[Stratum] = Field(min_length=1)
    conditions: SpecialConditions
    method: Literal["terzaghi", "general", "rne"]
    result: dict[str, Any]
    options: PDFExportOptions = PDFExportOptions()
    images: Optional[dict[str, str]] = None  # {chart_b64, view2d_b64, view3d_b64}
    iteration_results: Optional[dict[str, Any]] = None  # iteration matrix data
