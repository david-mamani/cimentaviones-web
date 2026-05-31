"""
Modelos Pydantic para validación de datos de entrada/salida.
Equivalente a types/geotechnical.ts del frontend.

Todas las restricciones de rango se aplican aquí para rechazar
datos inválidos ANTES de que lleguen al motor de cálculos.
"""

from pydantic import BaseModel, Field, model_validator
from typing import Literal, Optional, Any


class Stratum(BaseModel):
    """Estrato de suelo individual. Valores recibidos en SI."""
    id: str
    thickness: float = Field(gt=0, description="Espesor (m)")
    gamma: float = Field(gt=0, description="Peso unitario natural γ (SI)")
    c: float = Field(ge=0, description="Cohesión c (SI)")
    phi: float = Field(ge=0, le=50, description="Ángulo de fricción interna φ (°)")
    gammaSat: float = Field(gt=0, description="Peso unitario saturado γsat (SI)")

    # Campos opcionales para asentamiento (Das §9)
    Es: Optional[float] = Field(default=None, gt=0, description="Módulo de elasticidad (kPa)")
    mu_s: Optional[float] = Field(default=None, ge=0.0, le=0.5, description="Poisson")
    is_clay: bool = Field(default=False, description="Marca estrato como arcilla (activa Sc)")
    Cc: Optional[float] = Field(default=None, gt=0, description="Índice de compresión")
    Cs: Optional[float] = Field(default=None, gt=0, description="Índice de recompresión")
    e0: Optional[float] = Field(default=None, gt=0, description="Relación de vacíos inicial")
    sigma_c: Optional[float] = Field(default=None, gt=0, description="σ'c preconsolidación (kPa)")
    # Consolidación secundaria (Das Ecs. 9.91–9.92):
    #   Sc_s = Cα/(1+e_p) · Hc · log10(t2/t1)
    # Cα y e_p son propiedades del estrato; t1/t2 son globales (SettlementParams).
    Calpha: Optional[float] = Field(
        default=None, gt=0,
        description="Índice de compresión secundaria Cα (-) — activa Sc_s si t1/t2 globales también",
    )
    ep: Optional[float] = Field(
        default=None, gt=0,
        description="Relación de vacíos al fin de la consolidación primaria e_p (-)",
    )

    @model_validator(mode="after")
    def validate_gammaSat_gte_gamma(self):
        if self.gammaSat < self.gamma:
            raise ValueError(
                f"γsat ({self.gammaSat}) debe ser ≥ γ ({self.gamma})"
            )
        return self


