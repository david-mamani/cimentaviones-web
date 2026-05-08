"""
Correcciones por nivel freático.

Se distinguen 4 casos según la posición del nivel freático (Dw)
respecto a la profundidad efectiva de la cimentación y el ancho B.

γw = 9.81 kN/m³ (peso unitario del agua)
γ' = γsat - γw  (peso unitario sumergido o efectivo)

NOTA IMPORTANTE — Sobrecarga q:
  q es la presión TOTAL (no efectiva) al nivel de la zapata.
  Bajo el NF se usa γsat (peso total), NO γ' (peso sumergido).
  γ' solo se usa para gammaEffective (tercer término de la ecuación).

NOTA IMPORTANTE — Sótano con NF encima:
  Cuando hay sótano de profundidad Ds y el NF está arriba del piso
  del sótano (Dw < Ds), existe una columna de agua sin suelo entre
  Dw y Ds que ejerce presión γw × (Ds - Dw) sobre la cimentación.
"""

GAMMA_W = 9.81  # kN/m³


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
    effective_depth = Ds + Df  # profundidad real de la cimentación
    warnings = []

    # ── Bug 4: Clamp Dw ≥ 0 ──
    if has_water_table and Dw < 0:
        Dw = 0.0
        warnings.append(
            "El nivel freático (Dw) era negativo; se ajustó a 0.0 (superficie)."
        )

    # Sin nivel freático → sin corrección de γ
    if not has_water_table:
        q = _calculate_overburden(strata, start_depth=Ds, end_depth=effective_depth)
        return {
            "case": 0,
            "q": q,
            "gammaEffective": design_stratum["gamma"],
            "warnings": warnings,
        }

    # ── Bug 2: Clamp γ' ≥ 0 ──
    raw_gamma_prime = design_stratum["gammaSat"] - GAMMA_W
    if raw_gamma_prime < 0:
        warnings.append(
            f"γsat ({design_stratum['gammaSat']:.2f}) < γw ({GAMMA_W}). "
            f"Dato inválido: γsat debe ser mayor que γw. "
            f"Se usó γ' = 0 como protección."
        )
    gamma_prime = max(0.0, raw_gamma_prime)

    # Caso 1: NF por encima de la cimentación (Dw < effective_depth)
    #   → La cimentación está sumergida total o parcialmente
    #   → q usa γ natural arriba del NF y γ' debajo (Esfuerzo EFECTIVO)
    #   → γ efectivo = γ' (sumergido) para el tercer término
    if Dw < effective_depth:
        q = _calculate_overburden_effective(
            strata, start_depth=Ds, end_depth=effective_depth, Dw=Dw
        )
        return {"case": 1, "q": q, "gammaEffective": gamma_prime, "warnings": warnings}

    # Caso 2: NF en la base de la cimentación (Dw ≈ effective_depth)
    #   → El NF está justo al nivel de la zapata
    #   → q sin corrección por NF (todo sobre el NF usa γ natural)
    #   → γ' para el suelo debajo de la zapata
    if abs(Dw - effective_depth) < 0.001:
        q = _calculate_overburden(strata, start_depth=Ds, end_depth=effective_depth)
        return {"case": 2, "q": q, "gammaEffective": gamma_prime, "warnings": warnings}

    # Caso 3: NF entre la base y base + B (parcialmente sumergido debajo)
    #   → γ efectivo interpolado entre γ' y γ natural
    if Dw > effective_depth and Dw < effective_depth + B:
        q = _calculate_overburden(strata, start_depth=Ds, end_depth=effective_depth)
        delta = Dw - effective_depth
        gamma_eff = gamma_prime + (delta / B) * (
            design_stratum["gamma"] - gamma_prime
        )
        return {"case": 3, "q": q, "gammaEffective": gamma_eff, "warnings": warnings}

    # Caso 4: NF por debajo de effective_depth + B (sin efecto)
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

        # Calcular la porción del estrato dentro del rango [start, end]
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

        # Porción del estrato dentro del rango [start, end]
        effective_top = max(top, start_depth)
        effective_bottom = min(bottom, end_depth)

        if effective_bottom <= effective_top:
            depth = bottom
            continue

        gamma_prime_stratum = max(0.0, stratum["gammaSat"] - GAMMA_W)

        if effective_bottom <= Dw:
            # Todo el segmento está sobre el NF → usar γ natural
            q += stratum["gamma"] * (effective_bottom - effective_top)
        elif effective_top >= Dw:
            # Todo el segmento está bajo el NF → usar γ' (presión EFECTIVA)
            q += gamma_prime_stratum * (effective_bottom - effective_top)
        else:
            # El NF cruza este segmento
            dry_part = Dw - effective_top
            wet_part = effective_bottom - Dw
            q += stratum["gamma"] * dry_part + gamma_prime_stratum * wet_part

        depth = bottom

    return q
