import { supabase } from './supabaseClient';
import { Machine, Technician, ZoneStructure } from '../../types';
import { MachineSupabaseService } from './implementations/machineSupabase';
import { masterMockService } from './implementations/masterMock';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

const machineService = useMock ? masterMockService : MachineSupabaseService;
const technicianService = useMock ? masterMockService : null;
const configService = useMock ? masterMockService : null;

export const MasterDataService = {
  // MACHINES
  async getMachines(page: number = 1, limit: number = 25, filters?: any): Promise<{ data: Machine[], total: number }> {
    return machineService.getMachines(page, limit, filters);
  },

  async createMachine(machine: Omit<Machine, 'id'>): Promise<Machine> {
    return machineService.createMachine(machine);
  },

  async updateMachine(machine: Machine): Promise<void> {
    return machineService.updateMachine(machine);
  },

  async deleteMachine(id: string): Promise<void> {
    return machineService.deleteMachine(id);
  },

  async getFilteredMachineHourLogs(filters: { 
    machineId?: string; 
    startDate?: string; 
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    return (machineService as any).getFilteredMachineHourLogs(filters);
  },

  async logMachineHours(log: { 
    machineId: string; 
    hoursLogged: number; 
    unit: 'h' | 'km'; 
    operator: string; 
    comments?: string; 
    nextMaintenance?: string | null;
  }): Promise<any> {
    return (machineService as any).logMachineHours(log);
  },

  async updateMachineHourLog(id: string, log: {
    machineId: string;
    date: string;
    hoursLogged: number;
    unit: 'h' | 'km';
    operator: string;
    comments?: string;
    nextMaintenance?: string | null;
  }): Promise<any> {
    return (machineService as any).updateMachineHourLog(id, log);
  },

  // TECHNICIANS
  async getTechnicians(): Promise<Technician[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('v2_cmms_technicians');
      if (stored) {
        return JSON.parse(stored);
      }
      const initialTechs = [
        { id: 'T1', name: 'Juan Perez', role: 'MECHANICAL', shift: 'MORNING', status: 'ACTIVE', email: 'juan@example.com' },
        { id: 'T2', name: 'Maria Garcia', role: 'ELECTRICAL', shift: 'AFTERNOON', status: 'ACTIVE', email: 'maria@example.com' }
      ];
      localStorage.setItem('v2_cmms_technicians', JSON.stringify(initialTechs));
      return initialTechs as Technician[];
    }
    if (technicianService) return technicianService.getTechnicians();
    const { data, error } = await supabase.from('technicians').select('*');
    if (error) throw error;
    return data as Technician[];
  },

  async createTechnician(tech: Technician): Promise<Technician> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const techs = await this.getTechnicians();
      const newTech = { ...tech, id: 'T-' + Math.random().toString(36).substr(2, 9) };
      techs.push(newTech);
      localStorage.setItem('v2_cmms_technicians', JSON.stringify(techs));
      return newTech as Technician;
    }
    if (technicianService) throw new Error("Mock does not support creating technicians yet");
    const { data, error } = await supabase.from('technicians').insert(tech).select().single();
    if (error) throw error;
    return data as Technician;
  },

  // ZONES
  async getZones(): Promise<ZoneStructure[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('v2_cmms_zones');
      if (stored) {
        return JSON.parse(stored);
      }
      const initialZones = [
        { id: 'z1', name: 'Zone A', lines: ['Line 1', 'Line 2'], color: '#ef4444' },
        { id: 'z2', name: 'Zone B', lines: ['Line 3'], color: '#3b82f6' }
      ];
      localStorage.setItem('v2_cmms_zones', JSON.stringify(initialZones));
      return initialZones as ZoneStructure[];
    }
    if (configService) return configService.getZones();
    const { data, error } = await supabase.from('zones').select('*').order('order_index', { ascending: true });
    if (error) throw error;
    return data.map((z: any) => ({
      ...z,
      orderIndex: z.order_index
    })) as ZoneStructure[];
  },

  async createZone(zone: ZoneStructure): Promise<ZoneStructure> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const zones = await this.getZones();
      const newZone = { ...zone, id: zone.id || 'z-' + Math.random().toString(36).substr(2, 9) };
      zones.push(newZone);
      localStorage.setItem('v2_cmms_zones', JSON.stringify(zones));
      return newZone;
    }
    const { data, error } = await supabase.from('zones').insert({
      id: zone.id,
      name: zone.name,
      lines: zone.lines,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      color: zone.color,
      order_index: zone.orderIndex || 0
    }).select().single();
    if (error) throw error;
    // Map back to camelCase
    return { ...data, orderIndex: data.order_index } as ZoneStructure;
  },

  async updateZone(zone: ZoneStructure): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const zones = await this.getZones();
      const index = zones.findIndex(z => z.id === zone.id);
      if (index !== -1) {
        zones[index] = { ...zones[index], ...zone };
        localStorage.setItem('v2_cmms_zones', JSON.stringify(zones));
      }
      return;
    }
    const { error } = await supabase.from('zones').update({
      name: zone.name,
      lines: zone.lines,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      color: zone.color,
      order_index: zone.orderIndex
    }).eq('id', zone.id);
    if (error) throw error;
  },

  async updateZoneOrder(zonesList: ZoneStructure[]): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      localStorage.setItem('v2_cmms_zones', JSON.stringify(zonesList));
      return;
    }
    // Upsert all zones with new order_index
    // Prepare payload
    const updates = zonesList.map(z => ({
      id: z.id,
      name: z.name,
      lines: z.lines,
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
      color: z.color,
      order_index: z.orderIndex
    }));

    const { error } = await supabase.from('zones').upsert(updates);
    if (error) throw error;
  },

  async removeZone(id: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const zones = await this.getZones();
      const filtered = zones.filter(z => z.id !== id);
      localStorage.setItem('v2_cmms_zones', JSON.stringify(filtered));
      return;
    }
    const { error } = await supabase.from('zones').delete().eq('id', id);
    if (error) throw error;
  },

  // BRANCHES
  async getBranches(): Promise<string[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('v2_cmms_branches');
      if (stored) return JSON.parse(stored);
      const defaults = ['Planta Principal', 'Sucursal Norte', 'Sucursal Sur'];
      localStorage.setItem('v2_cmms_branches', JSON.stringify(defaults));
      return defaults;
    }
    if (configService) return configService.getBranches();
    const { data, error } = await supabase.from('branches').select('name').order('name');
    if (error) throw error;
    return data.map((b: any) => b.name);
  },
  async createBranch(name: string): Promise<string> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getBranches();
      if (!list.includes(name)) {
        list.push(name);
        localStorage.setItem('v2_cmms_branches', JSON.stringify(list));
      }
      return name;
    }
    const { data, error } = await supabase.from('branches').insert({ name }).select('name').single();
    if (error) throw error;
    return data.name;
  },
  async removeBranch(name: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getBranches();
      const filtered = list.filter(b => b !== name);
      localStorage.setItem('v2_cmms_branches', JSON.stringify(filtered));
      return;
    }
    const { error } = await supabase.from('branches').delete().eq('name', name);
    if (error) throw error;
  },
  async updateBranch(oldVal: string, newVal: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getBranches();
      const updated = list.map((b: string) => b === oldVal ? newVal : b);
      localStorage.setItem('v2_cmms_branches', JSON.stringify(updated));
      return;
    }
    const { error: configError } = await supabase.from('branches').update({ name: newVal }).eq('name', oldVal);
    if (configError) throw configError;

    const { error: machineError } = await supabase.from('machines').update({ branch: newVal }).eq('branch', oldVal);
    if (machineError) throw machineError;

    const { error: orderError } = await supabase.from('work_orders').update({ branch: newVal }).eq('branch', oldVal);
    if (orderError) throw orderError;
  },

  // CATEGORIES
  async getCategories(): Promise<string[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('v2_cmms_categories');
      if (stored) return JSON.parse(stored);
      const defaults = ['Producción', 'Impresión', 'Empaque', 'Servicios'];
      localStorage.setItem('v2_cmms_categories', JSON.stringify(defaults));
      return defaults;
    }
    if (configService) return configService.getCategories();
    const { data, error } = await supabase.from('asset_categories').select('name').order('name');
    if (error) throw error;
    return data.map((c: any) => c.name);
  },
  async createCategory(name: string): Promise<string> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getCategories();
      if (!list.includes(name)) {
        list.push(name);
        localStorage.setItem('v2_cmms_categories', JSON.stringify(list));
      }
      return name;
    }
    const { data, error } = await supabase.from('asset_categories').insert({ name }).select('name').single();
    if (error) throw error;
    return data.name;
  },
  async removeCategory(name: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getCategories();
      const filtered = list.filter(c => c !== name);
      localStorage.setItem('v2_cmms_categories', JSON.stringify(filtered));
      return;
    }
    const { error } = await supabase.from('asset_categories').delete().eq('name', name);
    if (error) throw error;
  },
  async updateCategory(oldVal: string, newVal: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getCategories();
      const updated = list.map((c: string) => c === oldVal ? newVal : c);
      localStorage.setItem('v2_cmms_categories', JSON.stringify(updated));
      return;
    }
    const { error: configError } = await supabase.from('asset_categories').update({ name: newVal }).eq('name', oldVal);
    if (configError) throw configError;

    const { error: machineError } = await supabase.from('machines').update({ category: newVal }).eq('category', oldVal);
    if (machineError) throw machineError;
  },

  // ASSET TYPES
  async getAssetTypes(): Promise<string[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('v2_cmms_asset_types');
      if (stored) return JSON.parse(stored);
      const defaults = ['SACMI', 'MOSS', 'PMV', 'GENERIC'];
      localStorage.setItem('v2_cmms_asset_types', JSON.stringify(defaults));
      return defaults;
    }
    if (configService) return configService.getAssetTypes();
    const { data, error } = await supabase.from('machine_types').select('name').order('name');
    if (error) throw error;
    return data.map(d => d.name);
  },
  async createAssetType(name: string): Promise<string> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getAssetTypes();
      if (!list.includes(name)) {
        list.push(name);
        localStorage.setItem('v2_cmms_asset_types', JSON.stringify(list));
      }
      return name;
    }
    const { data, error } = await supabase.from('machine_types').insert({ name }).select('name').single();
    if (error) throw error;
    return data.name;
  },
  async removeAssetType(name: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getAssetTypes();
      const filtered = list.filter((n: string) => n !== name);
      localStorage.setItem('v2_cmms_asset_types', JSON.stringify(filtered));
      return;
    }
    const { error } = await supabase.from('machine_types').delete().eq('name', name);
    if (error) throw error;
  },
  async updateAssetType(oldVal: string, newVal: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getAssetTypes();
      const updated = list.map((t: string) => t === oldVal ? newVal : t);
      localStorage.setItem('v2_cmms_asset_types', JSON.stringify(updated));
      return;
    }
    const { error: configError } = await supabase.from('machine_types').update({ name: newVal }).eq('name', oldVal);
    if (configError) throw configError;

    const { error: machineError } = await supabase.from('machines').update({ type: newVal }).eq('type', oldVal);
    if (machineError) throw machineError;

    const { error: orderError } = await supabase.from('work_orders').update({ equipment_type: newVal }).eq('equipment_type', oldVal);
    if (orderError) throw orderError;
  },

  // SETTINGS (Metadata)
  async getPlantSettings(): Promise<any> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('coreflow_mock_plant_settings');
      if (stored) {
        return JSON.parse(stored);
      }
      const defaults = {
        plantName: 'Planta Principal CoreFlow',
        rnc: '131-12345-6',
        timezone: 'America/Santo_Domingo',
        currency: 'USD',
        logoUrl: ''
      };
      localStorage.setItem('coreflow_mock_plant_settings', JSON.stringify(defaults));
      return defaults;
    }
    const { data, error } = await supabase.from('plant_settings').select('*').single();
    if (error) {
      console.warn("Could not fetch plant settings:", error.message);
      return null;
    }
    return {
      plantName: data.plant_name,
      rnc: data.rnc,
      timezone: data.timezone,
      currency: data.currency,
      logoUrl: data.logo_url
    };
  },

  async updatePlantSettings(settings: any): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      localStorage.setItem('coreflow_mock_plant_settings', JSON.stringify(settings));
      return;
    }
    const { error } = await supabase.from('plant_settings').upsert({
      id: 1, // Force singleton
      plant_name: settings.plantName,
      rnc: settings.rnc,
      timezone: settings.timezone,
      currency: settings.currency,
      logo_url: settings.logoUrl,
      updated_at: new Date()
    });
    if (error) throw error;
  },

  // SPARE PARTS CONFIGURATION
  // Categories
  async getPartCategories(): Promise<string[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('v2_cmms_part_categories');
      if (stored) return JSON.parse(stored);
      const defaults = ['MECHANICAL', 'ELECTRICAL', 'HYDRAULIC', 'PNEUMATIC', 'CONSUMABLE'];
      localStorage.setItem('v2_cmms_part_categories', JSON.stringify(defaults));
      return defaults;
    }
    if (configService) return configService.getPartCategories();
    const { data, error } = await supabase.from('part_categories').select('name').order('name');
    if (error) throw error;
    return data.map(d => d.name);
  },
  async createPartCategory(name: string): Promise<string> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartCategories();
      if (!list.includes(name)) {
        list.push(name);
        localStorage.setItem('v2_cmms_part_categories', JSON.stringify(list));
      }
      return name;
    }
    const { data, error } = await supabase.from('part_categories').insert({ name }).select('name').single();
    if (error) throw error;
    return data.name;
  },
  async removePartCategory(name: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartCategories();
      const filtered = list.filter((n: string) => n !== name);
      localStorage.setItem('v2_cmms_part_categories', JSON.stringify(filtered));
      return;
    }
    const { error } = await supabase.from('part_categories').delete().eq('name', name);
    if (error) throw error;
  },

  // Locations
  async getPartLocations(): Promise<string[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('v2_cmms_part_locations');
      if (stored) return JSON.parse(stored);
      const defaults = ['BODEGA-A', 'BODEGA-B', 'ESTANTE-1'];
      localStorage.setItem('v2_cmms_part_locations', JSON.stringify(defaults));
      return defaults;
    }
    if (configService) return configService.getPartLocations();
    const { data, error } = await supabase.from('part_locations').select('name').order('name');
    if (error) throw error;
    return data.map(d => d.name);
  },
  async createPartLocation(name: string): Promise<string> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartLocations();
      if (!list.includes(name)) {
        list.push(name);
        localStorage.setItem('v2_cmms_part_locations', JSON.stringify(list));
      }
      return name;
    }
    const { data, error } = await supabase.from('part_locations').insert({ name }).select('name').single();
    if (error) throw error;
    return data.name;
  },
  async removePartLocation(name: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartLocations();
      const filtered = list.filter((n: string) => n !== name);
      localStorage.setItem('v2_cmms_part_locations', JSON.stringify(filtered));
      return;
    }
    const { error } = await supabase.from('part_locations').delete().eq('name', name);
    if (error) throw error;
  },

  // Units
  async getPartUnits(): Promise<string[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('v2_cmms_part_units');
      if (stored) return JSON.parse(stored);
      const defaults = ['PCS', 'M', 'KG', 'L'];
      localStorage.setItem('v2_cmms_part_units', JSON.stringify(defaults));
      return defaults;
    }
    if (configService) return configService.getPartUnits();
    const { data, error } = await supabase.from('spare_part_units').select('name').order('name');
    if (error) throw error;
    return data.map((u: any) => u.name);
  },
  async createPartUnit(name: string): Promise<string> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartUnits();
      if (!list.includes(name)) {
        list.push(name);
        localStorage.setItem('v2_cmms_part_units', JSON.stringify(list));
      }
      return name;
    }
    const { data, error } = await supabase.from('spare_part_units').insert({ name }).select('name').single();
    if (error) throw error;
    return data.name;
  },
  async removePartUnit(name: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartUnits();
      const filtered = list.filter(u => u !== name);
      localStorage.setItem('v2_cmms_part_units', JSON.stringify(filtered));
      return;
    }
    const { error } = await supabase.from('spare_part_units').delete().eq('name', name);
    if (error) throw error;
  },

  // Update with Cascade
  async updatePartCategory(oldName: string, newName: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartCategories();
      const updated = list.map((n: string) => n === oldName ? newName : n);
      localStorage.setItem('v2_cmms_part_categories', JSON.stringify(updated));
      return;
    }
    // 1. Update config table
    const { error: configError } = await supabase.from('part_categories').update({ name: newName }).eq('name', oldName);
    if (configError) throw configError;

    // 2. Cascade to spare_parts (Wait, ON UPDATE CASCADE does this automatically for FKs in phase 3, but let's keep it for fallback)
    const { error: cascadeError } = await supabase.from('spare_parts').update({ category: newName }).eq('category', oldName);
    if (cascadeError) throw cascadeError;
  },

  async updatePartLocation(oldName: string, newName: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartLocations();
      const updated = list.map((n: string) => n === oldName ? newName : n);
      localStorage.setItem('v2_cmms_part_locations', JSON.stringify(updated));
      return;
    }
    // 1. Update config table
    const { error: configError } = await supabase.from('part_locations').update({ name: newName }).eq('name', oldName);
    if (configError) throw configError;

    // 2. Cascade to spare_parts
    const { error: cascadeError } = await supabase.from('spare_parts').update({ location_code: newName }).eq('location_code', oldName);
    if (cascadeError) throw cascadeError;
  },

  async updatePartUnit(oldName: string, newName: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartUnits();
      const index = list.indexOf(oldName);
      if (index !== -1) {
        list[index] = newName;
        localStorage.setItem('v2_cmms_part_units', JSON.stringify(list));
      }
      return;
    }
    // 1. Update config table
    const { error: configError } = await supabase.from('spare_part_units').update({ name: newName }).eq('name', oldName);
    if (configError) throw configError;

    // 2. Cascade to spare_parts
    const { error: cascadeError } = await supabase.from('spare_parts').update({ unit_of_measure: newName }).eq('unit_of_measure', oldName);
    if (cascadeError) throw cascadeError;
  },

  // Suppliers
  async getPartSuppliers(): Promise<string[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('v2_cmms_part_suppliers');
      if (stored) return JSON.parse(stored);
      const defaults = ['PROVEEDOR-1', 'PROVEEDOR-2', 'PROVEEDOR-3'];
      localStorage.setItem('v2_cmms_part_suppliers', JSON.stringify(defaults));
      return defaults;
    }
    if (configService) return (configService as any).getPartSuppliers();
    const { data, error } = await supabase.from('part_suppliers').select('name').order('name');
    if (error) throw error;
    return data.map(d => d.name);
  },
  async createPartSupplier(name: string): Promise<string> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartSuppliers();
      if (!list.includes(name)) {
        list.push(name);
        localStorage.setItem('v2_cmms_part_suppliers', JSON.stringify(list));
      }
      return name;
    }
    const { data, error } = await supabase.from('part_suppliers').insert({ name }).select('name').single();
    if (error) throw error;
    return data.name;
  },
  async removePartSupplier(name: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartSuppliers();
      const filtered = list.filter((n: string) => n !== name);
      localStorage.setItem('v2_cmms_part_suppliers', JSON.stringify(filtered));
      return;
    }
    const { error } = await supabase.from('part_suppliers').delete().eq('name', name);
    if (error) throw error;
  },
  async updatePartSupplier(oldName: string, newName: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const list = await this.getPartSuppliers();
      const updated = list.map((n: string) => n === oldName ? newName : n);
      localStorage.setItem('v2_cmms_part_suppliers', JSON.stringify(updated));
      return;
    }
    // 1. Update config table
    const { error: configError } = await supabase.from('part_suppliers').update({ name: newName }).eq('name', oldName);
    if (configError) throw configError;

    // 2. Cascade to spare_parts
    const { error: cascadeError } = await supabase.from('spare_parts').update({ supplier: newName }).eq('supplier', oldName);
    if (cascadeError) throw cascadeError;
  }
};
