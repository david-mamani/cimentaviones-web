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
        "Nc": nc_low + t * (nc_high - nc_low),
        "Nq": nq_low + t * (nq_high - nq_low),
        "Ngamma": ny_low + t * (ny_high - ny_low),
    }


def get_general_bearing_factors(phi: float) -> dict:
    """Calcula Nc, Nq, Nγ de la Ecuación General (Vesic)."""
    if phi < 0 or phi > 50:
        raise ValueError(
            f"El ángulo de fricción φ={phi}° está fuera del rango válido [0°, 50°]."
        )
    if phi == 0:
        return {"Nc": 5.14, "Nq": 1.00, "Ngamma": 0.00}
    phi_rad = math.radians(phi)
    Nq = math.tan(math.radians(45 + phi / 2)) ** 2 * math.exp(
        math.pi * math.tan(phi_rad)
    )
    Nc = (Nq - 1.0) / math.tan(phi_rad)
    Ngamma = 2.0 * (Nq + 1.0) * math.tan(phi_rad)
    return {"Nc": Nc, "Nq": Nq, "Ngamma": Ngamma}


def get_rne_bearing_factors(phi: float) -> dict:
    """Calcula Nc, Nq, Nγ según la norma RNE E.050."""
    if phi < 0 or phi > 50:
        raise ValueError(
            f"El ángulo de fricción φ={phi}° está fuera del rango válido [0°, 50°]."
        )
    if phi == 0:
        return {"Nc": 5.14, "Nq": 1.00, "Ngamma": 0.00}
    phi_rad = math.radians(phi)
    Nq = (
        math.exp(math.pi * math.tan(phi_rad))
        * math.tan(math.radians(45 + phi / 2)) ** 2
    )
    Nc = (Nq - 1.0) / math.tan(phi_rad)
    Ngamma = (Nq - 1.0) * math.tan(1.4 * phi_rad)
    return {"Nc": Nc, "Nq": Nq, "Ngamma": Ngamma}


def get_inclination_factors(beta: float, phi: float) -> dict:
    """
    Factores de inclinación de carga (β y φ en grados). Meyerhof 1963.
    """
    if beta == 0:
        return {"ic": 1.0, "iq": 1.0, "igamma": 1.0}
    ic = (1.0 - beta / 90.0) ** 2
    iq = ic
    if phi == 0:
        return {"ic": ic, "iq": iq, "igamma": 0.0}
    if beta >= phi:
        return {"ic": ic, "iq": iq, "igamma": 0.0}
    igamma = (1.0 - beta / phi) ** 2
    return {"ic": ic, "iq": iq, "igamma": igamma}
