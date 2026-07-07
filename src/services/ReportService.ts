import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WorkOrder, Machine } from '../../types';

export const generateWorkOrderReport = (
  orders: WorkOrder[], 
  filtersDescription: string,
  machines: Machine[],
  type: 'R-MANT-02' | 'R-MANT-05',
  logoUrl?: string
) => {
  console.log(`1. Iniciando generación de PDF ${type}...`);
  
  if (!orders || orders.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  try {
    const doc = new jsPDF();
    let currentY = 20;

    // 1. Logo (Esquina superior izquierda, sin distorsión)
    if (logoUrl) {
      try {
        // Intentamos cargar las propiedades para mantener el ratio
        const imgProps = doc.getImageProperties(logoUrl);
        const width = 35; // Ancho base en mm
        const height = (imgProps.height * width) / imgProps.width;
        doc.addImage(logoUrl, 'PNG', 14, 10, width, height);
        currentY = 15 + height + 10; // Espacio después del logo
      } catch (e) {
        console.warn("No se pudo cargar el logo, continuando sin él", e);
        currentY = 22;
      }
    } else {
      currentY = 22;
    }

    // 2. Título (Más pequeño, nomenclatura específica)
    doc.setFontSize(14);
    const title = type === 'R-MANT-02' ? 'Reporte de Mantenimiento R-MANT-02' : 'Reporte de Mantenimiento R-MANT-05';
    doc.text(title, 14, currentY);
    
    // Subtítulos e info
    doc.setFontSize(10);
    doc.text(`Fecha de emisión: ${new Date().toLocaleString()}`, 14, currentY + 8);
    
    // Filtros detallados
    doc.setFontSize(9);
    doc.setTextColor(100);
    const splitFilters = doc.splitTextToSize(`Filtros aplicados: ${filtersDescription}`, 180);
    doc.text(splitFilters, 14, currentY + 14);
    doc.setTextColor(0);

    const afterHeaderY = currentY + 14 + (splitFilters.length * 5);

    // 3. Definición de Columnas según el Tipo
    let tableColumn: string[] = [];
    let tableRows: any[] = [];

    if (type === 'R-MANT-05') {
      // Numero de Orden, Fecha, Maquina / Accesorio, Ubicación, Tipo Mantenimiento, Departamento, Tipo Avería
      tableColumn = ["Nº Orden", "Fecha", "Máquina / Accesorio", "Ubicación", "Tipo Mant.", "Departamento", "Tipo Avería"];
      tableRows = orders.map(order => {
        const machine = machines.find(m => m.id === order.machineId);
        
        // Traducción de Tipo de Mantenimiento
        let typeLabel = order.type || order.maintenanceType || '-';
        if (typeLabel === 'CORRECTIVE' || typeLabel === 'Corrective') typeLabel = 'Correctivo';
        if (typeLabel === 'PREVENTIVE' || typeLabel === 'Preventive') typeLabel = 'Preventivo';
        if (typeLabel === 'PREDICTIVE') typeLabel = 'Predictivo';
        if (typeLabel === 'PROGRAMMED') typeLabel = 'Programado';

        return [
          order.displayId || order.id.substring(0, 6),
          order.createdDate ? new Date(order.createdDate).toLocaleDateString() : '-',
          machine?.name || 'N/A',
          machine?.zone || '-',
          typeLabel,
          order.department || '-',
          order.failureType || '-'
        ];
      });
    } else {
      // Numero de Orden, Fecha, Equipo, Zona / Línea, Alias, Intervalo
      tableColumn = ["Nº Orden", "Fecha", "Equipo", "Zona / Línea", "Alias", "Intervalo"];
      tableRows = orders.map(order => {
        const machine = machines.find(m => m.id === order.machineId);

        // Traducción de Tipo de Mantenimiento
        let typeLabel = order.type || order.maintenanceType || '-';
        if (typeLabel === 'CORRECTIVE' || typeLabel === 'Corrective') typeLabel = 'Correctivo';
        if (typeLabel === 'PREVENTIVE' || typeLabel === 'Preventive') typeLabel = 'Preventivo';
        if (typeLabel === 'PREDICTIVE') typeLabel = 'Predictivo';
        if (typeLabel === 'PROGRAMMED') typeLabel = 'Programado';

        return [
          order.displayId || order.id.substring(0, 6),
          order.createdDate ? new Date(order.createdDate).toLocaleDateString() : '-',
          machine?.name || 'N/A',
          machine?.zone || '-',
          machine?.alias || '-',
          order.interval || '-'
        ];
      });
    }

    // 4. Generación de Tabla
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: afterHeaderY,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [44, 62, 80] }, // Color industrial más sobrio
      margin: { left: 14, right: 14 }
    });

    // 5. Guardado
    const fileName = `Reporte_${type}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    console.log("PDF Generado exitosamente:", fileName);

  } catch (error) {
    console.error("CRITICAL ERROR generating PDF:", error);
    alert("Error al generar PDF. Ver consola.");
  }
};
