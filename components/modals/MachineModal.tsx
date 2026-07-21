import React, { useState, useEffect } from 'react';
import { X, Server, Loader2 } from 'lucide-react';
import { useMasterStore } from '../../src/stores/useMasterStore';
import { Machine, MachineStatus } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface MachineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (machine: Partial<Machine>) => Promise<void> | void;
    initialData?: Partial<Machine>;
    isEditing?: boolean;
}

export const MachineModal: React.FC<MachineModalProps> = ({ isOpen, onClose, onSave, initialData, isEditing = false }) => {
    const { t } = useLanguage();
    const { branches, categories, assetTypes, zones } = useMasterStore();
    const [isSaving, setIsSaving] = useState(false);

    // Local state for form
    const [formData, setFormData] = useState<Partial<Machine>>({
        name: '',
        branch: initialData?.branch || branches[0] || '',
        category: initialData?.category || categories[0] || '',
        zone: initialData?.zone || (zones.length > 0 ? `${zones[0].name}${zones[0].lines.length > 0 ? ' - ' + zones[0].lines[0] : ''}` : ''),
        type: initialData?.type || assetTypes[0] || 'GENERIC',
        isActive: initialData?.isActive !== false,
        plate: '',
        brand: '',
        model: '',
        status: MachineStatus.IDLE,
        ...initialData // Override defaults with initialData if provided
    });

    // Reset or update form when opening/initialData changes
    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: initialData?.name || '',
                branch: initialData?.branch || branches[0] || '',
                category: initialData?.category || categories[0] || '',
                zone: initialData?.zone || (zones.length > 0 ? `${zones[0].name}${zones[0].lines.length > 0 ? ' - ' + zones[0].lines[0] : ''}` : ''),
                type: initialData?.type || assetTypes[0] || 'GENERIC',
                isActive: initialData?.isActive !== false,
                plate: initialData?.plate || '',
                brand: initialData?.brand || '',
                model: initialData?.model || '',
                status: initialData?.status || MachineStatus.IDLE,
                ...initialData
            });
        }
    }, [isOpen, initialData, branches, categories, assetTypes, zones]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Error saving machine:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-industrial-800 rounded-lg border border-industrial-600 shadow-2xl w-full max-w-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-industrial-700 flex justify-between items-center bg-industrial-900/50">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Server className="w-4 h-4 text-industrial-accent" />
                        {isEditing ? 'Editar Equipo' : 'Nuevo Equipo'}
                    </h3>
                    <button onClick={onClose} className="text-industrial-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

                    <div className="grid grid-cols-2 gap-4">
                        {/* Branch */}
                        <div className="space-y-1">
                            <label className="text-xs text-industrial-400 font-medium">{t('assets.branch')}</label>
                            <select
                                className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                value={formData.branch}
                                onChange={e => setFormData({ ...formData, branch: e.target.value })}
                            >
                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        {/* Category */}
                        <div className="space-y-1">
                            <label className="text-xs text-industrial-400 font-medium">{t('assets.category')}</label>
                            <select
                                className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Zone (Location) */}
                        <div className="space-y-1">
                            <label className="text-xs text-industrial-400 font-medium">{t('assets.location')}</label>
                            <p className="text-xs text-industrial-500 truncate mb-1">{formData.zone}</p>
                            {/* 
                    If we passed a specific Zone/Line in initialData (which is typical when adding from Map), 
                    we might want to make this readonly or a select. 
                    For now, a select of all zones seems appropriate, but "Line" granularity is string based.
                    Let's revert to a select of Zone Names for simplicity, assuming 'Line' is part of the name or handled separately?
                    Wait, `zone` in Machine is a string. `ZoneStructure` has `name` and `lines`.
                    Usually `machine.zone` is "ZoneName - LineName".
                 */}
                            <select
                                className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                value={formData.zone}
                                onChange={e => setFormData({ ...formData, zone: e.target.value })}
                            >
                                {zones.flatMap(z => z.lines.map(l => (
                                    <option key={`${z.name}-${l}`} value={`${z.name} - ${l}`}>
                                        {z.name} - {l}
                                    </option>
                                )))}
                                {/* Fallback for zones with no lines? */}
                                {zones.filter(z => z.lines.length === 0).map(z => (
                                    <option key={z.name} value={z.name}>{z.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Asset Type */}
                        <div className="space-y-1">
                            <label className="text-xs text-industrial-400 font-medium">{t('assets.col.type')}</label>
                            <select
                                className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="" disabled>Seleccionar Tipo</option>
                                {assetTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                {/* Show 'GENERIC' only if it's the current value but not in assetTypes */}
                                {formData.type === 'GENERIC' && !assetTypes.includes('GENERIC') && (
                                    <option value="GENERIC">GENERIC</option>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className="h-px bg-industrial-700 my-2"></div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1 col-span-2">
                            <label className="text-xs text-industrial-400 font-medium">{t('assets.col.name')} *</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Compressor 01"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-industrial-400 font-medium">Marca</label>
                            <input
                                type="text"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                value={formData.brand}
                                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-industrial-400 font-medium">{t('assets.col.plate')}</label>
                            <input
                                type="text"
                                className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                value={formData.plate}
                                onChange={e => setFormData({ ...formData, plate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-industrial-700 mt-4">
                        <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 rounded text-industrial-300 hover:text-white hover:bg-industrial-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {t('common.cancel')}
                        </button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 rounded bg-industrial-accent hover:bg-industrial-accent-hover text-white font-bold text-sm shadow-lg shadow-industrial-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                            {isSaving && <Loader2 className="animate-spin w-4 h-4" />}
                            {isSaving ? 'Guardando...' : t('common.save')}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};
