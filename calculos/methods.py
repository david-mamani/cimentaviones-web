"""
Fórmulas de capacidad de carga última qu para los tres métodos:

  1. Terzaghi (cuadrada / corrida / circular)
  2. Ecuación General (Das / DeBeer / Hansen / Meyerhof)
  3. RNE E.050 (Norma peruana)

Cada función devuelve los sumandos S1, S2, S3 por separado, lo que permite
aplicar los tres criterios de combinación (General, RNE, RNE Corregido) en
una capa superior.

Factores correctivos:
  - Forma: DeBeer (1970) para Ec. General; coeficientes embebidos en Terzaghi;
    propios E.050 para RNE.
  - Profundidad: Hansen (1970) solo en Ec. General; no aplica a Terzaghi ni RNE.
  - Inclinación: Meyerhof (1963), idénticos en Ec. General y RNE.

Convención de dimensiones:
  - B_orig, L_orig: dimensiones físicas de la zapata. Se usan en los factores
    de profundidad (Df/B siempre con B original).
  - B_eff, L_eff: dimensiones efectivas (Meyerhof). Si hay excentricidad,
    B_eff = B - 2·e1 y L_eff = L - 2·e2 (con intercambio si B_eff > L_eff).
    Se usan en factores de forma y en el tercer sumando (S3 = ½·γ·B_eff·Nγ·…).
"""

import math
from .factors import (
    get_terzaghi_bearing_factors,
    get_general_bearing_factors,
    get_rne_bearing_factors,
    get_inclination_factors,
)


# ═══════════════════════════════════════════════════════════════
# 1. TERZAGHI — Cuadrada / Corrida / Circular
# ═══════════════════════════════════════════════════════════════
#
# Corrida:   qu = c·Nc + q·Nq + ½·γ·B·Nγ
# Cuadrada:  qu = 1.3·c·Nc + q·Nq + 0.4·γ·B·Nγ
# Circular:  qu = 1.3·c·Nc + q·Nq + 0.3·γ·B·Nγ
#
# Terzaghi no acepta rectangular en su formulación clásica.

TERZAGHI_COEFS = {
    "franja":    {"c": 1.0, "gamma": 0.5},
    "cuadrada":  {"c": 1.3, "gamma": 0.4},
    "circular":  {"c": 1.3, "gamma": 0.3},
}


def calculate_qu_terzaghi(
    c: float, q: float, gamma_eff: float, B: float, phi: float,
    foundation_type: str,
) -> dict:
    """
    Capacidad de carga última por Terzaghi.

    Args:
        c: cohesión (kPa)
        q: sobrecarga efectiva al nivel de la base (kPa)
        gamma_eff: peso específico efectivo para el 3er sumando (kN/m³)
        B: ancho de la zapata (m) — para Terzaghi no hay B', usa B original
        phi: ángulo de fricción (°)
        foundation_type: "franja" | "cuadrada" | "circular"

    Returns:
        dict con S1, S2, S3, qu (= S1+S2+S3), factors {Nc, Nq, Ngamma, coef_c, coef_gamma}
    """
    if foundation_type == "rectangular":
        raise ValueError(
            "Terzaghi no aplica para cimentaciones rectangulares. "
            "Use Ecuación General o RNE."
        )
    if foundation_type not in TERZAGHI_COEFS:
        raise ValueError(f"Tipo de cimentación no soportado: {foundation_type}")

    bf = get_terzaghi_bearing_factors(phi)
    coefs = TERZAGHI_COEFS[foundation_type]

    S1 = coefs["c"] * c * bf["Nc"]
    S2 = q * bf["Nq"]
    S3 = coefs["gamma"] * gamma_eff * B * bf["Ngamma"]

    return {
        "S1": S1, "S2": S2, "S3": S3,
        "qu": S1 + S2 + S3,
        "factors": {
            **bf,
            "coef_c": coefs["c"],
            "coef_gamma": coefs["gamma"],
            # Para reporting uniforme: factores explícitos que valen 1 en Terzaghi
            "Fcs": coefs["c"], "Fqs": 1.0, "Fgs": coefs["gamma"] / 0.5,
            "Fcd": 1.0, "Fqd": 1.0, "Fgd": 1.0,
            "Fci": 1.0, "Fqi": 1.0, "Fgi": 1.0,
        },
    }


