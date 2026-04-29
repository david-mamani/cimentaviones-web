"""
Motor de generacion de reportes LaTeX.

Genera archivos .tex completos con:
  - Portada profesional
  - Indice automatico
  - Datos de cimentacion en tablas
  - Estratos del suelo en tabla
  - Ecuaciones de calculo con formato LaTeX real
  - Graficos de iteraciones (imagen)
  - Vistas 2D/3D (imagenes)
  - Resultados y consideracion RNE
  - Todo en espanol

Dependencia: texlive en el contenedor Docker para compilar a PDF.
IMPORTANTE: Solo se usa ASCII puro en el contenido .tex generado,
con comandos LaTeX para acentos (\\' para tildes, \\~ para ene).
"""

import base64
import math
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


def _safe_float(value, default=0.0) -> float:
    """Safely convert a value to float, handling NaN/Inf/None."""
    if value is None:
        return default
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default


def _fmt(value, decimals=2) -> str:
    """Format a number safely for LaTeX."""
    return f"{_safe_float(value):.{decimals}f}"


def _save_base64_image(b64_data: str, filepath: str):
    """Decodifica una imagen base64 y la guarda como archivo."""
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
    Solo usa caracteres ASCII puros con comandos LaTeX para acentos.
    """
    if options is None:
        options = {}
    if images is None:
        images = {}

    include_calculations = options.get('include_calculations', True)
    include_strata = options.get('include_strata', True)
    include_charts = options.get('include_charts', False)
    include_2d = options.get('include_2d', False)
    include_3d = options.get('include_3d', False)

    f_type = foundation.get('type', 'cuadrada')
    B = _safe_float(foundation.get('B', 1.0))
    L = _safe_float(foundation.get('L', 1.0))
    Df = _safe_float(foundation.get('Df', 1.0))
    FS = _safe_float(foundation.get('FS', 3.0))
    beta = _safe_float(foundation.get('beta', 0))

    # All labels use LaTeX accent commands (ASCII only)
    type_labels = {
        'cuadrada': 'Cuadrada',
        'rectangular': 'Rectangular',
        'franja': 'Franja',
        'circular': 'Circular',
    }
    method_labels = {
        'terzaghi': r"Terzaghi Cl\'asico",
        'general': r"Ecuaci\'on General (Das/Braja)",
        'rne': 'RNE E.050',
    }

    tex = []

    # ── Preambulo ──
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
\fancyhead[R]{\small\textcolor{gray}{An\'alisis Geot\'ecnico}}
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
{\Large An\'alisis de Capacidad Portante}\\[2cm]

{\large\textbf{Reporte de Ingenier\'ia Geot\'ecnica}}\\[0.5cm]
""")
    tex.append(f"{{\\large M\\'etodo: {method_labels.get(method, method)}}}\\\\[0.3cm]\n")
    tex.append(f"{{\\large Cimentaci\\'on: {type_labels.get(f_type, f_type)}}}\\\\[2cm]\n")
    tex.append(r"""
{\large\today}\\[3cm]

\vfill
{\small Generado autom\'aticamente por CimentAviones Web v1.1}\\
{\small Motor de An\'alisis Geot\'ecnico}
\end{titlepage}
""")

    # ── Indice ──
    tex.append(r"""
\tableofcontents
\newpage
""")

    # ══════════════════════════════════════
    # DATOS DE CIMENTACION
    # ══════════════════════════════════════
    tex.append(r"\section{Datos de la Cimentaci\'on}" + "\n\n")
    tex.append(r"\begin{table}[H]" + "\n")
    tex.append(r"\centering" + "\n")
    tex.append(r"\begin{tabular}{l l}" + "\n")
    tex.append(r"\toprule" + "\n")
    tex.append(r"\textbf{Par\'ametro} & \textbf{Valor} \\" + "\n")
    tex.append(r"\midrule" + "\n")
    tex.append(f"Tipo de cimentaci\\'on & {type_labels.get(f_type, f_type)} \\\\\n")
    tex.append(f"Ancho $B$ & {_fmt(B)} m \\\\\n")
    if f_type == 'rectangular':
        tex.append(f"Longitud $L$ & {_fmt(L)} m \\\\\n")
    tex.append(f"Profundidad de desplante $D_f$ & {_fmt(Df)} m \\\\\n")
    tex.append(f"Factor de seguridad $FS$ & {_fmt(FS)} \\\\\n")
    tex.append(f"\\'{{A}}ngulo de inclinaci\\'on $\\beta$ & {_fmt(beta)}$^{{\\circ}}$ \\\\\n")

    if conditions.get('hasWaterTable'):
        tex.append(f"Nivel fre\\'atico $D_w$ & {_fmt(conditions.get('waterTableDepth', 0))} m \\\\\n")
    else:
        tex.append("Nivel fre\\'atico & No presente \\\\\n")

    if conditions.get('hasBasement'):
        tex.append(f"Profundidad de s\\'otano $D_s$ & {_fmt(conditions.get('basementDepth', 0))} m \\\\\n")

    tex.append(r"\bottomrule" + "\n")
    tex.append(r"\end{tabular}" + "\n")
    tex.append(r"\caption{Par\'ametros de la cimentaci\'on}" + "\n")
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
            tex.append(f"{i+1} & {_fmt(s.get('thickness', 0))} & {_fmt(s.get('gamma', 0))} & {_fmt(s.get('c', 0))} & {_fmt(s.get('phi', 0))} & {_fmt(s.get('gammaSat', 0))} \\\\\n")

        tex.append(r"\bottomrule" + "\n")
        tex.append(r"\end{tabular}" + "\n")
        tex.append(r"\caption{Propiedades geot\'ecnicas de los estratos}" + "\n")
        tex.append(r"\end{table}" + "\n\n")

    # ══════════════════════════════════════
    # ECUACIONES Y CALCULOS
    # ══════════════════════════════════════
    if include_calculations and result:
        tex.append(r"\section{Desarrollo del C\'alculo}" + "\n\n")

        bf = result.get('bearingFactors', {})
        sf = result.get('shapeFactors', {})
        df = result.get('depthFactors', {})
        inf = result.get('inclinationFactors', {})
        ds = result.get('designStratum', {})
        ds_idx = result.get('designStratumIndex', 0)

        tex.append(r"\subsection{Estrato de Dise\~no}" + "\n")
        tex.append(f"El estrato de dise\\~no es el \\textbf{{Estrato {ds_idx + 1}}} ")
        tex.append(f"con $\\phi = {_fmt(ds.get('phi', 0))}^{{\\circ}}$, $c = {_fmt(ds.get('c', 0))}$ kPa, ")
        tex.append(f"$\\gamma = {_fmt(ds.get('gamma', 0))}$ kN/m\\textsuperscript{{3}}.\n\n")

        soil_type = result.get('soilType', 'Fri')
        tex.append(f"Tipo de suelo: \\textbf{{{_escape_latex('Cohesivo' if soil_type == 'Coh' else 'Friccionante')}}}.\n\n")

        tex.append(r"\subsection{Factores de Capacidad Portante}" + "\n")
        tex.append(f"Para $\\phi = {_fmt(ds.get('phi', 0))}^{{\\circ}}$:\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"N_c &= {_fmt(bf.get('Nc', 0))} \\\\\n")
        tex.append(f"N_q &= {_fmt(bf.get('Nq', 0))} \\\\\n")
        tex.append(f"N_\\gamma &= {_fmt(bf.get('Ngamma', 0))}\n")
        tex.append(r"\end{align*}" + "\n\n")

        tex.append(r"\subsection{Factores de Forma}" + "\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"s_c &= {_fmt(sf.get('sc', 1), 4)} \\\\\n")
        tex.append(f"s_q &= {_fmt(sf.get('sq', 1), 4)} \\\\\n")
        tex.append(f"s_\\gamma &= {_fmt(sf.get('sgamma', 1), 4)}\n")
        tex.append(r"\end{align*}" + "\n\n")

        tex.append(r"\subsection{Factores de Profundidad}" + "\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"d_c &= {_fmt(df.get('dc', 1), 4)} \\\\\n")
        tex.append(f"d_q &= {_fmt(df.get('dq', 1), 4)} \\\\\n")
        tex.append(f"d_\\gamma &= {_fmt(df.get('dgamma', 1), 4)}\n")
        tex.append(r"\end{align*}" + "\n\n")

        tex.append(r"\subsection{Factores de Inclinaci\'on}" + "\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"i_c &= {_fmt(inf.get('ic', 1), 4)} \\\\\n")
        tex.append(f"i_q &= {_fmt(inf.get('iq', 1), 4)} \\\\\n")
        tex.append(f"i_\\gamma &= {_fmt(inf.get('igamma', 1), 4)}\n")
        tex.append(r"\end{align*}" + "\n\n")

        tex.append(r"\subsection{Ecuaci\'on de Capacidad Portante}" + "\n")
        q_val = _safe_float(result.get('q', 0))
        gamma_eff = _safe_float(result.get('gammaEffective', 0))
        F1 = _safe_float(result.get('F1', 0))
        F2 = _safe_float(result.get('F2', 0))
        F3 = _safe_float(result.get('F3', 0))

        tex.append(f"Sobrecarga efectiva: $q = {_fmt(q_val)}$ kPa\n\n")
        tex.append(f"Peso unitario efectivo: $\\gamma_{{eff}} = {_fmt(gamma_eff)}$ kN/m\\textsuperscript{{3}}\n\n")

        if method == 'terzaghi':
            tex.append(r"Ecuaci\'on de Terzaghi:" + "\n")
            tex.append(r"\begin{equation}" + "\n")
            tex.append(r"q_u = c \cdot N_c \cdot s_c + q \cdot N_q + \frac{1}{2} \gamma B \cdot N_\gamma \cdot s_\gamma" + "\n")
            tex.append(r"\end{equation}" + "\n\n")
        else:
            tex.append(r"Ecuaci\'on General de Capacidad Portante:" + "\n")
            tex.append(r"\begin{equation}" + "\n")
            tex.append(r"q_u = c \cdot N_c \cdot s_c \cdot d_c \cdot i_c + q \cdot N_q \cdot s_q \cdot d_q \cdot i_q + \frac{1}{2} \gamma B \cdot N_\gamma \cdot s_\gamma \cdot d_\gamma \cdot i_\gamma" + "\n")
            tex.append(r"\end{equation}" + "\n\n")

        tex.append(r"T\'erminos individuales:" + "\n")
        tex.append(r"\begin{align*}" + "\n")
        tex.append(f"F_1 &= {_fmt(F1)} \\text{{ kPa}} \\\\\n")
        tex.append(f"F_2 &= {_fmt(F2)} \\text{{ kPa}} \\\\\n")
        tex.append(f"F_3 &= {_fmt(F3)} \\text{{ kPa}}\n")
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
        tex.append(f"Capacidad portante \'ultima $q_u$ & {_fmt(result.get('qu', 0))} & kPa \\\\\n")
        tex.append(f"Capacidad portante neta $q_{{neta}}$ & {_fmt(result.get('qnet', 0))} & kPa \\\\\n")
        tex.append(f"\\textbf{{Capacidad admisible}} $q_a$ & \\textbf{{{_fmt(result.get('qa', 0))}}} & \\textbf{{kPa}} \\\\\n")
        tex.append(f"Capacidad admisible neta $q_{{a,neta}}$ & {_fmt(result.get('qaNet', 0))} & kPa \\\\\n")
        tex.append(r"\midrule" + "\n")
        tex.append(f"\\textbf{{Carga m\\'axima}} $Q_{{max}}$ & \\textbf{{{_fmt(result.get('Qmax', 0))}}} & \\textbf{{kN}} \\\\\n")
        tex.append(r"\bottomrule" + "\n")
        tex.append(r"\end{tabular}" + "\n")
        tex.append(r"\caption{Resultados del an\'alisis de capacidad portante}" + "\n")
        tex.append(r"\end{table}" + "\n\n")

        # RNE consideration
        rne = result.get('rneConsideration')
        if rne:
            tex.append(r"\subsection{Consideraci\'on RNE E.050}" + "\n\n")
            tex.append(r"\begin{table}[H]" + "\n")
            tex.append(r"\centering" + "\n")
            tex.append(r"\begin{tabular}{l r l}" + "\n")
            tex.append(r"\toprule" + "\n")
            tex.append(r"\textbf{Par\'ametro RNE} & \textbf{Valor} & \textbf{Unidad} \\" + "\n")
            tex.append(r"\midrule" + "\n")
            tex.append(f"$q_u$ RNE & {_fmt(rne.get('qultRNE', 0))} & kPa \\\\\n")
            tex.append(f"$q_a$ RNE & {_fmt(rne.get('qadmRNE', 0))} & kPa \\\\\n")
            tex.append(f"$q_u$ RNE corregido & {_fmt(rne.get('qultRNECorrected', 0))} & kPa \\\\\n")
            tex.append(r"\bottomrule" + "\n")
            tex.append(r"\end{tabular}" + "\n")
            tex.append(r"\caption{Resultados seg\'un la Norma RNE E.050}" + "\n")
            tex.append(r"\end{table}" + "\n\n")

    # ══════════════════════════════════════
    # IMAGENES (only if image data was provided)
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
    tex.append(r"{\small\textcolor{gray}{Generado por CimentAviones Web v1.1 --- Motor de An\'alisis Geot\'ecnico}}" + "\n")
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

        # Write .tex file (pure ASCII content, no encoding issues)
        with open(tex_path, 'w', encoding='ascii') as f:
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
