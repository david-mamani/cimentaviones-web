"""
Factores de capacidad portante, forma, profundidad e inclinación.

Contiene:
  1. Tabla de Terzaghi (Nc, Nq, Nγ) — Das (2015), 8va edición
  2. Factores de forma de Meyerhof (sc, sq, sγ)
  3. Factores de profundidad de Meyerhof (dc, dq, dγ)
  4. Factores de inclinación (ic, iq, iγ)
"""

import math


# ═══════════════════════════════════════════════════════════════
# 1. TABLA DE TERZAGHI — Nc, Nq, Nγ para φ = 0° a 50°
# ═══════════════════════════════════════════════════════════════
# Fuente: Terzaghi (1943), reproducida en Das (2015)
# Índice = φ (°), valores = (Nc, Nq, Nγ)
# Para valores no enteros se usa interpolación lineal.

TERZAGHI_TABLE = [
    # φ=0°     φ=1°     φ=2°     φ=3°     φ=4°
    (5.70,    1.00,    0.00),
    (6.00,    1.10,    0.01),
    (6.30,    1.22,    0.04),
    (6.62,    1.35,    0.06),
    (6.97,    1.49,    0.10),
    # φ=5°     φ=6°     φ=7°     φ=8°     φ=9°
    (7.34,    1.64,    0.14),
    (7.73,    1.81,    0.20),
    (8.15,    2.00,    0.27),
    (8.60,    2.21,    0.35),
    (9.09,    2.44,    0.44),
    # φ=10°    φ=11°    φ=12°    φ=13°    φ=14°
    (9.61,    2.69,    0.56),
    (10.16,   2.98,    0.69),
    (10.76,   3.29,    0.85),
    (11.41,   3.63,    1.04),
    (12.11,   4.02,    1.26),
    # φ=15°    φ=16°    φ=17°    φ=18°    φ=19°
    (12.86,   4.45,    1.52),
    (13.68,   4.92,    1.82),
    (14.60,   5.45,    2.18),
    (15.12,   6.04,    2.59),
    (16.56,   6.70,    3.07),
    # φ=20°    φ=21°    φ=22°    φ=23°    φ=24°
    (17.69,   7.44,    3.64),
    (18.92,   8.26,    4.31),
    (20.27,   9.19,    5.09),
    (21.75,  10.23,    6.00),
    (23.36,  11.40,    7.08),
    # φ=25°    φ=26°    φ=27°    φ=28°    φ=29°
    (25.13,  12.72,    8.34),
    (27.09,  14.21,    9.84),
    (29.24,  15.90,   11.60),
    (31.61,  17.81,   13.70),
    (34.24,  19.98,   16.18),
    # φ=30°    φ=31°    φ=32°    φ=33°    φ=34°
    (37.16,  22.46,   19.13),
    (40.41,  25.28,   22.65),
    (44.04,  28.52,   26.87),
    (48.09,  32.23,   31.94),
    (52.64,  36.50,   38.04),
    # φ=35°    φ=36°    φ=37°    φ=38°    φ=39°
    (57.75,  41.44,   45.41),
    (63.53,  47.16,   54.36),
    (70.01,  53.80,   65.27),
    (77.50,  61.55,   78.61),
    (85.97,  70.61,   95.03),
    # φ=40°    φ=41°    φ=42°    φ=43°    φ=44°
    (95.66,  81.27,  115.31),
    (106.81,  93.85,  140.51),
    (119.67, 108.75,  171.99),
    (134.58, 126.50,  211.56),
    (151.95, 147.74,  261.60),
    # φ=45°    φ=46°    φ=47°    φ=48°    φ=49°
    (172.28, 173.28,  325.34),
    (196.22, 204.19,  407.11),
    (224.55, 241.80,  512.84),
    (258.28, 287.85,  650.67),
    (298.71, 344.63,  831.99),
    # φ=50°
    (347.50, 415.14, 1072.80),
]


def get_bearing_factors(phi: float) -> dict:
    """
    Obtiene los factores Nc, Nq, Nγ de Terzaghi para un ángulo φ dado.
    Usa interpolación lineal para valores no enteros.

    Args:
        phi: Ángulo de fricción interna (°), entre 0 y 50

    Returns:
        dict con claves Nc, Nq, Ngamma

    Ejemplo:
        >>> get_bearing_factors(30)
        {'Nc': 37.16, 'Nq': 22.46, 'Ngamma': 19.13}
    """
    if phi < 0 or phi > 50:
        raise ValueError(
            f"El ángulo de fricción φ={phi}° está fuera del rango válido [0°, 50°]."
        )

    phi_low = math.floor(phi)
    phi_high = math.ceil(phi)

    # Si es entero, retornar directamente
    if phi_low == phi_high:
        Nc, Nq, Ngamma = TERZAGHI_TABLE[phi_low]
        return {"Nc": Nc, "Nq": Nq, "Ngamma": Ngamma}

    # Interpolación lineal
    fraction = phi - phi_low
    Nc_low, Nq_low, Ng_low = TERZAGHI_TABLE[phi_low]
    Nc_high, Nq_high, Ng_high = TERZAGHI_TABLE[phi_high]

    return {
        "Nc": Nc_low + fraction * (Nc_high - Nc_low),
        "Nq": Nq_low + fraction * (Nq_high - Nq_low),
        "Ngamma": Ng_low + fraction * (Ng_high - Ng_low),
    }


# ═══════════════════════════════════════════════════════════════
# 2. FACTORES DE FORMA — Meyerhof (1963)
# ═══════════════════════════════════════════════════════════════
# | Factor | Cuadrada/Circular | Rectangular     | Franja |
# |--------|-------------------|-----------------|--------|
# | sc     | 1.3               | 1 + 0.3·(B/L)   | 1.0    |
# | sq     | 1.0               | 1.0              | 1.0    |
# | sγ     | 0.8               | 1 - 0.2·(B/L)   | 1.0    |

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


# ═══════════════════════════════════════════════════════════════
# 3. FACTORES DE PROFUNDIDAD — Meyerhof (1963)
# ═══════════════════════════════════════════════════════════════
# dc = 1 + 0.4·(Df/B)
# dq = dγ = 1 + 0.1·tan²(45 + φ/2)·(Df/B)   para φ > 10°
# dq = dγ = 1.0                                para φ ≤ 10°

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
    if B <= 0:
        return {"dc": 1.0, "dq": 1.0, "dgamma": 1.0}
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


# ═══════════════════════════════════════════════════════════════
# 4. FACTORES DE INCLINACIÓN — Meyerhof (1963) / Hansen (1970)
# ═══════════════════════════════════════════════════════════════
# ic = iq = (1 - β/90)²
# iγ = (1 - β/φ)²          [si φ > 0]
# iγ = 1.0                 [si φ = 0, porque Nγ = 0]

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
