"""
Cálculo de asentamientos para cimentaciones superficiales.

Implementa las decisiones documentadas en `MOTOR_ASENTAMIENTOS.md`
(D A.1 … D A.20) tras la consulta a NotebookLM (Das 8/9ed §9 +
Bowles + RNE E.050):

  1. Zona de influencia z̄ = min(H, 5·B)                       [D A.1]
  2. Auto-detección de H por Es ≥ 10·Es_estrato_inmediato      [D A.18]
  3. Es_eq promedio ponderado por espesor (Das Ec. 9.23)        [D A.3]
  4. μ del estrato bajo la base (NO se promedia)                [D A.4]
  5. Steinbrenner Is con fix arctan + manejo μ=0.5              [D A.5/6]
  6. Fox If interpolado bilineal (tabla Das Fig. 9.6)           [D A.7]
  7. q₀ NETA: Se y qadm_asent en presión NETA                   [D A.16]
  8. Cw (Peck/Teng/Bowles); Cw=2 si Dw≤Df                       [D A.9/15]
  9. Sc 3 casos (NC/OC1/OC2) con Δσ Simpson; bulbo parcial      [D A.19]
 10. qadm_diseño = min(qadm_falla, qadm_asent)                  [D A.12]
 11. Acoplamiento con excentricidad: NO acopla (B, L originales)[D A.13]
 12. rigid + esquina ⇒ forzar centro                            [D A.17]

Convención de unidades (SI):
  - Presiones (q₀, Es, σ', Δσ'): kPa
  - Longitudes (B, L, Df, Hc, z, H): m
  - Asentamientos (Se, Sc, S_max): m  (×1000 para mm en reporting)
  - Adimensionales: μs, e₀, OCR, Cc, Cs, Is, If, α
"""

import math
from typing import Literal, Optional


# ═══════════════════════════════════════════════════════════════
# CONSTANTES Y TABLAS DEL CURSO
# ═══════════════════════════════════════════════════════════════

GAMMA_W = 9.81    # kN/m³ — peso unitario del agua
PA = 101.325      # kPa  — presión atmosférica de referencia


# Tabla 9.1 (Das, 8va ed.) — coeficiente β para Es = β·cu en arcillas saturadas.
BETA_TABLE_DAS_9_1 = {
    "low":  {1: (600, 1500), 2: (500, 1380), 3: (580, 1200), 4: (380, 950),  5: (300, 730)},
    "mid":  {1: (300,  600), 2: (270,  550), 3: (220,  580), 4: (180, 380),  5: (150, 300)},
    "high": {1: (150,  300), 2: (120,  270), 3: (100,  220), 4: ( 90, 180),  5: ( 75, 150)},
}


# RNE E.050 — Tabla 8: Distorsión angular admisible α = δ/L
# (entrada 1/600 — peligro_porticos_diagonales — añadida desde Bjerrum 1963
# para cubrir el rango faltante respecto al documento de auditoría.)
DISTORTION_LIMITS_RNE_E050 = {
    "danio_estructural_edif_convencional":     1.0 / 150,
    "perdida_verticalidad_edif_altos_rigidos": 1.0 / 250,
    "dificultades_puentes_grua":               1.0 / 300,
    "primeras_grietas_paredes":                1.0 / 300,
    "limite_seguro_sin_grietas":               1.0 / 500,
    "cimentaciones_rigidas_circulares_anillo": 1.0 / 500,
    "peligro_porticos_diagonales":             1.0 / 600,
    "edif_rigidos_concreto_solado_1_20m":      1.0 / 650,
    "maquinaria_sensible_asentamientos":       1.0 / 750,
}


# Categorías ordenadas de la MÁS severa (β grande) a la MÁS leve (β chico).
# Cada entrada es (clave, β_limite, etiqueta legible).
BJERRUM_SEVERITY_ORDER = [
    ("danio_estructural_edif_convencional",
     1.0 / 150, "Daño estructural en edificios convencionales (β > 1/150)"),
    ("perdida_verticalidad_edif_altos_rigidos",
     1.0 / 250, "Pérdida de verticalidad en edificios altos rígidos (β > 1/250)"),
    ("dificultades_puentes_grua",
     1.0 / 300, "Dificultades con puentes-grúa / primeras grietas (β > 1/300)"),
    ("peligro_porticos_diagonales",
     1.0 / 600, "Peligro en pórticos con diagonales (β > 1/600)"),
    ("limite_seguro_sin_grietas",
     1.0 / 500, "Límite seguro sin grietas en edificios (β > 1/500)"),
    ("maquinaria_sensible_asentamientos",
     1.0 / 750, "Peligro para maquinaria sensible a asentamientos (β > 1/750)"),
]


def clasificar_bjerrum(beta: float) -> dict:
    """
    Devuelve la categoría Bjerrum/RNE más severa cuyo límite es excedido por β.

    Si β no supera ningún límite (β ≤ 1/750), devuelve "sin_riesgo".
    """
    if beta < 0:
        raise ValueError(f"β debe ser ≥ 0 (β={beta}).")
    for clave, limite, etiqueta in BJERRUM_SEVERITY_ORDER:
        if beta > limite:
            return {
                "categoria_clave": clave,
                "categoria_label": etiqueta,
                "limite_excedido": limite,
                "limite_1_over_N": (1.0 / limite) if limite > 0 else float("inf"),
            }
    return {
        "categoria_clave": "sin_riesgo",
        "categoria_label": "β dentro de todos los límites (sin riesgo)",
        "limite_excedido": None,
        "limite_1_over_N": None,
    }


def cumple_sin_grietas(beta: float) -> bool:
    """β ≤ 1/500 (límite seguro sin grietas, Bjerrum)."""
    if beta < 0:
        raise ValueError(f"β debe ser ≥ 0 (β={beta}).")
    return beta <= DISTORTION_LIMITS_RNE_E050["limite_seguro_sin_grietas"]


