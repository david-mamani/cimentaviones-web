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
    B_eff = B - 2·e2 y L_eff = L - 2·e1 (con intercambio si B_eff > L_eff).
    Se usan en factores de forma y en el tercer sumando (S3 = ½·γ·B_eff·Nγ·…).
"""
import math
from .factors import (
    get_terzaghi_bearing_factors,
    get_general_bearing_factors,
    get_rne_bearing_factors,
    get_inclination_factors,
)

TERZAGHI_COEFS = {
    "cuadrada": {"c": 1.3, "gamma": 0.4},
}


def calculate_qu_terzaghi(
    c: float,
    q: float,
    gamma_eff: float,
    B: float,
    phi: float,
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
    S1_phi0 = coefs["c"] * c * 5.70
    S2_phi0 = q * 1.00
    return {
        "S1": S1,
        "S2": S2,
        "S3": S3,
        "S1_phi0": S1_phi0,
        "S2_phi0": S2_phi0,
        "qu": S1 + S2 + S3,
        "factors": {
            **bf,
            "coef_c": coefs["c"],
            "coef_gamma": coefs["gamma"],
            "Fcs": coefs["c"],
            "Fqs": 1.0,
            "Fgs": coefs["gamma"] / 0.5,
            "Fcd": 1.0,
            "Fqd": 1.0,
            "Fgd": 1.0,
            "Fci": 1.0,
            "Fqi": 1.0,
            "Fgi": 1.0,
        },
    }


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


def _shape_factors_general(
    phi: float, B_eff: float, L_eff: float, Nc: float, Nq: float
) -> dict:
    """
    Factores de forma DeBeer (Ec. General). Usa B_eff, L_eff (Meyerhof).
    Convención del curso: aplicar la fórmula general (sin caso especial φ=0).
    Cuando φ=0:  Nq=1, Nc=5.14 → Fcs = 1 + (B'/L')·(1/5.14) ≈ 1 + 0.195·(B'/L'),
                 que coincide con Das Tabla 4.2 (coef. 0.2). El "0.4" de Meyerhof
                 no se usa.
    Cuando φ=0:  tan(0)=0 → Fqs = 1 automático.
    """
    if L_eff <= 0:
        return {"Fcs": 1.0, "Fqs": 1.0, "Fgs": 1.0}
    ratio = B_eff / L_eff
    phi_rad = math.radians(phi)
    return {
        "Fcs": 1.0 + ratio * (Nq / Nc),
        "Fqs": 1.0 + ratio * math.tan(phi_rad),
        "Fgs": 1.0 - 0.4 * ratio,
    }


def calculate_qu_general(
    c: float,
    q: float,
    gamma_eff: float,
    B_orig: float,
    B_eff: float,
    L_eff: float,
    phi: float,
    beta: float,
    Df: float,
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
    S3 = (
        0.5 * gamma_eff * B_eff * bf["Ngamma"] * sf["Fgs"] * df_["Fgd"] * ifac["igamma"]
    )
    Nc_phi0 = 5.14
    Nq_phi0 = 1.0
    if L_eff > 0:
        Fcs_phi0 = 1.0 + (B_eff / L_eff) * (Nq_phi0 / Nc_phi0)
    else:
        Fcs_phi0 = 1.0
    Fqs_phi0 = 1.0
    if B_orig > 0:
        ratio_phi0 = Df / B_orig
        k_phi0 = ratio_phi0 if ratio_phi0 <= 1.0 else math.atan(ratio_phi0)
        Fcd_phi0 = 1.0 + 0.4 * k_phi0
    else:
        Fcd_phi0 = 1.0
    Fqd_phi0 = 1.0
    S1_phi0 = c * Nc_phi0 * Fcs_phi0 * Fcd_phi0 * ifac["ic"]
    S2_phi0 = q * Nq_phi0 * Fqs_phi0 * Fqd_phi0 * ifac["iq"]
    return {
        "S1": S1,
        "S2": S2,
        "S3": S3,
        "S1_phi0": S1_phi0,
        "S2_phi0": S2_phi0,
        "qu": S1 + S2 + S3,
        "factors": {
            **bf,
            **sf,
            **df_,
            "Fci": ifac["ic"],
            "Fqi": ifac["iq"],
            "Fgi": ifac["igamma"],
        },
    }


def calculate_qu_rne(
    c: float,
    q: float,
    gamma_eff: float,
    B_eff: float,
    L_eff: float,
    phi: float,
    beta: float,
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
    Nc_phi0 = 5.14
    Nq_phi0 = 1.0
    S1_phi0 = sc * ifac["ic"] * c * Nc_phi0
    S2_phi0 = ifac["iq"] * q * Nq_phi0
    return {
        "S1": S1,
        "S2": S2,
        "S3": S3,
        "S1_phi0": S1_phi0,
        "S2_phi0": S2_phi0,
        "qu": S1 + S2 + S3,
        "factors": {
            **bf,
            "Fcs": sc,
            "Fqs": 1.0,
            "Fgs": sgamma,
            "Fcd": 1.0,
            "Fqd": 1.0,
            "Fgd": 1.0,
            "Fci": ifac["ic"],
            "Fqi": ifac["iq"],
            "Fgi": ifac["igamma"],
        },
    }


CRITERIA = ("general", "rne", "rne_corrected")


def apply_criterion(
    S1: float,
    S2: float,
    S3: float,
    soil_type: str,
    criterion: str,
    S1_phi0: float = None,
    S2_phi0: float = None,
) -> float:
    """
    Aplica el criterio de combinación de sumandos.
    Para criterios RNE y RNE Corregido en suelo Cohesivo, se usan los
    sumandos con φ=0 forzado (S1_phi0, S2_phi0) cuando se proveen, según
    el Art. 20.2 de la Norma E.050. Si no se proveen, se usa el fallback
    S1, S2 (comportamiento legacy, conserva compatibilidad de tests).
    Args:
        S1, S2, S3: sumandos del método elegido (con φ real)
        soil_type: "Coh" o "Fri"
        criterion: "general" | "rne" | "rne_corrected"
        S1_phi0, S2_phi0: sumandos con φ=0 forzado (opcionales)
    Returns:
        qu correspondiente al criterio
    """
    if criterion == "general":
        return S1 + S2 + S3
    is_cohesive = soil_type == "Coh"
    s1_use = S1_phi0 if S1_phi0 is not None else S1
    s2_use = S2_phi0 if S2_phi0 is not None else S2
    if criterion == "rne":
        return s1_use if is_cohesive else (S2 + S3)
    if criterion == "rne_corrected":
        return (s1_use + s2_use) if is_cohesive else (S2 + S3)
    raise ValueError(f"Criterio desconocido: {criterion}")


def soil_type_from_phi(phi: float) -> str:
    """Clasificación cohesivo/friccionante por φ del estrato de fundación."""
    return "Coh" if phi <= 20.0 else "Fri"
