"""
Correcciones por nivel freático.
Se distinguen 5 casos según la posición del nivel freático (Dw)
respecto a la profundidad efectiva de la cimentación (Df_abs) y el ancho B:
  Caso 0: sin NF (hasWaterTable = False)
  Caso 1: Dw < Df_abs                          (NF arriba o sumergida)
  Caso 2: |Dw - Df_abs| < 0.001                (NF al ras de la base)
  Caso 3: Df_abs < Dw < Df_abs + B             (NF parcialmente bajo la base)
  Caso 4: Dw >= Df_abs + B                     (NF profundo, sin efecto)
γw = 9.81 kN/m³ (peso unitario del agua)
γ' = γsat - γw  (peso unitario sumergido o efectivo)
NOTA — Sobrecarga q en Caso 1:
  Cuando el NF está sobre la base, q es presión EFECTIVA (Das Ec. 6.25):
  γ_natural arriba del NF + γ' bajo el NF. La subpresión de poros no
  contribuye a la resistencia friccional (Nq), por eso se descuenta.
NOTA — Sótano con NF arriba del sótano (Dw < Ds):
  Por convención del curso, el sótano se asume drenado/utilizable.
  No se suma una columna de agua libre γw·(Ds - Dw) a q. Si el problema
  requiere modelar la columna de agua, debe agregarse fuera de este módulo.
"""
GAMMA_W = 9.81


def apply_water_table_correction(
    strata: list,
    Df: float,
    B: float,
    has_water_table: bool,
    Dw: float,
    design_stratum: dict,
    Ds: float = 0.0,
) -> dict:
    """
    Calcula la sobrecarga efectiva q y el γ efectivo considerando el NF.
    La sobrecarga q es la presión TOTAL al nivel de la zapata.
    Se calcula desde el nivel del sótano (Ds) hasta la profundidad
    efectiva de la cimentación (Ds + Df).
    Args:
        strata: Lista de estratos [{thickness, gamma, gammaSat, ...}]
        Df: Profundidad de desplante desde el sótano (m)
        B: Ancho de la cimentación (m)
        has_water_table: Si existe nivel freático
        Dw: Profundidad del nivel freático desde la superficie (m)
        design_stratum: Estrato de diseño (al nivel de la cimentación)
        Ds: Profundidad del sótano desde la superficie (m), default 0
    Returns:
        dict con claves: case, q, gammaEffective, warnings
    """
    effective_depth = Ds + Df
    warnings = []
    if has_water_table and Dw < 0:
        Dw = 0.0
        warnings.append(
            "El nivel freático (Dw) era negativo; se ajustó a 0.0 (superficie)."
        )
    if not has_water_table:
        q = _calculate_overburden(strata, start_depth=Ds, end_depth=effective_depth)
        return {
            "case": 0,
            "q": q,
            "gammaEffective": design_stratum["gamma"],
            "warnings": warnings,
        }
    raw_gamma_prime = design_stratum["gammaSat"] - GAMMA_W
    if raw_gamma_prime < 0:
        warnings.append(
            f"γsat ({design_stratum['gammaSat']:.2f}) < γw ({GAMMA_W}). "
            f"Dato inválido: γsat debe ser mayor que γw. "
            f"Se usó γ' = 0 como protección."
        )
    gamma_prime = max(0.0, raw_gamma_prime)
    if Dw < effective_depth:
        q = _calculate_overburden_effective(
            strata, start_depth=Ds, end_depth=effective_depth, Dw=Dw
        )
        return {"case": 1, "q": q, "gammaEffective": gamma_prime, "warnings": warnings}
    if abs(Dw - effective_depth) < 0.001:
        q = _calculate_overburden(strata, start_depth=Ds, end_depth=effective_depth)
        return {"case": 2, "q": q, "gammaEffective": gamma_prime, "warnings": warnings}
    if Dw > effective_depth and Dw < effective_depth + B:
        q = _calculate_overburden(strata, start_depth=Ds, end_depth=effective_depth)
        delta = Dw - effective_depth
        gamma_eff = gamma_prime + (delta / B) * (design_stratum["gamma"] - gamma_prime)
        return {"case": 3, "q": q, "gammaEffective": gamma_eff, "warnings": warnings}
    q = _calculate_overburden(strata, start_depth=Ds, end_depth=effective_depth)
    return {
        "case": 4,
        "q": q,
        "gammaEffective": design_stratum["gamma"],
        "warnings": warnings,
    }


def _calculate_overburden(
    strata: list,
    start_depth: float = 0.0,
    end_depth: float = 0.0,
) -> float:
    """
    Calcula la sobrecarga q = Σ(γᵢ · hᵢ) entre start_depth y end_depth.
    Solo acumula el peso de los estratos dentro del rango
    [start_depth, end_depth]. Esto permite calcular desde el
    nivel del sótano en vez de desde la superficie.
    Usa γ natural (peso unitario total del suelo seco o húmedo).
    Args:
        strata: Lista de estratos
        start_depth: Profundidad inicial (ej: nivel del sótano)
        end_depth: Profundidad final (ej: nivel de la zapata)
    Returns:
        Sobrecarga q en las mismas unidades que γ×h
    """
    if end_depth <= start_depth:
        return 0.0
    q = 0.0
    depth = 0.0
    for stratum in strata:
        top = depth
        bottom = depth + stratum["thickness"]
        if top >= end_depth:
            break
        effective_top = max(top, start_depth)
        effective_bottom = min(bottom, end_depth)
        if effective_bottom > effective_top:
            q += stratum["gamma"] * (effective_bottom - effective_top)
        depth = bottom
    return q


def _calculate_overburden_effective(
    strata: list,
    start_depth: float,
    end_depth: float,
    Dw: float,
) -> float:
    """
    Calcula la sobrecarga efectiva q' con corrección por NF.
    Los segmentos sobre el NF usan γ natural (peso total del suelo).
    Los segmentos bajo el NF usan γ' = (γsat - γw) (peso efectivo).
    IMPORTANTE: q' es presión EFECTIVA (Das, Ec. 6.25). No se debe usar
    presión total porque la subpresión de poros no contribuye a la
    resistencia friccional (Nq).
    Args:
        strata: Lista de estratos
        start_depth: Profundidad inicial (nivel del sótano o 0)
        end_depth: Profundidad final (nivel de la zapata)
        Dw: Profundidad del nivel freático desde la superficie
    Returns:
        Sobrecarga efectiva q' con corrección por NF
    """
    if end_depth <= start_depth:
        return 0.0
    q = 0.0
    depth = 0.0
    for stratum in strata:
        top = depth
        bottom = depth + stratum["thickness"]
        if top >= end_depth:
            break
        effective_top = max(top, start_depth)
        effective_bottom = min(bottom, end_depth)
        if effective_bottom <= effective_top:
            depth = bottom
            continue
        gamma_prime_stratum = max(0.0, stratum["gammaSat"] - GAMMA_W)
        if effective_bottom <= Dw:
            q += stratum["gamma"] * (effective_bottom - effective_top)
        elif effective_top >= Dw:
            q += gamma_prime_stratum * (effective_bottom - effective_top)
        else:
            dry_part = Dw - effective_top
            wet_part = effective_bottom - Dw
            q += stratum["gamma"] * dry_part + gamma_prime_stratum * wet_part
        depth = bottom
    return q
