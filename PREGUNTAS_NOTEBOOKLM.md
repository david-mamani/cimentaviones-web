# Preguntas para NotebookLM — Motor de Cálculo de Cimentaciones

> **Contexto:** Acabamos de implementar el motor de cálculo siguiendo el flujo
> propuesto del curso (Ing. Gamarra) basado en Das y la Norma E.050 RNE. Estas
> preguntas resuelven ambigüedades, validan fórmulas que asumí, y cubren
> features mencionadas pero no detalladas.
>
> **Cómo usar este archivo:** Para cada pregunta, NotebookLM debe responder con:
> 1. La respuesta exacta (sí/no, fórmula, valor)
> 2. La fuente: autor + página/edición, o artículo de la E.050
> 3. La cita textual si la respuesta no es trivial
>
> Si NotebookLM no encuentra la respuesta en las fuentes cargadas, marcarlo
> explícitamente como "NO ENCONTRADO" para que yo sepa que debo mantener mi
> asunción actual.

---

## A. Fórmulas de Factores de Capacidad de Carga

### A.1 Terzaghi — Nq analítico

**Pregunta:** El flujo propuesto define para Terzaghi (φ > 0°):

```
Nq = e^(2·(3π/4 − φ_rad/2)·tan(φ_rad)) / (2·cos²(45° + φ°/2))
```

- ¿Esta es la fórmula exacta que aparece en Das (Principios de Ingeniería de Cimentaciones, 8va ed., capítulo 3)?
- ¿En qué número de ecuación está? (¿Ec. 3.7? ¿3.6?)
- ¿O Das la presenta como tabla únicamente?
- ¿Hay alguna versión de la fórmula donde el exponente difiera (por ejemplo `e^((3π/2 − φ)·tanφ)` que aparece en otras referencias)?

### A.2 Terzaghi — Nγ con tan(1.4φ)

**Pregunta:** El flujo propuesto asigna a Terzaghi:

```
Nγ_Terzaghi = (Nq − 1) · tan(1.4·φ_rad)
```

- Esta fórmula es la que típicamente se atribuye a **Vesic** o a la **E.050 RNE**, no a Terzaghi clásico.
- ¿En qué fuente Das (u otra autoridad) asigna `(Nq-1)·tan(1.4φ)` específicamente a Terzaghi?
- Das normalmente presenta Terzaghi con `Nγ = ½ · (Kpγ/cos²φ − 1) · tanφ` (Ec. 3.8 en 8ed). ¿Existe alguna edición donde Das use la fórmula con tan(1.4φ) para Terzaghi?
- **Si no existe esa fuente:** ¿es válido pedagógicamente unificar Terzaghi y RNE con la misma fórmula de Nγ? ¿O debería usar la fórmula clásica de Terzaghi?

### A.3 Terzaghi — Nc para φ = 0°

**Pregunta:**
- Confirmar que **Terzaghi para φ=0° usa Nc = 5.70** (no 5.71 ni 5.14).
- ¿Cuál es el origen del valor 5.70 vs el 5.14 de Vesic/Prandtl? Citar ambas fuentes.

### A.4 Ec. General — Nq de Reissner / Vesic

**Pregunta:** Confirmar que:

```
Nq = tan²(45° + φ°/2) · e^(π·tan(φ_rad))
Nc = (Nq − 1) · cot(φ_rad)
Nγ = 2·(Nq + 1)·tan(φ_rad)         ← Vesic
```

- ¿Das atribuye Nγ = 2(Nq+1)tanφ a **Vesic (1973)** o a **Caquot-Kerisel**?
- ¿Hay alguna otra fórmula de Nγ en la Ec. General (Hansen, Meyerhof) que Das también presente?

### A.5 RNE E.050 — Nγ específico

**Pregunta:**
- ¿La norma E.050 (Reglamento Nacional de Edificaciones de Perú) define explícitamente `Nγ = (Nq − 1)·tan(1.4·φ)`?
- ¿En qué artículo o anexo aparece? Citar textualmente.

---

## B. Factores Correctivos

### B.1 Factor de forma Fcs para φ = 0° (Ec. General)

**Pregunta:** Hay dos versiones del factor de forma DeBeer para φ = 0°:

