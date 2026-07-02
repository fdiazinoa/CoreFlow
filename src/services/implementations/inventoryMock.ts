import { SparePart, PartsRequest, InventoryTransaction, RequestStatus, TransactionType, PurchaseRequest, ExtendedPurchaseRequest, StockReception } from '../../types/inventory';
import { PaginationParams, PaginatedResult } from '../../types/pagination';
import { saveToStorage, loadFromStorage } from '../../utils/persistence';

const PARTS_KEY = 'v2_inventory_parts';
const REQUESTS_KEY = 'v2_inventory_requests';
const TRANSACTIONS_KEY = 'v2_inventory_transactions';
const RECEPTIONS_KEY = 'v2_inventory_receptions';
const PURCHASE_REQUESTS_KEY = 'v2_inventory_purchase_requests';

const INITIAL_PARTS: SparePart[] = [
    { id: 'p1', name: 'Ball Bearing 6204', partNumber: 'BB-6204', description: 'Deep groove ball bearing', category: 'Bearings', unitOfMeasure: 'PCS', currentStock: 15, minStock: 5, maxStock: 100, location: 'A-01', subLocation: '', cost: 5.50, createdAt: new Date().toISOString(), company: 'Ravi Caribe Inc.', supplier: 'SKF' },
    { id: 'p2', name: 'Hydraulic Hose 1/2"', partNumber: 'HH-050', description: 'High pressure hose', category: 'Hydraulics', unitOfMeasure: 'M', currentStock: 2, minStock: 10, maxStock: 50, location: 'B-03', subLocation: '', cost: 12.00, createdAt: new Date().toISOString(), company: 'Labels Caribe Inc.', supplier: 'Bosch Rexroth' },
    { id: 'p3', name: 'Limit Switch', partNumber: 'LS-001', description: 'Industrial limit switch', category: 'Electronics', unitOfMeasure: 'PCS', currentStock: 8, minStock: 3, maxStock: 20, location: 'C-02', subLocation: '', cost: 45.00, createdAt: new Date().toISOString(), company: 'Ravi Caribe Inc.', supplier: 'Siemens' },
    { id: 'p4', name: 'V-Belt A-48', partNumber: 'VB-A48', description: 'Industrial drive belt', category: 'Transmission', unitOfMeasure: 'PCS', currentStock: 12, minStock: 4, maxStock: 40, location: 'A-05', subLocation: '', cost: 8.75, createdAt: new Date().toISOString(), company: 'Labels Caribe Inc.', supplier: 'SMC' },
    { id: 'p5', name: 'Air Filter Element', partNumber: 'AF-500', description: 'Engine air intake filter', category: 'Filters', unitOfMeasure: 'PCS', currentStock: 20, minStock: 10, maxStock: 100, location: 'D-01', subLocation: '', cost: 15.30, createdAt: new Date().toISOString(), company: 'Ravi Caribe Inc.', supplier: 'FESTO' },
];

const INITIAL_REQUESTS: PartsRequest[] = [
    {
        id: 'r1',
        requestNumber: 'REQ-1001',
        technicianId: 'T1',
        status: 'OPEN',
        priority: 'NORMAL',
        createdDate: new Date().toISOString(),
        items: [
            { partId: 'p1', quantityRequested: 5, quantityDelivered: 0 }
        ]
    },
    {
        id: 'r2',
        requestNumber: 'REQ-1002',
        technicianId: 'T2',
        status: 'PENDING_STOCK',
        priority: 'HIGH',
        createdDate: new Date().toISOString(),
        items: [
            { partId: 'p2', quantityRequested: 10, quantityDelivered: 0 }
        ]
    }
];

const INITIAL_PURCHASE_REQUESTS: PurchaseRequest[] = [
    {
        id: 'pr-1',
        purchaseRequestNumber: 'SC-REQ-SPR-00009-1',
        requestDate: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        requestedBy: 'current-user',
        requestId: 'r1',
        status: 'Pendiente',
        items: [
            { partId: 'p1', quantity: 3 }
        ]
    },
    {
        id: 'pr-2',
        purchaseRequestNumber: 'SC-DIR-2R7DZ',
        requestDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        requestedBy: 'current-user',
        status: 'Recibido',
        items: [
            { partId: 'p2', quantity: 10 }
        ]
    },
    {
        id: 'pr-3',
        purchaseRequestNumber: 'SC-REQ-SPR-00003-1',
        requestDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        requestedBy: 'current-user',
        status: 'Pendiente',
        items: [
            { partId: 'p3', quantity: 20 }
        ]
    },
    {
        id: 'pr-4',
        purchaseRequestNumber: 'SC-DIR-86Z5S',
        requestDate: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        requestedBy: 'current-user',
        status: 'Pendiente',
        items: [
            { partId: 'p2', quantity: 10 },
            { partId: 'p3', quantity: 20 }
        ]
    }
];

