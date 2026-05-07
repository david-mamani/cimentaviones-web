"""
Factores de inclinación de carga (ic, iq, iγ).

Ref: Meyerhof (1963) / Hansen (1970).

ic = iq = (1 - β/90)²
iγ = (1 - β/φ)²          [si φ > 0]
iγ = 1.0                 [si φ = 0, porque Nγ = 0]

Si β = 0 (sin inclinación), todos los factores son 1.0.
"""


def get_inclination_factors(beta: float, phi: float) -> dict:
    """
    Calcula los factores de inclinación de carga.

    Args:
        beta: Ángulo de inclinación de la carga (°)
        phi: Ángulo de fricción interna del suelo (°)

    Returns:
        dict con claves ic, iq, igamma
    """
    if beta == 0:
        return {"ic": 1.0, "iq": 1.0, "igamma": 1.0}

    ic_iq = (1 - beta / 90) ** 2

    # Si φ = 0, Nγ = 0, así que iγ no importa → usar 1.0
    # Si β ≥ φ, el factor se anula (geotécnicamente, sin capacidad por fricción)
    if phi <= 0:
        igamma = 1.0
    elif beta >= phi:
        igamma = 0.0
    else:
        igamma = (1 - beta / phi) ** 2

    return {
        "ic": ic_iq,
        "iq": ic_iq,
        "igamma": igamma,
    }
