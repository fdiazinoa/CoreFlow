import { supabase, getPaginationRange } from '../supabaseClient';
import { PaginationParams } from '../../types/pagination';
import { Machine } from '../../../types';

export const MachineSupabaseService = {
  async getMachines(
    page: number = 1, 
    limit: number = 25,
    filters?: {
      search?: string;
      branch?: string;
      category?: string;
      type?: string;
      zone?: string;
      showInactive?: boolean;
    }
  ): Promise<{ data: Machine[], total: number }> {
    const { from, to } = getPaginationRange(page, limit);
    
    let query = supabase
      .from('machines')
      .select('*', { count: 'exact' });

    if (filters) {
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%,brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%`);
      }
      if (filters.branch && filters.branch !== 'all') {
        query = query.eq('branch', filters.branch);
      }
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }
      if (filters.zone && filters.zone !== 'all') {
        query = query.eq('zone', filters.zone);
      }
      if (filters.showInactive !== undefined) {
        query = query.eq('is_active', !filters.showInactive);
      } else {
        query = query.eq('is_active', true);
      }
    } else {
      query = query.eq('is_active', true);
    }

    const { data, count, error } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching machines:', error);
      throw error;
    }

    const mappedData = (data || []).map((record: any) => {
      const specs = record.specifications || {};

      return {
        id: record.id,
        name: record.name,
        code: record.code || '',
        alias: record.code || '',
        serialNumber: record.serial_number || '',
        plate: record.serial_number || '', // Map serial_number to plate for component compatibility
        type: record.type || '', // Use empty string if null, default to GENERIC in UI
        status: record.status || 'IDLE',
        location: { x: record.location_x || 0, y: record.location_y || 0 },
        branch: record.branch || '',
        category: record.category || '',
        zone: record.zone || '',
        brand: record.brand || '',
        model: record.model || '',
        year: record.year || null,
        imageUrl: record.image_url || '',
        brandId: record.brand_id || undefined,
        typeId: record.type_id || undefined,
        isIot: record.is_iot || false,
        isActive: record.is_active !== false, // Default to true if not specified
        runningHours: record.running_hours || 0,
        lastMaintenance: record.last_maintenance || null,
        nextMaintenance: record.next_maintenance || null,
        specifications: specs,
        // Extract technical specs from JSONB for component compatibility
        voltage: specs.voltage || null,
        frequency: specs.frequency || null,
        power: specs.power || null,
        capacity: specs.capacity || null,
        currentRating: specs.currentRating || null,
        intervals: [],
        history: [],
        telemetry: { timestamp: new Date().toISOString(), temperature: 0, vibration: 0, pressure: 0, powerConsumption: 0 },
        documents: record.documents || [], // ✅ FIX: Map documents field
        maintenancePlans: record.maintenance_plans || [], // ✅ FIX: Map maintenance plans
        criticalParts: record.critical_parts || [] // ✅ FIX: Map Kardex
      };
    }) as Machine[];

    return { data: mappedData, total: count || 0 };
  },

  async createMachine(machine: Omit<Machine, 'id'>): Promise<Machine> {
    console.log("==> createMachine Payload:", machine);
    console.log("==> createMachine Category:", machine.category);
    
    // Build specifications object from individual fields
    const specifications: any = { ...(machine.specifications || {}) };

    // Add technical specs if they exist as top-level properties
    if ((machine as any).voltage) specifications.voltage = (machine as any).voltage;
    if ((machine as any).frequency) specifications.frequency = (machine as any).frequency;
    if ((machine as any).power) specifications.power = (machine as any).power;
    if ((machine as any).capacity) specifications.capacity = (machine as any).capacity;
    if ((machine as any).currentRating) specifications.currentRating = (machine as any).currentRating;

    const { data, error } = await supabase
      .from('machines')
      .insert({
        name: machine.name,
        code: (machine as any).alias || machine.code || null,
        serial_number: (machine as any).plate || machine.serialNumber || null,
        type: machine.type || null, // Persist exact type or null
        status: machine.status || 'IDLE',
        location_x: machine.location?.x || 0,
        location_y: machine.location?.y || 0,
        branch: machine.branch || null,
        category: machine.category || null,
        zone: machine.zone || null,
        brand: machine.brand || null,
        model: machine.model || null,
        year: machine.year || null,
        image_url: machine.imageUrl || null,
        specifications: specifications,
        is_iot: machine.isIot || false,
        is_active: (machine as any).isActive !== false, // ✅ FIX: Persist isActive field
        running_hours: machine.runningHours || 0,
        last_maintenance: machine.lastMaintenance || null,
        next_maintenance: machine.nextMaintenance || null,
        documents: machine.documents || [], // ✅ FIX: Persist documents field
        maintenance_plans: machine.maintenancePlans || [], // ✅ FIX: Persist maintenance plans
        critical_parts: machine.criticalParts || [], // ✅ FIX: Persist Kardex
        brand_id: machine.brandId || null,
        type_id: machine.typeId || null
      })
      .select()
      .single();

    if (error) throw error;

    // Return mapped object with new ID
    return {
      ...machine,
      id: data.id,
    } as Machine;
  },

  async updateMachine(machine: Machine): Promise<void> {
    console.log("==> updateMachine Payload:", machine);
    
    // Build specifications object from individual fields
    const specifications: any = { ...(machine.specifications || {}) };

    // Add technical specs if they exist as top-level properties
    if ((machine as any).voltage) specifications.voltage = (machine as any).voltage;
    if ((machine as any).frequency) specifications.frequency = (machine as any).frequency;
    if ((machine as any).power) specifications.power = (machine as any).power;
    if ((machine as any).capacity) specifications.capacity = (machine as any).capacity;
    if ((machine as any).currentRating) specifications.currentRating = (machine as any).currentRating;

    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (machine.name !== undefined) updatePayload.name = machine.name;
    if ((machine as any).alias !== undefined || (machine as any).code !== undefined) {
      updatePayload.code = (machine as any).alias || (machine as any).code || null;
    }
    if ((machine as any).plate !== undefined || (machine as any).serialNumber !== undefined) {
      updatePayload.serial_number = (machine as any).plate || (machine as any).serialNumber || null;
    }
    if (machine.type !== undefined) {
      updatePayload.type = machine.type || null;
    }
    if (machine.status !== undefined) updatePayload.status = machine.status;
    if (machine.location?.x !== undefined) updatePayload.location_x = machine.location.x;
    if (machine.location?.y !== undefined) updatePayload.location_y = machine.location.y;
    if (machine.branch !== undefined) updatePayload.branch = machine.branch;
    if (machine.category !== undefined) updatePayload.category = machine.category;
    if (machine.zone !== undefined) updatePayload.zone = machine.zone;
    if (machine.brand !== undefined) updatePayload.brand = machine.brand;
    if (machine.model !== undefined) updatePayload.model = machine.model;
    if (machine.brandId !== undefined) updatePayload.brand_id = machine.brandId;
    if (machine.typeId !== undefined) updatePayload.type_id = machine.typeId;
    if (machine.year !== undefined) updatePayload.year = machine.year;
    if (machine.imageUrl !== undefined) updatePayload.image_url = machine.imageUrl;
    if (machine.isIot !== undefined) updatePayload.is_iot = machine.isIot;
    if ((machine as any).isActive !== undefined) updatePayload.is_active = (machine as any).isActive;
    
    // Only update running_hours if explicitly provided
    if (machine.runningHours !== undefined && machine.runningHours !== null) {
      updatePayload.running_hours = machine.runningHours;
    }

    if (machine.lastMaintenance !== undefined) updatePayload.last_maintenance = machine.lastMaintenance;
    if (machine.nextMaintenance !== undefined) updatePayload.next_maintenance = machine.nextMaintenance;
    if (machine.documents !== undefined) updatePayload.documents = machine.documents;
    if (machine.maintenancePlans !== undefined) updatePayload.maintenance_plans = machine.maintenancePlans;
    if (machine.criticalParts !== undefined) updatePayload.critical_parts = machine.criticalParts;
    
    // Specifications is special (JSONB)
    if (Object.keys(specifications).length > 0) {
      updatePayload.specifications = { ...(machine.specifications || {}), ...specifications };
    }

    const { error } = await supabase
      .from('machines')
      .update(updatePayload)
      .eq('id', machine.id);

    if (error) {
      console.error("==> updateMachine Supabase Error:", JSON.stringify(error, null, 2));
      throw error;
    }
  },

  async getRecentMachineHourLogs(limit: number = 25): Promise<any[]> {
    const { data, error } = await supabase
      .from('machine_hour_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent logs:', error);
      return [];
    }

    return data.map((log: any) => ({
      id: log.id,
      machineId: log.machine_id,
      date: log.date,
      hoursLogged: log.hours_logged,
      unit: log.unit || 'h',
      operator: log.operator || 'Unknown',
      comments: log.comments
    }));
  },

  async getMachineHourLogs(machineId: string, params?: PaginationParams): Promise<any[]> {
    console.log("Service: getMachineHourLogs called for:", machineId);
    
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('machine_hour_logs')
      .select('*')
      .eq('machine_id', machineId)
      .order('date', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching machine logs:', error);
      return [];
    }

    console.log("Service: getMachineHourLogs data:", data);

    // Map snake_case to camelCase
    return data.map((log: any) => ({
      id: log.id,
      machineId: log.machine_id,
      date: log.date,
      hoursLogged: log.hours_logged,
      unit: log.unit || 'h',
      operator: log.operator || 'Unknown',
      comments: log.comments
    }));
  },

  async getFilteredMachineHourLogs(filters: { 
    machineId?: string, 
    startDate?: string, 
    endDate?: string,
    page?: number,
    limit?: number
  }): Promise<{ data: any[], total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const { from, to } = getPaginationRange(page, limit);

    let query = supabase
      .from('machine_hour_logs')
      .select('*', { count: 'exact' });

    if (filters.machineId) {
      query = query.eq('machine_id', filters.machineId);
    }
    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data, count, error } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching filtered logs:', error);
      throw error;
    }

    const mappedData = (data || []).map((log: any) => ({
      id: log.id,
      machineId: log.machine_id,
      date: log.date,
      hoursLogged: log.hours_logged,
      unit: log.unit || 'h',
      operator: log.operator || 'Unknown',
      comments: log.comments
    }));

    return { data: mappedData, total: count || 0 };
  },

  async logMachineHours(log: { machineId: string, hoursLogged: number, unit: 'h' | 'km', operator: string, comments?: string }): Promise<any> {
    // 1. Get current machine to update hours
    const { data: machineData, error: fetchError } = await supabase
      .from('machines')
      .select('running_hours')
      .eq('id', log.machineId)
      .single();

    if (fetchError) {
      console.error("Failed to fetch machine hours:", fetchError);
      throw fetchError;
    }

    const currentHours = machineData.running_hours || 0;
    const newTotalHours = currentHours + log.hoursLogged;

    // 2. Update machine hours
    const { error: updateError } = await supabase
      .from('machines')
      .update({ running_hours: newTotalHours, updated_at: new Date().toISOString() })
      .eq('id', log.machineId);

    if (updateError) {
      console.error("Failed to update machine hours:", updateError);
      throw updateError;
    }

    // 3. Insert log
    const { data: logData, error: insertError } = await supabase
      .from('machine_hour_logs')
      .insert({
        machine_id: log.machineId,
        date: new Date().toISOString().split('T')[0],
        hours_logged: log.hoursLogged,
        operator: log.operator,
        comments: log.comments || null,
        unit: log.unit
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert log:", insertError);
      throw insertError;
    }

    return {
      id: logData.id,
      machineId: logData.machine_id,
      date: logData.date,
      hoursLogged: logData.hours_logged,
      unit: logData.unit,
      operator: logData.operator,
      comments: logData.comments
    };
  },

  async deleteMachine(id: string): Promise<void> { // Optional
    const { error } = await supabase.from('machines').delete().eq('id', id);
    if (error) throw error;
  }
};
