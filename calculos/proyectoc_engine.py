import math

def calculate_proyectoc_bearing_capacity(input_data: dict) -> dict:
    """
    Motor de cálculo antiguo (ProyectoC-V0.02).
    Esta es una transcripción exacta de la lógica matemática del archivo original.
    """
    foundation = input_data["foundation"]
    strata = input_data["strata"]
    conditions = input_data["conditions"]
    method_key = input_data["method"]

    # Mapeo del método para igualar el string usado en el script original
    method_map = {
        "terzaghi": "Therzaghi",
        "general": "Ecuación General",
        "rne": "RNE"
    }
    metodo = method_map.get(method_key, "Therzaghi")

    # Variables de cimentación
    tipo_cimentacion = foundation["type"]
    B = foundation["B"]
    L = foundation["L"]
    desplante = foundation.get("Df", 1.0)
    angulo = float(foundation.get("beta") or 0.0)
    FS = foundation.get("FS", 3.0)

    # Condiciones especiales
    tiene_nivel_freatico = conditions["hasWaterTable"]
    profundidad_freatica = conditions["waterTableDepth"]
    tiene_sotano = conditions["hasBasement"]
    profundidad_sotano = conditions["basementDepth"] if tiene_sotano else 0.0

    # --- 0. CONVERSIÓN DE SI A MÉTRICO (Legacy) ---
    # El motor antiguo (ProyectoC) fue diseñado estrictamente para trabajar en tnf/m/°.
    # Contiene constantes hardcodeadas (ej. yw = 1.0) y redondeos específicos (ej. round(q, 2))
    # que asumen que las presiones están en tnf/m². Si inyectamos SI directamente, se rompe la paridad.
    G_CONST = 9.80665

    # Preparar estratos convirtiéndolos a Métrico
    datos_estratos = []
    for i, s in enumerate(strata):
        phi_i = s["phi"]
        tipo_text = "Coh" if phi_i < 20 else "Fri"
        datos_estratos.append({
            "n": i + 1,
            "h": s["thickness"], # longitud en m, sin cambio
            "Yn": s["gamma"] / G_CONST,
            "Ysat": s["gammaSat"] / G_CONST,
            "C": s["c"] / G_CONST,
            "phi": s["phi"],
            "tipo": tipo_text
        })

    yw_var = 1.0  # En métrico, yw = 1.0 tnf/m³

    # 1. Función para determinar el estrato de sótano + desplante
    def estrato_para_profundidad():
        profundidad_objetivo = profundidad_sotano + desplante
        acumulado = 0.0
        for fila in datos_estratos:
            acumulado += fila["h"]
            if acumulado > profundidad_objetivo:
                return fila["n"]
        return datos_estratos[-1]["n"] if datos_estratos else None

    estr = estrato_para_profundidad()
    if estr is None:
        estr = len(datos_estratos) # Use the last stratum as fallback if somehow empty

    fila = next((f for f in datos_estratos if f["n"] == estr), None)
    if fila is None:
        raise ValueError("Error: estrato no encontrado")

    tipo_suelo = fila["tipo"]
    phi = fila["phi"]
    c = fila["C"]
    Yn = fila["Yn"]
    Ysat = fila["Ysat"]

    q = 0.0
    yefectivo = Yn
    CRNEnum = 0
    CRNECnum = 0

    # 3a) Cálculo del peso específico efectivo en función del nivel freático
    if tiene_nivel_freatico:
        nivel_desplante = profundidad_sotano + desplante
        nivel_sotano = profundidad_sotano
        nivel_freatico = profundidad_freatica
        nivel_ciment = nivel_sotano + desplante
        delta = abs(nivel_desplante - profundidad_freatica)

        if nivel_ciment >= nivel_freatico:
            # caso 1
            yefectivo = Ysat - yw_var
            nivel_cim = nivel_desplante
            q = 0.0
            acumulado = 0.0

            for fila_estrato in datos_estratos:
                h_i = fila_estrato["h"]
                gamma_i = fila_estrato["Yn"]

                if acumulado + h_i <= nivel_sotano:
                    acumulado += h_i
                    continue

                if acumulado < nivel_sotano:
                    h_parcial = (acumulado + h_i) - nivel_sotano
                    h_parcial = min(h_parcial, nivel_freatico - nivel_sotano)
                    q += h_parcial * gamma_i
                    acumulado += h_i
                    if acumulado >= nivel_freatico:
                        break
                    continue

                if acumulado < nivel_freatico:
                    h_parcial = min(h_i, nivel_freatico - acumulado)
                    q += h_parcial * gamma_i
                    acumulado += h_i
                    if acumulado >= nivel_freatico:
                        break

            h_restante = nivel_cim - nivel_freatico
            if h_restante > 0:
                q += h_restante * yefectivo

        elif 0 < delta < B:
            # caso 2
            Ysc2 = Ysat
            Ync2 = Yn
            yw = yw_var
            delta_val = abs(nivel_desplante - profundidad_freatica)
            Bc2 = B
            
            yefectivo = (Ysc2 - yw) + ((delta_val / Bc2) * (Ync2 - (Ysc2 - yw)))

            q = 0.0
            profundidad_cimentacion = profundidad_sotano
            profundidad_objetivo = profundidad_cimentacion + desplante
            acumulado = 0.0

            for fila_estrato in datos_estratos:
                h_i = fila_estrato["h"]
                gamma_i = fila_estrato["Yn"]

                if acumulado + h_i <= profundidad_cimentacion:
                    acumulado += h_i
                    continue

                if acumulado < profundidad_cimentacion:
                    h_parcial = acumulado + h_i - profundidad_cimentacion
                    q += h_parcial * gamma_i
                    acumulado += h_i
                    continue

                if acumulado + h_i <= profundidad_objetivo:
                    q += h_i * gamma_i
                    acumulado += h_i
                else:
                    h_residual = profundidad_objetivo - acumulado
                    q += h_residual * gamma_i
                    acumulado = profundidad_objetivo
                    break
        else:
            # caso 3
            q = 0.0
            profundidad_cimentacion = profundidad_sotano
            profundidad_objetivo = profundidad_cimentacion + desplante
            acumulado = 0.0

            for fila_estrato in datos_estratos:
                h_i = fila_estrato["h"]
                gamma_i = fila_estrato["Yn"]

                if acumulado + h_i <= profundidad_cimentacion:
                    acumulado += h_i
                    continue

                if acumulado < profundidad_cimentacion:
                    h_parcial = acumulado + h_i - profundidad_cimentacion
                    q += h_parcial * gamma_i
                    acumulado += h_i
                    continue

                if acumulado + h_i <= profundidad_objetivo:
                    q += h_i * gamma_i
                    acumulado += h_i
                else:
                    h_residual = profundidad_objetivo - acumulado
                    q += h_residual * gamma_i
                    acumulado = profundidad_objetivo
                    break

    else:
        # sin nivel freático
        yefectivo = Yn
        q = 0.0
        profundidad_cimentacion = profundidad_sotano
        profundidad_objetivo = profundidad_cimentacion + desplante
        acumulado = 0.0

        for fila_estrato in datos_estratos:
            h_i = fila_estrato["h"]
            gamma_i = fila_estrato["Yn"]

            if acumulado + h_i <= profundidad_cimentacion:
                acumulado += h_i
                continue

            if acumulado < profundidad_cimentacion:
                h_parcial = acumulado + h_i - profundidad_cimentacion
                q += h_parcial * gamma_i
                acumulado += h_i
                continue

            if acumulado + h_i <= profundidad_objetivo:
                q += h_i * gamma_i
                acumulado += h_i
            else:
                h_residual = profundidad_objetivo - acumulado
                q += h_residual * gamma_i
                acumulado = profundidad_objetivo
                break

    Nc = Nq = Ny = 0.0
    F1 = F2 = F3 = 0.0

    # Initialize factors for reporting
    Fcs = Fqs = Fys = 1.0
    Fcd = Fqd = Fyd = 1.0
    Fci = Fqi = Fyi = 1.0

    if metodo == "Therzaghi":
        idx = int(round(phi))
        idx = max(0, min(50, idx))
        factores = {
            0:  (5.7,   1.00,   0.00),
            1:  (6.0,   1.10,   0.01),
            2:  (6.3,   1.22,   0.04),
            3:  (6.62,  1.35,   0.06),
            4:  (6.97,  1.49,   0.10),
            5:  (7.34,  1.64,   0.14),
            6:  (7.73,  1.81,   0.20),
            7:  (8.15,  2.00,   0.27),
            8:  (8.60,  2.21,   0.35),
            9:  (9.09,  2.44,   0.44),
            10: (9.61,  2.69,   0.56),
            11: (10.16, 2.98,   0.69),
            12: (10.76, 3.29,   0.85),
            13: (11.41, 3.63,   1.04),
            14: (12.11, 4.02,   1.26),
            15: (12.86, 4.45,   1.52),
            16: (13.68, 4.92,   1.82),
            17: (14.60, 5.45,   2.18),
            18: (15.12, 6.04,   2.59),
            19: (16.56, 6.70,   3.07),
            20: (17.69, 7.44,   3.64),
            21: (18.92, 8.26,   4.31),
            22: (20.27, 9.19,   5.09),
            23: (21.75, 10.23,  6.00),
            24: (23.36, 11.40,  7.08),
            25: (25.13, 12.72,  8.34),
            26: (27.09, 14.21,  9.84),
            27: (29.24, 15.90, 11.60),
            28: (31.61, 17.81, 13.70),
            29: (34.24, 19.98, 16.18),
            30: (37.16, 22.46, 19.13),
            31: (40.41, 25.28, 22.65),
            32: (44.04, 28.52, 26.87),
            33: (48.09, 32.23, 31.94),
            34: (52.64, 36.50, 38.04),
            35: (57.75, 41.44, 45.41),
            36: (63.53, 47.16, 54.36),
            37: (70.01, 53.80, 65.27),
            38: (77.50, 61.55, 78.61),
            39: (85.97, 70.61, 95.03),
            40: (95.66, 81.27,115.31),
            41: (106.81,93.85,140.51),
            42: (119.67,108.75,171.99),
            43: (134.58,126.50,211.56),
            44: (151.95,147.74,261.60),
            45: (172.28,173.28,325.34),
            46: (196.22,204.19,407.11),
            47: (224.55,241.80,512.84),
            48: (258.28,287.85,650.67),
            49: (298.71,344.63,831.99),
            50: (347.50,415.14,1072.80),
        }
        Nc, Nq, Ny = factores[idx]

        F1 = 1.3 * c * Nc
        F2 = (round((q), 2)) * Nq
        F3 = 0.4 * yefectivo * B * Ny

        if tipo_suelo == "Coh":
            CRNEnum = (1.3 * c * 5.7)
            CRNECnum = (1.3 * c * 5.7) + ((round((q), 2)) * 1)
        else:
            CRNEnum = F2 + F3
            CRNECnum = F2 + F3

    elif metodo == "Ecuación General":
        phi_deg = phi
        phi_rad = math.radians(phi_deg)

        if phi_deg == 0:
            Nq = 1
            Nc = 5.14
            Ny = 0
        else:
            Nq = round((((math.tan((math.radians(45)) + (phi_rad/2)))**2) * ((math.e)**((math.pi)*(math.tan(phi_rad))))), 2)
            Nc = round(((Nq - 1)*(1/(math.tan(phi_rad)))), 2)
            Ny = round((2*(Nq + 1)*(math.tan(phi_rad))), 2)

        Fcs = 1 + (( B / L ) * ( Nq / Nc ))
        Fqs = 1 + ( (B / L) * ( math.tan(phi_rad)) )
        Fys = 1 - (0.4 * (B/L))

        if (desplante/B) <= 1:
            if phi_deg == 0:
                Fcd = 1 + ((0.4)*( desplante / B ))
                Fqd = 1
                Fyd = 1
            elif phi_deg > 0:
                Fqd = 1 + ((2)*(math.tan(phi_rad))*((1-(math.sin(phi_rad)))**2)*(desplante / B)) 
                Fcd = Fqd - ((1-Fqd)/(Nc*(math.tan(phi_rad))))
                Fyd = 1
            else:
                Fcd = Fqd = Fyd = 1
        elif (desplante/B) > 1:
            if phi_deg == 0:
                Fcd = 1 + ((0.4)*(math.atan(desplante/B)))
                Fqd = 1
                Fyd = 1
            elif phi_deg > 0:
                Fqd = 1 + ((2)*(math.tan(phi_rad))*((1-(math.sin(phi_rad)))**2)*(math.atan(desplante/B)))
                Fcd = Fqd - ((1-Fqd)/(Nc*(math.tan(phi_rad))))
                Fyd = 1
            else:
                Fcd = Fqd = Fyd = 1
        else:
            Fcd = Fqd = Fyd = 1

        Fci = ((1 - (angulo/90))**2)
        Fqi = Fci
        if phi_deg != 0:
            Fyi = (1-((angulo)/(phi_deg)))**2
        else:
            Fyi = 1

        F1 = c * Nc * Fcs * Fcd * Fci
        F2 = (round((q), 2)) * Nq * Fqs * Fqd * Fqi
        F3 = 0.5 * yefectivo * B * Ny * Fys * Fyd * Fyi

        if tipo_suelo == "Coh":
            if (desplante/B) <= 1:
                CRNEnum = (c * 5.14 * (1 + (( B / L ) * ( 1 / 5.14 ))) * (1 + ((0.4)*( desplante / B ))) * Fci)
                CRNECnum = (c * 5.14 * (1 + (( B / L ) * ( 1 / 5.14 ))) * (1 + ((0.4)*( desplante / B ))) * Fci) + ((round((q), 2)) * 1 * 1 * 1 * Fqi)
            elif (desplante/B) > 1:
                CRNEnum = (c * 5.14 * (1 + (( B / L ) * ( 1 / 5.14 ))) * ((1 + ((0.4)*(math.atan(desplante/B)))) * Fci))
                CRNECnum = (c * 5.14 * (1 + (( B / L ) * ( 1 / 5.14 ))) * ((1 + ((0.4)*(math.atan(desplante/B)))) * Fci)) + ((round((q), 2)) * 1 * 1 * 1 * Fqi)
        else:
            CRNEnum = F2 + F3
            CRNECnum = F2 + F3

    elif metodo == "RNE":
        phi_deg = phi
        phi_rad = math.radians(phi_deg)

        if phi_deg == 0:
            Nq = 5.14
            Nc = 1
            Ny = 0
        else:
            Nq = round((((math.e)**((math.pi)*(math.tan(phi_rad))))*((math.tan((math.radians(45))+((phi_rad)/2)))**2)), 2)
            Nc = round(((Nq - 1)*(1/(math.tan(phi_rad)))), 2)
            Ny = round(((Nq - 1)*(math.tan((1.4)*(phi_rad)))), 2)

        Fcs = 1 + ((0.2)*(B/L))
        Fci = ((1 - (angulo/90))**2)
        Fqi = Fci
        Fys = (1 - ((0.2)*(B/L)))
        
        if phi_deg != 0:
            Fyi = ((1 - ((angulo) / (phi_deg)))**2)
        else:
            Fyi = 1

        F1 =  Fcs * Fci * c * Nc
        F2 = Fqi * (round((q), 2)) * Nq
        F3 = 0.5 * Fys * Fyi * yefectivo * B * Ny

        if tipo_suelo == "Coh":
            CRNEnum = Fcs * Fci * c * 5.14
            CRNECnum = (Fcs * Fci * c * 5.14) + (Fqi * (round((q), 2)) * 1 )
        else:
            CRNEnum = F2 + F3
            CRNECnum = F2 + F3
    else:
        Nc = Nq = Ny = F1 = F2 = F3 = 41000
        q = 410000

    q_ult = F1 + F2 + F3
    q_res = q_ult / FS if FS and FS != 0 else 0.0
    Q_max = q_res * (B * L)
    
    # --- FIN DE LÓGICA MÉTRICO. CONVERTIR DE VUELTA A SI ---
    
    return {
        "designStratumIndex": estr - 1,
        "designStratum": input_data["strata"][estr - 1],
        "bearingFactors": {"Nc": Nc, "Nq": Nq, "Ngamma": Ny},
        "shapeFactors": {"sc": Fcs, "sq": Fqs, "sgamma": Fys},
        "depthFactors": {"dc": Fcd, "dq": Fqd, "dgamma": Fyd},
        "inclinationFactors": {"ic": Fci, "iq": Fqi, "igamma": Fyi},
        "q": q * G_CONST,
        "waterTableCase": 1 if tiene_nivel_freatico else 3,
        "gammaEffective": yefectivo * G_CONST,
        "qu": q_ult * G_CONST,
        "qnet": (q_ult - q) * G_CONST,
        "qa": q_res * G_CONST,
        "qaNet": ((q_ult - q) / FS if FS else 0.0) * G_CONST,
        "method": method_key,
        "Qmax": Q_max * G_CONST, # Fuerza en kN (q_res en kN/m² * m²)
        "F1": F1 * G_CONST,
        "F2": F2 * G_CONST,
        "F3": F3 * G_CONST,
        "soilType": tipo_suelo,
        "rneConsideration": {
            "qultRNE": CRNEnum * G_CONST,
            "qultRNECorrected": CRNECnum * G_CONST,
            "qadmRNE": (CRNEnum / FS if FS else 0.0) * G_CONST
        },
        "warnings": ["Ejecutando motor ProyectoC (legacy mode). Posibles diferencias numéricas."]
    }
