import { supabase, getPaginationRange } from '../supabaseClient';
import { IInventoryService } from '../inventoryService';
import { SparePart, PartsRequest, ExtendedPurchaseRequest, StockReception } from '../../types/inventory';
import { PaginationParams, PaginatedResult } from '../../types/pagination';

export class InventorySupabaseService implements IInventoryService {
    private mapDBToPart(record: any): SparePart {
        if (!record) return {} as SparePart;
        return {
            id: record.id,
            name: record.name,
            partNumber: record.sku,
            description: record.description || '',
            category: record.category || '',
            unitOfMeasure: record.unit_of_measure || 'PCS',
            currentStock: Number(record.current_stock || 0),
            minStock: Number(record.minimum_stock || 0),
            maxStock: Number(record.maximum_stock || 0),
            location: record.location_code || '',
            subLocation: record.sub_location || '',
            cost: Number(record.unit_cost || 0),
            photoUrl: record.image_url || null,
            createdAt: record.created_at,
            company: record.company || '',
            machinePlate: record.machine_plate || '',
            machineName: record.machine_name || '',
            catalog: record.catalog || '',
            tableNo: record.table_no || '',
            figure: record.figure || '',
            supplierCode: record.supplier_code || '',
            machineModel: record.machine_model || '',
            machineLine: record.machine_line || '',
            supplier: record.supplier || '',
            categoryId: record.category_id || undefined,
            companyId: record.company_id || undefined,
            supplierId: record.supplier_id || undefined,
            locationId: record.location_id || undefined
        };
    }

    private mapPartToDB(part: Partial<SparePart>): any {
        return {
            sku: part.partNumber,
            name: part.name,
            description: part.description,
            category: part.category,
            unit_of_measure: part.unitOfMeasure,
            current_stock: part.currentStock,
            minimum_stock: part.minStock,
            maximum_stock: part.maxStock,
            location_code: part.location,
            sub_location: part.subLocation,
            unit_cost: part.cost,
            image_url: part.photoUrl,
            company: part.company,
            machine_plate: part.machinePlate,
            machine_name: part.machineName,
            catalog: part.catalog,
            table_no: part.tableNo,
            figure: part.figure,
            supplier_code: part.supplierCode,
            machine_model: part.machineModel,
            machine_line: part.machineLine,
            supplier: part.supplier
        };
    }