import { IInventoryService } from '../inventoryService';

export class InventoryMockService implements IInventoryService {

    // --- Persistence Helpers ---
    private getParts(): SparePart[] {
        const parts = loadFromStorage(PARTS_KEY, INITIAL_PARTS);
        return parts.length > 0 ? parts : INITIAL_PARTS;
    }

    private saveParts(parts: SparePart[]) {
        saveToStorage(PARTS_KEY, parts);
    }

    private getRequests(): PartsRequest[] {
        const reqs = loadFromStorage(REQUESTS_KEY, INITIAL_REQUESTS);
        return reqs.length > 0 ? reqs : INITIAL_REQUESTS;
    }

    private saveRequests(requests: PartsRequest[]) {
        saveToStorage(REQUESTS_KEY, requests);
    }

    private getTransactions(): InventoryTransaction[] {
        return loadFromStorage(TRANSACTIONS_KEY, []);
    }

    private saveTransactions(transactions: InventoryTransaction[]) {
        saveToStorage(TRANSACTIONS_KEY, transactions);
    }

    private getPurchaseRequests(): PurchaseRequest[] {
        const prs = loadFromStorage(PURCHASE_REQUESTS_KEY, INITIAL_PURCHASE_REQUESTS);
        return prs.length > 0 ? prs : INITIAL_PURCHASE_REQUESTS;
    }

    private savePurchaseRequests(prs: PurchaseRequest[]) {
        saveToStorage(PURCHASE_REQUESTS_KEY, prs);
    }

    // --- Public API ---

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
        let parts = this.getParts();

        // 1. Filtering
        if (filters) {
            if (filters.search) {
                const s = filters.search.toLowerCase();
                parts = parts.filter(p => 
                    p.name.toLowerCase().includes(s) || 
                    p.partNumber.toLowerCase().includes(s) || 
                    (p.description && p.description.toLowerCase().includes(s))
                );
            }
            if (filters.category && filters.category !== 'all') {
                parts = parts.filter(p => p.category === filters.category);
            }
            if (filters.location && filters.location !== 'all') {
                parts = parts.filter(p => p.location === filters.location);
            }
            if (filters.company && filters.company !== 'all') {
                parts = parts.filter(p => p.company === filters.company);
            }
            if (filters.supplier && filters.supplier !== 'all') {
                parts = parts.filter(p => p.supplier === filters.supplier);
            }
            if (filters.status === 'low') {
                parts = parts.filter(p => p.currentStock < p.minStock);
            } else if (filters.status === 'normal') {
                parts = parts.filter(p => p.currentStock >= p.minStock);
            }
        }

