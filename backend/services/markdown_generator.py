def generate_resolution_md(input_data: dict, result: dict, unit_config: dict = None) -> str:
    """
    Genera un string de Markdown con LaTeX para la resolución paso a paso.
    Incluye conversiones de unidades y formateo formal de ingeniería.
    """
    if not unit_config:
        unit_config = {"input": {}, "output": {}}
        
    inp = unit_config.get("input", {})
    out = unit_config.get("output", {})
    
    iu_length = inp.get("length", "m")
    iu_pressure = inp.get("pressure", "kPa")
    iu_weight = inp.get("unitWeight", "kN/m³")
    ou_pressure = out.get("pressure", "kPa")
    ou_force = out.get("force", "kN")
    
    factors = {
        "m": 1.0, "cm": 0.01, "ft": 0.3048,
        "kN": 1.0, "t": 9.80665, "kgf": 0.00980665,
        "kPa": 1.0, "t/m²": 9.80665, "kg/cm²": 98.0665,
        "kN/m³": 1.0, "t/m³": 9.80665,
    }
    
    def _cinp(val, unit):
        return val / factors.get(unit, 1.0)
        
    def _cout(val, unit):
        return val / factors.get(unit, 1.0)

    foundation = input_data["foundation"]
    method = input_data["method"]
    conditions = input_data["conditions"]
    
    B = _cinp(foundation["B"], iu_length)
    L = _cinp(foundation["L"], iu_length)
    Df = _cinp(foundation["Df"], iu_length)
    beta = foundation["beta"]
    FS = foundation["FS"]
    f_type = foundation["type"]
    
    q = _cout(result["q"], ou_pressure)
    gamma_eff = _cout(result["gammaEffective"], iu_weight) # gamma is usually input weight unit
    qu = _cout(result["qu"], ou_pressure)
    qa = _cout(result["qa"], ou_pressure)
    qnet = _cout(result["qnet"], ou_pressure)
    qa_net = _cout(result["qaNet"], ou_pressure)
    Qmax = _cout(result["Qmax"], ou_force)
    F1 = _cout(result["F1"], ou_pressure)
    F2 = _cout(result["F2"], ou_pressure)
    F3 = _cout(result["F3"], ou_pressure)
    
    design = result["designStratum"]
    ds_idx = result["designStratumIndex"]
    c = _cinp(design["c"], iu_pressure)
    phi = design["phi"]
    gamma = _cinp(design["gamma"], iu_weight)
    gammaSat = _cinp(design.get("gammaSat", design["gamma"]), iu_weight)
    soil_type_str = "Cohesivo" if result.get("soilType") == "Coh" else "Friccionante"
    
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

    md = []
    
    method_name = "Terzaghi Clásico"
    if method == "general": method_name = "Ecuación General (Das)"
    elif method == "rne": method_name = "Norma E.050 (RNE)"
        
    md.append(f"### Análisis de Capacidad Portante — {method_name}")
    md.append("---")
    md.append("")
    
    # 1. Parámetros
    md.append("#### 1. Parámetros Geométricos y Estrato de Diseño")
    md.append(f"**Cimentación:** {f_type.capitalize()} ")
    if f_type == "rectangular":
        md.append(f"$\\rightarrow B = {B:.2f}$ {iu_length}, $\\quad L = {L:.2f}$ {iu_length}, $\\quad D_f = {Df:.2f}$ {iu_length}")
    else:
        md.append(f"$\\rightarrow B = {B:.2f}$ {iu_length}, $\\quad D_f = {Df:.2f}$ {iu_length}")
    md.append("")
    md.append(f"**Estrato de Diseño (N° {ds_idx + 1}):** {soil_type_str}")
    md.append(f"$$ c = {c:.2f} \\text{{ {iu_pressure}}}, \\quad \\phi = {phi:.2f}^\\circ, \\quad \\gamma = {gamma:.2f} \\text{{ {iu_weight}}}, \\quad \\gamma_{{sat}} = {gammaSat:.2f} \\text{{ {iu_weight}}} $$")
    md.append("")
    
    # 2. Factores de Capacidad de Carga
    md.append("#### 2. Factores de Capacidad Portante")
    md.append(f"Obtenidos a partir del ángulo de fricción $\\phi = {phi:.2f}^\\circ$:")
    md.append(f"$$ N_c = {Nc:.3f}, \\quad N_q = {Nq:.3f}, \\quad N_\\gamma = {Ng:.3f} $$")
    md.append("")
    
    # 3. Factores de Modificación
    md.append("#### 3. Factores de Modificación")
    md.append("| Parámetro | Cohesión ($c$) | Sobrecarga ($q$) | Peso Específico ($\\gamma$) |")
    md.append("| :--- | :---: | :---: | :---: |")
    md.append(f"| **Forma ($s$)** | $s_c = {sc:.3f}$ | $s_q = {sq:.3f}$ | $s_\\gamma = {sg:.3f}$ |")
    if method == "general":
        md.append(f"| **Profundidad ($d$)** | $d_c = {dc:.3f}$ | $d_q = {dq:.3f}$ | $d_\\gamma = {dg:.3f}$ |")
    if beta > 0 or method == "general" or method == "rne":
        md.append(f"| **Inclinación ($i$)** | $i_c = {ic:.3f}$ | $i_q = {iq:.3f}$ | $i_\\gamma = {ig:.3f}$ |")
    md.append("")
    
    # 4. Sobrecarga y correcciones
    md.append("#### 4. Sobrecarga Efectiva y Nivel Freático")
    md.append(f"Condición de agua: **{water_case_str}**")
    md.append(f"$$ q = {q:.2f} \\text{{ {ou_pressure}}} $$")
    md.append(f"$$ \\gamma_{{eff}} = {gamma_eff:.2f} \\text{{ {iu_weight}}} $$")
    md.append("")
    
    # 5. Ecuacion
    md.append("#### 5. Ecuación de Capacidad Portante")
    if method == "terzaghi":
        if f_type == "franja":
            eq = "q_u = c N_c s_c + q N_q + \\frac{1}{2} \\gamma_{eff} B N_\\gamma s_\\gamma"
        elif f_type == "cuadrada":
            eq = "q_u = 1.3 c N_c + q N_q + 0.4 \\gamma_{eff} B N_\\gamma"
        elif f_type == "circular":
            eq = "q_u = 1.3 c N_c + q N_q + 0.3 \\gamma_{eff} B N_\\gamma"
        else:
            eq = "q_u = c N_c s_c + q N_q + \\frac{1}{2} \\gamma_{eff} B N_\\gamma s_\\gamma"
    elif method == "general":
        eq = "q_u = c N_c s_c d_c i_c + q N_q s_q d_q i_q + \\frac{1}{2} \\gamma_{eff} B N_\\gamma s_\\gamma d_\\gamma i_\\gamma"
    else: # RNE
        eq = "q_u = c N_c s_c i_c + q N_q s_q i_q + \\frac{1}{2} \\gamma_{eff} B N_\\gamma s_\\gamma i_\\gamma"
        
    md.append(f"$$ {eq} $$")
    md.append("")
    md.append("Desglose de los términos calculados:")
    md.append(f"$$ F_1 (\\text{{Cohesión}}) = {F1:.2f} \\text{{ {ou_pressure}}} $$")
    md.append(f"$$ F_2 (\\text{{Sobrecarga}}) = {F2:.2f} \\text{{ {ou_pressure}}} $$")
    md.append(f"$$ F_3 (\\text{{Fricción}}) = {F3:.2f} \\text{{ {ou_pressure}}} $$")
    md.append("")
    md.append(f"**Capacidad Última ($q_u$):**")
    md.append(f"$$ q_u = F_1 + F_2 + F_3 = {qu:.2f} \\text{{ {ou_pressure}}} $$")
    md.append("")
    
    # 6. Capacidades
    md.append("#### 6. Resultados y Capacidades Admisibles")
    md.append(f"Aplicando el Factor de Seguridad estipulado ($FS = {FS}$):")
    md.append("")
    md.append("| Parámetro | Símbolo | Valor | Unidad |")
    md.append("| :--- | :---: | :---: | :---: |")
    md.append(f"| **Capacidad Neta Última** ($q_u - q$) | $q_{{net}}$ | **{qnet:.2f}** | {ou_pressure} |")
    md.append(f"| **Capacidad Admisible** ($q_u / FS$) | $q_{{adm}}$ | **{qa:.2f}** | {ou_pressure} |")
    md.append(f"| **Capacidad Neta Admisible** ($q_{{net}} / FS$) | $q_{{net(adm)}}$ | **{qa_net:.2f}** | {ou_pressure} |")
    md.append(f"| **Carga Máxima Estructural** | $Q_{{max}}$ | **{Qmax:.2f}** | {ou_force} |")
    md.append("")
    
    # 7. RNE
    rne = result.get("rneConsideration")
    if rne:
        quRNE = _cout(rne["qultRNE"], ou_pressure)
        qaRNE = _cout(rne["qadmRNE"], ou_pressure)
        quRNE_c = _cout(rne["qultRNECorrected"], ou_pressure)
        md.append("#### 7. Consideración Normativa RNE E.050")
        md.append("Reajuste según estipulaciones locales del Reglamento Nacional de Edificaciones:")
        md.append(f"$$ q_{{u(RNE)}} = {quRNE:.2f} \\text{{ {ou_pressure}}}, \\quad q_{{adm(RNE)}} = {qaRNE:.2f} \\text{{ {ou_pressure}}} $$")
        md.append(f"$$ q_{{u(corregido)}} = {quRNE_c:.2f} \\text{{ {ou_pressure}}} $$")
        md.append("")

    return "\n".join(md)