    async getAllParts(
        page: number = 1, 
        limit: number = 25,
        filters?: {
            search?: string;
            category?: string;
            location?: string;
            status?: 'all' | 'low' | 'normal';
            company?: string;
            supplier?: string;
        }
    ): Promise<{ data: SparePart[], total: number }> {
        const { from, to } = getPaginationRange(page, limit);

        let query = supabase
            .from('spare_parts')
            .select('*', { count: 'exact' });

        if (filters) {
            if (filters.search) {
                query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
            }
            if (filters.category && filters.category !== 'all') {
                query = query.eq('category', filters.category);
            }
            if (filters.location && filters.location !== 'all') {
                query = query.eq('location_code', filters.location);
            }
            if (filters.company && filters.company !== 'all') {
                query = query.eq('company', filters.company);
            }
            if (filters.supplier && filters.supplier !== 'all') {
                query = query.eq('supplier', filters.supplier);
            }
            if (filters.status === 'low') {
                query = query.eq('is_low_stock', true);
            } else if (filters.status === 'normal') {
                query = query.eq('is_low_stock', false);
            }
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { 
            data: (data || []).map(this.mapDBToPart),
            total: count || 0
        };
    }

    async getPartCompanies(): Promise<string[]> {
        const { data, error } = await supabase
            .from('v_unique_part_companies')
            .select('company');

        if (error) throw error;
        return (data || []).map((record: any) => record.company);
    }

    async createPart(partData: Omit<SparePart, 'id' | 'currentStock'> & { initialStock?: number }): Promise<SparePart> {
        const id = crypto.randomUUID();
        const { data, error } = await supabase.rpc('upsert_spare_part', {
            p_id:               id,
            p_sku:              partData.partNumber,
            p_name:             partData.name,
            p_description:      partData.description || null,
            p_category:         partData.category,
            p_unit_of_measure:  partData.unitOfMeasure,
            p_current_stock:    partData.initialStock || 0,
            p_minimum_stock:    partData.minStock || 0,
            p_maximum_stock:    partData.maxStock || 0,
            p_location_code:    partData.location || null,
            p_sub_location:     partData.subLocation || null,
            p_unit_cost:        partData.cost || 0,
            p_image_url:        partData.photoUrl || null,
            p_created_at:       partData.createdAt || null,
            p_company:          partData.company || null,
            p_machine_plate:    partData.machinePlate || null,
            p_machine_name:     partData.machineName || null,
            p_catalog:          partData.catalog || null,
            p_table_no:         partData.tableNo || null,
            p_figure:           partData.figure || null,
            p_supplier_code:    partData.supplierCode || null,
            p_machine_model:    partData.machineModel || null,
            p_machine_line:     partData.machineLine || null,
            p_supplier:         partData.supplier || null
        });
        if (error) throw error;
        const part = Array.isArray(data) ? data[0] : data;

        // Phase 3 Master IDs (Retrocompatibility update)
        if (partData.categoryId || partData.companyId || partData.supplierId || partData.locationId) {
            await supabase.from('spare_parts').update({
                category_id: partData.categoryId || null,
                company_id: partData.companyId || null,
                supplier_id: partData.supplierId || null,
                location_id: partData.locationId || null
            }).eq('id', id);
            
            // Re-fetch to get updated IDs if needed, though mapDBToPart will only map what is passed.
            part.category_id = partData.categoryId;
            part.company_id = partData.companyId;
            part.supplier_id = partData.supplierId;
            part.location_id = partData.locationId;
        }

        return this.mapDBToPart(part);
    }

    async updatePart(updatedPart: SparePart): Promise<SparePart> {
        const { data, error } = await supabase.rpc('upsert_spare_part', {
            p_id:               updatedPart.id,
            p_sku:              updatedPart.partNumber,
            p_name:             updatedPart.name,
            p_description:      updatedPart.description || null,
            p_category:         updatedPart.category,
            p_unit_of_measure:  updatedPart.unitOfMeasure,
            p_current_stock:    updatedPart.currentStock || 0,
            p_minimum_stock:    updatedPart.minStock || 0,
            p_maximum_stock:    updatedPart.maxStock || 0,
            p_location_code:    updatedPart.location || null,
            p_sub_location:     updatedPart.subLocation || null,
            p_unit_cost:        updatedPart.cost || 0,
            p_image_url:        updatedPart.photoUrl || null,
            p_created_at:       updatedPart.createdAt || null,
            p_company:          updatedPart.company || null,
            p_machine_plate:    updatedPart.machinePlate || null,
            p_machine_name:     updatedPart.machineName || null,
            p_catalog:          updatedPart.catalog || null,
            p_table_no:         updatedPart.tableNo || null,
            p_figure:           updatedPart.figure || null,
            p_supplier_code:    updatedPart.supplierCode || null,
            p_machine_model:    updatedPart.machineModel || null,
            p_machine_line:     updatedPart.machineLine || null,
            p_supplier:         updatedPart.supplier || null
        });
        if (error) throw error;
        const part = Array.isArray(data) ? data[0] : data;

        // Phase 3 Master IDs (Retrocompatibility update)
        if (updatedPart.categoryId || updatedPart.companyId || updatedPart.supplierId || updatedPart.locationId) {
            await supabase.from('spare_parts').update({
                category_id: updatedPart.categoryId || null,
                company_id: updatedPart.companyId || null,
                supplier_id: updatedPart.supplierId || null,
                location_id: updatedPart.locationId || null
            }).eq('id', updatedPart.id);
            
            part.category_id = updatedPart.categoryId;
            part.company_id = updatedPart.companyId;
            part.supplier_id = updatedPart.supplierId;
            part.location_id = updatedPart.locationId;
        }

        return this.mapDBToPart(part);
    }

    async addStock(partId: string, quantity: number, relatedDocId?: string): Promise<void> {
        // Use RPC for atomic increment to prevent race conditions
        const { error } = await supabase.rpc('increment_part_stock', {
            p_part_id: partId,
            p_quantity: quantity
        });

        if (error) {
            console.error('Error in addStock atomic increment:', error);
            // Fallback for missing RPC or error
            const { data: part, error: getError } = await supabase
                .from('spare_parts')
                .select('current_stock')
                .eq('id', partId)
                .single();

            if (getError) throw getError;

            const newStock = (part.current_stock || 0) + quantity;

            const { error: updateError } = await supabase
                .from('spare_parts')
                .update({ current_stock: newStock })
                .eq('id', partId);

            if (updateError) throw updateError;
        }
    }

    async bulkCreate(parts: Omit<SparePart, 'id'>[]): Promise<void> {
        const dbPayloads = parts.map(part => {
            const payload = this.mapPartToDB(part);
            payload.id = crypto.randomUUID();
            return payload;
        });

        const { error } = await supabase
            .from('spare_parts')
            .insert(dbPayloads);

        if (error) throw error;
    }

    // --- Requests API (Stubs for now) ---

    // --- Requests API ---

    async getAllRequests(params?: PaginationParams, filters?: { searchTerm?: string; status?: string; priority?: string; startDate?: string; endDate?: string }): Promise<PaginatedResult<PartsRequest>> {
        const page = params?.page || 1;
        const pageSize = params?.pageSize || 25;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('spare_part_requests')
            .select(`
                id, request_number, technician_name, status, priority, created_at, delivered_to
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        if (filters?.searchTerm) {
            query = query.or(`request_number.ilike.%${filters.searchTerm}%,technician_name.ilike.%${filters.searchTerm}%`);
        }
        if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }
        if (filters?.priority && filters.priority !== 'all') {
            query = query.eq('priority', filters.priority);
        }
        if (filters?.startDate) {
            query = query.gte('created_at', `${filters.startDate}T00:00:00`);
        }
        if (filters?.endDate) {
            query = query.lte('created_at', `${filters.endDate}T23:59:59`);
        }

        query = query.range(from, to);
        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching requests:', error);
            throw error;
        }

        const mappedData = data.map(record => ({
            id: record.id,
            requestNumber: record.request_number,
            technicianId: record.technician_name,
            status: record.status as any,
            priority: record.priority as any,
            items: [], // Details are fetched in getRequestById
            createdDate: record.created_at,
            deliveredTo: record.delivered_to,
            purchaseHistory: []
        } as PartsRequest));

        return {
            data: mappedData,
            count,
            page,
            pageSize,
            totalPages: count ? Math.ceil(count / pageSize) : 0
        };
    }

    async getRequestById(id: string): Promise<PartsRequest> {
        const { data, error } = await supabase
            .from('spare_part_requests')
            .select(`
                *,
                spare_part_request_items (*),
                purchase_requests (*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching request by id:', error);
            throw error;
        }

        return {
            id: data.id,
            requestNumber: data.request_number,
            technicianId: data.technician_name,
            status: data.status as any,
            priority: data.priority as any,
            items: (data.spare_part_request_items || []).map((item: any) => ({
                partId: item.part_id,
                quantityRequested: Number(item.quantity_requested),
                quantityDelivered: Number(item.quantity_delivered),
                usageLocation: item.usage_location
            })),
            createdDate: data.created_at,
            deliveredTo: data.delivered_to,
            purchaseHistory: (data.purchase_requests || []).map((pr: any) => ({
                id: pr.id,
                requestDate: pr.request_date,
                items: pr.items,
                requestedBy: pr.requested_by,
                purchaseRequestNumber: pr.purchase_request_number
            }))
        } as PartsRequest;
    }

    async createRequest(requestData: any): Promise<PartsRequest> {
        const requestId = crypto.randomUUID();
        
        // 1. Create the main request
        const { data: request, error: requestError } = await supabase
            .from('spare_part_requests')
            .insert({
                id: requestId,
                technician_name: requestData.technicianId,
                priority: requestData.priority,
                status: 'OPEN'
            })
            .select()
            .single();

        if (requestError) throw requestError;

        // 2. Insert items
        const itemsPayload = requestData.items.map((item: any) => ({
            request_id: requestId,
            part_id: item.partId,
            quantity_requested: item.quantity,
            usage_location: item.usageLocation
        }));

        const { error: itemsError } = await supabase
            .from('spare_part_request_items')
            .insert(itemsPayload);

        if (itemsError) throw itemsError;

        // Fetch back full request
        return await this.getRequestById(requestId);
    }

    async deliverParts(requestId: string, itemsToDeliver: { partId: string; quantity: number }[], receiverId?: string): Promise<PartsRequest> {
        const { error } = await supabase.rpc('deliver_parts_bulk', {
            p_request_id: requestId,
            p_items: itemsToDeliver,
            p_delivered_by: receiverId || null
        });

        if (error) {
            console.error('Error in deliverPartsBulk:', error);
            throw error;
        }

        // Return updated request
        return await this.getRequestById(requestId);
    }

    private async getByIdInternal(id: string) {
        const { data } = await supabase
            .from('spare_part_requests')
            .select('*, spare_part_request_items(*)')
            .eq('id', id)
            .single();
        return data;
    }

    async closeRequest(requestId: string): Promise<PartsRequest> {
         const { error } = await supabase
            .from('spare_part_requests')
            .update({ status: 'CLOSED' })
            .eq('id', requestId);
        
        if (error) throw error;
        return await this.getRequestById(requestId);
    }

    async deleteRequest(requestId: string): Promise<void> {
         const { error } = await supabase
            .from('spare_part_requests')
            .delete()
            .eq('id', requestId);
        if (error) throw error;
    }

    async updateRequest(updatedRequest: PartsRequest): Promise<PartsRequest> {
         // Update main request
         const { error: reqError } = await supabase
            .from('spare_part_requests')
            .update({
                technician_name: updatedRequest.technicianId,
                priority: updatedRequest.priority,
                status: updatedRequest.status,
                delivered_to: updatedRequest.deliveredTo
            })
            .eq('id', updatedRequest.id);

        if (reqError) throw reqError;

        // Update items (this is complex, for now let's assume we replace or update by part_id)
        // Simplification: Delete existing items and re-insert
        await supabase.from('spare_part_request_items').delete().eq('request_id', updatedRequest.id);
        
        const itemsPayload = updatedRequest.items.map(item => ({
            request_id: updatedRequest.id,
            part_id: item.partId,
            quantity_requested: item.quantityRequested,
            quantity_delivered: item.quantityDelivered,
            usage_location: item.usageLocation
        }));

        await supabase.from('spare_part_request_items').insert(itemsPayload);

        return await this.getRequestById(updatedRequest.id);
    }

    async savePurchaseRequest(requestId: string, purchaseRequest: any): Promise<PartsRequest> {
         const payload: any = {
                request_id: requestId,
                purchase_request_number: purchaseRequest.purchaseRequestNumber,
                items: purchaseRequest.items,
                request_date: purchaseRequest.requestDate
         };

         if (purchaseRequest.requestedBy && purchaseRequest.requestedBy !== 'System') {
             payload.requested_by = purchaseRequest.requestedBy;
         }

         const { data: insertedPr, error } = await supabase
            .from('purchase_requests')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        // Populate new relational table for future compatibility
        if (insertedPr && payload.items && payload.items.length > 0) {
             const itemsPayload = payload.items.map((item: any) => ({
                 purchase_request_id: insertedPr.id,
                 part_id: item.partId,
                 quantity: item.quantity || 0,
                 notes: item.notes || null
             }));
             const { error: itemsError } = await supabase.from('purchase_request_items').insert(itemsPayload);
             if (itemsError) console.error("Failed to populate purchase_request_items in createRequest", itemsError);
        }

        // If a purchase request is made, we could optionally update the main request status to PENDING_STOCK
        await supabase.from('spare_part_requests').update({ status: 'PENDING_STOCK' }).eq('id', requestId);

        return await this.getRequestById(requestId);
    }

    async saveReception(reception: { documentNumber?: string; items: any[]; notes?: string }): Promise<any> {
        const { data, error } = await supabase
            .from('stock_receptions')
            .insert({
                document_number: reception.documentNumber || null,
                items: reception.items,
                notes: reception.notes || null
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            receptionDate: data.reception_date,
            documentNumber: data.document_number,
            receivedBy: data.received_by,
            items: data.items,
            notes: data.notes
        };
    }

    async getReceptionById(id: string): Promise<StockReception> {
        const { data, error } = await supabase
            .from('stock_receptions')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching reception by id:', error);
            throw error;
        }

        let status;
        if (data.document_number) {
             const { data: prData } = await supabase
                .from('purchase_requests')
                .select('status')
                .ilike('purchase_request_number', data.document_number)
                .single();
             status = prData?.status;
        }

        return {
            id: data.id,
            receptionDate: data.reception_date,
            documentNumber: data.document_number,
            receivedBy: data.received_by,
            items: data.items || [],
            notes: data.notes,
            status: status
        };
    }

    async getReceptions(params?: PaginationParams, filters?: { searchTerm?: string; partId?: string; startDate?: string; endDate?: string }): Promise<PaginatedResult<StockReception>> {
        const page = params?.page || 1;
        const pageSize = params?.pageSize || 25;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('stock_receptions')
            .select('id, reception_date, document_number, received_by, notes', { count: 'exact' })
            .order('reception_date', { ascending: false });

        if (filters?.partId) {
            query = query.or(`items.cs.[{"partId":"${filters.partId}"}],items.cs.[{"part_id":"${filters.partId}"}]`);
        } else if (filters?.searchTerm) {
            query = query.or(`document_number.ilike.%${filters.searchTerm}%,notes.ilike.%${filters.searchTerm}%`);
        }

        if (filters?.startDate) {
            query = query.gte('reception_date', `${filters.startDate}T00:00:00`);
        }
        if (filters?.endDate) {
            query = query.lte('reception_date', `${filters.endDate}T23:59:59`);
        }

        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching receptions:', error);
            throw error;
        }

        const docNumbers = Array.from(new Set(data?.map(d => d.document_number?.trim().toLowerCase()).filter(Boolean)));
        
        let prStatusMap = new Map<string, string>();
        if (docNumbers.length > 0) {
            const { data: prsData } = await supabase
                .from('purchase_requests')
                .select('purchase_request_number, status')
                .in('purchase_request_number', docNumbers);
            
            if (prsData) {
                prsData.forEach((pr: any) => {
                    if (pr.purchase_request_number) {
                        prStatusMap.set(pr.purchase_request_number.trim().toLowerCase(), pr.status || 'Pendiente');
                    }
                });
            }
        }

        const mapped = (data || []).map(record => {
            const docNum = record.document_number?.trim();
            const status = docNum ? prStatusMap.get(docNum.toLowerCase()) : undefined;
            return {
                id: record.id,
                receptionDate: record.reception_date,
                documentNumber: record.document_number,
                receivedBy: record.received_by,
                items: [], // Details fetched in getReceptionById
                notes: record.notes,
                status: status
            };
        });

        return { 
            data: mapped, 
            count,
            page,
            pageSize,
            totalPages: count ? Math.ceil(count / pageSize) : 0
        };
    }

    async getAllPurchaseRequests(params?: PaginationParams, filters?: { searchTerm?: string }): Promise<PaginatedResult<ExtendedPurchaseRequest>> {
        const page = params?.page || 1;
        const pageSize = params?.pageSize || 25;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('purchase_requests')
            .select(`
                *,
                spare_part_requests (
                    request_number
                )
            `, { count: 'exact' })
            .order('request_date', { ascending: false });

        if (filters?.searchTerm) {
            query = query.or(`purchase_request_number.ilike.%${filters.searchTerm}%`);
        }

        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching all purchase requests:', error);
            throw error;
        }

        const partIds = new Set<string>();
        (data || []).forEach(record => {
            (record.items || []).forEach((item: any) => {
                if (item.partId) partIds.add(item.partId);
            });
        });

        let partsMap = new Map();
        if (partIds.size > 0) {
            const { data: parts } = await supabase
                .from('spare_parts')
                .select('id, name, sku, company, machine_plate, machine_name, catalog, table_no, figure, unit_of_measure, supplier')
                .in('id', Array.from(partIds));
            
            partsMap = new Map((parts || []).map(p => [p.id, p]));
        }

        const mappedData = (data || []).map(record => {
            const rawItems = record.items || [];
            
            const mappedItems = rawItems.map((item: any) => {
                const partInfo = partsMap.get(item.partId);
                return {
                    ...item,
                    partName: partInfo?.name || 'Repuesto Desconocido',
                    partNumber: partInfo?.sku || 'N/A',
                    company: partInfo?.company || '',
                    machinePlate: partInfo?.machine_plate || '',
                    machineName: partInfo?.machine_name || '',
                    catalog: partInfo?.catalog || '',
                    tableNo: partInfo?.table_no || '',
                    figure: partInfo?.figure || '',
                    unitOfMeasure: partInfo?.unit_of_measure || '',
                    supplier: partInfo?.supplier || ''
                };
            });

            const firstItem = mappedItems[0] || {};

            return {
                id: record.id,
                purchaseRequestNumber: record.purchase_request_number,
                requestDate: record.request_date,
                requestedBy: record.requested_by,
                items: mappedItems,
                requestId: record.request_id,
                sourceRequestNumber: record.spare_part_requests?.request_number,
                sparePartName: firstItem.partName || 'N/A',
                sparePartNumber: firstItem.partNumber || 'N/A',
                status: record.status || 'Pendiente'
            };
        });

        return { 
            data: mappedData, 
            count,
            page,
            pageSize,
            totalPages: count ? Math.ceil(count / pageSize) : 0
        };
    }

