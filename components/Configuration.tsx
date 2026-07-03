import React, { useState, useRef, useEffect } from 'react';
import { Machine, Technician, MachineStatus, MaintenanceTask, MaintenancePlan, MaintenanceInterval, ZoneStructure, UserRole } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { UserManagement } from './user/UserManagement';
import { RoleManagement } from './user/RoleManagement';
import { ProtocolBuilder } from './ProtocolBuilder';
import { useMasterStore } from '../src/stores/useMasterStore';
import { NotificationSettings } from './NotificationSettings';
import { X, UserPlus, Mail, Briefcase, Clock, Calendar, Server, Cpu, Wifi, Plus, MapPin, Layout, Box, Settings, Shield, Pencil, Camera, FileText, Trash2, CornerDownRight, Edit2, Check, Scale, Bell, Lock, Truck } from 'lucide-react';

interface ConfigurationProps {
  machines: Machine[];
  technicians: Technician[];
  onAddTechnician: (tech: Technician) => void;
  onAddMachine: (machine: Machine) => void;
  onUpdateMachine: (machine: Machine) => void;
  settings?: {
    plantName: string;
    taxId: string;
    address: string;
    timezone: string;
    currency: string;
    logoUrl: string;
  };
  onUpdateSettings?: (newSettings: any) => void;
  zoneStructures: ZoneStructure[]; // Renamed prop to match internal usage
  onAddZone: (zone: ZoneStructure) => void;
  onUpdateZone: (zone: ZoneStructure) => void;
  onRemoveZone: (id: string) => void;
}

type Tab = 'GENERAL' | 'ZONES' | 'EQUIPMENT' | 'INVENTORY' | 'PROTOCOLS' | 'WORKFORCE' | 'ROLES' | 'NOTIFICATIONS';

