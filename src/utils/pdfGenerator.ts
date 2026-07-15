import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EventReport } from '../types';
import logoImg from '../assets/images/sgt_armas_logo_pdf.jpg';
import { formatDate } from './formatDate';

// Re-exportado para manter compatibilidade com quem ainda importa de pdfGenerator
export { formatDate };

// Helper to load logo image asynchronously for jsPDF
function loadLogoImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load logo image'));
    img.src = logoImg;
  });
}

// Carrega a foto do evento (sempre uma data URL base64, salva direto no documento
// do Firestore) e retorna tanto a data URL quanto o elemento de imagem já carregado
// (para saber a proporção). Em caso de falha, retorna o motivo do erro em vez de
// falhar silenciosamente, para que o PDF possa avisar visivelmente o usuário.
type LoadedPhoto =
  | { ok: true; dataUrl: string; img: HTMLImageElement }
  | { ok: false; error: string };

async function loadReportPhoto(report: EventReport): Promise<LoadedPhoto> {
  if (!report.fotoUrl) {
    return { ok: false, error: 'Este relatório não possui foto.' };
  }

  try {
    const dataUrl = report.fotoUrl;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao carregar a foto do relatório.'));
      el.src = dataUrl;
    });

    return { ok: true, dataUrl, img };
  } catch (err: any) {
    console.error('Não foi possível carregar a foto do relatório para o PDF:', err);
    return { ok: false, error: err?.message || 'Erro desconhecido.' };
  }
}

