import { create } from 'zustand';
import { Machine, Technician, ZoneStructure, MaintenancePlan, PlanTier } from '../../types';
import { SparePart } from '../types/inventory';
import { MasterDataService } from '../services/masterDataService';
import { inventoryService } from '../services'; // For parts
import { SettingsSupabaseService, GeneralSettings } from '../services/implementations/SettingsSupabase';

// Re-export GeneralSettings as PlantSettings for backward compatibility
type PlantSettings = GeneralSettings;

interface MasterState {
    machines: Machine[];
    technicians: Technician[];
    parts: SparePart[];
    selectedPart: SparePart | null;
    zones: ZoneStructure[];
    plantSettings: PlantSettings;
    currentPlan: PlanTier;
    maintenancePlans: MaintenancePlan[];
    branches: string[];
    categories: string[];
    assetTypes: string[];
    partCategories: string[];
    partLocations: string[];
    partUnits: string[];
    partCompanies: string[];
    partSuppliers: string[];

    // Maintenance Plans Actions
    addMaintenancePlan: (plan: MaintenancePlan) => void;
    updateMaintenancePlan: (plan: MaintenancePlan) => void;
    removeMaintenancePlan: (machineId: string) => void;

    // State flags
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    // Pagination & Filtering
    machinePagination: {
        page: number;
        limit: number;
        total: number;
    };
    inventoryPagination: {
        page: number;
        limit: number;
        total: number;
    };
    machineFilters: {
        search?: string;
        branch?: string;
        category?: string;
        type?: string;
        zone?: string;
        showInactive?: boolean;
    };
    inventoryFilters: {
        search?: string;
        category?: string;
        location?: string;
        status?: 'all' | 'low' | 'normal';
        company?: string;
        supplier?: string;
    };

    // Actions
    fetchMasterData: () => Promise<void>;
    setMachinePage: (page: number) => Promise<void>;
    setInventoryPage: (page: number) => Promise<void>;
    setMachineFilters: (filters: Partial<MasterState['machineFilters']>) => Promise<void>;
    setInventoryFilters: (filters: Partial<MasterState['inventoryFilters']>) => Promise<void>;

    updateMachine: (updatedMachine: Machine) => Promise<void>;
    addMachine: (machine: Omit<Machine, 'id'>) => Promise<void>;
    addTechnician: (tech: Technician) => Promise<void>;
    addPart: (part: Omit<SparePart, 'id'>) => Promise<void>;
    updatePart: (updatedPart: SparePart) => Promise<void>;
    setSelectedPart: (part: SparePart | null) => void; // Added action for selectedPart

    addZone: (zone: ZoneStructure) => Promise<void>;
    updateZone: (zone: ZoneStructure) => Promise<void>;
    reorderZones: (sourceIndex: number, destinationIndex: number) => Promise<void>;
    removeZone: (id: string) => Promise<void>;
    deleteZone: (id: string) => Promise<void>;

    removeMachine: (id: string) => Promise<void>;

    // Config Actions (Keep local for now or TODO: move to DB)
    updateSettings: (settings: PlantSettings) => Promise<void>;

    addBranch: (branch: string) => void;
    removeBranch: (branch: string) => void;
    updateBranch: (oldVal: string, newVal: string) => void;

    addCategory: (category: string) => void;
    removeCategory: (category: string) => void;
    updateCategory: (oldVal: string, newVal: string) => void;

    addAssetType: (type: string) => void;
    removeAssetType: (type: string) => void;
    updateAssetType: (oldVal: string, newVal: string) => void;

    // Spare Parts Config Actions
    addPartCategory: (category: string) => Promise<void>;
    removePartCategory: (category: string) => Promise<void>;
    updatePartCategory: (oldVal: string, newVal: string) => void;

    addPartLocation: (location: string) => Promise<void>;
    removePartLocation: (location: string) => Promise<void>;
    updatePartLocation: (oldVal: string, newVal: string) => void;

    addPartUnit: (unit: string) => Promise<void>;
    removePartUnit: (unit: string) => Promise<void>;
    updatePartUnit: (oldVal: string, newVal: string) => void;

    addPartSupplier: (supplier: string) => Promise<void>;
    removePartSupplier: (supplier: string) => Promise<void>;
    updatePartSupplier: (oldVal: string, newVal: string) => void;
}

