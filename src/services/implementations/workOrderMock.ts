import { WorkOrder, WorkOrderStatus, WorkOrderStage, Priority } from '../../../types';
import { IWorkOrderService } from '../workOrderService';
import { saveToStorage, loadFromStorage } from '../../utils/persistence';

const INITIAL_ORDERS: WorkOrder[] = [
    { id: 'WO-101', title: 'Lubrication Pump Fail', machineId: 'm2', status: WorkOrderStatus.IN_PROGRESS, currentStage: WorkOrderStage.EXECUTION, priority: Priority.HIGH, description: 'Vibration detected in main pump assembly.', createdDate: '2023-10-20T08:00:00Z', type: 'CORRECTIVE', formType: 'R-MANT-02' },
    {
        id: 'WO-102',
        displayId: 'RM05-00002',
        title: 'Weekly Inspection & Calibration',
        machineId: 'm1',
        status: WorkOrderStatus.BACKLOG,
        currentStage: WorkOrderStage.REQUESTED,
        priority: Priority.MEDIUM,
        description: 'Standard weekly inspection and testing of the safety switches.',
        createdDate: '2023-10-21T09:00:00Z',
        type: 'CORRECTIVE',
        formType: 'R-MANT-05',
        
        assignedTo: 'T2',
        branch: 'Ravi Caribe',
        department: 'Calidad',
        equipmentType: 'Mantenimiento Maquinaria',
        condition: 'Normal',
        failureType: 'Mecánica',
        requestDescription: 'Se solicita inspección semanal del sistema de enclavamiento físico de la compuerta número 3 de la prensa.',
        frequency: 'Primera vez',
        consequence: 'Ninguna',
        actionTaken: 'Monitoreo manual preventivo.',
        
        checklist: { pointClean: null, areaClean: null, guardsComplete: null, toolsRemoved: null, greaseCleaned: null, safetyActivated: null }
    },
    {
        id: 'WO-103',
        displayId: 'RM05-00003',
        title: 'Sensor Calibration & Replacement',
        machineId: 'm1', // linked to SACMI Press 01
        status: WorkOrderStatus.DONE,
        currentStage: WorkOrderStage.CLOSED,
        priority: Priority.LOW,
        description: 'Calibrate vision system and replace worn sensor on the main station.',
        createdDate: '2023-10-18T10:00:00Z',
        completedDate: '2023-10-19T16:18:00Z',
        type: 'CORRECTIVE',
        formType: 'R-MANT-05',
        
        // R-MANT-05 Fields
        assignedTo: 'T1', // Juan Perez
        branch: 'Ravi Caribe',
        department: 'Mantenimiento',
        equipmentType: 'Mantenimiento Maquinaria',
        condition: 'Crítica',
        failureType: 'Electrónica',
        requestDescription: 'El sensor de visión de la estación principal está enviando lecturas fuera de rango intermitentemente, lo que provoca paradas continuas de la línea de producción.',
        frequency: 'Ocasional',
        consequence: 'Bajo Rendimiento',
        actionTaken: 'Se realiza limpieza de lentes y recalibración por software. Posteriormente se decide cambiar el sensor defectuoso.',
        
        // Execution
        startTime: '10:00',
        endTime: '16:18',
        requestReceivedBy: 'Juan Perez',
        requestReceivedDate: '2023-10-18T10:15:00Z',
        assignedMechanic: 'Juan Perez',
        failuresAndActivities: [
            { cause: 'Sensor de proximidad óptico dañado por sobrecalentamiento.', activity: 'Cambio de sensor y ajuste de soportes.' },
            { cause: 'Descalibración del módulo de visión artificial.', activity: 'Calibración por software de control y pruebas dinámicas.' }
        ],
        consumedParts: [
            { partId: 'part-1', partName: 'Sensor Proximidad Óptico', sku: 'SENS-OP-09', quantity: 1, unit: 'Pieza', unitCost: 1500, totalCost: 1500 },
            { partId: 'part-2', partName: 'Cable Conector M12', sku: 'CAB-M12-02', quantity: 1, unit: 'Pieza', unitCost: 350, totalCost: 350 }
        ],
        totalMaintenanceCost: 1850,
        
        // Checklist
        checklist: {
            pointClean: true,
            areaClean: true,
            guardsComplete: true,
            toolsRemoved: true,
            greaseCleaned: true,
            safetyActivated: true
        },
        
        // Signatures & Cierre
        closingImage: '',
        closingFile: '',
        supervisorId: 'T2', // Maria Garcia
        closingDate: '2023-10-19T16:18:00Z',
        signatureExecutor: 'Juan Perez',
        signatureExecutorDate: '2023-10-19T16:15:00Z',
        signatureSupervisor: 'Maria Garcia',
        signatureSupervisorDate: '2023-10-19T16:18:00Z'
    },
    { id: 'WO-104', title: 'SACMI 360h Service', machineId: 'm1', status: WorkOrderStatus.BACKLOG, currentStage: WorkOrderStage.REQUESTED, priority: Priority.HIGH, description: 'Routine 360h maintenance according to manual.', createdDate: '2023-10-22T08:00:00Z', type: 'PREVENTIVE', formType: 'R-MANT-02' },
    {
        id: 'WO-105',
        displayId: 'RM05-00005',
        title: 'Conveyor Jam and Starwheel Alignment',
        machineId: 'm1',
        status: WorkOrderStatus.IN_PROGRESS,
        currentStage: WorkOrderStage.EXECUTION,
        priority: Priority.CRITICAL,
        description: 'Bottles jamming at exit starwheel due to physical misalignment.',
        createdDate: '2023-10-22T10:30:00Z',
        type: 'CORRECTIVE',
        formType: 'R-MANT-05',
        
        assignedTo: 'T1',
        branch: 'Ravi Caribe',
        department: 'Producción',
        equipmentType: 'Mantenimiento Maquinaria',
        condition: 'Crítica',
        failureType: 'Mecánica',
        requestDescription: 'Atascamiento constante de envases a la salida de la estrella de la prensa rotativa. Se detiene la línea de producción.',
        frequency: 'Frecuente',
        consequence: 'Parada',
        actionTaken: 'Parada de emergencia y evacuación de envases triturados.',
        
        startTime: '10:45',
        requestReceivedBy: 'Juan Perez',
        requestReceivedDate: '2023-10-22T10:35:00Z',
        assignedMechanic: 'Juan Perez',
        failuresAndActivities: [
            { cause: 'Estrella desalineada con el transportador principal.', activity: 'Ajuste de pernos de sujeción y alineación manual con galgas.' }
        ],
        consumedParts: [],
        totalMaintenanceCost: 0,
        checklist: { pointClean: null, areaClean: null, guardsComplete: null, toolsRemoved: null, greaseCleaned: null, safetyActivated: null }
    },
];

