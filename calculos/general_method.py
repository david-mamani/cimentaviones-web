"""
"Ecuación General" — Factores analíticos de Das/Braja.

A diferencia del método Terzaghi que usa tabla, la Ecuación General
calcula Nc, Nq, Nγ analíticamente:

  Nq = tan²(45 + φ/2) · e^(π·tan(φ))
  Nc = (Nq - 1) · cot(φ)
  Nγ = 2·(Nq + 1)·tan(φ)

Caso φ = 0: Nq = 1, Nc = 5.14, Nγ = 0

Factores de forma (Das):
  Fcs = 1 + (B/L)·(Nq/Nc)
  Fqs = 1 + (B/L)·tan(φ)
  Fγs = 1 - 0.4·(B/L)

Factores de profundidad (Das):
  Si Df/B ≤ 1:
    Fqd = 1 + 2·tan(φ)·(1-sin(φ))²·(Df/B)
  Si Df/B > 1:
    Fqd = 1 + 2·tan(φ)·(1-sin(φ))²·atan(Df/B)
  Fcd = Fqd - (1-Fqd)/(Nc·tan(φ))        [φ > 0]
  Fcd = 1 + 0.4·(Df/B)                    [φ = 0]
  Fγd = 1

qu = c·Nc·Fcs·Fcd·Fci + q·Nq·Fqs·Fqd·Fqi + 0.5·γ·B·Nγ·Fγs·Fγd·Fγi
"""

import math


def get_general_bearing_factors(phi: float) -> dict:
    """
    Calcula factores Nc, Nq, Nγ analíticamente (Das/Braja).

    Args:
        phi: Ángulo de fricción interna (°)

    Returns:
        dict con Nc, Nq, Ngamma
    """
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
    c: float,
    q: float,
    gamma: float,
    B: float,
    L: float,
    phi: float,
    beta: float,
    Df: float,
) -> dict:
    """
    Calcula todos los factores y qu usando la Ecuación General (Das).

    Returns:
        dict con qu y factors (todos los factores intermedios)
    """
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


def calculate_general_rne_consideration(
    c: float,
    q: float,
    gamma: float,
    B: float,
    L: float,
    phi: float,
    beta: float,
    Df: float,
    is_cohesive: bool,
) -> dict:
    """Consideración RNE para la Ecuación General."""
    phi_rad = math.radians(phi)
    Fci = (1 - beta / 90) ** 2 if beta > 0 else 1
    Fqi = Fci
    Fgi = (1 - beta / phi) ** 2 if (beta > 0 and phi > 0) else 1
    ratio = Df / B

    if is_cohesive:
        Fcs0 = 1 + (B / L) * (1 / 5.14)
        Fcd0 = (
            1 + 0.4 * ratio if ratio <= 1 else 1 + 0.4 * math.atan(ratio)
        )
        qult_rne = c * 5.14 * Fcs0 * Fcd0 * Fci
        qult_rne_corrected = qult_rne + q * 1 * 1 * 1 * Fqi
        return {"qultRNE": qult_rne, "qultRNECorrected": qult_rne_corrected}
    else:
        bf = get_general_bearing_factors(phi)
        Fqs = 1 + (B / L) * math.tan(phi_rad)
        Fgs = 1 - 0.4 * (B / L)
        tan_phi = math.tan(phi_rad)
        sin_phi = math.sin(phi_rad)
        depth_term = 2 * tan_phi * (1 - sin_phi) ** 2
        Fqd = (
            1 + depth_term * ratio
            if ratio <= 1
            else 1 + depth_term * math.atan(ratio)
        )
        F2 = q * bf["Nq"] * Fqs * Fqd * Fqi
        F3 = 0.5 * gamma * B * bf["Ngamma"] * Fgs * 1 * Fgi
        return {"qultRNE": F2 + F3, "qultRNECorrected": F2 + F3}
