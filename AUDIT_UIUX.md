# 🎨 Auditoría UI/UX — CimentAviones Web

> Documento para reunión con equipo de diseño UI/UX  
> Versión corregida y actualizada — 7 mayo 2026  
> **Estado del código: Robusto y limpio** ✅

---

## 1. Estado Actual del Código

### ✅ Lo que está robusto (ya resuelto)

| Área | Estado |
|------|--------|
| **Validación backend** | Pydantic con rangos: B>0, L>0, FS∈[1,10], φ∈[0,50], β∈[0,45] |
| **Validación frontend** | Zod v4 con rangos equivalentes + validación cruzada |
| **Motor de cálculos** | Guards defensivos en los 6 módulos + clamp de inclinación |
| **State management** | Zustand 100% type-safe, sin `any`, sin window globals |
| **Código muerto** | Eliminado: 7 archivos (~660 LOC de Tailwind legacy) |
| **Tests** | 19 tests cubriendo edge cases y 3 métodos |

### ⚠️ Lo que queda para el equipo UI/UX

| Área | Problema | Decisión necesaria |
|------|----------|-------------------|
| **Estilos inline** | ~272 `style={{}}` vs 14 clases CSS | ¿Migrar a clases CSS / UI library? |
| **Íconos** | 12 emojis + 6 Unicode (▶, ↺, ✕, etc.) | ¿SVG icons? ¿Lucide/Phosphor? |
| **Tipografía** | `system-ui` default | ¿Inter? ¿JetBrains Mono para datos? |
| **Accesibilidad** | Sin `aria-label`, sin keyboard nav, contrast ratio bajo | Requiere audit WCAG |
| **Color accent** | Solo `#c0392b` (rojo ladrillo) | ¿Paleta extendida? |

---

