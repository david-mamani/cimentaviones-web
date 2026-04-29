"""
Factores de profundidad de Meyerhof (dc, dq, dγ).

Ref: Meyerhof, G.G. (1963).

dc = 1 + 0.4·(Df/B)
dq = dγ = 1 + 0.1·tan²(45 + φ/2)·(Df/B)   para φ > 10°
dq = dγ = 1.0                                para φ ≤ 10°
"""

import math


def get_depth_factors(phi: float, Df: float, B: float) -> dict:
    """
    Calcula los factores de profundidad según Meyerhof.

    Args:
        phi: Ángulo de fricción interna (°)
        Df: Profundidad de desplante (m)
        B: Ancho de la cimentación (m)

    Returns:
        dict con claves dc, dq, dgamma
    """
    ratio = Df / B
    dc = 1 + 0.4 * ratio

    if phi > 10:
        angle = math.radians(45 + phi / 2)
        tan_squared = math.tan(angle) ** 2
        dq = 1 + 0.1 * tan_squared * ratio
    else:
        dq = 1.0

    return {
        "dc": dc,
        "dq": dq,
        "dgamma": dq,  # dγ = dq en Meyerhof
    }
