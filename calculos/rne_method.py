"""
Método RNE (Norma E.050 - Reglamento Nacional de Edificaciones, Perú).

Factores de capacidad portante analíticos:
  Nq = e^(π·tan(φ)) · tan²(45 + φ/2)
  Nc = (Nq - 1) · cot(φ)       [para φ > 0]
  Nγ = (Nq - 1) · tan(1.4·φ)   [fórmula RNE específica]

Caso especial φ = 0: Nc = 5.14, Nq = 1, Nγ = 0

Factores de forma:
  Sc = 1 + 0.2·(B/L)
  Sγ = 1 - 0.2·(B/L)

Factores de inclinación:
  ic = iq = (1 - β/90)²
  iγ = (1 - β/φ)²   [si φ > 0]

Fórmula: qu = Sc·ic·c·Nc + iq·q·Nq + 0.5·Sγ·iγ·γ·B·Nγ
"""

import math


def get_rne_bearing_factors(phi: float) -> dict:
    """
    Calcula Nc, Nq, Nγ según la norma RNE E.050.

    La diferencia con la Ecuación General está en Nγ:
        General:  Nγ = 2·(Nq + 1)·tan(φ)
        RNE:      Nγ = (Nq - 1)·tan(1.4·φ)

    Args:
        phi: Ángulo de fricción interna (°)

    Returns:
        dict con Nc, Nq, Ngamma
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
    c: float,
    q: float,
    gamma: float,
    B: float,
    L: float,
    phi: float,
    beta: float,
) -> dict:
    """
    Calcula qu usando el método RNE E.050.

    qu = Sc·ic·c·Nc + iq·q·Nq + 0.5·Sγ·iγ·γ·B·Nγ

    Returns:
        dict con qu y factors
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
    c: float,
    q: float,
    gamma: float,
    B: float,
    L: float,
    phi: float,
    beta: float,
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
