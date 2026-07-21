import React, { useState, useEffect } from 'react';
import { inventoryService } from '../../services';
import { SparePart, RequestPriority } from '../../types/inventory';
import { AlertTriangle, Plus, Trash2, Search, Edit, X, Save as SaveIcon, Loader2 } from 'lucide-react';

import { PartsRequest, RequestItem } from '../../types/inventory';

// Service initialized in index.ts

interface PartRequestFormProps {
    initialData?: PartsRequest;
    onCancel?: () => void;
    onSuccess?: () => void;
}

export const PartRequestForm: React.FC<PartRequestFormProps> = ({ initialData, onCancel, onSuccess }) => {
    const [parts, setParts] = useState<SparePart[]>([]);
    const [technicianId, setTechnicianId] = useState(initialData?.technicianId || '');
    const [priority, setPriority] = useState<RequestPriority>(initialData?.priority || 'NORMAL');

    // Form Item State
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedPartId, setSelectedPartId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [usageLocation, setUsageLocation] = useState('');
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Map initial items to form state
    const [requestItems, setRequestItems] = useState<{
        partId: string;
        quantity: number;
        partName: string;
        usageLocation?: string;
        quantityDelivered?: number; // Keep track of this for validation
    }[]>(initialData?.items.map(item => ({
        partId: item.partId,
        quantity: item.quantityRequested,
        partName: item.partId, // We'll update this when parts load
        usageLocation: item.usageLocation,
        quantityDelivered: item.quantityDelivered
    })) || []);

    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        inventoryService.getAllParts(1, 1000).then(res => {
            const data = res.data;
            setParts(data);
            // Update part names if editing
            if (initialData) {
                setRequestItems(prev => prev.map(item => ({
                    ...item,
                    partName: data.find(p => p.id === item.partId)?.name || item.partId
                })));
            }
        });
    }, [initialData]);

    const selectedPart = parts.find(p => p.id === selectedPartId);
    const isStockInsufficient = selectedPart && quantity > selectedPart.currentStock;

    const addItem = () => {
        if (!selectedPart) return;

        setRequestItems(prev => [
            ...prev,
            {
                partId: selectedPart.id,
                quantity: quantity,
                partName: selectedPart.name,
                usageLocation: usageLocation.trim() || undefined
            }
        ]);

        // Reset item fields
        setSelectedPartId('');
        setSearchTerm('');
        setQuantity(1);
        setUsageLocation('');
    };

    const startEditing = (index: number) => {
        const item = requestItems[index];
        setEditingItemIndex(index);
        setSelectedPartId(item.partId);
        setSearchTerm(item.partName);
        setQuantity(item.quantity);
        setUsageLocation(item.usageLocation || '');
        // Note: We don't block changing the part, similar to how we don't block adding a new one.
        // But users should be careful.
    };

    const updateItem = () => {
        if (!selectedPart || editingItemIndex === null) return;

        const updatedItems = [...requestItems];
        const currentItem = updatedItems[editingItemIndex];

        // Validation: Cannot reduce quantity below delivered
        if (currentItem.quantityDelivered && quantity < currentItem.quantityDelivered) {
            alert(`No puedes reducir la cantidad por debajo de lo ya entregado (${currentItem.quantityDelivered}).`);
            return;
        }

        updatedItems[editingItemIndex] = {
            ...currentItem,
            partId: selectedPart.id,
            quantity: quantity,
            partName: selectedPart.name,
            usageLocation: usageLocation.trim() || undefined
        };

        setRequestItems(updatedItems);
        cancelEdit();
    };

    const cancelEdit = () => {
        setEditingItemIndex(null);
        setSelectedPartId('');
        setSearchTerm('');
        setQuantity(1);
        setUsageLocation('');
    };

    const removeItem = (index: number) => {
        const newItems = [...requestItems];
        newItems.splice(index, 1);
        setRequestItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (initialData) {
                // UPDATE logic
                await inventoryService.updateRequest({
                    ...initialData,
                    technicianId,
                    priority,
                    items: requestItems.map(i => ({
                        partId: i.partId,
                        quantityRequested: i.quantity,
                        quantityDelivered: i.quantityDelivered || 0, // Preserve delivered
                        usageLocation: i.usageLocation
                    }))
                });
                setFeedback({ type: 'success', message: 'Solicitud actualizada exitosamente.' });
                if (onSuccess) onSuccess();
            } else {
                // CREATE logic
                await inventoryService.createRequest({
                    technicianId,
                    priority,
                    items: requestItems.map(i => ({
                        partId: i.partId,
                        quantity: i.quantity,
                        usageLocation: i.usageLocation
                    }))
                });
                setFeedback({ type: 'success', message: 'Solicitud creada exitosamente.' });
                // Reset form
                setRequestItems([]);
                setTechnicianId('');
                setPriority('NORMAL');
            }
        } catch (error) {
            console.error(error);
            setFeedback({ type: 'error', message: 'Error al procesar la solicitud.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-industrial-800 rounded-lg shadow-xl border border-industrial-700 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="p-1 bg-industrial-900 rounded border border-industrial-600">
                    <Plus className="w-5 h-5 text-industrial-accent" />
                </span>
                {initialData ? 'Editar Solicitud' : 'Nueva Solicitud de Repuestos'}
            </h2>

            {feedback && (
                <div className={`mb-6 p-4 rounded-lg flex items-center border ${feedback.type === 'success' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>
                    <span className="text-sm font-medium">{feedback.message}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Solicitante</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-industrial-accent transition-colors placeholder-industrial-600"
                            placeholder="Ingrese el Nombre del Solicitante"
                            value={technicianId}
                            onChange={e => setTechnicianId(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Prioridad</label>
                        <select
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-industrial-accent transition-colors appearance-none cursor-pointer"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as RequestPriority)}
                        >
                            <option value="NORMAL">Normal</option>
                            <option value="HIGH">Alta</option>
                            <option value="EMERGENCY">Urgente</option>
                        </select>
                    </div>
                </div>

                <div className="border-t border-industrial-700 py-6">
                    <h3 className="text-lg font-bold text-white mb-4">Agregar Repuestos</h3>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-6 relative">
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Repuesto (Buscar por nombre o código)</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-industrial-500 w-4 h-4" />
                                <input
                                    type="text"
                                    className="w-full bg-industrial-900 border border-industrial-600 rounded-lg pl-10 pr-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-industrial-accent transition-colors placeholder-industrial-600"
                                    placeholder="Buscar repuesto..."
                                    value={searchTerm}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    // Delay hiding to allow click event on option to fire
                                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setIsDropdownOpen(true);
                                        if (selectedPartId) setSelectedPartId(''); // Clear selection if user types
                                    }}
                                />
                            </div>

                            {/* Floating Dropdown */}
                            {isDropdownOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-industrial-800 border border-industrial-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                    {parts.filter(p =>
                                        !searchTerm ||
                                        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        p.partNumber.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).length > 0 ? (
                                        <ul className="py-1">
                                            {parts
                                                .filter(p =>
                                                    !searchTerm ||
                                                    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    p.partNumber.toLowerCase().includes(searchTerm.toLowerCase())
                                                )
                                                .map(p => (
                                                    <li
                                                        key={p.id}
                                                        className="px-4 py-3 hover:bg-industrial-700 cursor-pointer text-white flex justify-between items-center border-b border-industrial-700/50 last:border-0"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault(); // Prevent input blur
                                                            setSelectedPartId(p.id);
                                                            setSearchTerm(`${p.partNumber} - ${p.name}`);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                    >
                                                        <div>
                                                            <span className="font-mono text-industrial-400 font-bold mr-2">{p.partNumber}</span>
                                                            <span className="font-medium">{p.name}</span>
                                                        </div>
                                                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${p.currentStock > 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                                                            Stock: {p.currentStock}
                                                        </span>
                                                    </li>
                                                ))}
                                        </ul>
                                    ) : (
                                        <div className="px-4 py-3 text-industrial-500 text-sm italic">
                                            No se encontraron repuestos.
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedPart && !isDropdownOpen && (
                                <p className="mt-2 text-sm text-industrial-400">
                                    Stock Disponible: <span className="font-bold text-white ml-1">{selectedPart.currentStock} {selectedPart.unitOfMeasure}</span>
                                </p>
                            )}
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Cantidad</label>
                            <input
                                type="number"
                                min="1"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-industrial-accent transition-colors font-mono"
                                value={quantity || ''}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                    setQuantity(isNaN(val) ? 0 : val);
                                }}
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Lugar de Uso</label>
                            <input
                                type="text"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-industrial-accent transition-colors placeholder-industrial-600"
                                placeholder="Ej: Máquina 2"
                                value={usageLocation}
                                onChange={e => setUsageLocation(e.target.value)}
                            />
                        </div>

                        <div className="md:col-span-12 flex justify-end mt-2">
                            <button
                                type="button"
                                onClick={editingItemIndex !== null ? updateItem : addItem}
                                disabled={!selectedPart || quantity <= 0}
                                className={`px-6 py-2.5 border border-transparent rounded-lg shadow-lg text-sm font-bold text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center ${editingItemIndex !== null ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-industrial-accent hover:bg-blue-600'
                                    }`}
                            >
                                {editingItemIndex !== null ? (
                                    <>
                                        <SaveIcon className="w-4 h-4 mr-2" />
                                        Actualizar Item
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Agregar
                                    </>
                                )}
                            </button>
                            {editingItemIndex !== null && (
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="ml-2 px-4 py-2.5 border border-industrial-600 rounded-lg text-sm font-bold text-industrial-300 hover:bg-industrial-700 transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {isStockInsufficient && (
                        <div className="mt-4 flex items-start p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 mr-3 mt-0.5" />
                            <p className="text-sm text-yellow-200">
                                <strong className="font-bold text-yellow-400">Advertencia: Stock insuficiente.</strong> La solicitud quedará como "Pendiente de Compra".
                            </p>
                        </div>
                    )}
                </div>

                {/* List of added items */}
                {requestItems.length > 0 && (
                    <div className="bg-industrial-900/50 rounded-lg p-4 border border-industrial-700">
                        <h4 className="text-xs font-bold text-industrial-400 uppercase tracking-wider mb-3">Ítems a Solicitar</h4>
                        <ul className="space-y-2">
                            {requestItems.map((item, index) => (
                                <li key={index} className="flex justify-between items-center bg-industrial-800 p-3 rounded border border-industrial-700">
                                    <div className="flex items-center flex-1">
                                        <div className="w-2 h-2 rounded-full bg-industrial-accent mr-3"></div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white">{item.partName}</span>
                                            {item.usageLocation && (
                                                <span className="text-xs text-industrial-400">Uso: {item.usageLocation}</span>
                                            )}
                                        </div>
                                        <span className="text-sm text-industrial-400 ml-auto mr-4 font-mono bg-industrial-900 px-2 py-0.5 rounded">x{item.quantity}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => startEditing(index)}
                                        className="text-industrial-500 hover:text-yellow-400 transition-colors p-1"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeItem(index)}
                                        disabled={item.quantityDelivered ? item.quantityDelivered > 0 : false}
                                        title={item.quantityDelivered && item.quantityDelivered > 0 ? "Ya se han entregado items" : "Eliminar"}
                                        className="text-industrial-500 hover:text-red-400 transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t border-industrial-700">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 mr-3 border border-industrial-600 rounded-lg text-sm font-bold text-industrial-300 hover:bg-industrial-700 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={requestItems.length === 0 || isSubmitting}
                        className="px-6 py-2.5 border border-transparent rounded-lg shadow-lg shadow-emerald-900/20 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSubmitting ? 'Procesando...' : (initialData ? 'Guardar Cambios' : 'Crear Solicitud')}
                    </button>
                </div>
            </form>
        </div>
    );
};
