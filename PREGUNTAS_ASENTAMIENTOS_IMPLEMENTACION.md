# Preguntas residuales para NotebookLM — Implementación de Asentamientos

**Propósito:** cerrar los huecos concretos de información que NO se
pueden inventar antes de codificar `calculos/settlement.py` y cablear
el endpoint backend.

> 📌 **Cómo usar:** copia el bloque entero y pégalo en NotebookLM
> (cargado con Das 8va/9na ed + Bowles + RNE E.050).

---

## BLOQUE ÚNICO — Datos numéricos y casos límite

Copia desde aquí ⬇️

```
Contexto: estoy terminando de implementar el motor de asentamientos
elásticos (Steinbrenner/Schleicher + Fox + Cw) para zapatas
rectangulares en suelos estratificados, según Das §9 y RNE E.050.
Ya tengo decididas las fórmulas maestras, sólo me faltan datos
numéricos del ábaco de Fox 1948, confirmaciones de correlaciones y
algunos casos borde antes de programar. Por favor responde citando
capítulo/sección/figura/tabla específica de Das o Bowles donde
corresponda. Necesito valores numéricos concretos.

1. ÁBACO DE FOX 1948 (factor de profundidad If):
   Necesito tabular el ábaco de Fox que Das §9 presenta en su Figura
   correspondiente (9.5 en 9na ed., 9.3 en 8va ed.). Por favor,
   entrégame los VALORES NUMÉRICOS DE If para las siguientes
   combinaciones (con la mejor precisión que las curvas permitan,
   típicamente 2 decimales):

   Para cada combinación de (L/B, μs), dar If en Df/B = 0, 0.2, 0.4,
   0.6, 0.8, 1.0, 1.5, 2.0:
   - L/B = 1,  μs = 0.30
   - L/B = 1,  μs = 0.40
   - L/B = 1,  μs = 0.50
   - L/B = 2,  μs = 0.30
   - L/B = 2,  μs = 0.40
   - L/B = 2,  μs = 0.50
   - L/B = 5,  μs = 0.30
   - L/B = 5,  μs = 0.40
   - L/B = 5,  μs = 0.50

   (Si Das solo trae μs = {0, 0.3, 0.5} en sus curvas, dame esos
   tres en vez de 0.30/0.40/0.50.)

   Adicionalmente: ¿qué hace Fox/Das cuando L/B > 5 o Df/B > 2?
   ¿Hay extrapolación recomendada, se congela al límite, o se
   declara fuera de método?

2. DOMINIO DE LAS FUNCIONES LOGARÍTMICAS DE STEINBRENNER:
   Las fórmulas A0 y A1 contienen logaritmos:

     A0 = m' · ln[ (1+√(m'²+1))·√(m'²+n'²)
                   / (m'·(1+√(m'²+n'²+1))) ]
     A1 = ln[ (m'+√(m'²+1))·√(1+n'²)
              / (m'+√(m'²+n'²+1)) ]

   Pregunta: para valores típicos m' ∈ [1, 100], n' ∈ [0.5, 50],
   ¿el argumento del logaritmo puede volverse ≤ 0? ¿Das menciona
   algún rango restringido donde estas fórmulas dejan de ser
   válidas? Si la respuesta es "siempre positivo en el rango físico
   válido", confirmar.

3. CORRELACIÓN KULHAWY-MAYNE 1990 (Es desde SPT en arenas):
   Confirmar literalmente la ecuación que Das presenta:

     Es / pa = α · N₆₀

   donde pa = presión atmosférica ≈ 101.3 kPa.

   ¿Los valores exactos de α que Das cita son?
   - α = 5  para arena CON FINOS
   - α = 10 para arena LIMPIA NORMALMENTE CONSOLIDADA
   - α = 15 para arena LIMPIA SOBRECONSOLIDADA
   ¿O hay rangos (p.ej. α ∈ [5, 15]) en lugar de tres valores
   discretos? ¿Cómo recomienda Das elegir entre NC y OC sin tener
   OCR medido?

4. ELECCIÓN DE q₀ EN LA FÓRMULA ELÁSTICA:
   La fórmula Se = q₀·B·(1-μ²)/Es·Is·If usa "q₀". Pregunto:
   - ¿q₀ es la presión TOTAL aplicada en la base (Q/A), o la
     presión NETA (Q/A − γ·Df, descontando el peso del suelo
     excavado)?
   - Para el chequeo de servicio, ¿RNE E.050 prescribe presión
     neta o total?
   - Cuando se invierte para hallar qadm_asent, ¿el resultado es
     una "qadm neta" o "qadm total"? Importante para el min con
     qadm_falla (que típicamente es neta).

5. AUTO-DETECCIÓN DEL ESTRATO RÍGIDO:
   El criterio de Bowles citado por Das dice Es_rígido ≥ 10·Es_arriba.
   - ¿"Es_arriba" se refiere al PROMEDIO PONDERADO de todos los
     estratos sobre el rígido candidato, o solo al estrato
     inmediatamente superior?
   - Si la respuesta es "promedio ponderado", el criterio se
     vuelve circular (necesito Es_eq para detectar H, pero H
     define el rango de Es_eq). ¿Cómo se resuelve la circularidad
     en la práctica?
   - Si no hay capa que cumpla el criterio dentro de Df+5B,
     ¿se asume H = 5B (no hay rígido) o se usa H = espesor total
     del sondeo?

6. CONSOLIDACIÓN CON BULBO PARCIAL:
   Cuando un estrato de arcilla está PARCIALMENTE dentro del bulbo
   de 5B (la parte inferior cae fuera):
   - ¿Se calcula Sc solo con el espesor parcial dentro del bulbo,
     o con el espesor total del estrato consolidable?
   - ¿Δσ se evalúa al centro del estrato COMPLETO o al centro
     de la porción dentro del bulbo?

7. NIVEL FREÁTICO SOBRE LA BASE DE LA ZAPATA:
   Cuando Dw < Df (NF sobre el nivel de desplante):
   - ¿Qué hacen Peck-Hansen-Thornburn, Teng y Bowles? Las
     fórmulas dan Cw potencialmente menor a 1 o muy grande.
   - ¿Das recomienda Cw = 2 (caso totalmente sumergido) o se
     fuerza Cw = 1 (no aplicar corrección)?
   - ¿Cambia la ecuación elástica de alguna otra forma (p.ej.
     usar γ_sumergido para el cálculo de σ'₀)?

8. ZAPATA RÍGIDA EN ESQUINA:
   El factor 0.93 de Bowles 1987 aplica al CENTRO de zapata
   rígida flexible. ¿Qué hace Das con la combinación point="esquina"
   y rigid=True? ¿Aplica 0.93 igual, no aplica corrección, o
   prescribe usar solo "centro" para zapata rígida?

9. CONSISTENCIA ÚLTIMA — orden de cálculo:
   En una iteración paramétrica con B variable, el orden de
   recálculo importa. ¿Das/Bowles sugieren este orden, o hay
   uno mejor?
     (i)   detectar H (independiente de B si es geométrico)
     (ii)  z̄ = min(H, 5B)
     (iii) Es_eq en [Df, Df+z̄]
     (iv)  μ del estrato bajo la base (no cambia con B)
     (v)   Is(L/B, H/B') por Steinbrenner (depende de B)
     (vi)  If(Df/B, L/B, μ) por Fox (depende de B)
     (vii) Cw(Dw, Df, B) — depende de B
     (viii) qadm = Smax / [B·(1-μ²)/Es·Is·If·Cw]
```