| Versión | Fcs |
|---|---|
| (i) DeBeer estricto | `1 + 0.4·(B'/L')` |
| (ii) Generalizado | `1 + (B'/L')·(Nq/Nc) = 1 + (B'/L')·(1/5.14)` |

- ¿Cuál usa Das en la 8va edición para φ = 0°?
- ¿Bajo qué condiciones se usa cada una?
- El flujo propuesto usa la versión (i). ¿Es correcto?

### B.2 Factor de profundidad Fcd para φ = 0°, Df/B > 1

**Pregunta:** Confirmar:

```
Si Df/B ≤ 1:  Fcd = 1 + 0.4·(Df/B)
Si Df/B > 1:  Fcd = 1 + 0.4·arctan(Df/B)         ← arctan en RADIANES
```

- ¿Es correcto que el arctan se evalúa en radianes (no en grados)?
- ¿Qué autor propone esta extensión? (¿Hansen 1970? ¿Vesic?)
- Cita textual de Das o Hansen.

### B.3 Factor de profundidad Fqd para φ > 0°

**Pregunta:** Confirmar Hansen:

```
Si Df/B ≤ 1:  Fqd = 1 + 2·tanφ·(1−sinφ)² · (Df/B)
Si Df/B > 1:  Fqd = 1 + 2·tanφ·(1−sinφ)² · arctan(Df/B)
Fcd = Fqd − (1−Fqd) / (Nc · tanφ)
Fγd = 1.0
```

- ¿Es correcto que Fγd = 1 siempre, sin excepción?
- ¿Existe alguna versión donde Fγd ≠ 1?

### B.4 Factor de inclinación Fqi cuando φ = 0° y β > 0°

**Pregunta:** En este caso límite, hay dos convenciones:

| Convención | Fqi |
|---|---|
| (a) Asignar 1.0 (Nq=1 no es crítico) | `Fqi = 1.0` |
| (b) Misma fórmula que Fci | `Fqi = (1 − β/90)²` |

- ¿Cuál usa Das/Meyerhof?
- El flujo propuesto usa (a). Confirmar.
- ¿Y para Fγi en este caso (Nγ=0)?

### B.5 RNE E.050 — Factores de profundidad

**Pregunta:**
- Confirmar que la E.050 **no contempla factores de profundidad** (Fcd = Fqd = Fγd = 1.0).
- ¿En qué artículo se omiten? ¿Hay alguna mención explícita?

### B.6 RNE E.050 — Factores de forma

**Pregunta:** Confirmar:

```
sc = 1 + 0.2·(B'/L')
sq = 1.0
sγ = 1 − 0.2·(B'/L')
```

- ¿En qué artículo de la E.050 aparecen? Citar.
- ¿Por qué los coeficientes 0.2 (no 0.3 ni 0.4 como en Meyerhof/DeBeer)?

### B.7 RNE E.050 — Factores de inclinación

**Pregunta:** Confirmar:

```
ic = iq = (1 − α/90)²
iγ = (1 − α/φ)²
```

- ¿La E.050 los define igual a Meyerhof, o tiene sus propias fórmulas?

---

## C. Criterios de Aplicación de Sumandos

### C.1 Umbral cohesivo / friccionante

**Pregunta:**
- ¿El umbral φ = 20° para clasificar cohesivo / friccionante en el Criterio RNE proviene **del curso (Ing. Gamarra)** o **de la norma E.050**?
- Si es del curso, ¿cuál es el criterio normativo de la E.050 para esa clasificación?
- ¿Qué pasa con φ = 20° exacto? ¿Cohesivo o friccionante?

### C.2 Artículos 20.2 y 20.3 de la E.050

**Pregunta:** Citar **textualmente** los artículos:
- **20.2** que define qu para suelo cohesivo (¿solo S1?)
- **20.3** que define qu para suelo friccionante (¿S2 + S3?)

### C.3 Criterio RNE Corregido

**Pregunta:**
- ¿El "Criterio RNE Corregido" (cohesivo → S1 + S2, friccionante → S2 + S3) está **definido en la E.050** o es una **interpretación pedagógica del curso**?
- Si es del curso: ¿cuál es la justificación física?
- Si es normativo: citar artículo.

---