export const useMasterStore = create<MasterState>((set, get) => ({
    machines: [],
    technicians: [],
    parts: [],
    selectedPart: null,
    zones: [],

    // Default Settings
    plantSettings: {
        plantName: '',
        taxId: '',
        address: '',
        logoUrl: '',
        timezone: 'AST',
        currency: 'DOP'
    },
    currentPlan: PlanTier.BUSINESS,
    // Maintained for backwards compatibility, but now derived from `machines` on fetch
    maintenancePlans: [],

    // Maintenance Plans actions with Supabase persistence
    addMaintenancePlan: async (plan) => {
        const state = get();
        const machine = state.machines.find(m => m.id === plan.machineId);
        if (machine) {
            const updatedMachine = { ...machine, maintenancePlans: [plan] };
            await get().updateMachine(updatedMachine);
            set({ maintenancePlans: [...state.maintenancePlans, plan] });
        }
    },
    updateMaintenancePlan: async (plan) => {
        const state = get();
        const machine = state.machines.find(m => m.id === plan.machineId);
        if (machine) {
            const updatedMachine = { ...machine, maintenancePlans: [plan] };
            await get().updateMachine(updatedMachine);
            set({ maintenancePlans: state.maintenancePlans.map(p => p.machineId === plan.machineId ? plan : p) });
        }
    },
    removeMaintenancePlan: async (machineId) => {
        const state = get();
        const machine = state.machines.find(m => m.id === machineId);
        if (machine) {
            const updatedMachine = { ...machine, maintenancePlans: [] };
            await get().updateMachine(updatedMachine);
            set({ maintenancePlans: state.maintenancePlans.filter(p => p.machineId !== machineId) });
        }
    },

    isLoading: false,
    isInitialized: false,
    error: null,

    // Pagination & Filtering
    machinePagination: {
        page: 1,
        limit: 50,
        total: 0
    },
    inventoryPagination: {
        page: 1,
        limit: 50,
        total: 0
    },
    machineFilters: {},
    inventoryFilters: {},

    // Shared Configuration Lists (Defaults)
    branches: [],
    categories: [],
    assetTypes: [],
    maintenanceSchedules: [],
    partCategories: [],
    partLocations: [],
    partUnits: [],
    partCompanies: [],
    partSuppliers: [],

    setMachinePage: async (page: number) => {
        set((state) => ({ 
            machinePagination: { ...state.machinePagination, page },
            isInitialized: false // Force re-fetch
        }));
        await get().fetchMasterData();
    },

    setInventoryPage: async (page: number) => {
        set((state) => ({ 
            inventoryPagination: { ...state.inventoryPagination, page },
            isInitialized: false // Force re-fetch
        }));
        await get().fetchMasterData();
    },

    setMachineFilters: async (newFilters) => {
        set((state) => ({
            machineFilters: { ...state.machineFilters, ...newFilters },
            machinePagination: { ...state.machinePagination, page: 1 }, // Reset to page 1 on filter change
            isInitialized: false
        }));
        await get().fetchMasterData();
    },

    setInventoryFilters: async (newFilters) => {
        set((state) => ({
            inventoryFilters: { ...state.inventoryFilters, ...newFilters },
            inventoryPagination: { ...state.inventoryPagination, page: 1 }, // Reset to page 1 on filter change
            isInitialized: false
        }));
        await get().fetchMasterData();
    },

    fetchMasterData: async () => {
        const state = get();
        // Optimization: only skip if BOTH are initialized and have totals (or we need a better check)
        // For server-side pagination, we usually want to allow re-fetching.
        if (state.isLoading) return; 

        set({ isLoading: true, error: null });

        // Helper to safely fetch data or return a default value
        const safeFetch = async <T>(promise: Promise<T>, fallback: T, name: string): Promise<T> => {
            try {
                console.log(`[Store] Fetching ${name}...`);
                const result = await promise;
                console.log(`[Store] ${name} fetched:`, Array.isArray(result) ? `${result.length} items` : 'Success');
                return result;
            } catch (error: any) {
                console.error(`[Store] Failed to fetch ${name}:`, error);
                return fallback;
            }
        };

            try {
                const { page: machinePage, limit: machineLimit } = state.machinePagination;
                const { page: inventoryPage, limit: inventoryLimit } = state.inventoryPagination;
                const machineFilters = state.machineFilters;
                const inventoryFilters = state.inventoryFilters;

                // Execute all fetches in parallel
                const [
                    machinesResult,
                    technicians,
                    zones,
                    inventoryResult,
                    branches,
                    categories,
                    assetTypes,
                    plantSettings,
                    partCategories,
                    partLocations,
                    partUnits,
                    partCompanies,
                    partSuppliers
                ] = await Promise.all([
                    safeFetch(MasterDataService.getMachines(machinePage, machineLimit, machineFilters), { data: [], total: 0 }, 'machines'),
                    safeFetch(MasterDataService.getTechnicians(), [], 'technicians'),
                    safeFetch(MasterDataService.getZones(), [], 'zones'),
                    safeFetch(inventoryService.getAllParts(inventoryPage, inventoryLimit, inventoryFilters), { data: [], total: 0 }, 'parts'),
                    safeFetch(MasterDataService.getBranches(), [], 'branches'),
                    safeFetch(MasterDataService.getCategories(), [], 'categories'),
                    safeFetch(MasterDataService.getAssetTypes(), [], 'assetTypes'),
                    safeFetch(SettingsSupabaseService.getSettings(), get().plantSettings, 'plantSettings'),
                    safeFetch(MasterDataService.getPartCategories(), [], 'partCategories'),
                    safeFetch(MasterDataService.getPartLocations(), [], 'partLocations'),
                    safeFetch(MasterDataService.getPartUnits(), [], 'partUnits'),
                    safeFetch(inventoryService.getPartCompanies(), [], 'partCompanies'),
                    safeFetch(MasterDataService.getPartSuppliers(), [], 'partSuppliers')
                ]);

                const currentState = get();
                const machines = machinesResult.data;
                const parts = inventoryResult.data;

                // Extract maintenance plans from machines
                const extractedMaintenancePlans = machines
                    .filter(m => m.maintenancePlans && m.maintenancePlans.length > 0)
                    .flatMap(m => m.maintenancePlans || []);

                set({
                    machines,
                    machinePagination: { ...currentState.machinePagination, total: machinesResult.total },
                    inventoryPagination: { ...currentState.inventoryPagination, total: inventoryResult.total },
                    technicians,
                    zones: zones.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)),
                    parts,
                    branches: branches.length > 0 ? branches : currentState.branches,
                    categories: categories.length > 0 ? categories : currentState.categories,
                    assetTypes: assetTypes.length > 0 ? assetTypes : currentState.assetTypes,
                    partCategories: partCategories.length > 0 ? partCategories : currentState.partCategories,
                    partLocations: partLocations.length > 0 ? partLocations : currentState.partLocations,
                    partUnits: partUnits.length > 0 ? partUnits : currentState.partUnits,
                    partCompanies: partCompanies.length > 0 ? partCompanies : currentState.partCompanies,
                    partSuppliers: partSuppliers.length > 0 ? partSuppliers : currentState.partSuppliers,
                    plantSettings: plantSettings,
                    maintenancePlans: extractedMaintenancePlans,
                    isLoading: false,
                    isInitialized: true
                });
            } catch (error: any) {
                console.error('Critical error in fetchMasterData:', error);
                set({ error: error.message, isLoading: false, isInitialized: true });
            }
    },

    updateMachine: async (updatedMachine) => {
        // Optimistic UI Update
        const previousMachines = get().machines;
        set((state) => ({
            machines: state.machines.map(m => m.id === updatedMachine.id ? updatedMachine : m)
        }));

        try {
            await MasterDataService.updateMachine(updatedMachine);
        } catch (error: any) {
            // Revert on failure
            set({ machines: previousMachines, error: error.message });
            throw error; // Re-throw so component can handle it
        }
    },

    addMachine: async (machine) => {
        try {
            const newMachine = await MasterDataService.createMachine(machine);
            set((state) => ({
                machines: [newMachine, ...state.machines]
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error; // Re-throw so component can handle it
        }
    },

    removeMachine: async (id: string) => {
        try {
            const state = get();
            const machine = state.machines.find(m => m.id === id);
            if (machine) {
                const updatedMachine = { ...machine, location: { x: 0, y: 0 } };
                await MasterDataService.updateMachine(updatedMachine);
                set((state) => ({
                    machines: state.machines.map(m => m.id === id ? updatedMachine : m)
                }));
            }
        } catch (error: any) {
            set({ error: error.message });
        }
    },

    addTechnician: async (tech) => {
        try {
            const newTech = await MasterDataService.createTechnician(tech);
            set((state) => ({
                technicians: [...state.technicians, newTech]
            }));
        } catch (error: any) {
            set({ error: error.message });
        }
    },

    addPart: async (part) => {
        try {
            const newPart = await inventoryService.createPart(part as any);
            set((state) => ({
                parts: [newPart, ...state.parts]
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    updatePart: async (updatedPart) => {
        try {
            const updated = await inventoryService.updatePart(updatedPart);
            set((state) => ({
                parts: state.parts.map(p => p.id === updated.id ? updated : p)
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    setSelectedPart: (part) => {
        set({ selectedPart: part });
    },

    addZone: async (zone) => {
        try {
            const state = get();
            // Auto-assign orderIndex if not present
            const nextIndex = state.zones.length > 0
                ? Math.max(...state.zones.map(z => z.orderIndex || 0)) + 1
                : 0;

            const zoneWithOrder = { ...zone, orderIndex: zone.orderIndex ?? nextIndex };
            const newZone = (await MasterDataService.createZone(zoneWithOrder)) as any;

            set((state) => ({
                zones: [...state.zones, newZone].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
            }));
        } catch (error: any) {
            set({ error: error.message });
        }
    },

    updateZone: async (updatedZone) => {
        // Optimistic UI Update
        const previousZones = get().zones;
        set((state) => ({
            zones: state.zones.map(z => z.id === updatedZone.id ? updatedZone : z)
                .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
        }));

        try {
            await MasterDataService.updateZone(updatedZone);
        } catch (error: any) {
             // Revert on failure
            set({ zones: previousZones, error: error.message });
        }
    },

    reorderZones: async (sourceIndex: number, destinationIndex: number) => {
        const state = get();
        const zones = [...state.zones];

        // Validation
        if (sourceIndex < 0 || sourceIndex >= zones.length || destinationIndex < 0 || destinationIndex >= zones.length) return;

        // Swap in local state for optimistic UI
        const [movedZone] = zones.splice(sourceIndex, 1);
        zones.splice(destinationIndex, 0, movedZone);

        // Update order indexes
        const updatedZones = zones.map((zone, index) => ({
            ...zone,
            orderIndex: index
        }));

        set({ zones: updatedZones });

        try {
            // Persist order to backend (Batch update ideally, or loop for now)
            // For efficiency with small lists, loop is acceptable. 
            // Better: MasterDataService.updateZoneOrder(updatedZones);
            // We will add updateZoneOrder to service next.
            await MasterDataService.updateZoneOrder(updatedZones);

        } catch (error: any) {
            console.error("Failed to reorder zones:", error);
            // Revert on failure?
            set({ error: "Failed to save new order." });
            // Could revert state here by fetching again
        }
    },

    removeZone: async (id) => {
        try {
            const state = get();
            const zone = state.zones.find(z => z.id === id);
            if (zone) {
                const updatedZone = { ...zone, x: 0, y: 0 };
                await MasterDataService.updateZone(updatedZone);
                set((state) => ({
                    zones: state.zones.map(z => z.id === id ? updatedZone : z)
                }));
            }
        } catch (error: any) {
            set({ error: error.message });
        }
    },

    deleteZone: async (id) => {
        try {
            await MasterDataService.removeZone(id);
            set((state) => ({
                zones: state.zones.filter(z => z.id !== id)
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    // Sync Actions (Config)
    updateSettings: async (settings) => {
        try {
            await SettingsSupabaseService.updateSettings(settings); // Persist to singleton table
            set({ plantSettings: settings });
        } catch (error: any) {
            console.error("Failed to save settings:", error);
            set({ error: error.message });
            throw error; // Re-throw so component knows it failed
        }
    },

    // Branches
    addBranch: async (branch) => {
        try {
            const newBranch = await MasterDataService.createBranch(branch);
            set((state) => ({ branches: [...state.branches, newBranch] }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    removeBranch: async (branch) => {
        try {
            await MasterDataService.removeBranch(branch);
            set((state) => ({ branches: state.branches.filter(b => b !== branch) }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    updateBranch: (oldVal, newVal) => set((state) => ({ branches: state.branches.map(b => b === oldVal ? newVal : b) })),

    // Categories
    addCategory: async (category) => {
        try {
            const newCategory = await MasterDataService.createCategory(category);
            set((state) => ({ categories: [...state.categories, newCategory] }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    removeCategory: async (category) => {
        try {
            await MasterDataService.removeCategory(category);
            set((state) => ({ categories: state.categories.filter(c => c !== category) }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    updateCategory: (oldVal, newVal) => set((state) => ({ categories: state.categories.map(c => c === oldVal ? newVal : c) })),

    // Asset Types
    addAssetType: async (type) => {
        try {
            const newType = await MasterDataService.createAssetType(type);
            set((state) => ({ assetTypes: [...state.assetTypes, newType] }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    removeAssetType: async (type) => {
        try {
            await MasterDataService.removeAssetType(type);
            set((state) => ({ assetTypes: state.assetTypes.filter(t => t !== type) }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    updateAssetType: (oldVal, newVal) => set((state) => ({ assetTypes: state.assetTypes.map(t => t === oldVal ? newVal : t) })),

    // Spare Parts Configuration (Async with Supabase)
    addPartCategory: async (category) => {
        try {
            const newCategory = await MasterDataService.createPartCategory(category);
            set((state) => ({ partCategories: [...state.partCategories, newCategory] }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    removePartCategory: async (category) => {
        try {
            await MasterDataService.removePartCategory(category);
            set((state) => ({ partCategories: state.partCategories.filter(c => c !== category) }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    updatePartCategory: async (oldVal, newVal) => {
        try {
            await MasterDataService.updatePartCategory(oldVal, newVal);
            set((state) => ({ 
                partCategories: state.partCategories.map(c => c === oldVal ? newVal : c),
                parts: state.parts.map(p => p.category === oldVal ? { ...p, category: newVal } : p)
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    addPartLocation: async (location) => {
        try {
            const newLocation = await MasterDataService.createPartLocation(location);
            set((state) => ({ partLocations: [...state.partLocations, newLocation] }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    removePartLocation: async (location) => {
        try {
            await MasterDataService.removePartLocation(location);
            set((state) => ({ partLocations: state.partLocations.filter(l => l !== location) }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    updatePartLocation: async (oldVal, newVal) => {
        try {
            await MasterDataService.updatePartLocation(oldVal, newVal);
            set((state) => ({ 
                partLocations: state.partLocations.map(l => l === oldVal ? newVal : l),
                parts: state.parts.map(p => p.location === oldVal ? { ...p, location: newVal } : p)
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    addPartUnit: async (unit) => {
        try {
            const newUnit = await MasterDataService.createPartUnit(unit);
            set((state) => ({ partUnits: [...state.partUnits, newUnit] }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    removePartUnit: async (unit) => {
        try {
            await MasterDataService.removePartUnit(unit);
            set((state) => ({ partUnits: state.partUnits.filter(u => u !== unit) }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    updatePartUnit: async (oldVal, newVal) => {
        try {
            await MasterDataService.updatePartUnit(oldVal, newVal);
            set((state) => ({ 
                partUnits: state.partUnits.map(u => u === oldVal ? newVal : u),
                parts: state.parts.map(p => p.unitOfMeasure === oldVal ? { ...p, unitOfMeasure: newVal } : p)
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },

    addPartSupplier: async (supplier) => {
        try {
            const newSupplier = await MasterDataService.createPartSupplier(supplier);
            set((state) => ({ partSuppliers: [...state.partSuppliers, newSupplier] }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    removePartSupplier: async (supplier) => {
        try {
            await MasterDataService.removePartSupplier(supplier);
            set((state) => ({ partSuppliers: state.partSuppliers.filter(s => s !== supplier) }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
    updatePartSupplier: async (oldVal, newVal) => {
        try {
            await MasterDataService.updatePartSupplier(oldVal, newVal);
            set((state) => ({ 
                partSuppliers: state.partSuppliers.map(s => s === oldVal ? newVal : s),
                parts: state.parts.map(p => p.supplier === oldVal ? { ...p, supplier: newVal } : p)
            }));
        } catch (error: any) {
            set({ error: error.message });
            throw error;
        }
    },
}));