# ═══════════════════════════════════════════════════════════════
# 2. ECUACIÓN GENERAL — Das/DeBeer/Hansen/Meyerhof
# ═══════════════════════════════════════════════════════════════
#
# S1 = c · Nc · Fcs · Fcd · Fci
# S2 = q · Nq · Fqs · Fqd · Fqi
# S3 = ½ · γ_eff · B_eff · Nγ · Fγs · Fγd · Fγi
#
# Forma (DeBeer 1970)  ─ usa B_eff, L_eff
#   φ = 0°:  Fcs = 1 + 0.4·(B'/L');  Fqs = 1;  Fγs = 1 - 0.4·(B'/L')
#   φ > 0°:  Fcs = 1 + (B'/L')·(Nq/Nc);  Fqs = 1 + (B'/L')·tanφ;  Fγs = 1 - 0.4·(B'/L')
#
# Profundidad (Hansen 1970) ─ usa B_orig (siempre B original, no B_eff)
#   k = Df/B   si Df/B ≤ 1;  k = arctan(Df/B) [rad]   si Df/B > 1
#   φ = 0°:  Fcd = 1 + 0.4·k;  Fqd = 1;  Fγd = 1
#   φ > 0°:  Fqd = 1 + 2·tanφ·(1-sinφ)²·k
#            Fcd = Fqd - (1 - Fqd)/(Nc·tanφ)
#            Fγd = 1
#
# Inclinación (Meyerhof 1963)  ─ vía factors.get_inclination_factors

def _depth_factors_general(phi: float, Df: float, B: float, Nc: float) -> dict:
    """Factores de profundidad Hansen (Ec. General)."""
    if B <= 0:
        return {"Fcd": 1.0, "Fqd": 1.0, "Fgd": 1.0}

    ratio = Df / B
    k = ratio if ratio <= 1.0 else math.atan(ratio)

    if phi == 0:
        return {"Fcd": 1.0 + 0.4 * k, "Fqd": 1.0, "Fgd": 1.0}

    phi_rad = math.radians(phi)
    tan_phi = math.tan(phi_rad)
    sin_phi = math.sin(phi_rad)
    Fqd = 1.0 + 2.0 * tan_phi * (1.0 - sin_phi) ** 2 * k
    Fcd = Fqd - (1.0 - Fqd) / (Nc * tan_phi)
    return {"Fcd": Fcd, "Fqd": Fqd, "Fgd": 1.0}


def _shape_factors_general(phi: float, B_eff: float, L_eff: float, Nc: float, Nq: float) -> dict:
    """Factores de forma DeBeer (Ec. General). Usa B_eff, L_eff."""
    if L_eff <= 0:
        return {"Fcs": 1.0, "Fqs": 1.0, "Fgs": 1.0}

    ratio = B_eff / L_eff

    if phi == 0:
        # DeBeer estricto para φ = 0
        return {
            "Fcs": 1.0 + 0.4 * ratio,
            "Fqs": 1.0,
            "Fgs": 1.0 - 0.4 * ratio,
        }

    phi_rad = math.radians(phi)
    return {
        "Fcs": 1.0 + ratio * (Nq / Nc),
        "Fqs": 1.0 + ratio * math.tan(phi_rad),
        "Fgs": 1.0 - 0.4 * ratio,
    }


def calculate_qu_general(
    c: float, q: float, gamma_eff: float,
    B_orig: float, B_eff: float, L_eff: float,
    phi: float, beta: float, Df: float,
) -> dict:
    """
    Capacidad de carga última por la Ecuación General (Das).

    Args:
        c: cohesión (kPa)
        q: sobrecarga (kPa)
        gamma_eff: peso específico efectivo (kN/m³)
        B_orig: ancho original (m), para Df/B
        B_eff: ancho efectivo (m), para forma y S3
        L_eff: largo efectivo (m), para forma
        phi: ángulo de fricción (°)
        beta: ángulo de inclinación de carga (°)
        Df: profundidad de desplante absoluta (m)

    Returns:
        dict con S1, S2, S3, qu y factors completos
    """
    bf = get_general_bearing_factors(phi)
    sf = _shape_factors_general(phi, B_eff, L_eff, bf["Nc"], bf["Nq"])
    df_ = _depth_factors_general(phi, Df, B_orig, bf["Nc"])
    ifac = get_inclination_factors(beta, phi)

    S1 = c * bf["Nc"] * sf["Fcs"] * df_["Fcd"] * ifac["ic"]
    S2 = q * bf["Nq"] * sf["Fqs"] * df_["Fqd"] * ifac["iq"]
    S3 = 0.5 * gamma_eff * B_eff * bf["Ngamma"] * sf["Fgs"] * df_["Fgd"] * ifac["igamma"]

    return {
        "S1": S1, "S2": S2, "S3": S3,
        "qu": S1 + S2 + S3,
        "factors": {
            **bf,
            **sf,
            **df_,
            "Fci": ifac["ic"], "Fqi": ifac["iq"], "Fgi": ifac["igamma"],
        },
    }


