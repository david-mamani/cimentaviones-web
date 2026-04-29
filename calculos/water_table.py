"""
Correcciones por nivel freático.

Se distinguen 4 casos según la posición del nivel freático (Dw)
respecto a la profundidad de desplante (Df) y el ancho B.

γw = 9.81 kN/m³ (peso unitario del agua)
γ' = γsat - γw  (peso unitario sumergido o efectivo)
"""

GAMMA_W = 9.81  # kN/m³


def apply_water_table_correction(
    strata: list,
    Df: float,
    B: float,
    has_water_table: bool,
    Dw: float,
    design_stratum: dict,
) -> dict:
    """
    Calcula la sobrecarga efectiva q y el γ efectivo considerando el NF.

    Args:
        strata: Lista de estratos [{thickness, gamma, gammaSat, ...}]
        Df: Profundidad de desplante (m)
        B: Ancho de la cimentación (m)
        has_water_table: Si existe nivel freático
        Dw: Profundidad del nivel freático (m)
        design_stratum: Estrato de diseño (al nivel de Df)

    Returns:
        dict con claves: case, q, gammaEffective
    """
    # Sin nivel freático → sin corrección
    if not has_water_table:
        q = _calculate_overburden(strata, Df)
        return {
            "case": 0,
            "q": q,
            "gammaEffective": design_stratum["gamma"],
        }

    gamma_prime = design_stratum["gammaSat"] - GAMMA_W

    # Caso 1: NF por encima de la cimentación (Dw < Df)
    if Dw < Df:
        q = _calculate_overburden_with_water_table(strata, Df, Dw)
        return {"case": 1, "q": q, "gammaEffective": gamma_prime}

    # Caso 2: NF en la base de la cimentación (Dw = Df)
    if abs(Dw - Df) < 0.001:
        q = _calculate_overburden(strata, Df)
        return {"case": 2, "q": q, "gammaEffective": gamma_prime}

    # Caso 3: NF entre Df y Df + B
    if Dw > Df and Dw < Df + B:
        q = _calculate_overburden(strata, Df)
        gamma_eff = gamma_prime + ((Dw - Df) / B) * (
            design_stratum["gamma"] - gamma_prime
        )
        return {"case": 3, "q": q, "gammaEffective": gamma_eff}

    # Caso 4: NF por debajo de Df + B (sin corrección)
    q = _calculate_overburden(strata, Df)
    return {
        "case": 4,
        "q": q,
        "gammaEffective": design_stratum["gamma"],
    }


def _calculate_overburden(strata: list, Df: float) -> float:
    """
    Calcula la sobrecarga q = Σ(γᵢ · hᵢ) para todos los estratos hasta Df.
    Sin corrección por nivel freático.
    """
    q = 0.0
    depth = 0.0

    for stratum in strata:
        top = depth
        bottom = depth + stratum["thickness"]

        if top >= Df:
            break

        effective_thickness = min(bottom, Df) - top
        q += stratum["gamma"] * effective_thickness
        depth = bottom

    return q


def _calculate_overburden_with_water_table(
    strata: list, Df: float, Dw: float
) -> float:
    """
    Calcula la sobrecarga q con corrección por NF (Caso 1: Dw < Df).
    Los estratos sobre el NF usan γ natural.
    Los estratos bajo el NF pero sobre Df usan γ' = γsat - γw.
    """
    q = 0.0
    depth = 0.0

    for stratum in strata:
        top = depth
        bottom = depth + stratum["thickness"]

        if top >= Df:
            break

        effective_bottom = min(bottom, Df)
        gamma_prime = stratum["gammaSat"] - GAMMA_W

        if effective_bottom <= Dw:
            # Todo el segmento está sobre el NF → usar γ natural
            q += stratum["gamma"] * (effective_bottom - top)
        elif top >= Dw:
            # Todo el segmento está bajo el NF → usar γ'
            q += gamma_prime * (effective_bottom - top)
        else:
            # El NF cruza este estrato
            dry_part = Dw - top
            wet_part = effective_bottom - Dw
            q += stratum["gamma"] * dry_part + gamma_prime * wet_part

        depth = bottom

    return q