    async createDirectPurchaseRequest(items: { partId: string; quantity: number }[], type?: 'local' | 'proveedor'): Promise<void> {
        const scNumber = type === 'proveedor'
            ? `SC-PROV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
            : `SC-DIR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        
        const payload: any = {
            request_id: null,
            purchase_request_number: scNumber,
            items: items,
            request_date: new Date().toISOString()
        };

        // Don't explicitly set requested_by to 'System' as it's a UUID column
        // Letting it be null will use the database default (auth.uid()) or remain null

        const { data: insertedPr, error } = await supabase
            .from('purchase_requests')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Error creating direct purchase request:', error);
            throw error;
        }

        // Populate new relational table for future compatibility
        if (insertedPr && payload.items && payload.items.length > 0) {
             const itemsPayload = payload.items.map((item: any) => ({
                 purchase_request_id: insertedPr.id,
                 part_id: item.partId,
                 quantity: item.quantity || 0
             }));
             const { error: itemsError } = await supabase.from('purchase_request_items').insert(itemsPayload);
             if (itemsError) console.error("Failed to populate purchase_request_items in createDirectPurchaseRequest", itemsError);
        }
    }

    async updatePurchaseRequestStatus(requestId: string, status: 'Pendiente' | 'Parcial' | 'Recibido' | 'Cancelado'): Promise<void> {
        const { error } = await supabase
            .from('purchase_requests')
            .update({ status })
            .eq('id', requestId);

        if (error) {
            console.error('Error updating purchase request status:', error);
            throw error;
        }
    }

    async getPurchaseRequestsForReception(): Promise<ExtendedPurchaseRequest[]> {
        // Fetch all purchase requests, we will filter for Pending/Partial since there could be differences in casing
        const res = await this.getAllPurchaseRequests({ page: 1, pageSize: 1000 });
        return res.data.filter(pr => 
            pr.status?.toLowerCase() === 'pendiente' || 
            pr.status?.toLowerCase() === 'parcial'
        );
    }

    async processPurchaseReception(purchaseRequestId: string, itemsReceived: { partId: string; qtyReceived: number }[], notes?: string): Promise<void> {
        // 1. Fetch the original purchase request
        const { data: request, error: reqError } = await supabase
            .from('purchase_requests')
            .select('*')
            .eq('id', purchaseRequestId)
            .single();

        if (reqError) throw reqError;

        const currentItems = request.items || [];
        let anyItemReceived = false;
        let allItemsFullyReceived = true;

        // Fetch received parts details for reception log
        const partIdsToFetch = itemsReceived.filter(i => i.qtyReceived > 0).map(i => i.partId);
        let partsMap = new Map<string, { name: string; sku: string }>();
        if (partIdsToFetch.length > 0) {
            const { data: partsData } = await supabase
                .from('spare_parts')
                .select('id, name, sku')
                .in('id', partIdsToFetch);
            if (partsData) {
                partsMap = new Map(partsData.map(p => [p.id, { name: p.name, sku: p.sku || 'N/A' }]));
            }
        }

        const receptionItemsToLog: any[] = [];

        // 2. Process each received item
        for (const receivedItem of itemsReceived) {
            if (receivedItem.qtyReceived <= 0) continue;

            const reqItem = currentItems.find((i: any) => i.partId === receivedItem.partId);
            if (!reqItem) continue;

            // Increment stock
            const { error: stockError } = await supabase.rpc('increment_part_stock', {
                p_part_id: receivedItem.partId,
                p_quantity: receivedItem.qtyReceived
            });
            if (stockError) {
                // Fallback for missing RPC
                const { data: part } = await supabase.from('spare_parts').select('current_stock').eq('id', receivedItem.partId).single();
                if (part) {
                    await supabase.from('spare_parts').update({ current_stock: (part.current_stock || 0) + receivedItem.qtyReceived }).eq('id', receivedItem.partId);
                }
            }

            // Create inventory transaction type 'IN'
            await supabase.from('inventory_transactions').insert({
                part_id: receivedItem.partId,
                transaction_type: 'INBOUND', // using INBOUND or IN, depends on the DB ENUM/VARCHAR, fallback to 'INBOUND'
                quantity: receivedItem.qtyReceived,
                purchase_request_id: purchaseRequestId,
                reference_id: purchaseRequestId, // Also saving reference_id for backward compatibility
                notes: notes || `Recepción de compra ${request.purchase_request_number}`
            });

            // Update item quantityReceived
            reqItem.quantityReceived = (reqItem.quantityReceived || 0) + receivedItem.qtyReceived;

            const partInfo = partsMap.get(receivedItem.partId);
            receptionItemsToLog.push({
                partId: receivedItem.partId,
                partName: partInfo?.name || 'Repuesto Desconocido',
                partNumber: partInfo?.sku || 'N/A',
                quantity: receivedItem.qtyReceived
            });
        }

        // 3. Update the items JSONB and recalculate global status
        for (const item of currentItems) {
            const received = item.quantityReceived || 0;
            if (received > 0) anyItemReceived = true;
            if (received < item.quantity) {
                allItemsFullyReceived = false;
            }
        }

        const newStatus = allItemsFullyReceived ? 'Recibido' : (anyItemReceived ? 'Parcial' : 'Pendiente');

        const { error: updateError } = await supabase
            .from('purchase_requests')
            .update({
                items: currentItems,
                status: newStatus
            })
            .eq('id', purchaseRequestId);

        if (updateError) throw updateError;

        // 4. Save consolidated reception history record
        if (receptionItemsToLog.length > 0) {
            await this.saveReception({
                documentNumber: request.purchase_request_number || undefined,
                notes: notes || `Recepción de compra ${request.purchase_request_number}`,
                items: receptionItemsToLog
            });
        }
    }
}