        // 2. Sorting
        parts.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (dateA !== dateB) return dateB - dateA;
            return b.id.localeCompare(a.id);
        });

        const total = parts.length;

        // 3. Pagination
        const from = (page - 1) * limit;
        const to = from + limit;
        const pagedData = parts.slice(from, to);

        return { data: pagedData, total };
    }

    async getPartCompanies(): Promise<string[]> {
        const parts = this.getParts();
        const companies = new Set<string>();
        parts.forEach(p => {
            if (p.company) companies.add(p.company);
        });
        return Array.from(companies).sort();
    }

    async getAllRequests(params?: PaginationParams, filters?: { searchTerm?: string; status?: string; priority?: string; startDate?: string; endDate?: string }): Promise<PaginatedResult<PartsRequest>> {
        let allRequests = this.getRequests();

        if (filters?.searchTerm) {
            const s = filters.searchTerm.toLowerCase();
            allRequests = allRequests.filter(r => r.requestNumber.toLowerCase().includes(s) || r.technicianId.toLowerCase().includes(s));
        }
        if (filters?.status && filters.status !== 'all') {
            allRequests = allRequests.filter(r => r.status === filters.status);
        }
        if (filters?.priority && filters.priority !== 'all') {
            allRequests = allRequests.filter(r => r.priority === filters.priority);
        }
        if (filters?.startDate) {
            allRequests = allRequests.filter(r => r.createdDate >= `${filters.startDate}T00:00:00`);
        }
        if (filters?.endDate) {
            allRequests = allRequests.filter(r => r.createdDate <= `${filters.endDate}T23:59:59`);
        }

        const page = params?.page || 1;
        const pageSize = params?.pageSize || 25;
        const total = allRequests.length;
        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        
        const mappedData = allRequests.slice(from, to).map(r => ({ ...r, items: [] }));
        return {
            data: mappedData,
            count: total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        };
    }

    async getRequestById(id: string): Promise<PartsRequest> {
        const req = this.getRequests().find(r => r.id === id);
        if (!req) throw new Error('Request not found');
        return req;
    }

    /**
     * Create a new Parts Request.
     * Checks stock availability. If requested > current, sets status to PENDING_STOCK.
     */
    async createRequest(requestData: Omit<PartsRequest, 'id' | 'createdDate' | 'status' | 'requestNumber' | 'items'> & { items: { partId: string; quantity: number }[] }): Promise<PartsRequest> {
        const parts = this.getParts();
        const requests = this.getRequests();

        let status: RequestStatus = 'OPEN';

        // Check stock availability
        for (const item of requestData.items) {
            const part = parts.find(p => p.id === item.partId);
            if (part && item.quantity > part.currentStock) {
                status = 'PENDING_STOCK';
                console.warn(`Stock insufficient for part ${part.name}. Requested: ${item.quantity}, Available: ${part.currentStock}`);
            }
        }

        const newRequest: PartsRequest = {
            id: `PR-${Date.now()}`,
            requestNumber: `REQ-${1000 + requests.length + 1}`,
            technicianId: requestData.technicianId,
            status: status,
            priority: requestData.priority,
            createdDate: new Date().toISOString(),
            items: requestData.items.map(i => ({
                partId: i.partId,
                quantityRequested: i.quantity,
                quantityDelivered: 0
            }))
        };

        requests.unshift(newRequest);
        this.saveRequests(requests);
        return newRequest;
    }

    /**
     * Deliver parts for a request.
     * THROWS Error if calling with quantity > currentStock.
     */
    /**
     * Deliver parts for a request.
     * THROWS Error if calling with quantity > currentStock.
     */
    async deliverParts(requestId: string, itemsToDeliver: { partId: string; quantity: number }[], receiverId?: string): Promise<PartsRequest> {
        const parts = this.getParts();
        const requests = this.getRequests();
        const transactions = this.getTransactions();

        const requestIndex = requests.findIndex(r => r.id === requestId);
        if (requestIndex === -1) throw new Error('Request not found');

        const request = requests[requestIndex];

        // 1. Validate Stock
        for (const deliveryItem of itemsToDeliver) {
            const part = parts.find(p => p.id === deliveryItem.partId);
            if (!part) throw new Error(`Part ${deliveryItem.partId} not found`);
            if (part.currentStock < deliveryItem.quantity) {
                throw new Error(`Insufficient stock for part ${part.name}. Current: ${part.currentStock}, Trying to deliver: ${deliveryItem.quantity}`);
            }
        }

        // 2. Perform Updates
        for (const deliveryItem of itemsToDeliver) {
            if (deliveryItem.quantity <= 0) continue;

            // Update Stock
            const partIndex = parts.findIndex(p => p.id === deliveryItem.partId);
            parts[partIndex].currentStock -= deliveryItem.quantity;

            // Create Transaction
            const transaction: InventoryTransaction = {
                id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                partId: deliveryItem.partId,
                type: 'OUT',
                quantity: deliveryItem.quantity,
                date: new Date().toISOString(),
                userId: 'current-user', // Mock user
                relatedDocumentId: requestId,
                deliveredTo: receiverId
            };
            transactions.push(transaction);

            // Update Request Item
            const itemIndex = request.items.findIndex(i => i.partId === deliveryItem.partId);
            if (itemIndex !== -1) {
                request.items[itemIndex].quantityDelivered += deliveryItem.quantity;
            }
        }

        // 3. Update Status
        const allDelivered = request.items.every(i => i.quantityDelivered >= i.quantityRequested);
        const someDelivered = request.items.some(i => i.quantityDelivered > 0);

        if (allDelivered) {
            request.status = 'CLOSED';
        } else if (someDelivered) {
            request.status = 'PARTIAL';
        }

        // Save receiver
        if (receiverId) {
            request.deliveredTo = receiverId;
        }
        // If nothing delivered yet, it stays OPEN or PENDING_STOCK

        // Save everything
        this.saveParts(parts);
        this.saveRequests(requests);
        this.saveTransactions(transactions);

        return request;
    }

    async savePurchaseRequest(requestId: string, purchaseRequest: PurchaseRequest): Promise<PartsRequest> {
        const prs = this.getPurchaseRequests();
        prs.unshift({
            ...purchaseRequest,
            requestId
        });
        this.savePurchaseRequests(prs);

        // Update parts request status to PENDING_STOCK
        const requests = this.getRequests();
        const index = requests.findIndex(r => r.id === requestId);
        if (index !== -1) {
            requests[index].status = 'PENDING_STOCK';
            this.saveRequests(requests);
            return requests[index];
        }
        throw new Error('Request not found');
    }

    async getAllPurchaseRequests(params?: PaginationParams, filters?: { searchTerm?: string }): Promise<PaginatedResult<ExtendedPurchaseRequest>> {
        let prs = this.getPurchaseRequests();
        const parts = this.getParts();
        const partsMap = new Map(parts.map(p => [p.id, p]));
        const requests = this.getRequests();

        if (filters?.searchTerm) {
            const s = filters.searchTerm.toLowerCase();
            prs = prs.filter(p => p.purchaseRequestNumber.toLowerCase().includes(s));
        }

        const mappedData: ExtendedPurchaseRequest[] = prs.map(record => {
            const rawItems = record.items || [];
            const mappedItems = rawItems.map((item: any) => {
                const partInfo = partsMap.get(item.partId);
                return {
                    ...item,
                    partName: partInfo?.name || 'Repuesto Desconocido',
                    partNumber: partInfo?.partNumber || 'N/A',
                    company: partInfo?.company || '',
                    machinePlate: partInfo?.machinePlate || '',
                    machineName: partInfo?.machineName || '',
                    catalog: partInfo?.catalog || '',
                    tableNo: partInfo?.tableNo || '',
                    figure: partInfo?.figure || '',
                    unitOfMeasure: partInfo?.unitOfMeasure || '',
                    supplier: partInfo?.supplier || ''
                };
            });

            const firstItem = mappedItems[0] || {};
            const sourceReq = requests.find(r => r.id === record.requestId);

            return {
                ...record,
                items: mappedItems,
                sourceRequestNumber: sourceReq?.requestNumber || (record.purchaseRequestNumber.includes('SC-REQ-SPR-00009') ? 'SPR-00009' : record.purchaseRequestNumber.includes('SC-REQ-SPR-00003') ? 'SPR-00003' : undefined),
                sparePartName: firstItem.partName || 'N/A',
                sparePartNumber: firstItem.partNumber || 'N/A',
                status: record.status || 'Pendiente'
            } as ExtendedPurchaseRequest;
        });

        // Pagination
        const page = params?.page || 1;
        const pageSize = params?.pageSize || 25;
        const total = mappedData.length;
        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        
        return { 
            data: mappedData.slice(from, to), 
            count: total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        };
    }

    async closeRequest(requestId: string): Promise<PartsRequest> {
        const requests = this.getRequests();
        const index = requests.findIndex(r => r.id === requestId);
        if (index === -1) throw new Error('Request not found');

        requests[index].status = 'CLOSED';
        this.saveRequests(requests);
        return requests[index];
    }

    /**
     * Add stock (Reception).
     */
    async addStock(partId: string, quantity: number, relatedDocId?: string): Promise<void> {
        const parts = this.getParts();
        const transactions = this.getTransactions();

        const partIndex = parts.findIndex(p => p.id === partId);
        if (partIndex === -1) throw new Error('Part not found');

        parts[partIndex].currentStock += quantity;

        transactions.push({
            id: `TX-${Date.now()}`,
            partId: partId,
            type: 'IN',
            quantity: quantity,
            date: new Date().toISOString(),
            userId: 'current-user',
            relatedDocumentId: relatedDocId
        });

        this.saveParts(parts);
        this.saveTransactions(transactions);
    }

    /**
     * Create a new Spare Part.
     */
    async createPart(partData: Omit<SparePart, 'id' | 'currentStock'> & { initialStock?: number }): Promise<SparePart> {
        const parts = this.getParts();
        const transactions = this.getTransactions();

        // Check for duplicate part number
        if (parts.some(p => p.partNumber === partData.partNumber)) {
            throw new Error(`Part number ${partData.partNumber} already exists.`);
        }

        const initialStock = partData.initialStock || 0;

        const newPart: SparePart = {
            id: `P-${Date.now()}`,
            ...partData,
            currentStock: initialStock,
            createdAt: new Date().toISOString()
        };

        parts.push(newPart);

        // Log transaction if there is initial stock
        if (initialStock > 0) {
            transactions.push({
                id: `TX-${Date.now()}`,
                partId: newPart.id,
                type: 'IN',
                quantity: initialStock,
                date: new Date().toISOString(),
                userId: 'current-user',
                relatedDocumentId: 'INITIAL_STOCK'
            });
        }

        this.saveParts(parts);
        this.saveTransactions(transactions);
        return newPart;
    }

    /**
     * Update an existing Spare Part.
     */
    async updatePart(updatedPart: SparePart): Promise<SparePart> {
        const parts = this.getParts();
        const index = parts.findIndex(p => p.id === updatedPart.id);
        if (index === -1) throw new Error('Part not found');

        // Check for duplicate part number if it changed (though UI blocks this)
        if (parts[index].partNumber !== updatedPart.partNumber) {
            if (parts.some(p => p.partNumber === updatedPart.partNumber)) {
                throw new Error(`Part number ${updatedPart.partNumber} already exists.`);
            }
        }

        // Preserve fields that shouldn't change via this update if needed, but here we update all passed fields
        // except keeping the ID safe is good practice, but updatedPart includes it.

        parts[index] = updatedPart;
        this.saveParts(parts);
        return updatedPart;
    }
    /**
     * Delete a request.
     */
    async deleteRequest(requestId: string): Promise<void> {
        const requests = this.getRequests();
        const index = requests.findIndex(r => r.id === requestId);
        if (index === -1) throw new Error('Request not found');

        requests.splice(index, 1);
        this.saveRequests(requests);
    }

    /**
     * Update a request.
     * Re-evaluates status based on stock if items changed.
     */
    async updateRequest(updatedRequest: PartsRequest): Promise<PartsRequest> {
        const requests = this.getRequests();
        const parts = this.getParts();
        const index = requests.findIndex(r => r.id === updatedRequest.id);
        if (index === -1) throw new Error('Request not found');

        // Re-evaluate status based on stock availability for any INCREASES or NEW items
        // This is a simplified check. Ideally we compare with previous state.
        // For now, we'll just check if any requested quantity > current stock
        let status: RequestStatus = 'OPEN';

        // If it was already PARTIAL or CLOSED, we might need to be careful. 
        // But user said "Open, Pending Stock, Partial" are editable.
        // If it's PARTIAL, we shouldn't revert to OPEN easily if things are delivered.

        const currentRequest = requests[index];

        // Preserve delivery status
        const hasDeliveries = updatedRequest.items.some(i => i.quantityDelivered > 0);
        const allDelivered = updatedRequest.items.length > 0 && updatedRequest.items.every(i => i.quantityDelivered >= i.quantityRequested);

        if (allDelivered) {
            status = 'CLOSED';
        } else if (hasDeliveries) {
            status = 'PARTIAL';
        } else {
            // Check stock for pending items
            for (const item of updatedRequest.items) {
                const part = parts.find(p => p.id === item.partId);
                const remainingNeeded = item.quantityRequested - item.quantityDelivered;
                if (remainingNeeded > 0 && part && remainingNeeded > part.currentStock) {
                    status = 'PENDING_STOCK';
                    break;
                }
            }
        }

        updatedRequest.status = status;
        requests[index] = updatedRequest;
        this.saveRequests(requests);
        return updatedRequest;
    }

    async bulkCreate(partsData: Omit<SparePart, 'id'>[]): Promise<void> {
        const parts = this.getParts();
        const transactions = this.getTransactions();

        for (const partData of partsData) {
            // Check for duplicate part number
            if (parts.some(p => p.partNumber === partData.partNumber)) {
                console.warn(`Skipping duplicate part number: ${partData.partNumber}`);
                continue;
            }

            const newPart: SparePart = {
                id: `P-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                ...partData,
                currentStock: partData.currentStock || 0
            };

            parts.push(newPart);

            // Log transaction if there is initial stock
            if (newPart.currentStock > 0) {
                transactions.push({
                    id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    partId: newPart.id,
                    type: 'IN',
                    quantity: newPart.currentStock,
                    date: new Date().toISOString(),
                    userId: 'current-user',
                    relatedDocumentId: 'BULK_IMPORT'
                });
            }
        }

        this.saveParts(parts);
        this.saveTransactions(transactions);
    }

    async saveReception(reception: Omit<StockReception, 'id' | 'receptionDate'>): Promise<StockReception> {
        const receptions = loadFromStorage<StockReception[]>(RECEPTIONS_KEY, []);
        const newReception: StockReception = {
            id: `REC-${Date.now()}`,
            receptionDate: new Date().toISOString(),
            ...reception,
            receivedBy: 'current-user' // Default for mock
        };
        receptions.unshift(newReception);
        saveToStorage(RECEPTIONS_KEY, receptions);
        return newReception;
    }

    private groupReceptions(receptions: StockReception[]): StockReception[] {
        const grouped = new Map<string, StockReception>();
        
        for (const rec of receptions) {
            const docNum = rec.documentNumber?.trim();
            if (!docNum) continue;

            const existing = grouped.get(docNum);
            if (!existing) {
                grouped.set(docNum, {
                    ...rec,
                    items: rec.items.map(i => ({ ...i }))
                });
            } else {
                // Merge items
                for (const item of rec.items) {
                    const existingItem = existing.items.find(i => i.partId === item.partId);
                    if (existingItem) {
                        existingItem.quantity += item.quantity;
                    } else {
                        existing.items.push({ ...item });
                    }
                }
                // Keep the latest receptionDate (since receptions are sorted descending, the first we find is the latest)
                if (!existing.notes && rec.notes) {
                    existing.notes = rec.notes;
                } else if (existing.notes && rec.notes && existing.notes !== rec.notes && !existing.notes.includes(rec.notes)) {
                    existing.notes = `${existing.notes} | ${rec.notes}`;
                }
            }
        }

        const result: StockReception[] = [];
        const addedDocs = new Set<string>();

        for (const rec of receptions) {
            const docNum = rec.documentNumber?.trim();
            if (!docNum) {
                result.push(rec);
            } else if (!addedDocs.has(docNum)) {
                const merged = grouped.get(docNum);
                if (merged) {
                    result.push(merged);
                    addedDocs.add(docNum);
                }
            }
        }

        return result;
    }

    async getReceptions(params?: PaginationParams, filters?: { searchTerm?: string; partId?: string; startDate?: string; endDate?: string }): Promise<PaginatedResult<StockReception>> {
        let receptions = loadFromStorage<StockReception[]>(RECEPTIONS_KEY, []);

        if (filters?.searchTerm || filters?.partId) {
            const s = filters.searchTerm?.toLowerCase() || '';
            const exactPartId = filters.partId;
            
            receptions = receptions.filter(r => {
                if (exactPartId) {
                    if (r.items && Array.isArray(r.items)) {
                        return r.items.some(i => i.partId === exactPartId);
                    }
                    return false;
                }
                
                if (s) {
                    if (r.documentNumber && r.documentNumber.toLowerCase().includes(s)) return true;
                    if (r.notes && r.notes.toLowerCase().includes(s)) return true;
                    
                    if (r.items && Array.isArray(r.items)) {
                        return r.items.some(i => 
                            (i.partName && i.partName.toLowerCase().includes(s)) || 
                            (i.partNumber && i.partNumber.toLowerCase().includes(s))
                        );
                    }
                }
                return false;
            });
        }

        if (filters?.startDate) {
            receptions = receptions.filter(r => r.receptionDate >= `${filters.startDate}T00:00:00`);
        }
        if (filters?.endDate) {
            receptions = receptions.filter(r => r.receptionDate <= `${filters.endDate}T23:59:59`);
        }

        const prs = this.getPurchaseRequests();
        const prStatusMap = new Map<string, string>();
        prs.forEach(pr => {
            if (pr.purchaseRequestNumber) {
                prStatusMap.set(pr.purchaseRequestNumber.trim().toLowerCase(), pr.status || 'Pendiente');
            }
        });

        const mapped = receptions.map(rec => {
            const docNum = rec.documentNumber?.trim();
            const status = docNum ? prStatusMap.get(docNum.toLowerCase()) : undefined;
            return {
                ...rec,
                status: status
            };
        });

        const page = params?.page || 1;
        const pageSize = params?.pageSize || 25;
        const total = mapped.length;
        const from = (page - 1) * pageSize;
        const to = from + pageSize;

        return { 
            data: mapped.slice(from, to).map(r => ({ ...r, items: [] })), 
            count: total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        };
    }

    async getReceptionById(id: string): Promise<StockReception> {
        const receptions = loadFromStorage<StockReception[]>(RECEPTIONS_KEY, []);
        const rec = receptions.find(r => r.id === id);
        if (!rec) throw new Error('Reception not found');
        return rec;
    }

    async createDirectPurchaseRequest(items: { partId: string; quantity: number }[], type?: 'local' | 'proveedor'): Promise<void> {
        const scNumber = type === 'proveedor'
            ? `SC-PROV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
            : `SC-DIR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const prs = this.getPurchaseRequests();
        prs.unshift({
            id: `pr-${Date.now()}`,
            purchaseRequestNumber: scNumber,
            requestDate: new Date().toISOString(),
            requestedBy: 'current-user',
            items: items,
            status: 'Pendiente'
        });
        this.savePurchaseRequests(prs);
    }

    async updatePurchaseRequestStatus(requestId: string, status: 'Pendiente' | 'Parcial' | 'Recibido' | 'Cancelado'): Promise<void> {
        const prs = this.getPurchaseRequests();
        const index = prs.findIndex(p => p.id === requestId);
        if (index !== -1) {
            prs[index].status = status;
            this.savePurchaseRequests(prs);
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
        const prs = this.getPurchaseRequests();
        const parts = this.getParts();
        const transactions = this.getTransactions();

        const index = prs.findIndex(p => p.id === purchaseRequestId);
        if (index === -1) throw new Error('Purchase request not found');

        const request = prs[index];
        const currentItems = request.items || [];
        let anyItemReceived = false;
        let allItemsFullyReceived = true;

        const receptionItemsToLog: any[] = [];

        for (const receivedItem of itemsReceived) {
            if (receivedItem.qtyReceived <= 0) continue;

            const reqItem = currentItems.find(i => i.partId === receivedItem.partId);
            if (!reqItem) continue;

            // Increment stock
            const partIndex = parts.findIndex(p => p.id === receivedItem.partId);
            let partName = 'Repuesto Desconocido';
            let partNumber = 'N/A';
            if (partIndex !== -1) {
                parts[partIndex].currentStock += receivedItem.qtyReceived;
                partName = parts[partIndex].name;
                partNumber = parts[partIndex].partNumber || 'N/A';
            }

            // Create transaction type 'IN'
            transactions.push({
                id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                partId: receivedItem.partId,
                type: 'IN',
                quantity: receivedItem.qtyReceived,
                date: new Date().toISOString(),
                userId: 'current-user',
                relatedDocumentId: purchaseRequestId,
                purchaseRequestId: purchaseRequestId
            });

            // Update quantityReceived
            reqItem.quantityReceived = (reqItem.quantityReceived || 0) + receivedItem.qtyReceived;

            receptionItemsToLog.push({
                partId: receivedItem.partId,
                partName: partName,
                partNumber: partNumber,
                quantity: receivedItem.qtyReceived
            });
        }

        // Calculate global status
        for (const item of currentItems) {
            const received = item.quantityReceived || 0;
            if (received > 0) anyItemReceived = true;
            if (received < item.quantity) {
                allItemsFullyReceived = false;
            }
        }

        request.status = allItemsFullyReceived ? 'Recibido' : (anyItemReceived ? 'Parcial' : 'Pendiente');
        
        this.saveParts(parts);
        this.saveTransactions(transactions);
        this.savePurchaseRequests(prs);

        if (receptionItemsToLog.length > 0) {
            await this.saveReception({
                documentNumber: request.purchaseRequestNumber || undefined,
                notes: notes || `Recepción de compra ${request.purchaseRequestNumber}`,
                items: receptionItemsToLog
            });
        }
    }
}