# ─────────────────────────────────────────────────────────────────
# Tabla Fox 1948 (Das 9ed Fig. 9.6, "Effect of Embedment") —
# digitalizada leyendo directamente las 3 figuras del libro.
#
# Las 5 curvas del gráfico (μs ∈ {0.0, 0.1, 0.3, 0.4, 0.5}) y los 9
# valores de Df/B (paso 0.25 en [0, 2]) están todos representados.
# Estructura: {L/B: {μs: {Df/B: If}}}
#
# Precisión: ±0.02 por lectura humana del ábaco. Valores entre puntos
# tabulados se obtienen por interpolación lineal anidada en Df/B → μ → L/B.
# ─────────────────────────────────────────────────────────────────
FOX_TABLE: dict = {
    1: {
        0.00: {0.00: 1.00, 0.25: 0.79, 0.50: 0.69, 0.75: 0.62, 1.00: 0.56,
               1.25: 0.53, 1.50: 0.50, 1.75: 0.47, 2.00: 0.45},
        0.10: {0.00: 1.00, 0.25: 0.81, 0.50: 0.72, 0.75: 0.65, 1.00: 0.59,
               1.25: 0.55, 1.50: 0.52, 1.75: 0.49, 2.00: 0.47},
        0.30: {0.00: 1.00, 0.25: 0.86, 0.50: 0.77, 0.75: 0.71, 1.00: 0.65,
               1.25: 0.61, 1.50: 0.58, 1.75: 0.55, 2.00: 0.53},
        0.40: {0.00: 1.00, 0.25: 0.89, 0.50: 0.81, 0.75: 0.75, 1.00: 0.70,
               1.25: 0.66, 1.50: 0.63, 1.75: 0.60, 2.00: 0.58},
        0.50: {0.00: 1.00, 0.25: 0.91, 0.50: 0.84, 0.75: 0.79, 1.00: 0.74,
               1.25: 0.70, 1.50: 0.67, 1.75: 0.65, 2.00: 0.63},
    },
    2: {
        0.00: {0.00: 1.00, 0.25: 0.85, 0.50: 0.75, 0.75: 0.69, 1.00: 0.63,
               1.25: 0.59, 1.50: 0.56, 1.75: 0.53, 2.00: 0.51},
        0.10: {0.00: 1.00, 0.25: 0.87, 0.50: 0.78, 0.75: 0.71, 1.00: 0.66,
               1.25: 0.62, 1.50: 0.59, 1.75: 0.56, 2.00: 0.53},
        0.30: {0.00: 1.00, 0.25: 0.90, 0.50: 0.83, 0.75: 0.77, 1.00: 0.72,
               1.25: 0.68, 1.50: 0.65, 1.75: 0.62, 2.00: 0.59},
        0.40: {0.00: 1.00, 0.25: 0.92, 0.50: 0.86, 0.75: 0.80, 1.00: 0.76,
               1.25: 0.72, 1.50: 0.69, 1.75: 0.66, 2.00: 0.64},
        0.50: {0.00: 1.00, 0.25: 0.94, 0.50: 0.89, 0.75: 0.84, 1.00: 0.79,
               1.25: 0.76, 1.50: 0.73, 1.75: 0.70, 2.00: 0.68},
    },
    5: {
        0.00: {0.00: 1.00, 0.25: 0.89, 0.50: 0.81, 0.75: 0.75, 1.00: 0.69,
               1.25: 0.65, 1.50: 0.62, 1.75: 0.59, 2.00: 0.56},
        0.10: {0.00: 1.00, 0.25: 0.91, 0.50: 0.83, 0.75: 0.77, 1.00: 0.71,
               1.25: 0.68, 1.50: 0.64, 1.75: 0.61, 2.00: 0.58},
        0.30: {0.00: 1.00, 0.25: 0.93, 0.50: 0.87, 0.75: 0.82, 1.00: 0.77,
               1.25: 0.74, 1.50: 0.71, 1.75: 0.68, 2.00: 0.65},
        0.40: {0.00: 1.00, 0.25: 0.95, 0.50: 0.90, 0.75: 0.85, 1.00: 0.81,
               1.25: 0.78, 1.50: 0.75, 1.75: 0.72, 2.00: 0.69},
        0.50: {0.00: 1.00, 0.25: 0.97, 0.50: 0.92, 0.75: 0.88, 1.00: 0.84,
               1.25: 0.81, 1.50: 0.78, 1.75: 0.75, 2.00: 0.73},
    },
}

FOX_LB_KEYS = sorted(FOX_TABLE.keys())                # [1, 2, 5]
FOX_MU_KEYS = sorted(FOX_TABLE[1].keys())             # [0.0, 0.1, 0.3, 0.4, 0.5]
FOX_DFB_KEYS = sorted(FOX_TABLE[1][0.30].keys())      # [0.0, 0.25, ..., 2.0]


def _lin_interp(x: float, x_lo: float, x_hi: float, y_lo: float, y_hi: float) -> float:
    """Interpolación lineal simple. Si x_lo == x_hi devuelve y_lo."""
    if x_hi == x_lo:
        return y_lo
    t = (x - x_lo) / (x_hi - x_lo)
    return y_lo + t * (y_hi - y_lo)


def _interp_in_axis(value: float, keys: list, lookup) -> float:
    """Interpolación lineal sobre `keys` (ordenadas) usando lookup(key)→float."""
    if value <= keys[0]:
        return lookup(keys[0])
    if value >= keys[-1]:
        return lookup(keys[-1])
    for i in range(len(keys) - 1):
        if keys[i] <= value <= keys[i + 1]:
            return _lin_interp(value, keys[i], keys[i + 1], lookup(keys[i]), lookup(keys[i + 1]))
    return lookup(keys[-1])  # fallback


# ═══════════════════════════════════════════════════════════════
# 1. FACTOR Is (Steinbrenner)  — Das 9ed Ecs. 9.11–9.16
# ═══════════════════════════════════════════════════════════════

def steinbrenner_Is(m_prime: float, n_prime: float, mu_s: float) -> dict:
    """
    Is = F1 + ((1−2μ)/(1−μ))·F2

    Edge cases (D A.5 / D A.6, NotebookLM):
      - Si m²·n² > m²+n²+1 ⇒ sumar π al arctan de A2 (Das nota explícita).
      - Si μ ≈ 0.5 ⇒ Is = F1 (el coeficiente (1−2μ)/(1−μ) → 0 limpio).
    """
    if m_prime <= 0 or n_prime <= 0:
        raise ValueError(f"m' y n' deben ser > 0 (m'={m_prime}, n'={n_prime}).")
    if not (0.0 <= mu_s <= 0.5):
        raise ValueError(f"μs debe estar en [0, 0.5] (μs={mu_s}).")

    m, n = m_prime, n_prime
    sqrt_m2_1     = math.sqrt(m * m + 1.0)
    sqrt_m2_n2    = math.sqrt(m * m + n * n)
    sqrt_m2_n2_1  = math.sqrt(m * m + n * n + 1.0)
    sqrt_1_n2     = math.sqrt(1.0 + n * n)

    A0 = m * math.log(
        ((1.0 + sqrt_m2_1) * sqrt_m2_n2)
        / (m * (1.0 + sqrt_m2_n2_1))
    )
    A1 = math.log(
        ((m + sqrt_m2_1) * sqrt_1_n2)
        / (m + sqrt_m2_n2_1)
    )
    A2 = m / (n * sqrt_m2_n2_1)

    # D A.5 — corrección angular: si m²n² > m²+n²+1, atan vuelve negativo
    arctan_A2 = math.atan(A2)
    arctan_correction = False
    if (m * m * n * n) > (m * m + n * n + 1.0):
        arctan_A2 += math.pi
        arctan_correction = True

    F1 = (A0 + A1) / math.pi
    F2 = (n / (2.0 * math.pi)) * arctan_A2

    # D A.6 — μ → 0.5 ⇒ Is = F1
    EPS = 1e-6
    if abs(mu_s - 0.5) < EPS:
        Is = F1
    else:
        Is = F1 + ((1.0 - 2.0 * mu_s) / (1.0 - mu_s)) * F2

    return {
        "A0": A0, "A1": A1, "A2": A2,
        "F1": F1, "F2": F2, "Is": Is,
        "arctan_correction_applied": arctan_correction,
    }


