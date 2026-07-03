import React, { useState } from 'react';
import { Machine, MachineStatus, MachineDocument } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useMasterStore } from '../src/stores/useMasterStore';
import { DocumentService } from '../src/services/documentService';
import { supabase } from '../src/services/supabaseClient';
import { Box, Wifi, Plus, X, Camera, FileText, Server, Clock, Calendar, Pencil, Eye, Download, Trash2, Lock, AlertCircle } from 'lucide-react';
import { TablePagination } from './shared/TablePagination';
import { useAuth } from '../contexts/AuthContext';

export const MachinesList: React.FC = () => {
  const {
    machines, addMachine, updateMachine,
    branches, categories, assetTypes, zones: zoneStructures,
    maintenancePlans,
    parts, // To load parts for Kardex
    machinePagination: pagination, setMachinePage: setPage, machineFilters, setMachineFilters, isLoading
  } = useMasterStore();

  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_assets');

  // Flatten Zones for Selection
  const zones = zoneStructures.flatMap(z =>
    z.lines && z.lines.length > 0
      ? z.lines.map(l => `${z.name} - ${l}`)
      : [z.name]
  );

  // Filters (Sync with store)
  const assetSearch = machineFilters.search || '';
  const filterBranch = machineFilters.branch || '';
  const filterCategory = machineFilters.category || '';
  const filterType = machineFilters.type || '';
  const filterZone = machineFilters.zone || '';
  const showInactive = machineFilters.showInactive || false;

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingMachine, setViewingMachine] = useState<Machine | null>(null);
  
  // Dynamic detail states
  const [machineUnit, setMachineUnit] = useState<string>('h');
  const [lastMaintenanceDate, setLastMaintenanceDate] = useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    if (viewingMachine) {
      // 1. Fetch unit from machine_hour_logs
      supabase
        .from('machine_hour_logs')
        .select('unit')
        .eq('machine_id', viewingMachine.id)
        .order('date', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (isMounted && data && data.length > 0) {
            setMachineUnit(data[0].unit || 'h');
          } else if (isMounted) {
            setMachineUnit('h');
          }
        });

      // 2. Fetch latest maintenance (R-MANT-02 or R-MANT-05) completed_date
      supabase
        .from('work_orders')
        .select('completed_date, closing_date')
        .eq('machine_id', viewingMachine.id)
        .eq('status', 'DONE')
        .in('form_type', ['R-MANT-02', 'R-MANT-05'])
        .order('completed_date', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (isMounted && data && data.length > 0) {
            const date = data[0].completed_date || data[0].closing_date;
            if (date) {
              setLastMaintenanceDate(date);
            } else {
              setLastMaintenanceDate(null);
            }
          } else if (isMounted) {
            setLastMaintenanceDate(null);
          }
        });
    }
    return () => { isMounted = false; };
  }, [viewingMachine]);

  // Gateway Modal State (IoT)
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [newMachine, setNewMachine] = useState<Partial<Machine> & { customIntervals?: string }>({
    name: '',
    plate: '',
    type: 'GENERIC',
    runningHours: 0,
    customIntervals: '',
    branch: 'Planta Principal',
    category: 'Producción',
    alias: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    capacity: '',
    currentRating: 0,
    frequency: 60,
    voltage: 480,
    power: 0,
    imageUrl: '',
    isActive: true, // Default
    documents: [],
    criticalParts: [] // Initial Kardex state
  });

  const [selectedKardexPartIot, setSelectedKardexPartIot] = useState<string>('');
  const [searchKardexPartIot, setSearchKardexPartIot] = useState<string>('');
  const [isKardexDropdownOpenIot, setIsKardexDropdownOpenIot] = useState(false);
  
  // Visual Asset Modal State (Non-IoT)
  const [showManualAssetModal, setShowManualAssetModal] = useState(false);
  const [selectedKardexPartManual, setSelectedKardexPartManual] = useState<string>('');
  const [searchKardexPartManual, setSearchKardexPartManual] = useState<string>('');
  const [isKardexDropdownOpenManual, setIsKardexDropdownOpenManual] = useState(false);

  const [newManualAsset, setNewManualAsset] = useState<Partial<Machine> & { customIntervals?: string }>({
    name: '',
    plate: '',
    type: 'GENERIC',
    zone: zones[0] || '',
    customIntervals: '',
    branch: 'Planta Principal',
    category: 'Producción',
    alias: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    capacity: '',
    currentRating: 0,
    frequency: 60,
    voltage: 480,
    power: 0,
    imageUrl: '',
    isActive: true, // Default
    documents: [],
    criticalParts: [] // Initial Kardex state
  });

  // Logic
  const filteredMachines = machines.filter(m => {
    const matchesSearch = assetSearch === '' ||
      m.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
      (m.plate && m.plate.toLowerCase().includes(assetSearch.toLowerCase())) ||
      (m.brand && m.brand.toLowerCase().includes(assetSearch.toLowerCase())) ||
      (m.model && m.model.toLowerCase().includes(assetSearch.toLowerCase()));

    const machineBranch = m.branch || '';
    const machineCategory = m.category || '';
    const machineType = m.type || '';

    const matchesBranch = filterBranch === '' || machineBranch === filterBranch;
    const matchesCategory = filterCategory === '' || machineCategory === filterCategory;
    const matchesType = filterType === '' || machineType === filterType;
    const matchesZone = filterZone === '' || m.zone === filterZone;
    const matchesActiveStatus = showInactive ? !m.isActive : m.isActive !== false;

    return matchesSearch && matchesBranch && matchesCategory && matchesType && matchesZone && matchesActiveStatus;
  });

  const openAddGateway = () => {
    if (!canManage) return;
    setEditingId(null);
    setNewMachine({
      name: '', plate: '', type: 'GENERIC', runningHours: 0, customIntervals: '',
      branch: branches[0] || 'Planta Principal', category: categories[0] || 'Producción', alias: '', isActive: true, brand: '', model: '', year: new Date().getFullYear(),
      capacity: '', currentRating: 0, frequency: 60, voltage: 480, power: 0, imageUrl: '', documents: []
    });
    setShowGatewayModal(true);
  };

  const openAddManual = () => {
    if (!canManage) return;
    setEditingId(null);
    setNewManualAsset({
      name: '', plate: '', type: 'GENERIC', zone: zones[0] || '', customIntervals: '',
      branch: branches[0] || 'Planta Principal', category: categories[0] || 'Producción', alias: '', isActive: true, brand: '', model: '', year: new Date().getFullYear(),
      capacity: '', currentRating: 0, frequency: 60, voltage: 480, power: 0, imageUrl: '', documents: []
    });
    setShowManualAssetModal(true);
  };

  const handleEditFromDetail = (m: Machine) => {
    if (!canManage) return;
    setViewingMachine(null);
    handleEditMachine(m);
  };

  const handleEditMachine = (m: Machine) => {
    if (!canManage) return;
    setEditingId(m.id);
    const intervals = m.intervals ? m.intervals.join(', ') : '';

    // Sanitize values against available configurated lists to avoid silent legacy "Production" bugs
    const validCategory = categories.includes(m.category || '') ? m.category : (categories[0] || 'Producción');
    const validBranch = branches.includes(m.branch || '') ? m.branch : (branches[0] || 'Planta Principal');

    const commonFields = {
      branch: validBranch,
      category: validCategory,
      alias: m.alias || '',
      isActive: m.isActive !== undefined ? m.isActive : true,
      brand: m.brand || '',
      model: m.model || '',
      year: m.year || new Date().getFullYear(),
      capacity: m.capacity || '',
      currentRating: m.currentRating || 0,
      frequency: m.frequency || 60,
      voltage: m.voltage || 480,
      power: m.power || 0,
      imageUrl: m.imageUrl || '',
      documents: m.documents || [],
      criticalParts: m.criticalParts || []
    };

    if (m.isIot) {
      setNewMachine({
        name: m.name,
        plate: m.plate,
        type: m.type,
        zone: m.zone || zones[0],
        runningHours: m.runningHours,
        customIntervals: intervals,
        ...commonFields
      });
      setShowGatewayModal(true);
    } else {
      setNewManualAsset({
        name: m.name,
        plate: m.plate || '',
        type: m.type || 'GENERIC',
        zone: m.zone || (zones.length > 0 ? zones[0] : ''),
        customIntervals: intervals,
        ...commonFields
      });
      setShowManualAssetModal(true);
    }
  };

  const handleGatewaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachine.name) return;

    const intervals = newMachine.customIntervals
      ? newMachine.customIntervals.split(',').map(s => s.trim())
      : ['360 Hours', '1080 Hours'];

    const commonUpdate = {
      name: newMachine.name!,
      plate: newMachine.plate || 'N/A',
      type: newMachine.type as any,
      zone: newMachine.zone,
      runningHours: Number(newMachine.runningHours) || 0,
      intervals: intervals,
      branch: newMachine.branch,
      category: newMachine.category,
      alias: newMachine.alias,
      isActive: newMachine.isActive,
      brand: newMachine.brand,
      model: newMachine.model,
      year: Number(newMachine.year),
      capacity: newMachine.capacity,
      currentRating: Number(newMachine.currentRating),
      frequency: Number(newMachine.frequency),
      voltage: Number(newMachine.voltage),
      power: Number(newMachine.power),
      imageUrl: newMachine.imageUrl,
      documents: newMachine.documents,
      criticalParts: newMachine.criticalParts
    };

    if (editingId) {
      const existing = machines.find(m => m.id === editingId);
      if (existing) {
        updateMachine({
          ...existing,
          ...commonUpdate
        });
      }
    } else {
      const machine: Machine = {
        id: crypto.randomUUID(),
        status: MachineStatus.IDLE,
        location: { x: 0, y: 0 },
        zone: zones[0],
        isIot: true,
        lastMaintenance: new Date().toISOString(),
        nextMaintenance: '',
        telemetry: { timestamp: new Date().toISOString(), temperature: 0, vibration: 0, pressure: 0, powerConsumption: 0 },
        history: [],
        ...commonUpdate
      };
      addMachine(machine);
    }

    setShowGatewayModal(false);
    setEditingId(null);
  };

  const handleManualAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newManualAsset.name) {
      alert("Falta el nombre del equipo");
      return;
    }

    const intervals = newManualAsset.customIntervals
      ? newManualAsset.customIntervals.split(',').map(s => s.trim())
      : ['Manual Check'];

    const commonUpdate = {
      name: newManualAsset.name!,
      plate: newManualAsset.plate || 'N/A',
      type: newManualAsset.type as any,
      zone: newManualAsset.zone,
      intervals: intervals,
      branch: newManualAsset.branch,
      category: newManualAsset.category,
      alias: newManualAsset.alias,
      isActive: newManualAsset.isActive,
      brand: newManualAsset.brand,
      model: newManualAsset.model,
      year: Number(newManualAsset.year),
      capacity: newManualAsset.capacity,
      currentRating: Number(newManualAsset.currentRating),
      frequency: Number(newManualAsset.frequency),
      voltage: Number(newManualAsset.voltage),
      power: Number(newManualAsset.power),
      imageUrl: newManualAsset.imageUrl,
      documents: newManualAsset.documents,
      criticalParts: newManualAsset.criticalParts
    };

    try {
      if (editingId) {
        const existing = machines.find(m => m.id === editingId);
        if (existing) {
          await updateMachine({
            ...existing,
            ...commonUpdate
          });
        }
      } else {
        const machine: Machine = {
          id: crypto.randomUUID(),
          status: MachineStatus.IDLE,
          location: { x: 0, y: 0 },
          isIot: false,
          runningHours: 0,
          lastMaintenance: new Date().toISOString(),
          nextMaintenance: '',
          telemetry: { timestamp: new Date().toISOString(), temperature: 0, vibration: 0, pressure: 0, powerConsumption: 0 },
          history: [],
          ...commonUpdate
        };
        await addMachine(machine);
      }

      setShowManualAssetModal(false);
      setEditingId(null);
    } catch (error: any) {
      console.error('Error saving machine:', error);
      alert(`❌ Error al guardar el equipo: ${error.message || 'Verifique la conexión o los permisos.'}`);
    }
  };

  return (
    <div className="h-full bg-industrial-900 flex flex-col overflow-hidden relative">
      <div className="p-6 border-b border-industrial-800 bg-industrial-900">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{t('assets.title')}</h2>
            <p className="text-industrial-500 text-sm">{t('config.subtitle')}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={openAddManual}
              disabled={!canManage}
              className={`${canManage ? 'bg-industrial-800 hover:bg-industrial-700' : 'bg-industrial-800/50 opacity-50 cursor-not-allowed'} text-white border border-industrial-600 px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2`}
              title={!canManage ? "No tiene permisos para agregar equipos" : ""}
            >
              {canManage ? <Box className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              Agregar Equipo
            </button>
            <button
              onClick={openAddGateway}
              disabled={!canManage}
              className={`${canManage ? 'bg-industrial-accent hover:bg-blue-600 shadow-lg' : 'bg-industrial-accent/50 opacity-50 cursor-not-allowed'} text-white px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2`}
              title={!canManage ? "No tiene permisos para agregar equipos" : ""}
            >
              {canManage ? <Wifi className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {t('assets.provision')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-industrial-900/50">
        <div className="space-y-6 animate-fadeIn">
          {/* Filters Section */}
          <div className="bg-industrial-800 p-4 rounded-lg border border-industrial-700 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Buscar por Nombre, Matrícula, Marca o Modelo..."
                  className="w-full bg-industrial-900 border border-industrial-600 rounded px-4 py-2 text-white outline-none focus:border-emerald-500 transition-colors pl-10"
                  value={assetSearch}
                  onChange={(e) => setMachineFilters({ search: e.target.value })}
                />
                <div className="absolute left-3 top-2.5 text-industrial-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                </div>
              </div>
              <button
                onClick={() => setMachineFilters({ showInactive: !showInactive })}
                className={`px-4 py-2 rounded text-sm font-medium border transition-colors flex items-center gap-2 whitespace-nowrap ${showInactive
                  ? 'bg-red-900/40 text-red-400 border-red-500/50 hover:bg-red-900/60'
                  : 'bg-industrial-900 text-industrial-400 border-industrial-600 hover:bg-industrial-800'
                  }`}
              >
                <Eye className="w-4 h-4" />
                {showInactive ? 'Viendo Inactivos' : 'Ver Inactivos'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <select
                className="bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                value={filterBranch}
                onChange={(e) => setMachineFilters({ branch: e.target.value })}
              >
                <option value="">Todas las Sucursales</option>
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select
                className="bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                value={filterCategory}
                onChange={(e) => setMachineFilters({ category: e.target.value })}
              >
                <option value="">Todas las Categorías</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                className="bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                value={filterType}
                onChange={(e) => setMachineFilters({ type: e.target.value })}
              >
                <option value="">Todos los Tipos</option>
                {assetTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                className="bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                value={filterZone}
                onChange={(e) => setMachineFilters({ zone: e.target.value })}
              >
                <option value="">Todas las Ubicaciones</option>
                {zones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-industrial-800 rounded-lg border border-industrial-700 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-industrial-400">
              <thead className="bg-industrial-900 text-xs uppercase font-bold text-industrial-500">
                <tr>
                  <th className="px-6 py-4">{t('assets.col.name')}</th>
                  <th className="px-6 py-4">Alias</th>
                  <th className="px-6 py-4">Zone / Line</th>
                  <th className="px-6 py-4">{t('assets.col.type')}</th>
                  <th className="px-6 py-4">{t('assets.col.protocol')}</th>
                  <th className="px-6 py-4">{t('assets.col.schedule')}</th>
                  <th className="px-6 py-4">Categoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-700">
                {filteredMachines.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-industrial-700/30 transition-colors cursor-pointer"
                    onClick={() => setViewingMachine(m)}
                  >
                    <td className="px-6 py-4 text-white font-medium">{m.name}</td>
                    <td className="px-6 py-4">
                      <span className="text-industrial-300 font-medium">{m.alias || '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-industrial-300 text-xs">{m.zone || 'Unassigned'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-industrial-900 rounded border border-industrial-600 text-xs font-mono">
                        {m.type || 'GENERIC'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {m.isIot ? (
                        <span className="text-emerald-500 flex items-center gap-1.5 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          OPC-UA
                        </span>
                      ) : (
                        <span className="text-industrial-500 flex items-center gap-1.5 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-industrial-500"></div>
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {maintenancePlans.find(p => p.machineId === m.id)?.intervals
                        .filter(i => i.hours > 0 || i.label)
                        .sort((a, b) => a.hours - b.hours)
                        .map(i => i.label || `${i.hours?.toLocaleString() || i.hours} h`)
                        .join(', ') || <span className="text-industrial-600 italic">Sin Programa</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-industrial-300 font-medium text-xs bg-industrial-900 px-2 py-1 rounded border border-industrial-700">{m.category || 'Sin Categoría'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <TablePagination
              totalItems={pagination.total}
              currentPage={pagination.page}
              itemsPerPage={pagination.limit}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </div>

          {/* --- DETAIL VIEW MODAL --- */}
          {viewingMachine && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-industrial-800 rounded-lg border border-industrial-600 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-industrial-700 bg-industrial-900/50 flex justify-between items-center">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Box size={18} className="text-industrial-accent" /> Ficha del Equipo
                  </h3>
                  <button onClick={() => setViewingMachine(null)} className="text-industrial-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  {/* Top Section: Image & Basic Info */}
                  <div className="flex gap-6">
                    <div className="w-40 h-40 bg-industrial-900 rounded-lg border border-industrial-700 flex items-center justify-center overflow-hidden shrink-0 p-2">
                       {viewingMachine.imageUrl ? (
                        <img src={viewingMachine.imageUrl} alt={viewingMachine.name} className="w-full h-full object-contain" />
                      ) : (
                        <Camera size={40} className="text-industrial-600" />
                      )}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h2 className="text-2xl font-bold text-white">{viewingMachine.name}</h2>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-industrial-400 font-mono">{viewingMachine.plate || 'N/A'}</span>
                          {viewingMachine.isActive === false ? (
                            <span className="px-2 py-0.5 bg-red-900/40 text-red-400 border border-red-800 rounded text-xs font-bold uppercase">Inactivo</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-900/40 text-emerald-400 border border-emerald-800 rounded text-xs font-bold uppercase">Activo</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-industrial-500 uppercase font-bold">Tipo / Categoría</label>
                          <p className="text-sm text-white">{viewingMachine.type} <span className="text-industrial-500">•</span> {viewingMachine.category}</p>
                        </div>
                        <div>
                          <label className="text-[10px] text-industrial-500 uppercase font-bold">Ubicación</label>
                          <p className="text-sm text-white">{viewingMachine.branch}</p>
                          <p className="text-xs text-industrial-400">{viewingMachine.zone || 'Sin Zona Asignada'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Technical Specs Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-industrial-400 uppercase border-b border-industrial-700 pb-2 mb-3">Especificaciones Técnicas</h4>
                    <div className="grid grid-cols-3 gap-4 bg-industrial-900/30 p-4 rounded border border-industrial-700/50">
                      <div>
                        <label className="text-[10px] text-industrial-500 uppercase">Marca</label>
                        <p className="text-sm text-white">{viewingMachine.brand || '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-industrial-500 uppercase">Modelo</label>
                        <p className="text-sm text-white">{viewingMachine.model || '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-industrial-500 uppercase">Año</label>
                        <p className="text-sm text-white">{viewingMachine.year || '-'}</p>
                      </div>

                      <div>
                        <label className="text-[10px] text-industrial-500 uppercase">Voltage (V)</label>
                        <p className="text-sm text-white">{viewingMachine.voltage ? `${viewingMachine.voltage}V` : '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-industrial-500 uppercase">Frecuencia (Hz)</label>
                        <p className="text-sm text-white">{viewingMachine.frequency ? `${viewingMachine.frequency}Hz` : '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-industrial-500 uppercase">Potencia (KVA)</label>
                        <p className="text-sm text-white">{viewingMachine.power ? `${viewingMachine.power} KVA` : '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Maintenance Info */}
                  <div>
                    <h4 className="text-xs font-bold text-industrial-400 uppercase border-b border-industrial-700 pb-2 mb-3">Mantenimiento</h4>
                    <div className="flex gap-4">
                      <div className="flex-1 bg-industrial-900/30 p-3 rounded border border-industrial-700/50 flex items-center gap-3">
                        <Clock className="text-industrial-500" size={20} />
                        <div>
                          <label className="text-[10px] text-industrial-500 uppercase">Registro de Uso</label>
                          <p className="text-lg font-mono text-white">{viewingMachine.runningHours?.toLocaleString() || '0'} {machineUnit}</p>
                        </div>
                      </div>
                      <div className="flex-1 bg-industrial-900/30 p-3 rounded border border-industrial-700/50 flex items-center gap-3">
                        <Calendar className="text-industrial-500" size={20} />
                        <div>
                          <label className="text-[10px] text-industrial-500 uppercase">Último Mantenimiento</label>
                          <p className="text-sm text-white">
                            {lastMaintenanceDate ? new Date(lastMaintenanceDate).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Critical Parts (Kardex) Section */}
                  {viewingMachine.criticalParts && viewingMachine.criticalParts.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-bold text-industrial-400 uppercase border-b border-industrial-700 pb-2 mb-3">
                        Repuestos Asociados (Kardex)
                      </h4>
                      <div className="bg-industrial-900/50 rounded border border-industrial-700/50 overflow-hidden">
                        <table className="w-full text-left text-sm text-white">
                          <thead className="bg-industrial-800 text-xs text-industrial-400">
                            <tr>
                              <th className="px-4 py-2 font-medium">SKU / Repuesto</th>
                              <th className="px-4 py-2 font-medium text-right">Stock Actual</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-industrial-700/50">
                            {viewingMachine.criticalParts.map(partId => {
                              const partData = parts.find(p => p.id === partId);
                              if (!partData) return null;
                              return (
                                <tr key={partId} className="hover:bg-industrial-800/50 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-white">{partData.name}</p>
                                    <p className="text-[10px] text-industrial-500 font-mono mt-0.5">{partData.partNumber}</p>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${partData.currentStock <= partData.minStock ? 'bg-red-900/50 text-red-400 border border-red-800/50' : 'bg-emerald-900/50 text-emerald-400 border border-emerald-800/50'}`}>
                                      {partData.currentStock} {partData.unitOfMeasure ? partData.unitOfMeasure : 'Und'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Documents Section */}
                  {viewingMachine.documents && viewingMachine.documents.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-industrial-400 uppercase border-b border-industrial-700 pb-2 mb-3">
                        Documentos Adjuntos
                      </h4>
                      <div className="space-y-2">
                        {viewingMachine.documents.map((doc, idx) => {
                          // Soportar tanto formato nuevo (MachineDocument) como legacy (string)
                          const isLegacyFormat = typeof doc === 'string';
                          const docName = isLegacyFormat ? doc : doc.name;
                          const docUrl = isLegacyFormat ? '#' : doc.url;
                          const docSize = isLegacyFormat ? 0 : doc.size;
                          const docDate = isLegacyFormat ? null : doc.uploadedAt;

                          return (
                            <div
                              key={idx}
                              className="bg-industrial-900/30 p-3 rounded border border-industrial-700/50 flex items-center justify-between group hover:bg-industrial-900/50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileText className="text-industrial-500 flex-shrink-0" size={20} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-white font-medium truncate">{docName}</p>
                                  {!isLegacyFormat && docSize > 0 && (
                                    <p className="text-xs text-industrial-500">
                                      {DocumentService.formatFileSize(docSize)}
                                      {docDate && ` • ${new Date(docDate).toLocaleDateString()}`}
                                    </p>
                                  )}
                                  {isLegacyFormat && (
                                    <p className="text-xs text-industrial-500 italic">Formato legacy - sin metadata</p>
                                  )}
                                </div>
                              </div>
                              {!isLegacyFormat && (
                                <div className="flex gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => window.open(docUrl, '_blank')}
                                    className="p-2 bg-industrial-700 hover:bg-industrial-600 rounded text-white transition-colors"
                                    title="Ver documento"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await DocumentService.downloadDocument(docUrl, docName);
                                      } catch (error) {
                                        console.error('Error downloading document:', error);
                                        alert('Error al descargar el documento');
                                      }
                                    }}
                                    className="p-2 bg-industrial-700 hover:bg-industrial-600 rounded text-white transition-colors"
                                    title="Descargar"
                                  >
                                    <Download size={16} />
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!window.confirm('¿Estás seguro de eliminar este documento?')) return;

                                      try {
                                        console.log('Attempting to delete document:', docName);

                                        // 1. Delete from Storage (if applicable)
                                        // Only attempt storage deletion for non-legacy files
                                        if (!isLegacyFormat && docUrl) {
                                          const filePath = DocumentService.extractFilePathFromUrl(docUrl);
                                          console.log('Extracted file path for deletion:', filePath);

                                          if (filePath) {
                                            await DocumentService.deleteDocument(filePath);
                                            console.log('Document deleted from storage successfully');
                                          } else {
                                            console.warn('Could not extract file path from URL, skipping storage deletion:', docUrl);
                                          }
                                        }

                                        // 2. Remove from Machine State - Handle both array types safely
                                        const currentDocs = viewingMachine.documents || [];
                                        const updatedDocuments = currentDocs.filter((_, i) => i !== idx);

                                        // 3. Prepare updated machine object
                                        const updatedMachine = {
                                          ...viewingMachine,
                                          documents: updatedDocuments
                                        };

                                        console.log('Updating machine state with new documents list:', updatedDocuments);

                                        // 4. Update Database
                                        await updateMachine(updatedMachine);
                                        console.log('Database updated successfully');

                                        // 5. Update Viewing State
                                        // Ensure we don't set to null if the component is still mounted
                                        setViewingMachine(prev => prev ? ({ ...prev, documents: updatedDocuments }) : null);

                                      } catch (error: any) {
                                        console.error('Error deleting document:', error);
                                        // Still try to update UI if it was just a storage error? Maybe risky.
                                        alert(`Error al eliminar el documento: ${error.message || 'Error desconocido'}`);
                                      }
                                    }}
                                    type="button" // Prevent form submission
                                    className="p-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-industrial-700 bg-industrial-900/50 flex justify-end gap-3">
                  <button
                    onClick={() => setViewingMachine(null)}
                    className="px-4 py-2 text-sm text-industrial-400 hover:text-white"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => handleEditFromDetail(viewingMachine)}
                    disabled={!canManage}
                    className={`px-4 py-2 ${canManage ? 'bg-industrial-600 hover:bg-industrial-500' : 'bg-industrial-700/50 opacity-50 cursor-not-allowed'} text-white rounded text-sm font-bold shadow flex items-center gap-2`}
                    title={!canManage ? "No tiene permisos para editar equipos" : ""}
                  >
                    {canManage ? <Pencil size={14} /> : <Lock size={14} />} Editar Equipo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL - Add Gateway/Machine (IoT) */}
      {showGatewayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-industrial-800 rounded-lg border border-industrial-600 shadow-2xl w-full max-w-5xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-industrial-700 flex justify-between items-center bg-industrial-900/50">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Server className="w-4 h-4 text-industrial-accent" />
                {editingId ? 'Editar Equipo IoT' : 'Nuevo Equipo IoT'}
              </h3>
              <button onClick={() => setShowGatewayModal(false)} className="text-industrial-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleGatewaySubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Classification Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.branch')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.branch}
                    onChange={e => setNewMachine({ ...newMachine, branch: e.target.value })}
                  >
                    <option value="" disabled>Seleccionar Sucursal</option>
                    {branches.map(branch => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.category')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.category || categories[0] || 'Producción'}
                    onChange={e => {
                      e.stopPropagation();
                      setNewMachine(prev => ({ ...prev, category: e.target.value }));
                    }}
                  >
                    <option value="" disabled>Seleccionar Categoría</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.location')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.zone || zones[0]}
                    onChange={e => setNewMachine({ ...newMachine, zone: e.target.value })}
                  >
                    <option value="" disabled>Seleccionar Zona</option>
                    {zones.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.col.type')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.type}
                    onChange={e => setNewMachine({ ...newMachine, type: e.target.value })}
                  >
                    <option value="" disabled>Seleccionar Tipo</option>
                    {assetTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">Estatus</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.isActive ? 'true' : 'false'}
                    onChange={e => setNewMachine({ ...newMachine, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="h-px bg-industrial-700 my-2"></div>
              <h4 className="text-sm font-bold text-white mb-2">Detalles del Equipo</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.col.name')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.name} onChange={e => setNewMachine({ ...newMachine, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.alias')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.alias} onChange={e => setNewMachine({ ...newMachine, alias: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.brand')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.brand} onChange={e => setNewMachine({ ...newMachine, brand: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.model')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.model} onChange={e => setNewMachine({ ...newMachine, model: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('form.plate')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.plate} onChange={e => setNewMachine({ ...newMachine, plate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.year')}</label>
                  <input type="number" max="9999" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.year} onChange={e => setNewMachine({ ...newMachine, year: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.capacity')}</label>
                  <input type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.capacity} onChange={e => setNewMachine({ ...newMachine, capacity: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.current')}</label>
                  <input type="number" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.currentRating} onChange={e => setNewMachine({ ...newMachine, currentRating: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.frequency')}</label>
                  <input type="number" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.frequency} onChange={e => setNewMachine({ ...newMachine, frequency: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.voltage')}</label>
                  <input type="number" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.voltage} onChange={e => setNewMachine({ ...newMachine, voltage: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.power')}</label>
                  <input type="number" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newMachine.power} onChange={e => setNewMachine({ ...newMachine, power: Number(e.target.value) })} />
                </div>
              </div>

              {/* Maintenance & IoT */}
              <div className="pt-2">
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.col.schedule')}</label>
                  <div className="bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm min-h-[38px] flex items-center">
                    {editingId && maintenancePlans.find(p => p.machineId === editingId)?.intervals.length ? (
                      <div className="flex flex-wrap gap-2">
                        {maintenancePlans.find(p => p.machineId === editingId)?.intervals
                          .filter(i => i.hours > 0 || i.label)
                          .sort((a, b) => a.hours - b.hours)
                          .map(i => (
                            <span key={i.id} className="bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded text-xs border border-blue-800">
                              {i.label || `${i.hours?.toLocaleString() || i.hours} Horas`}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <span className="text-industrial-400 italic text-xs">Definir los Intervalos de Mantenimientos en las configuraciones de Mantenimientos</span>
                    )}
                  </div>
                </div>
                {/* Simulated Discovery Message */}
                <div className="mt-6 p-5 bg-blue-900/30 border border-blue-500/50 rounded-lg flex items-center gap-5 shadow-lg shadow-blue-900/20">
                  <div className="bg-blue-500/20 p-3 rounded-full">
                    <Wifi className="w-8 h-8 text-blue-400 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base text-blue-100 font-bold tracking-wide">Descubrimiento IoT & Protocolo</p>
                    <p className="text-sm text-blue-300">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                      Handshake OPC-UA Activo. Protocolo: <span className="font-mono text-blue-200 bg-blue-900/50 px-2 py-0.5 rounded border border-blue-700">{newMachine.type === 'GENERIC' ? 'Estándar' : newMachine.type}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Critical Spare Parts Section (Kardex) */}
              <div className="pt-4 mt-4 border-t border-industrial-700">
                <h4 className="text-sm font-bold text-white mb-3">Repuestos Asociados (Kardex)</h4>
                
                <div className="bg-industrial-900/50 p-4 rounded border border-industrial-700/50 space-y-4">
                  <div className="flex gap-2 items-end relative">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-industrial-400 font-medium">Buscar y Seleccionar Repuesto</label>
                      <input 
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-400 focus:outline-none"
                        value={searchKardexPartIot}
                        onChange={(e) => {
                          setSearchKardexPartIot(e.target.value);
                          setIsKardexDropdownOpenIot(true);
                          if (!e.target.value) setSelectedKardexPartIot('');
                        }}
                        onFocus={() => setIsKardexDropdownOpenIot(true)}
                        onBlur={() => setTimeout(() => setIsKardexDropdownOpenIot(false), 200)}
                      />
                      {isKardexDropdownOpenIot && (
                        <ul className="absolute z-50 w-[calc(100%-46px)] bg-industrial-800 border border-industrial-600 rounded mt-1 max-h-48 overflow-y-auto shadow-xl">
                          {parts.filter(p => (p.name || '').toLowerCase().includes((searchKardexPartIot || '').toLowerCase()) || (p.partNumber || '').toLowerCase().includes((searchKardexPartIot || '').toLowerCase())).length === 0 ? (
                            <li className="p-2 text-sm text-industrial-500 italic">No se encontraron repuestos</li>
                          ) : (
                            parts
                              .filter(p => (p.name || '').toLowerCase().includes((searchKardexPartIot || '').toLowerCase()) || (p.partNumber || '').toLowerCase().includes((searchKardexPartIot || '').toLowerCase()))
                              .map(p => (
                                <li 
                                  key={p.id} 
                                  className={`p-2 text-sm cursor-pointer border-b border-industrial-700/50 last:border-0 hover:bg-industrial-700 ${selectedKardexPartIot === p.id ? 'bg-industrial-700 text-white' : 'text-industrial-300'}`}
                                  onClick={() => {
                                    setSelectedKardexPartIot(p.id);
                                    setSearchKardexPartIot(p.partNumber ? `${p.partNumber} - ${p.name}` : p.name);
                                    setIsKardexDropdownOpenIot(false);
                                  }}
                                >
                                  <div className="font-medium text-white">{p.name}</div>
                                  <div className="text-[10px] text-industrial-400 font-mono flex justify-between">
                                    <span>{p.partNumber}</span>
                                    <span className={p.currentStock > p.minStock ? 'text-emerald-400' : 'text-yellow-400'}>Stock: {p.currentStock}</span>
                                  </div>
                                </li>
                              ))
                          )}
                        </ul>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!selectedKardexPartIot || (newMachine.criticalParts?.includes(selectedKardexPartIot))}
                      onClick={() => {
                        if (selectedKardexPartIot && !newMachine.criticalParts?.includes(selectedKardexPartIot)) {
                          setNewMachine(prev => ({ ...prev, criticalParts: [...(prev.criticalParts || []), selectedKardexPartIot] }));
                          setSelectedKardexPartIot('');
                          setSearchKardexPartIot('');
                        }
                      }}
                      className="px-3 py-2 bg-industrial-700 hover:bg-industrial-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-industrial-600 h-[38px] flex items-center justify-center transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {newMachine.criticalParts && newMachine.criticalParts.length > 0 && (
                    <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-2">
                      {newMachine.criticalParts.map(partId => {
                        const partObj = parts.find(p => p.id === partId);
                        if (!partObj) return null;
                        
                        return (
                          <div key={partId} className="flex items-center justify-between bg-industrial-800 p-2 rounded border border-industrial-700">
                            <div className="flex items-center gap-3">
                              <Box className="text-industrial-400" size={16} />
                              <div>
                                <p className="text-sm text-white font-medium">{partObj.name}</p>
                                <p className="text-[10px] text-industrial-500 font-mono">{partObj.partNumber}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${partObj.currentStock <= partObj.minStock ? 'bg-red-900/50 text-red-400 border border-red-800' : 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'}`}>
                                  Stock: {partObj.currentStock}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setNewMachine(prev => ({ ...prev, criticalParts: prev.criticalParts?.filter(id => id !== partId) }))}
                                className="text-industrial-500 hover:text-red-400 transition-colors p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Files Section */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-industrial-700">
                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.image')}</label>
                  <div className="h-32 border-2 border-dashed border-industrial-600 rounded flex flex-col items-center justify-center relative hover:border-industrial-400 transition-colors">
                    {newMachine.imageUrl ? (
                      <div className="h-full w-full p-1 flex items-center justify-center">
                        <img src={newMachine.imageUrl} className="h-full w-full object-contain" alt="Asset" />
                      </div>
                    ) : (
                      <div className="text-center p-2">
                        <Camera className="w-6 h-6 text-industrial-500 mx-auto mb-1" />
                        <span className="text-[10px] text-industrial-400">Toque para Subir</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const reader = new FileReader();
                          reader.onloadend = () => setNewMachine({ ...newMachine, imageUrl: reader.result as string });
                          reader.readAsDataURL(e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Documents Upload */}
                <div className="space-y-2">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.docs')}</label>
                  <div className="bg-industrial-900 border border-industrial-600 rounded p-2 h-32 overflow-y-auto">
                    {newMachine.documents && newMachine.documents.length > 0 ? (
                      <ul className="text-xs space-y-1">
                        {newMachine.documents.map((doc, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-industrial-300">
                            <FileText size={10} /> Doc {idx + 1}
                          </li>
                        ))}
                      </ul>
                    ) : <span className="text-xs text-industrial-500 italic">No documents</span>}

                    <label className="mt-2 flex items-center justify-center gap-1 text-xs text-blue-400 cursor-pointer hover:underline">
                      <Plus size={10} /> Agregar Documento
                      <input type="file" className="hidden"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];

                            try {
                              // Subir archivo a Supabase Storage
                              const document = await DocumentService.uploadDocument(
                                newMachine.id || 'temp',
                                file
                              );

                              // Agregar documento con metadata completa
                              setNewMachine(prev => ({
                                ...prev,
                                documents: [...(prev.documents || []), document]
                              }));
                            } catch (error) {
                              console.error('Error uploading document:', error);
                              alert('Error al subir el archivo. Verifica que el bucket "machine-documents" esté configurado en Supabase.');
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-industrial-700 mt-2">
                <button
                  type="button"
                  onClick={() => setShowGatewayModal(false)}
                  className="px-4 py-2 rounded text-sm text-industrial-300 hover:text-white hover:bg-industrial-700 transition-colors"
                >
                  {t('workforce.modal.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-sm bg-industrial-accent text-white font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-900/20"
                >
                  {editingId ? 'Guardar Cambios' : 'Registrar Activo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - Add Manual Asset (Non-IoT) */}
      {showManualAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-industrial-800 rounded-lg border border-industrial-600 shadow-2xl w-full max-w-5xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-industrial-700 flex justify-between items-center bg-industrial-900/50">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Box className="w-4 h-4 text-industrial-500" />
                {editingId ? 'Editar Equipo' : 'Nuevo Equipo'}
              </h3>
              <button onClick={() => setShowManualAssetModal(false)} className="text-industrial-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleManualAssetSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.branch')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.branch}
                    onChange={e => setNewManualAsset({ ...newManualAsset, branch: e.target.value })}
                  >
                    <option value="" disabled>Seleccionar Sucursal</option>
                    {branches.map(branch => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.category')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.category || categories[0] || 'Producción'}
                    onChange={e => {
                      e.stopPropagation();
                      setNewManualAsset(prev => ({ ...prev, category: e.target.value }));
                    }}
                  >
                    <option value="" disabled>Seleccionar Categoría</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.location')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.zone || zones[0]}
                    onChange={e => setNewManualAsset({ ...newManualAsset, zone: e.target.value })}
                  >
                    {zones.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.col.type')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.type}
                    onChange={e => setNewManualAsset({ ...newManualAsset, type: e.target.value })}
                  >
                    <option value="" disabled>Seleccionar Tipo</option>
                    {assetTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    {newManualAsset.type === 'GENERIC' && !assetTypes.includes('GENERIC') && (
                      <option value="GENERIC">GENERIC</option>
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">Estatus</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.isActive ? 'true' : 'false'}
                    onChange={e => setNewManualAsset({ ...newManualAsset, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="h-px bg-industrial-700 my-2"></div>
              <h4 className="text-sm font-bold text-white mb-2">Detalles del Equipo</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.col.name')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.name} onChange={e => setNewManualAsset({ ...newManualAsset, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.alias')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.alias} onChange={e => setNewManualAsset({ ...newManualAsset, alias: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.brand')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.brand} onChange={e => setNewManualAsset({ ...newManualAsset, brand: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.model')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.model} onChange={e => setNewManualAsset({ ...newManualAsset, model: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('form.plate')} *</label>
                  <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    placeholder="e.g. 10203040"
                    value={newManualAsset.plate} onChange={e => setNewManualAsset({ ...newManualAsset, plate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.year')}</label>
                  <input type="number" max="9999" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.year} onChange={e => setNewManualAsset({ ...newManualAsset, year: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.capacity')}</label>
                  <input type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.capacity} onChange={e => setNewManualAsset({ ...newManualAsset, capacity: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.current')}</label>
                  <input type="number" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.currentRating} onChange={e => setNewManualAsset({ ...newManualAsset, currentRating: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.frequency')}</label>
                  <input type="number" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.frequency} onChange={e => setNewManualAsset({ ...newManualAsset, frequency: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.voltage')}</label>
                  <input type="number" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.voltage} onChange={e => setNewManualAsset({ ...newManualAsset, voltage: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.power')}</label>
                  <input type="number" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                    value={newManualAsset.power} onChange={e => setNewManualAsset({ ...newManualAsset, power: Number(e.target.value) })} />
                </div>
              </div>

              <div className="pt-2">
                <div className="space-y-1">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.col.schedule')}</label>
                  <div className="bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm min-h-[38px] flex items-center">
                    {editingId && maintenancePlans.find(p => p.machineId === editingId)?.intervals.length ? (
                      <div className="flex flex-wrap gap-2">
                        {maintenancePlans.find(p => p.machineId === editingId)?.intervals.map(i => (
                          <span key={i.id} className="bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded text-xs border border-blue-800">
                            {i.label || `${i.hours?.toLocaleString() || i.hours} Horas`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-industrial-400 italic text-xs">Definir los Intervalos de Mantenimientos en las configuraciones de Mantenimientos</span>
                    )}
                  </div>
                </div>
                {/* Disclaimer */}
                <div className="mt-4 bg-industrial-900/50 p-3 rounded border border-industrial-700/50">
                  <p className="text-xs text-industrial-400 flex items-center gap-2">
                    <Box className="w-3 h-3" />
                    Este equipo no es IoT. Se verá en el mapa, pero requiere entrada de data manual.
                  </p>
                </div>
              </div>

              {/* Critical Spare Parts Section (Kardex) */}
              <div className="pt-4 mt-4 border-t border-industrial-700">
                <h4 className="text-sm font-bold text-white mb-3">Repuestos Asociados (Kardex)</h4>
                
                <div className="bg-industrial-900/50 p-4 rounded border border-industrial-700/50 space-y-4">
                  <div className="flex gap-2 items-end relative">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-industrial-400 font-medium">Buscar y Seleccionar Repuesto</label>
                      <input 
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-400 focus:outline-none"
                        value={searchKardexPartManual}
                        onChange={(e) => {
                          setSearchKardexPartManual(e.target.value);
                          setIsKardexDropdownOpenManual(true);
                          if (!e.target.value) setSelectedKardexPartManual('');
                        }}
                        onFocus={() => setIsKardexDropdownOpenManual(true)}
                        onBlur={() => setTimeout(() => setIsKardexDropdownOpenManual(false), 200)}
                      />
                      {isKardexDropdownOpenManual && (
                        <ul className="absolute z-50 w-[calc(100%-46px)] bg-industrial-800 border border-industrial-600 rounded mt-1 max-h-48 overflow-y-auto shadow-xl">
                          {parts.filter(p => (p.name || '').toLowerCase().includes((searchKardexPartManual || '').toLowerCase()) || (p.partNumber || '').toLowerCase().includes((searchKardexPartManual || '').toLowerCase())).length === 0 ? (
                            <li className="p-2 text-sm text-industrial-500 italic">No se encontraron repuestos</li>
                          ) : (
                            parts
                              .filter(p => (p.name || '').toLowerCase().includes((searchKardexPartManual || '').toLowerCase()) || (p.partNumber || '').toLowerCase().includes((searchKardexPartManual || '').toLowerCase()))
                              .map(p => (
                                <li 
                                  key={p.id} 
                                  className={`p-2 text-sm cursor-pointer border-b border-industrial-700/50 last:border-0 hover:bg-industrial-700 ${selectedKardexPartManual === p.id ? 'bg-industrial-700 text-white' : 'text-industrial-300'}`}
                                  onClick={() => {
                                    setSelectedKardexPartManual(p.id);
                                    setSearchKardexPartManual(p.partNumber ? `${p.partNumber} - ${p.name}` : p.name);
                                    setIsKardexDropdownOpenManual(false);
                                  }}
                                >
                                  <div className="font-medium text-white">{p.name}</div>
                                  <div className="text-[10px] text-industrial-400 font-mono flex justify-between">
                                    <span>{p.partNumber}</span>
                                    <span className={p.currentStock > p.minStock ? 'text-emerald-400' : 'text-yellow-400'}>Stock: {p.currentStock}</span>
                                  </div>
                                </li>
                              ))
                          )}
                        </ul>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!selectedKardexPartManual || (newManualAsset.criticalParts?.includes(selectedKardexPartManual))}
                      onClick={() => {
                        if (selectedKardexPartManual && !newManualAsset.criticalParts?.includes(selectedKardexPartManual)) {
                          setNewManualAsset(prev => ({ ...prev, criticalParts: [...(prev.criticalParts || []), selectedKardexPartManual] }));
                          setSelectedKardexPartManual('');
                          setSearchKardexPartManual('');
                        }
                      }}
                      className="px-3 py-2 bg-industrial-700 hover:bg-industrial-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-industrial-600 h-[38px] flex items-center justify-center transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {newManualAsset.criticalParts && newManualAsset.criticalParts.length > 0 && (
                    <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-2">
                      {newManualAsset.criticalParts.map(partId => {
                        const partObj = parts.find(p => p.id === partId);
                        if (!partObj) return null;
                        
                        return (
                          <div key={partId} className="flex items-center justify-between bg-industrial-800 p-2 rounded border border-industrial-700">
                            <div className="flex items-center gap-3">
                              <Box className="text-industrial-400" size={16} />
                              <div>
                                <p className="text-sm text-white font-medium">{partObj.name}</p>
                                <p className="text-[10px] text-industrial-500 font-mono">{partObj.partNumber}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${partObj.currentStock <= partObj.minStock ? 'bg-red-900/50 text-red-400 border border-red-800' : 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'}`}>
                                  Stock: {partObj.currentStock}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setNewManualAsset(prev => ({ ...prev, criticalParts: prev.criticalParts?.filter(id => id !== partId) }))}
                                className="text-industrial-500 hover:text-red-400 transition-colors p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Files Section */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-industrial-700">
                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.image')}</label>
                  <div className="h-32 border-2 border-dashed border-industrial-600 rounded flex flex-col items-center justify-center relative hover:border-industrial-400 transition-colors">
                    {newManualAsset.imageUrl ? (
                      <div className="h-full w-full p-1 flex items-center justify-center">
                        <img src={newManualAsset.imageUrl} className="h-full w-full object-contain" alt="Asset" />
                      </div>
                    ) : (
                      <div className="text-center p-2">
                        <Camera className="w-6 h-6 text-industrial-500 mx-auto mb-1" />
                        <span className="text-[10px] text-industrial-400">Toque para Subir</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const reader = new FileReader();
                          reader.onloadend = () => setNewManualAsset({ ...newManualAsset, imageUrl: reader.result as string });
                          reader.readAsDataURL(e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Documents Upload */}
                <div className="space-y-2">
                  <label className="text-xs text-industrial-400 font-medium">{t('assets.docs')}</label>
                  <div className="bg-industrial-900 border border-industrial-600 rounded p-2 h-32 overflow-y-auto">
                    {newManualAsset.documents && newManualAsset.documents.length > 0 ? (
                      <ul className="text-xs space-y-1">
                        {newManualAsset.documents.map((doc, idx) => {
                          const docName = typeof doc === 'string' ? doc : doc.name;
                          return (
                            <li key={idx} className="flex items-center gap-2 text-industrial-300">
                              <FileText size={10} /> {docName}
                            </li>
                          );
                        })}
                      </ul>
                    ) : <span className="text-xs text-industrial-500 italic">Sin documentos</span>}

                    <label className="mt-2 flex items-center justify-center gap-1 text-xs text-blue-400 cursor-pointer hover:underline">
                      <Plus size={10} /> Agregar Documento
                      <input type="file" className="hidden"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            try {
                              // Subir archivo a Supabase Storage
                              const document = await DocumentService.uploadDocument(
                                newManualAsset.id || 'temp', // Use temp ID if new, will need to handle this
                                file
                              );

                              // Agregar documento con metadata completa
                              setNewManualAsset(prev => ({
                                ...prev,
                                documents: [...(prev.documents || []), document]
                              }));
                            } catch (error) {
                              console.error('Error uploading document:', error);
                              alert('Error al subir el archivo. Verifica que el bucket "machine-documents" esté configurado en Supabase.');
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-industrial-700 mt-2">
                <button
                  type="button"
                  onClick={() => setShowManualAssetModal(false)}
                  className="px-4 py-2 rounded text-sm text-industrial-300 hover:text-white hover:bg-industrial-700 transition-colors"
                >
                  {t('workforce.modal.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-sm bg-industrial-700 hover:bg-industrial-600 text-white font-medium transition-colors border border-industrial-600"
                >
                  {editingId ? 'Guardar Cambios' : 'Registrar Activo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
