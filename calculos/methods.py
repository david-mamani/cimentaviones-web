"""
Métodos de cálculo de capacidad portante: Ecuación General y RNE.

Contiene:
  1. Ecuación General (Das/Braja) — Factores analíticos
  2. Método RNE E.050 (Norma peruana) — Factores específicos

El método Terzaghi se maneja directamente en bearing_capacity.py
usando la tabla de factores de factors.py.
"""

import math


# ═══════════════════════════════════════════════════════════════
# 1. ECUACIÓN GENERAL — Das/Braja
# ═══════════════════════════════════════════════════════════════
#
# Factores analíticos:
#   Nq = tan²(45 + φ/2) · e^(π·tan(φ))
#   Nc = (Nq - 1) · cot(φ)
#   Nγ = 2·(Nq + 1)·tan(φ)
#
# Caso φ = 0: Nq = 1, Nc = 5.14, Nγ = 0
#
# Factores de forma (Das):
#   Fcs = 1 + (B/L)·(Nq/Nc)
#   Fqs = 1 + (B/L)·tan(φ)
#   Fγs = 1 - 0.4·(B/L)
#
# Factores de profundidad (Das):
#   Si Df/B ≤ 1:
#     Fqd = 1 + 2·tan(φ)·(1-sin(φ))²·(Df/B)
#   Si Df/B > 1:
#     Fqd = 1 + 2·tan(φ)·(1-sin(φ))²·atan(Df/B)
#   Fcd = Fqd - (1-Fqd)/(Nc·tan(φ))        [φ > 0]
#   Fcd = 1 + 0.4·(Df/B)                    [φ = 0]
#   Fγd = 1
#
# qu = c·Nc·Fcs·Fcd·Fci + q·Nq·Fqs·Fqd·Fqi + 0.5·γ·B·Nγ·Fγs·Fγd·Fγi


def get_general_bearing_factors(phi: float) -> dict:
    """Calcula factores Nc, Nq, Nγ analíticamente (Das/Braja)."""
    if phi == 0:
        return {"Nc": 5.14, "Nq": 1, "Ngamma": 0}

    phi_rad = math.radians(phi)
    Nq = math.tan(math.pi / 4 + phi_rad / 2) ** 2 * math.exp(
        math.pi * math.tan(phi_rad)
    )
    Nc = (Nq - 1) * (1 / math.tan(phi_rad))
    Ngamma = 2 * (Nq + 1) * math.tan(phi_rad)

    return {
        "Nc": round(Nc, 2),
        "Nq": round(Nq, 2),
        "Ngamma": round(Ngamma, 2),
    }


def calculate_qu_general(
    c: float, q: float, gamma: float,
    B: float, L: float, phi: float, beta: float, Df: float,
) -> dict:
    """
    Calcula todos los factores y qu usando la Ecuación General (Das).

    Returns:
        dict con qu y factors (todos los factores intermedios)
    """
    if B <= 0:
        raise ValueError(f"El ancho B ({B}) debe ser mayor a 0.")
    if L <= 0:
        raise ValueError(f"La longitud L ({L}) debe ser mayor a 0.")

    bf = get_general_bearing_factors(phi)
    phi_rad = math.radians(phi)

    # --- Factores de forma ---
    if phi == 0:
        Fcs = 1 + (B / L) * (1 / 5.14)
        Fqs = 1
        Fgs = 1 - 0.4 * (B / L)
    else:
        Fcs = 1 + (B / L) * (bf["Nq"] / bf["Nc"])
        Fqs = 1 + (B / L) * math.tan(phi_rad)
        Fgs = 1 - 0.4 * (B / L)

    # --- Factores de profundidad ---
    ratio = Df / B

    if phi == 0:
        Fcd = 1 + 0.4 * ratio if ratio <= 1 else 1 + 0.4 * math.atan(ratio)
        Fqd = 1
        Fgd = 1
    else:
        tan_phi = math.tan(phi_rad)
        sin_phi = math.sin(phi_rad)
        depth_term = 2 * tan_phi * (1 - sin_phi) ** 2

        Fqd = (
            1 + depth_term * ratio
            if ratio <= 1
            else 1 + depth_term * math.atan(ratio)
        )
        Fcd = Fqd - (1 - Fqd) / (bf["Nc"] * tan_phi)
        Fgd = 1

    # --- Factores de inclinación ---
    Fci = (1 - beta / 90) ** 2 if beta > 0 else 1
    Fqi = Fci
    Fgi = (1 - beta / phi) ** 2 if (beta > 0 and phi > 0) else 1

    # --- Cálculo de qu ---
    qu = (
        c * bf["Nc"] * Fcs * Fcd * Fci
        + q * bf["Nq"] * Fqs * Fqd * Fqi
        + 0.5 * gamma * B * bf["Ngamma"] * Fgs * Fgd * Fgi
    )

    return {
        "qu": qu,
        "factors": {
            **bf,
            "Fcs": Fcs, "Fqs": Fqs, "Fgs": Fgs,
            "Fcd": Fcd, "Fqd": Fqd, "Fgd": Fgd,
            "Fci": Fci, "Fqi": Fqi, "Fgi": Fgi,
        },
    }





