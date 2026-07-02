import React from 'react';
import { inventoryService } from '../../services';
import { PartsRequest, SparePart } from '../../types/inventory';
import { Package, Calendar, User, Clock, ArrowLeft, CheckCircle, Truck, XCircle, Save, Edit, Trash2, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PartRequestForm } from './PartRequestForm';
import { PurchaseRequestModal } from './PurchaseRequestModal';
import { UserSupabaseService } from '../../services/UserSupabaseService';
import { UserProfile } from '../../../types';

interface RequestDetailProps {
    request: PartsRequest;
    parts: SparePart[]; // Need parts to resolve names
    onBack: () => void;
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useMasterStore } from '../../stores/useMasterStore';

import { useAuth } from '../../../contexts/AuthContext';

// ... (existing imports)

export const RequestDetail: React.FC<RequestDetailProps> = ({ request, parts, onBack }) => {
    const { hasPermission } = useAuth();
    const canManage = hasPermission('manage_inventory');
    const { technicians, plantSettings, parts: storeParts } = useMasterStore();
    const activeParts = storeParts.length > 0 ? storeParts : parts;

    const [isProcessing, setIsProcessing] = useState(false);
    const currentUser = (useMasterStore.getState() as any).currentUser;
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, number>>({});
    const [localRequest, setLocalRequest] = useState(request);
    const [selectedReceiver, setSelectedReceiver] = useState('');
    const [showReceiverError, setShowReceiverError] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [systemUsers, setSystemUsers] = useState<UserProfile[]>([]);
    const [receiverSearch, setReceiverSearch] = useState('');
    const [isReceiverDropdownOpen, setIsReceiverDropdownOpen] = useState(false);

    // Load system users on mount so we can resolve names in the "Entregado a" field
    useEffect(() => {
        UserSupabaseService.getUsers()
            .then(users => setSystemUsers(users))
            .catch(err => console.error('Error loading users:', err));
    }, []);

    const handleStartProcessing = () => {
        const initialQuantities: Record<string, number> = {};
        localRequest.items.forEach(item => {
            // Default to remaining quantity
            initialQuantities[item.partId] = Math.max(0, item.quantityRequested - item.quantityDelivered);
        });
        setDeliveryQuantities(initialQuantities);
        setIsProcessing(true);
    };

    const filteredUsers = systemUsers.filter(u =>
        !receiverSearch ||
        (u.full_name || '').toLowerCase().includes(receiverSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(receiverSearch.toLowerCase())
    );

    const selectedReceiverUser = systemUsers.find(u => u.id === selectedReceiver);

    const handleQuantityChange = (partId: string, value: number) => {
        const part = activeParts.find(p => p.id === partId);
        const item = localRequest.items.find(i => i.partId === partId);
        
        if (!item || !part) return;

        // Ensure not negative
        const qty = Math.max(0, value);
        
        setDeliveryQuantities(prev => ({
            ...prev,
            [partId]: qty
        }));
    };

    const handleConfirmDelivery = async () => {
        if (!selectedReceiver) {
            setShowReceiverError(true);
            return;
        }

        // Validation before processing
        const errors: string[] = [];
        Object.entries(deliveryQuantities).forEach(([partId, rawQty]) => {
            const qty = Number(rawQty);
            if (qty <= 0) return;

            const part = activeParts.find(p => p.id === partId);
            const item = localRequest.items.find(i => i.partId === partId);

            if (!part || !item) return;

            const pending = item.quantityRequested - item.quantityDelivered;
            
            if (qty > part.currentStock) {
                errors.push(`Stock insuficiente para ${part.name} (Disponible: ${part.currentStock})`);
            }
            if (qty > pending) {
                errors.push(`La cantidad de ${part.name} excede lo pendiente (${pending})`);
            }
        });

        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }

        try {
            const itemsList = Object.entries(deliveryQuantities)
                .filter(([_, qty]) => Number(qty) > 0)
                .map(([partId, qty]) => ({
                    partId,
                    quantity: Number(qty)
                }));

            if (itemsList.length === 0) {
                alert('Ingrese al menos una cantidad válida para entregar.');
                return;
            }

            const updatedRequest = await inventoryService.deliverParts(localRequest.id, itemsList, selectedReceiver);

            // Refresh global state so inventory counts update
            await useMasterStore.getState().fetchInventoryData();

            setLocalRequest(updatedRequest);
            setIsProcessing(false);
            setSelectedReceiver(''); // Reset
        } catch (error) {
            console.error('Error delivering parts:', error);
            alert('Error al procesar la entrega. Verifique el stock.');
        }
    };

    const handleCloseRequest = async () => {
        if (!confirm('¿Está seguro de cerrar esta solicitud?')) return;
        try {
            const updatedRequest = await inventoryService.closeRequest(localRequest.id);
            setLocalRequest(updatedRequest);
        } catch (error) {
            console.error('Error closing request:', error);
        }
    };

    const handleDeleteRequest = async () => {
        if (!confirm('¿Está seguro de eliminar esta solicitud permanentemente?')) return;
        try {
            await inventoryService.deleteRequest(localRequest.id);
            onBack();
        } catch (error) {
            console.error('Error deleting request:', error);
            alert('Error al eliminar la solicitud.');
        }
    };

    const handleEditSuccess = () => {
        // Reload request data
        inventoryService.getRequestById(localRequest.id).then(updated => {
            if (updated) {
                setLocalRequest(updated);
                setIsEditing(false);
            }
        }).catch(err => console.error('Error reloading request:', err));
    };

    const handleGenerateDetailsPDF = () => {
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
        doc.text('Detalles de la Solicitud de Repuestos', 14, 35);

        doc.setFontSize(10);
        doc.text(`Solicitud N°: ${localRequest.requestNumber}`, 14, 45);
        doc.text(`Fecha Creación: ${new Date(localRequest.createdDate).toLocaleString()}`, 14, 51);
        doc.text(`Solicitante: ${localRequest.technicianId}`, 14, 57);
        const priorityMap: Record<string, string> = {
            'NORMAL': 'Normal',
            'HIGH': 'Alta',
            'EMERGENCY': 'Urgente'
        };
        const priorityText = priorityMap[localRequest.priority] || localRequest.priority;
        doc.text(`Prioridad: ${priorityText}`, 14, 63);

        const deliveredToName = localRequest.deliveredTo
            ? (systemUsers.find(u => u.id === localRequest.deliveredTo)?.full_name
                || technicians.find(t => t.id === localRequest.deliveredTo)?.name
                || localRequest.deliveredTo)
            : '-';
        doc.text(`Entregado a: ${deliveredToName}`, 14, 69);

        const statusMap: Record<string, string> = {
            'OPEN': 'Abierto',
            'PENDING_STOCK': 'Stock Pendiente',
            'PARTIAL': 'Entrega Parcial',
            'CLOSED': 'Cerrado'
        };
        const statusText = statusMap[localRequest.status] || localRequest.status;
        doc.text(`Estado: ${statusText}`, 14, 75);

        const tableBody = localRequest.items.map(item => {
            const part = activeParts.find(p => p.id === item.partId);
            return [
                part?.partNumber || '-',
                part?.name || item.partId,
                item.quantityRequested,
                item.quantityDelivered,
                item.quantityDelivered >= item.quantityRequested ? 'Completado' : 'Pendiente/Parcial'
            ];
        });

        autoTable(doc, {
            startY: 85,
            head: [['Código', 'Repuesto', 'Solicitado', 'Entregado', 'Estado']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            margin: { left: 14, right: 14 }
        });

        // Signatures
        // @ts-ignore
        let yPos = doc.lastAutoTable.finalY + 40;

        doc.setLineWidth(0.5);
        doc.line(14, yPos, 80, yPos);
        doc.line(120, yPos, 186, yPos);

        doc.setFontSize(8);
        doc.text('Firma Solicitante', 14, yPos + 5);
        doc.text('Firma Almacén / Entrega', 120, yPos + 5);

        doc.save(`solicitud_detalle_${localRequest.requestNumber}.pdf`);
    };

    const getPartName = (partId: string) => {
        return activeParts.find(p => p.id === partId)?.name || partId;
    };

    const getPartNumber = (partId: string) => {
        return activeParts.find(p => p.id === partId)?.partNumber || '';
    };

    if (isEditing) {
        return (
            <div className="h-full">
                <PartRequestForm
                    initialData={localRequest}
                    onCancel={() => setIsEditing(false)}
                    onSuccess={handleEditSuccess}
                />
            </div>
        );
    }

    return (
        <div className="bg-industrial-800 rounded-lg shadow-xl border border-industrial-700 h-full flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-industrial-700 flex justify-between items-start bg-industrial-900/50">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center text-industrial-400 hover:text-white mb-4 transition-colors text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Volver a la lista
                    </button>

                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        {localRequest.requestNumber}
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${localRequest.status === 'OPEN' ? 'bg-blue-900/30 text-blue-400 border-blue-800' :
                            localRequest.status === 'PENDING_STOCK' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800' :
                                localRequest.status === 'PARTIAL' ? 'bg-orange-900/30 text-orange-400 border-orange-800' :
                                    localRequest.status === 'CLOSED' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' :
                                        'bg-gray-800 text-gray-400'
                            }`}>
                            {localRequest.status === 'PARTIAL' ? 'Entrega Parcial' :
                                localRequest.status === 'PENDING_STOCK' ? 'Stock Pendiente' :
                                    localRequest.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                        </span>
                    </h2>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    {canManage && !isProcessing && !isEditing && localRequest.status !== 'CLOSED' && (
                        <>
                            {(localRequest.status === 'OPEN' || localRequest.status === 'PENDING_STOCK' || localRequest.status === 'PARTIAL') && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center px-4 py-2 bg-industrial-800 border border-industrial-600 hover:bg-industrial-700 text-white rounded-lg font-bold text-sm transition-colors"
                                >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Editar
                                </button>
                            )}
                            <button
                                onClick={handleStartProcessing}
                                className="flex items-center px-4 py-2 bg-industrial-accent hover:bg-blue-600 text-white rounded-lg font-bold text-sm transition-colors shadow-lg"
                            >
                                <Truck className="w-4 h-4 mr-2" />
                                Procesar Entrega
                            </button>
                            <button
                                onClick={handleCloseRequest}
                                className="flex items-center px-4 py-2 bg-industrial-800 border border-industrial-600 hover:bg-red-900/50 hover:border-red-700 text-industrial-300 hover:text-red-400 rounded-lg font-bold text-sm transition-all"
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cerrar Solicitud
                            </button>
                        </>
                    )}

                    {canManage && !isProcessing && !isEditing && (localRequest.status === 'PENDING_STOCK' || localRequest.status === 'PARTIAL' || localRequest.items.some(i => i.quantityDelivered < i.quantityRequested)) && (
                        <button
                            onClick={() => setIsPurchaseModalOpen(true)}
                            className={`flex items-center px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg ${(localRequest.purchaseHistory && localRequest.purchaseHistory.length > 0)
                                ? 'bg-orange-800 text-orange-200 border border-orange-600 hover:bg-orange-700'
                                : 'bg-orange-600 hover:bg-orange-700 text-white'
                                }`}
                        >
                            <Package className="w-4 h-4 mr-2" />
                            {(localRequest.purchaseHistory && localRequest.purchaseHistory.length > 0) ? 'Repuestos Solicitados' : 'Solicitar Repuestos'}
                        </button>
                    )}
                    {canManage && !isProcessing && !isEditing && (
                        localRequest.status === 'CLOSED' ? (
                            <button
                                onClick={handleGenerateDetailsPDF}
                                className="flex items-center px-4 py-2 bg-industrial-800 border border-industrial-600 hover:bg-industrial-700 text-industrial-300 hover:text-white rounded-lg font-bold text-sm transition-all"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Generar Reporte
                            </button>
                        ) : (
                            <button
                                onClick={handleDeleteRequest}
                                className="flex items-center px-4 py-2 bg-red-900/30 border border-red-800 hover:bg-red-900/50 text-red-400 rounded-lg font-bold text-sm transition-all"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                            </button>
                        )
                    )}

                    {canManage && isProcessing && (
                        <>
                            <button
                                onClick={handleConfirmDelivery}
                                className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition-colors shadow-lg"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Confirmar Entrega
                            </button>
                            <button
                                onClick={() => setIsProcessing(false)}
                                className="flex items-center px-4 py-2 bg-industrial-800 border border-industrial-600 hover:bg-industrial-700 text-white rounded-lg font-bold text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Info Cards */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-industrial-900/50 p-4 rounded-lg border border-industrial-700">
                        <h3 className="text-xs font-bold text-industrial-500 uppercase tracking-wider mb-4">Información General</h3>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-industrial-300">
                                <Calendar className="w-4 h-4 text-industrial-500" />
                                <div>
                                    <p className="text-xs text-industrial-500">Fecha Creación</p>
                                    <p className="font-medium text-white">{new Date(localRequest.createdDate).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-industrial-300">
                                <User className="w-4 h-4 text-industrial-500" />
                                <div className="flex-1">
                                    <p className="text-xs text-industrial-500">Solicitante</p>
                                    <p className="font-medium text-white truncate" title={localRequest.technicianId}>{localRequest.technicianId}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-industrial-300">
                                <Clock className="w-4 h-4 text-industrial-500" />
                                <div>
                                    <p className="text-xs text-industrial-500">Prioridad</p>
                                    <p className={`font-medium ${localRequest.priority === 'EMERGENCY' ? 'text-red-400' : 'text-white'}`}>
                                        {localRequest.priority === 'EMERGENCY' ? 'Urgente' :
                                            localRequest.priority === 'HIGH' ? 'Alta' : 'Normal'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-industrial-300">
                                <User className="w-4 h-4 text-industrial-500" />
                                <div className="flex-1">
                                    <p className="text-xs text-industrial-500">Entregado a</p>
                                    <p className="font-medium text-white truncate">
                                        {localRequest.deliveredTo
                                            ? (systemUsers.find(u => u.id === localRequest.deliveredTo)?.full_name
                                                || technicians.find(t => t.id === localRequest.deliveredTo)?.name
                                                || localRequest.deliveredTo)
                                            : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items List */}
                <div className="lg:col-span-2">
                    <div className="bg-industrial-900/50 rounded-lg border border-industrial-700 overflow-hidden">
                        <div className="p-4 border-b border-industrial-700">
                            <h3 className="text-xs font-bold text-industrial-500 uppercase tracking-wider">Items Solicitados</h3>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-industrial-900 text-industrial-400 text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-3">Repuesto</th>
                                    <th className="px-6 py-3 text-center">Solicitado</th>
                                    <th className="px-6 py-3 text-center">Entregado</th>
                                    <th className="px-6 py-3 text-center">Stock Actual</th>
                                    {isProcessing && <th className="px-6 py-3 text-center w-32">A Entregar</th>}
                                    <th className="px-6 py-3 text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-industrial-700">
                                {localRequest.items.map((item, idx) => {
                                    const part = activeParts.find(p => p.id === item.partId);
                                    const isFullyDelivered = item.quantityDelivered >= item.quantityRequested;

                                    return (
                                        <tr key={idx} className="hover:bg-industrial-800/50">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-white font-medium">{part?.name || item.partId}</p>
                                                    <p className="text-industrial-500 text-xs font-mono">{part?.partNumber}</p>
                                                    {item.usageLocation && (
                                                        <p className="text-industrial-400 text-xs mt-1">Uso: {item.usageLocation}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-white font-mono">
                                                {item.quantityRequested}
                                            </td>
                                            <td className="px-6 py-4 text-center text-industrial-300 font-mono">
                                                {item.quantityDelivered}
                                            </td>
                                            <td className="px-6 py-4 text-center text-white font-mono">
                                                <span className={`${part && part.currentStock <= part.minStock ? 'text-red-400 font-bold' : ''}`}>
                                                    {part?.currentStock ?? '-'}
                                                </span>
                                            </td>
                                            {isProcessing && (
                                                <td className="px-6 py-4">
                                                    {(() => {
                                                        if (!part) return null;
                                                        const pending = item.quantityRequested - item.quantityDelivered;
                                                        const maxAllowed = Math.min(part.currentStock, pending);
                                                        const currentInput = deliveryQuantities[item.partId] || 0;
                                                        const hasStockError = currentInput > part.currentStock;
                                                        const hasRequestError = currentInput > pending;

                                                        return (
                                                            <div className="space-y-1">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={maxAllowed}
                                                                    className={`w-full bg-industrial-900 border rounded px-2 py-1 text-white text-center font-mono outline-none focus:ring-1 ${hasStockError || hasRequestError ? 'border-red-500 focus:ring-red-500' : 'border-industrial-600 focus:ring-industrial-accent'}`}
                                                                    value={currentInput || ''}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleQuantityChange(item.partId, parseInt(e.target.value) || 0)}
                                                                />
                                                                <p className="text-[10px] text-industrial-500 text-center">
                                                                    Límite: <span className="text-industrial-300 font-bold">{maxAllowed}</span>
                                                                </p>
                                                                {hasStockError && (
                                                                    <p className="text-[10px] text-red-400 leading-tight text-center">Stock insuficiente</p>
                                                                )}
                                                                {!hasStockError && hasRequestError && (
                                                                    <p className="text-[10px] text-orange-400 leading-tight text-center">Supera lo solicitado</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-right">
                                                {isFullyDelivered ? (
                                                    <span className="inline-flex items-center text-emerald-400 text-xs font-bold">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Completado
                                                    </span>
                                                ) : (
                                                    <span className="text-yellow-400 text-xs font-bold">
                                                        {item.quantityDelivered > 0 ? 'Parcial' : 'Pendiente'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {isProcessing && (
                        <div className="mt-4 bg-industrial-900/50 rounded-lg p-4 border border-industrial-700">
                            <label className="block text-xs font-bold text-industrial-500 uppercase tracking-wider mb-2">Entregado a: <span className="text-red-400">*</span></label>
                            <div className={`relative w-full md:w-1/2`}>
                                {/* Search Input */}
                                <div className={`flex items-center bg-industrial-800 border rounded-lg px-3 py-2 transition-colors ${showReceiverError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-industrial-600 focus-within:ring-2 focus-within:ring-blue-500'}`}>
                                    <Search className="w-4 h-4 text-industrial-500 mr-2 flex-shrink-0" />
                                    <input
                                        type="text"
                                        className="bg-transparent flex-1 text-white outline-none placeholder-industrial-500 text-sm"
                                        placeholder={selectedReceiverUser ? selectedReceiverUser.full_name : 'Buscar usuario...'}
                                        value={receiverSearch}
                                        onFocus={() => setIsReceiverDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setIsReceiverDropdownOpen(false), 200)}
                                        onChange={e => {
                                            setReceiverSearch(e.target.value);
                                            setIsReceiverDropdownOpen(true);
                                            if (selectedReceiver) {
                                                setSelectedReceiver('');
                                                setShowReceiverError(false);
                                            }
                                        }}
                                    />
                                    {selectedReceiverUser && (
                                        <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full ml-1 flex-shrink-0">
                                            {selectedReceiverUser.full_name}
                                        </span>
                                    )}
                                </div>

                                {/* Dropdown */}
                                {isReceiverDropdownOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-industrial-800 border border-industrial-600 rounded-lg shadow-2xl max-h-56 overflow-y-auto">
                                        {filteredUsers.length > 0 ? (
                                            <ul className="py-1">
                                                {filteredUsers.map(user => (
                                                    <li
                                                        key={user.id}
                                                        className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 hover:bg-industrial-700 border-b border-industrial-700/50 last:border-0 ${selectedReceiver === user.id ? 'bg-blue-900/30' : ''}`}
                                                        onMouseDown={e => {
                                                            e.preventDefault();
                                                            setSelectedReceiver(user.id);
                                                            setReceiverSearch('');
                                                            setIsReceiverDropdownOpen(false);
                                                            setShowReceiverError(false);
                                                        }}
                                                    >
                                                        <div className="w-7 h-7 rounded-full bg-industrial-700 border border-industrial-600 flex items-center justify-center flex-shrink-0">
                                                            <User className="w-3 h-3 text-industrial-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white text-sm font-medium truncate">{user.full_name || 'Sin nombre'}</p>
                                                            <p className="text-industrial-500 text-xs truncate">{user.email}</p>
                                                        </div>
                                                        {selectedReceiver === user.id && (
                                                            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="px-4 py-3 text-industrial-500 text-sm italic">
                                                {systemUsers.length === 0 ? 'Cargando usuarios...' : 'No se encontraron usuarios.'}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {showReceiverError && (
                                <p className="text-xs text-red-400 mt-1 font-medium">Debe seleccionar quién recibe el repuesto.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {
                isPurchaseModalOpen && (
                    <PurchaseRequestModal
                        request={localRequest}
                        parts={activeParts}
                        onClose={() => setIsPurchaseModalOpen(false)}
                        onSuccess={(updated) => {
                            setLocalRequest(updated);
                            // Keep modal open or close? User might want to see it became history.
                            // But usually we close modals on success.
                            // The modal component handles saving but not closing automatically in the code I wrote (I wrote onSuccess call then optional close).
                            // Let's verify modal code. Ah, I see in modal I didn't close it.
                            // Wait, in handleGenerateRequest I put "onSuccess(updatedRequest)".
                            // I will close it here for now, or let the user close it.
                            setIsPurchaseModalOpen(false); // Close on success
                        }}
                    />
                )
            }
        </div >
    );
};
