# PROMPT PARA EQUIPO UI/UX — Cimentaciones Web

> **Instrucciones para el equipo:** Se les adjuntan 2 imágenes:
> 1. **Imagen A**: Screenshot del estado actual de la app
> 2. **Imagen B**: UI de referencia que queremos emular/inspirarnos
>
> Lean este documento completo (describe TODAS las funciones, inputs, vistas y flujos de la app), observen ambas imágenes, y propongan **3 opciones de diseño UI/UX** que rediseñen la experiencia manteniendo TODAS las funcionalidades descritas.

---

## CONTEXTO DEL PROYECTO

Cimentaciones Web es una herramienta de ingeniería geotécnica para calcular la capacidad portante de cimentaciones superficiales. Es una app de escritorio (no mobile). El usuario típico es un ingeniero civil que ingresa datos de suelo y cimentación, ejecuta cálculos, y exporta reportes profesionales.

**Stack técnico**: React + TypeScript + Vite (frontend) | FastAPI + Python (backend) | Docker  
**Lenguaje de la UI**: Español

---

## LAYOUT DE LA APP

La app tiene un layout de **3 columnas** con toolbar superior y status bar inferior:

```
┌──────────────────────────────────────────────────────────────────┐
│                      TOOLBAR (barra superior)                    │
├──────────┬──────────────────────────────────┬────────────────────┤
│          │                                  │                    │
│  PANEL   │         WORKSPACE                │   PANEL            │
│  IZQUIERDO│    (área central de vistas)      │   DERECHO          │
│  (inputs)│                                  │   (resultados +    │
│          │                                  │    exportación)    │
│          │                                  │                    │
├──────────┴──────────────────────────────────┴────────────────────┤
│                    STATUS BAR (barra inferior)                   │
└──────────────────────────────────────────────────────────────────┘
```

- **Ambos paneles laterales** son **resizables** (drag para cambiar ancho) y **colapsables** (se ocultan y queda solo un botón estrecho para re-abrirlos)
- **El workspace central** maneja **tabs** (pestañas) que el usuario abre/cierra
- Existe un modo **split** que divide el workspace en 2 mitades lado a lado

---

## TODAS LAS FUNCIONES — DETALLE COMPLETO

### 1. TOOLBAR (Barra Superior)

La toolbar está organizada en **5 grupos** separados por divisores verticales:

#### Grupo 1: Logo
- **Logo "CA"**: Cuadrado rojo con las letras "CA" en blanco. Solo decorativo.

#### Grupo 2: Proyecto
| Botón | Ícono | Acción |
|-------|-------|--------|
| **Guardar** | 💾 | Descarga un archivo `.json` con todos los datos del proyecto (cimentación, estratos, condiciones, método, config L/B) |
| **Cargar** | 📂 | Abre un file picker, carga un `.json` previamente guardado y restaura todo el estado |

#### Grupo 3: Análisis
| Botón | Ícono | Acción |
|-------|-------|--------|
| **Calcular** | ▶ | **Botón principal (accent rojo).** Valida todos los inputs → envía al backend → muestra resultados. Durante el cálculo muestra "⏳ Calculando..." y se deshabilita |
| **Reset** | ↺ | Restaura TODOS los valores a los defaults iniciales (borra resultados, estratos, todo) |

#### Grupo 4: Vista
| Botón | Ícono | Acción |
|-------|-------|--------|
| **2D** | □ | Abre una pestaña con la **vista 2D** (corte transversal técnico SVG) |
| **3D** | ⬡ | Abre una pestaña con la **vista 3D** (modelo Three.js interactivo) |
| **Split** | ▥ | Activa/desactiva el modo split (2 vistas lado a lado). Tiene estado activo/inactivo visual |
| **Gráficas** | ⊞ | Abre una pestaña con el módulo de **iteraciones paramétricas + gráfico Plotly** |
| **Resultados** | ≡ | Abre una pestaña con la **tabla completa de resultados** |

#### Grupo 5: Info
| Botón | Ícono | Acción |
|-------|-------|--------|
| **Créditos** | ℹ | Abre un **modal** con info del autor, universidad, y versión de la app |

#### Extremo derecho de la toolbar
| Botón | Ícono | Acción |
|-------|-------|--------|
| **Toggle panel izquierdo** | ◧ | Colapsa/expande el panel izquierdo. Tiene estado visual activo |
| **Toggle panel derecho** | ◨ | Colapsa/expande el panel derecho. Tiene estado visual activo |