class FoundationParams(BaseModel):
    """Parámetros de cimentación."""
    type: Literal["cuadrada", "rectangular"]
    B: float = Field(gt=0, description="Ancho o lado (m)")
    L: float = Field(gt=0, description="Longitud (m)")
    Df: float = Field(ge=0, description="Profundidad de desplante (m)")
    FS: float = Field(ge=1.0, le=10.0, description="Factor de seguridad")
    beta: float = Field(ge=0, le=45, description="Ángulo de inclinación de carga β (°)")
    # Convención del curso (profesor / RNE):
    #   e1 = M1/Q (M1 = M_x, momento sobre eje 1 horizontal) → reduce L
    #   e2 = M2/Q (M2 = M_y, momento sobre eje 2 vertical)   → reduce B
    e1: float = Field(default=0.0, ge=0, description="Excentricidad por M1/Q — reduce L (m)")
    e2: float = Field(default=0.0, ge=0, description="Excentricidad por M2/Q — reduce B (m)")
    M1: Optional[float] = Field(
        default=None, ge=0,
        description="Momento M1 = M_x sobre eje 1 horizontal (kN·m). Si se provee con Q, deriva e1 = M1/Q.",
    )
    M2: Optional[float] = Field(
        default=None, ge=0,
        description="Momento M2 = M_y sobre eje 2 vertical (kN·m). Si se provee con Q, deriva e2 = M2/Q.",
    )
    Q: Optional[float] = Field(
        default=None, gt=0,
        description="Carga vertical total aplicada (kN). Requerida para qmax/qmin, FS_real y M→e.",
    )
    # Método de cálculo del área efectiva ante excentricidad.
    #   "rne"            : RNE/Meyerhof B'=B-2e2, L'=L-2e1 (default).
    #   "highter_anders" : H&A 1985 con 4 casos. Hoy solo Caso I cerrado;
    #                      II/III/IV requieren digitalización de ábacos.
    metodo_area: Literal["rne", "highter_anders"] = Field(
        default="rne",
        description="Método para área efectiva con excentricidad biaxial.",
    )

    @model_validator(mode="after")
    def validate_rectangular_L_gte_B(self):
        if self.type == "rectangular" and self.L < self.B:
            raise ValueError(
                f"Para cimentación rectangular, L ({self.L}) debe ser ≥ B ({self.B})"
            )
        return self

    @model_validator(mode="after")
    def validate_eccentricity_in_dimensions(self):
        # Convención: e1 reduce L, e2 reduce B (profesor / RNE).
        # Si el usuario envió M1/M2 con Q, derivamos e1 = M1/Q, e2 = M2/Q
        # ANTES de validar (a menos que e1/e2 ya hayan sido provistas).
        if self.Q and self.Q > 0:
            if self.M1 is not None and self.e1 == 0.0:
                self.e1 = self.M1 / self.Q
            if self.M2 is not None and self.e2 == 0.0:
                self.e2 = self.M2 / self.Q
        if 2.0 * self.e1 >= self.L:
            raise ValueError(
                f"Excentricidad e1 ({self.e1} m) demasiado grande: 2·e1 debe ser < L ({self.L} m)."
            )
        if 2.0 * self.e2 >= self.B:
            raise ValueError(
                f"Excentricidad e2 ({self.e2} m) demasiado grande: 2·e2 debe ser < B ({self.B} m)."
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
    criterion: Literal["general", "rne", "rne_corrected"] = "general"
    unit_config: Optional[dict] = None

    @model_validator(mode="after")
    def validate_cross_field(self):
        # Df absoluto desde la superficie (incluye sótano si está activo)
        Ds = self.conditions.basementDepth if self.conditions.hasBasement else 0.0
        Df_abs = self.foundation.Df + Ds

        # Validar que la suma de espesores cubra Df_abs
        total_thickness = sum(s.thickness for s in self.strata)
        if total_thickness < Df_abs - 0.001:
            raise ValueError(
                f"La suma de espesores ({total_thickness:.2f} m) debe ser ≥ "
                f"Df_abs = Ds + Df ({Df_abs:.2f} m)"
            )
        # Validar β < φ del estrato de diseño (al nivel Df_abs)
        # Criterio: el estrato de diseño es el primero cuya profundidad
        # acumulada EXCEDE estrictamente Df_abs (= estrato debajo de la base).
        # Debe coincidir con find_design_stratum() en calculos/bearing_capacity.py.
        if self.foundation.beta > 0:
            depth = 0.0
            design_phi = self.strata[-1].phi
            for stratum in self.strata:
                depth += stratum.thickness
                if depth > Df_abs + 1e-6:
                    design_phi = stratum.phi
                    break
            if design_phi > 0 and self.foundation.beta >= design_phi:
                raise ValueError(
                    f"β ({self.foundation.beta}°) debe ser < φ ({design_phi}°) "
                    f"del estrato de diseño"
                )
                
        # Validar Terzaghi + Rectangular
        if self.method == "terzaghi" and self.foundation.type == "rectangular":
            raise ValueError(
                "El método de Terzaghi no soporta cimentaciones rectangulares en su formulación clásica. "
                "Use cimentación Cuadrada, o cambie al Método General."
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


# ──────────────────────────────────────────────────────────────────
# Asentamientos
# ──────────────────────────────────────────────────────────────────

class SettlementParams(BaseModel):
    """Parámetros del bloque de asentamientos (ver MOTOR_ASENTAMIENTOS.md §1.2)."""
    S_max: float = Field(default=0.025, gt=0, description="Asentamiento admisible (m)")
    point: Literal["centro", "esquina"] = "centro"
    rigid: bool = False
    H_rigid: Optional[float] = Field(default=None, gt=0, description="H manual (m)")
    Cw_method: Literal["peck", "teng", "bowles", "off"] = "peck"
    consolidation: bool = False
    mu_s_override: Optional[float] = Field(default=None, ge=0.0, le=0.5)
    # Consolidación secundaria — tiempos globales en AÑOS.
    # Se activa si AMBOS t1 y t2 se proveen (con t2 > t1) Y al menos un estrato
    # arcilloso tiene Cα y e_p.
    t1: Optional[float] = Field(
        default=None, gt=0,
        description="Tiempo al fin de consolidación primaria (años) — activa Sc_s",
    )
    t2: Optional[float] = Field(
        default=None, gt=0,
        description="Tiempo de evaluación / vida útil (años) — activa Sc_s; debe ser > t1",
    )
    # Factor de corrección 3D Skempton–Bjerrum para consolidación primaria.
    # Default 1.0 (override manual). TODO: digitalización del ábaco pendiente.
    Kcr: float = Field(
        default=1.0, gt=0,
        description="Factor 3D Skempton–Bjerrum para Sc_p (default 1.0)",
    )

    @model_validator(mode="after")
    def validate_t1_t2(self):
        if self.t1 is not None and self.t2 is not None and self.t2 <= self.t1:
            raise ValueError(
                f"t2 ({self.t2}) debe ser > t1 ({self.t1}) para Sc_s."
            )
        return self


class SettlementInput(BaseModel):
    """
    Input del endpoint /api/calculate-settlement.

    Combina los datos generales (estratos, condiciones, geometría) con
    los parámetros propios del bloque de asentamientos.
    """
    foundation: FoundationParams
    strata: list[Stratum] = Field(min_length=1)
    conditions: SpecialConditions
    settlement: SettlementParams = SettlementParams()
    qadm_falla: Optional[float] = Field(
        default=None, gt=0,
        description="qadm por falla por corte (kPa NETA) — opcional, para min(falla, asent)",
    )

    @model_validator(mode="after")
    def validate_strata_have_Es_for_settlement(self):
        # Validación liviana: al menos los estratos dentro de Df_abs + 5B
        # deberán tener Es. La validación dura se hace en el motor.
        return self


class SettlementIterationInput(BaseModel):
    """Input para iteración paramétrica de qadm(B) en el bloque de asentamientos."""
    foundation: FoundationParams
    strata: list[Stratum] = Field(min_length=1)
    conditions: SpecialConditions
    settlement: SettlementParams = SettlementParams()
    B_start: float = Field(gt=0)
    B_end: float = Field(gt=0)
    B_step: float = Field(gt=0)
    qadm_falla: Optional[float] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_range(self):
        if self.B_end < self.B_start:
            raise ValueError(f"B_end ({self.B_end}) debe ser ≥ B_start ({self.B_start})")
        return self


class NamedSettlementInput(SettlementInput):
    """Input de asentamiento con identificador de zapata (multi-zapata)."""
    id: str = Field(min_length=1, description="Identificador único de la zapata (ej. 'Z1')")


class CompareSettlementsInput(BaseModel):
    """
    Input del endpoint /api/compare-settlements.

    `footings`: lista de N inputs de asentamiento con identificador único.
    `spans`: matriz NxN (lista de listas) con las luces L_ij en metros
             entre los pares de zapatas. Diagonal = 0; simétrica.
             La unidad es metros.
    """
    footings: list[NamedSettlementInput] = Field(min_length=2)
    spans: list[list[float]] = Field(
        description="Matriz NxN de luces entre pares (m). Diagonal = 0; simétrica.",
    )

    @model_validator(mode="after")
    def validate_spans_matrix(self):
        n = len(self.footings)
        if len(self.spans) != n:
            raise ValueError(
                f"`spans` debe tener {n} filas (igual a #footings), tiene {len(self.spans)}."
            )
        ids_seen: set[str] = set()
        for f in self.footings:
            if f.id in ids_seen:
                raise ValueError(f"id duplicado en footings: {f.id!r}.")
            ids_seen.add(f.id)
        for i, row in enumerate(self.spans):
            if len(row) != n:
                raise ValueError(
                    f"spans[{i}] debe tener {n} columnas, tiene {len(row)}."
                )
            for j, val in enumerate(row):
                if i == j:
                    if val != 0:
                        raise ValueError(
                            f"spans[{i}][{i}] debe ser 0 (diagonal), es {val}."
                        )
                else:
                    if val <= 0:
                        raise ValueError(
                            f"spans[{i}][{j}] debe ser > 0 (luz entre zapatas), es {val}."
                        )
                    # Simetría (tolerancia 1e-6)
                    if abs(self.spans[j][i] - val) > 1e-6:
                        raise ValueError(
                            f"`spans` debe ser simétrica: spans[{i}][{j}]={val} "
                            f"≠ spans[{j}][{i}]={self.spans[j][i]}."
                        )
        return self


class UnitConfigEntry(BaseModel):
    """Configuración de una unidad individual."""
    length: str = "m"
    angle: str = "°"
    force: str = "kN"
    pressure: str = "kPa"
    unitWeight: str = "kN/m³"


class PDFUnitConfig(BaseModel):
    """Configuración de unidades para el PDF (input/output)."""
    input: UnitConfigEntry = UnitConfigEntry()
    output: UnitConfigEntry = UnitConfigEntry()


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
    unit_config: Optional[PDFUnitConfig] = None  # unit system configuration


class IFCExportInput(BaseModel):
    """Input para exportación IFC — solo datos del modelo, sin método de cálculo."""
    foundation: FoundationParams
    strata: list[Stratum] = Field(min_length=1)
    conditions: SpecialConditions
    unit_config: Optional[PDFUnitConfig] = None  # reuse same config type
