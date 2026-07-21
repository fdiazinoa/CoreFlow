import React, { useState, useEffect } from 'react';
import { inventoryService } from '../../services';
import { SparePart, StockReception, ExtendedPurchaseRequest } from '../../types/inventory';
import { ArrowDownCircle, Clock, FileText, Package, ChevronDown, ChevronRight, Search, FileDown, Filter, X, Loader2 } from 'lucide-react';
import { TablePagination } from '../shared/TablePagination';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useMasterStore } from '../../stores/useMasterStore';

export const ReceptionForm: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

    // --- Nueva Recepción State ---
    const [parts, setParts] = useState<SparePart[]>([]);
    const [selectedPartId, setSelectedPartId] = useState('');
    const [quantity, setQuantity] = useState(0);
    const [relatedDocId, setRelatedDocId] = useState('');
    const [notes, setNotes] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [itemsToReceive, setItemsToReceive] = useState<{ partId: string; partName: string; partNumber: string; quantity: number }[]>([]);
    
    // Purchase Request Linking State
    const [purchaseRequests, setPurchaseRequests] = useState<ExtendedPurchaseRequest[]>([]);
    const [selectedPurchaseRequestId, setSelectedPurchaseRequestId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- History State ---
    const [receptions, setReceptions] = useState<StockReception[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalHistory, setTotalHistory] = useState(0);
    const ITEMS_PER_PAGE = 25;
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
    const [selectedHistoryPartId, setSelectedHistoryPartId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        inventoryService.getAllParts(1, 1000).then(res => setParts(res.data));
        inventoryService.getPurchaseRequestsForReception().then(res => setPurchaseRequests(res));
    }, []);

    const loadHistory = () => {
        setLoadingHistory(true);
        inventoryService.getReceptions(
            { page: currentPage, pageSize: ITEMS_PER_PAGE },
            {
                searchTerm: historySearchTerm || undefined,
                partId: selectedHistoryPartId || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            }
        )
            .then(res => {
                console.log("HISTORY LOAD RET", res.data.length, res.count);
                setReceptions(res.data);
                setTotalHistory(res.count || 0);
            })
            .finally(() => setLoadingHistory(false));
    };

    const toggleExpand = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        
        setExpandedId(id);
        
        // Fetch details if items are empty
        const rec = receptions.find(r => r.id === id);
        if (rec && (!rec.items || rec.items.length === 0)) {
             try {
                 const fullRec = await inventoryService.getReceptionById(id);
                 setReceptions(prev => prev.map(p => p.id === id ? { ...p, items: fullRec.items } : p));
             } catch(err) {
                 console.error('Error fetching reception details:', err);
             }
        }
    };

    // Load history whenever switching to that tab, or search term (if no part selected), partId, or date range changes
    useEffect(() => {
        if (activeTab === 'history') {
            const timeoutId = setTimeout(() => {
                loadHistory();
            }, 300); // Debounce search
            return () => clearTimeout(timeoutId);
        }
    }, [activeTab, historySearchTerm, selectedHistoryPartId, startDate, endDate]);

    // Reset page on search or date range changes
    useEffect(() => {
        setCurrentPage(1);
    }, [historySearchTerm, selectedHistoryPartId, startDate, endDate]);

    const handleAddItem = () => {
        if (!selectedPartId || quantity <= 0) return;
        const part = parts.find(p => p.id === selectedPartId);
        if (!part) return;
        setItemsToReceive(prev => [
            ...prev,
            { partId: part.id, partName: part.name, partNumber: part.partNumber || part.sku || '', quantity }
        ]);
        setSelectedPartId('');
        setSearchTerm('');
        setQuantity(0);
    };

    const handleRemoveItem = (index: number) => {
        setItemsToReceive(prev => prev.filter((_, i) => i !== index));
    };

    const handlePurchaseRequestChange = (prId: string) => {
        setSelectedPurchaseRequestId(prId);
        if (!prId) {
            setItemsToReceive([]);
            setRelatedDocId('');
            return;
        }

        const pr = purchaseRequests.find(p => p.id === prId);
        if (pr) {
            setRelatedDocId(pr.purchaseRequestNumber);
            const pendingItems = pr.items
                .filter(item => (item.quantityReceived || 0) < item.quantity)
                .map(item => ({
                    partId: item.partId,
                    partName: item.partName || '',
                    partNumber: item.partNumber || '',
                    quantity: item.quantity - (item.quantityReceived || 0)
                }));
            setItemsToReceive(pendingItems);
        }
    };

    const generatePDF = () => {
        const { plantSettings } = useMasterStore.getState() as any;
        const doc = new jsPDF();

        // 1. Logo (Small size in top left)
        let logoHeight = 0;
        const margin = 14;

        if (plantSettings.logoUrl) {
            try {
                const imgProps = doc.getImageProperties(plantSettings.logoUrl);
                const logoWidth = 25; // Small size
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

        // Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Reporte de Recepción de Repuestos', margin, headerY);

        // Date
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString('es-DO', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        doc.text(`Fecha de Emisión: ${dateStr}`, margin, headerY + 7);

        // Filters under date
        let filterStr = 'Filtros: Todos los registros';
        if (selectedHistoryPartId) {
            const selectedPart = parts.find(p => p.id === selectedHistoryPartId);
            filterStr = `Filtros: Repuesto Seleccionado - ${selectedPart ? `${selectedPart.sku || selectedPart.partNumber} ${selectedPart.name}` : historySearchTerm}`;
        } else if (historySearchTerm) {
            filterStr = `Búsqueda: "${historySearchTerm}"`;
        }

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(filterStr, margin, headerY + 14);

        const yPos = headerY + 22;

        // Content Table Restructuring
        const tableColumn = ["Fecha", "Solicitud", "Código", "Repuesto", "Cantidad", "Notas"];
        const tableRows: any[] = [];

        receptions.forEach(rec => {
            const date = new Date(rec.receptionDate).toLocaleDateString('es-DO', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });

            // Filter items in the PDF table if a specific spare part filter is active
            const itemsToShow = selectedHistoryPartId
                ? rec.items.filter(i => i.partId === selectedHistoryPartId)
                : rec.items;

            itemsToShow.forEach(item => {
                tableRows.push([
                    date,
                    rec.documentNumber || 'N/A',
                    item.partNumber || '-',
                    item.partName || '-',
                    item.quantity,
                    rec.notes || '-'
                ]);
            });
        });

        autoTable(doc, {
            startY: yPos,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                4: { halign: 'right' }
            },
            margin: { left: margin, right: margin }
        });

        doc.save(`reporte_recepciones_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleReceive = async (e: React.FormEvent) => {
        e.preventDefault();
        if (itemsToReceive.length === 0) {
            setMessage({ type: 'error', text: 'Agregue al menos un ítem a la lista.' });
            return;
        }

        setIsSubmitting(true);
        try {
            if (selectedPurchaseRequestId) {
                // Use the central method for processing Purchase Receptions
                await inventoryService.processPurchaseReception(
                    selectedPurchaseRequestId,
                    itemsToReceive.map(i => ({ partId: i.partId, qtyReceived: i.quantity })),
                    notes
                );
                
                // Refresh list of PRs
                inventoryService.getPurchaseRequestsForReception().then(res => setPurchaseRequests(res));
                setSelectedPurchaseRequestId('');
            } else {
                // Original independent reception
                // 1. Update stock for each item
                for (const item of itemsToReceive) {
                    await inventoryService.addStock(item.partId, item.quantity, relatedDocId);
                }

                // 2. Save the consolidated reception record
                await inventoryService.saveReception({
                    documentNumber: relatedDocId || undefined,
                    notes: notes || undefined,
                    items: itemsToReceive
                });
            }

            setMessage({ type: 'success', text: 'Recepción registrada correctamente.' });
            setItemsToReceive([]);
            setRelatedDocId('');
            setNotes('');
            setQuantity(0);
            setSearchTerm('');
            setSelectedPartId('');
            inventoryService.getAllParts(1, 1000).then(res => setParts(res.data));
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error al registrar la recepción.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredParts = parts.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.partNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const historyFilteredParts = parts.filter(p =>
        p.name.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        p.partNumber.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(historySearchTerm.toLowerCase()))
    );

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentReceptions = receptions.slice(startIndex, endIndex);

    return (
        <div className="bg-industrial-800 rounded-lg shadow-xl border border-industrial-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center px-6 pt-6 pb-0 text-white border-b border-industrial-700">
                <span className="p-1.5 bg-emerald-900/30 rounded border border-emerald-800 mr-3">
                    <ArrowDownCircle className="w-6 h-6 text-emerald-500" />
                </span>
                <h2 className="text-xl font-bold mr-8">Recepción de Mercadería</h2>

                {/* Tabs */}
                <div className="flex border-b border-transparent gap-1">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'new'
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-transparent text-industrial-400 hover:text-white'}`}
                    >
                        <span className="flex items-center gap-2"><Package className="w-4 h-4" />Nueva Recepción</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'history'
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-transparent text-industrial-400 hover:text-white'}`}
                    >
                        <span className="flex items-center gap-2"><Clock className="w-4 h-4" />Historial</span>
                    </button>
                </div>
            </div>

            {/* ── TAB: Nueva Recepción ── */}
            {activeTab === 'new' && (
                <div className="p-6 space-y-6">
                    {message && (
                        <div className={`p-4 rounded-lg flex items-center border ${message.type === 'success'
                            ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
                            : 'bg-red-900/30 text-red-400 border-red-800'}`}>
                            <span className="font-medium text-sm">{message.text}</span>
                        </div>
                    )}

                    {/* Link to Purchase Request */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Vincular a Solicitud de Compra (Opcional)</label>
                        <select
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                            value={selectedPurchaseRequestId}
                            onChange={e => handlePurchaseRequestChange(e.target.value)}
                        >
                            <option value="">-- Ninguna (Recepción Manual) --</option>
                            {purchaseRequests.map(pr => (
                                <option key={pr.id} value={pr.id}>
                                    {pr.purchaseRequestNumber} - Estado: {pr.status}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Document Number */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">N° Orden Compra / Guía (Global)</label>
                        <input
                            type="text"
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                            value={relatedDocId}
                            onChange={e => setRelatedDocId(e.target.value)}
                            placeholder="Ej: OC-2024-001"
                        />
                    </div>

                    {/* Add Item */}
                    {!selectedPurchaseRequestId && (
                        <div className="p-4 bg-industrial-900/50 border border-industrial-700 rounded-lg space-y-4">
                            <h3 className="text-white font-bold text-sm">Agregar Ítem</h3>

                            <div className="relative">
                                <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Repuesto</label>
                                <input
                                    type="text"
                                    placeholder="Buscar repuesto por código o nombre..."
                                    className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setSelectedPartId(''); setShowDropdown(true); }}
                                    onFocus={() => setShowDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                />
                                {showDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-industrial-800 border border-industrial-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {filteredParts.length > 0 ? filteredParts.map(p => (
                                            <div
                                                key={p.id}
                                                className="px-4 py-2 hover:bg-industrial-700 cursor-pointer text-white text-sm border-b border-industrial-700/50 last:border-0"
                                                onClick={() => { setSelectedPartId(p.id); setSearchTerm(`${p.partNumber} - ${p.name}`); setShowDropdown(false); }}
                                            >
                                                <span className="font-bold text-emerald-400">{p.partNumber}</span> - {p.name}
                                            </div>
                                        )) : (
                                            <div className="px-4 py-2 text-industrial-400 text-sm">No se encontraron resultados</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Cantidad</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-colors font-mono"
                                        value={quantity === 0 ? '' : quantity}
                                        onFocus={e => e.target.select()}
                                        onChange={e => { const val = e.target.value; setQuantity(val === '' ? 0 : parseInt(val)); }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    disabled={!selectedPartId || quantity <= 0}
                                    className="w-full px-4 py-2.5 border border-transparent rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                                >
                                    + Agregar a Lista
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Items Table */}
                    {itemsToReceive.length > 0 && (
                        <div className="border border-industrial-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left text-gray-400">
                                <thead className="text-xs uppercase bg-industrial-900 text-industrial-400">
                                    <tr>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Repuesto</th>
                                        <th className="px-4 py-3 text-right">Cant.</th>
                                        <th className="px-4 py-3 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsToReceive.map((item, index) => (
                                        <tr key={index} className="bg-industrial-800 border-t border-industrial-700 hover:bg-industrial-700/50">
                                            <td className="px-4 py-3 font-mono text-emerald-400">{item.partNumber}</td>
                                            <td className="px-4 py-3 text-white">{item.partName}</td>
                                            <td className="px-4 py-3 text-right font-bold text-white">{item.quantity}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-300 font-bold px-2">✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Notas (Opcional)</label>
                        <textarea
                            rows={2}
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-colors resize-none text-sm"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Observaciones sobre la recepción..."
                        />
                    </div>

                    <div className="pt-4 border-t border-industrial-700">
                        <button
                            onClick={handleReceive}
                            disabled={itemsToReceive.length === 0 || isSubmitting}
                            className="w-full px-4 py-3 border border-transparent rounded-lg shadow-lg shadow-emerald-900/20 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                            {isSubmitting ? 'Registrando Ingreso...' : `Registrar Ingreso (${itemsToReceive.length} ítems)`}
                        </button>
                    </div>
                </div>
            )}

            {/* ── TAB: Historial ── */}
            {activeTab === 'history' && (
                <div className="p-6">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1 w-full">
                            <div className="relative flex-1 w-full max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-industrial-400" />
                                <input
                                    type="text"
                                    className={`w-full bg-industrial-900 border border-industrial-600 rounded-lg pl-10 ${historySearchTerm ? 'pr-10' : 'pr-4'} py-2 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all`}
                                    placeholder="Buscar OC, Notas, o Repuesto..."
                                    value={historySearchTerm}
                                    onChange={(e) => {
                                        setHistorySearchTerm(e.target.value);
                                        setSelectedHistoryPartId('');
                                        setShowHistoryDropdown(true);
                                    }}
                                    onFocus={() => setShowHistoryDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowHistoryDropdown(false), 200)}
                                />
                                {historySearchTerm && (
                                    <button
                                        onClick={() => {
                                            setHistorySearchTerm('');
                                            setSelectedHistoryPartId('');
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-industrial-400 hover:text-white"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}

                                {showHistoryDropdown && historySearchTerm && !selectedHistoryPartId && (
                                    <div className="absolute z-10 w-full mt-1 bg-industrial-800 border border-industrial-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {historyFilteredParts.length > 0 ? (
                                            <>
                                                <div className="px-4 py-2 text-xs font-bold text-industrial-400 bg-industrial-900/50 uppercase">
                                                    Filtrar por Repuesto Específico
                                                </div>
                                                {historyFilteredParts.map(p => (
                                                    <div
                                                        key={p.id}
                                                        className="px-4 py-2 hover:bg-industrial-700 cursor-pointer text-white text-sm border-b border-industrial-700/50 last:border-0"
                                                        onClick={() => {
                                                            setSelectedHistoryPartId(p.id);
                                                            setHistorySearchTerm(`${p.sku || p.partNumber} - ${p.name}`);
                                                            setShowHistoryDropdown(false);
                                                        }}
                                                    >
                                                        <span className="font-bold text-emerald-400">{p.sku || p.partNumber}</span> - {p.name}
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <div className="px-4 py-2 text-industrial-400 text-sm">
                                                Se buscará texto libre en Documentos y Notas...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Date range filters */}
                            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                <div className="flex items-center gap-2">
                                    <span className="text-industrial-400 text-xs font-bold uppercase tracking-wider">Desde:</span>
                                    <input
                                        type="date"
                                        className="bg-industrial-900 border border-industrial-600 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-industrial-400 text-xs font-bold uppercase tracking-wider">Hasta:</span>
                                    <input
                                        type="date"
                                        className="bg-industrial-900 border border-industrial-600 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                    />
                                </div>
                                {(startDate || endDate) && (
                                    <button
                                        onClick={() => { setStartDate(''); setEndDate(''); }}
                                        className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 rounded hover:bg-red-950/20 border border-transparent hover:border-red-900/30 transition-all"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 w-full xl:w-auto justify-end">
                            <button
                                onClick={generatePDF}
                                disabled={receptions.length === 0}
                                className="flex items-center gap-2 px-3 py-2 bg-industrial-700 hover:bg-industrial-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg border border-industrial-600 transition-colors"
                            >
                                <FileDown className="w-4 h-4" /> Exportar PDF
                            </button>
                            <button
                                onClick={() => loadHistory()}
                                className="p-2 bg-industrial-700 hover:bg-industrial-600 text-industrial-400 hover:text-white rounded-lg border border-industrial-600 transition-colors"
                                title="Actualizar"
                            >
                                <Clock className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {loadingHistory ? (
                        <div className="text-center py-12 text-industrial-400 text-sm">Cargando historial...</div>
                    ) : receptions.length === 0 ? (
                        <div className="text-center py-12 text-industrial-500 text-sm">
                            <ArrowDownCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            No hay recepciones registradas todavía.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {currentReceptions.map(rec => (
                                <div key={rec.id} className="border border-industrial-700 rounded-lg overflow-hidden">
                                    {/* Row header */}
                                    <button
                                        className="w-full flex items-center justify-between px-4 py-3 bg-industrial-900/50 hover:bg-industrial-700/40 transition-colors text-left"
                                        onClick={() => toggleExpand(rec.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="p-1 bg-emerald-900/30 rounded border border-emerald-800">
                                                <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                                            </span>
                                            <div>
                                                <p className="text-white text-sm font-semibold flex items-center gap-2">
                                                    {rec.documentNumber
                                                        ? <><span className="font-mono text-emerald-400">{rec.documentNumber}</span></>
                                                        : <span className="text-industrial-400 italic">Sin documento</span>}
                                                    {rec.status && (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                            rec.status.toLowerCase() === 'recibido'
                                                                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                                                                : rec.status.toLowerCase() === 'cancelado'
                                                                    ? 'bg-red-900/30 text-red-400 border border-red-800'
                                                                    : rec.status.toLowerCase() === 'parcial'
                                                                        ? 'bg-blue-900/30 text-blue-400 border border-blue-800'
                                                                        : 'bg-yellow-900/30 text-yellow-500 border border-yellow-800'
                                                        }`}>
                                                            {rec.status}
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-industrial-500 text-xs">
                                                    {new Date(rec.receptionDate).toLocaleString('es', {
                                                        day: '2-digit', month: 'short', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-industrial-400 bg-industrial-800 border border-industrial-700 px-2 py-0.5 rounded-full">
                                                <Package className="w-3 h-3" /> {rec.items.length} ítems
                                            </span>
                                            {expandedId === rec.id ? <ChevronDown className="w-4 h-4 text-industrial-400" /> : <ChevronRight className="w-4 h-4 text-industrial-400" />}
                                        </div>
                                    </button>

                                    {/* Expandable items */}
                                    {expandedId === rec.id && (
                                        <div className="border-t border-industrial-700">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-industrial-900 text-industrial-500 text-xs uppercase">
                                                    <tr>
                                                        <th className="px-4 py-2">Código</th>
                                                        <th className="px-4 py-2">Repuesto</th>
                                                        <th className="px-4 py-2 text-right">Cantidad</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-industrial-700/50">
                                                    {rec.items.map((item, i) => (
                                                        <tr key={i} className="hover:bg-industrial-700/30">
                                                            <td className="px-4 py-2 font-mono text-emerald-400 text-xs">{item.partNumber}</td>
                                                            <td className="px-4 py-2 text-white text-sm">{item.partName}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-white">{item.quantity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {rec.notes && (
                                                <div className="px-4 py-2 border-t border-industrial-700/50 flex items-center gap-2">
                                                    <FileText className="w-3.5 h-3.5 text-industrial-500 flex-shrink-0" />
                                                    <p className="text-industrial-400 text-xs italic">{rec.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {!loadingHistory && receptions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-industrial-700 flex justify-end">
                            <TablePagination
                                totalItems={totalHistory}
                                currentPage={currentPage}
                                itemsPerPage={ITEMS_PER_PAGE}
                                onPageChange={setCurrentPage}
                                isLoading={loadingHistory}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
