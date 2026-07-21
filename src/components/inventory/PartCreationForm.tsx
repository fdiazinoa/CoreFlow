import React, { useState, useEffect } from 'react';
import { inventoryService } from '../../services';
import { Package, PlusCircle, Save, Edit, Plus, FileSpreadsheet, Loader2 } from 'lucide-react';
import { SparePart } from '../../types/inventory';
import { useMasterStore } from '../../stores/useMasterStore';
import { ImportSpareParts } from './ImportSpareParts';

// Service initialized in index.ts

interface PartCreationFormProps {
    initialData?: SparePart;
    onCancel?: () => void;
    onSuccess?: (updatedPart?: SparePart) => void;
}

export const PartCreationForm: React.FC<PartCreationFormProps> = ({ initialData, onCancel, onSuccess }) => {
    const { 
        partCategories, 
        partLocations, 
        partUnits, 
        partSuppliers,
        addPart, 
        updatePart, 
        machines, 
        fetchMasterData 
    } = useMasterStore();
    const [formData, setFormData] = useState({
        name: '',
        partNumber: '',
        category: '',
        description: '',
        minStock: 0,
        unitOfMeasure: 'PCS',
        initialStock: 0,
        maxStock: 0,
        location: '',
        subLocation: '',
        cost: 0,
        photoUrl: '',
        createdAt: new Date().toISOString().split('T')[0],
        company: '',
        machinePlate: '',
        machineName: '',
        catalog: '',
        tableNo: '',
        figure: '',
        supplierCode: '',
        machineModel: '',
        machineLine: '',
        supplier: ''
    });

    // Formatting state for display
    const [displayCost, setDisplayCost] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (machines.length === 0) {
            fetchMasterData();
        }
    }, [machines.length, fetchMasterData]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                partNumber: initialData.partNumber,
                category: initialData.category,
                description: initialData.description || '',
                minStock: initialData.minStock,
                unitOfMeasure: initialData.unitOfMeasure,
                location: initialData.location,
                subLocation: initialData.subLocation || '',
                initialStock: initialData.currentStock, // Editing typically shows current as initial or just stock
                maxStock: initialData.maxStock || 0,
                cost: initialData.cost,
                photoUrl: initialData.photoUrl || '',
                createdAt: initialData.createdAt ? initialData.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
                company: initialData.company || '',
                machinePlate: initialData.machinePlate || '',
                machineName: initialData.machineName || '',
                catalog: initialData.catalog || '',
                tableNo: initialData.tableNo || '',
                figure: initialData.figure || '',
                supplierCode: initialData.supplierCode || '',
                machineModel: initialData.machineModel || '',
                machineLine: initialData.machineLine || '',
                supplier: initialData.supplier || ''
            });
            setDisplayCost(formatCurrency(initialData.cost).replace(/,/g, ',')); // Simplified format for display
        }
    }, [initialData]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    const formatNumberWithCommas = (value: string) => {
        // Remove existing commas to get clean number
        const cleanVal = value.replace(/,/g, '');
        const parts = cleanVal.split('.');

        // Format integer part
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

        return parts.join('.');
    };

    const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        // Allow only digits, commas and one dot
        if (!/^[0-9,]*\.?[0-9]*$/.test(val)) return;

        // Strip commas for numeric value
        const numericValue = parseFloat(val.replace(/,/g, '')) || 0;

        // Update display with formatted value
        const formatted = formatNumberWithCommas(val);
        setDisplayCost(formatted);

        // Update valid numeric value in state
        setFormData(prev => ({ ...prev, cost: numericValue }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'minStock' || name === 'maxStock' || name === 'initialStock' ? parseFloat(value) || 0 : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Uniqueness check for partNumber (SKU)
            if (!initialData) {
                const { parts } = useMasterStore.getState();
                const isDuplicate = parts.some(p => p.partNumber.toLowerCase() === formData.partNumber.toLowerCase());
                if (isDuplicate) {
                    setFeedback({ type: 'error', message: 'El código del repuesto ya existe.' });
                    setIsSubmitting(false);
                    return;
                }
            }

            if (initialData) {
                // Edit mode
                const { initialStock, ...dataWithoutStock } = formData;
                const updated = await updatePart({
                    ...initialData,
                    ...dataWithoutStock
                });
                setFeedback({ type: 'success', message: 'Repuesto actualizado exitosamente.' });
                if (onSuccess) onSuccess(updated as any);
            } else {
                let finalCreatedAt = formData.createdAt;
                const todayStr = new Date().toISOString().split('T')[0];

                // If they didn't touch it or left it as today's date, inject current time to ensure sorting
                if (finalCreatedAt === todayStr) {
                    finalCreatedAt = new Date().toISOString();
                } else if (!finalCreatedAt.includes('T')) {
                    finalCreatedAt = `${finalCreatedAt}T00:00:00.000Z`;
                }

                const created = await addPart({
                    ...formData,
                    createdAt: finalCreatedAt
                });

                setFeedback({ type: 'success', message: 'Repuesto creado exitosamente.' });
                setFormData({
                    name: '',
                    partNumber: '',
                    category: '',
                    description: '',
                    minStock: 0,
                    unitOfMeasure: 'PCS',
                    maxStock: 0,
                    location: '',
                    subLocation: '',
                    cost: 0,
                    photoUrl: '',
                    createdAt: new Date().toISOString().split('T')[0],
                    company: '',
                    machinePlate: '',
                    machineName: '',
                    catalog: '',
                    tableNo: '',
                    figure: '',
                    supplierCode: '',
                    machineModel: '',
                    machineLine: '',
                    supplier: ''
                });
                setDisplayCost('');
                if (onSuccess) onSuccess(created as any);
            }
        } catch (error: any) {
            console.error(error);
            setFeedback({ type: 'error', message: error.message || 'Error al procesar la solicitud.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const matchingMachine = machines.find(m => m.plate === val);
        setFormData(prev => ({
            ...prev,
            machinePlate: val,
            machineName: matchingMachine ? matchingMachine.name : (val === '' ? '' : prev.machineName),
            machineModel: matchingMachine ? matchingMachine.model : (val === '' ? '' : prev.machineModel),
            machineLine: matchingMachine ? matchingMachine.zone : (val === '' ? '' : prev.machineLine)
        }));
    };

    return (
        <div className="bg-industrial-800 rounded-lg shadow-xl border border-industrial-700 p-6">
            <div className="flex items-center mb-6 text-white pb-6 border-b border-industrial-700 justify-between">
                <div className="flex items-center">
                    <span className="p-1.5 bg-blue-900/30 rounded border border-blue-800 mr-3">
                        <Package className="w-6 h-6 text-blue-500" />
                    </span>
                    <h2 className="text-xl font-bold">{initialData ? 'Editar Repuesto' : 'Crear Nuevo Repuesto'}</h2>
                </div>
                {!initialData && (
                    <button
                        type="button"
                        onClick={() => setShowImportModal(true)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Importar Excel/CSV
                    </button>
                )}
                {onCancel && (
                    <button onClick={onCancel} className="text-industrial-400 hover:text-white">
                        <span className="sr-only">Cerrar</span>
                        {/* Optional Close Icon or just rely on parent */}
                    </button>
                )}
            </div>

            {feedback && (
                <div className={`mb-6 p-4 rounded-lg flex items-center border ${feedback.type === 'success' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>
                    <span className="font-medium text-sm">{feedback.message}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Part Number */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Código / N° Parte</label>
                        <input
                            type="text"
                            name="partNumber"
                            required
                            disabled={!!initialData}
                            className={`w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600 font-mono ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`}
                            placeholder="Ej. BRG-6204"
                            value={formData.partNumber}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Nombre Repuesto</label>
                        <input
                            type="text"
                            name="name"
                            required
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600"
                            placeholder="Ej. Rodamiento de Bola"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Empresa */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Empresa</label>
                        <select
                            name="company"
                            required
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none cursor-pointer"
                            value={formData.company}
                            onChange={handleChange}
                        >
                            <option value="">Seleccionar...</option>
                            <option value="Ravi Caribe Inc.">Ravi Caribe Inc.</option>
                            <option value="Labels Caribe Inc.">Labels Caribe Inc.</option>
                        </select>
                    </div>

                    {/* Categoría */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Categoría</label>
                        <select
                            name="category"
                            required
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none cursor-pointer"
                            value={formData.category}
                            onChange={handleChange}
                        >
                            <option value="">Seleccionar...</option>
                            {partCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Location and Sub-location */}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Tramo</label>
                            <select
                                name="location"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none cursor-pointer"
                                value={formData.location}
                                onChange={handleChange}
                            >
                                <option value="">Seleccionar...</option>
                                {partLocations.map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Ubicación</label>
                            <input
                                type="text"
                                name="subLocation"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600"
                                placeholder="Ej. Estante A-2, Nivel 3"
                                value={formData.subLocation}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Min Stock */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Stock Mínimo</label>
                        <input
                            type="number"
                            name="minStock"
                            min="0"
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-mono"
                            value={formData.minStock === 0 ? '' : formData.minStock}
                            onChange={handleChange}
                            placeholder="0"
                        />
                    </div>

                    {/* Max Stock */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Stock Máximo</label>
                        <input
                            type="number"
                            name="maxStock"
                            min="0"
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-mono"
                            value={formData.maxStock === 0 ? '' : formData.maxStock}
                            onChange={handleChange}
                            placeholder="0"
                        />
                    </div>

                    {/* Initial Stock / Current Stock */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">{initialData ? 'Stock Actual (No editable)' : 'Stock Inicial'}</label>
                        <input
                            type="number"
                            name="initialStock"
                            min="0"
                            disabled={!!initialData}
                            className={`w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-mono ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`}
                            value={formData.initialStock === 0 ? '' : formData.initialStock}
                            onChange={handleChange}
                            placeholder="0"
                        />
                    </div>

                    {/* Unit of Measure */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Unidad de Medida</label>
                        <select
                            name="unitOfMeasure"
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none cursor-pointer"
                            value={formData.unitOfMeasure}
                            onChange={handleChange}
                        >
                            {partUnits.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                            ))}
                        </select>
                    </div>

                    {/* Cost */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Costo Unitario (RD$)</label>
                        <input
                            type="text"
                            name="cost"
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-mono"
                            value={displayCost}
                            onChange={handleCostChange}
                            placeholder="0.00"
                        />
                    </div>

                    {/* Created At */}
                    <div>
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Fecha de Creación</label>
                        <input
                            type="date"
                            name="createdAt"
                            required
                            className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-mono [color-scheme:dark]"
                            value={formData.createdAt}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Image Upload */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Imagen del Repuesto</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="block w-full text-sm text-industrial-400
                                file:mr-4 file:py-2.5 file:px-4
                                file:rounded-lg file:border-0
                                file:text-sm file:font-semibold
                                file:bg-industrial-700 file:text-white
                                hover:file:bg-industrial-600
                                cursor-pointer"
                            />
                            {formData.photoUrl && (
                                <div className="h-16 w-16 rounded-lg border border-industrial-600 overflow-hidden bg-white/5 flex-shrink-0 p-1 flex items-center justify-center">
                                    <img src={formData.photoUrl} alt="Preview" className="h-full w-full object-contain" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Descripción</label>
                    <textarea
                        name="description"
                        rows={3}
                        className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600 resize-none"
                        placeholder="Descripción detallada del repuesto..."
                        value={formData.description}
                        onChange={handleChange}
                    />
                </div>

                {/* Información Proveedor Section */}
                <div className="border-t border-industrial-700 pt-6 my-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Información del Equipo y Proveedor</h3>
                    
                    {/* Subdivision 1: Información del Equipo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Matrícula */}
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Matrícula (Equipo)</label>
                            <input
                                type="text"
                                name="machinePlate"
                                list="machines-plates"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600 font-mono"
                                placeholder="Escribe para buscar matrícula..."
                                value={formData.machinePlate}
                                onChange={handlePlateChange}
                            />
                            <datalist id="machines-plates">
                                {machines.map((m) => m.plate && (
                                    <option key={m.id} value={m.plate}>
                                        {m.plate} {m.name ? `- ${m.name}` : ''}
                                    </option>
                                ))}
                            </datalist>
                        </div>

                        {/* Máquina */}
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Máquina</label>
                            <input
                                type="text"
                                name="machineName"
                                readOnly
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600 opacity-60 cursor-not-allowed"
                                placeholder="Autocompletado desde matrícula..."
                                value={formData.machineName}
                            />
                        </div>

                        {/* Modelo del equipo */}
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Modelo del equipo</label>
                            <input
                                type="text"
                                name="machineModel"
                                readOnly
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600 opacity-60 cursor-not-allowed"
                                placeholder="Autocompletado desde matrícula..."
                                value={formData.machineModel || ''}
                            />
                        </div>

                        {/* Línea */}
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Línea</label>
                            <input
                                type="text"
                                name="machineLine"
                                readOnly
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600 opacity-60 cursor-not-allowed"
                                placeholder="Autocompletado desde matrícula..."
                                value={formData.machineLine || ''}
                            />
                        </div>
                    </div>

                    {/* Divider line between Equipment and Supplier information */}
                    <div className="border-t border-industrial-700/50 my-6"></div>

                    {/* Subdivision 2: Información del Proveedor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Proveedor */}
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Proveedor</label>
                            <div className="relative">
                                <select
                                    name="supplier"
                                    className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none cursor-pointer"
                                    value={formData.supplier || ''}
                                    onChange={handleChange}
                                >
                                    <option value="">Seleccionar Proveedor...</option>
                                    {partSuppliers.map(sup => (
                                        <option key={sup} value={sup}>{sup}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Catálogo */}
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Catálogo</label>
                            <input
                                type="text"
                                name="catalog"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600"
                                placeholder="Referencia de catálogo..."
                                value={formData.catalog}
                                onChange={handleChange}
                            />
                        </div>

                        {/* Tabla */}
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Tabla</label>
                            <input
                                type="text"
                                name="tableNo"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600"
                                placeholder="Número o nombre de tabla..."
                                value={formData.tableNo}
                                onChange={handleChange}
                            />
                        </div>

                        {/* Figura */}
                        <div>
                            <label className="block text-xs font-bold text-industrial-400 uppercase tracking-wider mb-2">Figura</label>
                            <input
                                type="text"
                                name="figure"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-industrial-600"
                                placeholder="Número de figura..."
                                value={formData.figure}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-industrial-700 flex justify-end gap-3">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="px-6 py-3 border border-industrial-600 rounded-lg text-sm font-bold text-industrial-300 hover:bg-industrial-700 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-3 border border-transparent rounded-lg shadow-lg shadow-blue-900/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isSubmitting ? 'Guardando...' : (initialData ? 'Guardar Cambios' : 'Guardar Repuesto')}
                    </button>
                </div>
            </form >

            {showImportModal && (
                <ImportSpareParts
                    onClose={() => setShowImportModal(false)}
                    onSuccess={() => {
                        useMasterStore.getState().fetchMasterData();
                        if (onSuccess) onSuccess();
                    }}
                />
            )}
        </div >
    );
};
