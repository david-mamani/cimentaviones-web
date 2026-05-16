# CimentAviones Web

Plataforma de análisis geotécnico y diseño de cimentaciones superficiales. Orientada a entornos académicos y profesionales para el cálculo de capacidad portante, modelado BIM y generación de reportes de ingeniería.

---

## Stack tecnológico

| Capa | Tecnologías |
|---|---|
| Frontend | React 19, TypeScript, Vite, Zustand |
| Backend | FastAPI, Python 3.10+, Pydantic v2 |
| Cálculos | Motor Python puro (sin dependencias pesadas) |
| BIM / IFC | ifcopenshell, web-ifc, Three.js |
| Reportes | pdfLaTeX (compilación server-side) |
| Despliegue | Docker + Docker Compose |

---

## Características

- **Motor de cálculo geotécnico** con tres métodos implementados: Terzaghi Clásico, Ecuación General de Capacidad Portante (Das/Meyerhof) y normativa peruana RNE E.050.
- **Memoria de cálculo** paso a paso con renderizado LaTeX/KaTeX en el frontend.
- **Análisis paramétrico** interactivo: variación de B y Df con visualización en gráficos Plotly.js.
- **Visor 3D BIM**: genera archivos IFC al vuelo (compatibles con Revit, ArchiCAD, BlenderBIM) y los visualiza con Three.js + OrbitControls.
- **Visor 2D SVG**: sección transversal interactiva del perfil de suelo y cimentación.
- **Exportación PDF** profesional compilada con pdfLaTeX: tablas, ecuaciones, citas bibliográficas e imágenes de alta fidelidad.
- **Modo claro/oscuro** con diseño enfocado en productividad tipo CAD/IDE.

---

## Estructura del proyecto

```
cimentaviones-web/
├── frontend/                  # Aplicación React + TypeScript
│   └── src/
│       ├── components/
│       │   ├── iterations/    # Análisis paramétrico y gráficos Plotly
│       │   ├── layout/        # AppShell, Toolbar, StatusBar, paneles colapsables
│       │   ├── panels/        # PropertiesPanel (entrada), OutputPanel (resultados y exportación)
│       │   ├── viewer2d/      # Sección transversal SVG
│       │   └── viewer3d/      # Visor IFC con Three.js
│       ├── store/             # Estado global con Zustand
│       │   ├── foundationStore.ts   # Estado principal: cimentación, estratos, cálculo
│       │   ├── unitStore.ts         # Sistema de unidades (Métrico / SI)
│       │   ├── viewerSettingsStore.ts
│       │   └── workspaceStore.ts
│       ├── types/
│       │   └── geotechnical.ts  # Interfaces TypeScript del dominio
│       └── lib/
│           └── validation.ts    # Validación de inputs antes de enviar al backend
│
├── backend/                   # Servidor FastAPI
│   ├── main.py                # Endpoints REST y configuración CORS
│   ├── models.py              # Esquemas Pydantic para request/response
│   ├── services/
│   │   ├── ifc_generator.py       # Generación de archivos IFC con ifcopenshell
│   │   ├── latex_generator.py     # Plantilla LaTeX y compilación a PDF
│   │   └── markdown_generator.py  # Resolución paso a paso para la UI
│   └── tests/
│       └── test_bearing_capacity.py
│
├── calculos/                  # Motor de cálculo (Python puro, sin dependencias web)
│   ├── bearing_capacity.py    # Orquestacion del calculo (pipeline de 13 bloques)
│   ├── factors.py             # Factores Nc, Nq, Nγ analíticos por método
│   ├── methods.py             # Implementacion de los tres metodos + criterios
│   ├── water_table.py         # Correcciones por nivel freatico
│   ├── parametric_iterations.py  # Iterador parametrico (varia B y/o Df)
│   └── DOCUMENTACION_MOTOR.md    # Documentacion tecnica del motor de calculos
│
└── docker-compose.yml
```

---

## Instalación y desarrollo local

### Requisitos previos

- Node.js 18+
- Python 3.10+
- Docker y Docker Compose (recomendado para evitar conflictos con ifcopenshell y TeXLive)
- LaTeX (TeX Live) — solo si ejecutas el backend sin Docker y necesitas exportar PDFs

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

La API queda disponible en `http://localhost:8000`. Documentación interactiva en `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`. El proxy de Vite redirige `/api/*` al backend en el puerto 8000.

---

## Despliegue con Docker

```bash
docker-compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend / API | http://localhost:8000 |

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Default | Descripción |
|---|---|---|
| `ALLOWED_ORIGINS` | `*` | Orígenes permitidos para CORS. En producción, definir como lista separada por comas: `https://mi-dominio.com,https://otro.com` |

---

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/calculate` | Cálculo individual de capacidad portante |
| `POST` | `/api/iterate` | Iteraciones paramétricas (variación de B y/o Df) |
| `POST` | `/api/export-ifc` | Genera archivo IFC del modelo geotécnico |
| `POST` | `/api/export-pdf` | Genera reporte PDF compilado con pdfLaTeX |
| `GET` | `/api/health` | Estado del servidor y configuración activa |

---

## Tests

```bash
# Backend
cd backend
pytest tests/ -v
```

Los tests unitarios cubren:
- Tabla de factores de Terzaghi (interpolación, rangos válidos)
- Cálculos completos de capacidad portante (arcilla, arena, casos con nivel freático)
- Guards defensivos (B=0, FS=0, estratos vacíos, phi fuera de rango)
- Iteraciones paramétricas

---

## Flujo de datos

```
Usuario (UI)
  → foundationStore.calculate()
      → POST /api/calculate  [strata convertidos a SI antes de enviar]
          → proyectoc_engine.py  [convierte SI → Métrico internamente]
              → bearing_capacity.py + factors.py + methods.py + water_table.py
          ← CalculationResult + resolution_md (markdown paso a paso)
      ← resultado en store → re-render de ResultsPanel + viewers
```

Para exportaciones (PDF, IFC), el frontend recoge capturas de los viewers y las envía junto con los datos al endpoint correspondiente en `services/`.

---

## Licencia

Desarrollado para fines académicos y de investigación. Ingeniería de software aplicada a la geotecnia.