# ═══════════════════════════════════════════════════════════════
# 2. FACTOR If (Fox 1948) — interpolación bilineal del ábaco Das
# ═══════════════════════════════════════════════════════════════

def If_factor(Df: float, B: float, L: float, mu_s: float) -> dict:
    """
    Factor de profundidad de Fox 1948.

    Interpola sobre FOX_TABLE en (L/B, μ_s, Df/B) y emite warning si
    se sale del rango tabulado (Df/B > 2 o L/B > 5 ⇒ se congela al
    límite, D A.7).
    """
    if B <= 0 or L <= 0:
        raise ValueError(f"B, L deben ser > 0 (B={B}, L={L}).")
    if Df < 0:
        raise ValueError(f"Df ≥ 0 (Df={Df}).")
    if not (0.0 <= mu_s <= 0.5):
        raise ValueError(f"μs ∈ [0, 0.5] (μs={mu_s}).")

    L_over_B = L / B
    Df_over_B = Df / B
    mu_clamped = max(FOX_MU_KEYS[0], min(FOX_MU_KEYS[-1], mu_s))

    out_of_range = (Df_over_B > FOX_DFB_KEYS[-1] + 1e-9) or (L_over_B > FOX_LB_KEYS[-1] + 1e-9)

    # Helper: para un L/B fijo, devuelve If interpolado en (μ, Df/B).
    def If_at_LB(lb_key: int) -> float:
        # 1. interpolar Df/B para cada μ
        def value_at_mu(mu_key: float) -> float:
            row = FOX_TABLE[lb_key][mu_key]
            return _interp_in_axis(Df_over_B, FOX_DFB_KEYS, lambda k: row[k])
        # 2. interpolar μ
        return _interp_in_axis(mu_clamped, FOX_MU_KEYS, value_at_mu)

    # 3. interpolar L/B
    If_val = _interp_in_axis(L_over_B, FOX_LB_KEYS, If_at_LB)

    return {
        "If": If_val,
        "Df_over_B": Df_over_B,
        "L_over_B": L_over_B,
        "mu_clamped": mu_clamped,
        "out_of_range": out_of_range,
    }


# ═══════════════════════════════════════════════════════════════
# 3. AUTO-DETECCIÓN DE ESTRATO RÍGIDO H
# ═══════════════════════════════════════════════════════════════

def detect_rigid_stratum(
    strata: list, Df_abs: float, B: float, factor: float = 10.0,
) -> dict:
    """
    Encuentra H (profundidad desde la base de la zapata al estrato
    rígido) usando el criterio Bowles citado por Das (D A.18):

        Es_i ≥ factor · Es_{i-1}   (estrato inmediato anterior)

    Si no se cumple dentro de Df_abs + 5·B ⇒ H = 5·B (sin rígido).
    """
    if B <= 0 or Df_abs < 0:
        raise ValueError(f"B>0 y Df_abs≥0 (B={B}, Df_abs={Df_abs}).")

    max_search = Df_abs + 5.0 * B

    depth = 0.0
    prev_Es: Optional[float] = None
    prev_under_base = False

    for i, s in enumerate(strata):
        top = depth
        depth += s["thickness"]
        if depth <= Df_abs + 1e-9:
            # Capa enteramente arriba de la base
            continue
        if top > max_search:
            break

        Es_i = s.get("Es")
        if not isinstance(Es_i, (int, float)) or Es_i <= 0:
            prev_under_base = True
            prev_Es = None
            continue

        if prev_under_base and prev_Es is not None and Es_i >= factor * prev_Es:
            H = max(0.0, top - Df_abs)
            return {
                "H": H,
                "auto_detected": True,
                "rigid_layer_index": i,
                "Es_above": prev_Es,
                "Es_rigid": Es_i,
            }

        prev_Es = Es_i
        prev_under_base = True

    return {
        "H": 5.0 * B,
        "auto_detected": False,
        "rigid_layer_index": None,
        "Es_above": None,
        "Es_rigid": None,
    }


# ═══════════════════════════════════════════════════════════════
# 4. Es EQUIVALENTE EN PERFIL MULTI-ESTRATO  (Das Ec. 9.23)
# ═══════════════════════════════════════════════════════════════

def equivalent_Es_multilayer(
    strata: list, Df_abs: float, B: float, z_bar: float,
) -> dict:
    """
    Es_eq = Σ(Es_i · Δz_i) / Σ Δz_i  en la zona [Df_abs, Df_abs + z̄].

    `z_bar` debe ser el resultado de `min(H, 5·B)` (D A.1).
    """
    if B <= 0 or z_bar <= 0:
        raise ValueError(f"B>0, z̄>0 (B={B}, z̄={z_bar}).")

    z_top = Df_abs
    z_bot = Df_abs + z_bar

    depth = 0.0
    sum_Es_h = 0.0
    sum_h = 0.0
    contributions = []

    for i, st in enumerate(strata):
        top = depth
        bottom = depth + st["thickness"]
        depth = bottom

        eff_top = max(top, z_top)
        eff_bot = min(bottom, z_bot)
        if eff_bot <= eff_top:
            continue

        Es_i = st.get("Es")
        if not isinstance(Es_i, (int, float)) or Es_i <= 0:
            raise ValueError(
                f"Estrato {i} dentro de la zona de influencia [{z_top:.2f}, "
                f"{z_bot:.2f}] m no tiene Es válido."
            )

        h_eff = eff_bot - eff_top
        sum_Es_h += Es_i * h_eff
        sum_h += h_eff
        contributions.append({
            "stratum_index": i,
            "Es": Es_i,
            "h_eff": h_eff,
        })

    if sum_h == 0:
        raise ValueError(
            f"Zona de influencia [{z_top:.2f}, {z_bot:.2f}] m no intersecta "
            f"ningún estrato. Revise Df_abs y B."
        )

    Es_eq = sum_Es_h / sum_h
    for c in contributions:
        c["weight"] = c["h_eff"] / sum_h

    return {
        "Es_eq": Es_eq,
        "h_total_used": sum_h,
        "z_top": z_top,
        "z_bot": z_bot,
        "layers": contributions,
    }


