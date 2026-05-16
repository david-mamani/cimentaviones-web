"""
Capacidad de carga de cimentaciones superficiales — Función principal.

Pipeline de 13 bloques (alineado con el flujo de cálculo documentado):

  1. Lectura y clasificación de datos
  2. Nivel de referencia y estrato de fundación (Df_abs = Ds + Df)
  3. Sobrecarga efectiva q
  4. Corrección por nivel freático → γ_eff
  5. Factores Nc, Nq, Nγ por método
  6. Validación geometría/método (Terzaghi rechaza rectangular)
  7. Factores correctivos (forma, profundidad, inclinación) según método
  8. Sumandos S1, S2, S3 por método
  9. Aplicación de criterios (General, RNE, RNE-Corregido) → matriz 3×3
 10. Presión admisible qadm = qu / FS y carga máxima Qu_max
 11. Excentricidad: B', L', A', kern, qmax/qmin, FS_real
 12. Validación final y salida
 13. Iteraciones (manejado en parametric_iterations.py)

Salida:
  - Campos "tradicionales" (qu, qa, qnet, qaNet, Qmax, F1/F2/F3, factores)
    correspondientes al método+criterio "principal" (método elegido + criterio
    General). Esto preserva compatibilidad con markdown_generator y latex_generator.
  - methodCriteriaMatrix: dict con los 3 métodos × 3 criterios = 9 combinaciones.
  - eccentricity: información del bloque 11 (None si e1=e2=0 y sin Q).
"""

from .water_table import apply_water_table_correction
from .methods import (
    calculate_qu_terzaghi,
    calculate_qu_general,
    calculate_qu_rne,
    apply_criterion,
    soil_type_from_phi,
    CRITERIA,
)


# Conversiones de presión kPa → otras unidades
# 1 kPa = 1/9.81 t/m²; 1 t/m² = 0.1 kg/cm² → 1 kPa = 0.01020 kg/cm²
_KPA_TO_TM2 = 1.0 / 9.81
_KPA_TO_KGCM2 = _KPA_TO_TM2 * 0.1


def find_design_stratum(strata: list, effective_depth: float) -> dict:
    """
    Determina el estrato sobre el que descansa la zapata.

    Recorre los estratos sumando espesores. El primero cuya profundidad
    acumulada excede effective_depth (con tolerancia 1e-6) es el estrato
    de diseño.

    Si effective_depth excede la suma total de espesores, lanza ValueError
    (la propuesta exige error fatal, no fallback).
    """
    depth = 0.0
    for i, stratum in enumerate(strata):
        depth += stratum["thickness"]
        if depth > effective_depth + 1e-6:
            return {"index": i, "stratum": stratum}

    raise ValueError(
        f"Df_abs ({effective_depth:.2f} m) supera la profundidad total del "
        f"perfil estratigráfico ({depth:.2f} m). Agregue estratos o reduzca Df."
    )


def _compute_effective_dimensions(B: float, L: float, e1: float, e2: float) -> dict:
    """
    Dimensiones efectivas Meyerhof: B' = B - 2e1, L' = L - 2e2.
    Si B' > L', se intercambian (B' siempre es la dimensión menor).
    """
    B_eff = B - 2.0 * e1
    L_eff = L - 2.0 * e2

    if B_eff <= 0 or L_eff <= 0:
        raise ValueError(
            f"Excentricidad excesiva: B'={B_eff:.3f}m, L'={L_eff:.3f}m. "
            f"El área efectiva es nula o negativa."
        )

    if B_eff > L_eff:
        B_eff, L_eff = L_eff, B_eff

    return {"B_eff": B_eff, "L_eff": L_eff, "A_eff": B_eff * L_eff}


def _extreme_pressures_trapezoidal(Q: float, B: float, L: float, e1: float, e2: float) -> dict:
    """qmax, qmin para régimen trapezoidal (kern central, e1≤B/6 y e2≤L/6)."""
    base = Q / (B * L)
    term_e1 = 6.0 * e1 / B
    term_e2 = 6.0 * e2 / L
    qmax = base * (1.0 + term_e1 + term_e2)
    qmin = base * (1.0 - term_e1 - term_e2)
    return {"qmax": qmax, "qmin": qmin}