## D. Nivel Freático y Sobrecarga q

### D.1 Sobrecarga q como presión total o efectiva

**Pregunta:** Cuando el NF está sobre la base de la cimentación, ¿la sobrecarga q usada en el segundo sumando (q·Nq·...) debe ser:

- (a) **Presión total** (usa γ_natural arriba del NF y γ_sat debajo)
- (b) **Presión efectiva** (usa γ_natural arriba del NF y γ' = γ_sat − γ_w debajo)

- ¿Qué dice Das (Ec. 6.25 u otra)? Citar.
- ¿Hay diferencia entre la práctica de Das y la de la E.050?

### D.2 NF al nivel exacto de la base (Dw = Df_abs)

**Pregunta:**
- ¿Este caso es "sumergido" (Caso I, γ_eff = γ') o un caso intermedio?
- ¿La fórmula del Caso II (interpolación lineal) aplica para Dw = Df_abs con d = 0?

### D.3 Caso II — Interpolación de γ_eff

**Pregunta:** Confirmar:

```
Si Df_abs < d_NF ≤ Df_abs + B:
    d = d_NF − Df_abs
    γ_eff = γ' + (d/B)·(γ − γ')
```

- ¿Es lineal? ¿Hay alguna referencia que use interpolación no lineal?
- ¿De dónde sale esta fórmula? Citar.

### D.4 Sótano con NF arriba del piso del sótano

**Pregunta:**
- Si hay sótano de profundidad Ds y el NF está arriba (Dw < Ds), hay una columna de agua entre Dw y Ds sin suelo.
- ¿Esa columna de agua ejerce una presión γ_w·(Ds − Dw) sobre la cimentación?
- ¿Cómo afecta el cálculo de q?
- ¿Das o la E.050 contemplan este caso?

### D.5 Profundidad de NF medida desde…

**Pregunta:**
- ¿d_NF se mide desde la **superficie natural** del terreno o desde el **piso del sótano** (cuando hay sótano)?
- El motor actual asume superficie natural. Confirmar.

---

## E. Excentricidad y Área Efectiva

### E.1 Método de Meyerhof B' = B − 2e

**Pregunta:** Confirmar que la regla de área efectiva de Meyerhof es:

```
B' = B − 2·e1
L' = L − 2·e2
A' = B' · L'
```

- ¿Y la regla de **intercambiar B' y L' para que B' sea la dimensión menor**? ¿De dónde sale?
- ¿Das la presenta así? ¿En qué ecuación?

### E.2 Aplicación de B' en factores de forma vs profundidad

**Pregunta:** Confirmar que:

- Factores de **forma** (Fcs, Fqs, Fγs): usar **B' y L'**
- Factores de **profundidad** (Fqd, Fcd): usar **B original** (no B')
- Tercer sumando S3: usar **B'** en `½·γ·B'·Nγ·...`

- ¿Esta convención es de Das? ¿En qué edición?

### E.3 Distribución trapezoidal en dos direcciones

**Pregunta:** Confirmar para excentricidad biaxial (e1 y e2 simultáneos, ambos dentro del kern):

```
q_max/min = (Q / (B·L)) · (1 ± 6·e1/B ± 6·e2/L)
```

- ¿Cuándo dan qmin < 0 con esta fórmula? ¿Pasamos automáticamente a triangular?
- Si solo e1 > B/6 pero e2 ≤ L/6, ¿la fórmula triangular sigue aplicando?

### E.4 Distribución triangular

**Pregunta:** Confirmar para excentricidad en una sola dirección (e1 > B/6, e2 = 0):

```
q_max = 4·Q / (3·L·(B − 2·e1))
q_min = 0
```

- ¿Esta fórmula es exclusiva para excentricidad en una sola dirección?
- ¿Qué fórmula aplica si **ambas** e1 > B/6 y e2 > L/6?

### E.5 FS_real con excentricidad

**Pregunta:** Confirmar que la validación con excentricidad es por **fuerza**, no por presión:

```
Qu = qu' · A'              (carga última total)
FS_real = Qu / Q           (Q es la carga aplicada)
Diseño OK ⇔ FS_real ≥ FS
```

- ¿Das presenta esto así? Citar.
- ¿Por qué no `FS_real = qu' / qmax`?

### E.6 qadm con excentricidad

**Pregunta:** La presión admisible efectiva referida a B original es:

```
qadm_efectivo = qu' · (B − 2·e1) / B
```

- ¿De dónde sale esta corrección? Citar.

---

## F. Validaciones Geométricas

### F.1 Umbral Df/B para cimentación superficial

**Pregunta:**
- ¿El límite Df/B ≤ 5 para considerar "superficial" es el estándar?
- Algunas referencias usan Df/B ≤ 4 o Df/B ≤ 1.
- ¿Qué dice Das? ¿Qué dice la E.050 (¿artículo 9?)?

### F.2 Cimentación corrida vs rectangular

**Pregunta:**
- ¿L/B > 10 es el límite para considerar "corrida" (franja infinita)?
- Algunas referencias usan L/B > 5 o L/B > 6.
- ¿Das establece un umbral explícito?

### F.3 Terzaghi para rectangular

**Pregunta:**
- ¿Hay alguna formulación oficial de Terzaghi para zapatas rectangulares (0 < B/L < 1)?
- O las únicas soluciones clásicas de Terzaghi son: corrida, cuadrada, circular.
- El motor actual rechaza Terzaghi rectangular. Confirmar que es lo correcto.

### F.4 Terzaghi circular

**Pregunta:** Confirmar coeficientes para Terzaghi circular:

```
qu = 1.3·c·Nc + q·Nq + 0.3·γ·B·Nγ
```

- ¿B es el **diámetro** o el **radio**?
- ¿Cuál es la fuente exacta?

---

## G. Asentamiento (Bloque 1.1 del flujo, no implementado)

> El flujo menciona Es, μs, S_max=25mm pero no expande las fórmulas.

### G.1 Método de cálculo de asentamiento elástico

**Pregunta:**
- ¿Qué método usar para asentamiento elástico inmediato? (Schmertmann, Steinbrenner, Janbu, fórmula de Boussinesq integrada)
- ¿Cuál usa Das en el capítulo de asentamientos? Citar ecuación.
- ¿La E.050 prescribe un método específico? Citar artículo.

### G.2 Fórmula del asentamiento elástico

**Pregunta:** Ejemplo de fórmula de Das para zapata flexible:

```
S = q · B · (1 − μ²) · Iw / Es
```

Donde Iw es el factor de influencia. Confirmar:
- Definición exacta de Iw (esquina, centro, promedio).
- Tabla de valores Iw vs L/B y Df/B.

### G.3 Relación entre S_max y qadm

**Pregunta:**
- ¿Cómo se conecta el asentamiento admisible (S_max = 25 mm) con qadm?
- ¿Se calcula qadm para S = S_max y se compara con qadm = qu/FS?
- ¿El qadm final es el menor de los dos?

### G.4 Asentamiento con perfil estratigráfico

**Pregunta:**
- Si hay varios estratos con Es_i distintos, ¿cómo se calcula el asentamiento total?
- ¿Suma de asentamientos por estrato? ¿Es promedio ponderado?

---

## H. Outputs y Conversiones

### H.1 Conversiones de unidad

**Pregunta:** Confirmar:

```
qadm (kg/cm²) = qadm (t/m²) · 0.1
qadm (kPa)    = qadm (t/m²) · 9.81
```

- ¿9.81 o 9.80665? ¿Importa la precisión?
- ¿La E.050 usa kg/cm² o t/m² o kPa como unidad oficial?

### H.2 Qu_max — capacidad o capacidad neta

**Pregunta:**
- `Qu_max = qadm · B · L` usa qadm bruta o qadm neta (qa_net = (qu-q)/FS)?
- ¿Hay justificación física para usar la **neta** (descontar el peso de suelo que se removió al excavar)?

### H.3 Reporte de las 9 combinaciones método×criterio

**Pregunta:**
- ¿Es estándar en la práctica peruana mostrar los 3 métodos × 3 criterios simultáneamente?
- ¿O se reporta solo uno (el más conservador, o el del método elegido)?

---

## I. Casos Límite y Robustez

### I.1 φ exactamente 0°

**Pregunta:**
- Para Terzaghi con φ=0°: ¿la fórmula analítica de Nq divide por 0? ¿Se usa el valor tabulado Nq=1.00?
- El motor maneja φ=0° como caso especial. Confirmar que eso es lo estándar.

### I.2 β = 0° vs β > 0°

**Pregunta:**
- ¿β = 0° significa "no aplica corrección" o "carga perfectamente vertical"?
- ¿Hay un mínimo de β para aplicar Fci, Fqi, Fγi?

### I.3 Df = 0 (cimentación en la superficie)

**Pregunta:**
- ¿Se considera "superficial" aún con Df = 0?
- ¿Qué pasa con q? (Cero, asumo).
- ¿Es físicamente válido construir con Df = 0 o siempre debe haber empotramiento mínimo?

### I.4 Suelo con c = 0 y φ = 0°

**Pregunta:**
- Físicamente, este suelo no existiría. ¿La E.050 prohibe?
- El motor genera warning pero permite el cálculo. Confirmar política.

### I.5 γ_sat < γ_natural

**Pregunta:**
- Físicamente imposible. ¿Qué hacer?
- ¿Error fatal o warning + clampeo?

---

## J. Iteraciones Paramétricas

### J.1 Iterar criterios o solo qadm

**Pregunta:**
- En la gráfica iterativa (qadm vs B), ¿se grafica solo el criterio General o **una línea por cada criterio**?
- El flujo propuesto sugiere "línea por criterio". Confirmar si eso es estándar pedagógicamente o normativamente.

### J.2 Iteraciones con excentricidad

**Pregunta:**
- Al iterar B (varía 1.0 → 5.0), ¿e1 y e2 se mantienen fijos?
- Si e1 fijo y B varía, e1/B cambia → el régimen kern puede cambiar a lo largo de la iteración. ¿Cómo manejarlo?

### J.3 Límite de puntos

**Pregunta:**
- ¿Hay un estándar académico sobre cuántos puntos de iteración usar?
- El motor limita a 500. ¿Razonable?

---

## K. Otras Aclaraciones Específicas

### K.1 Diferencia entre cimentación corrida y franja

**Pregunta:**
- En español técnico: ¿"corrida", "continua", "franja", "strip footing" son sinónimos?
- ¿La E.050 usa qué término?

### K.2 Aplicación de β a RNE

**Pregunta:**
- ¿La E.050 reconoce explícitamente cargas inclinadas?
- ¿O sus factores de inclinación son "tomados prestados" de Meyerhof por la práctica?

### K.3 FS estándar para diferentes tipos de obra

**Pregunta:**
- ¿La E.050 prescribe FS = 3 universal, o varía según el tipo de estructura?
- Citar artículo si aplica.

### K.4 Diferencia conceptual qu (última) vs qd (admisible última E.050)

**Pregunta:**
- La E.050 usa "qd" en lugar de "qu". ¿Son lo mismo?
- ¿Hay diferencia conceptual o solo nomenclatura?

---

## L. Otras fuentes y referencias

### L.1 Edición de Das

**Pregunta:**
- ¿Qué edición de Das se usa de referencia oficial en el curso? (7ed, 8ed, 9ed)
- Las ecuaciones pueden diferir entre ediciones.

### L.2 Versión vigente de la E.050

**Pregunta:**
- ¿Cuál es la versión vigente de la E.050? (¿2018? ¿2020?)
- ¿Hay actualización en curso?

### L.3 Autores complementarios

**Pregunta:**
- Para temas no cubiertos por Das ni E.050 (¿algunos factores correctivos?), ¿qué autor consultar? (Bowles, Coduto, Salgado, etc.)

---

## Formato de respuesta esperado por pregunta

```
A.1 Terzaghi - Nq analítico
RESPUESTA: Sí / No / Fórmula
FUENTE: Das (2014), Principios de Ingeniería de Cimentaciones, 7ed,
        Capítulo 3, Ecuación 3.7, página 156.
CITA TEXTUAL: "La fórmula propuesta por Terzaghi para Nq es..."
NOTA: [observaciones adicionales]
```

Si NO se encuentra:

```
A.1 Terzaghi - Nq analítico
RESPUESTA: NO ENCONTRADO en las fuentes cargadas.
SUGERENCIA: Mantener fórmula actual / consultar fuente externa / etc.
```