# ═══════════════════════════════════════════════════════════════
# 3. RNE E.050 — Norma peruana
# ═══════════════════════════════════════════════════════════════
#
# S1 = sc · ic · c · Nc
# S2 = iq · q · Nq                       (sq = 1)
# S3 = ½ · sγ · iγ · γ_eff · B_eff · Nγ
#
# Forma (con dimensiones efectivas):
#   sc = 1 + 0.2·(B'/L');  sγ = 1 - 0.2·(B'/L')
# Inclinación: idéntica a Meyerhof.
# Profundidad: no se contempla.

def calculate_qu_rne(
    c: float, q: float, gamma_eff: float,
    B_eff: float, L_eff: float,
    phi: float, beta: float,
) -> dict:
    """
    Capacidad de carga última por la norma RNE E.050.

    Args:
        c, q, gamma_eff: como en calculate_qu_general
        B_eff, L_eff: dimensiones efectivas
        phi, beta: en grados

    Returns:
        dict con S1, S2, S3, qu y factors
    """
    bf = get_rne_bearing_factors(phi)

    if L_eff <= 0:
        sc = 1.0
        sgamma = 1.0
    else:
        ratio = B_eff / L_eff
        sc = 1.0 + 0.2 * ratio
        sgamma = 1.0 - 0.2 * ratio

    ifac = get_inclination_factors(beta, phi)

    S1 = sc * ifac["ic"] * c * bf["Nc"]
    S2 = ifac["iq"] * q * bf["Nq"]
    S3 = 0.5 * sgamma * ifac["igamma"] * gamma_eff * B_eff * bf["Ngamma"]

    return {
        "S1": S1, "S2": S2, "S3": S3,
        "qu": S1 + S2 + S3,
        "factors": {
            **bf,
            "Fcs": sc, "Fqs": 1.0, "Fgs": sgamma,
            "Fcd": 1.0, "Fqd": 1.0, "Fgd": 1.0,
            "Fci": ifac["ic"], "Fqi": ifac["iq"], "Fgi": ifac["igamma"],
        },
    }


# ═══════════════════════════════════════════════════════════════
# 4. APLICACIÓN DE CRITERIOS — General / RNE / RNE Corregido
# ═══════════════════════════════════════════════════════════════
#
# El tipo de suelo se decide por el φ del estrato de fundación:
#   φ ≤ 20°  →  COHESIVO  (criterio del curso)
#   φ > 20°  →  FRICCIONANTE
#
# | Criterio       | Cohesivo (φ ≤ 20°) | Friccionante (φ > 20°) |
# |----------------|---------------------|-------------------------|
# | General        | S1 + S2 + S3        | S1 + S2 + S3            |
# | RNE            | S1                  | S2 + S3                 |
# | RNE Corregido  | S1 + S2             | S2 + S3                 |

CRITERIA = ("general", "rne", "rne_corrected")


def apply_criterion(S1: float, S2: float, S3: float, soil_type: str, criterion: str) -> float:
    """
    Aplica el criterio de combinación de sumandos.

    Args:
        S1, S2, S3: sumandos del método elegido
        soil_type: "Coh" o "Fri"
        criterion: "general" | "rne" | "rne_corrected"

    Returns:
        qu correspondiente al criterio
    """
    if criterion == "general":
        return S1 + S2 + S3

    is_cohesive = (soil_type == "Coh")

    if criterion == "rne":
        return S1 if is_cohesive else (S2 + S3)

    if criterion == "rne_corrected":
        return (S1 + S2) if is_cohesive else (S2 + S3)

    raise ValueError(f"Criterio desconocido: {criterion}")


def soil_type_from_phi(phi: float) -> str:
    """Clasificación cohesivo/friccionante por φ del estrato de fundación."""
    return "Coh" if phi <= 20.0 else "Fri"