⬆️ Hasta aquí el bloque único.

---

## Lo que voy a hacer cuando llegue la respuesta

1. **Fox If digitalizado** (P.1) → reemplazar el placeholder
   `If_factor() = 1.0` por interpolación bilineal sobre la tabla
   real. Si NotebookLM no tiene los valores, se mantiene 1.0 con
   un warning explícito en el output.
2. **Verificación de dominio Steinbrenner** (P.2) → agregar
   guardas si Das menciona rangos prohibidos.
3. **Kulhawy-Mayne** (P.3) → ajustar el helper
   `Es_from_N60_kulhawy_mayne()` con los α exactos.
4. **q₀ neta vs total** (P.4) → fijar la convención del motor y
   marcarla explícitamente en el output (`q0_basis: "neta" | "total"`).
5. **Algoritmo H auto** (P.5) → según la respuesta, comparar
   contra estrato inmediato anterior o ponderado anterior; resolver
   circularidad.
6. **Consolidación parcial en bulbo** (P.6) → bandera en la lógica.
7. **NF sobre base** (P.7) → caso límite del Cw documentado.
8. **Rígida en esquina** (P.8) → modo permitido/prohibido en UI.
9. **Orden de iteración** (P.9) → confirmar el pipeline antes
   de codear la tabla iterativa qadm(B).

Si NotebookLM no responde alguna pregunta con certeza, dejo el
valor por defecto conservador documentado en `MOTOR_ASENTAMIENTOS.md`
y añado un warning en el output del motor para que el usuario
sepa que ese sub-bloque está aproximado.
