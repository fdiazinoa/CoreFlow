import { SparePart, PartsRequest, InventoryTransaction, PurchaseRequest, StockReception, StockReceptionItem, ExtendedPurchaseRequest } from '../types/inventory';

export interface IInventoryService {
    getAllParts(page?: number, limit?: number, filters?: {
        search?: string;
        category?: string;
        location?: string;
        status?: 'all' | 'low' | 'normal';
        company?: string;
        supplier?: string;
    }): Promise<{ data: SparePart[], total: number }>;
    getPartCompanies(): Promise<string[]>;
    getAllRequests(): Promise<PartsRequest[]>;
    createRequest(requestData: Omit<PartsRequest, 'id' | 'createdDate' | 'status' | 'requestNumber' | 'items'> & { items: { partId: string; quantity: number }[] }): Promise<PartsRequest>;
    deliverParts(requestId: string, itemsToDeliver: { partId: string; quantity: number }[], receiverId?: string): Promise<PartsRequest>;
    closeRequest(requestId: string): Promise<PartsRequest>;
    addStock(partId: string, quantity: number, relatedDocId?: string): Promise<void>;
    createPart(partData: Omit<SparePart, 'id' | 'currentStock'> & { initialStock?: number }): Promise<SparePart>;
    updatePart(updatedPart: SparePart): Promise<SparePart>;
    deleteRequest(requestId: string): Promise<void>;
    updateRequest(updatedRequest: PartsRequest): Promise<PartsRequest>;

    // New method for bulk import
    bulkCreate(parts: Omit<SparePart, 'id'>[]): Promise<void>;

    // Purchase Request
    savePurchaseRequest(requestId: string, purchaseRequest: any): Promise<PartsRequest>;
    getAllPurchaseRequests(page?: number, limit?: number, filters?: { searchTerm?: string }): Promise<{ data: ExtendedPurchaseRequest[], total: number }>;
    createDirectPurchaseRequest(items: { partId: string; quantity: number }[]): Promise<void>;
    updatePurchaseRequestStatus(requestId: string, status: 'Pendiente' | 'Parcial' | 'Recibido' | 'Cancelado'): Promise<void>;
    processPurchaseReception(purchaseRequestId: string, itemsReceived: { partId: string; qtyReceived: number }[], notes?: string): Promise<void>;
    getPurchaseRequestsForReception(): Promise<ExtendedPurchaseRequest[]>;

    // Reception History
    saveReception(reception: Omit<StockReception, 'id' | 'receptionDate'>): Promise<StockReception>;
    getReceptions(filters?: { searchTerm?: string; partId?: string; startDate?: string; endDate?: string }): Promise<{ data: StockReception[], total: number }>;
}
