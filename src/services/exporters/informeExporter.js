import { teamDisplayName } from '../../utils/teamUtils';
import { fetchLogoAsDataUrl, formatFilename } from './exportUtils';

const COLUMNS = [
  { key: 'ranking', label: 'Ranking' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'compromiso', label: 'Compromiso' },
  { key: 'actitud', label: 'Actitud' },
  { key: 'aptitudes', label: 'Aptitudes' },
  { key: 'capAprender', label: 'Cap. Aprender' },
  { key: 'calidad', label: 'Calidad' },
  { key: 'tiro', label: 'Tiro' },
];

function asString(v) {
  return v == null ? '' : String(v);
}

export async function buildInformeData({ team, profile, rows, observaciones, temporada }) {
  const clubName = profile?.nombreClub || 'Uros de Rivas';
  const teamName = team ? teamDisplayName(team) : 'Equipo';
  const logoDataUrl = await fetchLogoAsDataUrl(profile?.logoClub);
  const title = `INFORME JUGADORES/AS ${temporada}`;
  const normalizedRows = (rows || []).map((row) => ({
    ranking: asString(row.ranking),
    nombre: asString(row.nombre),
    compromiso: asString(row.compromiso),
    actitud: asString(row.actitud),
    aptitudes: asString(row.aptitudes),
    capAprender: asString(row.capAprender),
    calidad: asString(row.calidad),
    tiro: asString(row.tiro),
  }));

  return {
    clubName,
    teamName,
    temporada,
    logoDataUrl,
    title,
    columns: COLUMNS,
    rows: normalizedRows,
    observaciones: asString(observaciones),
  };
}

export async function exportInformeToPdf(data) {
  const { default: jsPDF } = await import('jspdf');
  const autoTableMod = await import('jspdf-autotable');
  const autoTable = autoTableMod.default || autoTableMod.autoTable;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const drawHeader = () => {
    if (data.logoDataUrl) {
      try {
        doc.addImage(data.logoDataUrl, 'PNG', margin, 8, 22, 22);
      } catch {
        // ignore image errors silently
      }
    }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(data.title, pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`Equipo - ${data.teamName}`, pageWidth / 2, 22, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Temporada ${data.temporada}`, pageWidth - margin, 12, { align: 'right' });
    doc.setTextColor(0);
  };

  drawHeader();

  autoTable(doc, {
    startY: 34,
    margin: { left: margin, right: margin },
    head: [data.columns.map((c) => c.label)],
    body: data.rows.map((r) => data.columns.map((c) => r[c.key])),
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 32, fontStyle: 'bold' },
    },
    didDrawPage: () => {
      drawHeader();
    },
  });

  if (data.observaciones && data.observaciones.trim()) {
    const finalY = doc.lastAutoTable.finalY || 34;
    const startY = finalY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones –', margin, startY);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.observaciones, pageWidth - margin * 2);
    doc.text(lines, margin, startY + 6);
  }

  doc.save(formatFilename('informe', data.teamName, data.temporada, 'pdf'));
}
