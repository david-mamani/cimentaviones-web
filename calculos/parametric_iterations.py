"""
Motor de iteraciones paramétricas.

Permite variar B y/o Df en un rango y calcular una matriz
de resultados (q_adm, Q_max, etc.) para cada combinación.

Es simplemente ejecutar calculate_bearing_capacity() muchas veces
con diferentes valores de B y Df, como correr el programa varias veces.
"""

from .bearing_capacity import calculate_bearing_capacity


def _generate_range(start: float, end: float, step: float) -> list:
    """Genera una lista de valores desde start hasta end con paso step."""
    if step <= 0 or end < start:
        return [start]

    values = []
    val = start
    while val <= end + 0.0001:
        values.append(round(val, 4))
        val += step
    return values


def run_parametric_iterations(base_input: dict, config: dict) -> dict:
    """
    Ejecuta iteraciones paramétricas.

    Args:
        base_input: Input base (foundation, strata, conditions, method)
        config: Configuración con varyB, bStart, bEnd, bStep,
                varyDf, dfStart, dfEnd, dfStep

    Returns:
        dict con bValues, dfValues, matrix, annotations
    """
    # Generar rangos de B y Df
    b_values = (
        _generate_range(config["bStart"], config["bEnd"], config["bStep"])
        if config["varyB"]
        else [base_input["foundation"]["B"]]
    )
    df_values = (
        _generate_range(config["dfStart"], config["dfEnd"], config["dfStep"])
        if config["varyDf"]
        else [base_input["foundation"]["Df"]]
    )

    matrix = []
    annotations = []
    iteration = 1

    for df in df_values:
        row = []
        for b in b_values:
            # Construir input con B y Df modificados
            f_type = base_input["foundation"]["type"]
            lb_ratio = config.get("lbRatio")  # L = lbRatio × B (when locked)
            if f_type in ("cuadrada", "circular"):
                L = b
            elif lb_ratio and lb_ratio > 0:
                L = lb_ratio * b
            else:
                L = base_input["foundation"]["L"]

            modified_input = {
                **base_input,
                "foundation": {
                    **base_input["foundation"],
                    "B": b,
                    "L": L,
                    "Df": df,
                },
            }

            try:
                result = calculate_bearing_capacity(modified_input)
                L = modified_input["foundation"]["L"]
                Qmax = result["qa"] * b * L

                row.append({
                    "B": b,
                    "Df": df,
                    "result": result,
                    "Qmax": Qmax,
                })

                annotations.append(
                    f"Cálculo {iteration:02d}: "
                    f"B = {b:.3f} m, Df = {df:.3f} m → "
                    f"q_adm = {result['qa']:.3f} kPa, Q_max = {Qmax:.3f} kN"
                )
            except Exception:
                annotations.append(
                    f"Cálculo {iteration:02d}: "
                    f"B = {b:.3f} m, Df = {df:.3f} m → ERROR"
                )

            iteration += 1
        matrix.append(row)

    return {
        "bValues": b_values,
        "dfValues": df_values,
        "matrix": matrix,
        "annotations": annotations,
    }
