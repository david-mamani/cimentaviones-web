# Motor — Manejo de Asentamientos

**Propósito:** definir cómo el motor (`calculos/settlement.py`) calcula
asentamientos elásticos, por consolidación y la presión admisible por
asentamiento. Cubre las decisiones tomadas tras la consulta a NotebookLM
(Das 9ed §9, Bowles 1996, RNE E.050) sobre las preguntas en
`PREGUNTAS_ASENTAMIENTOS.md`.

> Referencias `[archivo:línea]` apuntan al motor actual / propuesto.

---

## Índice

1. [Inputs relevantes a asentamiento](#1-inputs-relevantes)
2. [Zona de influencia z̄](#2-zona-de-influencia-z)
3. [Es equivalente (perfil multi-estrato)](#3-es-equivalente)
4. [μ del suelo (no se promedia)](#4-μ-del-suelo)
5. [Factor de forma Is (Steinbrenner)](#5-factor-is-steinbrenner)
6. [Factor de profundidad If (Fox 1948)](#6-factor-if-fox)
7. [Asentamiento elástico Se](#7-asentamiento-elástico-se)
8. [Corrección por nivel freático Cw](#8-corrección-cw)
9. [Asentamiento por consolidación primaria Sc](#9-consolidación-sc)
10. [Asentamiento total S](#10-asentamiento-total)
11. [Inversión qadm = f(Se_max)](#11-inversión-qadm)
12. [Iteración paramétrica qadm(B)](#12-iteración-paramétrica)
13. [Distorsión angular (RNE E.050)](#13-distorsión-angular)
14. [Criterio final qadm de diseño](#14-criterio-final-qadm)
15. [Acoplamiento con excentricidad](#15-acoplamiento-con-excentricidad)
16. [Output completo](#16-output-completo)
17. [Diagrama de flujo](#17-diagrama-de-flujo)
18. [Tabla de decisiones (referencias NotebookLM)](#18-tabla-de-decisiones)
19. [UI: pestaña "Asentamientos"](#19-ui-pestaña-asentamientos)

---

## 1. Inputs relevantes

### 1.1 Por estrato (campos opcionales para asentamiento)

| Campo | Tipo | Default | Significado |
| --- | --- | --- | --- |
| `Es` | float (kPa) | `None` | Módulo de elasticidad del suelo |
| `mu_s` | float | `None` | Coeficiente de Poisson (0 ≤ μ < 0.5) |
| `is_clay` | bool | `False` | Marca el estrato como arcilla (activa Sc) |
| `Cc` | float | `None` | Índice de compresión (requerido si arcilla NC/OC) |
| `Cs` | float | `None` | Índice de recompresión (requerido si OC) |
| `e0` | float | `None` | Relación de vacíos inicial |
| `sigma_c` | float (kPa) | `None` | Presión de preconsolidación σ'c (None ⇒ NC) |

> Las correlaciones para `Es` quedan a discreción del usuario; el motor
> expone helpers (`Es_from_cu(cu, β)`, `Es_from_N60_kulhawy_mayne(N60, α)`)
> pero NO infiere `Es` automáticamente. Si un estrato dentro de la zona
> de influencia carece de `Es` válido, se lanza `ValueError`.

### 1.2 Globales

| Campo | Tipo | Default | Significado |
| --- | --- | --- | --- |
| `S_max` | float (m) | `0.025` | Asentamiento admisible (típicamente 25 mm) |
| `point` | `"centro" \| "esquina"` | `"centro"` | Punto donde se evalúa Se |
| `rigid` | bool | `False` | Aplicar factor de rigidez (×0.93 o Das Tabla 9.2) |
| `H_rigid` | float (m) | auto | Profundidad de la base al estrato rígido. Si `None`, auto-detectar (Es ≥ 10·Es_arriba) |
| `Cw_method` | `"peck" \| "teng" \| "bowles" \| "off"` | `"peck"` | Método para Cw |
| `consolidation` | bool | `False` | Calcular Sc en estratos con `is_clay=True` |
| `mu_s_override` | float \| `None` | `None` | Forzar μ específico (omite el del estrato bajo la base) |

---

## 2. Zona de influencia z̄

`calculos/settlement.py:_compute_influence_zone`:

### 2.1 Regla del curso (Das, 8ed §9)

$$
\bar{z} = \min(H, 5B)
$$

Donde:
- `H` = profundidad de la base al estrato rígido.
- `5B` = bulbo de presiones típico para zapatas en arenas (Das).

**Cambio vs versión previa del motor:** se incrementa
`z_influence_ratio` de `2.0` → `5.0` (D A.1, confirmado por NotebookLM).

> **Métodos distintos usan otros bulbos:**
> - Schmertmann: `z₂ = 2B` (cuadrada/circular), `4B` (corrida L/B ≥ 10).
> - Burland-Burbidge: `z' = 1.41·B·(B/B_R)⁻⁰·²⁵` o `2B` (según N60).
>
> El motor solo implementa Steinbrenner ⇒ usa `5B`. Si se añade
> Schmertmann en el futuro, usar la `z` propia del método.

### 2.2 Auto-detección de H

Criterio Bowles (citado por Das, **D A.18 — confirmado NotebookLM**):
comparar contra el estrato **inmediatamente superior**, no contra el
promedio ponderado (evita circularidad).

$$
E_{s,\text{rígido}}^{(i)} \geq 10 \cdot E_{s}^{(i-1)}
$$

Algoritmo (a partir de la base de la zapata):
1. Recorrer estratos bajo `Df_abs`.
2. Para cada estrato `i` bajo la base con `Es_i` válido, comparar contra
   `Es` del estrato `i−1` (también bajo la base si existe).
3. Cuando se cumple `Es_i ≥ 10·Es_{i−1}`, fijar `H` = profundidad
   superior de ese estrato (medida desde la base de la zapata).
4. Si no se encuentra dentro de `Df_abs + 5·B` ⇒ asumir
   `H = 5·B` (no hay rígido; el aporte de Δσ a más profundidad
   es despreciable).

Si el usuario provee `H_rigid` explícito (>0), se respeta.

---

## 3. Es equivalente

`calculos/settlement.py:equivalent_Es_multilayer`:

### 3.1 Fórmula (Das Ec. 9.23)

$$
\boxed{\ E_{s,\text{eq}} = \dfrac{\sum_{i} E_{s,i}\,\Delta z_i}{\sum_{i} \Delta z_i}\ }
$$

Donde la sumatoria es sobre todos los estratos `i` que intersectan
la zona de influencia `[Df_abs, Df_abs + z̄]`.

Implementación actual ya correcta (NotebookLM lo confirma como método
canónico de Das). Solo cambia el rango por el aumento de `z̄`.

### 3.2 Validaciones

- Cada estrato dentro del bulbo debe tener `Es > 0`; si no, `ValueError`.
- Si la zona de influencia no intersecta ningún estrato (`Df_abs` mal
  configurado), `ValueError`.

### 3.3 Correlaciones para Es (referencia, NO automáticas)

| Suelo | Correlación | Fórmula | Notas |
| --- | --- | --- | --- |
| Arcilla saturada | Es = β·cu (Das Tabla 9.1) | β ∈ [75, 1500] según PI, OCR | Usar **Eu** (no drenado), μ → 0.5 |
| Arena (SPT) | Kulhawy & Mayne 1990 | `Es/pa = α·N₆₀`; α = 5 (con finos), 10 (limpia NC), 15 (limpia OC) | Usar **E'** (drenado), μ ≈ 0.30 |
| Arena (CPT) | Schmertmann | `Es = 2.5·qc` (cuadrada), `3.5·qc` (corrida) | — |

---

## 4. μ del suelo

### 4.1 NO se promedia

**Decisión** (D A.4): el motor **no** promedia `μ` por espesor entre
estratos. Promediar μ entre capas heterogéneas (arena drenada μ=0.30 +
arcilla saturada μ→0.5) carece de sentido mecánico.

### 4.2 Regla de selección

Prioridad para elegir `μ_s` a usar en Steinbrenner:

1. `mu_s_override` si el usuario lo provee.
2. `μ` del estrato directamente bajo la base de la zapata.
3. Fallback: `μ = 0.30` (arena seca/media, Das §9).

### 4.3 Tabla de valores típicos (Das Tabla 4.5)

| Suelo | μ |
| --- | --- |
| Arena suelta a media | 0.20 – 0.40 |
| Arena densa | 0.30 – 0.45 |
| Arcilla saturada (no drenada) | ≈ 0.5 (estrictamente < 0.5) |
| Arcilla parcialmente drenada | 0.30 – 0.40 |

---

## 5. Factor Is (Steinbrenner)

`calculos/settlement.py:steinbrenner_Is`:

### 5.1 Fórmulas (Das Ecs. 9.11–9.16)

$$
I_s = F_1 + \frac{1 - 2\mu}{1 - \mu}\,F_2
$$

$$
F_1 = \frac{A_0 + A_1}{\pi}, \qquad F_2 = \frac{n'}{2\pi}\,\arctan(A_2)
$$

Con:

$$
A_0 = m'\,\ln\!\left[\frac{(1+\sqrt{m'^2+1})\sqrt{m'^2+n'^2}}{m'\,(1+\sqrt{m'^2+n'^2+1})}\right]
$$

$$
A_1 = \ln\!\left[\frac{(m'+\sqrt{m'^2+1})\sqrt{1+n'^2}}{m'+\sqrt{m'^2+n'^2+1}}\right]
$$

$$
A_2 = \frac{m'}{n'\sqrt{m'^2+n'^2+1}}
$$

Argumentos según el punto:
- **Centro:** `m' = L/B`, `n' = 2·H/B`, multiplicador externo `α = 4`,
  `B_used = B/2`.
- **Esquina:** `m' = L/B`, `n' = H/B`, `α = 1`, `B_used = B`.

### 5.2 Edge case: arctan negativo

**Decisión** (D A.5): si `m²·n² > m²+n²+1` el arctan se vuelve negativo
y Das exige sumar `π`:

```python
val = A2_arg
arctan = math.atan(val)
if (m*m * n*n) > (m*m + n*n + 1.0):
    arctan += math.pi
F2 = (n / (2.0 * math.pi)) * arctan
```

(Actualmente el motor no contempla este caso ⇒ habrá que parchearlo.)

### 5.3 Edge case: μ = 0.5

Cuando `μ → 0.5` (arcilla saturada no drenada), el coeficiente
`(1−2μ)/(1−μ)` tiende a 0. NotebookLM confirma que en Das **`Is` se
reduce a `F1` puro** sin reformulación adicional.

**Decisión** (D A.6): en `μ = 0.5` el motor devuelve `Is = F1` (en
lugar de `ValueError` como hoy). Para `μ` exactamente en `0.5` o muy
cercano, se aplica el límite.

```python
EPS_MU = 1e-9
if abs(mu_s - 0.5) < EPS_MU:
    Is = F1
else:
    Is = F1 + ((1.0 - 2.0*mu_s)/(1.0 - mu_s)) * F2
```

---

## 6. Factor If (Fox)

`calculos/settlement.py:If_factor`:

### 6.1 Decisión (D A.7): digitalizar el ábaco de Fox 1948

NotebookLM confirma que **Das 9ed solo entrega los ábacos** (Fig. 9.5)
para:
- `L/B ∈ {1, 2, 5}`
- `Df/B ∈ [0, 2]`
- Tres curvas por μ (típicamente 0, 0.3, 0.5)

Usar `If = 1.0` constante **sobre-estima Se hasta un 100 %** (el factor
real puede caer a `0.53` en `Df/B = 2`).

### 6.2 Tabla Fox digitalizada (Das 9ed Fig. 9.6, interpolación visual NotebookLM)

| Df/B | L/B=1, μ=0.30 | L/B=1, μ=0.40 | L/B=1, μ=0.50 | L/B=2, μ=0.30 | L/B=2, μ=0.40 | L/B=2, μ=0.50 | L/B=5, μ=0.30 | L/B=5, μ=0.40 | L/B=5, μ=0.50 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 0.0 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| 0.2 | 0.90 | 0.92 | 0.94 | 0.92 | 0.94 | 0.95 | 0.94 | 0.96 | 0.97 |
| 0.4 | 0.82 | 0.85 | 0.88 | 0.85 | 0.88 | 0.91 | 0.88 | 0.91 | 0.94 |
| 0.6 | 0.74 | 0.78 | 0.82 | 0.78 | 0.82 | 0.87 | 0.83 | 0.87 | 0.91 |
| 0.8 | 0.68 | 0.72 | 0.77 | 0.72 | 0.77 | 0.83 | 0.78 | 0.83 | 0.88 |
| 1.0 | 0.63 | 0.67 | 0.72 | 0.68 | 0.73 | 0.79 | 0.74 | 0.79 | 0.85 |
| 1.5 | 0.55 | 0.60 | 0.67 | 0.60 | 0.66 | 0.73 | 0.67 | 0.73 | 0.79 |
| 2.0 | 0.51 | 0.56 | 0.62 | 0.54 | 0.61 | 0.68 | 0.61 | 0.68 | 0.75 |

### 6.3 Implementación

1. Interpolación lineal en `Df/B` (8 puntos).
2. Interpolación lineal en `μ` (3 puntos: 0.30, 0.40, 0.50).
3. Interpolación lineal en `L/B` (3 puntos: 1, 2, 5).
4. **Clamping** (NotebookLM confirma):
   - `Df/B > 2` → congelar a `Df/B = 2` (warning emitido).
   - `L/B > 5` → congelar a `L/B = 5` (warning).
   - `μ < 0.30` → congelar a `μ = 0.30`.
   - `μ > 0.50` → no aplica (μ ya está limitado a <0.5).
5. `L/B ≥ 1` siempre (convención B ≤ L).

### 6.4 Salida del helper

```python
def If_factor(Df, B, L, mu_s) -> dict:
    return {
        "If": float,
        "Df_over_B": float,
        "L_over_B": float,
        "out_of_range": bool,  # True si Df/B>2 o L/B>5
    }
```

---

## 7. Asentamiento elástico Se

`calculos/settlement.py:elastic_settlement`:

### 7.1 Fórmula de Schleicher/Steinbrenner (Das §9)

**q₀ es la presión NETA** (D A.16, NotebookLM):

$$
q_0 = \frac{Q}{A} - \gamma \cdot D_f
$$

Por consistencia, `qadm_asent` también es **NETA**; al comparar con
`qadm_falla` ambos deben estar en la misma base (RNE E.050).

**Zapata flexible al CENTRO:**

$$
S_e = q_0 \cdot 4 \cdot \frac{B}{2} \cdot \frac{1-\mu_s^2}{E_s} \cdot I_s \cdot I_f
$$

**Zapata flexible en ESQUINA:**

$$
S_e = q_0 \cdot 1 \cdot B \cdot \frac{1-\mu_s^2}{E_s} \cdot I_s \cdot I_f
$$

**Zapata RÍGIDA** (D A.17, NotebookLM): "una zapata rígida se
asienta uniformemente — no tiene esquina con asentamiento distinto".

$$
S_{e,\text{rígido}} = 0.93 \cdot S_{e,\text{flexible,centro}}
$$

Por tanto: la combinación `point="esquina"` + `rigid=True` está
**prohibida**; el motor fuerza `point="centro"` y emite warning.

> **Sobre el factor 0.93:** Das también ofrece la Tabla 9.2 con factores
> diferenciados por `L/B`. Por ahora se mantiene `0.93` por simplicidad;
> queda como mejora futura (D A.8).

### 7.2 Notación de `B'` (Schleicher) ≠ `B'` (Meyerhof)

> **¡CRÍTICO!** En las ecuaciones de Steinbrenner/Schleicher, `B'`
> significa `B/2` (centro) o `B` (esquina), por la división de la
> zapata en 4 cuadrantes. **NO** es el `B' = B − 2·e₂` de Meyerhof
> (excentricidad).
>
> En el motor evitamos la ambigüedad usando `B_used`. En la UI:
> - "B' (Meyerhof)" → dimensión efectiva por excentricidad
> - "B/α (Schleicher)" → dimensión geométrica del cuadrante (B/2 al centro)

---

## 8. Corrección Cw

### 8.1 Decisión (D A.9): Cw SÍ aplica al método elástico

NotebookLM confirma que la corrección por nivel freático **sí aplica
al asentamiento elástico** en suelos granulares (Terzaghi: la sumersión
reduce la rigidez efectiva ⇒ el motor sumerge la zona del bulbo). Mi
suposición previa (Cw solo para SPT) era errónea.

### 8.2 Tres fórmulas implementadas

Con `Dw` = profundidad del NF desde la superficie:

| Método | Fórmula | Rango |
| --- | --- | --- |
| Peck-Hansen-Thornburn (1974) | `Cw = 1 / (0.5 + 0.5·Dw/(Df+B))` | `≥ 1` |
| Teng (1982) | `Cw = 1 / (0.5 + 0.5·(Dw − Df)/B)` | `≤ 2` |
| Bowles (1977) | `Cw = 2 − Dw/(Df+B)` | — |

**Default:** Peck-Hansen-Thornburn.

### 8.3 Aplicación

$$
S_e^{\text{corregido}} = S_e \cdot C_w
$$

Equivalentemente al invertir:

$$
q_{adm} = \frac{S_{e,\max}/C_w}{(\alpha\cdot B/\alpha)\cdot (1-\mu^2)/E_s \cdot I_s \cdot I_f}
$$

### 8.4 Caso NF SOBRE la base (Dw < Df)

**Decisión** (D A.15, NotebookLM): si el NF cae arriba del nivel de
desplante, Teng está fuera de su rango (Teng explícito: "para NF
bajo la base"), y Peck/Bowles dan `Cw = 2.0` (caso totalmente
sumergido, Terzaghi: doblar Se). El motor **fuerza `Cw = 2`** para
cualquier `Dw ≤ Df` sin importar el método elegido, y emite warning.

### 8.5 Cuándo NO se aplica

- `has_water_table = False` o `Dw ≥ Df + 5B` (NF fuera del bulbo) ⇒ Cw = 1.0.
- `Cw_method = "off"` (el usuario lo desactiva).

---

## 9. Consolidación Sc

`calculos/settlement.py:consolidation_settlement`:

Tres casos según el estado de consolidación de la arcilla, evaluados
al centro del estrato consolidable:

### 9.1 Normalmente consolidada (NC)

$$
S_c = \frac{C_c\,H_c}{1+e_0}\,\log_{10}\!\left(\frac{\sigma'_0 + \Delta\sigma'}{\sigma'_0}\right)
$$

### 9.2 Sobreconsolidada — Caso 1 (σ'₀ + Δσ' < σ'c)

$$
S_c = \frac{C_s\,H_c}{1+e_0}\,\log_{10}\!\left(\frac{\sigma'_0 + \Delta\sigma'}{\sigma'_0}\right)
$$

### 9.3 Sobreconsolidada — Caso 2 (σ'₀ < σ'c < σ'₀ + Δσ')

$$
S_c = \frac{C_s\,H_c}{1+e_0}\,\log_{10}\!\left(\frac{\sigma'_c}{\sigma'_0}\right)
     + \frac{C_c\,H_c}{1+e_0}\,\log_{10}\!\left(\frac{\sigma'_0 + \Delta\sigma'}{\sigma'_c}\right)
$$

### 9.4 Δσ promedio en el estrato (Simpson 1/6)

$$
\Delta\sigma'_{av} = \frac{\Delta\sigma'_t + 4\,\Delta\sigma'_m + \Delta\sigma'_b}{6}
$$

Con `Δσ'_t/m/b` evaluados a `z = z_top/z_mid/z_bot` del estrato (medidos
desde la base de la zapata).

### 9.5 Δσ a profundidad z

Método **2:1** (Das §8) por defecto:

$$
\Delta\sigma(z) = q_0 \cdot \frac{B \cdot L}{(B+z)(L+z)}
$$

Método **Newmark** (Boussinesq integrado): placeholder por superposición
de 4 cuadrantes — pendiente de implementar.

### 9.6 Cuándo aplica

- Estratos con `is_clay = True` dentro de la zona de influencia.
- Requiere `Cc`, `e0`; opcionalmente `Cs` y `σ'c` para casos OC.
- `σ'₀` puede pasarse manual o se calcula con
  `effective_initial_stress(strata, z_mid, has_water_table, Dw)`.

### 9.7 Bulbo parcial sobre arcilla (D A.19, NotebookLM)

Si el estrato consolidable está parcialmente dentro del bulbo de
`5·B`, **se trunca**:
- `Hc` usado = solo la porción dentro del bulbo.
- `Δσ_av (Simpson)` se evalúa con `z_top, z_mid, z_bot` de la **porción
  parcial**, NO del estrato completo.

---

## 10. Asentamiento total

$$
\boxed{\ S_{\text{total}} = S_e \cdot C_w + \sum_{\text{capas arcilla}} S_{c,i}\ }
$$

Donde:
- `Se` es el asentamiento elástico inmediato (suelo "fully drained" sands,
  o "undrained Eu" clays — depende de los Es elegidos por estrato).
- `Cw` se aplica solo a la parte elástica en arenas con NF.
- `Sc` se suma para cada estrato arcilloso consolidable dentro del bulbo.
- Sin doble-conteo: arcilla saturada usa `Eu`, `μ→0.5` ⇒ `Is = F1` (sin
  cambio de volumen) ⊕ después `Cc/Cs` para el cambio de volumen.

> El asentamiento secundario `Ss` (creep) **no** se implementa por ahora
> (requiere `Cα` que la base del curso no entrega).

---

## 11. Inversión qadm

`calculos/settlement.py:qadm_from_settlement_limit`:

De la ecuación elástica (centro flexible):

$$
S_{e,\max} = q\,\cdot\left(\alpha\cdot\frac{B}{\alpha}\right)\,\frac{1-\mu^2}{E_s}\,I_s\,I_f \cdot C_w
$$

Despejando:

$$
\boxed{\ q_{adm,\text{asent}} = \frac{S_{e,\max}}{B\,(1-\mu^2)/E_s\,\cdot I_s\,\cdot I_f\,\cdot C_w}\ }
$$

> Implementación: calcular `Se` con `q = 1 kPa`, luego escalar
> `qadm = S_max / Se_per_kPa`. Trivial y exacto por linealidad.

### 11.1 Limitación documentada

La relación `q ↔ Se` es lineal solo si `Es` es constante (independiente
del nivel de deformación). En la realidad `Es` decrece con la deformación
(Burland-Burbidge, Mayne-Poulos). El motor adopta `Es` constante en el
rango de servicio (simplificación estándar del método elástico clásico).

---

## 12. Iteración paramétrica qadm(B)

### 12.1 Por qué hay que re-calcular Es_eq

**Decisión** (D A.10, confirmada NotebookLM): al variar `B`, la zona de
influencia `[Df, Df + 5B]` cambia ⇒ el conjunto de estratos involucrados
cambia ⇒ `Es_eq` cambia.

### 12.2 Algoritmo

Para cada `B` en `[B_min, B_max]` con paso `B_step`:
1. Recomputar `H_rigid` si no fue dado (auto-detección depende de B sólo
   indirectamente — la regla `Es ≥ 10·Es_acumulado` es global).
2. Recomputar `z̄ = min(H, 5·B)`.
3. Recomputar `Es_eq` con la nueva zona.
4. (Si se selecciona `μ` por estrato dominante: re-evaluar también μ.)
5. Calcular Is, If, Se(q=1), qadm = S_max / Se_per_kPa · Cw.
6. Reportar también `Se` con `q_aplicada` para chequeo `Se ≤ S_max`.

### 12.3 B óptimo

Criterio del curso: el `B` mínimo tal que
- `qadm_diseño = min(qadm_falla, qadm_asent) ≥ q_aplicada`, y
- `S_total(q_aplicada, B) ≤ S_max`.

---

## 13. Distorsión angular

`calculos/settlement.py:angular_distortion`:

### 13.1 Definición

$$
\alpha = \frac{\delta}{L_{\text{cols}}}
\quad \text{con}\quad \delta = |S_{\text{total},A} - S_{\text{total},B}|
$$

**Decisión** (D A.11, NotebookLM): se usa el asentamiento **total**
(Se + Sc + Ss), no solo el instantáneo.

### 13.2 Tabla 8 (RNE E.050) — prescriptiva

| Condición | α = δ/L admisible |
| --- | --- |
| Daño estructural edif. convencional | 1/150 |
| Pérdida verticalidad edif. altos rígidos | 1/250 |
| Dificultades puentes-grúa | 1/300 |
| Primeras grietas en paredes | 1/300 |
| Límite seguro sin grietas | 1/500 |
| Cimentaciones rígidas circulares (anillo) | 1/500 |
| Edif. rígidos concreto, solado ≥ 1.20 m | 1/650 |
| Maquinaria sensible a asentamientos | 1/750 |

El proyectista declara el límite aplicable en el EMS.

---

## 14. Criterio final qadm

`calculos/settlement.py:design_qadm`:

$$
\boxed{\ q_{adm,\text{diseño}} = \min(q_{adm,\text{falla}},\, q_{adm,\text{asent}})\ }
$$

**Decisión** (D A.12): regla explícita en Das y curso ("se reporta el
menor"). El RNE E.050 obliga a documentar el FS contra falla por corte
**aunque el asentamiento gobierne** (artículo 22).

Output siempre incluye:
- `qadm_falla` (resultado del bloque de capacidad de carga)
- `qadm_asent` (este bloque)
- `qadm_diseno` = min
- `criterio_gobernante` ∈ {`"falla_por_corte"`, `"asentamiento"`}
- `FS_real` aún si el asentamiento gobierna (se calcula con `qadm_falla`).

---

## 15. Acoplamiento con excentricidad

**Decisión** (D A.13, NotebookLM): el método del área efectiva de
Meyerhof (`B' = B − 2·e₂`, `L' = L − 2·e₁`) aplica **EXCLUSIVAMENTE al
cálculo de capacidad de carga por corte**.

Para asentamientos:
- Se usa `B`, `L` **originales** (no las dimensiones efectivas).
- La presión `q` se interpreta como la presión neta aplicada sobre la
  zapata completa.
- Das y RNE E.050 no indican reemplazo de B/L por dimensiones de Meyerhof
  en las fórmulas de deformación elástica.

> **Implicación práctica:** si la zapata tiene excentricidad, el motor
> NO propaga `B_eff`, `L_eff` al bloque de asentamiento. Son cálculos
> desacoplados.

---

## 16. Output completo

```jsonc
"settlement": {
  "Es_eq": float,              // kPa, ponderado en zona de influencia
  "z_bar": float,              // m, profundidad de influencia usada
  "H_rigid": float,            // m, profundidad detectada/declarada
  "H_auto_detected": bool,
  "mu_used": float,            // μ aplicado en Steinbrenner
  "mu_source": "estrato_base" | "override" | "default",
  "Es_data": {                 // breakdown por estrato
    "layers": [
      {"stratum_index": int, "Es": float, "h_eff": float, "weight": float}
    ],
    "h_total_used": float,
    "z_top": float, "z_bot": float
  },

  "Is": float,
  "F1": float, "F2": float,
  "A0": float, "A1": float, "A2": float,
  "arctan_correction_applied": bool,   // True si m²·n² > m²+n²+1

  "If": float,
  "Df_over_B": float, "L_over_B": float,
  "If_out_of_range": bool,

  "alpha": 4 | 1,
  "B_used": float,                     // B/2 (centro) ó B (esquina)
  "point": "centro" | "esquina",
  "rigid": bool,
  "rigid_factor": 0.93 | null,         // null si flexible

  "Cw": float,
  "Cw_method": "peck" | "teng" | "bowles" | "off",
  "Cw_applied": bool,

  "Se":      float,                    // m, antes de Cw
  "Se_corr": float,                    // m, Se · Cw
  "Se_mm":   float,
  "Sc":      float | null,             // suma de consolidación arcillosas
  "Sc_layers": [{...} | null],         // por capa: {case, Sc, sigma_p0, ...}
  "S_total": float,                    // m
  "S_total_mm": float,
  "S_max":   float,
  "S_max_mm": float,
  "Se_ok":   bool,                     // S_total ≤ S_max

  "qadm_settlement": float,            // kPa, despejado de S_max
  "qadm_falla": float,                 // kPa, del bloque de capacidad
  "qadm_diseno": float,                // kPa, MIN de los dos
  "criterio_gobernante": "asentamiento" | "falla_por_corte",
  "FS_real_falla": float | null,       // contra falla por corte (reportable)

  "warnings": [string]
}
```

Si el usuario no habilita asentamiento ⇒ `settlement = null`.

---

## 17. Diagrama de flujo

```
                  ┌──────────────────────────────────────┐
                  │ Inputs: B, L, Df, q_aplicada,        │
                  │ estratos (Es, μ, Cc, …), S_max       │
                  └─────────────────┬────────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ Detectar H (estrato rígido):      │
                  │  Es_capa ≥ 10·Es_acumulado        │
                  │  ⇒ H = profundidad de esa capa    │
                  │  Else H ≔ 5·B                     │
                  └─────────────────┬─────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ z̄ = min(H, 5·B)                   │
                  └─────────────────┬─────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ Es_eq = Σ(Es_i·Δz_i) / Σ Δz_i     │
                  │ en zona [Df, Df + z̄]              │
                  └─────────────────┬─────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ μ = mu_override / μ_estrato_base  │
                  │ (NO se promedia)                  │
                  └─────────────────┬─────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ Steinbrenner: m', n', A0, A1, A2  │
                  │   F1, F2, Is                      │
                  │   (fix arctan si m²n² > m²+n²+1)  │
                  │   (Is = F1 si μ ≈ 0.5)            │
                  └─────────────────┬─────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ Fox If(Df/B, L/B, μ) por          │
                  │ interpolación bilineal del ábaco  │
                  └─────────────────┬─────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ Se_flex_centro = q · (B/2) · 4 ·  │
                  │   (1-μ²)/Es_eq · Is · If          │
                  │ (×0.93 si rigid)                  │
                  └─────────────────┬─────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ Cw (Peck/Teng/Bowles)             │
                  │ Se_corr = Se · Cw                 │
                  └─────────────────┬─────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ ¿Hay arcillas consolidables       │
                  │  dentro del bulbo?                │
                  └─────┬──────────────────────┬──────┘
                     SÍ │                      │ NO
                        ▼                      │
              ┌──────────────────┐             │
              │ Para cada capa:  │             │
              │  Δσ'_av (Simpson)│             │
              │  σ'₀ (γ_eff·z)   │             │
              │  Sc por caso     │             │
              │  (NC / OC1 / OC2)│             │
              └─────────┬────────┘             │
                        │                      │
                        ▼                      ▼
                  ┌──────────────────────────────────┐
                  │ S_total = Se_corr + Σ Sc         │
                  └─────────────────┬────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ qadm_asent = S_max / [(B)·(1-μ²)/ │
                  │   Es · Is · If · Cw]              │
                  └─────────────────┬─────────────────┘
                                    │
                  ┌─────────────────▼─────────────────┐
                  │ qadm_diseño = min(qadm_falla,     │
                  │                   qadm_asent)     │
                  │ criterio_gobernante               │
                  └─────────────────┬─────────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │ output JSON  │
                            └──────────────┘
```

---

## 18. Tabla de decisiones

Decisiones tomadas tras la consulta a NotebookLM (Das 8/9ed §9 + RNE
E.050 + apuntes de clase). Cada `ID` se refleja en algún sitio del
código o este documento.

| ID | Decisión | Justificación |
| --- | --- | --- |
| **D A.1** | `z̄ = min(H, 5·B)` | Das §9 explícito para Steinbrenner |
| **D A.2** | Auto-detección de H por Es ≥ 10·Es_arriba | Bowles citado por Das |
| **D A.3** | Es_eq promedio aritmético ponderado por espesor | Das Ec. 9.23 |
| **D A.4** | NO promediar μ; usar μ del estrato bajo la base | NotebookLM: sin sustento en Das/Bowles |
| **D A.5** | Fix arctan: sumar π si `m²·n² > m²+n²+1` | Das 9ed nota explícita |
| **D A.6** | `μ = 0.5` ⇒ `Is = F1` (no error) | Das 9ed: el término (1-2μ)/(1-μ) → 0 limpiamente |
| **D A.7** | Fox If: interpolar el ábaco (L/B ∈ {1,2,5}, Df/B ∈ [0,2]) | If=1.0 sobre-estima Se hasta 100 % |
| **D A.8** | Factor 0.93 para zapata rígida (centro). Tabla 9.2 = futura mejora | Bowles 1987 vía Das |
| **D A.9** | Cw SÍ aplica al método elástico; default Peck-Hansen-Thornburn | Terzaghi: sumersión halve Es. NotebookLM da las 3 fórmulas |
| **D A.10** | Iterar B ⇒ re-computar `Es_eq` y `z̄` por cada B | Bulbo depende de B ⇒ estratos involucrados cambian |
| **D A.11** | Distorsión angular sobre S_total (Se+Sc+Ss) | RNE E.050 Tabla 8 |
| **D A.12** | `qadm_diseño = min(qadm_falla, qadm_asent)`; reportar FS aún si gobierna asentamiento | Das §9 + RNE Art. 22 |
| **D A.13** | Asentamiento usa **B, L originales**, NO B'/L' de Meyerhof | Das y RNE: Meyerhof solo para capacidad de carga |
| **D A.14** | Diferenciar `B'_Meyerhof` (excentricidad) de `B/α_Schleicher` en UI | Riesgo de confusión por notación ambigua de Das |
| **D A.15** | Cw forzado a 2 si Dw ≤ Df (NF sobre la base) | Terzaghi: sumersión total duplica Se. Teng no aplica fuera de Dw>Df |
| **D A.16** | q₀ y qadm_asent son **NETAS**: q₀ = Q/A − γ·Df | Das §9 textual: "net pressure applied" |
| **D A.17** | `rigid=True` + `point="esquina"` → forzar centro + warning | Das: zapata rígida se asienta uniformemente |
| **D A.18** | Auto-detección H: comparar contra estrato **inmediato anterior**, no promedio | Bowles citado por Das; evita circularidad |
| **D A.19** | Bulbo parcial sobre arcilla: truncar Hc al porción dentro de 5B; Δσ_av con z's de la porción | NotebookLM: la regla de 5B es del elástico; consolidación clásica usa Hc total, pero al truncar se evalúa Δσ en la porción |
| **D A.20** | Kulhawy-Mayne: α ∈ {5, 10, 15} (con-finos / limpia-NC / limpia-OC), valores exactos | Das §3 + §9 |

---

## 19. UI: pestaña "Asentamientos"

Se agrega una pestaña dedicada **"Asentamientos"** en el workspace,
análoga a la pestaña "Excentricidad". Ruta en código:

- `frontend/src/components/settlement/SettlementTab.tsx` (nuevo)
- `frontend/src/store/workspaceStore.ts` — agregar `'settlement'` a
  `TabType`
- `frontend/src/components/workspace/Workspace.tsx` — `TAB_LABELS` y
  render
- `frontend/src/components/layout/Toolbar.tsx` — botón
- `frontend/src/components/panels/PropertiesPanel.tsx` — botón "Abrir
  Asentamientos"

### 19.1 Layout

```
┌──────────────────────────────────────┬──────────────────────────┐
│                                      │ MODO ANÁLISIS            │
│                                      │  · Punto: centro/esquina │
│  Perfil del suelo (sección)          │  · Rigid: bool           │
│   - Estratos coloreados              │  · Cw: peck/teng/bowles/-│
│   - Df, NF, base de zapata           │  · μ override (opcional) │
│   - Bulbo z̄ sombreado                │                          │
│   - H detectado (línea roja)         │ LÍMITES                  │
│                                      │  · S_max (mm) [25]       │
│  Y/O chart qadm vs B                 │  · H_rigid (m) [auto]    │
│   (cuando se itera B)                │                          │
│                                      │ DERIVADOS                │
│                                      │  · z̄ = min(H, 5B)        │
│                                      │  · Es_eq (kPa)           │
│                                      │  · μ usado               │
│                                      │  · Is, F1, F2            │
│                                      │  · If (Fox)              │
│                                      │  · Cw                    │
│                                      │  ─────────────────────── │
│                                      │  · Se (mm)               │
│                                      │  · Sc (mm) (si arcilla)  │
│                                      │  · S_total (mm)          │
│                                      │  · S_total ≤ S_max ✓/✗   │
│                                      │  ─────────────────────── │
│                                      │  · qadm_asent (kPa)      │
│                                      │  · qadm_falla (kPa)      │
│                                      │  · qadm_diseño (kPa)     │
│                                      │  · gobierna: asent/falla │
└──────────────────────────────────────┴──────────────────────────┘
```

### 19.2 Visualización izquierda

Dos modos (toggle en la cabecera):
1. **Perfil:** corte vertical mostrando estratos, Df, NF, base de
   zapata, bulbo `z̄`, estrato rígido `H`.
2. **qadm(B):** tabla iterativa + gráfico de la presión admisible
   por asentamiento vs ancho B (1.0 → 3.0 m, paso 0.1).

### 19.3 Inputs por estrato

Las columnas `Es`, `μ_s`, `Cc`, `Cs`, `e0`, `σ'c`, `is_clay` aparecen
en la tabla de estratos del `PropertiesPanel` cuando el toggle
"Asentamiento" está activo (ya existe parcialmente). Falta:
- Validar que estratos en la zona de influencia tengan `Es` y `μ`.
- Marcar visualmente cuáles entran al promedio `Es_eq`.

### 19.4 Integración con la pestaña Excentricidad

**Independientes.** La excentricidad propaga `B'`, `L'` solo al motor
de capacidad de carga; el bloque de asentamiento usa siempre `B`, `L`
originales (D A.13). Cada pestaña vive aislada en su lógica.

---

## 20. Resumen de cambios pendientes en `calculos/settlement.py`

Para alinear el motor con este documento:

1. **`equivalent_Es_multilayer`**: cambiar default `z_influence_ratio`
   de `2.0` → `5.0`.
2. **`steinbrenner_Is`**: agregar fix arctan (D A.5) y manejo de
   `μ = 0.5` (D A.6).
3. **`If_factor`**: implementar interpolación bilineal del ábaco Fox
   (D A.7).
4. **Cw**: nuevas funciones `cw_peck_hansen_thornburn`, `cw_teng`,
   `cw_bowles`, y aplicarlas en `elastic_settlement` /
   `qadm_from_settlement_limit` según `Cw_method`.
5. **Auto-detección de H**: nueva función `detect_rigid_stratum(strata,
   Df_abs, factor=10.0) -> {H, auto_detected, layer_index}`.
6. **`elastic_settlement`**: usar μ del estrato bajo la base (no
   promediar) y exponer `mu_source` en output.
7. **`Es_from_N60_kulhawy_mayne(N60, soil_kind, OCR)`**: helper de
   correlación.
8. **`calculate_total_settlement`**: orquestar el flujo del diagrama §17,
   incluyendo el bloque `Cw` y la verificación `S_total ≤ S_max`.
9. **`design_qadm`**: recibir `qadm_falla` desde el resultado del bloque
   de capacidad de carga y reportar `criterio_gobernante` + `FS_real_falla`.
10. **Tests pytest** cubriendo:
    - `z̄ = min(H, 5B)` con y sin H
    - Es_eq por integración en zonas que cruzan estratos
    - Steinbrenner con `μ = 0.5` y caso edge del arctan
    - Cw para los 3 métodos
    - Consolidación NC/OC1/OC2
    - Iteración paramétrica recomputa Es_eq por cada B
    - qadm inverso ↔ Se directo (consistencia: Se(qadm) ≈ S_max)
    - Distorsión angular vs RNE Tabla 8

---

*Documento de decisiones — bloque de asentamientos — 2026-05-22.*
