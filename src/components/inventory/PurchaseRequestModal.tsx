
import React, { useState, useEffect } from 'react';
import { PartsRequest, SparePart, PurchaseRequest } from '../../types/inventory';
import { X, Download, AlertCircle, ShoppingCart, Trash2, History, FileText, ChevronRight, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useMasterStore } from '../../stores/useMasterStore';
import { inventoryService } from '../../services';

interface PurchaseRequestModalProps {
    request: PartsRequest;
    parts: SparePart[];
    onClose: () => void;
    onSuccess: (updatedRequest: PartsRequest) => void;
}

export const PurchaseRequestModal: React.FC<PurchaseRequestModalProps> = ({ request, parts, onClose, onSuccess }) => {
    const { plantSettings } = useMasterStore();
    const currentUser = (useMasterStore.getState() as any).currentUser;
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
    // Track items that were explicitly removed by the user to prevent re-adding them automatically
    const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());

    const [viewMode, setViewMode] = useState<'CREATE' | 'HISTORY'>('CREATE');
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<PurchaseRequest | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize with pending items
    useEffect(() => {
        if (viewMode === 'CREATE') {
            const initialSelections: Record<string, number> = {};
            request.items.forEach(item => {
                if (removedItems.has(item.partId)) return;

                const part = parts.find(p => p.id === item.partId);
                const pendingQty = Math.max(0, item.quantityRequested - item.quantityDelivered);

                // Suggest quantity: Pending amount or Amount needed to reach min stock + pending
                if (pendingQty > 0 || (part && part.currentStock < part.minStock)) {
                    initialSelections[item.partId] = pendingQty;
                }
            });
            setSelectedItems(prev => ({ ...initialSelections, ...prev }));
        }
    }, [request, parts, viewMode, removedItems]);

    // If history exists and we open the modal, showing history first might be better if the user clicked "Repuestos Solicitados"
    // But currently the button logic handles the text, the modal can default to CREATE or HISTORY based on props?
    // For now, let's keep default CREATE, but if there are no pending items, maybe switch? 
    // Actually, "Repuestos Solicitados" implies viewing history. Let's handle that by checking if we have pending items.

    useEffect(() => {
        const hasPending = request.items.some(i => i.quantityDelivered < i.quantityRequested);
        if (!hasPending && request.purchaseHistory && request.purchaseHistory.length > 0 && viewMode === 'CREATE') {
            // If nothing pending but we have history, show history by default?
            // Maybe better to let user choose.
        }
    }, []);

    const handleQuantityChange = (partId: string, qty: number) => {
        setSelectedItems(prev => ({
            ...prev,
            [partId]: qty
        }));
    };

    const handleRemoveItem = (partId: string) => {
        const newSelected = { ...selectedItems };
        delete newSelected[partId];
        setSelectedItems(newSelected);
        setRemovedItems(prev => new Set(prev).add(partId));
    };

    const generatePDFDocument = (itemsToPurchase: any[], requestNumber: string, date: string, technician: string, docTitle: string = 'Solicitud de Compra de Repuestos') => {
        const doc = new jsPDF();

        // Logo & Header
        if (plantSettings.logoUrl) {
            try {
                const imgProps = doc.getImageProperties(plantSettings.logoUrl);
                const width = 30;
                const height = (imgProps.height * width) / imgProps.width;
                doc.addImage(plantSettings.logoUrl, 'PNG', 14, 10, width, height);
            } catch (e) {
                console.warn('Could not add logo', e);
            }
        }

        doc.setFontSize(16);
        doc.text(docTitle, 14, 35);

        doc.setFontSize(10);
        doc.text(`Fecha: ${date}`, 14, 42);
        doc.text(`Solicitud Origen: ${requestNumber}`, 14, 48);
        doc.text(`Solicitante Original: ${technician}`, 14, 54);

        const tableBody = itemsToPurchase.map(item => [
            item.code,
            item.name,
            item.currentStock,
            item.pendingForRequest,
            item.qtyRequested
        ]);

        autoTable(doc, {
            startY: 60,
            head: [['Código', 'Repuesto', 'Stock Actual', 'Pendiente Entrega', 'A Comprar']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [230, 126, 34], fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            margin: { left: 14, right: 14 }
        });

        // Add footer space for signatures
        // @ts-ignore
        let yPos = doc.lastAutoTable.finalY + 30;

        doc.setLineWidth(0.5);
        doc.line(14, yPos, 80, yPos);
        doc.line(120, yPos, 186, yPos);

        doc.setFontSize(8);
        doc.text('Solicitado Por', 14, yPos + 5);
        doc.text('Autorizado Por', 120, yPos + 5);

        return doc;
    };

    const handleGenerateRequest = async () => {
        const itemsList = Object.entries(selectedItems)
            .filter(([_, qty]) => Number(qty) > 0)
            .map(([partId, qty]) => {
                const part = parts.find(p => p.id === partId);
                const reqItem = request.items.find(i => i.partId === partId);
                return {
                    partId,
                    code: part?.partNumber || '-',
                    name: part?.name || partId,
                    currentStock: part?.currentStock || 0,
                    qtyRequested: Number(qty),
                    pendingForRequest: reqItem ? Math.max(0, reqItem.quantityRequested - reqItem.quantityDelivered) : 0
                };
            });

        if (itemsList.length === 0) {
            alert('No hay items seleccionados para compra.');
            return;
        }

        const dateStr = new Date().toLocaleDateString();
        const purchaseReqNumber = `SC-REQ-${request.requestNumber}-${(request.purchaseHistory?.length || 0) + 1}`;

        // Generate PDF
        const doc = generatePDFDocument(itemsList, request.requestNumber, dateStr, request.technicianId);
        doc.save(`${purchaseReqNumber}.pdf`);

        setIsSaving(true);
        // Save History
        try {
            const newPurchaseRequest: PurchaseRequest = {
                id: crypto.randomUUID(),
                requestDate: new Date().toISOString(),
                requestedBy: currentUser?.id || 'System',
                purchaseRequestNumber: purchaseReqNumber,
                items: itemsList.map(i => ({ partId: i.partId, quantity: i.qtyRequested }))
            };

            const updatedRequest = await inventoryService.savePurchaseRequest(request.id, newPurchaseRequest);
            onSuccess(updatedRequest);
            // Optionally close or switch mode?
            // If we want to allow staying to see it turned into history:
            // setViewMode('HISTORY'); 
            // onClose(); // Or close directly
        } catch (error) {
            console.error('Error saving purchase request:', error);
            // El usuario solicitó eliminar la ventana de confirmación (alert) al guardar el historial. 
            // Continuamos sin interrumpir, el PDF ya se descargó.
            onSuccess(request);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadHistoryPDF = (historyItem: PurchaseRequest) => {
        const itemsList = historyItem.items.map(item => {
            const part = parts.find(p => p.id === item.partId);
            const reqItem = request.items.find(i => i.partId === item.partId);
            return {
                code: part?.partNumber || '-',
                name: part?.name || item.partId,
                currentStock: part?.currentStock || 0,
                qtyRequested: item.quantity,
                pendingForRequest: reqItem ? Math.max(0, reqItem.quantityRequested - reqItem.quantityDelivered) : 0
            };
        });

        const dateStr = new Date(historyItem.requestDate).toLocaleDateString();
        const doc = generatePDFDocument(itemsList, request.requestNumber, dateStr, request.technicianId, 'Solicitud de Compra (Histórico)');
        doc.save(`${historyItem.purchaseRequestNumber}.pdf`);
    };

    const activeItems = Object.keys(selectedItems);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-industrial-800 rounded-lg shadow-2xl border border-industrial-600 w-full max-w-4xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-industrial-700 flex justify-between items-center bg-industrial-900/50 rounded-t-lg">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-orange-500" />
                        Gestión de Compras
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'CREATE' ? 'HISTORY' : 'CREATE')}
                            className="text-industrial-400 hover:text-white px-3 py-1 bg-industrial-700/50 rounded flex items-center gap-2 text-sm"
                        >
                            <History className="w-4 h-4" />
                            {viewMode === 'CREATE' ? 'Ver Historial' : 'Nueva Solicitud'}
                        </button>
                        <button onClick={onClose} className="text-industrial-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar / Main Content Switch based on mode */}

                    {viewMode === 'HISTORY' && (
                        <div className="w-full p-6 flex flex-col">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <History className="w-5 h-5 text-industrial-400" />
                                Historial de Solicitudes
                            </h3>

                            {(!request.purchaseHistory || request.purchaseHistory.length === 0) ? (
                                <div className="text-center text-industrial-500 py-10">
                                    No hay solicitudes de compra previas.
                                </div>
                            ) : (
                                <div className="space-y-3 overflow-y-auto">
                                    {request.purchaseHistory.slice().reverse().map((hist, idx) => (
                                        <div key={hist.id} className="bg-industrial-900/50 border border-industrial-700 rounded-lg p-4 flex justify-between items-center">
                                            <div>
                                                <p className="text-white font-bold text-sm">{hist.purchaseRequestNumber}</p>
                                                <p className="text-industrial-400 text-xs">Fecha: {new Date(hist.requestDate).toLocaleString()}</p>
                                                <p className="text-industrial-500 text-xs mt-1">{hist.items.length} items solicitados</p>
                                            </div>
                                            <button
                                                onClick={() => handleDownloadHistoryPDF(hist)}
                                                className="bg-industrial-800 hover:bg-industrial-700 text-industrial-300 p-2 rounded-lg border border-industrial-600 transition-colors"
                                                title="Descargar PDF"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {viewMode === 'CREATE' && (
                        <div className="w-full p-6 flex flex-col overflow-hidden">
                            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6 flex items-start gap-3 flex-shrink-0">
                                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-blue-200">
                                    Seleccione los items para solicitar a compras. Puede eliminar items de la lista si no desea solicitarlos.
                                </p>
                            </div>

                            {activeItems.length === 0 ? (
                                <div className="text-center py-10 text-industrial-500 bg-industrial-900/30 rounded-lg border border-industrial-700 border-dashed">
                                    <p>No hay items seleccionados.</p>
                                    <button
                                        onClick={() => {
                                            setRemovedItems(new Set());
                                            // Trigger re-calc
                                        }}
                                        className="text-industrial-400 text-xs underline mt-2 hover:text-industrial-300"
                                    >
                                        Restaurar items eliminados
                                    </button>
                                </div>
                            ) : (
                                <div className="overflow-y-auto flex-1">
                                    <table className="w-full text-left">
                                        <thead className="bg-industrial-900 text-industrial-400 text-xs font-semibold uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3">Repuesto</th>
                                                <th className="px-4 py-3 text-center">Stock</th>
                                                <th className="px-4 py-3 text-center">Pendiente</th>
                                                <th className="px-4 py-3 text-center w-32">Solicitar</th>
                                                <th className="px-4 py-3 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-industrial-700">
                                            {activeItems.map(partId => {
                                                const item = request.items.find(i => i.partId === partId);
                                                const part = parts.find(p => p.id === partId);
                                                const pending = item ? Math.max(0, item.quantityRequested - item.quantityDelivered) : 0;

                                                return (
                                                    <tr key={partId} className="hover:bg-industrial-700/30">
                                                        <td className="px-4 py-3 text-white">
                                                            <div className="font-medium">{part?.name || partId}</div>
                                                            <div className="text-xs text-industrial-500">{part?.partNumber}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-white font-mono">
                                                            <span className={part && part.currentStock <= part.minStock ? 'text-red-400 font-bold' : ''}>
                                                                {part?.currentStock ?? '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-industrial-300 font-mono">
                                                            {pending}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className="w-full bg-industrial-900 border border-industrial-600 rounded px-2 py-1 text-white text-center font-mono focus:ring-1 focus:ring-orange-500 outline-none"
                                                                value={selectedItems[partId] || ''}
                                                                onFocus={e => e.target.select()}
                                                                onChange={(e) => {
                                                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                                    handleQuantityChange(partId, isNaN(val) ? 0 : val);
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                onClick={() => handleRemoveItem(partId)}
                                                                className="text-industrial-500 hover:text-red-400 transition-colors"
                                                                title="No solicitar"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-industrial-700 bg-industrial-900/30 rounded-b-lg flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 bg-industrial-800 border border-industrial-600 hover:bg-industrial-700 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cerrar
                    </button>
                    {viewMode === 'CREATE' && (
                        <button
                            onClick={handleGenerateRequest}
                            disabled={activeItems.length === 0 || isSaving}
                            className={`flex items-center px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg ${activeItems.length === 0 || isSaving
                                ? 'bg-industrial-700 text-industrial-500 cursor-not-allowed opacity-50'
                                : 'bg-orange-600 hover:bg-orange-700 text-white'
                                }`}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                            {isSaving ? 'Guardando...' : 'Generar Solicitud'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
