# Preguntas para NotebookLM — Asentamientos

**Propósito:** definir cómo se implementa el bloque de **asentamientos**
del motor (`calculos/settlement.py`) antes de cablearlo al frontend.
La hoja del profesor enfoca el problema como **"qadm que cumple
Se_max = 25 mm"** para suelos granulares estratificados, con
inversión de la ecuación elástica de Steinbrenner/Schleicher.

Estas preguntas están listas para **copiar/pegar en NotebookLM** (cargado
con Das + apuntes + RNE E.050) en **3 turnos** agrupados por tema.

> 📌 **Cómo usar:** copia el bloque entero (incluido el contexto inicial)
> y pégalo en NotebookLM. Cada parte es autocontenida.
>
> 📝 **Notas previas (cosas a verificar de la transcripción de clase):**
>   1. La regla `z̄ = min(H, 5·B)` no es universal — Bowles a veces dice
>      4B; el motor actual usa 2B. Hay que fijar la regla del curso.
>   2. Promediar μ (Poisson) por espesor es físicamente raro: μ=0.20 + μ=0.49
>      da un promedio sin sentido mecánico. Confirmar.
>   3. El factor `Cw` de Peck/Bowles tradicionalmente aplica a métodos
>      **SPT** (Meyerhof, Burland-Burbidge), NO al método elástico de
>      Steinbrenner. Confirmar si el curso realmente lo usa con la
>      ecuación elástica.
>   4. La "B'" que aparece en la ecuación de Schleicher (q·B'·(1-μ²)/Es)
>      se refiere a **B/α** (B/2 al centro), NO al B' por excentricidad
>      de Meyerhof. Hay que diferenciar en el motor y en la UI.
>   5. El texto de clase no menciona consolidación primaria (Sc),
>      Es-desde-SPT en arenas, ni acoplamiento con excentricidad.

---

## PARTE 1 — Zona de influencia, Es equivalente y μ promedio

Copia desde aquí ⬇️

```
Contexto: estoy desarrollando un software de capacidad portante y
asentamientos de cimentaciones superficiales (zapatas cuadradas y
rectangulares) según Das, Bowles y la Norma Peruana E.050. La hoja
de cálculo de mi profesor para asentamientos elásticos en suelos
granulares estratificados usa el método de Steinbrenner/Schleicher e
INVIERTE la ecuación para hallar qadm a partir de un Se_max admisible
(típicamente 25 mm). Necesito resolver dudas específicas sobre los
parámetros equivalentes del perfil de suelo. Por favor responde
citando capítulo/sección de Das, Bowles o artículo del RNE donde
corresponda.

1. Profundidad de influencia z̄ (bulbo de presiones para asentamiento):
   - El profesor usa z̄ = min(H, 5·B), donde H = distancia de la base
     al estrato rígido. ¿Es 5·B el criterio recomendado por Das/Bowles
     para asentamiento ELÁSTICO en arenas, o se usa otra regla
     (p.ej. 4·B, o "hasta Δσ < 0.1·q₀")?
   - ¿La regla cambia entre método elástico (Steinbrenner) y métodos
     basados en SPT (Schmertmann Iz, Burland-Burbidge)?
   - ¿Cómo se determina H en la práctica si NO hay estrato rígido
     identificable en el sondeo?

2. Es equivalente para perfil multi-estrato:
   - El profesor usa promedio aritmético ponderado por espesor:
     Es_eq = Σ(Es_i · Δz_i) / Σ Δz_i  (en la zona [Df, Df + z̄])
   - ¿Es ése el criterio correcto, o Das/Bowles recomiendan otro
     (p.ej. harmonic mean para resortes elásticos en serie, o
     ponderación por el factor de influencia Iz de Schmertmann)?
   - Si un estrato dentro de la zona de influencia no tiene Es
     reportado en el estudio, ¿qué se hace (excluirlo, extrapolar,
     valor por defecto)?

3. Es de cada estrato:
   - Para ARENAS, ¿cuál es la correlación cerrada que recomienda Das
     desde N_60 (SPT) — p.ej. Es = (β'·pa)·N_60 con β'∈[5,15]
     dependiendo de finura? ¿Es preferible Es desde CPT (qc)?
   - Para ARCILLAS, ¿es Es = β·cu con β de la Tabla 9.1 de Das
     (Sección 9, 8va ed.) — interpolación por PI y OCR — la regla
     vigente, o se usa otra correlación?
   - ¿El Es para asentamiento elástico es Es DRENADO (E') o
     no-drenado (Eu)? ¿Cambia según el tipo de suelo (arena vs arcilla)?

4. Poisson μ promedio:
   - ¿Promediar μ por espesor (igual que Es) es físicamente válido
     cuando hay capas con μ muy distintos (p.ej. arena μ=0.30 vs
     arcilla saturada μ→0.49)?
   - ¿Das/Bowles recomiendan usar μ del estrato DOMINANTE, del
     estrato DIRECTAMENTE BAJO LA BASE, o un promedio?
   - Para arena seca/húmeda típica, ¿qué valor por defecto de μ
     sugiere Das?

5. Acoplamiento con excentricidad de carga:
   - Si la zapata tiene carga excéntrica y se calcula B', L' por
     Meyerhof, ¿el ASENTAMIENTO se calcula con B', L' efectivos o
     con B, L originales?
   - Mi intuición: como el área efectiva concentra la carga, el
     asentamiento real al centro del área efectiva debería usar
     B', L'. Pero la rigidez del suelo se promedia bajo la zapata
     COMPLETA. ¿Qué dice Das?
   - ¿Esta interacción está cubierta por el RNE E.050 (verificación
     de servicio bajo cargas excéntricas)?
```

⬆️ Hasta aquí Parte 1.

---

## PARTE 2 — Steinbrenner, Fox, flexible vs rígida

Copia desde aquí ⬇️

```
Continúo con preguntas sobre asentamiento elástico de cimentaciones
superficiales según Das (Cap. 9), Bowles y RNE E.050. Ahora sobre
los factores de influencia geométricos.

1. Fórmula maestra de Schleicher / Steinbrenner para Se al CENTRO
   de zapata rectangular flexible:

       Se = q₀ · (α · B') · (1 − μ²)/Es · Is · If

   donde para el CENTRO: α = 4, B' = B/2.
   Para la ESQUINA: α = 1, B' = B.

   - ¿Es ésta exactamente la forma que da Das §9? ¿O el coeficiente
     α=4 se aplica de otra forma (dentro de Is, no como multiplicador
     externo)?
   - ¿La "B'" de esta fórmula (B/α) puede confundirse con el B' de
     Meyerhof (B − 2·e₂)? ¿Cuál es la notación oficial en Das para
     evitar ambigüedad?

2. Factor de forma Is (Steinbrenner) con estrato rígido a H:

       Is = F1 + ((1 − 2μ)/(1 − μ)) · F2
       F1 = (A0 + A1)/π
       F2 = (n'/(2π)) · arctan(A2)

       A0 = m' · ln[ (1+√(m'²+1))·√(m'²+n'²) / (m'·(1+√(m'²+n'²+1))) ]
       A1 = ln[ (m'+√(m'²+1))·√(1+n'²) / (m'+√(m'²+n'²+1)) ]
       A2 = m' / (n' · √(m'²+n'²+1))

       con m' = L'/B' y n' = H/B'.

   - ¿Coinciden estas fórmulas con las de Das §9 (Tabla 9.3 y figura
     correspondiente)? ¿Hay variantes según edición de Das (7ed vs 8ed
     vs 9ed)?
   - Cuando μ → 0.5 (arcilla saturada no drenada), el término
     (1−2μ)/(1−μ) → 0. ¿Eso significa que Is se reduce a F1 puro,
     o Das introduce una formulación distinta para μ = 0.5?

3. Factor de profundidad If de Fox (1948):
   - ¿Cómo se obtiene If exacto? Das §9 entrega ábacos para
     Df/B ∈ [0, 2] y L/B ∈ {1, 2, 5}. ¿Existe ajuste polinómico
     publicado (Bowles, Mayne) que se pueda implementar?
   - ¿Para Df/B > 2 (cimentación más profunda) se extrapola If
     o se considera fuera del rango del método?
   - Para usuarios sin acceso al ábaco, ¿el valor conservador
     If = 1.0 (ignora el efecto del empotramiento) es aceptable
     o sobre-estima Se de forma importante?

4. Zapata FLEXIBLE vs RÍGIDA:
   - El factor 0.93 (Se_rígido ≈ 0.93·Se_centro_flexible) que aparece
     en Das §9 — ¿es para CUALQUIER L/B o solo para zapata cuadrada
     (L/B = 1)?
   - ¿Existe corrección de rigidez separada para zapatas rectangulares
     largas (L/B > 1)?
   - Para una zapata de hormigón armado típica (espesor ~0.5 m,
     dimensión 1.5 m), ¿se considera rígida o flexible? ¿Hay criterio
     numérico (módulo de rigidez relativa Eb·tb³/Es·B³)?

5. Verificación geométrica (validez del método):
   - ¿Cuándo deja de ser válido Steinbrenner? P.ej. zapata sobre
     suelo muy estratificado con contrastes de Es > 10× — ¿se
     necesita método distinto (Burmister, Bowles modificado)?
   - ¿Steinbrenner asume suelo homogéneo dentro del bulbo? Si sí,
     ¿el promedio de Es es una aproximación válida o un atajo?
```

⬆️ Hasta aquí Parte 2.

---

## PARTE 3 — Nivel freático Cw, qadm despejado, criterio final

Copia desde aquí ⬇️

```
Última tanda de preguntas sobre asentamientos. Quiero cerrar la
inversión qadm = f(Se_max), la corrección por nivel freático, y
el criterio final qadm de diseño en RNE E.050.

1. Corrección por nivel freático Cw:
   - El profesor aplica un factor Cw (Peck/Bowles) cuando el NF está
     dentro del bulbo de presiones, dividiendo: Se_max_efectivo = Se_max / Cw
     antes de despejar qadm.
   - Pero Cw clásicamente se usa con métodos SPT (Meyerhof, Burland-
     Burbidge), donde Cw = 0.5 + 0.5·Dw/(Df+B). ¿Esa fórmula también
     aplica al método elástico de Steinbrenner, o el NF en el método
     elástico se captura SOLO a través de la elección de Es saturado
     vs Es drenado?
   - Si se aplica Cw a Steinbrenner: ¿cuál es la fórmula exacta y
     desde qué fuente (Peck-Hansen-Thornburn 1974, Bowles 1996, RNE)?
   - Si NO se aplica Cw al método elástico: ¿cómo se modela el efecto
     del NF en Steinbrenner cuando Dw cae dentro del bulbo?

2. Inversión qadm:
   - La ecuación es:
        qadm = Se_max / [ (α · B') · (1 − μ²)/Es · Is · If ]
     ¿Confirmas que esta inversión es válida para CUALQUIER B
     (la relación es lineal entre q y Se)?
   - ¿Hay alguna no-linealidad oculta (p.ej. Es función de q en
     el rango de servicio) que invalide la inversión directa?

3. Iteración paramétrica con B variable:
   - El profesor genera una tabla iterando B de 1.0 a 2.6 m,
     recalculando para cada B: la zona de influencia z̄, el Es_eq,
     el μ promedio, los factores Is e If, y finalmente qadm.
   - ¿Es correcto re-promediar Es y μ con cada B (porque la zona
     de influencia [Df, Df+5B] cambia), o se calcula un Es_eq fijo
     una vez por proyecto y se mantiene constante?
   - ¿Cómo se elige B óptimo? ¿Maximizando qadm? ¿O hay un criterio
     económico (mínima área que cumple qadm ≥ q_aplicada y
     S_total ≤ S_max)?

4. Consolidación primaria (Sc):
   - La hoja del profesor solo evalúa asentamiento ELÁSTICO (Se).
     Si el perfil incluye arcillas blandas dentro del bulbo,
     ¿se debe SUMAR el asentamiento por consolidación primaria
     Sc al Se elástico para el chequeo Se + Sc ≤ Se_max?
   - ¿Las arcillas dentro del bulbo se modelan con Es (asentamiento
     instantáneo) Y con Cc/Cs (consolidación), o solo con uno de
     los dos para evitar doble conteo?
   - ¿RNE E.050 separa los chequeos de asentamiento instantáneo y
     consolidación, o aplica un Se_max único?

5. Distorsión angular (RNE E.050 Tabla 8):
   - Para evaluar la distorsión angular α = δ/L entre zapatas,
     ¿RNE E.050 requiere calcular el asentamiento TOTAL (Se + Sc + S_secundaria)
     o solo el instantáneo Se?
   - ¿Cómo se elige el límite admisible (1/150, 1/250, 1/500, ...)
     en función del tipo de estructura? ¿Hay decisión del proyectista
     o es prescriptiva del RNE?

6. Criterio final qadm de diseño:
   - La regla "qadm_diseño = MIN(qadm_falla, qadm_asentamiento)"
     ¿está explícita en RNE E.050 (artículo 22 o anexo)? ¿O es
     convención del curso?
   - Si qadm_asentamiento gobierna (caso típico en arenas densas
     con cargas moderadas), ¿se reporta FS aparente sobre falla
     (FS_real = q_falla / qadm_asentamiento) o solo se reporta
     qadm_diseño?
```

⬆️ Hasta aquí Parte 3.

---

## Próximos pasos

Tras recibir las respuestas de NotebookLM, las decisiones se
documentarán en **`MOTOR_ASENTAMIENTOS.md`** (al estilo de
`MOTOR_EXCENTRICIDAD.md`) cubriendo:

1. Inputs por estrato (Es, μ, Cc, Cs, e₀, σ'c, is_clay).
2. Inputs globales (Se_max, point, rigid, H_rigid, z_influence_ratio).
3. Algoritmo: Es_eq → Steinbrenner Is → Fox If → Se → Sc → qadm.
4. Acoplamiento con excentricidad (¿usar B' Meyerhof?).
5. Acoplamiento con NF (Cw aplicable o no).
6. UI: tabla iterativa de qadm(B), pestaña "Asentamientos".
7. Criterio final qadm_diseño = min(qadm_falla, qadm_asentamiento).

El módulo actual (`calculos/settlement.py`) ya tiene la mayoría de
los bloques implementados como **placeholders** (Steinbrenner Is
completo, Fox If = 1.0 constante, 2:1 en lugar de Newmark). Las
respuestas de NotebookLM van a determinar:
- Si se mantiene z_influence_ratio = 2.0 o se cambia a 5.0.
- Si se digitaliza el ábaco de Fox o se deja conservador.
- Si se incorpora Cw o se descarta como no-aplicable al método elástico.
- Si se acopla con B' de excentricidad.