def _extreme_pressures_triangular(Q: float, B: float, L: float, e1: float) -> dict:
    """qmax para régimen triangular (excentricidad en B, e1 > B/6); qmin = 0."""
    qmax = 4.0 * Q / (3.0 * L * (B - 2.0 * e1))
    return {"qmax": qmax, "qmin": 0.0}


def _enrich_pressure(qu: float, FS: float, B_for_area: float, L_for_area: float) -> dict:
    """Devuelve qu y qa con todas las conversiones de unidad."""
    qa = qu / FS if FS > 0 else 0.0
    return {
        "qu": qu,
        "qu_kPa": qu,
        "qu_tm2": qu * _KPA_TO_TM2,
        "qu_kgcm2": qu * _KPA_TO_KGCM2,
        "qa": qa,
        "qa_kPa": qa,
        "qa_tm2": qa * _KPA_TO_TM2,
        "qa_kgcm2": qa * _KPA_TO_KGCM2,
        "Qmax": qa * B_for_area * L_for_area,
    }


def _build_method_block(method_result: dict, soil_type: str, FS: float,
                         B_for_area: float, L_for_area: float) -> dict:
    """
    Para un método (terzaghi/general/rne), construye:
      - S1, S2, S3, factors
      - criteria: {general: {qu, qa, …}, rne: {…}, rne_corrected: {…}}
    """
    S1, S2, S3 = method_result["S1"], method_result["S2"], method_result["S3"]
    criteria = {}
    for crit in CRITERIA:
        qu_c = apply_criterion(S1, S2, S3, soil_type, crit)
        criteria[crit] = _enrich_pressure(qu_c, FS, B_for_area, L_for_area)
    return {
        "S1": S1, "S2": S2, "S3": S3,
        "qu": method_result["qu"],  # ≡ criteria["general"]["qu"]
        "factors": method_result["factors"],
        "criteria": criteria,
    }