---

### 2. PANEL IZQUIERDO — Propiedades (Inputs)

El panel izquierdo contiene TODAS las entradas de datos del usuario. Está dividido en **5 secciones colapsables** (cada una tiene un header clickeable con flecha ▶ que rota al abrir):

#### Sección 1: Tipo de Cimentación
- **4 botones en grid 2×2**: `Cuadrada`, `Rectangular`, `Circular`, `Franja`
- Solo uno activo a la vez (el seleccionado se muestra en rojo accent)
- Cambiar tipo **invalida el resultado** actual (hay que recalcular)

#### Sección 2: Dimensiones
| Input | Tipo | Rango | Unidad | Notas |
|-------|------|-------|--------|-------|
| **Lado B** | numérico | > 0 | m | Ancho de la cimentación |
| **Lado L** | numérico | > 0 | m | **Solo visible si tipo = rectangular.** Se deshabilita si L/B está bloqueado |
| **Checkbox "L = k × B"** | checkbox | — | — | Solo visible si rectangular. Cuando está activo, L se calcula automáticamente |
| **k (L/B)** | numérico | ≥ 1 | — | Solo visible si el checkbox está activo. Define la razón L/B |
| **Prof. desplante Df** | numérico | ≥ 0 | m | Profundidad de desplante |
| **Factor de Seguridad** | numérico | 1.5 – 5.0 | — | FS para calcular qa = qu/FS |
| **Ángulo inclinación β** | numérico | 0 – 45 | ° | Ángulo de inclinación de la carga |

#### Sección 3: Método de Cálculo
- **3 botones en fila**: `Terzaghi`, `Ec. General`, `RNE E.050`
- Solo uno activo a la vez
- Cambiar método **invalida el resultado** actual

#### Sección 4: Condiciones Especiales
| Input | Tipo | Notas |
|-------|------|-------|
| **Checkbox "Nivel freático"** | checkbox | Activa/desactiva la consideración del nivel freático |
| **Prof. NF Dw** | numérico (≥ 0, metros) | Solo visible si NF está activado |
| **Checkbox "Sótano"** | checkbox | Activa/desactiva la corrección por sótano |
| **Prof. sótano Ds** | numérico (≥ 0, metros) | Solo visible si Sótano está activado |

#### Sección 5: Estratos del Suelo
- **Tabla editable** con N filas (mínimo 1 estrato)
- Columnas: `N°` | `h(m)` | `γ` | `c` | `φ` | `γsat` | `[×]`
  - **N°**: Número del estrato + color picker (cuadradito de color clickeable)
  - **h(m)**: Espesor del estrato en metros (> 0)
  - **γ**: Peso unitario natural en kN/m³ (> 0)
  - **c**: Cohesión en kPa (≥ 0)
  - **φ**: Ángulo de fricción interna en grados (0° – 50°)
  - **γsat**: Peso unitario saturado en kN/m³ (> 0, debe ser ≥ γ)
  - **[×]**: Botón para eliminar el estrato (solo visible si hay más de 1)
- **Botón "+ Agregar estrato"** debajo de la tabla

**Interacciones especiales de la tabla:**
- El color picker de cada estrato sincroniza con los colores del visor 2D y 3D
- Todos los campos numéricos permiten borrar → muestra "—" (dash)
- Cualquier cambio en la tabla invalida el resultado actual

---

### 3. WORKSPACE CENTRAL — 5 Tipos de Pestaña

#### Pestaña: Vista 2D (Corte Técnico SVG)
- Dibujo SVG de un **corte transversal** del suelo mostrando:
  - **Estratos como bandas coloreadas** con hatch pattern (líneas a 45°)
  - **Cimentación** como bloque gris (zapata + columna)
  - **Línea de superficie** (NTN 0.00) con hatching
  - **Nivel freático** como línea azul punteada con relleno translúcido debajo
  - **Nivel de sótano** como línea roja punteada
  - **Cotas** (dimensiones): líneas de acotación para B y Df
  - **Etiquetas** de profundidad en cada límite de estrato
  - **Tabla de propiedades** dibujada a la derecha del corte (N°, h, γ, c, φ, γsat)
