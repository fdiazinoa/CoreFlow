import React, { useState, useEffect } from 'react';
import { Machine, MachineHourLog } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from "../contexts/AuthContext";
import { MasterDataService } from "../src/services/masterDataService";
import { Clock, History, Save, FileDown, Filter, X, Lock, AlertCircle } from 'lucide-react';
import { TablePagination } from './shared/TablePagination';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useMasterStore } from '../src/stores/useMasterStore';

interface MachineHoursLogProps {
    machines: Machine[];
}

export const MachineHoursLog: React.FC<MachineHoursLogProps> = ({ machines }) => {
    const { t } = useLanguage();
    const { user, hasPermission } = useAuth();
    const canRegister = hasPermission('log_hours');
    const [selectedMachineId, setSelectedMachineId] = useState<string>('');
    const [currentReading, setCurrentReading] = useState<number>(0);
    const [displayReading, setDisplayReading] = useState<string>('');
    const [selectedUnit, setSelectedUnit] = useState<'h' | 'km'>('h');
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const ITEMS_PER_PAGE = 25;

    // Searchable Dropdown State
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // History from Backend
    const [history, setHistory] = useState<MachineHourLog[]>([]);

    const selectedMachine = machines.find(m => m.id === selectedMachineId);

    // Load logs when filters or page change
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setIsLoading(true);
                const result = await MasterDataService.getFilteredMachineHourLogs({
                    machineId: selectedMachineId || undefined,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    page: currentPage,
                    limit: ITEMS_PER_PAGE
                });
                setHistory(result.data);
                setTotalLogs(result.total);

                // Auto-select unit from most recent log if available
                if (result.data && result.data.length > 0) {
                    const latestUnit = result.data[0].unit as 'h' | 'km';
                    setSelectedUnit(latestUnit);
                }
            } catch (err) {
                console.error("Error fetching logs:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLogs();
    }, [selectedMachineId, startDate, endDate, currentPage]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedMachineId, startDate, endDate]);

    const handleLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMachine) return;

        if (currentReading <= 0) {
            alert("Please enter a valid reading.");
            return;
        }

        try {
            setIsLoading(true);
            const newLog = await MasterDataService.logMachineHours({
                machineId: selectedMachine.id,
                hoursLogged: currentReading,
                unit: selectedUnit,
                operator: user?.full_name || 'Unknown Operator'
            });

            // Update history locally if it matches current filters (simplified: just prepend if no date filter or within range)
            // Ideally, re-fetch to be safe, but prepending is faster feedback.
            // For now, let's re-fetch to ensure sort order and consistency
            const logs = await MasterDataService.getFilteredMachineHourLogs({
                machineId: selectedMachineId || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });
            setHistory(logs.data);
            setTotalLogs(logs.total);

            // Update local machine running hours immediately for UI feedback
            selectedMachine.runningHours = currentReading;

            setCurrentReading(0);
            setDisplayReading('');

        } catch (error) {
            console.error(error);
            alert("Error logging hours.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReadingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const rawValue = val.replace(/,/g, '');

        if (rawValue === '') {
            setCurrentReading(0);
            setDisplayReading('');
            return;
        }

        if (!/^\d+$/.test(rawValue)) return;

        const numValue = parseInt(rawValue, 10);
        setCurrentReading(numValue);
        setDisplayReading(new Intl.NumberFormat('en-US').format(numValue));
    };

    const generatePDF = () => {
        const { plantSettings } = useMasterStore.getState() as any;
        const doc = new jsPDF();

        let currentY = 20;

        // 1. Logo
        if (plantSettings.logoUrl) {
            try {
                const imgProps = doc.getImageProperties(plantSettings.logoUrl);
                const logoWidth = 35;
                const logoHeight = (imgProps.height * logoWidth) / imgProps.width;
                doc.addImage(plantSettings.logoUrl, 'PNG', 14, 10, logoWidth, logoHeight);
                currentY = 15 + logoHeight + 10;
            } catch (e) {
                console.warn('Could not add logo', e);
                currentY = 22;
            }
        } else {
            currentY = 22;
        }

        doc.setFontSize(18);
        doc.text('Reporte de Horas de Máquina', 14, currentY);

        doc.setFontSize(11);
        doc.setTextColor(100);
        const dateStr = startDate && endDate ? `${startDate} a ${endDate}` : 'Todos los registros';
        const machineStr = selectedMachine ? `Máquina: ${selectedMachine.name}` : 'Todas las máquinas';
        doc.text(`${machineStr} | ${dateStr}`, 14, currentY + 8);

        const tableColumn = ["Fecha", "Máquina", "Alias / Matrícula", "Lectura", "Operador"];
        const tableRows: any[] = [];

        history.forEach(log => {
            const machine = machines.find(m => m.id === log.machineId);
            const machineName = machine?.name || 'Unknown';
            const aliasPlate = machine?.alias && machine?.plate
                ? `${machine.alias} (${machine.plate})`
                : (machine?.alias || machine?.plate || '-');

            const reading = `${new Intl.NumberFormat('en-US').format(log.hoursLogged)} ${log.unit || 'h'}`;

            const logData = [
                log.date,
                machineName,
                aliasPlate,
                reading,
                log.operator,
            ];
            tableRows.push(logData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: currentY + 15,
            headStyles: { fillColor: [44, 62, 80] }
        });

        doc.save(`reporte_uso_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="h-full bg-industrial-900 p-6 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                        <Clock className="w-6 h-6 text-industrial-accent" /> {t('hours.title')}
                    </h2>
                    <p className="text-industrial-500 text-sm">{t('hours.subtitle')}</p>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Entry Form */}
                <div className="bg-industrial-800 p-6 rounded-lg border border-industrial-700 shadow-xl">
                    <h3 className="text-white font-bold mb-4 border-b border-industrial-700 pb-2">{t('hours.log')}</h3>
                    <form onSubmit={handleLog} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs text-industrial-400 font-bold uppercase">{t('form.machine')}</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar por Nombre, Alias o Matrícula..."
                                    className={`w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white outline-none focus:border-emerald-500 transition-colors ${!canRegister ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    value={searchTerm}
                                    disabled={!canRegister}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setSelectedMachineId('');
                                        setShowDropdown(true);
                                    }}
                                    onFocus={() => canRegister && setShowDropdown(true)}
                                    // Delay blur to allow click on dropdown items
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setSelectedMachineId('');
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-industrial-400 hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                                {showDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-industrial-800 border border-industrial-600 rounded shadow-xl max-h-60 overflow-y-auto">
                                        {machines.filter(m =>
                                            m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            (m.alias && m.alias.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                            (m.plate && m.plate.toLowerCase().includes(searchTerm.toLowerCase()))
                                        ).length > 0 ? (
                                            machines.filter(m =>
                                                m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                (m.alias && m.alias.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                                (m.plate && m.plate.toLowerCase().includes(searchTerm.toLowerCase()))
                                            ).map(m => (
                                                <div
                                                    key={m.id}
                                                    className="px-4 py-2 hover:bg-industrial-700 cursor-pointer text-white text-sm border-b border-industrial-700/50 last:border-0"
                                                    onClick={() => {
                                                        setSelectedMachineId(m.id);
                                                        setSearchTerm(m.name + (m.plate ? ` (${m.plate})` : ''));
                                                        setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="font-bold text-emerald-400">{m.name}</div>
                                                    <div className="text-xs text-industrial-400">
                                                        {m.plate ? `Mat: ${m.plate}` : ''} {m.alias ? `• Alias: ${m.alias}` : ''}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2 text-industrial-400 text-sm">No se encontraron equipos</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedMachine && (
                            <div className="bg-industrial-900/50 p-3 rounded border border-industrial-600 mb-4">
                                <span className="text-xs text-industrial-500 block">{t('hours.last')}</span>
                                <span className="text-xl font-mono text-white">
                                    <span>{new Intl.NumberFormat('en-US').format(selectedMachine.runningHours)}</span> <span>{history.length > 0 && history[0].machineId === selectedMachine.id ? history[0].unit : selectedUnit}</span>
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-industrial-400 font-bold uppercase">{t('hours.current')}</label>
                                <input
                                    type="text"
                                    required
                                    disabled={!canRegister}
                                    className={`w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white font-mono ${!canRegister ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder={canRegister ? "e.g. 12,500" : "Sin permiso"}
                                    value={displayReading}
                                    onChange={handleReadingChange}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-industrial-400 font-bold uppercase">Unidad</label>
                                <select
                                    className={`w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white outline-none focus:border-emerald-500 transition-colors ${!canRegister ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    value={selectedUnit}
                                    disabled={!canRegister}
                                    onChange={(e) => setSelectedUnit(e.target.value as 'h' | 'km')}
                                >
                                    <option value="h">Horas (h)</option>
                                    <option value="km">Kilómetros (km)</option>
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !canRegister}
                            className={`w-full ${canRegister ? 'bg-industrial-accent hover:bg-blue-600' : 'bg-industrial-700 cursor-not-allowed'} text-white py-2 rounded font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}
                        >
                            {isLoading ? <span>Saving...</span> : <>{canRegister ? <Save size={16} /> : <Lock size={16} />} <span>{canRegister ? t('form.save') : 'Acceso Restringido'}</span></>}
                        </button>
                        {!canRegister && (
                            <p className="text-[10px] text-red-400 mt-2 text-center flex items-center justify-center gap-1">
                                <AlertCircle size={10} /> No tiene permisos para registrar uso del equipo.
                            </p>
                        )}
                    </form>
                </div>

                {/* History List */}
                <div className="lg:col-span-2 bg-industrial-800 rounded-lg border border-industrial-700 shadow-xl flex flex-col min-h-0">
                    <div className="p-4 border-b border-industrial-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <History size={16} /> Historial de Registros (Registros Recientes)
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={generatePDF}
                                className="bg-industrial-700 hover:bg-industrial-600 text-white px-3 py-1.5 rounded text-xs flex items-center gap-2 transition-colors border border-industrial-600"
                            >
                                <FileDown size={14} /> <span>Reporte PDF</span>
                            </button>
                        </div>
                    </div>

                    {/* Filters Toolbar */}
                    <div className="p-3 bg-industrial-900/50 border-b border-industrial-700 flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2 text-industrial-400 text-xs">
                            <Filter size={14} /> <span className="font-bold uppercase">Filtros:</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-industrial-500">Desde:</label>
                            <input
                                type="date"
                                className="bg-industrial-900 border border-industrial-600 text-white text-xs rounded px-2 py-1 outline-none focus:border-emerald-500"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-industrial-500">Hasta:</label>
                            <input
                                type="date"
                                className="bg-industrial-900 border border-industrial-600 text-white text-xs rounded px-2 py-1 outline-none focus:border-emerald-500"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>

                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-xs text-red-400 hover:text-red-300 underline ml-auto"
                            >
                                Limpiar Filtros
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto p-0">
                        {history.length === 0 ? (
                            <div className="p-6 text-center text-industrial-500">
                                No se encontraron registros con los filtros seleccionados.
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm text-industrial-400">
                                <thead className="bg-industrial-900 text-xs uppercase font-bold text-industrial-500 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">{t('form.date')}</th>
                                        <th className="px-6 py-3">{t('form.machine')}</th>
                                        <th className="px-6 py-3">Alias / Matrícula</th>
                                        <th className="px-6 py-3">Lectura</th>
                                        <th className="px-6 py-3">Operador</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-industrial-700">
                                    {history.map(log => {
                                        const machine = machines.find(m => m.id === log.machineId);
                                        return (
                                            <tr key={log.id} className="hover:bg-industrial-700/30">
                                                <td className="px-6 py-3">{log.date}</td>
                                                <td className="px-6 py-3 text-white">
                                                    {machine?.name || 'Unknown Log'}
                                                </td>
                                                <td className="px-6 py-3 text-industrial-400 italic">
                                                    {machine?.alias && machine?.plate ? `${machine.alias} (${machine.plate})` : (machine?.alias || machine?.plate || '-')}
                                                </td>
                                                <td className={`px-6 py-3 font-mono ${log.unit === 'km' ? 'text-emerald-500 font-bold' : 'text-industrial-accent'}`}>
                                                    {new Intl.NumberFormat('en-US').format(log.hoursLogged)} {log.unit}
                                                </td>
                                                <td className="px-6 py-3">{log.operator}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="mt-auto p-4 bg-industrial-900 border-t border-industrial-700 flex justify-end">
                        <TablePagination
                            totalItems={totalLogs}
                            currentPage={currentPage}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setCurrentPage}
                            isLoading={isLoading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};