def calculate_bearing_capacity(input_data: dict) -> dict:
    """
    Cálculo completo de capacidad portante para una cimentación superficial.

    Args:
        input_data: {
            foundation: {type, B, L, Df, FS, beta, e1?, e2?, Q?},
            strata: [{thickness, gamma, gammaSat, c, phi}, …],
            conditions: {hasWaterTable, waterTableDepth, hasBasement, basementDepth},
            method: "terzaghi" | "general" | "rne"
        }

    Returns:
        Resultado completo con compatibilidad legacy + matriz 3×3 + excentricidad.
    """
    # ── Bloque 1: Lectura ─────────────────────────────────────────
    foundation = input_data["foundation"]
    strata = input_data["strata"]
    conditions = input_data["conditions"]
    method = input_data["method"]

    if not strata:
        raise ValueError("Se requiere al menos un estrato de suelo.")

    f_type = foundation["type"]
    B = foundation["B"]
    L = foundation["L"]
    Df = foundation["Df"]
    FS = foundation["FS"]
    beta = foundation.get("beta", 0.0) or 0.0
    e1 = foundation.get("e1", 0.0) or 0.0
    e2 = foundation.get("e2", 0.0) or 0.0
    Q_applied = foundation.get("Q")  # opcional

    if B <= 0:
        raise ValueError(f"El ancho B ({B}) debe ser mayor a 0.")
    if L <= 0:
        raise ValueError(f"La longitud L ({L}) debe ser mayor a 0.")
    if FS <= 0:
        raise ValueError(f"El factor de seguridad FS ({FS}) debe ser mayor a 0.")
    if e1 < 0 or e2 < 0:
        raise ValueError(f"Las excentricidades deben ser ≥ 0 (e1={e1}, e2={e2}).")

    warnings: list[str] = []

    # ── Bloque 2: Df absoluto y estrato de fundación ──────────────
    has_basement = conditions["hasBasement"]
    Ds = conditions["basementDepth"] if has_basement else 0.0
    Df_abs = Ds + Df

    design = find_design_stratum(strata, Df_abs)
    design_index = design["index"]
    design_stratum = design["stratum"]

    soil_type = soil_type_from_phi(design_stratum["phi"])
    phi = design_stratum["phi"]
    c = design_stratum["c"]

    # Validaciones físicas del estrato
    if design_stratum["gammaSat"] < design_stratum["gamma"]:
        warnings.append(
            f"γsat ({design_stratum['gammaSat']}) < γ ({design_stratum['gamma']}). "
            f"Físicamente imposible: revise los datos."
        )

    if c == 0 and phi == 0:
        warnings.append(
            "c = 0 y φ = 0°: el estrato de fundación no tiene capacidad portante."
        )

    if Df == 0:
        warnings.append(
            "Df = 0: cimentación superficial sin empotramiento. "
            "Factores de profundidad = 1.0."
        )

    # Bloque 2.4: validación cimentación superficial
    if Df_abs / B > 5.0:
        warnings.append(
            f"Df/B = {Df_abs/B:.2f} supera 5. Las ecuaciones de cimentación "
            f"superficial pueden no ser aplicables. Considere cimentación profunda."
        )

    # ── Bloque 3 + 4: Sobrecarga q y γ efectivo ───────────────────
    has_water_table = conditions["hasWaterTable"]
    Dw = conditions["waterTableDepth"]

    water_result = apply_water_table_correction(
        strata, Df, B, has_water_table, Dw, design_stratum, Ds=Ds
    )
    q = water_result["q"]
    gamma_effective = water_result["gammaEffective"]
    warnings.extend(water_result.get("warnings", []))

    # ── Bloque 6: validación método/geometría ─────────────────────
    if method == "terzaghi" and f_type == "rectangular":
        raise ValueError(
            "Terzaghi no aplica para cimentaciones rectangulares. "
            "Use Ecuación General o RNE."
        )

    if method == "terzaghi" and beta > 0:
        warnings.append(
            f"Terzaghi no incluye factores de inclinación. β={beta}° se ignora "
            f"en este método. Use Ecuación General o RNE para considerar β."
        )

    if phi == 0 and beta > 0:
        warnings.append(
            "φ=0° con β>0°: Fγi es indeterminado pero S3=0 (Nγ=0), por lo "
            "que la inclinación no afecta el resultado del 3er sumando."
        )

    if beta > 0 and phi > 0 and beta >= phi:
        warnings.append(
            f"β ({beta}°) ≥ φ ({phi}°): condición inestable. iγ se anula y "
            f"el 3er sumando se reduce a 0."
        )

    # ── Bloque 11 parcial: dimensiones efectivas y régimen ────────
    has_eccentricity = (e1 > 0 or e2 > 0)
    eff = _compute_effective_dimensions(B, L, e1, e2)
    B_eff, L_eff, A_eff = eff["B_eff"], eff["L_eff"], eff["A_eff"]

    if has_eccentricity:
        in_kern = (e1 <= B / 6.0 + 1e-9) and (e2 <= L / 6.0 + 1e-9)
        regime = "trapezoidal" if in_kern else "triangular"
        if not in_kern:
            warnings.append(
                f"Excentricidad fuera del núcleo central (kern): "
                f"e1={e1:.3f} (B/6={B/6:.3f}), e2={e2:.3f} (L/6={L/6:.3f}). "
                f"Se produce levantamiento; distribución triangular."
            )
    else:
        regime = "uniforme"

    # ── Bloques 5+7+8: Sumandos por método ────────────────────────
    method_blocks = {}

    # Terzaghi (omitido si rectangular)
    if f_type != "rectangular":
        t_res = calculate_qu_terzaghi(c, q, gamma_effective, B_eff, phi, f_type)
        method_blocks["terzaghi"] = _build_method_block(
            t_res, soil_type, FS, B, L
        )

    g_res = calculate_qu_general(
        c, q, gamma_effective, B, B_eff, L_eff, phi, beta, Df_abs,
    )
    method_blocks["general"] = _build_method_block(g_res, soil_type, FS, B, L)

    r_res = calculate_qu_rne(
        c, q, gamma_effective, B_eff, L_eff, phi, beta,
    )
    method_blocks["rne"] = _build_method_block(r_res, soil_type, FS, B, L)

    # ── Bloque 11: presiones extremas y FS_real ────────────────────
    eccentricity_info = None
    if has_eccentricity or Q_applied is not None:
        # Validar qu del método+criterio principal sobre el área efectiva
        principal_qu = method_blocks[method]["criteria"]["general"]["qu"]
        Qu = principal_qu * A_eff  # carga última total (kN si qu en kPa)
        FS_real = (Qu / Q_applied) if (Q_applied and Q_applied > 0) else None

        # qmax, qmin si tenemos Q aplicada
        qmax = None
        qmin = None
        if Q_applied is not None and Q_applied > 0:
            if regime == "triangular" and e1 > B / 6.0:
                pr = _extreme_pressures_triangular(Q_applied, B, L, e1)
            else:
                pr = _extreme_pressures_trapezoidal(Q_applied, B, L, e1, e2)
                if pr["qmin"] < 0 and regime == "trapezoidal":
                    warnings.append(
                        f"qmin = {pr['qmin']:.2f} kPa < 0 con régimen trapezoidal. "
                        f"Inconsistencia: verifique excentricidad y dimensiones."
                    )
            qmax, qmin = pr["qmax"], pr["qmin"]

        valid = None
        if FS_real is not None:
            valid = FS_real >= FS

        eccentricity_info = {
            "hasEccentricity": has_eccentricity,
            "e1": e1, "e2": e2,
            "Q": Q_applied,
            "B_eff": B_eff, "L_eff": L_eff, "A_eff": A_eff,
            "regime": regime,
            "qmax": qmax,
            "qmin": qmin,
            "Qu": Qu,
            "FS_real": FS_real,
            "valid": valid,
        }

    # ── Compatibilidad con markdown/latex generators ──────────────
    # Campos "principales" = método elegido + criterio General
    principal = method_blocks[method]
    principal_general = principal["criteria"]["general"]
    factors = principal["factors"]

    qu = principal_general["qu"]
    qa = principal_general["qa"]
    qnet = qu - q
    qa_net = qnet / FS if FS > 0 else 0.0
    Qmax = qa * B * L

    # rneConsideration: criterios RNE y RNE-Corregido aplicados al método elegido
    rne_qu = principal["criteria"]["rne"]["qu"]
    rne_corr_qu = principal["criteria"]["rne_corrected"]["qu"]
    rne_consideration = {
        "qultRNE": rne_qu,
        "qultRNECorrected": rne_corr_qu,
        "qadmRNE": rne_qu / FS if FS > 0 else 0.0,
        "qadmRNECorrected": rne_corr_qu / FS if FS > 0 else 0.0,
    }

    return {
        # ── Compatibilidad legacy ─────────────────────────────────
        "designStratumIndex": design_index,
        "designStratum": design_stratum,
        "bearingFactors": {
            "Nc": factors["Nc"],
            "Nq": factors["Nq"],
            "Ngamma": factors["Ngamma"],
        },
        "shapeFactors": {
            "sc": factors["Fcs"], "sq": factors["Fqs"], "sgamma": factors["Fgs"],
        },
        "depthFactors": {
            "dc": factors["Fcd"], "dq": factors["Fqd"], "dgamma": factors["Fgd"],
        },
        "inclinationFactors": {
            "ic": factors["Fci"], "iq": factors["Fqi"], "igamma": factors["Fgi"],
        },
        "q": q,
        "waterTableCase": water_result["case"],
        "gammaEffective": gamma_effective,
        "qu": qu,
        "qnet": qnet,
        "qa": qa,
        "qaNet": qa_net,
        "method": method,
        "Qmax": Qmax,
        "F1": principal["S1"],
        "F2": principal["S2"],
        "F3": principal["S3"],
        "soilType": soil_type,
        "rneConsideration": rne_consideration,
        "warnings": warnings,
        # ── Estructura nueva ──────────────────────────────────────
        "methodCriteriaMatrix": method_blocks,
        "eccentricity": eccentricity_info,
    }