const STORAGE_KEY = 'v4_rich_cmms_work_orders';
const SIMULATED_DELAY = 800;

export class WorkOrderMockService implements IWorkOrderService {

    private async delay() {
        return new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    }

    private getFromStorage(): WorkOrder[] {
        return loadFromStorage(STORAGE_KEY, INITIAL_ORDERS);
    }

    private saveToStorage(data: WorkOrder[]) {
        saveToStorage(STORAGE_KEY, data);
    }

    async getAll(page: number = 1, limit: number = 25, formType?: string): Promise<{ data: WorkOrder[], total: number }> {
        await this.delay();
        let orders = this.getFromStorage();
        
        if (formType) {
            orders = orders.filter(o => o.formType === formType);
        }

        const total = orders.length;
        const from = (page - 1) * limit;
        const to = from + limit;
        const data = orders.slice(from, to);

        return { data, total };
    }

    async getById(id: string): Promise<WorkOrder | null> {
        await this.delay();
        const orders = this.getFromStorage();
        return orders.find(o => o.id === id) || null;
    }

    async create(orderData: Omit<WorkOrder, 'id'>): Promise<WorkOrder> {
        await this.delay();
        const orders = this.getFromStorage();

        const newOrder: WorkOrder = {
            ...orderData,
            id: `WO-${Date.now()}`, // Simple unique ID
            createdDate: new Date().toISOString()
        } as WorkOrder;

        orders.unshift(newOrder); // Add to beginning
        this.saveToStorage(orders);
        return newOrder;
    }

    async update(id: string, updates: Partial<WorkOrder>): Promise<void> {
        await this.delay();
        const orders = this.getFromStorage();
        const index = orders.findIndex(o => o.id === id);

        if (index !== -1) {
            orders[index] = {
                ...orders[index],
                ...updates
            };
            this.saveToStorage(orders);
        } else {
            console.error(`Order with ID ${id} not found in mock storage`);
        }
    }

    async delete(id: string): Promise<void> {
        await this.delay();
        const orders = this.getFromStorage();
        const filtered = orders.filter(o => o.id !== id);
        this.saveToStorage(filtered);
    }
}
