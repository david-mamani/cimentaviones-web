# Bottom Panel — Implementación Futura

> Feature planificada para la siguiente iteración de UI. No implementar todavía.

---

## Concepto

Panel colapsable horizontal debajo del viewport central (entre los paneles laterales). Resizable con drag handle vertical. Se expande/colapsa con un botón o shortcut.

```
├──────────┬──────────────────────────────────┬────────────────────┤
│          │         VIEWPORT (2D/3D)         │                    │
│  LEFT    │                                  │   RIGHT            │
│          ├──────────────────────────────────┤                    │
│          │  ▲ drag handle                   │                    │
│          │  ┌──────────────────────────────┐│                    │
│          │  │ [Estratos] [Consola] [Zapata]││                    │
│          │  │                              ││                    │
│          │  │  contenido del tab activo     ││                    │
│          │  └──────────────────────────────┘│                    │
├──────────┴──────────────────────────────────┴────────────────────┤
```

## Tabs propuestos

### 1. Estratos (tabla)
- La tabla compacta de estratos del PropertiesPanel renderizada en formato ancho
- Aprovecha el espacio horizontal para mostrar todas las columnas con labels completos
- Edición inline directa
- Scrollable si hay muchos estratos

### 2. Consola
- Log en tiempo real de las operaciones:
  - `[15:30:02] Cálculo ejecutado — Terzaghi, qa = 186.07 kPa`
  - `[15:30:05] Exportación PDF iniciada...`
  - `[15:30:08] ✅ PDF generado (2.3 MB)`
  - `[15:31:00] ⚠ Validación: Σ espesores (2.0m) < Df (3.0m)`
- Historial de cálculos clickeable (restaura los params de ese cálculo)
- Filtros: Todo | Cálculos | Exportaciones | Errores

### 3. Vista Zapata
- Vista aislada de solo la cimentación (sin estratos)
- Cotas detalladas: B, L, Df, pedestal
- Útil para revisión rápida de geometría
- Podría incluir diagramas de esfuerzos en el futuro

## Implementación técnica

- Componente `BottomPanel.tsx` con tabs internos
- Estado en `workspaceStore.ts`: `bottomPanelOpen`, `bottomPanelHeight`, `bottomPanelTab`
- Drag handle reutiliza la lógica de `CollapsiblePanel.tsx` pero en eje Y
- Keyboard shortcut: `Ctrl+J` (como VS Code)
- Altura default: 200px, min: 100px, max: 50% del viewport

## Dependencias
- Necesita un `calculationLogStore.ts` para el historial de cálculos
- La vista Zapata necesita un sub-componente del Viewer2D que renderice solo la cimentación

---

*Documento creado: 2026-05-07 — Prioridad: Siguiente sprint*
