# TODO — Correcciones Pendientes

## 🔒 Autenticación
- [ ] Implementar autenticación de usuarios si se decide escalar la app
- [ ] CORS actualmente permite `*` — restringir a dominios específicos en producción
- [ ] Considerar rate limiting en los endpoints de la API

## ~~📁 Directorios Vacíos~~ ✅ COMPLETADO
- [x] `frontend/src/styles/` — Eliminado (vacío)
- [x] `frontend/src/components/export/` — Eliminado (vacío)

## ~~🧩 UI — Componentes No Usados~~ ✅ COMPLETADO
- [x] `frontend/src/components/layout/Header.tsx` — Eliminado (58 LOC, Tailwind, no usado)
- [x] `frontend/src/components/foundation/` — Eliminado (4 archivos, ~370 LOC, Tailwind, no usados)
- [x] `frontend/src/components/strata/` — Eliminado (2 archivos, ~185 LOC, Tailwind, no usados)
- [x] Total eliminado: **7 archivos, ~660 LOC de código muerto**

## ~~🔗 Window Globals~~ ✅ COMPLETADO
- [x] `window.__workspaceAddTab` → Migrado a `workspaceStore.ts` (Zustand)
- [x] `window.__captureView3D` → Migrado a `workspaceStore.ts` (Zustand)
- [x] Workspace y IfcViewer registran funciones en el store al montar
- [x] AppShell/Toolbar y OutputPanel las consumen del store de forma type-safe

## ~~🛡️ Robustez Backend~~ ✅ COMPLETADO
- [x] `models.py` — Field() con rangos (gt, ge, le) + model_validators
- [x] `main.py` — try/except con HTTPException en /calculate y /iterate
- [x] Motor de cálculos — Guards contra B=0, L=0, FS=0, strata vacíos
- [x] `inclination_factors.py` — Clamp igamma cuando β≥φ
- [x] `parametric_iterations.py` — Límite de 500 puntos + mensajes de error

## ~~🔧 Robustez Frontend~~ ✅ COMPLETADO
- [x] `foundationStore.ts` — `any` → `IterationResult | null`, isCalculating
- [x] `CadNumericInput.tsx` — Sanitización de input no numérico
- [x] `OutputPanel.tsx` — `any` → tipos reales de geotechnical.ts
- [x] `Toolbar.tsx` — Botón Calcular con loading state

## ~~🧪 Tests~~ ✅ COMPLETADO
- [x] 19 tests (7 originales + 12 edge cases): B=0, L=0, FS=0, strata vacíos, φ>50, NF cases, métodos, iteraciones

## 📦 WASM en Docker
- [ ] Agregar `public/wasm/*.wasm` al `.gitignore` o manejar como parte del build
- [ ] Considerar un script postinstall que copie los WASM automáticamente

---
*Última actualización: 2026-05-07*
