"""
Motor de generación de reportes LaTeX — Documentos profesionales de ingeniería.

Genera archivos .tex completos con:
  - Portada profesional
  - Índice automático
  - Datos de cimentación en tablas
  - Estratos del suelo en tabla
  - Ecuaciones de cálculo con formato LaTeX real
  - Gráficos de iteraciones (imagen)
  - Vistas 2D/3D (imágenes)
  - Resultados y consideración RNE
  - Todo en español

Dependencia: texlive en el contenedor Docker para compilar a PDF.
"""

import base64
import os
import subprocess
import tempfile
from pathlib import Path


def _escape_latex(text: str) -> str:
    """Escapa caracteres especiales de LaTeX."""
    replacements = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\textasciicircum{}',
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    return text


def _save_base64_image(b64_data: str, filepath: str):
    """Decodifica una imagen base64 y la guarda como archivo."""
    # Remove data URL prefix if present
    if ',' in b64_data:
        b64_data = b64_data.split(',', 1)[1]
    img_bytes = base64.b64decode(b64_data)
    with open(filepath, 'wb') as f:
        f.write(img_bytes)


def generate_latex(
    foundation: dict,
    strata: list,
    conditions: dict,
    method: str,
    result: dict,
    options: dict = None,
    images: dict = None,
) -> str:
    """
    Genera el contenido de un archivo .tex completo.

    Args:
        foundation: {type, B, L, Df, FS, beta}
        strata: [{thickness, gamma, c, phi, gammaSat}]
        conditions: {hasWaterTable, waterTableDepth, hasBasement, basementDepth}
        method: 'terzaghi' | 'general' | 'rne'
        result: Resultado del cálculo
        options: {include_calculations, include_strata, include_iterations, include_charts, include_2d, include_3d}
        images: {chart_b64, view2d_b64, view3d_b64}

    Returns:
        String con el contenido .tex completo
    """
    if options is None:
        options = {}
    if images is None:
        images = {}

    include_calculations = options.get('include_calculations', True)
    include_strata = options.get('include_strata', True)
    include_iterations = options.get('include_iterations', False)
    include_charts = options.get('include_charts', False)
    include_2d = options.get('include_2d', False)
    include_3d = options.get('include_3d', False)

    f_type = foundation.get('type', 'cuadrada')
    B = foundation.get('B', 1.0)
    L = foundation.get('L', 1.0)
    Df = foundation.get('Df', 1.0)
    FS = foundation.get('FS', 3.0)
    beta = foundation.get('beta', 0)

    type_labels = {
        'cuadrada': 'Cuadrada',
        'rectangular': 'Rectangular',
        'franja': 'Franja',
        'circular': 'Circular',
    }
    method_labels = {
        'terzaghi': 'Terzaghi Clásico',
        'general': 'Ecuación General (Das/Braja)',
        'rne': 'RNE E.050',
    }

    tex = []

    # ── Preámbulo ──
    tex.append(r"""\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[spanish]{babel}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{booktabs}
\usepackage{array}
\usepackage{xcolor}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{hyperref}
\usepackage{float}

\geometry{margin=2.5cm}
\definecolor{accent}{RGB}{192,57,43}
\definecolor{darkbg}{RGB}{45,45,45}

\hypersetup{
    colorlinks=true,
    linkcolor=accent,
    urlcolor=accent,
}

% Header/Footer
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\textcolor{gray}{CimentAviones Web v1.1}}
\fancyhead[R]{\small\textcolor{gray}{Análisis Geotécnico}}
\fancyfoot[C]{\thepage}
\renewcommand{\headrulewidth}{0.4pt}

% Section styling
\titleformat{\section}{\Large\bfseries\color{accent}}{}{0em}{}[\vspace{-0.5em}\textcolor{accent}{\rule{\textwidth}{0.5pt}}]
\titleformat{\subsection}{\large\bfseries}{}{0em}{}

\begin{document}
""")

    # ── Portada ──
    tex.append(r"""
\begin{titlepage}
\centering
\vspace*{3cm}

{\Huge\bfseries\textcolor{accent}{CimentAviones Web}}\\[0.5cm]
{\Large Análisis de Capacidad Portante}\\[2cm]

{\large\textbf{Reporte de Ingeniería Geotécnica}}\\[0.5cm]
""")
    tex.append(f"{{\\large Método: {_escape_latex(method_labels.get(method, method))}}}\\\\[0.3cm]\n")
    tex.append(f"{{\\large Cimentación: {_escape_latex(type_labels.get(f_type, f_type))}}}\\\\[2cm]\n")
    tex.append(r"""
{\large\today}\\[3cm]

\vfill
{\small Generado automáticamente por CimentAviones Web v1.1}\\
{\small Motor de Análisis Geotécnico}
\end{titlepage}
""")

    # ── Índice ──
    tex.append(r"""
\tableofcontents
\newpage
""")

    # ══════════════════════════════════════
    # DATOS DE CIMENTACIÓN
    # ══════════════════════════════════════
    tex.append(r"\section{Datos de la Cimentación}" + "\n\n")
    tex.append(r"\begin{table}[H]" + "\n")
    tex.append(r"\centering" + "\n")
    tex.append(r"\begin{tabular}{l l}" + "\n")
    tex.append(r"\toprule" + "\n")
    tex.append(r"\textbf{Parámetro} & \textbf{Valor} \\" + "\n")
    tex.append(r"\midrule" + "\n")
    tex.append(f"Tipo de cimentación & {_escape_latex(type_labels.get(f_type, f_type))} \\\\\n")
    tex.append(f"Ancho $B$ & {B} m \\\\\n")
    if f_type == 'rectangular':
        tex.append(f"Longitud $L$ & {L} m \\\\\n")
    tex.append(f"Profundidad de desplante $D_f$ & {Df} m \\\\\n")
    tex.append(f"Factor de seguridad $FS$ & {FS} \\\\\n")
    tex.append(f"\u00c1ngulo de inclinaci\u00f3n $\\beta$ & {beta}$^{{\\circ}}$ \\\\\n")

    if conditions.get('hasWaterTable'):
        tex.append(f"Nivel freático $D_w$ & {conditions.get('waterTableDepth', 0)} m \\\\\n")
    else:
        tex.append("Nivel freático & No presente \\\\\n")

    if conditions.get('hasBasement'):
        tex.append(f"Profundidad de sótano $D_s$ & {conditions.get('basementDepth', 0)} m \\\\\n")

    tex.append(r"\bottomrule" + "\n")
    tex.append(r"\end{tabular}" + "\n")
    tex.append(r"\caption{Parámetros de la cimentación}" + "\n")
    tex.append(r"\end{table}" + "\n\n")

    # ══════════════════════════════════════
    # ESTRATOS
    # ══════════════════════════════════════
    if include_strata:
        tex.append(r"\section{Estratos del Suelo}" + "\n\n")
        tex.append(r"\begin{table}[H]" + "\n")
        tex.append(r"\centering" + "\n")
        tex.append(r"\begin{tabular}{c c c c c c}" + "\n")
        tex.append(r"\toprule" + "\n")
        tex.append(r"\textbf{Estrato} & \textbf{Espesor (m)} & \textbf{$\gamma$ (kN/m\textsuperscript{3})} & \textbf{$c$ (kPa)} & \textbf{$\phi$ ($^{\circ}$)} & \textbf{$\gamma_{sat}$ (kN/m\textsuperscript{3})} \\" + "\n")
        tex.append(r"\midrule" + "\n")

        for i, s in enumerate(strata):
            tex.append(f"{i+1} & {s.get('thickness', 0)} & {s.get('gamma', 0)} & {s.get('c', 0)} & {s.get('phi', 0)} & {s.get('gammaSat', 0)} \\\\\n")

        tex.append(r"\bottomrule" + "\n")
        tex.append(r"\end{tabular}" + "\n")
        tex.append(r"\caption{Propiedades geotécnicas de los estratos}" + "\n")
        tex.append(r"\end{table}" + "\n\n")

    # ══════════════════════════════════════
    # ECUACIONES Y CÁLCULOS
    # ══════════════════════════════════════
    if include_calculations and result:
        tex.append(r"\section{Desarrollo del Cálculo}" + "\n\n")

        bf = result.get('bearingFactors', {})
        sf = result.get('shapeFactors', {})
        df = result.get('depthFactors', {})
        inf = result.get('inclinationFactors', {})
        ds = result.get('designStratum', {})
        ds_idx = result.get('designStratumIndex', 0)

        tex.append(r"\subsection{Estrato de Diseño}" + "\n")
        tex.append(f"El estrato de diseño es el \\textbf{{Estrato {ds_idx + 1}}} ")
        tex.append(f"con $\\phi = {ds.get('phi', 0)}^{{\\circ}}$, $c = {ds.get('c', 0)}$ kPa, ")
        tex.append(f"$\\gamma = {ds.get('gamma', 0)}$ kN/m\\textsuperscript{{3}}.\n\n")

        soil_type = result.get('soilType', 'Fri')
        tex.append(f"Tipo de suelo: \\textbf{{{_escape_latex('Cohesivo' if soil_type == 'Coh' else 'Friccionante')}}}.\n\n")

        tex.append(r"\subsection{Factores de Capacidad Portante}" + "\n")
        tex.append(f"Para $\\phi = {ds.get('phi', 0)}^{{\\circ}}$:\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"N_c &= {bf.get('Nc', 0):.2f} \\\\\n")
        tex.append(f"N_q &= {bf.get('Nq', 0):.2f} \\\\\n")
        tex.append(f"N_\\gamma &= {bf.get('Ngamma', 0):.2f}\n")
        tex.append(r"\end{align*}" + "\n\n")

        tex.append(r"\subsection{Factores de Forma}" + "\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"s_c &= {sf.get('sc', 1):.4f} \\\\\n")
        tex.append(f"s_q &= {sf.get('sq', 1):.4f} \\\\\n")
        tex.append(f"s_\\gamma &= {sf.get('sgamma', 1):.4f}\n")
        tex.append(r"\end{align*}" + "\n\n")

        tex.append(r"\subsection{Factores de Profundidad}" + "\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"d_c &= {df.get('dc', 1):.4f} \\\\\n")
        tex.append(f"d_q &= {df.get('dq', 1):.4f} \\\\\n")
        tex.append(f"d_\\gamma &= {df.get('dgamma', 1):.4f}\n")
        tex.append(r"\end{align*}" + "\n\n")

        tex.append(r"\subsection{Factores de Inclinación}" + "\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"i_c &= {inf.get('ic', 1):.4f} \\\\\n")
        tex.append(f"i_q &= {inf.get('iq', 1):.4f} \\\\\n")
        tex.append(f"i_\\gamma &= {inf.get('igamma', 1):.4f}\n")
        tex.append(r"\end{align*}" + "\n\n")

        tex.append(r"\subsection{Ecuación de Capacidad Portante}" + "\n")
        q_val = result.get('q', 0)
        gamma_eff = result.get('gammaEffective', 0)
        F1 = result.get('F1', 0)
        F2 = result.get('F2', 0)
        F3 = result.get('F3', 0)

        tex.append(f"Sobrecarga efectiva: $q = {q_val:.2f}$ kPa\n\n")
        tex.append(f"Peso unitario efectivo: $\\gamma_{{eff}} = {gamma_eff:.2f}$ kN/m³\n\n")

        if method == 'terzaghi':
            tex.append(r"Ecuación de Terzaghi:" + "\n")
            tex.append(r"\begin{equation}" + "\n")
            tex.append(r"q_u = c \cdot N_c \cdot s_c + q \cdot N_q + \frac{1}{2} \gamma B \cdot N_\gamma \cdot s_\gamma" + "\n")
            tex.append(r"\end{equation}" + "\n\n")
        else:
            tex.append(r"Ecuación General de Capacidad Portante:" + "\n")
            tex.append(r"\begin{equation}" + "\n")
            tex.append(r"q_u = c \cdot N_c \cdot s_c \cdot d_c \cdot i_c + q \cdot N_q \cdot s_q \cdot d_q \cdot i_q + \frac{1}{2} \gamma B \cdot N_\gamma \cdot s_\gamma \cdot d_\gamma \cdot i_\gamma" + "\n")
            tex.append(r"\end{equation}" + "\n\n")

        tex.append(r"Términos individuales:" + "\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"F_1 &= {F1:.2f} \\text{{ kPa}} \\\\\n")
        tex.append(f"F_2 &= {F2:.2f} \\text{{ kPa}} \\\\\n")
        tex.append(f"F_3 &= {F3:.2f} \\text{{ kPa}}\n")
        tex.append(r"\end{align*}" + "\n\n")

    # ══════════════════════════════════════
    # RESULTADOS
    # ══════════════════════════════════════
    if result:
        tex.append(r"\section{Resultados}" + "\n\n")
        tex.append(r"\begin{table}[H]" + "\n")
        tex.append(r"\centering" + "\n")
        tex.append(r"\begin{tabular}{l r l}" + "\n")
        tex.append(r"\toprule" + "\n")
        tex.append(r"\textbf{Resultado} & \textbf{Valor} & \textbf{Unidad} \\" + "\n")
        tex.append(r"\midrule" + "\n")
        tex.append(f"Capacidad portante última $q_u$ & {result.get('qu', 0):.2f} & kPa \\\\\n")
        tex.append(f"Capacidad portante neta $q_{{neta}}$ & {result.get('qnet', 0):.2f} & kPa \\\\\n")
        tex.append(f"\\textbf{{Capacidad admisible}} $q_a$ & \\textbf{{{result.get('qa', 0):.2f}}} & \\textbf{{kPa}} \\\\\n")
        tex.append(f"Capacidad admisible neta $q_{{a,neta}}$ & {result.get('qaNet', 0):.2f} & kPa \\\\\n")
        tex.append(r"\midrule" + "\n")
        tex.append(f"\\textbf{{Carga máxima}} $Q_{{max}}$ & \\textbf{{{result.get('Qmax', 0):.2f}}} & \\textbf{{kN}} \\\\\n")
        tex.append(r"\bottomrule" + "\n")
        tex.append(r"\end{tabular}" + "\n")
        tex.append(r"\caption{Resultados del análisis de capacidad portante}" + "\n")
        tex.append(r"\end{table}" + "\n\n")

        # RNE consideration
        rne = result.get('rneConsideration')
        if rne:
            tex.append(r"\subsection{Consideración RNE E.050}" + "\n\n")
            tex.append(r"\begin{table}[H]" + "\n")
            tex.append(r"\centering" + "\n")
            tex.append(r"\begin{tabular}{l r l}" + "\n")
            tex.append(r"\toprule" + "\n")
            tex.append(r"\textbf{Parámetro RNE} & \textbf{Valor} & \textbf{Unidad} \\" + "\n")
            tex.append(r"\midrule" + "\n")
            tex.append(f"$q_u$ RNE & {rne.get('qultRNE', 0):.2f} & kPa \\\\\n")
            tex.append(f"$q_a$ RNE & {rne.get('qadmRNE', 0):.2f} & kPa \\\\\n")
            tex.append(f"$q_u$ RNE corregido & {rne.get('qultRNECorrected', 0):.2f} & kPa \\\\\n")
            tex.append(r"\bottomrule" + "\n")
            tex.append(r"\end{tabular}" + "\n")
            tex.append(r"\caption{Resultados según la Norma RNE E.050}" + "\n")
            tex.append(r"\end{table}" + "\n\n")

    # ══════════════════════════════════════
    # IMÁGENES (only if image data was provided)
    # ══════════════════════════════════════
    has_2d = include_2d and images.get('view2d_b64')
    has_3d = include_3d and images.get('view3d_b64')
    has_chart = include_charts and images.get('chart_b64')

    if has_2d:
        tex.append(r"\section{Vista 2D --- Secci\'on Transversal}" + "\n\n")
        tex.append(r"\begin{figure}[H]" + "\n")
        tex.append(r"\centering" + "\n")
        tex.append(r"\includegraphics[width=0.85\textwidth]{view2d.png}" + "\n")
        tex.append(r"\caption{Secci\'on transversal del modelo geot\'ecnico}" + "\n")
        tex.append(r"\end{figure}" + "\n\n")

    if has_3d:
        tex.append(r"\section{Vista 3D --- Modelo BIM}" + "\n\n")
        tex.append(r"\begin{figure}[H]" + "\n")
        tex.append(r"\centering" + "\n")
        tex.append(r"\includegraphics[width=0.85\textwidth]{view3d.png}" + "\n")
        tex.append(r"\caption{Modelo 3D IFC de la cimentaci\'on}" + "\n")
        tex.append(r"\end{figure}" + "\n\n")

    if has_chart:
        tex.append(r"\section{Iteraciones Param\'etricas}" + "\n\n")
        tex.append(r"\begin{figure}[H]" + "\n")
        tex.append(r"\centering" + "\n")
        tex.append(r"\includegraphics[width=0.9\textwidth]{chart.png}" + "\n")
        tex.append(r"\caption{Iteraciones param\'etricas de capacidad portante}" + "\n")
        tex.append(r"\end{figure}" + "\n\n")

    # ── Footer ──
    tex.append(r"\vfill" + "\n")
    tex.append(r"\begin{center}" + "\n")
    tex.append(r"{\small\textcolor{gray}{Generado por CimentAviones Web v1.1 — Motor de Análisis Geotécnico}}" + "\n")
    tex.append(r"\end{center}" + "\n\n")

    tex.append(r"\end{document}" + "\n")

    return ''.join(tex)


def compile_latex_to_pdf(
    tex_content: str,
    images: dict = None,
) -> bytes:
    """
    Compila un documento LaTeX a PDF.

    Args:
        tex_content: String con el contenido .tex
        images: dict con {chart_b64, view2d_b64, view3d_b64} en base64

    Returns:
        bytes del PDF compilado
    """
    if images is None:
        images = {}

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = os.path.join(tmpdir, 'report.tex')
        pdf_path = os.path.join(tmpdir, 'report.pdf')

        # Save images
        if images.get('chart_b64'):
            _save_base64_image(images['chart_b64'], os.path.join(tmpdir, 'chart.png'))
        if images.get('view2d_b64'):
            _save_base64_image(images['view2d_b64'], os.path.join(tmpdir, 'view2d.png'))
        if images.get('view3d_b64'):
            _save_base64_image(images['view3d_b64'], os.path.join(tmpdir, 'view3d.png'))

        # Write .tex file
        with open(tex_path, 'w', encoding='utf-8') as f:
            f.write(tex_content)

        # Compile with pdflatex (run twice for TOC)
        for _ in range(2):
            proc = subprocess.run(
                ['pdflatex', '-interaction=nonstopmode', '-output-directory', tmpdir, tex_path],
                capture_output=True,
                timeout=30,
            )

        if not os.path.exists(pdf_path):
            stderr = proc.stderr.decode('utf-8', errors='replace') if proc.stderr else ''
            stdout = proc.stdout.decode('utf-8', errors='replace') if proc.stdout else ''
            raise RuntimeError(f"LaTeX compilation failed:\n{stderr}\n{stdout}")

        with open(pdf_path, 'rb') as f:
            return f.read()