- **Interacciones**:
  - Click en un estrato → lo selecciona (borde rojo, sincronizado con la tabla)
  - Click en la cimentación → la selecciona
  - Ctrl+Click → multi-selección
  - Click en fondo → deselecciona todo
  - **Pan**: click derecho + arrastrar
  - **Zoom**: scroll del mouse (rueda)

#### Pestaña: Vista 3D (Three.js + IFC)
- Modelo 3D interactivo con:
  - **Estratos** como cajas 3D con colores, opacidad ajustable, wireframe opcional
  - **Cimentación** como bloque gris sólido
  - **Plano de agua** translúcido azul (si NF activo)
  - **Grilla** en el suelo
  - **Etiquetas** 3D con dimensiones
  - **Controles orbitales** (rotar, pan, zoom con mouse)
- **Panel de configuración visual** (se abre como overlay desde un botón ⚙):
  - Slider: Opacidad de estratos (0.05 – 1.0)
  - Checkbox: Wireframe
  - Color pickers: Un color por estrato
  - Color picker + slider: Color y opacidad de cimentación
  - Color picker + slider: Color y opacidad del agua
  - Checkbox: Mostrar grilla
  - Checkbox: Mostrar etiquetas
  - Slider: Intensidad de luz ambiental (0.1 – 1.5)
  - Color picker: Color de fondo
  - Botón "Restablecer valores"

#### Pestaña: Gráficas (Iteraciones Paramétricas)
- **Panel de configuración** (arriba):
  - Checkbox "Variación de base (B)" + 3 inputs: Inicio, Final, ΔB
  - Info box: muestra si L varía con B (cuando L/B bloqueado) o L es fijo
  - Checkbox "Variación de desplante (Df)" + 3 inputs: Inicio, Final, ΔDf
  - **Botón "▶ Ejecutar Iteraciones"** (accent rojo, ancho completo)
