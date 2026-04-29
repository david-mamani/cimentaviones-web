import { useFoundationStore } from '../../store/foundationStore';
import jsPDF from 'jspdf';

export default function PDFReport() {
  const result = useFoundationStore((s) => s.result);
  const foundation = useFoundationStore((s) => s.foundation);
  const strata = useFoundationStore((s) => s.strata);
  const conditions = useFoundationStore((s) => s.conditions);

  if (!result) return null;

  const handleExport = () => {
    const doc = new jsPDF();
    const m = 20;
    let y = m;

    const addLine = (text: string, size = 10, bold = false) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(text, m, y);
      y += size * 0.5 + 2;
    };

    const addSep = () => { y += 3; doc.setDrawColor(180); doc.line(m, y, 190, y); y += 5; };

    // Header
    doc.setFillColor(45, 45, 45);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(192, 57, 43);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CimentAviones Web', m, 18);
    doc.setTextColor(180, 180, 190);
    doc.setFontSize(10);
    doc.text('Análisis Geotécnico de Capacidad Portante', m, 26);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, m, 33);
    y = 50;
    doc.setTextColor(40, 40, 50);

    // Foundation data
    addLine('DATOS DE LA CIMENTACIÓN', 13, true);
    y += 2;
    const typeLabel: Record<string, string> = { cuadrada: 'Cuadrada', rectangular: 'Rectangular', franja: 'Franja', circular: 'Circular' };
    addLine(`Tipo: ${typeLabel[foundation.type] || foundation.type}`);
    addLine(`B = ${foundation.B} m${foundation.type === 'rectangular' ? `, L = ${foundation.L} m` : ''}`);
    addLine(`Df = ${foundation.Df} m, FS = ${foundation.FS}, β = ${foundation.beta}°`);
    addLine(`Nivel freático: ${conditions.hasWaterTable ? `Sí (Dw = ${conditions.waterTableDepth} m)` : 'No'}`);
    addLine(`Sótano: ${conditions.hasBasement ? `Sí (Ds = ${conditions.basementDepth} m)` : 'No'}`);
    addSep();

    // Strata
    addLine('ESTRATOS DEL SUELO', 13, true);
    y += 2;
    strata.forEach((s, i) => {
      addLine(`Estrato ${i + 1}: h=${s.thickness}m, γ=${s.gamma} kN/m³, c=${s.c} kPa, φ=${s.phi}°, γsat=${s.gammaSat} kN/m³`);
    });
    addSep();

    // Results
    addLine('RESULTADOS DEL ANÁLISIS', 13, true);
    y += 2;
    const ds = result.designStratum;
    const methodLabel: Record<string, string> = { terzaghi: 'Terzaghi Clásico', general: 'Ecuación General (Das)', rne: 'RNE E.050' };
    addLine(`Estrato de diseño: Estrato ${result.designStratumIndex + 1} (φ=${ds.phi}°, c=${ds.c} kPa, γ=${ds.gamma} kN/m³)`);
    addLine(`Tipo de suelo: ${result.soilType === 'Coh' ? 'Cohesivo' : 'Friccionante'}`);
    addLine(`Método: ${methodLabel[result.method]}`);
    y += 2;
    addLine(`Factores: Nc = ${result.bearingFactors.Nc.toFixed(2)}, Nq = ${result.bearingFactors.Nq.toFixed(2)}, Nγ = ${result.bearingFactors.Ngamma.toFixed(2)}`);
    addLine(`Sobrecarga efectiva q = ${result.q.toFixed(2)} kPa`);
    addLine(`γ efectivo = ${result.gammaEffective.toFixed(2)} kN/m³`);
    addLine(`Términos: F1 = ${result.F1.toFixed(2)}, F2 = ${result.F2.toFixed(2)}, F3 = ${result.F3.toFixed(2)}`);
    y += 3;
    addLine(`qu = ${result.qu.toFixed(2)} kPa`, 11, true);
    addLine(`qneta = ${result.qnet.toFixed(2)} kPa`, 11, true);
    addLine(`qa = ${result.qa.toFixed(2)} kPa (FS = ${foundation.FS})`, 11, true);
    addLine(`qa_neta = ${result.qaNet.toFixed(2)} kPa`, 11, true);
    addLine(`Q_max = ${result.Qmax.toFixed(2)} kN`, 11, true);
    addSep();

    // RNE
    if (result.rneConsideration) {
      addLine('CONSIDERACIÓN RNE', 12, true);
      y += 2;
      addLine(`qu RNE = ${result.rneConsideration.qultRNE.toFixed(2)} kPa`);
      addLine(`qa RNE = ${result.rneConsideration.qadmRNE.toFixed(2)} kPa`);
      addLine(`qu RNE corregido = ${result.rneConsideration.qultRNECorrected.toFixed(2)} kPa`);
      addSep();
    }

    // Footer
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text('CimentAviones Web v1.0 — Ingeniería Geotécnica', m, y);
    doc.text('Refs: Das (2015), Terzaghi (1943), Meyerhof (1963)', m, y + 5);

    doc.save('reporte-cimentaciones.pdf');
  };

  return (
    <button
      id="btn-export-pdf"
      onClick={handleExport}
      className="cad-btn"
      style={{ width: '100%', fontSize: 11, padding: '6px 0' }}
    >
      📄 Exportar PDF
    </button>
  );
}
