"""
Factores de forma de Meyerhof (sc, sq, sγ).

Ref: Meyerhof, G.G. (1963). "Some Recent Research on the Bearing
Capacity of Foundations." Canadian Geotechnical Journal, 1(1).

| Factor | Cuadrada/Circular | Rectangular     | Franja |
|--------|-------------------|-----------------|--------|
| sc     | 1.3               | 1 + 0.3·(B/L)   | 1.0    |
| sq     | 1.0               | 1.0              | 1.0    |
| sγ     | 0.8               | 1 - 0.2·(B/L)   | 1.0    |
"""


def get_shape_factors(foundation_type: str, B: float, L: float = None) -> dict:
    """
    Calcula los factores de forma según Meyerhof.

    Args:
        foundation_type: 'cuadrada', 'circular', 'rectangular', 'franja'
        B: Ancho de la cimentación (m)
        L: Longitud (m), solo para rectangular

    Returns:
        dict con claves sc, sq, sgamma
    """
    if L is None or L <= 0:
        L = B
    if B <= 0:
        return {"sc": 1.0, "sq": 1.0, "sgamma": 1.0}

    if foundation_type in ("cuadrada", "circular"):
        return {"sc": 1.3, "sq": 1.0, "sgamma": 0.8}

    elif foundation_type == "rectangular":
        ratio = B / L
        return {
            "sc": 1 + 0.3 * ratio,
            "sq": 1.0,
            "sgamma": 1 - 0.2 * ratio,
        }

    else:  # franja
        return {"sc": 1.0, "sq": 1.0, "sgamma": 1.0}