# ═══════════════════════════════════════════════════════════════
# 5. μ DEL ESTRATO BAJO LA BASE  (D A.4)
# ═══════════════════════════════════════════════════════════════

def pick_mu_under_base(strata: list, Df_abs: float, default: float = 0.30) -> dict:
    """
    Devuelve μ del primer estrato cuya profundidad acumulada supere Df_abs.
    """
    depth = 0.0
    for i, s in enumerate(strata):
        depth += s["thickness"]
        if depth > Df_abs + 1e-6:
            mu = s.get("mu_s")
            if isinstance(mu, (int, float)) and 0.0 <= mu <= 0.5:
                return {"mu_s": float(mu), "source": "estrato_bajo_base",
                        "stratum_index": i}
            break
    return {"mu_s": default, "source": "default", "stratum_index": None}


# ═══════════════════════════════════════════════════════════════
# 6. Cw — corrección por nivel freático
# ═══════════════════════════════════════════════════════════════

CwMethod = Literal["peck", "teng", "bowles", "off"]


def water_table_correction(
    Dw: float, Df: float, B: float, method: CwMethod, has_water_table: bool,
) -> dict:
    """
    Devuelve Cw según el método elegido.

    D A.9: Cw aplica al método elástico (Terzaghi).
    D A.15: si Dw ≤ Df (NF sobre la base) ⇒ Cw forzado a 2.0 (Teng fuera
            de rango; Peck/Bowles dan 2 en el límite).
    """
    if not has_water_table or method == "off":
        return {"Cw": 1.0, "method": "off", "label": "desactivado",
                "forced_max": False, "out_of_range": False}

    if B <= 0:
        raise ValueError(f"B>0 (B={B}).")

    # D A.15
    if Dw <= Df + 1e-9:
        return {"Cw": 2.0, "method": method, "label": "NF sobre la base (Cw=2 forzado)",
                "forced_max": True, "out_of_range": False}

    # NF muy profundo (fuera del bulbo) ⇒ Cw ≈ 1
    if Dw >= Df + 5.0 * B:
        return {"Cw": 1.0, "method": method, "label": "NF fuera del bulbo",
                "forced_max": False, "out_of_range": False}

    Cw: float
    label: str
    out_of_range = False
    if method == "peck":
        Cw = 1.0 / (0.5 + 0.5 * Dw / (Df + B))
        label = "Peck-Hansen-Thornburn (1974)"
        if Cw < 1.0:
            Cw = 1.0  # Peck explícito: Cw ≥ 1
    elif method == "teng":
        Cw = 1.0 / (0.5 + 0.5 * (Dw - Df) / B)
        label = "Teng (1982)"
        Cw = min(Cw, 2.0)  # Teng: Cw ≤ 2
    elif method == "bowles":
        Cw = 2.0 - Dw / (Df + B)
        label = "Bowles (1977)"
        if Cw < 1.0:
            Cw = 1.0  # Caso conservador
    else:
        raise ValueError(f"Cw method desconocido: {method!r}")

    return {"Cw": Cw, "method": method, "label": label,
            "forced_max": False, "out_of_range": out_of_range}


# ═══════════════════════════════════════════════════════════════
# 7. ASENTAMIENTO ELÁSTICO Se   (Das Ec. 9.10)
# ═══════════════════════════════════════════════════════════════

def elastic_settlement(
    q0_net: float,
    B: float,
    L: float,
    Es: float,
    mu_s: float,
    H: float,
    Df: float = 0.0,
    point: Literal["centro", "esquina"] = "centro",
    rigid: bool = False,
) -> dict:
    """
    Asentamiento elástico inmediato (Schleicher / Steinbrenner).

    Convención:
      q0_net = NET pressure (Das §9): Q/A − γ·Df.       [D A.16]
      Centro flexible:  Se = q · 4 · (B/2) · (1−μ²)/Es · Is · If
      Esquina flexible: Se = q · 1 ·   B   · (1−μ²)/Es · Is · If
      Rígida:           Se = 0.93 · Se_centro_flexible  [D A.17]
      Rígida + esquina  ⇒ se fuerza a centro (warning).

    Devuelve dict con Se, Is, If, factores intermedios y diagnóstico.
    """
    if q0_net < 0:
        raise ValueError(f"q0_net debe ser ≥ 0 (q0_net={q0_net}).")
    if B <= 0 or L <= 0 or Es <= 0 or H <= 0:
        raise ValueError(f"B, L, Es, H deben ser > 0.")
    if L < B:
        B, L = L, B  # convención: B = menor, L = mayor

    warnings: list = []

    # D A.17 — rigid + esquina ⇒ forzar centro
    point_used = point
    if rigid and point == "esquina":
        point_used = "centro"
        warnings.append(
            "rigid=True con point='esquina' no aplica (zapata rígida se "
            "asienta uniformemente). Se fuerza point='centro'."
        )

    if point_used == "centro":
        B_used = B / 2.0
        alpha = 4
        m_prime = L / B
        n_prime = H / B_used     # = 2·H/B
    else:  # esquina
        B_used = B
        alpha = 1
        m_prime = L / B
        n_prime = H / B

    Is_data = steinbrenner_Is(m_prime, n_prime, mu_s)
    If_data = If_factor(Df, B, L, mu_s)

    Se = q0_net * alpha * B_used * (1.0 - mu_s ** 2) / Es * Is_data["Is"] * If_data["If"]

    rigid_factor: Optional[float] = None
    if rigid:
        rigid_factor = 0.93
        Se *= rigid_factor

    if If_data["out_of_range"]:
        warnings.append(
            f"Fox If fuera de rango (Df/B={If_data['Df_over_B']:.2f}, "
            f"L/B={If_data['L_over_B']:.2f}). Se usó el valor del límite "
            f"tabulado."
        )

    return {
        "Se": Se,
        "Se_mm": Se * 1000.0,
        "q0_net": q0_net,
        "alpha": alpha,
        "B_used": B_used,
        "m_prime": m_prime,
        "n_prime": n_prime,
        "point": point_used,
        "rigid": rigid,
        "rigid_factor": rigid_factor,
        **Is_data,
        "If": If_data["If"],
        "Df_over_B": If_data["Df_over_B"],
        "L_over_B": If_data["L_over_B"],
        "If_out_of_range": If_data["out_of_range"],
        "warnings": warnings,
    }


# ═══════════════════════════════════════════════════════════════
# 8. Δσ A PROFUNDIDAD z + Simpson 1/6
# ═══════════════════════════════════════════════════════════════

