# Motor — Manejo de Excentricidad

**Propósito:** explicar paso a paso cómo el motor (`calculos/bearing_capacity.py`)
maneja la excentricidad de carga, después de las correcciones aplicadas tras
la revisión RC/E. Refleja el estado **actual** del código.

**Estado:** post-correcciones de NotebookLM (Das 9ed + RNE E.050 Art. 28).

> Referencias `[archivo:línea]` apuntan al motor actual.

---

## Índice

1. [Inputs relevantes a excentricidad](#1-inputs-relevantes)
2. [Detección de excentricidad](#2-detección-de-excentricidad)
3. [Dimensiones efectivas Meyerhof (B', L', A')](#3-dimensiones-efectivas-meyerhof)
4. [Régimen de presiones (kern rombo)](#4-régimen-de-presiones-kern-rombo)
5. [Aplicación a cada método](#5-aplicación-a-cada-método)
6. [Cálculo de qmax / qmin por régimen](#6-cálculo-de-qmax--qmin-por-régimen)
7. [Carga última y FS_real](#7-carga-última-y-fs_real)
8. [Bandera `valid`](#8-bandera-valid)
9. [Output completo del bloque excentricidad](#9-output-completo)
10. [Diagrama de flujo](#10-diagrama-de-flujo)
11. [Tabla de casos](#11-tabla-de-casos)
12. [Decisiones del curso documentadas](#12-decisiones-documentadas)

---

## 1. Inputs relevantes

**Convención del curso (profesor / RNE):**
- Eje **1** horizontal, eje **2** vertical. `B` paralelo al eje 1, `L` paralelo al eje 2.
- `M1 = M_x` (sobre eje 1) → `e1 = M1/Q` actúa en dirección 2 → **reduce L**.
- `M2 = M_y` (sobre eje 2) → `e2 = M2/Q` actúa en dirección 1 → **reduce B**.

| Campo | Tipo | Default | Validación | Significado |
| --- | --- | --- | --- | --- |
| `foundation.e1` | float (m) | `0.0` | `e1 ≥ 0`, `2·e1 < L` | Excentricidad por M1 — reduce L |
| `foundation.e2` | float (m) | `0.0` | `e2 ≥ 0`, `2·e2 < B` | Excentricidad por M2 — reduce B |
| `foundation.M1` | float (kN·m) | `None` | `M1 ≥ 0` si se provee | Momento sobre eje 1 horizontal (opcional). Con Q ⇒ `e1 = M1/Q` |
| `foundation.M2` | float (kN·m) | `None` | `M2 ≥ 0` si se provee | Momento sobre eje 2 vertical (opcional). Con Q ⇒ `e2 = M2/Q` |
| `foundation.Q` | float (kN) | `None` | `Q > 0` si se provee | Carga vertical total aplicada (opcional, requerida para M→e) |
| `criterion` | str | `"general"` | `∈ {general, rne, rne_corrected}` | Criterio que el usuario usa para FS_real |

Si se proveen `M1`/`M2` con `Q > 0` y la excentricidad correspondiente está en
cero, el motor deriva `e1 = M1/Q`, `e2 = M2/Q` antes de validar.

Las validaciones cross-field (Pydantic, `models.py`) rechazan:
- `2·e1 ≥ L` → "Excentricidad e1 demasiado grande" (la zapata "se sale" en L)
- `2·e2 ≥ B` → idem en B

Esto garantiza que `B_eff > 0` y `L_eff > 0` siempre.

---

## 2. Detección de excentricidad

`bearing_capacity.py:260`:

```python
has_eccentricity = (e1 > 0 or e2 > 0)
```

Si `e1 = e2 = 0` y no hay `Q` aplicada, todo el bloque de excentricidad se
omite y el output `eccentricity` queda `None`.

---

## 3. Dimensiones efectivas Meyerhof

`bearing_capacity.py:_compute_effective_dimensions`:

### 3.1 Fórmula base (Meyerhof simplificado, RNE Art. 28.2)

$$
B' = B - 2 e_2, \qquad L' = L - 2 e_1
$$

> Convención: el subíndice del eje del momento (1 = horizontal, 2 = vertical).
> `e1` proviene de `M1` sobre el eje 1 y reduce la dimensión perpendicular
> (`L`). `e2` proviene de `M2` sobre el eje 2 y reduce `B`.

### 3.2 Swap si B' > L'

Das paso 1 del método de área efectiva: *"La menor de las dos dimensiones
es el ancho efectivo de la cimentación"*.

```python
if B_eff > L_eff:
    B_eff, L_eff = L_eff, B_eff
```

Esto asegura que `B' ≤ L'` siempre, manteniendo consistencia con las
fórmulas de capacidad de carga que asumen `B ≤ L`.

> **No se pierde información direccional** porque los factores se evalúan
> con la convención correcta:
> - Forma: con `B', L'` (efectivas)
> - Profundidad: con `B` ORIGINAL
> - Inclinación: solo depende de β (no de B/L)

### 3.3 Área efectiva

$$
A' = B' \cdot L'
$$

Este es el método "simplificado" de Meyerhof (adoptado por el RNE
Art. 28.2). Das también describe un método "exacto" (Highter & Anders,
1985) con áreas poligonales y `B' = A'/L'`, **pero el curso/RNE usa el
simplificado**.

### 3.4 Caso sin excentricidad

Si `e1 = e2 = 0`, entonces `B' = B` y `L' = L`, con `A' = B·L`. Todo el
manejo de excentricidad sigue funcionando degenerando al caso ordinario.

---

## 4. Régimen de presiones (kern rombo)

`bearing_capacity.py:264-279`:

### 4.1 Criterio del kern

El kern biaxial es un **ROMBO**, NO un rectángulo. La condición para que la
zapata esté completamente en compresión (sin levantamiento) es (con la
convención profesor: `e1` actúa en L, `e2` actúa en B):

$$
\boxed{\ \frac{6\,e_1}{L} + \frac{6\,e_2}{B} \leq 1\ }
$$

```python
kern_metric = (6.0 * e1 / L) + (6.0 * e2 / B)
in_kern = kern_metric <= 1.0 + 1e-9
```

### 4.2 ¿Por qué un rombo y no un rectángulo?

Por la ecuación de Navier (esfuerzo axial + flexión), con `e1` en dirección
L (eje 2) y `e2` en dirección B (eje 1):

$$
q(x,y) = \frac{Q}{B \cdot L}\left(1 \pm \frac{6 e_2}{B} \pm \frac{6 e_1}{L}\right)
$$

Para que $q_{\min} \geq 0$ en cualquier punto de la zapata se requiere:

$$
\frac{6 e_1}{L} + \frac{6 e_2}{B} \leq 1
$$

Lo cual define un **rombo** en el espacio (e₂, e₁) con vértices en
$(B/6, 0)$, $(0, L/6)$, $(-B/6, 0)$, $(0, -L/6)$.

> **Caso típico que el criterio rectangular fallaba en detectar:**
> Si $e_1 = L/7$ y $e_2 = B/7$, individualmente cumplen $e_1 \leq L/6$ y
> $e_2 \leq B/6$, pero $\frac{6}{7} + \frac{6}{7} = \frac{12}{7} \approx 1.71 > 1$
> → fuera del kern. El criterio antiguo (rectangular) marcaría
> trapezoidal pero $q_{\min}$ saldría negativo.

### 4.3 Asignación del régimen

```python
if not has_eccentricity:
    regime = "uniforme"
elif in_kern:
    regime = "trapezoidal"
else:
    regime = "triangular"
    warnings.append("Excentricidad fuera del kern central (rombo)...")
```

| Régimen | Condición |
| --- | --- |
| `"uniforme"` | `e1 = e2 = 0` |
| `"trapezoidal"` | `e1 > 0` o `e2 > 0`, Y dentro del rombo del kern |
| `"triangular"` | Fuera del rombo del kern (hay levantamiento) |

---

## 5. Aplicación a cada método

`bearing_capacity.py:283-313`:

### 5.1 Terzaghi — NO recibe excentricidad

Por decisión del curso: Terzaghi no resuelve excentricidad. Si el usuario
provee `e1` o `e2` con `method = "terzaghi"`, se emite warning y se ignoran:

```python
if has_eccentricity and method == "terzaghi":
    warnings.append("Terzaghi no resuelve excentricidad (...). S3 se calcula con B original.")
t_res = calculate_qu_terzaghi(c, q, gamma_effective, B, phi, f_type)
```

**Terzaghi usa B (original)**, no B'. Su `Qmax = qa · B · L`.

### 5.2 Ecuación General — usa B', L', B según convención Das

```python
g_res = calculate_qu_general(
    c, q, gamma_effective,
    B,           # B_orig → Hansen (profundidad)
    B_eff,       # B' → factores de forma + tercer sumando S3
    L_eff,       # L' → factores de forma
    phi, beta,
    Df,          # Df relativo al sótano (no Df_abs)
)
```

**Convenciones (Das §6.12):**

| Componente | Dimensión que usa | Razón |
| --- | --- | --- |
| $N_c, N_q, N_\gamma$ | — (solo φ) | Factores de capacidad de carga |
| $F_{cs}, F_{qs}, F_{\gamma s}$ | **B', L'** | "Para factores de forma SÍ use B', L'" — Das |
| $F_{cd}, F_{qd}, F_{\gamma d}$ | **B original** | "Para factores de profundidad NO reemplace B con B'" — Das |
| $F_{ci}, F_{qi}, F_{\gamma i}$ | — (solo β, φ) | No dependen de B/L |
| $S_3 = \tfrac{1}{2}\gamma B' N_\gamma F_{\gamma s} F_{\gamma d} F_{\gamma i}$ | **B'** | Tercer sumando con B' |

### 5.3 RNE E.050 — usa B', L' en forma + tercer sumando

```python
r_res = calculate_qu_rne(c, q, gamma_effective, B_eff, L_eff, phi, beta)
```

RNE Art. 20.4: $\tfrac{1}{2} s_\gamma i_\gamma \gamma_2 B' N_\gamma$ explícito
con $B'$.

RNE no aplica factores de profundidad (todos = 1), así que no necesita B original.

### 5.4 Qmax legacy (área efectiva)

`bearing_capacity.py:_build_method_block`:

```python
method_blocks["general"] = _build_method_block(g_res, soil_type, FS, B_eff, L_eff)
method_blocks["rne"]     = _build_method_block(r_res, soil_type, FS, B_eff, L_eff)
method_blocks["terzaghi"]= _build_method_block(t_res, soil_type, FS, B, L)
```

Para los métodos General y RNE, `Qmax = qa · A' = qa · B_eff · L_eff`
(Das paso 3: "Qu = qu·A'"). Terzaghi mantiene `B·L` porque no acepta
excentricidad.

Sin excentricidad, `B_eff = B`, `L_eff = L`, así que el comportamiento
legacy se conserva.

---

## 6. Cálculo de qmax / qmin por régimen

`bearing_capacity.py:351-385`. Se aplica solo si `Q_applied` está provista
(`> 0`).

### 6.1 Régimen `"uniforme"` (sin excentricidad)

$$
q_{\max} = q_{\min} = \frac{Q}{B \cdot L}
$$

### 6.2 Régimen `"trapezoidal"` (dentro del rombo del kern)

`_extreme_pressures_trapezoidal`:

$$
q_{\max} = \frac{Q}{B \cdot L}\left(1 + \frac{6 e_1}{L} + \frac{6 e_2}{B}\right)
$$

$$
q_{\min} = \frac{Q}{B \cdot L}\left(1 - \frac{6 e_1}{L} - \frac{6 e_2}{B}\right)
$$

Si por algún motivo $q_{\min} < 0$ con régimen trapezoidal (no debería
pasar con el criterio del rombo), se emite warning de "inconsistencia
inesperada".

### 6.3 Régimen `"triangular"` (fuera del rombo del kern)

Tres sub-casos:

#### 6.3.1 Uniaxial en L (`e1 > 0, e2 ≈ 0`)

Das Ec. 6.53 (e1 actúa en L con la nueva convención):

$$
q_{\max} = \frac{4 Q}{3 B (L - 2 e_1)}, \qquad q_{\min} = 0
$$

#### 6.3.2 Uniaxial en B (`e2 > 0, e1 ≈ 0`)

Por simetría geométrica:

$$
q_{\max} = \frac{4 Q}{3 L (B - 2 e_2)}, \qquad q_{\min} = 0
$$

#### 6.3.3 Biaxial fuera del kern (`e1 > 0 AND e2 > 0` con $6e_1/L + 6e_2/B > 1$)

**No hay fórmula cerrada en Das.** El área en compresión es un polígono
irregular (los "casos" de Highter & Anders dan A', B', L' pero NO la
distribución de presiones).

El motor emite warning y reporta `qmax = qmin = None`:

```
"Excentricidad biaxial fuera del kern central: la distribución de
presiones es poligonal irregular y no tiene fórmula cerrada en Das.
No se reportan qmax/qmin (requiere resolución numérica del área en
compresión)."
```

> **Decisión de diseño:** preferimos reportar `None` y warning antes que
> aplicar una fórmula uniaxial al caso biaxial (lo cual sería incorrecto).

### 6.4 Tolerancia para "uniaxial" vs "biaxial"

`1e-9` para tolerar errores de punto flotante:

```python
if e1 > 1e-9 and e2 <= 1e-9:   # uniaxial en B
elif e2 > 1e-9 and e1 <= 1e-9: # uniaxial en L
else:                          # biaxial (incluye ambos > 1e-9)
```

---

## 7. Carga última y FS_real

`bearing_capacity.py:341-349`:

### 7.1 Carga última $Q_u$

Das paso 3 del método de área efectiva:

$$
\boxed{\ Q_u = q_u^{\text{principal}} \cdot A'\ }
$$

Donde `principal_qu` es el `qu` del **método elegido + criterio elegido**
por el usuario:

```python
principal_qu = method_blocks[method]["criteria"][criterion]["qu"]
Qu = principal_qu * A_eff
```

### 7.2 Factor de seguridad real

$$
\boxed{\ FS_{real} = \frac{Q_u}{Q_{\text{aplicada}}}\ }
$$

Solo se calcula si `Q_applied > 0`. Si no, `FS_real = None`.

### 7.3 Cuál criterio se usa para FS_real

Antes de las correcciones: siempre `criterion = "general"` (legacy).

Ahora: el motor lee `input_data["criterion"]` (default `"general"` si no
viene). Esto es consistente con **RNE Art. 22.2.1**: el FS se aplica a las
ecuaciones del método/criterio aplicado.

**Implicación crítica para suelo Cohesivo:** si el usuario selecciona
criterio RNE, $q_u^{RNE}$ es mucho menor que $q_u^{General}$ (porque el
RNE fuerza φ=0). Entonces $FS_{real}^{RNE} \ll FS_{real}^{General}$. El
diseño debe cumplir el FS objetivo bajo el criterio que está aplicando, no
bajo uno más permisivo.

---

## 8. Bandera `valid`

`bearing_capacity.py:339-341`:

```python
valid = None
if FS_real is not None:
    valid = FS_real >= FS
```

- `valid = True`: el diseño cumple el FS objetivo (es seguro).
- `valid = False`: $FS_{real} < FS_{objetivo}$ → rediseñar.
- `valid = None`: no se puede evaluar (no se proveyó Q aplicada).

---

## 9. Output completo

Estructura del bloque `eccentricity` en el JSON de salida:

```jsonc
"eccentricity": {
  "hasEccentricity": bool,        // e1 > 0 OR e2 > 0

  "e1": float, "e2": float,       // m
  "Q":  float | null,             // kN, carga aplicada (puede ser null)

  "B_eff": float,                 // B' (post-swap, ≤ L')
  "L_eff": float,                 // L'
  "A_eff": float,                 // B' · L'

  "regime": "uniforme" | "trapezoidal" | "triangular",

  "qmax": float | null,           // kPa, puede ser null si biaxial fuera del kern
  "qmin": float | null,

  "Qu":      float,               // kN, qu_principal · A_eff
  "FS_real": float | null,        // Qu / Q (null si Q no provista)
  "valid":   bool | null          // FS_real >= FS (null si no se evaluó)
}
```

Si no hay excentricidad ni `Q` provista, el campo entero es `null`.

---

## 10. Diagrama de flujo

```
                    ┌─────────────────────────────────┐
                    │ inputs: e1, e2, Q, criterion    │
                    └────────────┬────────────────────┘
                                 │
                  ┌──────────────▼──────────────┐
                  │ has_ecc = e1>0 OR e2>0      │
                  └──────────────┬──────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Compute B', L', A'      │
                    │ (Meyerhof simplificado) │
                    │ swap si B' > L'         │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼──────────────────────┐
        │                        │                      │
        ▼                        ▼                      ▼
  ┌──────────┐         ┌──────────────────┐     ┌──────────────┐
  │ Terzaghi │         │ Ec. General      │     │ RNE E.050    │
  │ usa B    │         │ forma: B',L'     │     │ forma: B',L' │
  │ original │         │ prof:  B orig    │     │ sin prof.    │
  │ warning  │         │ S3 con B'        │     │ S3 con B'    │
  │ si e>0   │         │ Hansen con Df    │     │              │
  └─────┬────┘         └──────────┬───────┘     └──────┬───────┘
        │                         │                    │
        └───────────────┬─────────┴────────────────────┘
                        │
            ┌───────────▼───────────┐
            │ kern_metric =         │
            │  6e1/L + 6e2/B        │
            └───────────┬───────────┘
                        │
                ┌───────▼───────┐
                │ in_kern?      │
                │ (≤ 1.0)       │
                └───┬───────┬───┘
                    │       │
                YES │       │ NO
                    ▼       ▼
            ┌──────────┐ ┌──────────────────────┐
            │trapezoid │ │ triangular           │
            └────┬─────┘ │ ¿qué sub-caso?       │
                 │       └──────────┬───────────┘
                 │                  │
                 │     ┌────────────┼─────────────┐
                 │     │            │             │
                 │   e1>0          e2>0         e1>0 Y e2>0
                 │   e2≈0          e1≈0        (biaxial)
                 │     │            │             │
                 │     ▼            ▼             ▼
                 │  uniax B     uniax L     warning + None
                 │  4Q/(3L(B-2e1))  4Q/(3B(L-2e2))
                 │
                 ▼
           ┌──────────────────────────────────┐
           │ qmax, qmin                       │
           └──────────────┬───────────────────┘
                          │
            ┌─────────────▼─────────────┐
            │ Qu = qu[método][criterio] │
            │       · A_eff             │
            │ FS_real = Qu / Q          │
            │ valid = FS_real ≥ FS_obj  │
            └─────────────┬─────────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │ output JSON  │
                  └──────────────┘
```

---

## 11. Tabla de casos

### 11.1 Casos por excentricidad (convención profesor: e1→L, e2→B)

| Caso | e1 | e2 | regime | qmax fórmula |
| --- | --- | --- | --- | --- |
| Sin excentricidad | 0 | 0 | uniforme | Q/(B·L) |
| Solo e1, dentro rombo | >0 | 0 | trapezoidal | (Q/BL)(1 + 6e1/L) |
| Solo e1, fuera kern | >L/6 | 0 | triangular uniax L | 4Q/(3B(L−2e1)) |
| Solo e2, dentro rombo | 0 | >0 | trapezoidal | (Q/BL)(1 + 6e2/B) |
| Solo e2, fuera kern | 0 | >B/6 | triangular uniax B | 4Q/(3L(B−2e2)) |
| Biaxial dentro rombo | >0 | >0, 6e1/L+6e2/B≤1 | trapezoidal | (Q/BL)(1+6e1/L+6e2/B) |
| Biaxial fuera rombo | >0 | >0, 6e1/L+6e2/B>1 | triangular biaxial | **None** (warning) |

### 11.2 Casos por método

| Método | Acepta excentricidad | Dimensión en S3 | Qmax (área para reporting) |
| --- | --- | --- | --- |
| Terzaghi | ❌ no (warning si e>0) | B original | B · L |
| Ec. General | ✓ sí | B' (Meyerhof) | A' = B' · L' |
| RNE E.050 | ✓ sí | B' (Meyerhof) | A' = B' · L' |

---

## 12. Decisiones documentadas

Las siguientes decisiones se tomaron tras la consulta con NotebookLM
(Das 9ed + RNE E.050) y se reflejan en el código actual:

| ID | Decisión | Justificación |
| --- | --- | --- |
| D E.1 | $A' = B' \cdot L'$ (Meyerhof simplificado) | RNE Art. 28.2 lo adopta oficialmente |
| D E.2 | Swap $B' ↔ L'$ post-cálculo | Das paso 1: "menor = B'" |
| D E.3 | Kern es **rombo** $6e_1/B + 6e_2/L ≤ 1$ | Mecánica de materiales clásica (Navier) |
| D E.4 (uniaxial B) | Fórmula Das Ec. 6.53 | Das §6.12 |
| D E.4 (uniaxial L) | Análoga por simetría | Geometría |
| D E.4 (biaxial) | **None + warning** | Das no provee fórmula cerrada |
| D E.5 | $Q_{\max} = q_a \cdot A'$ | Das paso 3 + RNE Art. 20 |
| D E.6 | $FS_{real}$ usa criterio del usuario | RNE Art. 22.2.1 |
| Terzaghi sin excentricidad | Warning + usa B original | Decisión del profesor |
| Hansen con B original | Sin cambio | Das §6.12: "no reemplace B con B'" |
| Hansen con $D_f$ (no $D_{f,abs}$) | Sin cambio (D G.5) | Sótano = volumen de aire sin masa |

---

## 13. Ejemplos numéricos

### 13.1 Caso 1 — Trapezoidal real

- $B = 2$ m, $L = 3$ m, $e_1 = 0.1$ m, $e_2 = 0.1$ m, $Q = 500$ kN

- $6 \cdot 0.1 / 3 + 6 \cdot 0.1 / 2 = 0.2 + 0.3 = 0.5 \leq 1$ → **dentro del rombo**.

- $B' = B - 2 e_2 = 1.8$ m, $L' = L - 2 e_1 = 2.8$ m, $A' = 5.04$ m².
- $q_{\max} = (500/6)(1 + 0.2 + 0.3) = 83.33 \cdot 1.5 = 125$ kPa
- $q_{\min} = (500/6)(1 - 0.2 - 0.3) = 83.33 \cdot 0.5 = 41.67$ kPa

### 13.2 Caso 2 — Triangular uniaxial en L

- $B = 2$ m, $L = 3$ m, $e_1 = 0.6$ m, $e_2 = 0$, $Q = 500$ kN

- $e_1 = 0.6 > L/6 = 0.5$ → fuera del kern.
- $e_2 \approx 0$ → triangular uniaxial en L.
- $B' = 2$, $L' = 3 - 1.2 = 1.8$ m, $A' = 3.6$ m².
- $q_{\max} = 4 \cdot 500 / (3 \cdot 2 \cdot 1.8) = 185.19$ kPa
- $q_{\min} = 0$

### 13.3 Caso del profesor (RNE Art. 28)

Datos: $B = 1.40$ m, $L = 1.60$ m, $D_f = 1$ m, $Q = 20$ tnf,
$M_1 = M_x = 3.50$ tnf·m, $M_2 = M_y = 0.70$ tnf·m, $q_u' = 19.45$ tn/m².

Excentricidades derivadas:
- $e_1 = M_1/Q = 3.50/20 = 0.175$ m (reduce L; $L/6 = 0.267$ ⇒ dentro rectángulo)
- $e_2 = M_2/Q = 0.70/20 = 0.035$ m (reduce B; $B/6 = 0.233$ ⇒ dentro rectángulo)

Verificación del rombo:
- $6 \cdot 0.175 / 1.60 + 6 \cdot 0.035 / 1.40 = 0.656 + 0.150 = 0.806 \leq 1$ → trapezoidal.

Dimensiones efectivas (pre-swap):
- $B - 2 e_2 = 1.330$ m
- $L - 2 e_1 = 1.250$ m

Tras swap (B′ siempre menor):
- $B' = 1.250$ m, $L' = 1.330$ m, $A' = 1.6625$ m².

---

## 14. Cómo extender este sistema en el futuro

Si se quiere mejorar el manejo de excentricidad:

1. **Implementar los 5 casos de Highter & Anders** (Das §6.12) para
   calcular $A'$ con áreas poligonales en lugar del $B' \cdot L'$
   simplificado. Útil cuando se trabaja fuera del rombo del kern.

2. **Resolver numéricamente la distribución de presiones biaxial fuera del
   kern** ubicando el eje neutro por equilibrio de fuerzas y momentos.
   Esto permitiría reportar $q_{\max}$ en el caso biaxial sin levantamiento.

3. **Calcular $FS_{real}$ para los 3 criterios** y exponerlo en `eccentricity`,
   no solo para el criterio elegido. Permite al usuario comparar.

4. **Detectar levantamiento como condición de diseño no segura** según el
   tipo de carga (estática vs sísmica/eólica) — el RNE permite
   levantamiento bajo cargas eventuales pero no bajo cargas permanentes.

---

*Documentación del manejo de excentricidad en el motor — 2026-05-22.*
