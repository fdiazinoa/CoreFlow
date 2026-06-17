import React, { useState } from 'react';
import { SparePart } from '../../types/inventory';
import { X, Package, MapPin, AlertTriangle, Activity, Edit } from 'lucide-react';
import { PartCreationForm } from './PartCreationForm';
import { inventoryService } from '../../services';

import { useAuth } from '../../../contexts/AuthContext';

// Service initialized in index.ts

interface SparePartDetailProps {
    part: SparePart;
    onClose: () => void;
}

export const SparePartDetail: React.FC<SparePartDetailProps> = ({ part, onClose }) => {
    const { hasPermission } = useAuth();
    const canManage = hasPermission('manage_inventory');
    const [isEditing, setIsEditing] = useState(false);
    const [currentPart, setCurrentPart] = useState(part);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [purchaseQuantity, setPurchaseQuantity] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [purchaseMessage, setPurchaseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleConfirmPurchase = async () => {
        setIsSubmitting(true);
        setPurchaseMessage(null);
        try {
            await inventoryService.createDirectPurchaseRequest([
                { partId: currentPart.id, quantity: purchaseQuantity }
            ]);
            setPurchaseMessage({ type: 'success', text: '✅ Solicitud creada exitosamente.' });
            setTimeout(() => {
                setShowPurchaseModal(false);
                setPurchaseMessage(null);
                setPurchaseQuantity(1); // reset
            }, 6000);
        } catch (error) {
            console.error('Error creating purchase request:', error);
            setPurchaseMessage({ type: 'error', text: '❌ Error al crear la solicitud de compra.' });
            setIsSubmitting(false);
        }
    };

    const handleEditSuccess = (updatedPart?: SparePart) => {
        setIsEditing(false);
        if (updatedPart) {
            // Use the RPC return value directly — avoids re-fetching via PostgREST
            setCurrentPart(updatedPart);
        } else {
            // Fallback: reload from server
            inventoryService.getAllParts(1, 1000).then(res => {
                const updated = res.data.find(p => p.id === currentPart.id);
                if (updated) setCurrentPart(updated);
            });
        }
    };

    if (isEditing) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-industrial-800 rounded-xl shadow-2xl border border-industrial-600 w-full max-w-4xl overflow-y-auto max-h-[95vh] animate-slide-up">
                    <PartCreationForm
                        initialData={currentPart}
                        onCancel={() => setIsEditing(false)}
                        onSuccess={handleEditSuccess}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-industrial-800 rounded-xl shadow-2xl border border-industrial-600 w-full max-w-5xl overflow-y-auto max-h-[95vh] animate-slide-up">

                {/* Header */}
                <div className="bg-industrial-900 px-6 py-4 border-b border-industrial-700 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="p-1.5 bg-blue-900/30 rounded border border-blue-800">
                                <Package className="w-5 h-5 text-blue-500" />
                            </span>
                            <h2 className="text-xl font-bold text-white">{currentPart.name}</h2>
                        </div>
                        <p className="text-industrial-400 font-mono text-sm ml-11">{currentPart.partNumber}</p>
                    </div>
                    <div className="flex gap-2">
                        {canManage && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-industrial-400 hover:text-white hover:bg-industrial-700 p-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Edit className="w-5 h-5" />
                                <span className="text-sm font-bold">Editar</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-industrial-400 hover:text-white hover:bg-industrial-700 p-2 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Stats Grid 1 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-industrial-900/50 p-3 rounded-lg border border-industrial-700">
                            <p className="text-[10px] text-industrial-500 uppercase font-bold mb-1 tracking-wider">Stock Actual</p>
                            <p className={`text-xl font-bold ${currentPart.currentStock <= currentPart.minStock ? 'text-red-400' : 'text-emerald-400'
                                }`}>
                                {currentPart.currentStock} <span className="text-xs text-industrial-600 font-normal">{currentPart.unitOfMeasure}</span>
                            </p>
                        </div>

                        <div className="bg-industrial-900/50 p-3 rounded-lg border border-industrial-700">
                            <p className="text-[10px] text-industrial-500 uppercase font-bold mb-1 tracking-wider">Costo Unitario</p>
                            <p className="text-xl font-bold text-white">
                                RD${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(currentPart.cost)}
                            </p>
                        </div>

                        <div className="bg-industrial-900/50 p-3 rounded-lg border border-industrial-700">
                            <p className="text-[10px] text-industrial-500 uppercase font-bold mb-1 tracking-wider">Tramo</p>
                            <div className="flex items-center gap-1.5 text-white text-xl font-bold">
                                <MapPin className="w-4 h-4 text-industrial-500" />
                                {currentPart.location}
                            </div>
                        </div>

                        <div className="bg-industrial-900/50 p-3 rounded-lg border border-industrial-700">
                            <p className="text-[10px] text-industrial-500 uppercase font-bold mb-1 tracking-wider">Ubicación</p>
                            <div className="flex items-center gap-1.5 text-white text-xl font-bold">
                                <MapPin className="w-4 h-4 text-blue-400" />
                                {currentPart.subLocation || '-'}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid 2 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-industrial-900/50 p-3 rounded-lg border border-industrial-700">
                            <p className="text-[10px] text-industrial-500 uppercase font-bold mb-1 tracking-wider">Empresa</p>
                            <p className="text-white text-xl font-bold truncate">
                                {currentPart.company || '-'}
                            </p>
                        </div>

                        <div className="bg-industrial-900/50 p-3 rounded-lg border border-industrial-700">
                            <p className="text-[10px] text-industrial-500 uppercase font-bold mb-1 tracking-wider">Categoría</p>
                            <p className="text-white text-xl font-bold truncate">
                                {currentPart.category}
                            </p>
                        </div>

                        <div className="bg-industrial-900/50 p-3 rounded-lg border border-industrial-700">
                            <p className="text-[10px] text-industrial-500 uppercase font-bold mb-1 tracking-wider">Proveedor</p>
                            <p className="text-white text-xl font-bold truncate">
                                {currentPart.supplier || '-'}
                            </p>
                        </div>

                        <div className="bg-industrial-900/50 p-3 rounded-lg border border-industrial-700">
                            <p className="text-[10px] text-industrial-500 uppercase font-bold mb-1 tracking-wider">Fecha de Creación</p>
                            <p className="text-white text-lg font-bold">
                                {currentPart.createdAt ? new Date(currentPart.createdAt).toLocaleDateString() : '-'}
                            </p>
                        </div>
                    </div>

                    {/* Image and Description Split */}
                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                        {currentPart.photoUrl && (
                            <div className="w-full md:w-1/3 shrink-0">
                                <div className="rounded-lg border border-industrial-700 overflow-hidden bg-black/20 aspect-square flex items-center justify-center p-2">
                                    <img src={currentPart.photoUrl} alt={currentPart.name} className="w-full h-full object-contain" />
                                </div>
                            </div>
                        )}
                        <div className={currentPart.photoUrl ? 'w-full md:w-2/3' : 'w-full'}>
                            {/* Description & Status */}
                            <div>
                                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-industrial-500" />
                                    Detalles
                                </h3>
                                <div className="text-industrial-300 text-sm leading-relaxed p-4 bg-industrial-900/20 rounded-lg border border-industrial-700/50 mb-6">
                                    {currentPart.description || "Sin descripción disponible."}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-industrial-500" />
                                    Estado de Inventario
                                </h3>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex justify-between items-center p-3 rounded bg-industrial-900/30 border border-industrial-700/50">
                                            <span className="text-sm text-industrial-400">Min Stock</span>
                                            <span className="text-white font-mono font-bold">{currentPart.minStock} {currentPart.unitOfMeasure}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 rounded bg-industrial-900/30 border border-industrial-700/50">
                                            <span className="text-sm text-industrial-400">Max Stock</span>
                                            <span className="text-white font-mono font-bold">{currentPart.maxStock || '-'} {currentPart.unitOfMeasure}</span>
                                        </div>
                                    </div>

                                    {currentPart.currentStock <= currentPart.minStock && (
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3 p-3 rounded bg-red-900/20 border border-red-900/50">
                                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-red-400 font-bold text-sm">Stock Crítico</p>
                                                    <p className="text-red-300/80 text-xs mt-1">
                                                        El stock actual está por debajo del nivel mínimo. Se recomienda reabastecer.
                                                    </p>
                                                </div>
                                                {canManage && (
                                                    <button
                                                        onClick={() => setShowPurchaseModal(true)}
                                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded shadow-lg transition-colors flex items-center gap-1.5"
                                                    >
                                                        Solicitar Compra
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Purchase Confirmation Modal */}
                {showPurchaseModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-industrial-800 rounded-xl shadow-2xl border border-industrial-600 w-full max-w-md p-6 animate-scale-in">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Package className="w-5 h-5 text-blue-400" />
                                Solicitar Compra
                            </h3>

                            {purchaseMessage && (
                                <div className={`p-3 mb-4 rounded-lg flex items-center border ${purchaseMessage.type === 'success'
                                    ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
                                    : 'bg-red-900/30 text-red-400 border-red-800'
                                    }`}>
                                    <span className="font-medium text-sm text-center w-full">{purchaseMessage.text}</span>
                                </div>
                            )}

                            <p className="text-industrial-400 text-sm mb-4">
                                ¿Cuántas unidades de <span className="text-white font-medium">{currentPart.name}</span> deseas solicitar?
                            </p>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-industrial-500 uppercase mb-2">Cantidad</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full bg-industrial-900 border border-industrial-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-industrial-accent"
                                    value={purchaseQuantity}
                                    onChange={(e) => setPurchaseQuantity(Number(e.target.value))}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowPurchaseModal(false);
                                        setPurchaseMessage(null);
                                    }}
                                    className="flex-1 py-2.5 rounded-lg border border-industrial-700 text-industrial-400 font-bold hover:bg-industrial-700 transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmPurchase}
                                    className={`flex-1 py-2.5 rounded-lg text-white font-bold transition-colors shadow-lg disabled:opacity-50 ${purchaseMessage?.type === 'success'
                                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                                        }`}
                                    disabled={isSubmitting || purchaseQuantity <= 0 || purchaseMessage?.type === 'success'}
                                >
                                    {isSubmitting ? 'Procesando...' : purchaseMessage?.type === 'success' ? 'Completado' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