def delta_sigma_at_depth(
    q0_net: float, B: float, L: float, z: float,
    method: Literal["2:1"] = "2:1",
) -> float:
    """Incremento de esfuerzo vertical bajo el centro (regla 2:1, Das §8)."""
    if z < 0:
        raise ValueError(f"z ≥ 0 (z={z}).")
    if z == 0:
        return q0_net
    if method == "2:1":
        return q0_net * (B * L) / ((B + z) * (L + z))
    raise ValueError(f"method desconocido: {method!r}")


def delta_sigma_simpson(
    q0_net: float, B: float, L: float,
    z_top: float, z_mid: float, z_bot: float,
) -> dict:
    """Δσ'_av = (Δσ_t + 4·Δσ_m + Δσ_b)/6."""
    d_t = delta_sigma_at_depth(q0_net, B, L, z_top)
    d_m = delta_sigma_at_depth(q0_net, B, L, z_mid)
    d_b = delta_sigma_at_depth(q0_net, B, L, z_bot)
    return {
        "dsigma_top": d_t, "dsigma_mid": d_m, "dsigma_bot": d_b,
        "dsigma_av": (d_t + 4.0 * d_m + d_b) / 6.0,
    }


# ═══════════════════════════════════════════════════════════════
# 9. σ'₀ — presión efectiva inicial al centro del estrato
# ═══════════════════════════════════════════════════════════════

def effective_initial_stress(
    strata: list, z: float,
    has_water_table: bool = False, Dw: float = 0.0,
) -> dict:
    """
    σ'(z) integrando γ_eff por tramos (mecánica de suelos básica).
      - Tramo seco: γ_natural
      - Tramo bajo NF: γsat − γw
    """
    if z < 0:
        raise ValueError(f"z ≥ 0 (z={z}).")

    sigma_total = 0.0
    sigma_prime = 0.0
    depth = 0.0
    for st in strata:
        top = depth
        bottom = depth + st["thickness"]
        if top >= z:
            break
        eff_top = top
        eff_bot = min(bottom, z)
        gamma_nat = st["gamma"]
        gamma_sat = st.get("gammaSat", gamma_nat)
        if not has_water_table or eff_bot <= Dw:
            h = eff_bot - eff_top
            sigma_total += gamma_nat * h
            sigma_prime += gamma_nat * h
        elif eff_top >= Dw:
            h = eff_bot - eff_top
            sigma_total += gamma_sat * h
            sigma_prime += max(0.0, gamma_sat - GAMMA_W) * h
        else:
            h_dry = Dw - eff_top
            h_wet = eff_bot - Dw
            sigma_total += gamma_nat * h_dry + gamma_sat * h_wet
            sigma_prime += gamma_nat * h_dry + max(0.0, gamma_sat - GAMMA_W) * h_wet
        depth = bottom

    u = 0.0
    if has_water_table and z > Dw:
        u = GAMMA_W * (z - Dw)

    return {"sigma_prime": sigma_prime, "sigma_total": sigma_total, "u": u, "z": z}


# ═══════════════════════════════════════════════════════════════
# 10. CONSOLIDACIÓN PRIMARIA Sc (3 casos)
# ═══════════════════════════════════════════════════════════════

def consolidation_settlement(
    Hc: float,
    e0: float,
    Cc: float,
    sigma_p0: float,
    dsigma_av: float,
    Cs: Optional[float] = None,
    sigma_c: Optional[float] = None,
) -> dict:
    """
    Sc en un estrato de arcilla — 3 casos NC / OC1 / OC2.
    """
    if Hc <= 0 or e0 <= 0 or Cc <= 0 or sigma_p0 <= 0 or dsigma_av <= 0:
        raise ValueError("Hc, e0, Cc, σ'₀, Δσ' deben ser > 0.")

    sigma_final = sigma_p0 + dsigma_av
    factor_c = Cc * Hc / (1.0 + e0)

    if sigma_c is None or sigma_c <= sigma_p0:
        Sc = factor_c * math.log10(sigma_final / sigma_p0)
        return {"Sc": Sc, "Sc_mm": Sc * 1000.0, "case": "NC",
                "formula_used": "Cc·Hc/(1+e₀)·log(σf/σ'₀)",
                "sigma_p0": sigma_p0, "sigma_final": sigma_final}

    if Cs is None or Cs <= 0:
        raise ValueError("Cs requerido y > 0 para suelo sobreconsolidado.")

    factor_s = Cs * Hc / (1.0 + e0)
    if sigma_final <= sigma_c:
        Sc = factor_s * math.log10(sigma_final / sigma_p0)
        return {"Sc": Sc, "Sc_mm": Sc * 1000.0, "case": "OC1",
                "formula_used": "Cs·Hc/(1+e₀)·log(σf/σ'₀)",
                "sigma_p0": sigma_p0, "sigma_c": sigma_c, "sigma_final": sigma_final}

    Sc_rec = factor_s * math.log10(sigma_c / sigma_p0)
    Sc_com = factor_c * math.log10(sigma_final / sigma_c)
    Sc = Sc_rec + Sc_com
    return {"Sc": Sc, "Sc_mm": Sc * 1000.0, "case": "OC2",
            "formula_used": "Cs·log(σc/σ'₀)+Cc·log(σf/σc)",
            "Sc_recompresion": Sc_rec, "Sc_compresion": Sc_com,
            "sigma_p0": sigma_p0, "sigma_c": sigma_c, "sigma_final": sigma_final}


# ═══════════════════════════════════════════════════════════════
# 10.b CONSOLIDACIÓN SECUNDARIA Sc(s) — Das Ecs. 9.91–9.92
# ═══════════════════════════════════════════════════════════════
#
#   C'α = Cα / (1 + e_p)
#   Sc_s = C'α · Hc · log10(t2 / t1)
#
# Convención del curso: t1, t2 en AÑOS (entrada del usuario). e_p y Cα
# por estrato arcilloso (dependen del suelo).

def secondary_consolidation_settlement(
    Hc: float, Calpha: float, ep: float, t1: float, t2: float,
) -> dict:
    """
    Asentamiento por consolidación secundaria (creep) en un estrato arcilloso.

    Args:
        Hc:     espesor del estrato (m)
        Calpha: índice de compresión secundaria (-)
        ep:     relación de vacíos al final de la consolidación primaria (-)
        t1:     tiempo al final de la consolidación primaria (años)
        t2:     tiempo de vida útil o de evaluación (años)

    Returns:
        dict con Sc_s, Sc_s_mm, C_alpha_prime, formula_used.
    """
    if Hc <= 0:
        raise ValueError(f"Hc debe ser > 0 (Hc={Hc}).")
    if Calpha <= 0:
        raise ValueError(f"Cα debe ser > 0 (Cα={Calpha}).")
    if ep <= -1.0:
        raise ValueError(f"e_p debe ser > -1 para que (1+e_p) > 0 (e_p={ep}).")
    if t1 <= 0 or t2 <= 0:
        raise ValueError(f"t1 y t2 deben ser > 0 (t1={t1}, t2={t2}).")
    if t2 <= t1:
        raise ValueError(
            f"t2 ({t2}) debe ser > t1 ({t1}) para que log10(t2/t1) > 0."
        )

    C_alpha_prime = Calpha / (1.0 + ep)
    Sc_s = C_alpha_prime * Hc * math.log10(t2 / t1)
    return {
        "Sc_s": Sc_s,
        "Sc_s_mm": Sc_s * 1000.0,
        "C_alpha_prime": C_alpha_prime,
        "Hc": Hc,
        "t1": t1,
        "t2": t2,
        "formula_used": "C'α·Hc·log10(t2/t1) con C'α = Cα/(1+e_p)",
    }


