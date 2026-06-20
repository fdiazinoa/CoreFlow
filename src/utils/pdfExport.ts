import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExtendedPurchaseRequest } from '../types/inventory';
import { useMasterStore } from '../stores/useMasterStore';

export const exportPurchaseRequestPDF = (request: ExtendedPurchaseRequest) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const { plantSettings, machines } = useMasterStore.getState() as any;
    const margin = 14;

    if (request.purchaseRequestNumber.startsWith('SC-PROV-')) {
        // ==========================================
        // FORMATO DE PROVEEDOR INTERNACIONAL (ELEGANTE)
        // ==========================================
        const dateObj = new Date(request.requestDate);
        const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        const senderCompany = request.items[0]?.company || 'RAVI CARIBE INC';
        const requestNumber = request.purchaseRequestNumber.replace('SC-PROV-', '') || request.purchaseRequestNumber;
        const supplierName = request.items[0]?.supplier || 'SACMI MEXICO';

        // Grouping items by machine
        const groups: Record<string, { name: string; plate: string; year: string; model: string; line: string; items: any[] }> = {};
        
        request.items.forEach(item => {
            const partMachine = machines?.find((m: any) => 
                (item.machinePlate && m.plate === item.machinePlate) ||
                (item.machineName && m.name === item.machineName)
            );
            const mName = item.machineName || partMachine?.name || 'Varios';
            const mPlate = item.machinePlate || partMachine?.plate || 'N/A';
            const mYear = partMachine?.year ? String(partMachine.year) : 'N/A';
            const mModel = partMachine?.model || 'N/A';
            const mLine = partMachine?.zone || 'N/A';
            
            const key = `${mName}_${mPlate}_${mYear}_${mModel}_${mLine}`;
            if (!groups[key]) {
                groups[key] = { name: mName, plate: mPlate, year: mYear, model: mModel, line: mLine, items: [] };
            }
            groups[key].items.push(item);
        });

        // 1. Logo & Header Section
        let currentY = 15;
        if (plantSettings.logoUrl) {
            try {
                const imgProps = doc.getImageProperties(plantSettings.logoUrl);
                const logoWidth = 30;
                const logoHeight = (imgProps.height * logoWidth) / imgProps.width;
                doc.addImage(plantSettings.logoUrl, 'PNG', margin, 10, logoWidth, logoHeight);
                currentY = Math.max(25, 10 + logoHeight + 5);
            } catch (e) {
                console.warn('Could not add logo to PDF', e);
                currentY = 22;
            }
        } else {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(plantSettings.plantName || 'CoreFlow', margin, 18);
            currentY = 22;
        }

        // Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 62, 80); // Color industrial
        doc.text(`SOLICITUD DE REPUESTOS A ${supplierName.toUpperCase()}`, margin, currentY);

        // Divider
        doc.setDrawColor(220, 224, 230);
        doc.setLineWidth(0.3);
        doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);

        currentY += 12;

        // 2. Metadata Section (Clean horizontal columns)
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        
        doc.setFont('helvetica', 'bold');
        doc.text('FECHA:', margin, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(formattedDate, margin + 14, currentY);

        doc.setFont('helvetica', 'bold');
        doc.text('REMITENTE:', margin + 50, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(senderCompany, margin + 72, currentY);

        doc.setFont('helvetica', 'bold');
        doc.text('Nº SOLICITUD:', pageWidth - margin - 50, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(requestNumber, pageWidth - margin - 22, currentY);

        currentY += 8;

        // 3. Render each machine group as a separate header bar + clean autoTable
        let overallIndex = 1;
        
        Object.values(groups).forEach((group) => {
            // Check if we need a new page
            if (currentY > pageHeight - 50) {
                doc.addPage();
                currentY = 20;
            }

            // Draw clean section header bar for the Machine
            doc.setFillColor(245, 247, 250);
            doc.rect(margin, currentY, pageWidth - (margin * 2), 7, 'F');
            
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(44, 62, 80);
            
            const machineText = `MÁQUINA: ${group.name.toUpperCase()}    |    MATRÍCULA: ${group.plate.toUpperCase()}    |    MODELO: ${group.model.toUpperCase()}    |    LÍNEA: ${group.line.toUpperCase()}    |    AÑO: ${group.year}`;
            doc.text(machineText, margin + 4, currentY + 4.8);
            
            currentY += 10;

            // Prepare table rows for this group
            const tableRows = group.items.map(item => [
                overallIndex++,
                item.catalog || '-',
                item.tableNo || '-',
                item.figure || '-',
                item.partName || '-',
                item.partNumber || '-',
                item.quantity,
                item.unitOfMeasure || 'Pzas'
            ]);

            autoTable(doc, {
                body: tableRows,
                head: [['Nº', 'Catálogo', 'Tabla', 'Fig.', 'Descripción', 'Código', 'Cant.', 'UD.']],
                theme: 'grid',
                startY: currentY,
                styles: {
                    fontSize: 8,
                    cellPadding: 3.5,
                    textColor: [50, 50, 50],
                    lineColor: [220, 224, 230],
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: [44, 62, 80],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8,
                    halign: 'left'
                },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 26 },
                    2: { cellWidth: 26 },
                    3: { cellWidth: 12, halign: 'center' },
                    4: { cellWidth: 'auto' }, // Expanded to fit description fully
                    5: { cellWidth: 32 },
                    6: { cellWidth: 15, halign: 'center' },
                    7: { cellWidth: 15, halign: 'center' }
                },
                margin: { left: margin, right: margin }
            });

            currentY = (doc as any).lastAutoTable.finalY + 8;
        });

        const fileName = `Requisicion_Proveedor_${request.purchaseRequestNumber}.pdf`;
        doc.save(fileName);
    } else {
        // ==========================================
        // FORMATO LOCAL (ORIGINAL)
        // ==========================================
        let logoHeight = 0;

        if (plantSettings.logoUrl) {
            try {
                const imgProps = doc.getImageProperties(plantSettings.logoUrl);
                const logoWidth = 25; // Small size, matching spare parts request report
                logoHeight = (imgProps.height * logoWidth) / imgProps.width;
                doc.addImage(plantSettings.logoUrl, 'PNG', margin, 10, logoWidth, logoHeight);
            } catch (e) {
                console.warn('Could not add logo to PDF', e);
            }
        } else {
            // Fallback text if no logo
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(plantSettings.plantName || 'CoreFlow', margin, 18);
            logoHeight = 10;
        }

        // Adjust Y coordinates based on logo height
        const headerY = Math.max(25, 10 + logoHeight + 5);

        // Title (matching exact font size and style of spare parts request report)
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Reporte de Requisición de Compra', margin, headerY);

        // Date
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString();
        doc.text(`Fecha de Emisión: ${dateStr}`, margin, headerY + 7);

        // --- Request Metadata Block ---
        const metaY = headerY + 18;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('INFORMACIÓN DE LA REQUISICIÓN', margin, metaY);
        
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(margin, metaY + 2, pageWidth - margin, metaY + 2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        const reqDate = new Date(request.requestDate).toLocaleDateString();
        
        doc.text(`Código de Requisición: ${request.purchaseRequestNumber}`, margin, metaY + 8);
        doc.text(`Solicitado Por: ${request.requestedBy}`, margin, metaY + 14);
        
        doc.text(`Fecha de Requisición: ${reqDate}`, pageWidth - margin, metaY + 8, { align: 'right' });
        doc.text(`Solicitud de Origen: ${request.sourceRequestNumber || 'DIRECTO'}`, pageWidth - margin, metaY + 14, { align: 'right' });

        const yPos = metaY + 22;

        // --- Items Table ---
        const tableBody = request.items.map(item => {
            const itemDate = new Date(request.requestDate).toLocaleDateString();
            const itemStatus = request.status === 'Cancelado'
                ? 'Cancelado'
                : (item.quantityReceived || 0) >= item.quantity
                    ? 'Recibido'
                    : (item.quantityReceived || 0) > 0
                        ? 'Parcial'
                        : 'Pendiente';
            
            return [
                itemDate,
                item.partNumber || request.sparePartNumber || 'N/A',
                item.partName || request.sparePartName || 'N/A',
                item.company || 'N/A',
                item.quantity,
                itemStatus
            ];
        });

        autoTable(doc, {
            startY: yPos,
            head: [['Fecha', 'Código', 'Nombre', 'Empresa', 'Cant. Solicitada', 'Estado Solicitud']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            columnStyles: {
                4: { halign: 'right' }, // Right-aligned "Cant. Solicitada"
                5: { halign: 'center' }  // Center-aligned "Estado Solicitud"
            },
            margin: { left: margin, right: margin }
        });

        // --- Footer & Signatures ---
        const finalY = (doc as any).lastAutoTable.finalY + 30;
        
        let signatureY = finalY;
        if (signatureY > pageHeight - 30) {
            doc.addPage();
            signatureY = 40;
        }

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);

        doc.line(margin, signatureY, margin + 55, signatureY);
        doc.text('Firma Solicitante', margin, signatureY + 5);
        
        doc.line(pageWidth - margin - 55, signatureY, pageWidth - margin, signatureY);
        doc.text('Firma Autorización', pageWidth - margin - 55, signatureY + 5);

        // Save PDF
        const fileName = `Requisicion_${request.purchaseRequestNumber}.pdf`;
        doc.save(fileName);
    }
};

