export interface SparePart {
    id: string;
    name: string;
    partNumber: string;
    description: string;
    category: string;
    unitOfMeasure: string;
    currentStock: number;
    minStock: number;
    maxStock: number;
    location: string;
    subLocation: string;
    cost: number;
    photoUrl?: string;
    createdAt?: string;
    company?: string;
    machinePlate?: string;
    machineName?: string;
    catalog?: string;
    tableNo?: string;
    figure?: string;
    supplierCode?: string;
    machineModel?: string;
    machineLine?: string;
    supplier?: string;
    categoryId?: string;
    companyId?: string;
    supplierId?: string;
    locationId?: string;
}

export type TransactionType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface InventoryTransaction {
    id: string;
    partId: string;
    type: TransactionType;
    quantity: number;
    date: string;
    userId: string;
    relatedDocumentId?: string; // ID of the Request or Purchase Order
    deliveredTo?: string; // ID or Name of the person who received the parts
    purchaseRequestId?: string; // ID of the Purchase Request that originated the reception
}

export type RequestStatus = 'OPEN' | 'PARTIAL' | 'CLOSED' | 'PENDING_STOCK';
export type RequestPriority = 'NORMAL' | 'HIGH' | 'EMERGENCY';

export interface RequestItem {
    partId: string;
    quantityRequested: number;
    quantityDelivered: number;
    usageLocation?: string;
}

export interface PartsRequest {
    id: string;
    requestNumber: string;
    technicianId: string;
    status: RequestStatus;
    priority: RequestPriority;
    items: RequestItem[];
    createdDate: string;
    deliveredTo?: string; // ID or Name of receiver
    purchaseHistory?: PurchaseRequest[];
}

export interface PurchaseRequestItem {
    partId: string;
    quantity: number;
    quantityReceived?: number;
    partName?: string;
    partNumber?: string;
    company?: string;
    machinePlate?: string;
    machineName?: string;
    catalog?: string;
    tableNo?: string;
    figure?: string;
    unitOfMeasure?: string;
    supplier?: string;
}

export interface PurchaseRequest {
    id: string;
    requestDate: string;
    items: PurchaseRequestItem[];
    requestedBy: string; // User ID
    purchaseRequestNumber: string; // e.g. "SC-001"
    requestId?: string; // Optional link to the SPR
    status?: 'Pendiente' | 'Parcial' | 'Recibido' | 'Cancelado';
}

export interface ExtendedPurchaseRequest extends PurchaseRequest {
    sparePartName?: string;
    sparePartNumber?: string;
    sourceRequestNumber?: string;
}

export interface StockReceptionItem {
    partId: string;
    partName: string;
    partNumber: string;
    quantity: number;
}

export interface StockReception {
    id: string;
    receptionDate: string;
    documentNumber?: string;
    receivedBy?: string;
    items: StockReceptionItem[];
    notes?: string;
    status?: string;
}

export interface DeliverPartItem {
    partId: string;
    quantity: number;
}

export interface DeliverPartResult {
    success: boolean;
    processed: number;
    errors?: string[];
}

export interface DeliverPartError {
    message: string;
}
