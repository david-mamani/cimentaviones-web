def generate_resolution_md(input_data: dict, result: dict) -> str:
    """
    Genera un string de Markdown con LaTeX para la resolución paso a paso.
    """
    foundation = input_data["foundation"]
    method = input_data["method"]
    
    B = foundation["B"]
    L = foundation["L"]
    Df = foundation["Df"]
    beta = foundation["beta"]
    FS = foundation["FS"]
    f_type = foundation["type"]
    
    q = result["q"]
    gamma_eff = result["gammaEffective"]
    qu = result["qu"]
    qa = result["qa"]
    qnet = result["qnet"]
    qa_net = result["qaNet"]
    F1 = result["F1"]
    F2 = result["F2"]
    F3 = result["F3"]
    
    design = result["designStratum"]
    c = design["c"]
    phi = design["phi"]
    
    bearing = result["bearingFactors"]
    Nc, Nq, Ng = bearing["Nc"], bearing["Nq"], bearing["Ngamma"]
    
    shape = result["shapeFactors"]
    sc, sq, sg = shape["sc"], shape["sq"], shape["sgamma"]
    
    depth = result.get("depthFactors", {"dc": 1, "dq": 1, "dgamma": 1})
    dc, dq, dg = depth["dc"], depth["dq"], depth["dgamma"]
    
    incl = result.get("inclinationFactors", {"ic": 1, "iq": 1, "igamma": 1})
    ic, iq, ig = incl["ic"], incl["iq"], incl["igamma"]

    md = []
    
    method_name = method.capitalize()
    if method == "rne":
        method_name = "Norma E.050 (RNE)"
        
    md.append(f"### Resolución Paso a Paso: Método {method_name}")
    md.append(f"**Parámetros de Diseño:**")
    md.append(f"- Cimentación: {f_type.capitalize()} ($B={B}$ m, $L={L}$ m, $D_f={Df}$ m)")
    md.append(f"- Estrato de diseño: $c={c:.2f}$ kPa, $\\phi={phi:.2f}^\\circ$, $\\gamma_{{eff}}={gamma_eff:.2f}$ kN/m³")
    md.append(f"- Sobrecarga efectiva a nivel de cimentación: $q={q:.2f}$ kPa")
    md.append("")
    
    md.append("#### 1. Factores de Capacidad de Carga")
    md.append(f"Para $\\phi = {phi:.2f}^\\circ$:")
    md.append(f"$$ N_c = {Nc:.3f}, \\quad N_q = {Nq:.3f}, \\quad N_\\gamma = {Ng:.3f} $$")
    md.append("")
    
    md.append("#### 2. Factores de Modificación")
    md.append("**Forma:**")
    md.append(f"$$ s_c = {sc:.3f}, \\quad s_q = {sq:.3f}, \\quad s_\\gamma = {sg:.3f} $$")
    if method == "general":
        md.append("**Profundidad:**")
        md.append(f"$$ d_c = {dc:.3f}, \\quad d_q = {dq:.3f}, \\quad d_\\gamma = {dg:.3f} $$")
    if beta > 0 or method == "general" or method == "rne":
        md.append("**Inclinación:**")
        md.append(f"$$ i_c = {ic:.3f}, \\quad i_q = {iq:.3f}, \\quad i_\\gamma = {ig:.3f} $$")
    md.append("")
    
    md.append("#### 3. Ecuación de Capacidad Portante Última")
    
    # Ecuaciones según método
    if method == "terzaghi":
        if f_type == "franja":
            eq = "q_u = c N_c + q N_q + \\frac{1}{2} \\gamma B N_\\gamma"
        elif f_type == "cuadrada":
            eq = "q_u = 1.3 c N_c + q N_q + 0.4 \\gamma B N_\\gamma"
        elif f_type == "circular":
            eq = "q_u = 1.3 c N_c + q N_q + 0.3 \\gamma B N_\\gamma"
        else: # Rectangular no soportada, pero por si acaso
            eq = "q_u = c N_c (1 + 0.3 \\frac{B}{L}) + q N_q + \\frac{1}{2} \\gamma B N_\\gamma (1 - 0.2 \\frac{B}{L})"
            
        md.append(f"$$ {eq} $$")
    elif method == "general":
        md.append("$$ q_u = c N_c s_c d_c i_c + q N_q s_q d_q i_q + \\frac{1}{2} \\gamma B N_\\gamma s_\\gamma d_\\gamma i_\\gamma $$")
    else: # RNE
        md.append("$$ q_u = c N_c s_c i_c + q N_q s_q i_q + \\frac{1}{2} \\gamma B N_\\gamma s_\\gamma i_\\gamma $$")
        
    md.append("Desglosando en sus componentes ($F_1$ = cohesión, $F_2$ = sobrecarga, $F_3$ = fricción):")
    md.append(f"- $F_1 = {F1:.2f}$ kPa")
    md.append(f"- $F_2 = {F2:.2f}$ kPa")
    md.append(f"- $F_3 = {F3:.2f}$ kPa")
    md.append(f"$$ q_u = F_1 + F_2 + F_3 = {qu:.2f} \\text{{ kPa}} $$")
    md.append("")
    
    md.append("#### 4. Capacidades Admisibles")
    md.append("Capacidad portante neta:")
    md.append(f"$$ q_{{net}} = q_u - q = {qu:.2f} - {q:.2f} = {qnet:.2f} \\text{{ kPa}} $$")
    
    md.append(f"Capacidad neta admisible ($FS={FS}$):")
    md.append(f"$$ q_{{net(adm)}} = \\frac{{q_{{net}}}}{{FS}} = \\frac{{{qnet:.2f}}}{{{FS}}} = {qa_net:.2f} \\text{{ kPa}} $$")

    md.append(f"Capacidad última admisible ($FS={FS}$):")
    md.append(f"$$ q_{{adm}} = \\frac{{q_u}}{{FS}} = \\frac{{{qu:.2f}}}{{{FS}}} = {qa:.2f} \\text{{ kPa}} $$")
    
    return "\n".join(md)