export const Configuration: React.FC<ConfigurationProps> = ({
  machines: propMachines, // Renamed to avoid conflict with store
  technicians: propTechnicians, // Renamed to avoid conflict with store
  onAddTechnician,
  onAddMachine,
  onUpdateMachine,
  settings,
  onUpdateSettings,
  zoneStructures, // No alias needed
  onAddZone,
  onUpdateZone,
  onRemoveZone
}: ConfigurationProps) => {
  const {
    machines, addMachine, updateMachine,
    technicians, addTechnician,
    parts, addPart,
    zones: storeZoneStructures, addZone: storeAddZone, updateZone: storeUpdateZone, removeZone: storeRemoveZone, reorderZones,
    plantSettings, updateSettings,
    // Protocol Actions
    maintenancePlans, addMaintenancePlan, updateMaintenancePlan, removeMaintenancePlan,
    // Config Lists
    branches, addBranch, removeBranch, updateBranch,
    categories, addCategory, removeCategory, updateCategory,
    assetTypes, addAssetType, removeAssetType, updateAssetType,
    // Spare Parts Config
    partCategories, addPartCategory, removePartCategory, updatePartCategory,
    partLocations, addPartLocation, removePartLocation, updatePartLocation,
    partUnits, addPartUnit, removePartUnit, updatePartUnit,
    partSuppliers, addPartSupplier, removePartSupplier, updatePartSupplier


  } = useMasterStore();

  const [activeTab, setActiveTab] = useState<Tab>('GENERAL');

  // Local State for Settings Form
  const [settingsForm, setSettingsForm] = useState(settings || {
    plantName: '',
    taxId: '',
    address: '',
    logoUrl: '',
    timezone: 'AST',
    currency: 'DOP'
  });



  // Sync prop changes to local state (for initial load)
  React.useEffect(() => {
    if (settings) {
      setSettingsForm(settings);
    }
  }, [settings]);


  const { t } = useLanguage();

  // const [settingsTab, setSettingsTab] = useState<'GENERAL' | 'ZONES' | 'EQUIPMENT' | 'SPARE_PARTS'>('GENERAL'); // Removed nested state

  // Protocol State (Machine -> Intervals -> Tasks)
  const [selectedProtocolMachineId, setSelectedProtocolMachineId] = useState<string | null>(null);
  const [activeIntervalTab, setActiveIntervalTab] = useState<string | null>(null);

  // Removed local maintenancePlans state in favor of store

  const [machineToAssociate, setMachineToAssociate] = useState<string>('');
  const [machineSearchQuery, setMachineSearchQuery] = useState('');
  const [isMachineSearchOpen, setIsMachineSearchOpen] = useState(false);
  const { hasRole, hasPermission } = useAuth();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Interval Addition State
  const [isAddingInterval, setIsAddingInterval] = useState(false);
  const [newIntervalHours, setNewIntervalHours] = useState('');
  const [intervalToDelete, setIntervalToDelete] = useState<string | null>(null);
  const [machineToRemove, setMachineToRemove] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsMachineSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);



  const handleAssociateMachine = () => {
    if (machineToAssociate) {
      // Check if already exists
      if (maintenancePlans.some(p => p.machineId === machineToAssociate)) {
        alert('Este equipo ya tiene un plan de mantenimiento asociado.');
        return;
      }

      setMachineToAssociate('');
      setMachineSearchQuery('');

      const newPlan: MaintenancePlan = {
        machineId: machineToAssociate,
        intervals: []
      };

      addMaintenancePlan(newPlan);
      setSelectedProtocolMachineId(machineToAssociate);
    }
  };

  const handleSaveProtocol = async (tasks: MaintenanceTask[]) => {
    if (selectedProtocolMachineId && activeIntervalTab) {
      const existingPlan = maintenancePlans.find(p => p.machineId === selectedProtocolMachineId);

      if (existingPlan) {
        const updatedPlan = {
          ...existingPlan,
          intervals: existingPlan.intervals.map(i =>
            i.id === activeIntervalTab ? { ...i, tasks } : i
          )
        };
        try {
          await updateMaintenancePlan(updatedPlan);
          return true;
        } catch (error) {
          console.error("Error saving protocol:", error);
          throw error;
        }
      }
    }
    return false;
  };

  const handleConfirmAddInterval = (machineId: string) => {
    const hours = parseInt(newIntervalHours);
    if (isNaN(hours)) return;

    const newInterval: MaintenanceInterval = {
      id: `i-${Date.now()}`,
      hours: hours,
      label: `${hours?.toLocaleString() || hours} Horas`,
      tasks: []
    };

    const existingPlan = maintenancePlans.find(p => p.machineId === machineId);
    if (existingPlan) {
      const updatedPlan = {
        ...existingPlan,
        intervals: [...existingPlan.intervals, newInterval].sort((a, b) => a.hours - b.hours)
      };
      updateMaintenancePlan(updatedPlan);
    } else {
      // Should not happen if UI is correct, but safe fallback
      addMaintenancePlan({ machineId, intervals: [newInterval] });
    }

    setIsAddingInterval(false);
    setNewIntervalHours('');
  };

  const handleDeleteInterval = (machineId: string, intervalId: string) => {
    // Confirmation handled by inline UI
    const existingPlan = maintenancePlans.find(p => p.machineId === machineId);
    if (existingPlan) {
      const updatedPlan = {
        ...existingPlan,
        intervals: existingPlan.intervals.filter(i => i.id !== intervalId)
      };
      updateMaintenancePlan(updatedPlan);
    }

    if (activeIntervalTab === intervalId) setActiveIntervalTab(null);
    setIntervalToDelete(null); // Clear inline confirm state
  };



  const handleAddToList = async (setter: (val: string) => Promise<void> | void, newItem: string, clearItem: (val: string) => void) => {
    if (newItem.trim()) {
      try {
        await setter(newItem.trim());
        clearItem('');
      } catch (e: any) {
        console.error("Failed to add item:", e);
        alert(`Error: ${e.message || 'Failed to save item. Check permissions.'}`);
      }
    }
  };

  const handleRemoveFromList = async (remover: (val: string) => Promise<void> | void, item: string) => {
    if (confirm(`¿Eliminar "${item}" de la lista?`)) {
      try {
        await remover(item);
      } catch (e: any) {
        console.error("Failed to remove item:", e);
        alert(`Error: ${e.message}`);
      }
    }
  };

  // State for new entries
  const [newBranch, setNewBranch] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newAssetType, setNewAssetType] = useState('');

  // State for Inventory Configuration
  const [newPartCategory, setNewPartCategory] = useState('');
  const [newPartLocation, setNewPartLocation] = useState('');
  const [newPartUnit, setNewPartUnit] = useState('');
  const [newPartSupplier, setNewPartSupplier] = useState('');

  // State for Zones/Lines (Structured)
  // zoneStructures is now passed as prop, aliasing for compatibility
  const zones = zoneStructures.flatMap(z => z.lines.length > 0 ? z.lines.map(l => `${z.name} - ${l}`) : [z.name]);
  const [newZoneName, setNewZoneName] = useState('');
  const [newLineInputs, setNewLineInputs] = useState<Record<string, string>>({});

  // Editing State


  // Zone Editing State
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZoneName, setEditingZoneName] = useState('');

  const startEditingZone = (zone: ZoneStructure) => {
    setEditingZoneId(zone.id);
    setEditingZoneName(zone.name);
  };

  const saveZoneName = (zone: ZoneStructure) => {
    if (editingZoneName.trim()) {
      onUpdateZone({ ...zone, name: editingZoneName.trim() });
      setEditingZoneId(null);
    }
  };




  const handleAddZoneStructure = () => {
    if (newZoneName.trim()) {
      // Auto-layout logic: Grid System
      // Start slightly below the top bar (y=15% roughly)
      const startX = 5;
      const startY = 15;
      const cardWidth = 20;
      const cardHeight = 30;
      const gapX = 2;
      const gapY = 5;

      let x = startX;
      let y = startY;

      if (zoneStructures.length > 0) {
        // Find the next available slot
        // Get the Last zone
        const lastZone = zoneStructures[zoneStructures.length - 1];

        let nextX = (lastZone.x || startX) + (lastZone.width || cardWidth) + gapX;
        let nextY = (lastZone.y || startY);

        // Check horizontal overflow (limit to ~95%)
        if (nextX + cardWidth > 98) {
          nextX = startX; // New row
          nextY = nextY + (lastZone.height || cardHeight) + gapY;
        }

        x = nextX;
        y = nextY;
      }

      const newZone: ZoneStructure = {
        id: crypto.randomUUID(),
        name: newZoneName.trim(),
        lines: [],
        x, y,
        width: cardWidth,
        height: cardHeight
      };
      onAddZone(newZone);
      setNewZoneName('');
    }
  };

  const handleDeleteZone = (id: string) => {
    const zone = zoneStructures.find(z => z.id === id);
    if (zone && confirm(`¿Está seguro de que desea eliminar por completo la zona "${zone.name}"? Esta acción no se puede deshacer.`)) {
      onRemoveZone(id);
    }
  };

  const handleMoveZone = (zoneId: string, direction: 'up' | 'down') => {
    const currentIndex = zoneStructures.findIndex(z => z.id === zoneId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Bounds check handled by store, but good to check here too
    if (newIndex >= 0 && newIndex < zoneStructures.length) {
      reorderZones(currentIndex, newIndex);
    }
  };

  const handleAddLine = (zoneId: string) => {
    const lineName = newLineInputs[zoneId];
    if (lineName && lineName.trim()) {
      const zone = zoneStructures.find(z => z.id === zoneId);
      if (zone) {
        onUpdateZone({ ...zone, lines: [...zone.lines, lineName.trim()] });
      }
      setNewLineInputs({ ...newLineInputs, [zoneId]: '' });
    }
  };

  const handleDeleteLine = (zoneId: string, lineToRemove: string) => {
    const zone = zoneStructures.find(z => z.id === zoneId);
    if (zone) {
      onUpdateZone({ ...zone, lines: zone.lines.filter(l => l !== lineToRemove) });
    }
  };

  // Duplicate functions removed. 
  // The correct ones are defined above (lines 146-155) using the store actions.

  return (
    <div className="h-full bg-industrial-900 flex flex-col overflow-hidden relative" >
      {/* Module Header */}
      <div className="p-6 border-b border-industrial-800 bg-industrial-900">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{t('config.title')}</h2>
            <p className="text-industrial-500 text-sm">{t('config.subtitle')}</p>
          </div>

        </div>
      </div>

      {/* Tabs */}
      {/* Tabs - Horizontal Scrollable List */}
      <div className="flex gap-2 px-6 pt-2 overflow-x-auto border-b border-industrial-700 bg-industrial-900 sticky top-0 z-10">
        <button
          onClick={() => setActiveTab('GENERAL')}
          className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'GENERAL'
            ? 'text-white border-industrial-accent'
            : 'text-industrial-500 border-transparent hover:text-industrial-300'
            }`}
        >
          {t('config.tab.settings')}
        </button>

        <button
          onClick={() => setActiveTab('ZONES')}
          className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'ZONES'
            ? 'text-white border-industrial-accent'
            : 'text-industrial-500 border-transparent hover:text-industrial-300'
            }`}
        >
          {t('config.tab.zones')}
        </button>

        <button
          onClick={() => setActiveTab('EQUIPMENT')}
          className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'EQUIPMENT'
            ? 'text-white border-industrial-accent'
            : 'text-industrial-500 border-transparent hover:text-industrial-300'
            }`}
        >
          {t('config.tab.equipment')}
        </button>

        <button
          onClick={() => setActiveTab('INVENTORY')}
          className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'INVENTORY'
            ? 'text-white border-industrial-accent'
            : 'text-industrial-500 border-transparent hover:text-industrial-300'
            }`}
        >
          {t('config.tab.inventory')}
        </button>

        <button
          onClick={() => setActiveTab('PROTOCOLS')}
          className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'PROTOCOLS'
            ? 'text-white border-industrial-accent'
            : 'text-industrial-500 border-transparent hover:text-industrial-300'
            }`}
        >
          Mantenimientos
        </button>

        <button
          onClick={() => hasPermission('manage_users') && setActiveTab('WORKFORCE')}
          className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            !hasPermission('manage_users') 
              ? 'text-industrial-600 border-transparent cursor-not-allowed opacity-50' 
              : activeTab === 'WORKFORCE'
                ? 'text-white border-industrial-accent'
                : 'text-industrial-500 border-transparent hover:text-industrial-300'
          }`}
        >
          {!hasPermission('manage_users') && <Lock size={12} />}
          {t('workforce.title')}
        </button>

        <button
          onClick={() => hasPermission('manage_roles') && setActiveTab('ROLES')}
          className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            !hasPermission('manage_roles') 
              ? 'text-industrial-600 border-transparent cursor-not-allowed opacity-50' 
              : activeTab === 'ROLES'
                ? 'text-white border-industrial-accent'
                : 'text-industrial-500 border-transparent hover:text-industrial-300'
          }`}
        >
          {!hasPermission('manage_roles') && <Lock size={12} />}
          {t('config.tab.roles')}
        </button>

        <button
          onClick={() => setActiveTab('NOTIFICATIONS')}
          className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'NOTIFICATIONS'
            ? 'text-white border-industrial-accent'
            : 'text-industrial-500 border-transparent hover:text-industrial-300'
            }`}
        >
          Notificaciones
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-industrial-900/50">





        {/* LOCATIONS TAB */}


        {
          activeTab === 'WORKFORCE' && (
            <UserManagement />
          )
        }

        {/* PROTOCOLS TAB (Refined) */}
        {
          activeTab === 'PROTOCOLS' && (
            <div className="h-full flex flex-col animate-fadeIn">
              {/* Header / Sub-nav */}
              <div className="bg-industrial-800 p-4 border-b border-industrial-700 flex justify-between items-center">
                <div>
                  <h3 className="text-lg text-white font-bold">Mantenimientos</h3>
                  <p className="text-sm text-industrial-400">Intervalos de Intervención R-MANT-02</p>
                </div>
              </div>

              <div className="flex h-full overflow-hidden">
                {/* Sidebar List (Machines) */}
                <div className="w-72 border-r border-industrial-700 bg-industrial-800 shrink-0 flex flex-col">
                  <div className="p-3 border-b border-industrial-700 space-y-2">
                    <p className="text-xs text-industrial-400 font-bold uppercase">Equipos Asociados</p>

                    {/* Association Control */}
                    <div className="flex gap-1" ref={searchContainerRef}>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          className="w-full bg-industrial-900 border border-industrial-600 text-white text-xs rounded p-1.5 outline-none focus:border-industrial-accent"
                          placeholder="Buscar nombre, alias o matrícula..."
                          value={machineSearchQuery}
                          onChange={(e) => {
                            setMachineSearchQuery(e.target.value);
                            setIsMachineSearchOpen(true);
                            if (!e.target.value) setMachineToAssociate('');
                          }}
                          onFocus={() => setIsMachineSearchOpen(true)}
                        />
                        {isMachineSearchOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-industrial-800 border border-industrial-600 rounded shadow-lg max-h-48 overflow-y-auto">
                            {machines
                              .filter(m => !maintenancePlans.some(p => p.machineId === m.id))
                              .filter(m =>
                                m.name.toLowerCase().includes(machineSearchQuery.toLowerCase()) ||
                                (m.alias?.toLowerCase().includes(machineSearchQuery.toLowerCase())) ||
                                (m.plate?.toLowerCase().includes(machineSearchQuery.toLowerCase()))
                              )
                              .map(m => (
                                <div
                                  key={m.id}
                                  className="p-2 text-xs text-white hover:bg-industrial-700 cursor-pointer"
                                  onClick={() => {
                                    setMachineToAssociate(m.id);
                                    setMachineSearchQuery(m.name);
                                    setIsMachineSearchOpen(false);
                                  }}
                                >
                                  <div className="font-bold">{m.name}</div>
                                  {(m.alias || m.plate) && (
                                    <div className="text-[10px] text-industrial-400 mt-0.5">
                                      {m.alias ? `A: ${m.alias} ` : ''} {m.plate ? `M: ${m.plate}` : ''}
                                    </div>
                                  )}
                                </div>
                              ))}
                            {machines.filter(m => !maintenancePlans.some(p => p.machineId === m.id))
                              .filter(m => m.name.toLowerCase().includes(machineSearchQuery.toLowerCase()) || (m.alias?.toLowerCase().includes(machineSearchQuery.toLowerCase())) || (m.plate?.toLowerCase().includes(machineSearchQuery.toLowerCase()))).length === 0 && (
                                <div className="p-2 text-xs text-industrial-500">No hay resultados</div>
                              )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleAssociateMachine}
                        disabled={!machineToAssociate}
                        className={`p-1.5 rounded transition-colors ${machineToAssociate ? 'bg-industrial-accent text-white hover:bg-blue-600' : 'bg-industrial-700 text-industrial-500 cursor-not-allowed'}`}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {maintenancePlans.map(plan => {
                      const m = machines.find(mac => mac.id === plan.machineId);
                      if (!m) return null; // Should not happen if data is consistent

                      return (
                        <div key={m.id} className="relative group w-full flex flex-col">
                          <button
                            onClick={() => {
                              setSelectedProtocolMachineId(m.id);
                              // Auto select first interval if exists
                              const currentPlan = maintenancePlans.find(p => p.machineId === m.id);
                              if (currentPlan && currentPlan.intervals.length > 0) {
                                setActiveIntervalTab(currentPlan.intervals[0].id);
                              } else {
                                setActiveIntervalTab(null);
                              }
                            }}
                            className={`w-full text-left p-3 rounded text-sm transition-colors flex flex-col gap-1 ${selectedProtocolMachineId === m.id ? 'bg-industrial-700 text-white border border-industrial-600' : 'text-industrial-400 hover:bg-industrial-700/50'}`}
                          >
                            <span className="font-bold text-white pr-6">{m.name}</span>
                            <div className="flex justify-between items-center w-full mt-1">
                              <div className="flex flex-col gap-0.5">
                                {m.alias && <span className="text-[10px] text-industrial-300 font-mono">Alias: {m.alias}</span>}
                                {m.plate && <span className="text-[10px] text-industrial-400 font-mono">Matrícula: {m.plate}</span>}
                                {!m.alias && !m.plate && <span className="text-[10px] text-industrial-500 italic">Sin identificadores</span>}
                              </div>
                              <span className="text-[10px] text-industrial-500 bg-industrial-900/50 px-2 py-0.5 rounded">{plan.intervals.length} Intervalos</span>
                            </div>
                          </button>

                          {(hasRole([UserRole.ADMIN_SOLICITANTE]) || hasPermission('manage_config')) && (
                            <div className="absolute top-2 right-2">
                              {machineToRemove === m.id ? (
                                <div className="flex gap-1 bg-industrial-800 p-1 rounded shadow-lg border border-industrial-600">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeMaintenancePlan(m.id);
                                      setMachineToRemove(null);
                                      if (selectedProtocolMachineId === m.id) {
                                        setSelectedProtocolMachineId(null);
                                      }
                                    }}
                                    className="bg-red-500 hover:bg-red-600 text-white rounded p-0.5"
                                    title="Confirmar"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setMachineToRemove(null); }}
                                    className="bg-industrial-600 hover:bg-industrial-500 text-white rounded p-0.5"
                                    title="Cancelar"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMachineToRemove(m.id); }}
                                  className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-industrial-800 rounded shadow border border-red-500"
                                  title="Quitar Equipo"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {maintenancePlans.length === 0 && (
                      <div className="text-center p-4 text-industrial-500 text-xs italic">
                        No hay equipos asociados. Seleccione uno arriba para comenzar.
                      </div>
                    )}
                  </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col bg-industrial-900 overflow-hidden">
                  {selectedProtocolMachineId ? (
                    <>
                      {/* Interval Tabs */}
                      <div className="flex items-center gap-2 p-2 border-b border-industrial-700 bg-industrial-800/50 overflow-x-auto">
                        {(maintenancePlans.find(p => p.machineId === selectedProtocolMachineId)?.intervals || [])
                          .slice()
                          .sort((a, b) => a.hours - b.hours)
                          .map(interval => (
                            <div key={interval.id} className="group relative flex items-center">
                              <button
                                onClick={() => setActiveIntervalTab(interval.id)}
                                className={`px-4 py-2 rounded text-xs font-bold transition-all border ${activeIntervalTab === interval.id ? 'bg-industrial-600 text-white border-industrial-500 shadow-md' : 'bg-industrial-900 text-industrial-400 border-industrial-700 hover:bg-industrial-700'}`}
                              >
                                {interval.label}
                              </button>
                              {intervalToDelete === interval.id ? (
                                <div className="absolute -top-3 -right-3 flex gap-1 bg-industrial-800 p-1 rounded shadow-lg z-10 border border-industrial-600">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteInterval(selectedProtocolMachineId, interval.id); }}
                                    className="bg-red-500 hover:bg-red-600 text-white rounded p-0.5"
                                    title="Confirmar"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setIntervalToDelete(null); }}
                                    className="bg-industrial-600 hover:bg-industrial-500 text-white rounded p-0.5"
                                    title="Cancelar"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : activeIntervalTab === interval.id && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setIntervalToDelete(interval.id); }}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-red-600"
                                  title="Eliminar Intervalo"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          ))}

                        {isAddingInterval ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className="px-2 py-1 w-24 bg-industrial-900 border border-industrial-600 rounded text-xs text-white"
                              placeholder="Hrs..."
                              value={newIntervalHours}
                              onChange={(e) => setNewIntervalHours(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmAddInterval(selectedProtocolMachineId);
                                if (e.key === 'Escape') setIsAddingInterval(false);
                              }}
                              autoFocus
                            />
                            <button onClick={() => handleConfirmAddInterval(selectedProtocolMachineId)} className="p-1 bg-industrial-accent text-white rounded"><Plus size={14} /></button>
                            <button onClick={() => setIsAddingInterval(false)} className="p-1 text-industrial-400 hover:text-white"><X size={14} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsAddingInterval(true)}
                            className="px-3 py-2 rounded text-xs font-medium text-industrial-400 hover:text-white hover:bg-industrial-700 border border-transparent border-dashed hover:border-industrial-500 flex items-center gap-1"
                          >
                            <Plus size={12} /> Nvo. Intervalo
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 overflow-hidden relative">
                        {activeIntervalTab ? (
                          <ProtocolBuilder
                            key={activeIntervalTab} // Force re-render on tab switch
                            initialTasks={maintenancePlans.find(p => p.machineId === selectedProtocolMachineId)?.intervals.find(i => i.id === activeIntervalTab)?.tasks}
                            onSave={handleSaveProtocol}
                          />
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-industrial-500 gap-4 opacity-50">
                            <Clock size={48} />
                            <p className="text-sm">Seleccione o cree un intervalo de mantenimiento para comenzar.</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-industrial-500 gap-4">
                      <Server size={48} className="opacity-20" />
                      <p>Seleccione un equipo para configurar sus protocolos de mantenimiento.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        }

        {/* ROLES TAB (NEW) */}
        {
          activeTab === 'ROLES' && (
            <div className="h-full animate-fadeIn">
              <RoleManagement />
            </div>
          )
        }

        {/* NOTIFICATIONS TAB */}
        {
          activeTab === 'NOTIFICATIONS' && (
            <div className="h-full animate-fadeIn">
              <NotificationSettings />
            </div>
          )
        }

        {activeTab === 'INVENTORY' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg text-white font-medium">Configuración de Repuestos</h3>
                <p className="text-sm text-industrial-500">Gestione las opciones para el inventario de repuestos.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Part Categories */}
              <div className="bg-industrial-800 rounded-lg border border-industrial-700 p-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Box size={20} className="text-orange-500" />
                  Categorías
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                      placeholder="Nueva Categoría"
                      value={newPartCategory}
                      onChange={e => setNewPartCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddToList(addPartCategory, newPartCategory, setNewPartCategory);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddToList(addPartCategory, newPartCategory, setNewPartCategory)}
                      className="bg-industrial-700 hover:bg-industrial-600 text-white p-2 rounded transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {partCategories.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-industrial-900/50 p-3 rounded border border-industrial-700/50 group">
                        <input
                          type="text"
                          defaultValue={item}
                          className="bg-transparent text-industrial-300 border-none focus:ring-0 p-0 w-full mr-2"
                          onBlur={(e) => {
                            if (e.target.value !== item && e.target.value.trim() !== '') {
                              updatePartCategory(item, e.target.value.trim());
                            } else {
                              e.target.value = item;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRemoveFromList(removePartCategory, item)}
                          className="text-industrial-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Part Locations */}
              <div className="bg-industrial-800 rounded-lg border border-industrial-700 p-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <MapPin size={20} className="text-blue-500" />
                  Tramos
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                      placeholder="Nuevo Tramo"
                      value={newPartLocation}
                      onChange={e => setNewPartLocation(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddToList(addPartLocation, newPartLocation, setNewPartLocation);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddToList(addPartLocation, newPartLocation, setNewPartLocation)}
                      className="bg-industrial-700 hover:bg-industrial-600 text-white p-2 rounded transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {partLocations.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-industrial-900/50 p-3 rounded border border-industrial-700/50 group">
                        <input
                          type="text"
                          defaultValue={item}
                          className="bg-transparent text-industrial-300 border-none focus:ring-0 p-0 w-full mr-2"
                          onBlur={(e) => {
                            if (e.target.value !== item && e.target.value.trim() !== '') {
                              updatePartLocation(item, e.target.value.trim());
                            } else {
                              e.target.value = item;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRemoveFromList(removePartLocation, item)}
                          className="text-industrial-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Part Units */}
              <div className="bg-industrial-800 rounded-lg border border-industrial-700 p-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Scale size={20} className="text-purple-500" />
                  Unidades
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                      placeholder="Nueva Unidad (ej. kg, m, l)"
                      value={newPartUnit}
                      onChange={e => setNewPartUnit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddToList(addPartUnit, newPartUnit, setNewPartUnit);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddToList(addPartUnit, newPartUnit, setNewPartUnit)}
                      className="bg-industrial-700 hover:bg-industrial-600 text-white p-2 rounded transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {partUnits.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-industrial-900/50 p-3 rounded border border-industrial-700/50 group">
                        <input
                          type="text"
                          defaultValue={item}
                          className="bg-transparent text-industrial-300 border-none focus:ring-0 p-0 w-full mr-2"
                          onBlur={(e) => {
                            if (e.target.value !== item && e.target.value.trim() !== '') {
                              updatePartUnit(item, e.target.value.trim());
                            } else {
                              e.target.value = item;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRemoveFromList(removePartUnit, item)}
                          className="text-industrial-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Part Suppliers */}
              <div className="bg-industrial-800 rounded-lg border border-industrial-700 p-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Truck size={20} className="text-emerald-500" />
                  Proveedores
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                      placeholder="Nuevo Proveedor"
                      value={newPartSupplier}
                      onChange={e => setNewPartSupplier(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddToList(addPartSupplier, newPartSupplier, setNewPartSupplier);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddToList(addPartSupplier, newPartSupplier, setNewPartSupplier)}
                      className="bg-industrial-700 hover:bg-industrial-600 text-white p-2 rounded transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {partSuppliers.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-industrial-900/50 p-3 rounded border border-industrial-700/50 group">
                        <input
                          type="text"
                          defaultValue={item}
                          className="bg-transparent text-industrial-300 border-none focus:ring-0 p-0 w-full mr-2"
                          onBlur={(e) => {
                            if (e.target.value !== item && e.target.value.trim() !== '') {
                              updatePartSupplier(item, e.target.value.trim());
                            } else {
                              e.target.value = item;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRemoveFromList(removePartSupplier, item)}
                          className="text-industrial-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'GENERAL' && (
          <>
            <div className="bg-industrial-800 p-6 rounded-lg border border-industrial-700">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Settings size={18} className="text-industrial-500" />
                {t('settings.metadata.title')}
              </h3>

              {/* Logo Upload Section */}
              <div className="mb-6 bg-industrial-900/50 p-4 rounded border border-industrial-700/50 flex flex-col items-center justify-center gap-3">
                <div className="w-24 h-24 rounded bg-white flex items-center justify-center overflow-hidden border border-industrial-600 relative group">
                  {settingsForm.logoUrl ? (
                    <img src={settingsForm.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-industrial-400">
                      <span className="text-xs font-bold">NO LOGO</span>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-white text-xs font-medium">Change</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (reader.result) {
                              setSettingsForm({ ...settingsForm, logoUrl: reader.result as string });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="text-center">
                  <p className="text-xs text-industrial-400 mb-1">Company Logo</p>
                  <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1 justify-center">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (reader.result) {
                              setSettingsForm({ ...settingsForm, logoUrl: reader.result as string });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-industrial-400 mb-1">{t('settings.plantName')}</label>
                  <input
                    type="text"
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-sm text-white focus:border-industrial-accent outline-none transition-colors"
                    value={settingsForm.plantName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, plantName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-industrial-400 mb-1">{t('settings.costCenter')}</label>
                  <input
                    type="text"
                    placeholder="000-00000-0"
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-sm text-white focus:border-industrial-accent outline-none transition-colors font-mono"
                    value={settingsForm.taxId}
                    onChange={(e) => {
                      // Remove all non-digit characters
                      const digits = e.target.value.replace(/\D/g, '');

                      // Limit to 9 digits max
                      const limitedDigits = digits.slice(0, 9);

                      // Apply RNC format: 000-00000-0
                      let formatted = '';
                      if (limitedDigits.length > 0) {
                        formatted = limitedDigits.slice(0, 3);
                      }
                      if (limitedDigits.length > 3) {
                        formatted += '-' + limitedDigits.slice(3, 8);
                      }
                      if (limitedDigits.length > 8) {
                        formatted += '-' + limitedDigits.slice(8, 9);
                      }

                      setSettingsForm({ ...settingsForm, taxId: formatted });
                    }}
                    maxLength={11}
                  />
                  <p className="text-xs text-industrial-500 mt-1">Formato: 000-00000-0 (9 dígitos)</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-industrial-400 mb-1">{t('settings.timezone')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-sm text-white focus:border-industrial-accent outline-none transition-colors"
                    value={settingsForm.timezone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, timezone: e.target.value })}
                  >
                    <option value="AST">Santo Domingo (GMT-4)</option>
                    <option value="CST">Mexico City (UTC-6)</option>
                    <option value="EST">New York (UTC-5)</option>
                    <option value="CET">Madrid (UTC+1)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-industrial-400 mb-1">{t('settings.currency')}</label>
                  <select
                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-sm text-white focus:border-industrial-accent outline-none transition-colors"
                    value={settingsForm.currency}
                    onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                  >
                    <option value="DOP">Peso Dominicano (RD$)</option>
                    <option value="USD">US Dollar (US$)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-industrial-800 p-6 rounded-lg border border-industrial-700">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-industrial-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {t('settings.compliance.title')}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-industrial-900/50 rounded border border-industrial-700/50">
                  <div>
                    <span className="block text-sm text-white font-medium">{t('settings.compliance.sig')}</span>
                    <span className="text-xs text-industrial-500">{t('settings.compliance.sig.desc')}</span>
                  </div>
                  <div className="w-12 h-6 bg-industrial-accent rounded-full relative cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-industrial-900/50 rounded border border-industrial-700/50">
                  <div>
                    <span className="block text-sm text-white font-medium">{t('settings.compliance.auto')}</span>
                    <span className="text-xs text-industrial-500">{t('settings.compliance.auto.desc')}</span>
                  </div>
                  <div className="w-12 h-6 bg-industrial-accent rounded-full relative cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm"></div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'ZONES' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg text-white font-medium">Zonas de Producción y Líneas</h3>
                <p className="text-sm text-industrial-500">Defina la estructura de planta. Las líneas pertenecen a una zona específica.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Zone List */}
              <div className="col-span-2 space-y-4">
                {zoneStructures.map((zone) => (
                  <div key={zone.id} className="bg-industrial-800 rounded-lg border border-industrial-700 p-4">
                    <div className="flex justify-between items-start mb-3 border-b border-industrial-700 pb-2">
                      {editingZoneId === zone.id ? (
                        <div className="flex gap-2 items-center flex-1 mr-2">
                          <input
                            type="text"
                            className="flex-1 bg-industrial-900 border border-blue-500 rounded p-1 text-sm text-white focus:outline-none"
                            value={editingZoneName}
                            onChange={(e) => setEditingZoneName(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => saveZoneName(zone)} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
                          <button onClick={() => setEditingZoneId(null)} className="text-red-400 hover:text-red-300"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-white text-sm">{zone.name}</h5>
                          <button onClick={() => startEditingZone(zone)} className="text-industrial-500 hover:text-blue-400 transition-colors">
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="text-industrial-500 hover:text-red-500 transition-colors bg-industrial-900 p-1 rounded border border-industrial-800 hover:border-red-500/50"
                        title="Eliminar Zona completa"
                      >
                        <Trash2 size={14} />
                      </button>
                      {/* Reorder Controls */}
                      <div className="flex flex-col gap-0.5 ml-1">
                        <button
                          onClick={() => handleMoveZone(zone.id, 'up')}
                          className="text-industrial-500 hover:text-white hover:bg-industrial-700 rounded p-0.5"
                          title="Mover Arriba"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button
                          onClick={() => handleMoveZone(zone.id, 'down')}
                          className="text-industrial-500 hover:text-white hover:bg-industrial-700 rounded p-0.5"
                          title="Mover Abajo"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pl-4 border-l-2 border-industrial-800 ml-1">
                      {zone.lines.map((line, idx) => (
                        <div key={idx} className="flex justify-between items-center group py-1">
                          <span className="text-industrial-300 text-sm font-mono flex items-center gap-2">
                            <CornerDownRight size={12} className="text-industrial-600" />
                            {line}
                          </span>
                          <button
                            onClick={() => handleDeleteLine(zone.id, line)}
                            className="text-industrial-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Eliminar Línea"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      {zone.lines.length === 0 && (
                        <p className="text-xs text-industrial-600 italic py-1">No hay líneas registradas</p>
                      )}
                    </div>

                    {/* Add Line Input */}
                    <div className="mt-4 flex gap-2 pl-4">
                      <input
                        type="text"
                        className="flex-1 bg-industrial-900 border border-industrial-600 rounded p-1.5 text-xs text-white placeholder-industrial-500"
                        placeholder="Agregar Línea (ej. Línea 1)"
                        value={newLineInputs[zone.id] || ''}
                        onChange={(e) => setNewLineInputs({ ...newLineInputs, [zone.id]: e.target.value })}
                      />
                      <button
                        onClick={() => handleAddLine(zone.id)}
                        className="bg-industrial-700 hover:bg-industrial-600 text-white px-2 rounded text-xs"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                {zoneStructures.length === 0 && (
                  <div className="bg-industrial-800/50 rounded-lg border border-industrial-700 p-8 text-center">
                    <Layout size={32} className="mx-auto text-industrial-600 mb-2" />
                    <p className="text-industrial-400 text-sm">No hay zonas configuradas</p>
                  </div>
                )}
              </div>

              {/* Add Zone Card */}
              <div className="bg-industrial-800 rounded-lg border border-industrial-700 p-4 h-fit sticky top-6">
                <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Plus size={14} /> Agregar Nueva Zona</h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-industrial-400">Nombre de Zona</label>
                    <input
                      type="text"
                      className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm"
                      placeholder="e.g. Producción"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleAddZoneStructure}
                    className="w-full bg-industrial-700 hover:bg-industrial-600 text-white py-2 rounded text-sm transition-colors border border-industrial-600"
                  >
                    Crear Zona
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'EQUIPMENT' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg text-white font-medium">Configuración de Equipos</h3>
                <p className="text-sm text-industrial-500">Gestione las listas desplegables y opciones para el registro de activos.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Branches */}
              <div className="bg-industrial-800 rounded-lg border border-industrial-700 p-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Briefcase size={20} className="text-industrial-accent" />
                  Sucursales
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                      placeholder="Nueva Sucursal"
                      value={newBranch}
                      onChange={e => setNewBranch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddToList(addBranch, newBranch, setNewBranch);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddToList(addBranch, newBranch, setNewBranch)}
                      className="bg-industrial-700 hover:bg-industrial-600 text-white p-2 rounded transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {branches.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-industrial-900/50 p-3 rounded border border-industrial-700/50 group">
                        <input
                          type="text"
                          defaultValue={item}
                          className="bg-transparent text-industrial-300 border-none focus:ring-0 p-0 w-full mr-2"
                          onBlur={(e) => {
                            if (e.target.value !== item && e.target.value.trim() !== '') {
                              updateBranch(item, e.target.value.trim());
                            } else {
                              e.target.value = item;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRemoveFromList(removeBranch, item)}
                          className="text-industrial-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div className="bg-industrial-800 rounded-lg border border-industrial-700 p-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Box size={20} className="text-orange-500" />
                  Categorías
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                      placeholder="Nueva Categoría"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddToList(addCategory, newCategory, setNewCategory);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddToList(addCategory, newCategory, setNewCategory)}
                      className="bg-industrial-700 hover:bg-industrial-600 text-white p-2 rounded transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {categories.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-industrial-900/50 p-3 rounded border border-industrial-700/50 group">
                        <input
                          type="text"
                          defaultValue={item}
                          className="bg-transparent text-industrial-300 border-none focus:ring-0 p-0 w-full mr-2"
                          onBlur={(e) => {
                            if (e.target.value !== item && e.target.value.trim() !== '') {
                              updateCategory(item, e.target.value.trim());
                            } else {
                              e.target.value = item;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRemoveFromList(removeCategory, item)}
                          className="text-industrial-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Asset Types */}
              <div className="bg-industrial-800 rounded-lg border border-industrial-700 p-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Cpu size={20} className="text-purple-500" />
                  Tipos de Activo
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                      placeholder="Nuevo Tipo (ej. GENERATOR)"
                      value={newAssetType}
                      onChange={e => setNewAssetType(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddToList(addAssetType, newAssetType, setNewAssetType);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddToList(addAssetType, newAssetType, setNewAssetType)}
                      className="bg-industrial-700 hover:bg-industrial-600 text-white p-2 rounded transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {assetTypes.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-industrial-900/50 p-3 rounded border border-industrial-700/50 group">
                        <input
                          type="text"
                          defaultValue={item}
                          className="bg-transparent text-industrial-300 border-none focus:ring-0 p-0 w-full mr-2"
                          onBlur={(e) => {
                            if (e.target.value !== item && e.target.value.trim() !== '') {
                              updateAssetType(item, e.target.value.trim());
                            } else {
                              e.target.value = item;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRemoveFromList(removeAssetType, item)}
                          className="text-industrial-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Zones Reference */}
              <div className="bg-industrial-800/50 rounded-lg border border-industrial-700/50 p-6 col-span-1 md:col-span-3 opacity-70">
                <h4 className="text-sm font-bold text-industrial-400 mb-2 flex items-center gap-2">
                  <Layout size={16} />
                  Tramos (Solo Lectura)
                </h4>
                <p className="text-xs text-industrial-500 mb-3">
                  Los tramos se gestionan en la pestaña "Zonas - Líneas". Aquí se muestran los disponibles para referencia.
                </p>
                <div className="flex flex-wrap gap-2">
                  {zones.map((item, idx) => (
                    <span key={idx} className="bg-industrial-900 px-2 py-1 rounded border border-industrial-700 text-xs text-industrial-500 font-mono">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}



      </div>

    </div>
  );
};
