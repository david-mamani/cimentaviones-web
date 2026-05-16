"""
Factores de capacidad de carga Nc, Nq, Nγ por método.

Tres conjuntos de factores:
  1. Terzaghi (analítico, Das 8va ed.)
  2. Ecuación General (Vesic / Prandtl / Reissner)
  3. RNE E.050 (Norma peruana)

Factores correctivos (forma, profundidad, inclinación) viven en methods.py
junto a sus respectivas fórmulas de qu, porque cada método los aplica de
forma diferente.
"""

import math


# ═══════════════════════════════════════════════════════════════
# 1. TERZAGHI — Factores analíticos (Das 8ed)
# ═══════════════════════════════════════════════════════════════
#
# φ = 0°:
#   Nc = 5.70, Nq = 1.00, Nγ = 0.00
#
# φ > 0°:
#   Nq = e^(2·(3π/4 - φ/2)·tan φ) / (2·cos²(45° + φ/2))
#   Nc = (Nq - 1) / tan φ
#   Nγ = (Nq - 1) · tan(1.4·φ)

def get_terzaghi_bearing_factors(phi: float) -> dict:
    """
    Calcula Nc, Nq, Nγ de Terzaghi analíticamente.

    Args:
        phi: Ángulo de fricción interna (°), 0 ≤ phi ≤ 50

    Returns:
        dict con claves Nc, Nq, Ngamma
    """
    if phi < 0 or phi > 50:
        raise ValueError(
            f"El ángulo de fricción φ={phi}° está fuera del rango válido [0°, 50°]."
        )

    if phi == 0:
        return {"Nc": 5.70, "Nq": 1.00, "Ngamma": 0.00}

    phi_rad = math.radians(phi)
    cos_half = math.cos(math.radians(45 + phi / 2))

    exponent = 2.0 * (3.0 * math.pi / 4.0 - phi_rad / 2.0) * math.tan(phi_rad)
    Nq = math.exp(exponent) / (2.0 * cos_half ** 2)
    Nc = (Nq - 1.0) / math.tan(phi_rad)
    Ngamma = (Nq - 1.0) * math.tan(1.4 * phi_rad)

    return {"Nc": Nc, "Nq": Nq, "Ngamma": Ngamma}


# ═══════════════════════════════════════════════════════════════
# 2. ECUACIÓN GENERAL — Vesic / Prandtl / Reissner
# ═══════════════════════════════════════════════════════════════
#
# φ = 0°:  Nc = 5.14, Nq = 1.00, Nγ = 0.00
# φ > 0°:
#   Nq = tan²(45° + φ/2) · e^(π·tan φ)
#   Nc = (Nq - 1) / tan φ
#   Nγ = 2·(Nq + 1)·tan φ

def get_general_bearing_factors(phi: float) -> dict:
    """Calcula Nc, Nq, Nγ de la Ecuación General (Vesic)."""
    if phi < 0 or phi > 50:
        raise ValueError(
            f"El ángulo de fricción φ={phi}° está fuera del rango válido [0°, 50°]."
        )

    if phi == 0:
        return {"Nc": 5.14, "Nq": 1.00, "Ngamma": 0.00}

    phi_rad = math.radians(phi)
    Nq = math.tan(math.radians(45 + phi / 2)) ** 2 * math.exp(math.pi * math.tan(phi_rad))
    Nc = (Nq - 1.0) / math.tan(phi_rad)
    Ngamma = 2.0 * (Nq + 1.0) * math.tan(phi_rad)

    return {"Nc": Nc, "Nq": Nq, "Ngamma": Ngamma}


# ═══════════════════════════════════════════════════════════════
# 3. RNE E.050 — Norma peruana
# ═══════════════════════════════════════════════════════════════
#
# φ = 0°:  Nc = 5.14, Nq = 1.00, Nγ = 0.00
# φ > 0°:
#   Nq = e^(π·tan φ) · tan²(45° + φ/2)   (idéntico a Ec. General)
#   Nc = (Nq - 1) / tan φ                 (idéntico a Ec. General)
#   Nγ = (Nq - 1) · tan(1.4·φ)            (fórmula RNE específica)

def get_rne_bearing_factors(phi: float) -> dict:
    """Calcula Nc, Nq, Nγ según la norma RNE E.050."""
    if phi < 0 or phi > 50:
        raise ValueError(
            f"El ángulo de fricción φ={phi}° está fuera del rango válido [0°, 50°]."
        )

    if phi == 0:
        return {"Nc": 5.14, "Nq": 1.00, "Ngamma": 0.00}

    phi_rad = math.radians(phi)
    Nq = math.exp(math.pi * math.tan(phi_rad)) * math.tan(math.radians(45 + phi / 2)) ** 2
    Nc = (Nq - 1.0) / math.tan(phi_rad)
    Ngamma = (Nq - 1.0) * math.tan(1.4 * phi_rad)

    return {"Nc": Nc, "Nq": Nq, "Ngamma": Ngamma}


# ═══════════════════════════════════════════════════════════════
# 4. FACTORES DE INCLINACIÓN DE CARGA — Meyerhof (1963)
# ═══════════════════════════════════════════════════════════════
#
# β = 0°:  Fci = Fqi = Fγi = 1.0
# β > 0°, φ > 0°:
#   Fci = Fqi = (1 - β/90)²
#   Fγi = (1 - β/φ)²        (requiere β < φ, ya validado aguas arriba)
# β > 0°, φ = 0°:
#   Fci = (1 - β/90)²
#   Fqi = 1.0                (Nq=1, no es crítico; convención del flujo propuesto)
#   Fγi = 0.0                (irrelevante: Nγ=0, S3=0 igual)

def get_inclination_factors(beta: float, phi: float) -> dict:
    """
    Factores de inclinación de carga (β y φ en grados).
    """
    if beta == 0:
        return {"ic": 1.0, "iq": 1.0, "igamma": 1.0}

    ic = (1.0 - beta / 90.0) ** 2

    if phi == 0:
        return {"ic": ic, "iq": 1.0, "igamma": 0.0}

    if beta >= phi:
        return {"ic": ic, "iq": ic, "igamma": 0.0}

    igamma = (1.0 - beta / phi) ** 2
    return {"ic": ic, "iq": ic, "igamma": igamma}
