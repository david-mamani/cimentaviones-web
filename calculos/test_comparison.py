import sys
import math
import os
import importlib.util
import tkinter as tk
import numpy as np

# Mock mainloop so it doesn't block
tk.Tk.mainloop = lambda self: None
tk.Toplevel.mainloop = lambda self: None

# --- Load Legacy Engine ---
legacy_path = r"C:\Users\david\Documents\PROJECTS FOR FUN\CIMENTACIONES\Version-antigua\ProyectoC-V0.02.py"
spec = importlib.util.spec_from_file_location("legacy_engine", legacy_path)
legacy_module = importlib.util.module_from_spec(spec)
sys.modules["legacy_engine"] = legacy_module
spec.loader.exec_module(legacy_module)

# --- Load Modern Engine ---
modern_path = r"c:\Users\david\Documents\PROJECTS FOR FUN\CIMENTACIONES\cimentaviones-web\calculos\proyectoc_engine.py"
spec2 = importlib.util.spec_from_file_location("modern_engine", modern_path)
modern_module = importlib.util.module_from_spec(spec2)
sys.modules["modern_engine"] = modern_module
spec2.loader.exec_module(modern_module)


def run_legacy(foundation, conditions, strata, method):
    legacy_module.tipo_cimentacion_var.set(foundation["type"])
    legacy_module.lado_B_var.set(foundation["B"])
    legacy_module.factor_L_var.set(foundation["L"] / foundation["B"] if foundation["type"] == "rectangular" else 1.5)
    legacy_module.actualizar_campos_dimension()
    legacy_module.longitud_L_var.set(foundation["L"]) 
    legacy_module.desplante_var.set(foundation["Df"])
    legacy_module.tiene_inclinacion_var.set(foundation["beta"] > 0)
    legacy_module.angulo_var.set(foundation["beta"])
    legacy_module.factor_seguridad_var.set(foundation["FS"])

    legacy_module.tiene_nivel_freatico_var.set(conditions["hasWaterTable"])
    legacy_module.profundidad_freatica_var.set(conditions["waterTableDepth"])
    legacy_module.tiene_sotano_var.set(conditions["hasBasement"])
    legacy_module.profundidad_sotano_var.set(conditions["basementDepth"] if conditions["hasBasement"] else 0.0)

    legacy_module.num_estratos_var.set(len(strata))
    legacy_module.actualizar_tabla_estratos()
    
    method_map = {"terzaghi": "Therzaghi", "general": "Ecuación General", "rne": "RNE"}
    legacy_module.metodo_var.set(method_map[method])

    for i, s in enumerate(strata):
        phi_i = s["phi"]
        legacy_module.datos_estratos[i]["h"].set(s["thickness"])
        legacy_module.datos_estratos[i]["Yn"].set(s["gamma"])
        legacy_module.datos_estratos[i]["Ysat"].set(s["gammaSat"])
        legacy_module.datos_estratos[i]["C"].set(s["c"])
        legacy_module.datos_estratos[i]["phi"].set(phi_i)

    legacy_module.aceptar_datos()
    legacy_module.resolver()

    def extract_val(label):
        text = label.cget("text")
        if "=" in text:
            try: return float(text.split("=")[1].strip())
            except: pass
        return None

    return {
        "qult": extract_val(legacy_module.etiqueta_qult),
        "qadm": extract_val(legacy_module.etiqueta_qadm)
    }

def run_modern(foundation, conditions, strata, method):
    G = 9.80665
    mod_strata = []
    for s in strata:
        mod_strata.append({
            "thickness": s["thickness"], "gamma": s["gamma"] * G,
            "gammaSat": s["gammaSat"] * G, "c": s["c"] * G, "phi": s["phi"]
        })
    input_data = {
        "foundation": foundation, "conditions": conditions,
        "strata": mod_strata, "method": method
    }
    res = modern_module.calculate_proyectoc_bearing_capacity(input_data)
    return {
        "qult": res["qu"] / G,
        "qadm": res["qa"] / G
    }

# Parametric Test Runner
def test_iterations():
    base_case = {
        "method": "general",
        "foundation": {"type": "rectangular", "B": 0.0, "L": 0.0, "Df": 0.0, "beta": 0.0, "FS": 3.0},
        "conditions": {"hasWaterTable": True, "waterTableDepth": 1.5, "hasBasement": False, "basementDepth": 0.0},
        "strata": [{"thickness": 10.0, "gamma": 1.9, "gammaSat": 2.1, "c": 2.0, "phi": 28.0}]
    }

    Bs = np.arange(1.0, 4.5, 0.5) # 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0
    Dfs = np.arange(0.5, 3.5, 0.5) # 0.5, 1.0, 1.5, 2.0, 2.5, 3.0
    
    total_comparisons = len(Bs) * len(Dfs)
    matches = 0
    max_diff = 0.0
    
    print(f"Testing Parametric Iterations (B: 1.0->4.0, Df: 0.5->3.0) for General Rectangular w/ N.F.")
    print(f"{'B':<5} | {'Df':<5} | {'L':<5} | {'Legacy qadm':<12} | {'Modern qadm':<12} | {'Diff':<8} | {'Match?'}")
    print("-" * 75)

    for B in Bs:
        for Df in Dfs:
            L = B * 1.5 # Relación constante para L
            
            # Update variables
            base_case["foundation"]["B"] = B
            base_case["foundation"]["L"] = L
            base_case["foundation"]["Df"] = Df
            
            l_res = run_legacy(base_case["foundation"], base_case["conditions"], base_case["strata"], base_case["method"])
            m_res = run_modern(base_case["foundation"], base_case["conditions"], base_case["strata"], base_case["method"])
            
            l_qadm = l_res["qadm"]
            m_qadm = m_res["qadm"]
            
            diff = abs(l_qadm - m_qadm) if l_qadm is not None and m_qadm is not None else -1
            match = "YES" if diff < 0.02 else "NO"
            
            if diff > max_diff:
                max_diff = diff
                
            if match == "YES":
                matches += 1
            else:
                print(f"{B:<5.1f} | {Df:<5.1f} | {L:<5.1f} | {l_qadm!s:<12} | {m_qadm:.2f}       | {diff:.4f} | {match}")
                
    print("-" * 75)
    print(f"Total Iterations Tested: {total_comparisons}")
    print(f"Matches: {matches}/{total_comparisons}")
    print(f"Max numerical difference: {max_diff:.4f} tnf/m²")

test_iterations()