# ═══════════════════════════════════════════════════════════════
# 11. CORRELACIONES Es (Das §9)
# ═══════════════════════════════════════════════════════════════

# D A.20 — Kulhawy & Mayne 1990: Es/pa = α·N60
KM_ALPHA_TABLE = {
    "with_fines":      5.0,
    "clean_NC":       10.0,
    "clean_OC":       15.0,
}


def Es_from_N60_kulhawy_mayne(
    N60: float,
    soil_kind: Literal["with_fines", "clean_NC", "clean_OC"] = "clean_NC",
    pa: float = PA,
) -> float:
    """Es = α · N60 · pa  (Das §9, Kulhawy-Mayne 1990)."""
    if N60 <= 0 or pa <= 0:
        raise ValueError(f"N60 y pa > 0 (N60={N60}, pa={pa}).")
    alpha = KM_ALPHA_TABLE[soil_kind]
    return alpha * N60 * pa


def Es_from_cu(cu: float, beta: float) -> float:
    """Es = β·cu  (Das Tabla 9.1, arcillas saturadas)."""
    if cu <= 0 or beta <= 0:
        raise ValueError("cu y β > 0.")
    return beta * cu


def beta_from_table(
    PI: float, OCR: float,
    mode: Literal["min", "max", "avg"] = "avg",
) -> float:
    if PI < 0 or OCR <= 0:
        raise ValueError(f"PI≥0 y OCR>0 (PI={PI}, OCR={OCR}).")
    band = "low" if PI < 30 else ("mid" if PI <= 50 else "high")
    ocr_key = max(1, min(5, round(OCR)))
    b_min, b_max = BETA_TABLE_DAS_9_1[band][ocr_key]
    if mode == "min":
        return float(b_min)
    if mode == "max":
        return float(b_max)
    return 0.5 * (b_min + b_max)


# ═══════════════════════════════════════════════════════════════
# 12. qadm POR ASENTAMIENTO  (inversión lineal)
# ═══════════════════════════════════════════════════════════════

def qadm_from_settlement_limit(
    Se_max: float, B: float, L: float,
    Es: float, mu_s: float, H: float, Df: float = 0.0,
    point: Literal["centro", "esquina"] = "centro",
    rigid: bool = False,
    Cw: float = 1.0,
) -> dict:
    """
    qadm_NETA = Se_max / [α·B_used·(1−μ²)/Es · Is · If · Cw].

    Se calcula con q=1 kPa y se escala (lineal).
    """
    if Se_max <= 0:
        raise ValueError("Se_max > 0.")
    if Cw <= 0:
        raise ValueError("Cw > 0.")

    sample = elastic_settlement(
        q0_net=1.0, B=B, L=L, Es=Es, mu_s=mu_s, H=H, Df=Df,
        point=point, rigid=rigid,
    )
    Se_per_kPa = sample["Se"] * Cw
    if Se_per_kPa <= 0:
        raise ValueError("Se per unit no positivo; revisar parámetros.")

    qadm = Se_max / Se_per_kPa
    return {
        "qadm_settlement": qadm,
        "qadm_net": qadm,
        "Se_max": Se_max,
        "Se_max_mm": Se_max * 1000.0,
        "Se_per_kPa": Se_per_kPa,
        "Cw_applied": Cw,
        "Is": sample["Is"],
        "If": sample["If"],
        "point": sample["point"],
        "rigid": rigid,
    }


# ═══════════════════════════════════════════════════════════════
# 13. DISTORSIÓN ANGULAR (RNE E.050)
# ═══════════════════════════════════════════════════════════════

def angular_distortion(delta_a: float, delta_b: float, L_columns: float) -> dict:
    if L_columns <= 0:
        raise ValueError("L_columns > 0.")
    delta = abs(delta_b - delta_a)
    alpha = delta / L_columns
    exceeded = [name for name, lim in DISTORTION_LIMITS_RNE_E050.items() if alpha > lim]
    return {
        "delta_diferencial": delta,
        "alpha": alpha,
        "alpha_1_over_X": (1.0 / alpha) if alpha > 0 else float("inf"),
        "limits_exceeded": exceeded,
        "is_safe_no_cracks": alpha <= DISTORTION_LIMITS_RNE_E050["limite_seguro_sin_grietas"],
        "is_below_structural_damage": alpha <= DISTORTION_LIMITS_RNE_E050["danio_estructural_edif_convencional"],
    }


# ═══════════════════════════════════════════════════════════════
# 14. CRITERIO FINAL qadm DE DISEÑO  (D A.12)
# ═══════════════════════════════════════════════════════════════

def design_qadm(qadm_falla: float, qadm_settlement: float) -> dict:
    """qadm_diseño = MIN(qadm_falla, qadm_asentamiento)."""
    if qadm_falla <= qadm_settlement:
        return {"qadm_diseno": qadm_falla, "criterio_gobernante": "falla_por_corte",
                "qadm_falla": qadm_falla, "qadm_settlement": qadm_settlement}
    return {"qadm_diseno": qadm_settlement, "criterio_gobernante": "asentamiento",
            "qadm_falla": qadm_falla, "qadm_settlement": qadm_settlement}


# ═══════════════════════════════════════════════════════════════
# 15. ENTRY POINT — cálculo completo
# ═══════════════════════════════════════════════════════════════