# ═══════════════════════════════════════════════════════════════
# 2. MÉTODO RNE — Norma E.050 (Reglamento Nacional de Edificaciones, Perú)
# ═══════════════════════════════════════════════════════════════
#
# Factores analíticos:
#   Nq = e^(π·tan(φ)) · tan²(45 + φ/2)
#   Nc = (Nq - 1) · cot(φ)
#   Nγ = (Nq - 1) · tan(1.4·φ)   [fórmula RNE específica]
#
# Factores de forma:
#   Sc = 1 + 0.2·(B/L)
#   Sγ = 1 - 0.2·(B/L)
#
# Factores de inclinación:
#   ic = iq = (1 - β/90)²
#   iγ = (1 - β/φ)²   [si φ > 0]
#
# Fórmula: qu = Sc·ic·c·Nc + iq·q·Nq + 0.5·Sγ·iγ·γ·B·Nγ


def get_rne_bearing_factors(phi: float) -> dict:
    """
    Calcula Nc, Nq, Nγ según la norma RNE E.050.
    La diferencia con la Ecuación General está en Nγ:
        General:  Nγ = 2·(Nq + 1)·tan(φ)
        RNE:      Nγ = (Nq - 1)·tan(1.4·φ)
    """
    if phi == 0:
        return {"Nc": 5.14, "Nq": 1, "Ngamma": 0}

    phi_rad = math.radians(phi)
    Nq = math.exp(math.pi * math.tan(phi_rad)) * math.tan(
        math.pi / 4 + phi_rad / 2
    ) ** 2
    Nc = (Nq - 1) * (1 / math.tan(phi_rad))
    Ngamma = (Nq - 1) * math.tan(1.4 * phi_rad)

    return {
        "Nc": round(Nc, 2),
        "Nq": round(Nq, 2),
        "Ngamma": round(Ngamma, 2),
    }


def calculate_qu_rne(
    c: float, q: float, gamma: float,
    B: float, L: float, phi: float, beta: float,
) -> dict:
    """
    Calcula qu usando el método RNE E.050.
    qu = Sc·ic·c·Nc + iq·q·Nq + 0.5·Sγ·iγ·γ·B·Nγ
    """
    if B <= 0:
        raise ValueError(f"El ancho B ({B}) debe ser mayor a 0.")
    if L <= 0:
        raise ValueError(f"La longitud L ({L}) debe ser mayor a 0.")

    bf = get_rne_bearing_factors(phi)

    # Factores de forma
    Sc = 1 + 0.2 * (B / L)
    Sgamma = 1 - 0.2 * (B / L)

    # Factores de inclinación
    ic = (1 - beta / 90) ** 2 if beta > 0 else 1
    iq = ic
    igamma = (1 - beta / phi) ** 2 if (beta > 0 and phi > 0) else 1

    qu = (
        Sc * ic * c * bf["Nc"]
        + iq * q * bf["Nq"]
        + 0.5 * Sgamma * igamma * gamma * B * bf["Ngamma"]
    )

    return {
        "qu": qu,
        "factors": {
            **bf,
            "Sc": Sc,
            "Sgamma": Sgamma,
            "ic": ic,
            "iq": iq,
            "igamma": igamma,
        },
    }


def calculate_rne_consideration(
    c: float, q: float, gamma: float,
    B: float, L: float, phi: float, beta: float,
    is_cohesive: bool,
) -> dict:
    """
    Consideración RNE: cálculos especiales para suelos cohesivos y friccionantes.
    Suelo cohesivo (φ < 20°): Solo el término de cohesión con Nc = 5.14
    Suelo friccionante (φ ≥ 20°): Términos 2 y 3 (sin cohesión)
    """
    if B <= 0 or L <= 0:
        raise ValueError("B y L deben ser mayores a 0 para la consideración RNE.")

    Sc = 1 + 0.2 * (B / L)
    Sgamma = 1 - 0.2 * (B / L)
    ic = (1 - beta / 90) ** 2 if beta > 0 else 1
    iq = ic
    igamma = (1 - beta / phi) ** 2 if (beta > 0 and phi > 0) else 1

    if is_cohesive:
        qult_rne = Sc * ic * c * 5.14
        qult_rne_corrected = qult_rne + iq * q * 1  # Nq = 1 para corrección
        return {"qultRNE": qult_rne, "qultRNECorrected": qult_rne_corrected}
    else:
        bf = get_rne_bearing_factors(phi)
        F2 = iq * q * bf["Nq"]
        F3 = 0.5 * Sgamma * igamma * gamma * B * bf["Ngamma"]
        return {"qultRNE": F2 + F3, "qultRNECorrected": F2 + F3}
