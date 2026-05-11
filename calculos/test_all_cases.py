import sys
import importlib.util
import tkinter as tk

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
    legacy_module.factor_L_var.set(foundation["L"] / foundation["B"] if foundation["type"] == "rectangular" else 1.0)
    legacy_module.actualizar_campos_dimension()
    if foundation["type"] == "rectangular":
        legacy_module.longitud_L_var.set(foundation["L"]) 
    legacy_module.desplante_var.set(foundation["Df"])
    legacy_module.tiene_inclinacion_var.set(foundation["beta"] > 0)
    legacy_module.angulo_var.set(foundation["beta"])
    legacy_module.factor_seguridad_var.set(foundation["FS"])

    legacy_module.tiene_nivel_freatico_var.set(conditions["hasWaterTable"])
    legacy_module.profundidad_freatica_var.set(conditions.get("waterTableDepth", 0.0))
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
        elif text and ":" in text:
            try: return float(text.split(":")[1].strip())
            except: pass
        return None

    return {
        "qult": extract_val(legacy_module.etiqueta_qult),
        "qadm": extract_val(legacy_module.etiqueta_qadm),
        "q": extract_val(legacy_module.etiqueta_q)
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
        "qadm": res["qa"] / G,
        "q": res["q"] / G
    }

def test_all_cases():
    cases = [
        {"method": "terzaghi", "type": "cuadrada", "NF": False, "angle": 0.0},
        {"method": "terzaghi", "type": "cuadrada", "NF": True, "angle": 0.0},
        {"method": "general", "type": "cuadrada", "NF": False, "angle": 0.0},
        {"method": "general", "type": "cuadrada", "NF": True, "angle": 0.0},
        {"method": "general", "type": "cuadrada", "NF": False, "angle": 1.0},
        {"method": "general", "type": "cuadrada", "NF": True, "angle": 1.0},
        {"method": "general", "type": "rectangular", "NF": False, "angle": 0.0},
        {"method": "general", "type": "rectangular", "NF": True, "angle": 0.0},
        {"method": "general", "type": "rectangular", "NF": False, "angle": 1.0},
        {"method": "general", "type": "rectangular", "NF": True, "angle": 1.0},
    ]

    print(f"{'Method':<10} | {'Type':<12} | {'NF':<5} | {'Angle':<5} | {'L Qult':<10} | {'M Qult':<10} | {'L Qadm':<10} | {'M Qadm':<10} | {'Diff(Qadm)':<10}")
    print("-" * 115)

    for case in cases:
        foundation = {
            "type": case["type"],
            "B": 2.0,
            "L": 3.0 if case["type"] == "rectangular" else 2.0,
            "Df": 1.5,
            "beta": case["angle"],
            "FS": 3.0
        }
        conditions = {
            "hasWaterTable": case["NF"],
            "waterTableDepth": 1.0 if case["NF"] else 0.0,
            "hasBasement": False,
            "basementDepth": 0.0
        }
        strata = [
            {"thickness": 10.0, "gamma": 1.9, "gammaSat": 2.1, "c": 2.0, "phi": 28.0}
        ]

        # Reset legacy angle when 0 to avoid leftover state
        if case["angle"] == 0.0:
            legacy_module.tiene_inclinacion_var.set(False)

        res_l = run_legacy(foundation, conditions, strata, case["method"])
        res_m = run_modern(foundation, conditions, strata, case["method"])

        l_qult = res_l["qult"] if res_l["qult"] is not None else 0.0
        m_qult = res_m["qult"] if res_m["qult"] is not None else 0.0
        l_qadm = res_l["qadm"] if res_l["qadm"] is not None else 0.0
        m_qadm = res_m["qadm"] if res_m["qadm"] is not None else 0.0

        diff = abs(l_qadm - m_qadm)
        
        method_str = case["method"]
        type_str = case["type"]
        nf_str = str(case["NF"])
        ang_str = str(case["angle"])
        
        print(f"{method_str:<10} | {type_str:<12} | {nf_str:<5} | {ang_str:<5} | {l_qult:<10.4f} | {m_qult:<10.4f} | {l_qadm:<10.4f} | {m_qadm:<10.4f} | {diff:<10.4f}")

if __name__ == '__main__':
    test_all_cases()
