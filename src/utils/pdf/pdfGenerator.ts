// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import { WorkOrder, Machine } from '../../../types';
import { useMasterStore } from '../../stores/useMasterStore';
import { useUserStore } from '../../stores/useUserStore';

// Opcional: Logo de la empresa en base64 para reemplazar el texto "RAVICARIBE INC."
const COMPANY_LOGO_BASE64 = ''; 

// Resolver nombres completos desde el store de usuarios
const getUserFullName = (userId?: string) => {
  if (!userId) return '-';
  try {
    const users = useUserStore.getState().users || [];
    const u = users.find((x: any) => x.id === userId);
    return u ? u.full_name : userId;
  } catch (e) {
    return userId;
  }
};

export const generateRMant02PDF = (order: WorkOrder, machine?: Machine, logoUrl?: string) => {
  // Configuración del PDF en tamaño Carta (Letter) - 215.9 x 279.4 mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.width; // 215.9 mm
  const pageHeight = doc.internal.pageSize.height; // 279.4 mm
  const margin = 12;
  const usableWidth = pageWidth - 2 * margin; // 191.9 mm

  // Paleta de colores Premium (Coincide con R-MANT-05)
  const primaryColor = [10, 80, 45]; // Verde Esmeralda Corporativo
  const secondaryColor = [80, 95, 80]; // Verde Grisáceo
  const borderCol = [200, 210, 200]; // Borde suave
  const textDark = [30, 30, 30]; // Texto principal
  const textMuted = [100, 110, 100]; // Etiquetas

  // Intentamos obtener el logo de plantSettings si no viene como parámetro
  let activeLogo = logoUrl || COMPANY_LOGO_BASE64;
  if (!activeLogo) {
    try {
      const storeSettings = useMasterStore.getState().plantSettings;
      if (storeSettings && storeSettings.logoUrl) {
        activeLogo = storeSettings.logoUrl;
      }
    } catch (e) {
      console.warn("No se pudo obtener el logo del store", e);
    }
  }

  // --- FUNCIÓN HELPER PARA DIBUJAR CAMPOS ---
  const drawField = (label: string, value: string, x: number, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(value || '-', x, y + 4.5);
  };

  // --- FUNCIÓN HELPER PARA LOS ENCABEZADOS DE SECCIÓN ---
  const drawSectionHeader = (title: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(title.toUpperCase(), margin, y + 4);
  };

  // --- FUNCIÓN HELPER PARA DIBUJAR CABECERA DE PÁGINA RECURRENTE ---
  const drawContinuationHeader = (pageNumber: number) => {
    if (pageNumber > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(10);
      doc.text("R-MANT-02 | REGISTRO DE TRABAJOS Y CIERRE PREVENTIVO", margin, 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(`ORDEN: ${order.displayId || order.id.substring(0, 8)}`, pageWidth - margin, 15, { align: 'right' });
      
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, 18, pageWidth - margin, 18);
    }
  };

  // ==========================================
  // PÁGINA 1: CABECERA ISO E INFORMACIÓN GENERAL
  // ==========================================

  // --- BLOQUE 1: ENCABEZADO OFICIAL (ISO) ---
  doc.setLineWidth(0.35);
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, margin, usableWidth, 24);

  // Separadores verticales de cabecera
  const col1W = 46;
  const col3W = 44;
  const col2W = usableWidth - col1W - col3W; // 101.9 mm

  doc.line(margin + col1W, margin, margin + col1W, margin + 24);
  doc.line(margin + col1W + col2W, margin, margin + col1W + col2W, margin + 24);

  // Logo / Nombre Empresa (Columna Izquierda)
  if (activeLogo) {
    try {
      const imgProps = doc.getImageProperties(activeLogo);
      const logoW = 38;
      const logoH = (imgProps.height * logoW) / imgProps.width;
      const logoY = margin + (24 - logoH) / 2;
      doc.addImage(activeLogo, 'PNG', margin + 4, logoY, logoW, logoH);
    } catch (e) {
      console.warn("Error agregando logo de empresa", e);
      // Fallback
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(13);
      doc.text("COREFLOW INC.", margin + 4, margin + 12);
      doc.setFontSize(6);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text("SOLUCIONES INDUSTRIALES", margin + 4, margin + 17);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(13);
    doc.text("COREFLOW INC.", margin + 4, margin + 12);
    doc.setFontSize(6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("SOLUCIONES INDUSTRIALES", margin + 4, margin + 17);
  }

  // Título Central
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text("SOLICITUD Y REGISTRO DE TRABAJOS", margin + col1W + (col2W / 2), margin + 8, { align: 'center' });
  doc.text("DE MANTENIMIENTO PREVENTIVO", margin + col1W + (col2W / 2), margin + 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`EQUIPO: ${machine?.name?.toUpperCase() || 'NO ESPECIFICADO'} (${machine?.alias || '-'})`, margin + col1W + (col2W / 2), margin + 18, { align: 'center' });
  doc.text(`SUCURSAL: ${machine?.branch?.toUpperCase() || '-'}`, margin + col1W + (col2W / 2), margin + 22, { align: 'center' });

  // Nomenclatura Derecha (R-MANT-02)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(15);
  doc.text("R-MANT-02", margin + col1W + col2W + (col3W / 2), margin + 11, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(order.displayId || order.id.substring(0, 8), margin + col1W + col2W + (col3W / 2), margin + 18, { align: 'center' });

  // --- BLOQUE 2: SECCIÓN 1 - INFORMACIÓN GENERAL (y = 44) ---
  drawSectionHeader("1. Solicitud de Mantenimiento", 44);

  // Tarjeta de información general (w=191.9, h=56)
  doc.setLineWidth(0.15);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(margin, 51, usableWidth, 56, 2, 2, 'FD');

  const xCol1 = margin + 5;
  const xCol2 = margin + 67;
  const xCol3 = margin + 129;

  // Fila 1 (Y = 57)
  drawField("Número de Orden", order.displayId || order.id, xCol1, 57);
  let typeLabel: string = order.maintenanceType || order.type || 'Preventive';
  if (typeLabel === 'Preventive' || typeLabel === 'PREVENTIVE') typeLabel = 'Preventivo';
  if (typeLabel === 'Programmed' || typeLabel === 'PROGRAMMED') typeLabel = 'Programado';
  if (typeLabel === 'Other' || typeLabel === 'OTHER') typeLabel = 'Otro';
  drawField("Tipo de Mantenimiento", typeLabel, xCol2, 57);
  const startDateStr = order.startDate ? new Date(order.startDate).toLocaleDateString('es-ES') : '-';
  drawField("Fecha de Inicio", startDateStr, xCol3, 57);

  // Fila 2 (Y = 69)
  drawField("Máquina / Equipo", `${machine?.name || '-'} (${machine?.alias || '-'})`, xCol1, 69);
  drawField("Marca / Modelo", `${machine?.brand || '-'} / ${machine?.model || '-'}`, xCol2, 69);
  drawField("Placa / Matrícula", machine?.plate || '-', xCol3, 69);

  // Fila 3 (Y = 81)
  drawField("Ubicación / Área", machine?.zone || '-', xCol1, 81);
  drawField("Programa / Intervalo", order.interval || '-', xCol2, 81);
  drawField("Horas de Trabajo Máquina", (order.machineWorkHours || 0).toLocaleString('en-US'), xCol3, 81);

  // Fila 4 (Y = 93)
  drawField("Horas Próximo Mantenimiento", (order.nextMaintenanceHours || 0).toLocaleString('en-US'), xCol1, 93);
  const executorName = order.assignedMechanic ? getUserFullName(order.assignedMechanic) : (order.executors?.[0]?.name || getUserFullName(order.assignedTo) || '-');
  drawField("Ejecutante (Técnico)", executorName, xCol2, 93);
  drawField("Supervisor de Cierre", getUserFullName(order.supervisor), xCol3, 93);

  // --- BLOQUE 3: SECCIÓN 2 - CONTROL DE TIEMPOS (y = 114) ---
  drawSectionHeader("2. Control de Tiempos e Intervención", 114);

  // Tarjeta (w=191.9, h=20)
  doc.setLineWidth(0.15);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(margin, 121, usableWidth, 20, 2, 2, 'FD');

  // Hora de Inicio y Hora Fin
  drawField("Hora Inicio", order.startTime || '--:--', xCol1, 127);
  drawField("Hora Fin", order.endTime || '--:--', xCol2, 127);

  // Cálculo de Duración
  let durationStr = '0h 0m';
  if (order.startTime && order.endTime) {
    try {
      const start = new Date(`1970-01-01T${order.startTime}:00`);
      const end = new Date(`1970-01-01T${order.endTime}:00`);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        const totalMins = Math.floor(diffMs / 60000);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        durationStr = `${hrs}h ${mins}m`;
      }
    } catch (e) {
      console.warn("Error calculando duración", e);
    }
  }
  drawField("Tiempo Empleado (Duración)", durationStr, xCol3, 127);

  // --- BLOQUE 4: SECCIÓN 3 - TAREAS DE MANTENIMIENTO ACUMULADAS (y = 148) ---
  let currentY = 148;

  const tasks = order.tasks || [];
  if (tasks.length > 0) {
    drawSectionHeader("3. Tareas de Mantenimiento Acumuladas", currentY);
    currentY += 8;

    // Obtener los orígenes de intervalo únicos (ej. "180 HORAS")
    const uniqueOrigins = Array.from(new Set(tasks.map((t: any) => t.intervalOrigin || 'Tareas Generales')));

    uniqueOrigins.forEach((origin) => {
      const originTasks = tasks.filter((t: any) => (t.intervalOrigin || 'Tareas Generales') === origin);

      // Si nos quedamos sin espacio vertical en la página, añadimos una página antes de la siguiente tabla
      if (currentY > pageHeight - 50) {
        doc.addPage();
        currentY = 25;
        drawContinuationHeader(doc.getNumberOfPages());
      }

      // Dibujar subcabecera del Intervalo de Origen
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(origin.toUpperCase(), margin, currentY);
      doc.line(margin, currentY + 1.5, pageWidth - margin, currentY + 1.5);
      currentY += 4.5;

      // Transformar datos de las tareas para esta tabla
      // Helper local de rowspan para el grupo
      const getLocalRowSpan = (taskIdx: number) => {
        const currentGroup = originTasks[taskIdx].group;
        if (taskIdx > 0 && originTasks[taskIdx - 1].group === currentGroup) {
          return 0;
        }
        let count = 1;
        for (let i = taskIdx + 1; i < originTasks.length; i++) {
          if (originTasks[i].group === currentGroup) {
            count++;
          } else {
            break;
          }
        }
        return count;
      };

      const tableRows: any[] = [];
      originTasks.forEach((t: any, idx: number) => {
        const rowSpanCount = getLocalRowSpan(idx);
        
        const groupCell = rowSpanCount > 0 
          ? { content: t.group || '', rowSpan: rowSpanCount, styles: { halign: 'center' as const, valign: 'middle' as const, fontStyle: 'bold' as const, fillColor: [252, 253, 252] } }
          : null;

        const row = [
          t.sequence || (idx + 1),
          // Si rowspanCount es 0, no incluimos la celda de grupo (jspdf-autotable la omitirá)
          // Si es mayor que 0, incluimos el objeto con el rowspan
          ...(rowSpanCount > 0 ? [groupCell] : []),
          t.component || '',
          t.activity || '',
          t.referenceCode || '',
          t.lubricantType || '',
          t.lubricantName || '',
          t.lubricantCode || '',
          t.lubricantQuantity || '',
          t.estimatedTime || 0,
          t.checks?.disassemble ? 'X' : '',
          t.checks?.clean ? 'X' : '',
          t.checks?.inspect ? 'X' : '',
          t.checks?.lubricate ? 'X' : '',
          t.checks?.replace ? 'X' : '',
          t.checks?.mount ? 'X' : '',
          t.checks?.adjust ? 'X' : '',
          t.checks?.refill ? 'X' : ''
        ];

        tableRows.push(row);
      });

      // Headers exactos de la creación
      const tableHeaders = [
        [
          { content: 'Nº', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
          { content: 'Grupo', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
          { content: 'Punto de intervención', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
          { content: 'Tipo de intervención', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
          { content: 'Ref. de interv.\nCat. Mtto', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
          { content: 'Materiales / Repuestos', colSpan: 4, styles: { halign: 'center' as const, fillColor: [80, 95, 80] as [number, number, number] } },
          { content: 'Tiem.\nEstim\nmin', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
          { content: 'D', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const, fillColor: [44, 62, 80] as [number, number, number] } },
          { content: 'L', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const, fillColor: [44, 62, 80] as [number, number, number] } },
          { content: 'C', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const, fillColor: [44, 62, 80] as [number, number, number] } },
          { content: 'Lu', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const, fillColor: [44, 62, 80] as [number, number, number] } },
          { content: 'Ca', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const, fillColor: [44, 62, 80] as [number, number, number] } },
          { content: 'M', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const, fillColor: [44, 62, 80] as [number, number, number] } },
          { content: 'A-C', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const, fillColor: [44, 62, 80] as [number, number, number] } },
          { content: 'Ll', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const, fillColor: [44, 62, 80] as [number, number, number] } }
        ],
        [
          { content: 'Tipo Lub.', styles: { halign: 'center' as const } },
          { content: 'Nombre', styles: { halign: 'center' as const } },
          { content: 'Código', styles: { halign: 'center' as const } },
          { content: 'Cant.', styles: { halign: 'center' as const } }
        ]
      ];

      // Sumar tiempo estimado
      const totalEstTime = originTasks.reduce((sum: number, t: any) => sum + (t.estimatedTime || 0), 0);

      autoTable(doc, {
        startY: currentY,
        head: tableHeaders,
        body: tableRows,
        theme: 'grid',
        styles: {
          fontSize: 6,
          cellPadding: 1.5,
          lineColor: [180, 190, 180],
          lineWidth: 0.15,
          textColor: [30, 30, 30]
        },
        headStyles: {
          fillColor: [10, 80, 45],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 7, halign: 'center' }, // Nº
          1: { cellWidth: 15 }, // Grupo
          2: { cellWidth: 26 }, // Punto de intervencion
          3: { cellWidth: 26 }, // Tipo de intervencion
          4: { cellWidth: 11, halign: 'center' }, // Ref
          5: { cellWidth: 10, halign: 'center' }, // Tipo Lub
          6: { cellWidth: 15 }, // Nombre
          7: { cellWidth: 11, halign: 'center' }, // Codigo
          8: { cellWidth: 7, halign: 'center' }, // Cant
          9: { cellWidth: 8, halign: 'center', fontStyle: 'bold' }, // Tiem. Estim min
          10: { cellWidth: 6, halign: 'center', fontStyle: 'bold', textColor: [10, 80, 45] }, // D
          11: { cellWidth: 6, halign: 'center', fontStyle: 'bold', textColor: [10, 80, 45] }, // L
          12: { cellWidth: 6, halign: 'center', fontStyle: 'bold', textColor: [10, 80, 45] }, // C
          13: { cellWidth: 6, halign: 'center', fontStyle: 'bold', textColor: [10, 80, 45] }, // Lu
          14: { cellWidth: 6, halign: 'center', fontStyle: 'bold', textColor: [10, 80, 45] }, // Ca
          15: { cellWidth: 6, halign: 'center', fontStyle: 'bold', textColor: [10, 80, 45] }, // M
          16: { cellWidth: 6, halign: 'center', fontStyle: 'bold', textColor: [10, 80, 45] }, // A-C
          17: { cellWidth: 6, halign: 'center', fontStyle: 'bold', textColor: [10, 80, 45] }  // Ll
        },
        foot: [[
          { content: 'Total Tiempo Estimado:', colSpan: 9, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [245, 248, 245] as [number, number, number] } },
          { content: `${totalEstTime} min`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: [255, 255, 255] as [number, number, number] } },
          { content: '', colSpan: 8, styles: { fillColor: [240, 240, 240] as [number, number, number] } }
        ]],
        margin: { left: margin, right: margin }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    });
  } else {
    // Si no hay tareas registradas
    drawSectionHeader("3. Tareas de Mantenimiento Acumuladas", currentY);
    currentY += 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("No se registraron tareas preventivas en esta orden de trabajo.", margin, currentY);
    currentY += 10;
  }

  // --- BLOQUE 5: SECCIÓN 4 - REPUESTOS UTILIZADOS ---
  // Si nos queda muy poco espacio en la página, añadimos una página antes de los repuestos
  if (currentY > pageHeight - 65) {
    doc.addPage();
    currentY = 25;
    drawContinuationHeader(doc.getNumberOfPages());
  }

  drawSectionHeader("4. Repuestos y Materiales Utilizados", currentY);
  currentY += 7;

  const partsData = (order.consumedParts || []).map(p => [
    p.partName ? `${p.partName} (${p.sku || '-'})` : (p.sku || '-'),
    p.unit || 'Pieza',
    p.quantity || 0,
    `RD$ ${(p.unitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `RD$ ${(p.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ]);

  if (partsData.length === 0) {
    partsData.push(['No se consumieron repuestos o insumos de inventario en esta intervención.', '-', '-', '-', '-']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Insumo / Repuesto Consumido', 'Unidad', 'Cant.', 'Costo Unit.', 'Importe']],
    body: partsData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [220, 225, 220],
      lineWidth: 0.15,
      textColor: [30, 30, 30]
    },
    headStyles: {
      fillColor: [10, 80, 45],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: usableWidth - 90 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 27, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Badge de Costo Total a la derecha
  const totalCost = order.totalMaintenanceCost || (order.consumedParts || []).reduce((acc, p) => acc + (p.totalCost || 0), 0) || 0;
  const formattedTotal = `RD$ ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  doc.setFillColor(245, 248, 245);
  doc.setDrawColor(10, 80, 45);
  doc.setLineWidth(0.25);
  doc.roundedRect(pageWidth - margin - 75, currentY, 75, 8, 1, 1, 'FD');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(10, 80, 45);
  doc.text("COSTO TOTAL REPUESTOS:", pageWidth - margin - 71, currentY + 5.2);
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(formattedTotal, pageWidth - margin - 4, currentY + 5.2, { align: 'right' });

  currentY += 13;

  // --- BLOQUE 6: SECCIÓN 5 - CHECKLIST DE ENTREGA DE ÁREA/EQUIPO ---
  if (currentY > pageHeight - 75) {
    doc.addPage();
    currentY = 25;
    drawContinuationHeader(doc.getNumberOfPages());
  }

  drawSectionHeader("5. Entrega del Área o Equipo Donde se Realizó el Trabajo Preventivo", currentY);
  currentY += 7;

  const cardY = currentY;
  const cardHeight = 49;
  doc.setLineWidth(0.15);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(margin, cardY, usableWidth, cardHeight, 2, 2, 'FD');

  const cl = order.checklist || {};
  const checklistItems = [
    { text: "Punto específico de intervención limpio libre de contaminantes (grasas u otros químicos)", val: cl.pointClean },
    { text: "Área o punto de intervención limpio", val: cl.areaClean },
    { text: "Protecciones y guardas de máquinas completas", val: cl.guardsComplete },
    { text: "Se retiró del área todas las herramientas y accesorios que se utilizó en la intervención del equipo.", val: cl.toolsRemoved },
    { text: "En caso de haber utilizado grasas o aceites dejar en lugar asignado.", val: cl.greaseCleaned },
    { text: "Protecciones de seguridad activadas", val: cl.safetyActivated }
  ];

  checklistItems.forEach((item, idx) => {
    const itemY = cardY + 6 + idx * 7.2;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(item.text, margin + 4, itemY);

    const checkX = margin + usableWidth - 26;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("SÍ", checkX, itemY);
    doc.text("NO", checkX + 14, itemY);

    doc.setLineWidth(0.2);
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(checkX - 5, itemY - 2.5, 3, 3); // Casilla SÍ
    doc.rect(checkX + 9, itemY - 2.5, 3, 3); // Casilla NO

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    if (item.val === true) {
      doc.text("X", checkX - 4.2, itemY - 0.2);
    } else if (item.val === false) {
      doc.setTextColor(180, 50, 50); // Rojo si es NO
      doc.text("X", checkX + 9.8, itemY - 0.2);
    }
  });

  currentY = cardY + cardHeight + 5;

  // --- BLOQUE 7: SECCIÓN 6 - ACEPTACIÓN, OBSERVACIONES Y FIRMAS ---
  if (currentY > pageHeight - 75) {
    doc.addPage();
    currentY = 25;
    drawContinuationHeader(doc.getNumberOfPages());
  }

  drawSectionHeader("6. Conformidad y Cierre de Orden", currentY);
  currentY += 7;

  // Cuadro de Observaciones (enmarcado)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("OBSERVACIONES / DIAGNÓSTICO FINAL DE MANTENIMIENTO", margin + 2, currentY);
  currentY += 3;

  doc.setLineWidth(0.15);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(margin, currentY, usableWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const obsText = order.observations || 'Sin observaciones adicionales registradas en esta intervención preventiva.';
  const obsLines = doc.splitTextToSize(obsText, usableWidth - 8);
  doc.text(obsLines, margin + 4, currentY + 4.5);

  currentY += 20;

  if (currentY > pageHeight - 55) {
    doc.addPage();
    currentY = 25;
    drawContinuationHeader(doc.getNumberOfPages());
  }

  const sigY = currentY;
  const colSigW = 92;

  // Caja Ejecutante (Izquierda)
  doc.setLineWidth(0.15);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(margin, sigY, colSigW, 44, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("FIRMA EJECUTANTE / MECÁNICO", margin + 4, sigY + 5.5);

  // Recuadro blanco firma ejecutante
  doc.setDrawColor(220, 225, 220);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 4, sigY + 8, colSigW - 8, 20, 'FD');

  if (order.signatureExecutor && order.signatureExecutor.startsWith('data:image')) {
    try {
      doc.addImage(order.signatureExecutor, 'PNG', margin + 6, sigY + 9, colSigW - 12, 18);
    } catch (e) {
      console.warn("Fallo agregando firma ejecutante como imagen", e);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(order.signatureExecutor || 'PENDIENTE DE FIRMA', margin + (colSigW / 2), sigY + 19, { align: 'center' });
  }

  // Nombre y fecha Ejecutante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("NOMBRE:", margin + 4, sigY + 33.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const executorDisplayName = order.signatureExecutor && !order.signatureExecutor.startsWith('data:image')
    ? order.signatureExecutor
    : executorName;
  doc.text(executorDisplayName, margin + 18, sigY + 33.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("FECHA:", margin + 4, sigY + 39.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  const execDateStr = order.signatureExecutorDate ? new Date(order.signatureExecutorDate).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Pendiente';
  doc.text(execDateStr, margin + 18, sigY + 39.5);


  // Caja Supervisor (Derecha)
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(pageWidth - margin - colSigW, sigY, colSigW, 44, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("FIRMA DE CONFORMIDAD SUPERVISOR", pageWidth - margin - colSigW + 4, sigY + 5.5);

  // Recuadro blanco firma supervisor
  doc.setDrawColor(220, 225, 220);
  doc.setFillColor(255, 255, 255);
  doc.rect(pageWidth - margin - colSigW + 4, sigY + 8, colSigW - 8, 20, 'FD');

  if (order.signatureSupervisor && order.signatureSupervisor.startsWith('data:image')) {
    try {
      doc.addImage(order.signatureSupervisor, 'PNG', pageWidth - margin - colSigW + 6, sigY + 9, colSigW - 12, 18);
    } catch (e) {
      console.warn("Fallo agregando firma supervisor como imagen", e);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(order.signatureSupervisor || 'PENDIENTE DE CONFORMIDAD', pageWidth - margin - (colSigW / 2), sigY + 19, { align: 'center' });
  }

  // Nombre y fecha Supervisor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("NOMBRE:", pageWidth - margin - colSigW + 4, sigY + 33.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const supervisorDisplayName = order.signatureSupervisor && !order.signatureSupervisor.startsWith('data:image')
    ? order.signatureSupervisor
    : getUserFullName(order.supervisor);
  doc.text(supervisorDisplayName, pageWidth - margin - colSigW + 18, sigY + 33.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("FECHA:", pageWidth - margin - colSigW + 4, sigY + 39.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  const superDateStr = order.signatureSupervisorDate || order.closingDate 
    ? new Date(order.signatureSupervisorDate || order.closingDate || '').toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) 
    : 'Pendiente';
  doc.text(superDateStr, pageWidth - margin - colSigW + 18, sigY + 39.5);


  // --- PIE DE PÁGINA RECURRENTE DINÁMICO ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    
    doc.setDrawColor(220, 225, 220);
    doc.setLineWidth(0.15);
    doc.line(margin, 264, pageWidth - margin, 264);
    
    doc.text("CoreFlow CMMS • Registro de Calidad • R-MANT-02 Preventivo", margin, 269);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, 269, { align: 'right' });
  }

  // --- GUARDADO ---
  const fileName = `R-MANT-02-${order.displayId || order.id}.pdf`;
  doc.save(fileName);
};

export const generateRMant05PDF = (order: WorkOrder, machine?: Machine, logoUrl?: string) => {
  // Configuración del PDF en tamaño Carta (Letter) - 215.9 x 279.4 mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.width; // 215.9 mm
  const pageHeight = doc.internal.pageSize.height; // 279.4 mm
  const margin = 12;
  const usableWidth = pageWidth - 2 * margin; // 191.9 mm

  // Paleta de colores Premium
  const primaryColor = [10, 80, 45]; // Verde Esmeralda Corporativo
  const secondaryColor = [80, 95, 80]; // Verde Grisáceo
  const borderCol = [200, 210, 200]; // Borde suave
  const textDark = [30, 30, 30]; // Texto principal
  const textMuted = [100, 110, 100]; // Etiquetas

  // Intentamos obtener el logo de plantSettings si no viene como parámetro
  let activeLogo = logoUrl || COMPANY_LOGO_BASE64;
  if (!activeLogo) {
    try {
      const storeSettings = useMasterStore.getState().plantSettings;
      if (storeSettings && storeSettings.logoUrl) {
        activeLogo = storeSettings.logoUrl;
      }
    } catch (e) {
      console.warn("No se pudo obtener el logo del store", e);
    }
  }

  // --- FUNCIÓN HELPER PARA DIBUJAR CAMPOS ---
  const drawField = (label: string, value: string, x: number, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(value || '-', x, y + 4.5);
  };

  // --- FUNCIÓN HELPER PARA LOS ENCABEZADOS DE SECCIÓN ---
  const drawSectionHeader = (title: string, y: number) => {
    // Texto del encabezado (sin barra verde antes de los números)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(title.toUpperCase(), margin, y + 4);
  };

  // ==========================================
  // PÁGINA 1: SOLICITUD Y DETALLES DE AVERÍA
  // ==========================================

  // --- BLOQUE 1: ENCABEZADO OFICIAL (ISO) ---
  doc.setLineWidth(0.35);
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, margin, usableWidth, 24);

  // Separadores verticales de cabecera
  const col1W = 46;
  const col3W = 44;
  const col2W = usableWidth - col1W - col3W; // 101.9 mm

  doc.line(margin + col1W, margin, margin + col1W, margin + 24);
  doc.line(margin + col1W + col2W, margin, margin + col1W + col2W, margin + 24);

  // Logo / Nombre Empresa (Columna Izquierda)
  if (activeLogo) {
    try {
      const imgProps = doc.getImageProperties(activeLogo);
      const logoW = 38;
      const logoH = (imgProps.height * logoW) / imgProps.width;
      const logoY = margin + (24 - logoH) / 2;
      doc.addImage(activeLogo, 'PNG', margin + 4, logoY, logoW, logoH);
    } catch (e) {
      console.warn("Error agregando logo de empresa", e);
      // Fallback
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(13);
      doc.text("COREFLOW INC.", margin + 4, margin + 12);
      doc.setFontSize(6);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text("SOLUCIONES INDUSTRIALES", margin + 4, margin + 17);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(13);
    doc.text("COREFLOW INC.", margin + 4, margin + 12);
    doc.setFontSize(6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("SOLUCIONES INDUSTRIALES", margin + 4, margin + 17);
  }

  // Título Central
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text("SOLICITUD, ANÁLISIS Y EJECUCIÓN", margin + col1W + (col2W / 2), margin + 8, { align: 'center' });
  doc.text("DE MANTENIMIENTO CORRECTIVO", margin + col1W + (col2W / 2), margin + 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`EQUIPO: ${machine?.name?.toUpperCase() || 'NO ESPECIFICADO'} (${machine?.alias || '-'})`, margin + col1W + (col2W / 2), margin + 18, { align: 'center' });
  doc.text(`SUCURSAL: ${machine?.branch?.toUpperCase() || '-'}`, margin + col1W + (col2W / 2), margin + 22, { align: 'center' });

  // Nomenclatura Derecha (R-MANT-05)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(15);
  doc.text("R-MANT-05", margin + col1W + col2W + (col3W / 2), margin + 11, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(order.displayId || order.id.substring(0, 8), margin + col1W + col2W + (col3W / 2), margin + 18, { align: 'center' });

  // --- BLOQUE 2: SECCIÓN 1 - INFORMACIÓN GENERAL (y = 44) ---
  drawSectionHeader("1. Solicitud de Servicio / Avería", 44);

  // Tarjeta de información general (w=191.9, h=56)
  doc.setLineWidth(0.15);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(margin, 51, usableWidth, 56, 2, 2, 'FD');

  const xCol1 = margin + 5;
  const xCol2 = margin + 67;
  const xCol3 = margin + 129;

  // Fila 1 (Y = 57)
  drawField("Número de Orden", order.displayId || order.id, xCol1, 57);
  const applicantName = getUserFullName(order.assignedTo); // Nombre del solicitante
  drawField("Nombre del Solicitante", applicantName, xCol2, 57);
  const requestDateStr = order.createdDate ? new Date(order.createdDate).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  drawField("Fecha y Hora Solicitud", requestDateStr, xCol3, 57);

  // Fila 2 (Y = 69)
  drawField("Ubicación / Área", machine?.zone || '-', xCol1, 69);
  drawField("Departamento", order.department || '-', xCol2, 69);
  drawField("Equipo para Mantenimiento", order.equipmentType || 'Mantenimiento Maquinaria', xCol3, 69);

  // Fila 3 (Y = 81)
  drawField("Máquina / Accesorio", `${machine?.name || '-'} (${machine?.alias || '-'})`, xCol1, 81);
  drawField("Marca / Modelo", `${machine?.brand || '-'} / ${machine?.model || '-'}`, xCol2, 81);
  drawField("Placa / Matrícula", machine?.plate || '-', xCol3, 81);

  // Fila 4 (Y = 93)
  drawField("Tipo de Mantenimiento", "Correctivo", xCol1, 93);
  
  // Condición
  let conditionLabel = (order.condition as any) || 'Normal';
  if (conditionLabel === 'Critical' || conditionLabel === 'CRITICAL') conditionLabel = 'Crítica';
  if (conditionLabel === 'Medium' || conditionLabel === 'WARNING') conditionLabel = 'Media';
  drawField("Condición", conditionLabel, xCol2, 93);

  // Tipo de avería
  drawField("Tipo de Avería", order.failureType || '-', xCol3, 93);

  // --- BLOQUE 3: SECCIÓN 2 - ANÁLISIS DEL PROBLEMA (y = 114) ---
  drawSectionHeader("2. Descripción y Análisis del Problema", 114);

  // Tarjeta (w=191.9, h=58) - Sin fondo de color y marco un poco más grueso/oscuro para ahorrar tinta
  doc.setLineWidth(0.35);
  doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.roundedRect(margin, 121, usableWidth, 58, 2, 2, 'D');

  // Fila de Frecuencia y Consecuencia
  drawField("Frecuencia", order.frequency || 'Ocasional', xCol1, 127);
  
  let consequenceLabel = order.consequence || 'Ninguna';
  if (consequenceLabel === 'Bajo Rendimiento') consequenceLabel = 'Bajo Rendimiento';
  drawField("Consecuencia", consequenceLabel, xCol2, 127);

  // Detalles de la Avería (Text Area enmarcada)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("DETALLES SOLICITUD - AVERÍA", xCol1, 139);

  doc.setDrawColor(220, 225, 220);
  doc.setFillColor(252, 252, 252);
  doc.rect(xCol1, 142, usableWidth - 10, 13, 'FD');
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const detailsText = order.requestDescription || order.description || 'Sin descripción detallada registrada.';
  const detailsLines = doc.splitTextToSize(detailsText, usableWidth - 14);
  doc.text(detailsLines, xCol1 + 2, 146.5);

  // Acción de Contención Tomada
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("ACCIÓN DE CONTENCIÓN TOMADA POR EL SOLICITANTE", xCol1, 161);

  doc.setDrawColor(220, 225, 220);
  doc.setFillColor(252, 252, 252);
  doc.rect(xCol1, 164, usableWidth - 10, 11, 'FD');
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const actionText = order.actionTaken || 'Ninguna medida provisional registrada.';
  const actionLines = doc.splitTextToSize(actionText, usableWidth - 14);
  doc.text(actionLines, xCol1 + 2, 168.5);

  // --- BLOQUE 4: SECCIÓN 3 - CONTROL DE TIEMPOS (y = 186) ---
  drawSectionHeader("3. Control de Tiempos e Intervención", 186);

  // Tarjeta (w=191.9, h=33)
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(margin, 193, usableWidth, 33, 2, 2, 'FD');

  // Hora de Inicio y Hora Fin
  drawField("Hora Inicio", order.startTime || '--:--', xCol1, 199);
  drawField("Hora Fin", order.endTime || '--:--', xCol2, 199);

  // Cálculo de Duración
  let durationStr = '0h 0m';
  if (order.startTime && order.endTime) {
    try {
      const start = new Date(`1970-01-01T${order.startTime}:00`);
      const end = new Date(`1970-01-01T${order.endTime}:00`);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        const totalMins = Math.floor(diffMs / 60000);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        durationStr = `${hrs}h ${mins}m`;
      }
    } catch (e) {
      console.warn("Error calculando duración", e);
    }
  }
  drawField("Tiempo Empleado (Duración)", durationStr, xCol3, 199);

  // Reporte Recibido y Personal Asignado
  drawField("Reporte Recibido Por", getUserFullName(order.requestReceivedBy), xCol1, 211);
  const receivedDateStr = order.requestReceivedDate ? new Date(order.requestReceivedDate).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  drawField("Fecha y Hora Recibido", receivedDateStr, xCol2, 211);
  drawField("Personal Asignado / Ejecutante", getUserFullName(order.assignedMechanic || order.assignedTo), xCol3, 211);

  // --- PIE DE PÁGINA 1 ---
  doc.setDrawColor(220, 225, 220);
  doc.setLineWidth(0.15);
  doc.line(margin, 264, pageWidth - margin, 264);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("CoreFlow CMMS • Registro de Calidad • R-MANT-05 Correctivo", margin, 269);
  doc.text("Página 1 de 2", pageWidth - margin, 269, { align: 'right' });


  // ==========================================
  // PÁGINA 2: ACTIVIDADES, REPUESTOS Y CIERRE
  // ==========================================
  doc.addPage();

  // --- ENCABEZADO SIMPLIFICADO DE CONTINUACIÓN ---
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.text("R-MANT-05 | REGISTRO DE TRABAJOS Y CIERRE CORRECTIVO", margin, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`ORDEN: ${order.displayId || order.id.substring(0, 8)}`, pageWidth - margin, 15, { align: 'right' });
  
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, 18, pageWidth - margin, 18);

  // --- BLOQUE 5: SECCIÓN 4 - REGISTRO DE ACTIVIDADES (y = 24) ---
  drawSectionHeader("4. Registro de Averías y Actividades Realizadas", 24);

  const failuresData = (order.failuresAndActivities || []).map((fa, idx) => [
    idx + 1,
    fa.cause || 'No especificada',
    fa.activity || 'No especificada'
  ]);
  
  if (failuresData.length === 0) {
    failuresData.push([1, 'No especificada / Falla no registrada', 'Se realizó corrección del problema reportado']);
  }

  autoTable(doc, {
    startY: 31,
    head: [['Nº', 'Causa de la Avería / Diagnóstico', 'Actividades Realizadas / Trabajos Correctivos']],
    body: failuresData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [220, 225, 220],
      lineWidth: 0.15,
      textColor: [30, 30, 30]
    },
    headStyles: {
      fillColor: [10, 80, 45],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: usableWidth - 80 }
    },
    margin: { left: margin, right: margin }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- BLOQUE 6: SECCIÓN 5 - REPUESTOS UTILIZADOS ---
  drawSectionHeader("5. Repuestos y Materiales Utilizados", currentY);

  const partsData = (order.consumedParts || []).map(p => [
    p.partName ? `${p.partName} (${p.sku || '-'})` : (p.sku || '-'),
    p.unit || 'Pieza',
    p.quantity || 0,
    `RD$ ${(p.unitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `RD$ ${(p.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ]);

  if (partsData.length === 0) {
    partsData.push(['No se consumieron repuestos o insumos de inventario en esta intervención.', '-', '-', '-', '-']);
  }

  autoTable(doc, {
    startY: currentY + 7,
    head: [['Insumo / Repuesto Consumido', 'Unidad', 'Cant.', 'Costo Unit.', 'Importe']],
    body: partsData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [220, 225, 220],
      lineWidth: 0.15,
      textColor: [30, 30, 30]
    },
    headStyles: {
      fillColor: [10, 80, 45],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: usableWidth - 90 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 27, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Badge de Costo Total a la derecha
  const totalCost = order.totalMaintenanceCost || (order.consumedParts || []).reduce((acc, p) => acc + (p.totalCost || 0), 0) || 0;
  const formattedTotal = `RD$ ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  doc.setFillColor(245, 248, 245);
  doc.setDrawColor(10, 80, 45);
  doc.setLineWidth(0.25);
  doc.roundedRect(pageWidth - margin - 75, currentY, 75, 8, 1, 1, 'FD');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(10, 80, 45);
  doc.text("COSTO TOTAL REPUESTOS:", pageWidth - margin - 71, currentY + 5.2);
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(formattedTotal, pageWidth - margin - 4, currentY + 5.2, { align: 'right' });

  // --- BLOQUE 7: SECCIÓN 6 - CHECKLIST DE ENTREGA DE ÁREA/EQUIPO ---
  drawSectionHeader("6. Entrega del Área o Equipo Donde se Realizó el Trabajo Correctivo", currentY + 13);

  const cardY = currentY + 20;
  const cardHeight = 49;
  doc.setLineWidth(0.15);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(margin, cardY, usableWidth, cardHeight, 2, 2, 'FD');

  const cl = order.checklist || {};

  const checklistItems = [
    { text: "Punto específico de intervención limpio libre de contaminantes (grasas u otros químicos)", val: cl.pointClean },
    { text: "Área o punto de intervención limpio", val: cl.areaClean },
    { text: "Protecciones y guardas de máquinas completas", val: cl.guardsComplete },
    { text: "Se retiró del área todas las herramientas y accesorios que se utilizó en la intervención del equipo.", val: cl.toolsRemoved },
    { text: "En caso de haber utilizado grasas o aceites dejar en lugar asignado.", val: cl.greaseCleaned },
    { text: "Protecciones de seguridad activadas", val: cl.safetyActivated }
  ];

  checklistItems.forEach((item, idx) => {
    const itemY = cardY + 6 + idx * 7.2;
    
    // Texto completo e idéntico al formulario
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(item.text, margin + 4, itemY);

    // Posicionamiento de casillas de verificación
    const checkX = margin + usableWidth - 26;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("SÍ", checkX, itemY);
    doc.text("NO", checkX + 14, itemY);

    // Dibujo de casillas (rectángulos pequeños)
    doc.setLineWidth(0.2);
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(checkX - 5, itemY - 2.5, 3, 3); // Casilla SÍ
    doc.rect(checkX + 9, itemY - 2.5, 3, 3); // Casilla NO

    // Marca de selección X (completamente compatible y legible)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    if (item.val === true) {
      doc.text("X", checkX - 4.2, itemY - 0.2);
    } else if (item.val === false) {
      doc.setTextColor(180, 50, 50); // Rojo si es NO
      doc.text("X", checkX + 9.8, itemY - 0.2);
    }
  });

  currentY = cardY + cardHeight + 5;

  // --- BLOQUE 8: SECCIÓN 7 - ACEPTACIÓN, EVIDENCIAS Y FIRMAS ---
  drawSectionHeader("7. Conformidad y Cierre de Orden", currentY);

  const sigY = currentY + 7;
  const colSigW = 92;

  // Caja Ejecutante (Izquierda)
  doc.setLineWidth(0.15);
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(margin, sigY, colSigW, 44, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("FIRMA EJECUTANTE / MECÁNICO", margin + 4, sigY + 5.5);

  // Recuadro blanco firma ejecutante
  doc.setDrawColor(220, 225, 220);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 4, sigY + 8, colSigW - 8, 20, 'FD');

  if (order.signatureExecutor && order.signatureExecutor.startsWith('data:image')) {
    try {
      doc.addImage(order.signatureExecutor, 'PNG', margin + 6, sigY + 9, colSigW - 12, 18);
    } catch (e) {
      console.warn("Fallo agregando firma ejecutante como imagen", e);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(order.signatureExecutor || 'PENDIENTE DE FIRMA', margin + (colSigW / 2), sigY + 19, { align: 'center' });
  }

  // Nombre y fecha Ejecutante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("NOMBRE:", margin + 4, sigY + 33.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const executorDisplayName = order.signatureExecutor && !order.signatureExecutor.startsWith('data:image')
    ? order.signatureExecutor
    : getUserFullName(order.assignedMechanic || order.assignedTo);
  doc.text(executorDisplayName, margin + 18, sigY + 33.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("FECHA:", margin + 4, sigY + 39.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  const execDateStr = order.signatureExecutorDate ? new Date(order.signatureExecutorDate).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Pendiente';
  doc.text(execDateStr, margin + 18, sigY + 39.5);


  // Caja Supervisor (Derecha)
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(pageWidth - margin - colSigW, sigY, colSigW, 44, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("FIRMA DE CONFORMIDAD SUPERVISOR", pageWidth - margin - colSigW + 4, sigY + 5.5);

  // Recuadro blanco firma supervisor
  doc.setDrawColor(220, 225, 220);
  doc.setFillColor(255, 255, 255);
  doc.rect(pageWidth - margin - colSigW + 4, sigY + 8, colSigW - 8, 20, 'FD');

  if (order.signatureSupervisor && order.signatureSupervisor.startsWith('data:image')) {
    try {
      doc.addImage(order.signatureSupervisor, 'PNG', pageWidth - margin - colSigW + 6, sigY + 9, colSigW - 12, 18);
    } catch (e) {
      console.warn("Fallo agregando firma supervisor como imagen", e);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(order.signatureSupervisor || 'PENDIENTE DE CONFORMIDAD', pageWidth - margin - (colSigW / 2), sigY + 19, { align: 'center' });
  }

  // Nombre y fecha Supervisor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("NOMBRE:", pageWidth - margin - colSigW + 4, sigY + 33.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const supervisorDisplayName = order.signatureSupervisor && !order.signatureSupervisor.startsWith('data:image')
    ? order.signatureSupervisor
    : getUserFullName(order.supervisor);
  doc.text(supervisorDisplayName, pageWidth - margin - colSigW + 18, sigY + 33.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("FECHA:", pageWidth - margin - colSigW + 4, sigY + 39.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  const superDateStr = order.signatureSupervisorDate || order.closingDate 
    ? new Date(order.signatureSupervisorDate || order.closingDate || '').toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) 
    : 'Pendiente';
  doc.text(superDateStr, pageWidth - margin - colSigW + 18, sigY + 39.5);


  // --- PIE DE PÁGINA 2 ---
  doc.setDrawColor(220, 225, 220);
  doc.setLineWidth(0.15);
  doc.line(margin, 264, pageWidth - margin, 264);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("CoreFlow CMMS • Registro de Calidad • R-MANT-05 Correctivo", margin, 269);
  doc.text("Página 2 de 2", pageWidth - margin, 269, { align: 'right' });


  // --- GUARDADO ---
  const fileName = `R-MANT-05-${order.displayId || order.id}.pdf`;
  doc.save(fileName);
};


export const generateMaintenanceListPDF = (orders: WorkOrder[], title: string, machines: Machine[]) => {
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 10;

  // --- HEADER SECTION ---
  doc.rect(margin, margin, pageWidth - 2 * margin, 20);
  
  // Logo / Company Name
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 150, 0);
  if (COMPANY_LOGO_BASE64) {
    try {
      const imgProps = doc.getImageProperties(COMPANY_LOGO_BASE64);
      const logoWidth = 35;
      const logoHeight = (imgProps.height * logoWidth) / imgProps.width;
      doc.addImage(COMPANY_LOGO_BASE64, 'PNG', margin + 2, margin + 2, logoWidth, logoHeight);
    } catch (e) {
      console.warn("Could not add company logo to list", e);
    }
  } else {
    doc.setFontSize(14);
    doc.text("COREFLOW INC.", margin + 5, margin + 10);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("SOLUCIONES INDUSTRIALES", margin + 5, margin + 14);
  }

  // Report Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(title, pageWidth / 2, margin + 12, { align: 'center' });

  // Date and Metadata
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, pageWidth - margin - 5, margin + 8, { align: 'right' });
  doc.text(`Registros Encontrados: ${orders.length}`, pageWidth - margin - 5, margin + 14, { align: 'right' });

  // --- TABLE SECTION ---
  const isRMant02 = title.includes('PREVENTIVO');

  const head = isRMant02 
    ? [['Nº Orden', 'Equipo', 'Zona / Línea', 'Alias', 'Tipo', 'Intervalo', 'Fecha', 'Estado']]
    : [['Nº Orden', 'Equipo', 'Ubicación', 'Tipo', 'Departamento', 'Tipo de Avería', 'Fecha', 'Estado']];

  const body = orders.map(o => {
    const machine = machines.find(m => m.id === o.machineId);
    const date = new Date(o.createdDate).toLocaleDateString();
    
    if (isRMant02) {
      return [
        o.displayId || '(Nuevo)',
        machine?.name || '-',
        machine?.zone || '-',
        machine?.alias || '-',
        o.maintenanceType || '-',
        o.interval || '-',
        date,
        o.currentStage
      ];
    } else {
      return [
        o.displayId || '(Nuevo)',
        `${machine?.name || '-'} ${machine?.alias ? `(${machine.alias})` : ''}`,
        machine?.zone || '-',
        o.maintenanceType || '-',
        o.department || '-',
        o.failureType || '-',
        date,
        o.currentStage
      ];
    }
  });

    autoTable(doc, {
      startY: 35,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 100, 0], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 255, 245] }
    });

    const fileName = `${title.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error('ERROR during PDF generation:', err);
  }
};
