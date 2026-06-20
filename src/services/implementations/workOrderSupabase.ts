import { supabase } from '../supabaseClient';
import { WorkOrder } from '../../../types';
import { IWorkOrderService } from '../workOrderService';

export class WorkOrderSupabaseService implements IWorkOrderService {

    // Helper: Map DB (snake_case) to App (camelCase)
    private mapDBToApp(record: any): WorkOrder {
        return {
            id: record.id,
            displayId: record.display_id,
            title: record.title,
            machineId: record.machine_id,
            status: record.status,
            currentStage: record.current_stage,
            priority: record.priority,
            assignedTo: record.assigned_to,
            description: record.description,
            createdDate: record.created_date,
            completedDate: record.completed_date,
            type: record.type,
            formType: record.form_type,

            // R-MANT-02
            maintenanceType: record.maintenance_type,
            machinePlate: record.machine_plate,
            interval: record.interval_name, // Mapped from interval_name
            startDate: record.start_date,
            endDate: record.end_date,
            startTime: record.start_time,
            endTime: record.end_time,
            machineWorkHours: record.machine_work_hours,
            nextMaintenanceHours: record.next_maintenance_hours,
            electromechanicalGroup: record.electromechanical_group,
            supervisor: record.supervisor,
            totalMaintenanceCost: record.total_maintenance_cost,

            // JSON fields
            checklist: record.checklist || {},
            consumedParts: record.consumed_parts || [],
            executors: record.executors || [],
            tasks: record.tasks || [],

            // Additional
            observations: record.observations,
            assignedMechanic: record.assigned_mechanic,
            receivedBy: record.received_by,

            // R-MANT-05
            // R-MANT-05
            department: record.department,
            branch: record.branch,
            equipmentType: record.equipment_type,
            condition: record.condition,
            failureType: record.failure_type,
            frequency: record.frequency,
            consequence: record.consequence,
            actionTaken: record.action_taken,
            requestDescription: record.request_description,
            requestReceivedBy: record.request_received_by,
            requestReceivedDate: record.request_received_date,
            failuresAndActivities: record.failures_and_activities,
            closingImage: record.closing_image,
            closingFile: record.closing_file,
            supervisorId: record.supervisor_id,
            closingDate: record.closing_date,

            // Signatures
            signatureExecutor: record.signature_executor,
            signatureExecutorDate: record.signature_executor_date,
            signatureSupervisor: record.signature_supervisor,
            signatureSupervisorDate: record.signature_supervisor_date,
        } as WorkOrder;
    }

    // Helper: Map App (camelCase) to DB (snake_case)
    private mapAppToDB(order: Partial<WorkOrder>): any {
        const dbRecord: any = {
            // id: order.id, // ID usually generated or passed explicitly
            display_id: order.displayId,
            title: order.title,
            machine_id: order.machineId,
            status: order.status,
            current_stage: order.currentStage,
            priority: order.priority,
            assigned_to: order.assignedTo,
            description: order.description,
            created_date: order.createdDate,
            completed_date: order.completedDate,
            type: order.type,
            form_type: order.formType || (order.type === 'PREVENTIVE' ? 'R-MANT-02' : 'R-MANT-05'),

            // R-MANT-02
            maintenance_type: order.maintenanceType,
            machine_plate: order.machinePlate,
            interval_name: order.interval,
            start_date: order.startDate,
            end_date: order.endDate,
            start_time: order.startTime,
            end_time: order.endTime,
            machine_work_hours: order.machineWorkHours,
            next_maintenance_hours: order.nextMaintenanceHours,
            electromechanical_group: order.electromechanicalGroup,
            supervisor: order.supervisor,
            total_maintenance_cost: order.totalMaintenanceCost,

            // JSON fields
            checklist: order.checklist,
            consumed_parts: order.consumedParts,
            executors: order.executors,
            tasks: order.tasks,

            // Additional
            observations: order.observations,
            assigned_mechanic: order.assignedMechanic,
            received_by: order.receivedBy,

            // R-MANT-05
            // R-MANT-05
            department: order.department,
            branch: order.branch,
            equipment_type: order.equipmentType,
            condition: order.condition,
            failure_type: order.failureType,
            frequency: order.frequency,
            consequence: order.consequence,
            action_taken: order.actionTaken,
            request_description: order.requestDescription,
            request_received_by: order.requestReceivedBy,
            request_received_date: order.requestReceivedDate,
            failures_and_activities: order.failuresAndActivities,
            closing_image: order.closingImage,
            closing_file: order.closingFile,
            supervisor_id: order.supervisorId,
            closing_date: order.closingDate,

            // Signatures
            signature_executor: order.signatureExecutor,
            signature_executor_date: order.signatureExecutorDate,
            signature_supervisor: order.signatureSupervisor,
            signature_supervisor_date: order.signatureSupervisorDate,
        };

        // Remove undefined keys to avoid overriding DB defaults with NULL if inappropriate
        Object.keys(dbRecord).forEach(key => dbRecord[key] === undefined && delete dbRecord[key]);
        return dbRecord;
    }

    async getAll(page: number = 1, limit: number = 25, formType?: string): Promise<{ data: WorkOrder[], total: number }> {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('work_orders')
            .select('*', { count: 'exact' });

        if (formType) {
            query = query.eq('form_type', formType);
        }

        const { data, count, error } = await query
            .order('created_date', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }

        return {
            data: (data || []).map(this.mapDBToApp),
            total: count || 0
        };
    }

    async getById(id: string): Promise<WorkOrder | null> {
        const { data, error } = await supabase
            .from('work_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error(`Error fetching order ${id}:`, error);
            return null;
        }
        return this.mapDBToApp(data);
    }

    async create(orderData: Omit<WorkOrder, 'id'>): Promise<WorkOrder> {
        const dbPayload = this.mapAppToDB(orderData);
        // Let DB generate ID or generate UUID here if needed. 
        // Assuming DB uses uuid_generate_v4() or similar, or we can use crypto.randomUUID()
        const id = crypto.randomUUID();
        dbPayload.id = id;

        const { data, error } = await supabase
            .from('work_orders')
            .insert(dbPayload)
            .select()
            .single();

        if (error) {
            console.error('Error creating order:', error);
            throw error;
        }
        return this.mapDBToApp(data);
    }

    async update(id: string, updates: Partial<WorkOrder>): Promise<void> {
        const dbPayload = this.mapAppToDB(updates);

        const { error } = await supabase
            .from('work_orders')
            .update(dbPayload)
            .eq('id', id);

        if (error) {
            console.error(`Error updating order ${id}:`, error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('work_orders')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Error deleting order ${id}:`, error);
            throw error;
        }
    }
}
