import { Machine, Technician, ZoneStructure, MachineStatus, MachineHourLog } from '../../../types';
import { saveToStorage, loadFromStorage } from '../../utils/persistence';

const MACHINES_KEY = 'v2_cmms_machines';
const TECHS_KEY = 'v2_cmms_technicians';
const ZONES_KEY = 'v2_cmms_zones';
const MACHINE_LOGS_KEY = 'v2_cmms_machine_hour_logs';

const INITIAL_MACHINE_LOGS: MachineHourLog[] = [
    {
        id: 'log-1',
        machineId: 'm1',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        hoursLogged: 1200,
        unit: 'h',
        operator: 'Juan Perez',
        comments: 'Lectura de rutina',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'log-2',
        machineId: 'm1',
        date: new Date().toISOString().split('T')[0],
        hoursLogged: 1250,
        unit: 'h',
        operator: 'Juan Perez',
        comments: 'Lectura de rutina',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    },
    {
        id: 'log-3',
        machineId: 'm2',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        hoursLogged: 850,
        unit: 'h',
        operator: 'Maria Garcia',
        comments: 'Lectura de rutina',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000).toISOString()
    }
];

const INITIAL_MACHINES: Machine[] = [
    {
        id: 'm1',
        name: 'SACMI Press 01',
        plate: 'SP-001',
        alias: 'SP-001',
        type: 'SACMI',
        status: MachineStatus.RUNNING,
        isActive: true,
        location: { x: 20, y: 30 },
        zone: 'Zone A',
        branch: 'Planta Principal',
        category: 'Producción',
        isIot: true,
        runningHours: 1250,
        lastMaintenance: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        nextMaintenance: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        telemetry: { timestamp: new Date().toISOString(), temperature: 45, vibration: 2.5, pressure: 180, powerConsumption: 12.5 },
        history: [],
        brand: 'SACMI',
        model: 'PH-500',
        year: 2021,
        documents: []
    },
    {
        id: 'm2',
        name: 'MOSS Printer 03',
        plate: 'MP-003',
        alias: 'MP-003',
        type: 'MOSS',
        status: MachineStatus.IDLE,
        isActive: true,
        location: { x: 50, y: 30 },
        zone: 'Zone B',
        branch: 'Planta Principal',
        category: 'Impresión',
        isIot: false,
        runningHours: 850,
        lastMaintenance: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        nextMaintenance: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        telemetry: { timestamp: new Date().toISOString(), temperature: 30, vibration: 0.5, pressure: 0, powerConsumption: 2.1 },
        history: [],
        brand: 'MOSS',
        model: 'MS-1000',
        year: 2019,
        documents: []
    }
];

const INITIAL_TECHS: Technician[] = [
    { id: 'T1', name: 'Juan Perez', role: 'MECHANICAL', shift: 'MORNING', status: 'ACTIVE', email: 'juan@example.com' },
    { id: 'T2', name: 'Maria Garcia', role: 'ELECTRICAL', shift: 'AFTERNOON', status: 'ACTIVE', email: 'maria@example.com' }
];

const INITIAL_ZONES: ZoneStructure[] = [
    { id: 'z1', name: 'Zone A', lines: ['Line 1', 'Line 2'], color: '#ef4444' },
    { id: 'z2', name: 'Zone B', lines: ['Line 3'], color: '#3b82f6' }
];

export class MasterMockService {
    async getMachines(page: number = 1, limit: number = 25, filters?: any): Promise<{ data: Machine[], total: number }> {
        let machines = loadFromStorage(MACHINES_KEY, INITIAL_MACHINES);
        
        if (filters) {
            if (filters.search) {
                const s = filters.search.toLowerCase();
                machines = machines.filter(m => 
                    m.name.toLowerCase().includes(s) || 
                    m.plate.toLowerCase().includes(s) ||
                    (m.brand && m.brand.toLowerCase().includes(s))
                );
            }
            if (filters.branch && filters.branch !== 'all' && filters.branch !== '') {
                machines = machines.filter(m => m.branch === filters.branch);
            }
            if (filters.category && filters.category !== 'all' && filters.category !== '') {
                machines = machines.filter(m => m.category === filters.category);
            }
            if (filters.zone && filters.zone !== 'all' && filters.zone !== '') {
                machines = machines.filter(m => m.zone === filters.zone);
            }
            if (filters.showInactive !== undefined) {
                machines = machines.filter(m => filters.showInactive ? !m.isActive : m.isActive !== false);
            } else {
                machines = machines.filter(m => m.isActive !== false);
            }
        } else {
            machines = machines.filter(m => m.isActive !== false);
        }

        const total = machines.length;
        const from = (page - 1) * limit;
        const to = from + limit;
        return { data: machines.slice(from, to), total };
    }

    async getTechnicians(): Promise<Technician[]> {
        return loadFromStorage(TECHS_KEY, INITIAL_TECHS);
    }

    async getZones(): Promise<ZoneStructure[]> {
        return loadFromStorage(ZONES_KEY, INITIAL_ZONES);
    }

    async getBranches(): Promise<string[]> {
        return ['Planta Principal', 'Sucursal Norte', 'Sucursal Sur'];
    }

    async getCategories(): Promise<string[]> {
        return ['Producción', 'Impresión', 'Empaque', 'Servicios'];
    }

    async getAssetTypes(): Promise<string[]> {
        return ['SACMI', 'MOSS', 'PMV', 'GENERIC'];
    }

