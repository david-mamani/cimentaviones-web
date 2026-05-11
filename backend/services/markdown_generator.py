"""
Generador de resolución paso a paso en Markdown + LaTeX (KaTeX).

Genera un string de Markdown con ecuaciones LaTeX embebidas para ser
renderizado en el frontend usando react-markdown + rehype-katex.

Los valores del resultado vienen en SI (kPa, kN/m³, kN) desde el motor.
Se convierten a Métrico (t/m², t/m³, tnf) para mostrar.
"""

# Factor de conversión SI → Métrico
G = 9.80665  # 1 tnf = 9.80665 kN


def generate_resolution_md(input_data: dict, result: dict, unit_config: dict = None) -> str:
    """
    Genera un string de Markdown con LaTeX para la resolución paso a paso.
    Sistema de unidades forzado a Métrico: m, t/m², t/m³, tnf.
    """
    foundation = input_data["foundation"]
    method = input_data["method"]

    # ── Datos geométricos (ya en metros) ──
    B = foundation["B"]
    L = foundation["L"]
    Df = foundation["Df"]
    beta = foundation["beta"]
    FS = foundation["FS"]
    f_type = foundation["type"]

    # ── Resultados del cálculo (SI → Métrico: dividir por G) ──
    q = result["q"] / G
    gamma_eff = result["gammaEffective"] / G
    qu = result["qu"] / G
    qa = result["qa"] / G
    qnet = result["qnet"] / G
    qa_net = result["qaNet"] / G
    Qmax = result["Qmax"] / G
    F1 = result["F1"] / G
    F2 = result["F2"] / G
    F3 = result["F3"] / G

    # ── Datos del estrato de diseño (SI → Métrico) ──
    design = result["designStratum"]
    ds_idx = result["designStratumIndex"]
    c = design["c"] / G
    phi = design["phi"]
    gamma = design["gamma"] / G
    gammaSat = design.get("gammaSat", design["gamma"]) / G
    soil_type_str = "Cohesivo" if result.get("soilType") == "Coh" else "Friccionante"

    # ── Factores (adimensionales) ──
    bearing = result["bearingFactors"]
    Nc, Nq, Ng = bearing["Nc"], bearing["Nq"], bearing["Ngamma"]

    shape = result["shapeFactors"]
    sc, sq, sg = shape["sc"], shape["sq"], shape["sgamma"]

    depth = result.get("depthFactors", {"dc": 1.0, "dq": 1.0, "dgamma": 1.0})
    dc, dq, dg = depth["dc"], depth["dq"], depth["dgamma"]

    incl = result.get("inclinationFactors", {"ic": 1.0, "iq": 1.0, "igamma": 1.0})
    ic, iq, ig = incl["ic"], incl["iq"], incl["igamma"]

    water_cases = {
        0: "Sin nivel freático",
        1: "NF sobre cimentación",
        2: "NF en la base",
        3: "NF entre Df y Df+B",
        4: "NF debajo de Df+B",
    }
    water_case_str = water_cases.get(result.get("waterTableCase", 0), "")

    # Unidades fijas
    u_len = "m"
    u_pres = "t/m²"
    u_weight = "t/m³"
    u_force = "tnf"

    # ═══════════════════════════════════════
    # GENERACIÓN DEL MARKDOWN
    # ═══════════════════════════════════════
    md = []

    method_name = "Terzaghi Clásico"
    if method == "general":
        method_name = "Ecuación General (Das)"
    elif method == "rne":
        method_name = "Norma E.050 (RNE)"

    md.append(f"### Análisis de Capacidad Portante — {method_name}")
    md.append("---")
    md.append("")

    # ── 1. Parámetros ──
    md.append("#### 1. Parámetros Geométricos y Estrato de Diseño")
    md.append("")

    if f_type == "rectangular":
        geom = f"$\\rightarrow B = {B:.2f}$ {u_len}, $\\quad L = {L:.2f}$ {u_len}, $\\quad D_f = {Df:.2f}$ {u_len}"
    else:
        geom = f"$\\rightarrow B = {B:.2f}$ {u_len}, $\\quad D_f = {Df:.2f}$ {u_len}"
    md.append(f"**Cimentación:** {f_type.capitalize()}  \n{geom}")
    md.append("")

    md.append(f"**Estrato de Diseño (N° {ds_idx + 1}):** {soil_type_str}")
    md.append("")
    md.append(f"$$ c = {c:.2f} \\text{{ {u_pres}}}, \\quad \\phi = {phi:.2f}^\\circ, \\quad \\gamma = {gamma:.2f} \\text{{ {u_weight}}}, \\quad \\gamma_{{sat}} = {gammaSat:.2f} \\text{{ {u_weight}}} $$")
    md.append("")

    # ── 2. Factores de Capacidad Portante ──
    md.append("#### 2. Factores de Capacidad Portante")
    md.append("")
    md.append(f"Obtenidos a partir del ángulo de fricción $\\phi = {phi:.2f}^\\circ$:")
    md.append("")
    md.append(f"$$ N_c = {Nc:.3f}, \\quad N_q = {Nq:.3f}, \\quad N_\\gamma = {Ng:.3f} $$")
    md.append("")

    # ── 3. Factores de Modificación ──
    md.append("#### 3. Factores de Modificación")
    md.append("")
    md.append("| Parámetro | Cohesión ($c$) | Sobrecarga ($q$) | Peso Específico ($\\gamma$) |")
    md.append("| :--- | :---: | :---: | :---: |")
    md.append(f"| **Forma ($s$)** | $s_c = {sc:.3f}$ | $s_q = {sq:.3f}$ | $s_\\gamma = {sg:.3f}$ |")
    if method == "general":
        md.append(f"| **Profundidad ($d$)** | $d_c = {dc:.3f}$ | $d_q = {dq:.3f}$ | $d_\\gamma = {dg:.3f}$ |")
    if beta > 0 or method == "general" or method == "rne":
        md.append(f"| **Inclinación ($i$)** | $i_c = {ic:.3f}$ | $i_q = {iq:.3f}$ | $i_\\gamma = {ig:.3f}$ |")
    md.append("")

    # ── 4. Sobrecarga y correcciones ──
    md.append("#### 4. Sobrecarga Efectiva y Nivel Freático")
    md.append("")
    md.append(f"Condición de agua: **{water_case_str}**")
    md.append("")
    md.append(f"$$ q = {q:.2f} \\text{{ {u_pres}}} $$")
    md.append("")
    md.append(f"$$ \\gamma_{{eff}} = {gamma_eff:.2f} \\text{{ {u_weight}}} $$")
    md.append("")

    # ── 5. Ecuación de Capacidad Portante ──
    md.append("#### 5. Ecuación de Capacidad Portante")
    md.append("")
    if method == "terzaghi":
        if f_type == "cuadrada":
            eq = "q_u = 1.3 c N_c + q N_q + 0.4 \\gamma_{eff} B N_\\gamma"
        elif f_type == "franja":
            eq = "q_u = c N_c s_c + q N_q + \\frac{1}{2} \\gamma_{eff} B N_\\gamma s_\\gamma"
        elif f_type == "circular":
            eq = "q_u = 1.3 c N_c + q N_q + 0.3 \\gamma_{eff} B N_\\gamma"
        else:
            eq = "q_u = c N_c s_c + q N_q + \\frac{1}{2} \\gamma_{eff} B N_\\gamma s_\\gamma"
    elif method == "general":
        eq = "q_u = c N_c s_c d_c i_c + q N_q s_q d_q i_q + \\frac{1}{2} \\gamma_{eff} B N_\\gamma s_\\gamma d_\\gamma i_\\gamma"
    else:  # RNE
        eq = "q_u = c N_c s_c i_c + q N_q s_q i_q + \\frac{1}{2} \\gamma_{eff} B N_\\gamma s_\\gamma i_\\gamma"

    md.append(f"$$ {eq} $$")
    md.append("")
    md.append("Desglose de los términos calculados:")
    md.append("")
    md.append(f"$$ F_1 (\\text{{Cohesión}}) = {F1:.2f} \\text{{ {u_pres}}} $$")
    md.append("")
    md.append(f"$$ F_2 (\\text{{Sobrecarga}}) = {F2:.2f} \\text{{ {u_pres}}} $$")
    md.append("")
    md.append(f"$$ F_3 (\\text{{Fricción}}) = {F3:.2f} \\text{{ {u_pres}}} $$")
    md.append("")
    md.append("**Capacidad Última ($q_u$):**")
    md.append("")
    md.append(f"$$ q_u = F_1 + F_2 + F_3 = {qu:.2f} \\text{{ {u_pres}}} $$")
    md.append("")

    # ── 6. Resultados Finales ──
    md.append("#### 6. Resultados y Capacidades Admisibles")
    md.append("")
    md.append(f"Aplicando el Factor de Seguridad estipulado ($FS = {FS}$):")
    md.append("")
    md.append("| Parámetro | Símbolo | Valor | Unidad |")
    md.append("| :--- | :---: | :---: | :---: |")
    md.append(f"| **Capacidad Neta Última** ($q_u - q$) | $q_{{net}}$ | **{qnet:.2f}** | {u_pres} |")
    md.append(f"| **Capacidad Admisible** ($q_u / FS$) | $q_{{adm}}$ | **{qa:.2f}** | {u_pres} |")
    md.append(f"| **Capacidad Neta Admisible** ($q_{{net}} / FS$) | $q_{{net(adm)}}$ | **{qa_net:.2f}** | {u_pres} |")
    md.append(f"| **Carga Máxima Estructural** | $Q_{{max}}$ | **{Qmax:.2f}** | {u_force} |")
    md.append("")

    # ── 7. Consideración RNE ──
    rne = result.get("rneConsideration")
    if rne:
        quRNE = rne["qultRNE"] / G
        qaRNE = rne["qadmRNE"] / G
        quRNE_c = rne["qultRNECorrected"] / G
        md.append("#### 7. Consideración Normativa RNE E.050")
        md.append("")
        md.append("Reajuste según estipulaciones locales del Reglamento Nacional de Edificaciones:")
        md.append("")
        md.append(f"$$ q_{{u(RNE)}} = {quRNE:.2f} \\text{{ {u_pres}}}, \\quad q_{{adm(RNE)}} = {qaRNE:.2f} \\text{{ {u_pres}}} $$")
        md.append("")
        md.append(f"$$ q_{{u(corregido)}} = {quRNE_c:.2f} \\text{{ {u_pres}}} $$")
        md.append("")

    return "\n".join(md)
