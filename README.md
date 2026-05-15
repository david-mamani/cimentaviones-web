# CimentAviones Web

> Plataforma profesional de análisis geotécnico y diseño de cimentaciones superficiales. Desarrollada para entornos académicos y profesionales.

**Stack**: React + TypeScript + Vite + Zustand (Frontend) | FastAPI + Python + ifcopenshell + pdfLaTeX (Backend) | Docker

##  Características Principales

*   **Motor de Cálculo Geotécnico Riguroso**: Implementa las formulaciones de **Terzaghi Clásico** y la **Ecuación General de Capacidad Portante** (Das/Meyerhof), además de comprobaciones normativas locales (RNE E.050).
*   **Transparencia de Cálculos**: Generación de memoria de cálculo detallada paso a paso, renderizada en **LaTeX** directamente en el frontend.
*   **Análisis Paramétrico**: Iterador interactivo integrado para evaluar variaciones de $B$ y $D_f$, con gráficos generados mediante Plotly.js.
*   **Modelado BIM y Visualización 3D**:
    *   Generación al vuelo de archivos estandarizados **IFC** (compatibles con Revit, ArchiCAD, BlenderBIM).
    *   Visor 3D incorporado usando **web-ifc** y **Three.js** con soporte "fit-to-object".
*   **Reportes PDF Profesionales**: Exportación de reportes de ingeniería utilizando **LaTeX**, con tablas de iteraciones, citas bibliográficas (Terzaghi, Meyerhof, Das) e imágenes de las vistas 2D y 3D en alta fidelidad.
*   **Estética Elegante (Dark/Light Mode)**: Diseño enfocado en productividad profesional con tipografía y jerarquía visual optimizadas (inspirado en software CAD e IDEs modernos).

##  Estructura del Proyecto

El código está estructurado en una arquitectura cliente-servidor estrictamente desacoplada:

### Frontend (`frontend/`)
*   `src/store/`: Estado global optimizado con **Zustand** (`foundationStore`, `unitStore`, `workspaceStore`).
*   `src/components/`:
    *   `viewer3d/`: Lógica de renderizado IFC y WebGL.
    *   `viewer2d/`: Generador de sección transversal en SVG interactivo.
    *   `panels/`: Paneles de herramientas (Propiedades, Resultados).
    *   `iterations/`: Componentes para el análisis iterativo y sus gráficos interactivos.
*   `src/types/`: Definiciones estrictas de TypeScript (`geotechnical.ts`).

### Backend (`backend/`)
*   `calculos/`: Motor numérico en Python puro. Módulos de física geotécnica sin dependencias pesadas (`factors.py`, `methods.py`, `bearing_capacity.py`).
*   `services/`: Generadores de archivos especializados (desacoplados del motor):
    *   `ifc_generator.py`: Motor OpenBIM.
    *   `latex_generator.py`: Compilador del reporte final (requiere entorno TeX).
    *   `markdown_generator.py`: Generador de resoluciones paso a paso para la UI.
*   `main.py` y `models.py`: API REST con validaciones estrictas usando **Pydantic** y endpoints FastAPI.

##  Instalación y Entorno de Desarrollo

### Requisitos Previos
*   **Node.js** (v18+)
*   **Python** (3.10+)
*   **Docker** y **Docker Compose** (Opcional, pero recomendado para LaTeX/IFC y producción).
*   **LaTeX (TeX Live)**: Requerido localmente *solo* si se ejecuta el backend sin Docker y se desea exportar PDFs.

### Desarrollo Local

1.  **Backend**:
    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate  # o venv\Scripts\activate en Windows
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
    ```
2.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

### Despliegue con Docker

El proyecto está dockerizado para evitar conflictos de dependencias, especialmente con `ifcopenshell` y `texlive`.

```bash
docker-compose up --build
```
La aplicación estará disponible en `http://localhost:5173` y la API en `http://localhost:8000`.

## 📐 Flujo de Trabajo (Arquitectura Lógica)

1.  **Ingreso de Datos (UI)**: El usuario introduce la estratigrafía y la geometría. El `unitStore` aísla el sistema de unidades y unifica la data en SI.
2.  **Validación**: El `foundationStore` asegura integridad (ej. bloquea Terzaghi para geometrías rectangulares).
3.  **Procesamiento (Python)**: El request llega a `main.calculate`, que delega al motor de capacidad portante. 
4.  **Respuesta Híbrida**: Se retornan los tensores de datos (`CalculationResult`) junto con el `resolution_md` inyectado para la UI.
5.  **Exportación**: Cuando el usuario solicita un PDF o IFC, se envían los tensores a los `services/` correspondientes que orquestan las librerías binarias.

##  Licencia

Desarrollado para fines académicos y de investigación. Ingeniería de software aplicada a la geotecnia.
