# MEMORIA DEL MOTOR DE CÁLCULO GEOTÉCNICO Y GUÍA DE EXPOSICIÓN DE CÓDIGO

**Proyecto:** CimentAviones  
**Módulo:** Motor Computacional de Capacidad Portante (`/calculos/`)  

Este documento es una guía paso a paso para **exponer el código fuente**. Combina la teoría matemática de la ingeniería de cimentaciones con la estructura algorítmica exacta, permitiéndole a un profesor o jurado entender exactamente **qué hace cada función y variable en el código**.

---

## 1. ORQUESTADOR PRINCIPAL: El Archivo `bearing_capacity.py`
Este archivo es el "cerebro principal". Contiene la función `calculate_bearing_capacity(input_data)`, que recibe los estratos, dimensiones de zapata y cota de nivel freático, y dirige el tráfico a través de un **Pipeline de 5 Pasos**.

### Paso 1: Determinación del Estrato de Diseño
En el código, esto ocurre en la función `find_design_stratum()`.
- **¿Qué hace en el código?:** Calcula la profundidad total de la zapata desde la superficie natural de la tierra. Lo hace sumando el sótano más el desplante: `effective_depth = Ds + Df`.
- **¿Cómo funciona?:** Un bucle `for` escanea el array de `strata` (estratos) sumando los grosores. En el momento en que la profundidad acumulada supera a `effective_depth`, la función se detiene y selecciona ese estrato. Sus propiedades mecánicas ($c, \phi, \gamma$) se guardan en la variable `design_stratum` para usarse en el resto de la ejecución.

### Paso 2: Interacción con el Nivel Freático y Presión
El código delega esta tarea pesada al archivo **`water_table.py`**, llamando a la función `apply_water_table_correction(...)`. 
- **¿Qué hace en el código?:** Retorna un diccionario con dos valores vitales: la sobrecarga `q` (presión de la tierra encima) y el `gammaEffective` ($\gamma_{efectivo}$).
- **¿Cómo funciona `water_table.py`?:**
  1. Identifica en qué Caso de Nivel Freático se encuentra (Evaluando la variable `Dw` que es la profundidad del agua).
  2. Si `Dw < effective_depth` (Caso 1: Sumergencia Total), llama a `_calculate_overburden_effective()`. Esta subrutina es crucial para la exposición: recorre las capas y multiplica grosor por `stratum["gamma"]` para tramos secos, y por `stratum["gammaSat"] - GAMMA_W` (Peso sumergido) para los tramos inundados.
  3. Esto asegura que la presión `q` sea una **presión efectiva real**.
  4. La variable calculada `gammaEffective` se devuelve a `bearing_capacity.py` para usarla inyectada y proteger el tercer término de la ecuación de capacidad portante.

### Paso 3: Cálculo Dinámico de Coeficientes
El código llama a tres funciones del archivo **`factors.py`** para evitar el uso de tablas estáticas.
- **`get_shape_factors()`:** Usa las ecuaciones geométricas de Meyerhof para devolver un diccionario con `{"sc": x, "sq": x, "sgamma": x}` dependiendo de si es `rectangular`, `cuadrada`, etc.
- **`get_depth_factors()`:** Dependiendo de la relación `Df / B`, el código bifurca (usa sentencias `if/else`). Si excede 1.0, el código usa la función trigonométrica `math.atan()` (arcotangente) de Hansen.
- **`get_inclination_factors()`:** Toma la variable `beta` (ángulo de la carga). Si el código detecta que `beta >= phi`, automáticamente hace `igamma = 0.0`. Matemáticamente esto le avisa al motor que la cimentación deslizará y anula su fricción lateral.

---

## 2. EL CORAZÓN MATEMÁTICO: Archivos `methods.py` y `factors.py`
Una vez preparadas todas las variables, `bearing_capacity.py` ramifica la ejecución (Paso 4) según el método elegido:

### Si el método es Terzaghi
El código no tiene una ecuación analítica pura para Terzaghi, ya que Terzaghi era empírico. Por ende, llama a `get_bearing_factors(phi)` en **`factors.py`**.
- **Exposición del Código:** Se puede mostrar la lista `TERZAGHI_TABLE`. Si el ángulo de fricción ingresado tiene decimales (ej. $\phi=30.5°$), el código separa la parte entera inferior y superior (`math.floor(phi)` y `math.ceil(phi)`) y hace una **interpolación lineal matemática** para extraer factores ultra-precisos $N_c, N_q, N_\gamma$.
- Luego, en `bearing_capacity.py`, la función `_calculate_qu_terzaghi()` arma literalmente los tres fragmentos (Ej. `F3 = 0.4 * gamma * B * Ngamma` usando el `gammaEffective` calculado en el paso del agua).

### Si el método es Ecuación General (Meyerhof / Das)
El código delega el trabajo pesado a la función `calculate_qu_general()` dentro de **`methods.py`**.
- **Exposición del Código:** Esta función no usa tablas. Utiliza la librería `math` de Python. Por ejemplo, calcula $N_q$ estrictamente con Reissner evaluando exponenciales y tangentes: `math.exp(math.pi * math.tan(phi_rad))`.
- Las tres partes de la ecuación (cohesión, sobrecarga y fricción) se calculan y se guardan en las variables `F1`, `F2` y `F3`, luego se suman para devolver `qu`.

### Si el método es RNE E.050 (Norma Peruana)
El código llama a la función `calculate_qu_rne()` en **`methods.py`**.
- **Exposición del Código:** Se le puede mostrar al profesor que la única diferencia que el código realiza respecto al Método General, es que en `get_rne_bearing_factors()`, el cálculo de $N_\gamma$ usa un factor empírico dictaminado por la norma: `Ngamma = (Nq - 1) * math.tan(1.4 * phi_rad)`. Todo el código está configurado para respetar este límite legal.

---

## 3. FIN DEL CICLO: Protecciones y Cálculos Finales
De vuelta en **`bearing_capacity.py`** (Paso 5):
- **Cálculo Derivado:** El código hace simples restas y divisiones aritméticas: `qnet = qu - q` y `qa = qu / FS`.
- **Capa de Validación (`warnings`):** A lo largo de todas estas funciones, el código va inyectando mensajes en un array `warnings.append()`. 
  - Por ejemplo, hay un `if design_stratum["gammaSat"] < design_stratum["gamma"]:` que lanza un error al usuario porque es físicamente imposible que un suelo con vacíos inundados pese menos que seco.
  - O si `Df == 0`, alerta que es cimentación superficial total.

Estas validaciones demuestran que el programa no es una simple "calculadora tonta", sino un sistema que protege el criterio del ingeniero.