    async getPartCategories(): Promise<string[]> {
        return ['Bearings', 'Hydraulics', 'Electronics', 'Transmission', 'Filters'];
    }

    async getPartLocations(): Promise<string[]> {
        return ['A-01', 'B-03', 'C-02', 'A-05', 'D-01'];
    }

    async getPartUnits(): Promise<string[]> {
        return ['PCS', 'M', 'KG', 'L'];
    }

    async getPartSuppliers(): Promise<string[]> {
        return ['FESTO', 'SMC', 'SKF', 'Siemens', 'Bosch Rexroth'];
    }

    async createMachine(machine: Omit<Machine, 'id'>): Promise<Machine> {
        const machines = loadFromStorage(MACHINES_KEY, INITIAL_MACHINES);
        const newMachine: Machine = {
            ...machine,
            id: `m-${Date.now()}`
        } as Machine;
        machines.push(newMachine);
        saveToStorage(MACHINES_KEY, machines);
        return newMachine;
    }

    async updateMachine(machine: Machine): Promise<void> {
        const machines = loadFromStorage(MACHINES_KEY, INITIAL_MACHINES);
        const index = machines.findIndex(m => m.id === machine.id);
        if (index !== -1) {
            machines[index] = { ...machines[index], ...machine };
            saveToStorage(MACHINES_KEY, machines);
        }
    }

    async deleteMachine(id: string): Promise<void> {
        const machines = loadFromStorage(MACHINES_KEY, INITIAL_MACHINES);
        const filtered = machines.filter(m => m.id !== id);
        saveToStorage(MACHINES_KEY, filtered);
    }

    async getFilteredMachineHourLogs(filters: { 
        machineId?: string; 
        startDate?: string; 
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<{ data: MachineHourLog[]; total: number }> {
        let logs = loadFromStorage(MACHINE_LOGS_KEY, INITIAL_MACHINE_LOGS);

        if (filters.machineId) {
            logs = logs.filter(l => l.machineId === filters.machineId);
        }
        if (filters.startDate) {
            logs = logs.filter(l => l.date >= filters.startDate!);
        }
        if (filters.endDate) {
            logs = logs.filter(l => l.date <= filters.endDate!);
        }

        // Sort by date desc, then by id desc
        logs.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

        const total = logs.length;
        const page = filters.page || 1;
        const limit = filters.limit || 25;
        const from = (page - 1) * limit;
        const to = from + limit;

        return { data: logs.slice(from, to), total };
    }

    async logMachineHours(log: { 
        machineId: string; 
        hoursLogged: number; 
        unit: 'h' | 'km'; 
        operator: string; 
        comments?: string; 
        nextMaintenance?: string | null;
    }): Promise<MachineHourLog> {
        const logs = loadFromStorage(MACHINE_LOGS_KEY, INITIAL_MACHINE_LOGS);
        const newLog: MachineHourLog = {
            id: `log-${Date.now()}`,
            machineId: log.machineId,
            date: new Date().toISOString().split('T')[0],
            hoursLogged: log.hoursLogged,
            unit: log.unit,
            operator: log.operator,
            comments: log.comments,
            createdAt: new Date().toISOString()
        };
        logs.unshift(newLog);
        saveToStorage(MACHINE_LOGS_KEY, logs);

        // Also update the machine's runningHours and nextMaintenance in localStorage
        const machines = loadFromStorage(MACHINES_KEY, INITIAL_MACHINES);
        const machineIndex = machines.findIndex(m => m.id === log.machineId);
        if (machineIndex !== -1) {
            machines[machineIndex].runningHours = log.hoursLogged;
            if (log.nextMaintenance !== undefined) {
                machines[machineIndex].nextMaintenance = log.nextMaintenance;
            }
            saveToStorage(MACHINES_KEY, machines);
        }

        return newLog;
    }

    async updateMachineHourLog(id: string, log: {
        machineId: string;
        date: string;
        hoursLogged: number;
        unit: 'h' | 'km';
        operator: string;
        comments?: string;
        nextMaintenance?: string | null;
    }): Promise<MachineHourLog> {
        const logs = loadFromStorage(MACHINE_LOGS_KEY, INITIAL_MACHINE_LOGS);
        const logIndex = logs.findIndex(l => l.id === id);
        if (logIndex === -1) {
            throw new Error("Log not found");
        }

        // Update the log
        logs[logIndex] = {
            ...logs[logIndex],
            date: log.date,
            hoursLogged: log.hoursLogged,
            unit: log.unit,
            operator: log.operator,
            comments: log.comments,
            createdAt: logs[logIndex].createdAt || new Date().toISOString()
        };

        saveToStorage(MACHINE_LOGS_KEY, logs);

        // Fetch latest log for this machine to sync machine's runningHours
        const machineLogs = logs.filter(l => l.machineId === log.machineId);
        // Sort: date desc, then createdAt desc
        machineLogs.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

        if (machineLogs.length > 0) {
            const latestReading = machineLogs[0].hoursLogged;
            const machines = loadFromStorage(MACHINES_KEY, INITIAL_MACHINES);
            const machineIndex = machines.findIndex(m => m.id === log.machineId);
            if (machineIndex !== -1) {
                machines[machineIndex].runningHours = latestReading;
                if (log.nextMaintenance !== undefined) {
                    machines[machineIndex].nextMaintenance = log.nextMaintenance;
                }
                saveToStorage(MACHINES_KEY, machines);
            }
        }

        return logs[logIndex];
    }
}

export const masterMockService = new MasterMockService();
