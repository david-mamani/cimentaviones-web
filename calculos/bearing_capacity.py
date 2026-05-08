"""
Cálculo de capacidad portante — Función principal.

Soporta 3 métodos:
  1. "terzaghi" — Fórmulas clásicas con coeficientes fijos (tabla)
  2. "general"  — Ecuación general con factores analíticos (Das/Braja)
  3. "rne"      — Norma E.050 (RNE Perú)

Pipeline de 5 pasos:
  1. Encontrar estrato de diseño al nivel Ds+Df (sótano + desplante)
  2. Corrección por NF + sobrecarga q desde Ds hasta Ds+Df
  3. Calcular factores de forma, profundidad, inclinación
  4. Calcular qu según el método elegido
  5. Derivar qa, qnet, Qmax
"""

from .factors import get_bearing_factors, get_shape_factors, get_depth_factors, get_inclination_factors
from .water_table import apply_water_table_correction
from .methods import calculate_qu_general, calculate_general_rne_consideration, calculate_qu_rne, calculate_rne_consideration


def find_design_stratum(strata: list, effective_depth: float) -> dict:
    """
    Determina el estrato de diseño (el que se encuentra al nivel de la cimentación).

    Recorre los estratos de arriba hacia abajo. El primer estrato
    cuya profundidad acumulada EXCEDE la profundidad efectiva es
    el estrato de diseño (la zapata descansa sobre este estrato).

    NOTA: Usa comparación estricta (>). Si la zapata queda exactamente
    en el límite entre dos estratos, se toma el estrato inferior.

    Args:
        strata: Lista de estratos
        effective_depth: Profundidad efectiva de la zapata desde la
                        superficie (Ds + Df cuando hay sótano, solo Df sin sótano)

    Returns:
        dict con index y stratum
    """
    depth = 0.0
    for i, stratum in enumerate(strata):
        depth += stratum["thickness"]
        if depth > effective_depth:
            return {"index": i, "stratum": stratum}

    # Si la profundidad excede todos los estratos, usar el último
    return {"index": len(strata) - 1, "stratum": strata[-1]}


def _calculate_qu_terzaghi(
    foundation_type: str,
    c: float, Nc: float,
    q: float, Nq: float,
    gamma: float, B: float, Ngamma: float,
    L: float,
) -> dict:
    """
    Calcula qu usando las fórmulas clásicas de Terzaghi.

    Franja:      qu = c·Nc + q·Nq + 0.5·γ·B·Nγ
    Cuadrada:    qu = 1.3·c·Nc + q·Nq + 0.4·γ·B·Nγ
    Circular:    qu = 1.3·c·Nc + q·Nq + 0.3·γ·B·Nγ
    Rectangular: qu = c·Nc·(1+0.3·B/L) + q·Nq + 0.5·γ·B·Nγ·(1-0.2·B/L)
    """
    if foundation_type == "franja":
        F1 = c * Nc
        F2 = q * Nq
        F3 = 0.5 * gamma * B * Ngamma

    elif foundation_type == "cuadrada":
        F1 = 1.3 * c * Nc
        F2 = q * Nq
        F3 = 0.4 * gamma * B * Ngamma

    elif foundation_type == "circular":
        F1 = 1.3 * c * Nc
        F2 = q * Nq
        F3 = 0.3 * gamma * B * Ngamma

    elif foundation_type == "rectangular":
        F1 = c * Nc * (1 + 0.3 * (B / L))
        F2 = q * Nq
        F3 = 0.5 * gamma * B * Ngamma * (1 - 0.2 * (B / L))

    else:
        raise ValueError(f"Tipo de cimentación no soportado: {foundation_type}")

    return {"qu": F1 + F2 + F3, "F1": F1, "F2": F2, "F3": F3}


