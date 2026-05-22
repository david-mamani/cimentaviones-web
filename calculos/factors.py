"""
Factores de capacidad de carga Nc, Nq, Nγ por método.

Tres conjuntos de factores:
  1. Terzaghi (tabla del curso — Das 8va ed., ver reference_tables.TERZAGHI_TABLE)
  2. Ecuación General (Vesic / Prandtl / Reissner)
  3. RNE E.050 (Norma peruana)

Factores correctivos (forma, profundidad, inclinación) viven en methods.py
junto a sus respectivas fórmulas de qu, porque cada método los aplica de
forma diferente.
"""

import math

from .reference_tables import TERZAGHI_TABLE


# ═══════════════════════════════════════════════════════════════
# 1. TERZAGHI — Factores desde TABLA del curso (interpolación lineal)
# ═══════════════════════════════════════════════════════════════
#
# El curso prescribe usar la tabla tabulada (Das) en lugar de las fórmulas
# analíticas. Para φ no entero, se interpola linealmente entre las filas
# adyacentes φ_low = floor(φ) y φ_high = floor(φ) + 1.

def get_terzaghi_bearing_factors(phi: float) -> dict:
    """
    Obtiene Nc, Nq, Nγ de Terzaghi desde la tabla del curso, con
    interpolación lineal entre filas enteras de φ.

    Args:
        phi: Ángulo de fricción interna (°), 0 ≤ phi ≤ 50

    Returns:
        dict con claves Nc, Nq, Ngamma
    """
    if phi < 0 or phi > 50:
        raise ValueError(
            f"El ángulo de fricción φ={phi}° está fuera del rango válido [0°, 50°]."
        )

    phi_low = int(math.floor(phi))
    if phi_low >= 50:
        Nc, Nq, Ngamma = TERZAGHI_TABLE[50]
        return {"Nc": Nc, "Nq": Nq, "Ngamma": Ngamma}

    nc_low, nq_low, ny_low = TERZAGHI_TABLE[phi_low]
    if phi == phi_low:
        return {"Nc": nc_low, "Nq": nq_low, "Ngamma": ny_low}

    nc_high, nq_high, ny_high = TERZAGHI_TABLE[phi_low + 1]
    t = phi - phi_low
    return {
        "Nc":     nc_low + t * (nc_high - nc_low),
        "Nq":     nq_low + t * (nq_high - nq_low),
        "Ngamma": ny_low + t * (ny_high - ny_low),
    }


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
# 4. FACTORES DE INCLINACIÓN DE CARGA — Meyerhof (1963) estándar
# ═══════════════════════════════════════════════════════════════
#
# Das Tabla 6.3 — Meyerhof no distingue casos para Fci, Fqi:
#   β = 0°:  Fci = Fqi = Fγi = 1.0
#   β > 0°:  Fci = Fqi = (1 - β/90°)²            ← incondicional respecto a φ
#
# Para Fγi sí hay separación según φ:
#   β > 0°, φ > 0°, β < φ:  Fγi = (1 - β/φ)²
#   β ≥ φ con φ > 0°:        Fγi = 0    (condición inestable; ya validado aguas arriba)
#   φ = 0°:                  Fγi = 0    (irrelevante: Nγ=0 → S3=0 igualmente)

def get_inclination_factors(beta: float, phi: float) -> dict:
    """
    Factores de inclinación de carga (β y φ en grados). Meyerhof 1963.
    """
    if beta == 0:
        return {"ic": 1.0, "iq": 1.0, "igamma": 1.0}

    ic = (1.0 - beta / 90.0) ** 2
    iq = ic  # Meyerhof: Fci = Fqi = (1-β/90)² incondicional (Das Tabla 6.3)

    if phi == 0:
        # Fγi irrelevante porque Nγ=0 → S3=0; se reporta 0 por convención.
        return {"ic": ic, "iq": iq, "igamma": 0.0}

    if beta >= phi:
        return {"ic": ic, "iq": iq, "igamma": 0.0}

    igamma = (1.0 - beta / phi) ** 2
    return {"ic": ic, "iq": iq, "igamma": igamma}