// Builds the PDF document for a single report WITHOUT saving/downloading it.
// Layout compacto: cabeçalho enxuto e fontes que se ajustam automaticamente
// para que o relatório sempre caiba em uma única página (o parágrafo de
// descrição reduz a fonte progressivamente conforme o tamanho do texto).
export async function buildSingleReportPDF(report: EventReport) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - (margin * 2);
  const footerReserve = 12; // espaço reservado no rodapé da página

  // Load logo image
  let logoElement: HTMLImageElement | null = null;
  try {
    logoElement = await loadLogoImage();
  } catch (err) {
    console.error('Logo image could not be loaded for PDF', err);
  }

  // Primary palette
  const primaryColor: [number, number, number] = [30, 41, 59]; // Slate 800
  const secondaryColor: [number, number, number] = [71, 85, 105]; // Slate 600
  const lightBg: [number, number, number] = [248, 250, 252]; // Slate 50
  const accentColor: [number, number, number] = [79, 70, 229]; // Indigo 600

  // 1. Header Banner — enxuto, estilo timbre profissional (uma única faixa fina)
  const headerHeight = 22;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  if (logoElement) {
    doc.addImage(logoElement, 'JPEG', pageWidth - margin - 15, 4, 15, 15);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('RELATÓRIO SGT ARMAS CMD XXIX - IMC', margin, 10);

  const genDateStr = new Date().toLocaleDateString('pt-BR');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`Sistema de Registro e Gestão de Relatórios  •  Emitido em ${genDateStr}`, margin, 16.5);

  let currentY = headerHeight + 9;

  // Número do relatório, acima do título do evento
  if (report.numeroRelatorio) {
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Relatório Nº ${report.numeroRelatorio}`, margin, currentY);
    currentY += 5.5;
  }

  // 2. Event Title Block
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);

  const eventTitleLines = doc.splitTextToSize(report.evento.toUpperCase(), contentWidth);
  doc.text(eventTitleLines, margin, currentY);
  currentY += (eventTitleLines.length * 6) + 2;

  // Decorative divider line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // 3. Metadata Grid (Key info fields)
  const metaData: any[][] = [
    [
      { content: 'Data do Evento:', styles: { fontStyle: 'bold', textColor: secondaryColor } },
      formatDate(report.data),
      { content: 'Horário:', styles: { fontStyle: 'bold', textColor: secondaryColor } },
      report.hora
    ],
    [
      { content: 'Regional:', styles: { fontStyle: 'bold', textColor: secondaryColor } },
      report.regional,
      { content: 'Responsável:', styles: { fontStyle: 'bold', textColor: secondaryColor } },
      report.responsavel
    ],
    [
      { content: 'Conferido por:', styles: { fontStyle: 'bold', textColor: secondaryColor } },
      report.conferidoPor || 'Não informado',
      { content: 'Comando:', styles: { fontStyle: 'bold', textColor: secondaryColor } },
      report.comando
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: metaData,
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 2,
      textColor: [15, 23, 42], // Slate 900
    },
    columnStyles: {
      0: { cellWidth: 37 },
      1: { cellWidth: 52 },
      2: { cellWidth: 31 },
      3: { cellWidth: 58 }
    },
    didDrawPage: (data) => {
      currentY = data.cursor ? data.cursor.y : currentY;
    }
  });

  currentY += 8;

  // Carrega a foto do evento antecipadamente (se houver), para já sabermos
  // quanto espaço ela vai ocupar no fim da página, antes de calcular a
  // fonte da descrição.
  let photoResult: LoadedPhoto | null = null;
  if (report.fotoUrl) {
    photoResult = await loadReportPhoto(report);
  }
  const photoMaxHeightMM = 70; // foto maior, para melhor visualização
  let photoBlockHeight = 0;
  let photoImgWidthMM = 0;
  let photoImgHeightMM = 0;
  if (photoResult) {
    if (photoResult.ok) {
      const maxImgWidthMM = contentWidth;
      photoImgWidthMM = maxImgWidthMM;
      photoImgHeightMM = (photoResult.img.height / photoResult.img.width) * photoImgWidthMM;
      if (photoImgHeightMM > photoMaxHeightMM) {
        photoImgHeightMM = photoMaxHeightMM;
        photoImgWidthMM = (photoResult.img.width / photoResult.img.height) * photoImgHeightMM;
      }
      photoBlockHeight = 4.5 + photoImgHeightMM + 8; // label + imagem + espaço depois
    } else {
      doc.setFontSize(8.5);
      const warningLines = doc.splitTextToSize(`⚠ Não foi possível carregar a foto: ${photoResult.error}`, contentWidth - 8);
      const warningHeight = (warningLines.length * 4.5) + 5;
      photoBlockHeight = 4.5 + warningHeight + 8;
    }
  }

  // 4. Participants Section
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PARTICIPANTES', margin, currentY);
  currentY += 3.5;

  doc.setFontSize(9);
  const participantsLines = doc.splitTextToSize(report.participantes || 'Nenhum participante informado.', contentWidth - 8);
  const participantsHeight = (participantsLines.length * 4.5) + 5;

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(241, 245, 249);
  doc.roundedRect(margin, currentY, contentWidth, participantsHeight, 1.5, 1.5, 'FD');

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.text(participantsLines, margin + 4, currentY + 5.5);

  currentY += participantsHeight + 8;

  // 5. Detailed Description Section — escolhe a maior fonte (dentre um
  // conjunto de tamanhos compactos) que faça o texto inteiro caber no
  // espaço restante da página, garantindo relatório em folha única.
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DESCRIÇÃO DETALHADA', margin, currentY);
  currentY += 5;

  const descText = report.descricao || 'Nenhuma descrição detalhada informada.';
  const remainingHeight = (pageHeight - footerReserve - margin) - currentY - photoBlockHeight;

  const fontSizeCandidates = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];
  let chosenFontSize = fontSizeCandidates[fontSizeCandidates.length - 1];
  let chosenLines: string[] = [];
  let chosenLineHeight = chosenFontSize * 0.5;

  for (const size of fontSizeCandidates) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(descText, contentWidth);
    const lineHeight = size * 0.5;
    const requiredHeight = lines.length * lineHeight;

    chosenFontSize = size;
    chosenLines = lines;
    chosenLineHeight = lineHeight;

    if (requiredHeight <= remainingHeight) {
      break; // maior fonte que ainda cabe — usa esta
    }
  }

  // Print detailed description text (no tamanho já escolhido para caber na página)
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(chosenFontSize);

  for (let i = 0; i < chosenLines.length; i++) {
    // Rede de segurança: só em casos extremos (descrição enorme mesmo na
    // fonte mínima) uma quebra de página é usada, para nunca cortar texto.
    if (currentY + chosenLineHeight > pageHeight - margin - footerReserve + 3) {
      doc.addPage();
      currentY = margin + 10;

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 15, 'F');

      if (logoElement) {
        doc.addImage(logoElement, 'JPEG', pageWidth - margin - 10, 2.5, 10, 10);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Relatório: ${report.evento.toUpperCase()}`, margin, 10);
      currentY = 25;

      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(chosenFontSize);
    }
    doc.text(chosenLines[i], margin, currentY);
    currentY += chosenLineHeight;
  }

  // 6. Foto do evento — por último, em tamanho maior para melhor visualização
  if (photoResult) {
    // Quebra de página apenas na hipótese remota de a descrição ter
    // consumido mais espaço do que o previsto e não sobrar lugar pra foto.
    if (currentY + photoBlockHeight > pageHeight - margin - footerReserve + 3) {
      doc.addPage();
      currentY = margin + 10;

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 15, 'F');
      if (logoElement) {
        doc.addImage(logoElement, 'JPEG', pageWidth - margin - 10, 2.5, 10, 10);
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Relatório: ${report.evento.toUpperCase()}`, margin, 10);
      currentY = 25;
    }

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('FOTO DO EVENTO', margin, currentY);
    currentY += 4.5;

    if (photoResult.ok) {
      const imgX = margin + (contentWidth - photoImgWidthMM) / 2;
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(imgX - 1, currentY - 1, photoImgWidthMM + 2, photoImgHeightMM + 2, 1.5, 1.5, 'S');
      doc.addImage(photoResult.dataUrl, 'JPEG', imgX, currentY, photoImgWidthMM, photoImgHeightMM);
      currentY += photoImgHeightMM + 8;
    } else {
      // A foto existe (fotoUrl preenchido) mas não pôde ser carregada.
      doc.setFontSize(8.5);
      const warningLines = doc.splitTextToSize(`⚠ Não foi possível carregar a foto: ${photoResult.error}`, contentWidth - 8);
      const warningHeight = (warningLines.length * 4.5) + 5;

      doc.setFillColor(254, 242, 242); // rose-50
      doc.setDrawColor(253, 164, 175); // rose-300
      doc.roundedRect(margin, currentY, contentWidth, warningHeight, 1.5, 1.5, 'FD');

      doc.setTextColor(190, 18, 60); // rose-700
      doc.setFont('helvetica', 'normal');
      doc.text(warningLines, margin + 4, currentY + 5.5);

      currentY += warningHeight + 8;
    }
  }

  // Footer decoration on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Gerado via Sistema de Relatórios de Eventos', margin, pageHeight - 10);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
  }

  return doc;
}

// Generate PDF for a single report AND trigger a local download.
export async function generateSingleReportPDF(report: EventReport) {
  const doc = await buildSingleReportPDF(report);
  const numeroPart = report.numeroRelatorio ? `${report.numeroRelatorio.toLowerCase().replace(/[^a-z0-9]/g, '_')}_` : '';
  const filename = `relatorio_${numeroPart}${report.evento.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${report.data}.pdf`;
  doc.save(filename);
  return doc;
}

// Builds the consolidated PDF table WITHOUT saving/downloading it.
export async function buildConsolidatedReportsPDF(reports: EventReport[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Load logo image
  let logoElement: HTMLImageElement | null = null;
  try {
    logoElement = await loadLogoImage();
  } catch (err) {
    console.error('Logo image could not be loaded for PDF', err);
  }

  const primaryColor: [number, number, number] = [30, 41, 59]; // Slate 800
  const accentColor: [number, number, number] = [79, 70, 229]; // Indigo 600

  // 1. Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Add logo to Header Banner if loaded
  if (logoElement) {
    doc.addImage(logoElement, 'JPEG', pageWidth - margin - 22, 6.5, 22, 22);
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CONSOLIDADO DE RELATÓRIOS SGT ARMAS CMD XXIX', margin, 18);

  // Details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const genDateStr = new Date().toLocaleDateString('pt-BR');
  doc.text(`Total de relatórios listados: ${reports.length}   |   Data de Emissão: ${genDateStr}`, margin, 26);

  // 2. Prepare Data Table
  const tableHeaders = [['Nº', 'Evento', 'Data / Hora', 'Regional', 'Comando', 'Responsável', 'Conferido por']];
  
  const tableBody = reports.map(report => {
    return [
      report.numeroRelatorio || '—',
      report.evento,
      `${formatDate(report.data)} às ${report.hora}`,
      report.regional,
      report.comando,
      report.responsavel,
      report.conferidoPor || 'Não informado'
    ];
  });

  // Render Table
  autoTable(doc, {
    startY: 45,
    head: tableHeaders,
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      valign: 'middle',
    },
    headStyles: {
      fillColor: accentColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold' },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { cellWidth: 38 },
      3: { cellWidth: 38 },
      4: { cellWidth: 38 },
      5: { cellWidth: 40 },
      6: { cellWidth: 40 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Slate 50
    },
    didDrawPage: (data) => {
      // Add footer to each page
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      doc.text('Relatório Sgt Armas CMD XXIX - IMC', margin, pageHeight - 10);
      doc.text(`Página ${data.pageNumber}`, pageWidth - margin - 15, pageHeight - 10);
    }
  });

  return doc;
}

// Generate the consolidated PDF table AND trigger a local download.
export async function generateConsolidatedReportsPDF(reports: EventReport[]) {
  const doc = await buildConsolidatedReportsPDF(reports);
  doc.save(`consolidado_relatorios_${new Date().toISOString().split('T')[0]}.pdf`);
  return doc;
}