def calculate_total_settlement(
    foundation: dict,
    strata: list,
    Df_abs: float,
    settlement_params: dict,
    conditions: Optional[dict] = None,
    qadm_falla: Optional[float] = None,
    q_aplicada_net: Optional[float] = None,
) -> dict:
    """
    Orquesta el cálculo de asentamiento siguiendo el flujo del §17
    de `MOTOR_ASENTAMIENTOS.md`.

    Args:
        foundation: {B, L, Df}
        strata:     [{thickness, gamma, gammaSat, Es?, mu_s?, is_clay?,
                      Cc?, Cs?, e0?, sigma_c?}, ...]
        Df_abs:     profundidad absoluta de la base = Df + Ds (sótano)
        settlement_params: ver `MOTOR_ASENTAMIENTOS.md §1.2`
        conditions: {hasWaterTable, waterTableDepth, hasBasement,
                      basementDepth} — opcional, para Cw y σ'₀
        qadm_falla: kPa neta — para min(falla, asent). Si None ⇒ se omite
                     ese paso.
        q_aplicada_net: kPa neta — para chequeo S_total ≤ S_max y FS_real.
    """
    B = foundation["B"]
    L = foundation["L"]
    Df = foundation.get("Df", 0.0)
    if conditions is None:
        conditions = {"hasWaterTable": False, "waterTableDepth": 0.0}

    warnings: list = []

    # ── 1. H (auto o manual) ──────────────────────────────────────
    H_manual = settlement_params.get("H_rigid")
    if isinstance(H_manual, (int, float)) and H_manual > 0:
        H_info = {"H": float(H_manual), "auto_detected": False,
                  "rigid_layer_index": None, "Es_above": None, "Es_rigid": None}
    else:
        H_info = detect_rigid_stratum(strata, Df_abs, B)
        if not H_info["auto_detected"]:
            warnings.append("No se detectó estrato rígido — H = 5·B.")
    H = H_info["H"]

    # ── 2. z̄ ─────────────────────────────────────────────────────
    z_bar = min(H, 5.0 * B)

    # ── 3. Es_eq ──────────────────────────────────────────────────
    Es_data = equivalent_Es_multilayer(strata, Df_abs, B, z_bar)
    Es_eq = Es_data["Es_eq"]

    # ── 4. μ del estrato bajo la base (D A.4) ─────────────────────
    mu_override = settlement_params.get("mu_s_override")
    if isinstance(mu_override, (int, float)) and 0.0 <= mu_override <= 0.5:
        mu_info = {"mu_s": float(mu_override), "source": "override",
                   "stratum_index": None}
    else:
        mu_info = pick_mu_under_base(strata, Df_abs)
    mu_used = mu_info["mu_s"]

    # ── 5. Cw ─────────────────────────────────────────────────────
    Cw_method: CwMethod = settlement_params.get("Cw_method", "peck")
    Cw_data = water_table_correction(
        Dw=conditions.get("waterTableDepth", 0.0),
        Df=Df_abs,
        B=B,
        method=Cw_method,
        has_water_table=conditions.get("hasWaterTable", False),
    )
    if Cw_data["forced_max"]:
        warnings.append("NF sobre la base de la zapata — Cw forzado a 2 (Terzaghi).")

    # ── 6. Se (si q_aplicada_net dada) ────────────────────────────
    point = settlement_params.get("point", "centro")
    rigid = settlement_params.get("rigid", False)

    se_data = None
    if isinstance(q_aplicada_net, (int, float)) and q_aplicada_net > 0:
        se_data = elastic_settlement(
            q0_net=q_aplicada_net, B=B, L=L, Es=Es_eq, mu_s=mu_used, H=H,
            Df=Df, point=point, rigid=rigid,
        )
        warnings.extend(se_data.pop("warnings", []))
        # Aplicar Cw a Se (D A.9)
        se_data["Se_corr"] = se_data["Se"] * Cw_data["Cw"]
        se_data["Se_corr_mm"] = se_data["Se_corr"] * 1000.0

    # ── 7. Sc por estratos arcillosos (opcional) ──────────────────
    sc_layers: list = []
    scs_layers: list = []
    Sc_total = 0.0
    Sc_s_total = 0.0

    # ── 7.0 Parámetros de consolidación secundaria (Sc_s) ─────────
    # t1, t2 son globales (vida útil de la obra). Cα y e_p son por
    # estrato arcilloso. Si t1 o t2 no se proveen, Sc_s se omite.
    t1_global = settlement_params.get("t1")
    t2_global = settlement_params.get("t2")
    secondary_enabled = (
        isinstance(t1_global, (int, float)) and t1_global > 0
        and isinstance(t2_global, (int, float)) and t2_global > t1_global
    )

    # Kcr Skempton–Bjerrum: ajuste 3D de la consolidación primaria.
    # Default 1.0. TODO: digitalizar el ábaco para selección automática
    # según f(B/H, geometría, OCR). Hoy se acepta override manual.
    Kcr = settlement_params.get("Kcr", 1.0)
    if not isinstance(Kcr, (int, float)) or Kcr <= 0:
        raise ValueError(f"Kcr debe ser > 0 (Kcr={Kcr}).")

    if settlement_params.get("consolidation", False) and isinstance(q_aplicada_net, (int, float)) and q_aplicada_net > 0:
        # Recorrer estratos arcillosos en la zona de influencia
        depth = 0.0
        for i, st in enumerate(strata):
            top = depth
            bot = depth + st["thickness"]
            depth = bot
            if not st.get("is_clay", False):
                continue
            # Intersección con [Df_abs, Df_abs + z_bar] (D A.19)
            eff_top = max(top, Df_abs)
            eff_bot = min(bot, Df_abs + z_bar)
            if eff_bot <= eff_top:
                continue

            Hc = eff_bot - eff_top
            z_t_under = eff_top - Df_abs
            z_b_under = eff_bot - Df_abs
            z_m_under = 0.5 * (z_t_under + z_b_under)
            z_mid_abs = 0.5 * (eff_top + eff_bot)

            ds = delta_sigma_simpson(q_aplicada_net, B, L,
                                     z_t_under, z_m_under, z_b_under)

            sigma_p0 = effective_initial_stress(
                strata, z_mid_abs,
                has_water_table=conditions.get("hasWaterTable", False),
                Dw=conditions.get("waterTableDepth", 0.0),
            )["sigma_prime"]

            if sigma_p0 <= 0:
                warnings.append(
                    f"Estrato {i}: σ'₀={sigma_p0:.2f} kPa no positivo. "
                    f"Se omite Sc."
                )
                continue

            try:
                sc = consolidation_settlement(
                    Hc=Hc,
                    e0=st["e0"],
                    Cc=st["Cc"],
                    sigma_p0=sigma_p0,
                    dsigma_av=ds["dsigma_av"],
                    Cs=st.get("Cs"),
                    sigma_c=st.get("sigma_c"),
                )
                sc["stratum_index"] = i
                sc["Hc_used"] = Hc
                sc["dsigma_av"] = ds["dsigma_av"]
                sc_layers.append(sc)
                Sc_total += sc["Sc"]
            except (KeyError, ValueError) as e:
                warnings.append(
                    f"Estrato {i}: no se pudo calcular Sc ({type(e).__name__}: {e})."
                )
                continue

            # ── 7.b Sc_s (consolidación secundaria) — Das Ecs. 9.91–9.92
            if secondary_enabled:
                Calpha = st.get("Calpha")
                ep = st.get("ep")
                if Calpha is None or ep is None:
                    warnings.append(
                        f"Estrato {i}: t1/t2 globales presentes pero faltan "
                        f"Cα y/o e_p en el estrato. Se omite Sc_s."
                    )
                else:
                    try:
                        scs = secondary_consolidation_settlement(
                            Hc=Hc, Calpha=Calpha, ep=ep,
                            t1=t1_global, t2=t2_global,
                        )
                        scs["stratum_index"] = i
                        scs_layers.append(scs)
                        Sc_s_total += scs["Sc_s"]
                    except ValueError as e:
                        warnings.append(
                            f"Estrato {i}: no se pudo calcular Sc_s ({e})."
                        )

    # ── 7.c Ajuste Skempton–Bjerrum 3D sobre Sc primario ──────────
    Sc_total_oed = Sc_total
    Sc_total *= Kcr

    # ── 8. S_total = Se + Sc_p + Sc_s ─────────────────────────────
    S_max = settlement_params.get("S_max", 0.025)
    Se_corr = se_data["Se_corr"] if se_data else 0.0
    S_total = Se_corr + Sc_total + Sc_s_total
    Se_ok = S_total <= S_max

    # ── 9. qadm_asentamiento (inversión) ──────────────────────────
    qadm_data = qadm_from_settlement_limit(
        Se_max=S_max, B=B, L=L, Es=Es_eq, mu_s=mu_used, H=H, Df=Df,
        point=point, rigid=rigid, Cw=Cw_data["Cw"],
    )
    qadm_asent = qadm_data["qadm_settlement"]
    if se_data:
        # propagar warnings de Fox If
        if se_data.get("If_out_of_range"):
            warnings.append("Fox If fuera de rango — qadm puede ser conservador.")

    # ── 10. qadm_diseño = min(falla, asent) ───────────────────────
    design_block = None
    FS_real_falla = None
    if isinstance(qadm_falla, (int, float)) and qadm_falla > 0:
        design_block = design_qadm(qadm_falla, qadm_asent)
        if isinstance(q_aplicada_net, (int, float)) and q_aplicada_net > 0:
            FS_real_falla = qadm_falla / q_aplicada_net

    return {
        "z_bar": z_bar,
        "H": H,
        "H_auto_detected": H_info["auto_detected"],
        "H_rigid_layer_index": H_info["rigid_layer_index"],
        "Es_eq": Es_eq,
        "Es_data": Es_data,
        "mu_used": mu_used,
        "mu_source": mu_info["source"],

        "Cw": Cw_data["Cw"],
        "Cw_method": Cw_data["method"],
        "Cw_label": Cw_data["label"],
        "Cw_forced_max": Cw_data["forced_max"],
        "Cw_applied": Cw_data["Cw"] != 1.0,

        "point": point,
        "rigid": rigid,

        "elastic": se_data,                  # None si q_aplicada_net no provista
        "Se": (se_data["Se"] if se_data else None),
        "Se_mm": (se_data["Se_mm"] if se_data else None),
        "Se_corr": (se_data["Se_corr"] if se_data else None),
        "Se_corr_mm": (se_data["Se_corr_mm"] if se_data else None),

        "consolidation_layers": sc_layers,
        "Sc": Sc_total if sc_layers else None,
        "Sc_mm": (Sc_total * 1000.0) if sc_layers else None,
        "Sc_oedometrico": Sc_total_oed if sc_layers else None,
        "Sc_oedometrico_mm": (Sc_total_oed * 1000.0) if sc_layers else None,
        "Kcr": Kcr,

        "secondary_layers": scs_layers,
        "Sc_s": Sc_s_total if scs_layers else None,
        "Sc_s_mm": (Sc_s_total * 1000.0) if scs_layers else None,
        "t1": t1_global if secondary_enabled else None,
        "t2": t2_global if secondary_enabled else None,

        "S_total": S_total if se_data else None,
        "S_total_mm": (S_total * 1000.0) if se_data else None,
        "S_max": S_max,
        "S_max_mm": S_max * 1000.0,
        "Se_ok": Se_ok if se_data else None,

        "qadm_settlement": qadm_asent,
        "qadm_falla": qadm_falla,
        "design": design_block,              # None si qadm_falla no provista
        "FS_real_falla": FS_real_falla,

        "warnings": warnings,
    }