def calculate_bearing_capacity(input_data: dict) -> dict:
    """
    Función principal de cálculo. Ejecuta el análisis completo.

    Args:
        input_data: dict con foundation, strata, conditions, method

    Returns:
        dict con todos los resultados del cálculo
    """
    foundation = input_data["foundation"]
    strata = input_data["strata"]
    conditions = input_data["conditions"]
    method = input_data["method"]

    # ── Guards defensivos ──
    if not strata:
        raise ValueError("Se requiere al menos un estrato de suelo.")

    f_type = foundation["type"]
    B = foundation["B"]
    L = foundation["L"]
    Df = foundation["Df"]
    FS = foundation["FS"]
    beta = foundation["beta"]

    if B <= 0:
        raise ValueError(f"El ancho B ({B}) debe ser mayor a 0.")
    if L <= 0:
        raise ValueError(f"La longitud L ({L}) debe ser mayor a 0.")
    if FS <= 0:
        raise ValueError(f"El factor de seguridad FS ({FS}) debe ser mayor a 0.")

    has_water_table = conditions["hasWaterTable"]
    Dw = conditions["waterTableDepth"]
    has_basement = conditions["hasBasement"]
    Ds = conditions["basementDepth"] if has_basement else 0.0

    # Profundidad efectiva: Ds + Df cuando hay sótano
    # Df se mide desde el piso del sótano (o desde la superficie si no hay sótano)
    effective_depth = Ds + Df

    # ── Paso 1: Encontrar estrato de diseño ──
    # Se busca a la profundidad efectiva (Ds + Df) desde la superficie
    design = find_design_stratum(strata, effective_depth)
    design_index = design["index"]
    design_stratum = design["stratum"]
    is_cohesive = design_stratum["phi"] < 20
    soil_type = "Coh" if is_cohesive else "Fri"

    # ── Paso 2: Corrección por nivel freático + cálculo de sobrecarga ──
    # La sobrecarga q se calcula desde Ds hasta Ds+Df (el suelo sobre
    # el sótano ha sido excavado y no contribuye a la sobrecarga)
    water_result = apply_water_table_correction(
        strata, Df, B, has_water_table, Dw, design_stratum, Ds=Ds
    )

    q = water_result["q"]
    gamma_effective = water_result["gammaEffective"]

    # ── Paso 3: Factores de forma, profundidad, inclinación ──
    shape_factors = get_shape_factors(f_type, B, L)
    depth_factors = get_depth_factors(design_stratum["phi"], Df, B)
    inclination_factors = get_inclination_factors(beta, design_stratum["phi"])

    # ── Paso 4: Calcular qu según método elegido ──
    if method == "terzaghi":
        bearing_factors = get_bearing_factors(design_stratum["phi"])
        t_result = _calculate_qu_terzaghi(
            f_type, design_stratum["c"], bearing_factors["Nc"],
            q, bearing_factors["Nq"],
            gamma_effective, B, bearing_factors["Ngamma"], L,
        )
        qu = t_result["qu"]
        F1, F2, F3 = t_result["F1"], t_result["F2"], t_result["F3"]

        # Consideración RNE para Terzaghi
        if is_cohesive:
            rne_qult = 1.3 * design_stratum["c"] * 5.7
            rne_qult_c = rne_qult + q * 1
            rne_consideration = {
                "qultRNE": rne_qult,
                "qadmRNE": rne_qult / FS,
                "qultRNECorrected": rne_qult_c,
            }
        else:
            rne_consideration = {
                "qultRNE": F2 + F3,
                "qadmRNE": (F2 + F3) / FS,
                "qultRNECorrected": F2 + F3,
            }

    elif method == "general":
        g_result = calculate_qu_general(
            design_stratum["c"], q, gamma_effective, B, L,
            design_stratum["phi"], beta, Df,
        )
        qu = g_result["qu"]
        factors = g_result["factors"]
        bearing_factors = {
            "Nc": factors["Nc"],
            "Nq": factors["Nq"],
            "Ngamma": factors["Ngamma"],
        }
        F1 = design_stratum["c"] * factors["Nc"] * factors["Fcs"] * factors["Fcd"] * factors["Fci"]
        F2 = q * factors["Nq"] * factors["Fqs"] * factors["Fqd"] * factors["Fqi"]
        F3 = 0.5 * gamma_effective * B * factors["Ngamma"] * factors["Fgs"] * factors["Fgd"] * factors["Fgi"]

        rne_c = calculate_general_rne_consideration(
            design_stratum["c"], q, gamma_effective, B, L,
            design_stratum["phi"], beta, Df, is_cohesive,
        )
        rne_consideration = {
            "qultRNE": rne_c["qultRNE"],
            "qadmRNE": rne_c["qultRNE"] / FS,
            "qultRNECorrected": rne_c["qultRNECorrected"],
        }

    else:  # rne
        r_result = calculate_qu_rne(
            design_stratum["c"], q, gamma_effective, B, L,
            design_stratum["phi"], beta,
        )
        qu = r_result["qu"]
        factors = r_result["factors"]
        bearing_factors = {
            "Nc": factors["Nc"],
            "Nq": factors["Nq"],
            "Ngamma": factors["Ngamma"],
        }
        F1 = factors["Sc"] * factors["ic"] * design_stratum["c"] * factors["Nc"]
        F2 = factors["iq"] * q * factors["Nq"]
        F3 = 0.5 * factors["Sgamma"] * factors["igamma"] * gamma_effective * B * factors["Ngamma"]

        rne_c = calculate_rne_consideration(
            design_stratum["c"], q, gamma_effective, B, L,
            design_stratum["phi"], beta, is_cohesive,
        )
        rne_consideration = {
            "qultRNE": rne_c["qultRNE"],
            "qadmRNE": rne_c["qultRNE"] / FS,
            "qultRNECorrected": rne_c["qultRNECorrected"],
        }

    # ── Paso 5: Valores derivados ──
    qnet = qu - q
    qa = qu / FS
    qa_net = qnet / FS
    Qmax = qa * B * L

    return {
        "designStratumIndex": design_index,
        "designStratum": design_stratum,
        "bearingFactors": bearing_factors,
        "shapeFactors": shape_factors,
        "depthFactors": depth_factors,
        "inclinationFactors": inclination_factors,
        "q": q,
        "waterTableCase": water_result["case"],
        "gammaEffective": gamma_effective,
        "qu": qu,
        "qnet": qnet,
        "qa": qa,
        "qaNet": qa_net,
        "method": method,
        "Qmax": Qmax,
        "F1": F1,
        "F2": F2,
        "F3": F3,
        "soilType": soil_type,
        "rneConsideration": rne_consideration,
    }