- **Resultados de iteraciones** (abajo, solo después de ejecutar):
  - **Toggle de métrica**: 2 botones → `q_adm (kPa)` | `Q_max (kN)`
  - **Gráfico Plotly interactivo**: Líneas con marcadores, una línea por cada valor de Df
    - Eje X: B (m)
    - Eje Y: q_adm o Q_max
    - Hover con datos detallados
    - Toolbar de Plotly (zoom, pan, save as PNG, etc.)
    - Background oscuro (#141414)
  - **Handle de resize** para cambiar la altura del gráfico (drag vertical)
  - **Anotaciones**: lista scrollable con cada cálculo individual
  - **3 botones de exportación**: `📄 JSON` | `📊 CSV` | `📝 TXT`

#### Pestaña: Resultados (Tabla Completa)
- Tabla completa organizada en secciones:
  1. **Estrato de Diseño**: N° estrato, tipo suelo (Cohesivo/Friccionante), φ, c, γ, γsat
  2. **Factores de Capacidad Portante**: Nc, Nq, Nγ
  3. **Sobrecarga y Correcciones**: q, γ efectivo, caso NF
  4. **Términos Individuales**: F1, F2, F3
  5. **Capacidades Portantes** (sección destacada): qu, qneta, qa, qa_neta, Q_max
  6. **Consideración RNE**: qu RNE, qa RNE, qu RNE corregido

---

### 4. PANEL DERECHO — Resultados + Exportación

#### Sección de Errores (aparece solo cuando hay errores)
- Lista de errores de validación en rojo (ej: "El espesor debe ser mayor a 0")

#### Sección Resultados Rápidos (aparece solo después de calcular)
- Badge de tipo de suelo: "COHESIVO" (azul) o "FRICCIONANTE" (rojo)
- Estrato de diseño usado
- Valores: qu, qneta, **qa** (destacado en rojo), qa_neta, **Q_max** (destacado en rojo)
- Términos: F1, F2, F3

#### Sección Factores
- Nc, Nq, Nγ en línea
- q (sobrecarga) y γ efectivo

#### Sección Consideración RNE
- qu RNE, qa RNE, qu RNE corregido

#### Sección Exportar
- **Opciones del PDF** (6 checkboxes):
  - ☑ Ecuaciones y cálculos
  - ☑ Datos de estratos
  - ☐ Tabla de iteraciones
  - ☐ Vista 2D
  - ☐ Vista 3D
  - ☐ Gráfico de iteraciones
- **Botón "📄 Exportar PDF"** (accent rojo, ancho completo, muestra loading)
- **3 botones de exportación** en fila: `📁 IFC` | `📊 CSV` | `📋 TXT`

**Formatos de exportación:**
| Formato | Qué exporta | Generado en |
|---------|-------------|-------------|
| **PDF** | Reporte profesional LaTeX con ecuaciones, tablas, imágenes | Backend (pdflatex) |
| **IFC** | Modelo BIM 3D del suelo + cimentación | Backend (IfcOpenShell) |
| **CSV** | Tabla de parámetros y resultados | Frontend |
| **TXT** | Reporte de texto plano formateado | Frontend |

---

### 5. STATUS BAR (Barra Inferior)

Muestra 3 elementos:
1. **Método activo**: "Terzaghi" | "Ec. General" | "RNE E.050"
2. **Resultado rápido**: `qa = X.XX kPa` (en verde si hay resultado)
3. **Error**: Primer error de validación (en rojo, si existe)

---

### 6. MODAL DE CRÉDITOS

- Se abre con backdrop blur oscuro
- Contenido:
  - Logo "CA" en cuadrado rojo
  - "Cimentaciones Web" + "Versión 1.1"
  - Sección "Desarrollado por" con nombre del autor
  - Sección "Universidad" con placeholder para logo + "Universidad Católica de Santa María, Arequipa, Perú"
  - Texto técnico: métodos soportados y tecnologías
  - Botón "Cerrar" (rojo)

---

## FLUJO DE USUARIO TÍPICO

```
1. El ingeniero abre la app → Ve el panel izquierdo con valores default
2. Selecciona tipo de cimentación (ej: Cuadrada)
3. Ajusta dimensiones: B, Df, FS
4. Elige método de cálculo (ej: Terzaghi)
5. Edita los estratos del suelo en la tabla (agrega/quita filas, cambia propiedades)
6. (Opcional) Activa nivel freático y/o sótano
7. Presiona "▶ Calcular"
   → La app valida → envía al backend → muestra resultados en el panel derecho y status bar
8. Abre la vista 2D y/o 3D para visualizar el modelo
9. (Opcional) Abre "Gráficas" para iterar B y Df → gráfico interactivo
10. Exporta: PDF profesional, modelo IFC, CSV, o TXT
11. (Opcional) Guarda el proyecto como JSON para continuar después
```

---

## RESUMEN DE INPUTS Y OUTPUTS

### Inputs totales del usuario:
- **4 botones de tipo** (selección exclusiva)
- **3 botones de método** (selección exclusiva)
- **6 inputs numéricos** de cimentación (B, L, Df, FS, β, k)
- **1 checkbox + 1 input** para L/B lock
- **2 checkbox + 2 inputs** para condiciones (NF, sótano)
- **N × 5 inputs** numéricos por estrato (h, γ, c, φ, γsat)
- **N color pickers** (uno por estrato)
- **6 checkboxes** de opciones PDF
- **6 inputs** de iteraciones (B start/end/step, Df start/end/step)
- **2 checkboxes** de iteraciones (varyB, varyDf)

### Outputs visuales:
- Vista 2D SVG interactiva
- Vista 3D Three.js interactiva
- Gráficos Plotly interactivos
- Tabla de resultados
- Panel de resultados rápidos
- Status bar

### Outputs exportables:
- PDF profesional (LaTeX)
- Modelo IFC (BIM)
- CSV, TXT, JSON

---

## ESTILO VISUAL ACTUAL

- **Tema**: Dark mode exclusivo (#1e1e1e fondo)
- **Accent**: Un solo color rojo ladrillo (#c0392b)
- **Tipografía**: system-ui (UI) + Consolas (datos numéricos)
- **Controles**: Estilo CAD/Revit — inputs con borde inferior punteado, botones planos sin border-radius
- **Íconos**: Emojis y Unicode (💾, ▶, ↺, etc.)

---

## QUÉ NECESITAMOS DEL EQUIPO

Con toda esta información + las 2 imágenes adjuntas:

1. **Opción A**: Rediseño completo manteniendo el paradigma CAD/Revit pero modernizado
2. **Opción B**: Diseño minimalista tipo SaaS/dashboard moderno
3. **Opción C**: Su mejor propuesta híbrida

Cada opción debe mostrar:
- Layout general (cómo se distribuyen los paneles)
- Estilo de los inputs y controles
- Paleta de colores propuesta
- Tipografía
- Cómo se verían las vistas 2D/3D integradas
- Cómo se manejan las exportaciones
- Estado vacío vs estado con resultados