# ═══════════════════════════════════════════════════════════════
# 16. ITERACIÓN PARAMÉTRICA qadm(B)
# ═══════════════════════════════════════════════════════════════

def iterate_qadm_vs_B(
    B_start: float, B_end: float, B_step: float,
    foundation: dict, strata: list, Df_abs: float,
    settlement_params: dict, conditions: Optional[dict] = None,
    qadm_falla_fn=None,
    q_aplicada_net: Optional[float] = None,
) -> dict:
    """
    Iterar B, recomputando Es_eq, z̄ y demás (D A.10).

    `qadm_falla_fn(B)` opcional: si se provee, devuelve qadm_falla para
    cada B; sino, el output `qadm_falla` queda en None.
    """
    if B_start <= 0 or B_end < B_start or B_step <= 0:
        raise ValueError("B_start>0, B_end≥B_start, B_step>0.")

    rows = []
    B = B_start
    while B <= B_end + 1e-9:
        f_b = dict(foundation)
        f_b["B"] = B
        # Mantener L = foundation['L'] si fue dado; si no, L = B (cuadrada)
        if "L" not in f_b:
            f_b["L"] = B

        qadm_falla = None
        if callable(qadm_falla_fn):
            qadm_falla = qadm_falla_fn(B)

        r = calculate_total_settlement(
            foundation=f_b,
            strata=strata,
            Df_abs=Df_abs,
            settlement_params=settlement_params,
            conditions=conditions,
            qadm_falla=qadm_falla,
            q_aplicada_net=q_aplicada_net,
        )
        rows.append({
            "B": B,
            "L": f_b["L"],
            "z_bar": r["z_bar"],
            "Es_eq": r["Es_eq"],
            "mu_used": r["mu_used"],
            "Cw": r["Cw"],
            "qadm_settlement": r["qadm_settlement"],
            "qadm_falla": r.get("qadm_falla"),
            "qadm_diseno": (r["design"]["qadm_diseno"] if r["design"] else None),
            "criterio_gobernante": (r["design"]["criterio_gobernante"] if r["design"] else None),
            "S_total_mm": r.get("S_total_mm"),
            "Se_ok": r.get("Se_ok"),
        })
        B += B_step

    return {
        "rows": rows,
        "B_start": B_start, "B_end": B_end, "B_step": B_step,
    }