## 2. Layout General — Estructura Verificada

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOOLBAR (40px)  [CA] | 💾 📂 | ▶Calcular ↺Reset | □2D ⬡3D ▥Split │
│                      |        | ⊞Gráficas ≡Resultados | ℹ | ◧ ◨   │
├────────────┬─────────────────────────────────────┬───────────────────┤
│            │                                     │                   │
│ LEFT PANEL │           WORKSPACE                 │   RIGHT PANEL     │
│ (Properties│  ┌─────────┬─────────┐              │   (Output/Export)  │
│  + Viewer  │  │ Tab 1   │ Tab 2   │  (optional)  │                   │
│  Settings) │  │ (2D/3D/ │ (Split  │              │                   │
│            │  │  Charts/│  mode)  │              │                   │
│ Resizable  │  │  Results│         │              │   Resizable       │
│ Collapsible│  └─────────┴─────────┘              │   Collapsible     │
├────────────┴─────────────────────────────────────┴───────────────────┤
│ STATUS BAR (24px)  [método] | [resultado qa] | [estado]             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes Activos (14 total, ~3,400 LOC)

| Componente | Archivo | LOC | Rol |
|------------|---------|-----|-----|
| `AppShell` | `layout/AppShell.tsx` | 82 | Container principal, 3 columnas |
| `Toolbar` | `layout/Toolbar.tsx` | 243 | Ribbon bar: Proyecto / Análisis / Vista / Info |
| `CollapsiblePanel` | `layout/CollapsiblePanel.tsx` | 158 | Paneles laterales resizables con drag handle |
| `StatusBar` | `layout/StatusBar.tsx` | 51 | Método + resultado rápido + errores |
| `CreditsModal` | `layout/CreditsModal.tsx` | 129 | Modal "Acerca de" con backdrop blur |
| `Workspace` | `workspace/Workspace.tsx` | 224 | Gestor de tabs (2D, 3D, Charts, Results) |
| `PropertiesPanel` | `panels/PropertiesPanel.tsx` | 300 | Inputs: tipo, dimensiones, estratos, condiciones |
| `OutputPanel` | `panels/OutputPanel.tsx` | 546 | Resultados rápidos + exportación (IFC, PDF, JSON) |
| `Viewer2D` | `viewer2d/Viewer2D.tsx` | 348 | Vista SVG técnica con cotas, hatching, pan/zoom |
| `IfcViewer` | `viewer3d/IfcViewer.tsx` | ~400 | Vista 3D Three.js con WASM IFC |
| `ViewerSettingsPanel` | `viewer3d/ViewerSettingsPanel.tsx` | 216 | Config visual: opacidad, colores, wireframe |
| `ParametricIterations` | `iterations/ParametricIterations.tsx` | 426 | Iteraciones B/Df + gráfico Plotly interactivo |
| `ResultsPanel` | `visualization/ResultsPanel.tsx` | 146 | Tabla completa de resultados |
| `CadNumericInput` | `common/CadNumericInput.tsx` | 110 | Input numérico con dash para vacío |

---

## 4. Sistema de Diseño Actual

### Tokens CSS (`index.css` — 250 LOC)

| Token | Valor | Uso |
|-------|-------|-----|
| `--bg-primary` | `#1e1e1e` | Fondo principal |
| `--bg-secondary` | `#2a2a2a` | Paneles |
| `--bg-hover` | `#3a3a3a` | Hover states |
| `--text-primary` | `#e0e0e0` | Texto principal |
| `--text-secondary` | `#999` | Labels, subtítulos |
| `--accent` | `#c0392b` | **Único** color de acento (rojo ladrillo) |
| `--border` | `#505050` | Bordes de paneles |
| `--status-success` | `#27ae60` | Verde (status bar) |
| `--status-error` | `#e74c3c` | Rojo error |

### Clases CSS de controles

| Clase | Descripción |
|-------|-------------|
| `.cad-input` | Input monospace, borde inferior punteado, sin border-radius |
| `.cad-btn` | Botón plano, sin border-radius, hover subtle |
| `.cad-btn-accent` | Botón accent `#c0392b`, texto blanco |
| `.cad-select` | Select nativo estilizado dark |
| `.cad-checkbox` | Checkbox con `accent-color: #c0392b` |

### Deuda técnica de estilos

| Problema | Cantidad | Ejemplo |
|----------|----------|---------|
| Estilos inline | ~272 ocurrencias | `style={{ padding: 8, fontSize: 11 }}` |
| Spacing inconsistente | 8 valores | 4, 6, 8, 10, 12, 14, 16, 20px |
| Componentes internos duplicados | 3 pares | `SectionHeader`, `Row`, `SliderControl` redefinidos |
| Sin responsive | 0 breakpoints | Ancho mínimo hardcoded |

---

## 5. Arquitectura de Datos (Contexto técnico)

### Flujo de un cálculo

```
[PropertiesPanel] → foundationStore → [Toolbar: Calcular]
                                           ↓
                                    Zod validation (frontend)
                                           ↓
                                    POST /api/calculate
                                           ↓
                                    Pydantic validation (backend)
                                           ↓
                                    bearing_capacity.py (motor)
                                           ↓
                                    foundationStore.result
                                           ↓
                    ┌──────────────────────────────────────────┐
                    ↓           ↓            ↓          ↓      ↓
              OutputPanel  ResultsPanel  Viewer2D  StatusBar  Viewer3D
```

### Stores (3 total)

| Store | Datos | Consumido por |
|-------|-------|---------------|
| `foundationStore` | foundation, strata, conditions, method, result, errors, isCalculating | Todos los componentes |
| `workspaceStore` | addTab(), captureView3D() | Toolbar, OutputPanel |
| `viewerSettingsStore` | colores, opacidad, grid, labels | IfcViewer, Viewer2D, ViewerSettingsPanel |

---

## 6. Exportaciones disponibles

| Formato | Implementación | Estado |
|---------|---------------|--------|
| **PDF** | LaTeX → pdflatex (backend Docker) | ✅ Funcional, incluye ecuaciones |
| **IFC** | IfcOpenShell (backend) | ✅ Funcional, IFC2X3 |
| **JSON** | Descarga directa (frontend) | ✅ Proyecto + iteraciones |
| **CSV** | Descarga directa (frontend) | ✅ Solo iteraciones |
| **TXT** | Descarga directa (frontend) | ✅ Solo iteraciones |
| **PNG** | Plotly toImage (frontend) | ✅ Gráficos de iteraciones |

---

## 7. Preguntas para la reunión

### Decisiones de alto nivel

1. **¿Mantener estilo CAD/Revit o migrar a minimalista moderno?**
   - Actual: dark theme, monospace, inputs con borde inferior, sin border-radius
   - Alternativa: Material, Shadcn, Radix

2. **¿Librería de UI?**
   - Actual: CSS vanilla + 272 inline styles
   - Opciones: Shadcn/Radix, Ant Design, Material UI

3. **¿Sistema de íconos?**
   - Actual: 18 emojis/Unicode (💾, ▶, ↺, ⬡, etc.)
   - Opciones: Lucide, Phosphor, Heroicons

4. **¿Tipografía?**
   - Actual: system-ui / Consolas
   - Propuesta: Inter + JetBrains Mono (datos numéricos)

5. **¿Responsive o solo desktop?**
   - Actual: solo desktop (min-width hardcoded)
   - El flujo de trabajo ingenieril sugiere desktop-first

### Decisiones de componente

6. **OutputPanel** (546 LOC) — ¿Separar resultados de exportación en componentes?
7. **PropertiesPanel** — ¿Tabs o secciones colapsables para los inputs?
8. **ViewerSettingsPanel** — ¿Overlay flotante o panel dedicado?
9. **CreditsModal** — ¿Logo de universidad real o placeholder?
10. **StatusBar** — ¿Mostrar más info (tipo suelo, caso NF)?

---

> 📌 **El código está robusto y limpio.** El equipo de UI/UX puede trabajar sobre esta base sin sorpresas técnicas, sabiendo exactamente qué componentes existen, qué hacen, y dónde están los problemas de estilo.
