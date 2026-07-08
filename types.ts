
export enum MachineStatus {
  RUNNING = 'RUNNING',
  IDLE = 'IDLE',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  OFFLINE = 'OFFLINE'
}

export enum PlanTier {
  LIGHT = 'LIGHT',
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS'
}

// --- SECURITY & AUTH TYPES ---
export enum UserRole {
  ADMIN_SOLICITANTE = 'ADMIN_SOLICITANTE', // Full Access
  TECNICO_MANT = 'TECNICO_MANT',           // Execution & Readings
  AUDITOR = 'AUDITOR'                      // Read Only
}

// NEW: Dynamic Role Definitions
export interface Permission {
  id: string;
  category: 'OPERATIONAL' | 'ADMINISTRATIVE' | 'FINANCIAL' | 'SYSTEM';
  label: string;
  description: string;
}

export interface RoleDefinition {
  id: string; // e.g. 'custom-supervisor' or UUID
  name: string; // e.g. 'Line Supervisor'
  description: string;

  // Jerarquía
  parentRoleId?: string | null; // ID del rol superior (Reporta a)
  children?: RoleDefinition[]; // Roles hijos (calculado en frontend para tree view)
  level?: number; // Nivel en la jerarquía (0 = raíz, calculado en frontend)

  // Permisos
  permissions: string[] | Record<string, boolean>; // Soportar ambos formatos

  // Configuración
  shareDataWithPeers?: boolean; // Compartir datos con colegas del mismo nivel
  isSystem: boolean; // Si true, no puede ser eliminado (solo editado)

  // Metadata
  usersCount?: number; // Número de usuarios con este rol
}

export interface UserProfile {
  id: string;
  email: string;
  tenant_id: string;
  role: UserRole | string; // Updated to allow custom role IDs
  roleName?: string; // Added to hold the joined role name
  full_name: string;
  job_title: string;
  avatar_url?: string;
  signature_url?: string; // Base64 or URL from Storage
  specialties?: string[]; // Array of tags e.g. ["SACMI", "Hydraulics"]
  status: 'ACTIVE' | 'INVITED' | 'INACTIVE';
  company_code?: string; // New field: Código de Empresa
  notification_preferences?: {
    alerts_rmant05: boolean;
    low_stock: boolean;
    pending_approvals: boolean;
  };
  requires_password_change?: boolean;
}

export interface TelemetryData {
  timestamp: string;
  temperature: number; // Celsius
  vibration: number; // mm/s
  pressure: number; // Bar
  powerConsumption: number; // kW
}

export interface Machine {
  id: string;
  name: string;
  plate: string;
  type: 'SACMI' | 'MOSS' | 'PMV' | 'GENERIC' | string; // Loosened type for dynamic input
  status: MachineStatus;
  isActive: boolean; // Administrative status (Active/Inactive)
  location: { x: number; y: number };
  zone?: string;
  isIot: boolean;
  runningHours: number;
  lastMaintenance: string;
  nextMaintenance: string;
  intervals?: string[];
  telemetry: TelemetryData;
  history: TelemetryData[];

  // New Fields
  branch?: string;        // Empresa - Sucursal
  category?: string;      // Categoría
  alias?: string;         // Alias del Equipo
  brand?: string;         // Marca
  model?: string;         // Modelo
  year?: number;          // Año de Fabricación
  capacity?: string;      // Capacidad
  currentRating?: number; // In (A)
  frequency?: number;     // f (hz)
  voltage?: number;       // V. 3PH (VAC)
  power?: number;         // P (KVA)
  imageUrl?: string;      // Imagen del Equipo

  // Phase 3 Master ID Relationships
  brandId?: string;
  typeId?: string;

  documents?: MachineDocument[] | string[];   // Documentos adjuntos (soporta ambos formatos)
  maintenancePlans?: MaintenancePlan[]; // R-MANT-02 Protocols inside JSONB
  criticalParts?: string[]; // IDs of critical spare parts for this machine
  specifications?: any;
  code?: string;
  serialNumber?: string;
}

/**
 * Interfaz para documentos de máquinas con metadata completa
 */
export interface MachineDocument {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  size: number;
  type: string;
}

export enum WorkOrderStatus {
  BACKLOG = 'BACKLOG',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE'
}

// Stages for the visual workflow (Green -> Pink -> Green)
export enum WorkOrderStage {
  DRAFT = 'DRAFT',           // Section 1 Editable
  REQUESTED = 'REQUESTED',   // Section 1 Locked, Section 2 Available
  EXECUTION = 'EXECUTION',   // Section 2 Active
  HANDOVER = 'HANDOVER',     // Section 2 Locked, Section 3 Active
  CLOSED = 'CLOSED'          // All Locked
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ConsumedPart {
  partId: string;
  partName: string; // Snapshot of name in case it changes
  sku: string;
  quantity: number;
  unit: string; // e.g., 'Pieza', 'Litro'
  unitCost: number;
  totalCost: number;
}

export interface ExecutorInfo {
  name: string;
  lastName: string;
  position: string;
}

// Maintenance Protocol Structure (R-MANT-02)
export interface MaintenancePlan {
  machineId: string;
  intervals: MaintenanceInterval[];
}

export interface MaintenanceInterval {
  id: string; // Add ID for keying
  hours: number;
  label: string; // e.g., "360 Horas"
  tasks: MaintenanceTask[];
}

export interface MaintenanceTask {
  id: string;
  sequence: number;          // Columna: Nº
  group: string;             // Columna: Grupo (ej: "Extrusor")
  component: string;         // Columna: Punto de intervencion
  activity: string;          // Columna: Tipo de intervencion

  // Datos Técnicos / Materiales & Repuestos
  referenceCode?: string;    // Columna: Ref de interv.
  lubricantType?: string;    // Columna: Tipo de Lub.
  lubricantName?: string;    // Columna: Nombre (Nuevo)
  lubricantCode?: string;    // Columna: Codigo
  lubricantQuantity?: string; // Columna: Cantidad (Nuevo)
  estimatedTime: number;     // Columna: Tiem. Estim min

  // Compatibility fields
  intervalOrigin?: string;   // Keeping for compatibility
  completed?: boolean;       // Keeping for state
  checks?: Record<string, boolean>; // Granular completion tracking (clean, inspect, etc.)
  notes?: string;

  // Matriz de Acciones
  actionFlags: {
    disassemble: boolean;  // Desmontaje
    clean: boolean;        // Limpieza
    inspect: boolean;      // Controlar/Verificar
    lubricate: boolean;    // Lubricación
    replace: boolean;      // Sustitución/Cambio (Cambio)
    mount: boolean;        // Desmontaje/Montaje (Montaje)
    adjust: boolean;       // Regulación/Ajuste (Ajuste-Calibración)
    refill: boolean;       // Llenado/Recarga
  };
}

export interface WorkOrder {
  id: string;
  displayId?: string;
  title: string;
  machineId: string;
  status: WorkOrderStatus;
  currentStage: WorkOrderStage; // Controls the 3-section workflow
  priority: Priority;
  assignedTo?: string; // Main technician
  description: string;
  createdDate: string;
  completedDate?: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'PROGRAMMED' | 'OTHER';
  formType: 'R-MANT-02' | 'R-MANT-05' | 'R-INOC-07';

  // R-MANT-02 Specifics (Image 2)
  maintenanceType?: 'Preventive' | 'Programmed' | 'Other';
  machinePlate?: string;
  interval?: string; // e.g. "360 Hours"
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  machineWorkHours?: number;   // Formatted in UI, number in generic
  nextMaintenanceHours?: number;
  electromechanicalGroup?: string; // "Electromecánicos" select
  executors?: ExecutorInfo[];
  supervisor?: string;
  // R-MANT-02 Specifics (Image 3 - Parts)
  consumedParts?: ConsumedPart[];
  totalMaintenanceCost?: number;

  // R-MANT-02 Specifics (Image 3 - Checklist)
  checklist?: {
    pointClean?: boolean | null; // Punto específico limpio
    areaClean?: boolean | null; // Área limpia
    guardsComplete?: boolean | null; // Protecciones completas
    toolsRemoved?: boolean | null; // Herramientas retiradas
    greaseCleaned?: boolean | null; // Grasas tapadas/limpias
    safetyActivated?: boolean | null; // Protecciones activadas
  };

  // R-MANT-02 Specifics (Image 4 - Executors)
  observations?: string;
  assignedMechanic?: string;
  receivedBy?: string;

  // R-MANT-05 Specifics
  department?: 'Mantenimiento' | 'Almacén' | 'Calidad' | 'Producción' | 'Servicios Generales' | 'Administración';
  equipmentType?: 'Mantenimiento Maquinaria' | 'Mantenimiento Elemento Auxiliar';
  failureType?: 'Mecánica' | 'Eléctrica' | 'Electrónica' | 'Plomería';
  condition?: 'Crítica' | 'Media' | 'Normal';
  frequency?: 'Primera vez' | 'Ocasional' | 'Frecuente' | 'Muy frecuente';
  consequence?: 'Ninguna' | 'Bajo Rendimiento' | 'Parada';
  actionTaken?: string; // Containment Action
  requestDescription?: string; // Detalles Solicitud - Avería

  requestReceivedBy?: string;
  requestReceivedDate?: string;

  // New Dynamic Table for R-MANT-05
  failuresAndActivities?: {
    cause: string;
    activity: string;
  }[];

  // R-MANT-05 Section 3 Supervision
  closingImage?: string; // Image URL/Path
  closingFile?: string; // File URL/Path
  supervisorId?: string; // User ID of the supervisor accepting the work
  closingDate?: string; // Date/Time when the work was accepted/closed

  // Signatures
  signatureExecutor?: string; // Name of executor
  signatureExecutorDate?: string;
  signatureSupervisor?: string; // Name of supervisor
  signatureSupervisorDate?: string;
  tasks?: any[];
  branch?: string;
}

export interface MachineHourLog {
  id: string;
  machineId: string;
  date: string;
  hoursLogged: number;
  unit: 'h' | 'km';
  operator: string;
  comments?: string;
  createdAt?: string;
}

export interface SparePart {
  id: string;
  sku: string;
  name: string;
  category?: 'MECHANICAL' | 'ELECTRICAL' | 'HYDRAULIC' | 'PNEUMATIC' | 'CONSUMABLE' | 'SENSOR' | 'PLC' | 'OTHER';
  currentStock: number;
  minStock: number;
  reorderPoint?: number;
  locationCode?: string;
  unitCost: number;
  currency?: string;
  unitOfMeasure?: string;
  supplier: string;
  leadTimeDays: number;
  company?: string;
  machinePlate?: string;
  machineName?: string;
  catalog?: string;
  tableNo?: string;
  figure?: string;
  supplierCode?: string;
  machineModel?: string;
  machineLine?: string;

  // Phase 3 Master ID Relationships
  categoryId?: string;
  companyId?: string;
  supplierId?: string;
  locationId?: string;
}

export interface Technician {
  id: string;
  name: string;
  role: 'MECHANICAL' | 'ELECTRICAL' | 'SUPERVISOR' | 'AUDITOR';
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT';
  status: 'ACTIVE' | 'LEAVE' | 'INACTIVE';
  email: string;
}

export interface ZoneStructure {
  id: string;
  name: string;
  lines: string[];
  color?: string; // Optional for map visualization
  x?: number;     // Optional layout (percent 0-100)
  y?: number;
  width?: number; // Optional layout (percent 0-100)
  height?: number;
  orderIndex?: number; // For manual sorting
}

export enum AppView {
  LOGIN = 'LOGIN', // New Auth View
  WIZARD = 'WIZARD',
  DASHBOARD = 'DASHBOARD',
  KANBAN = 'KANBAN',
  MANT_02 = 'MANT_02',
  MANT_05 = 'MANT_05',
  MACHINE_HOURS = 'MACHINE_HOURS', // New Module
  INVENTORY = 'INVENTORY',
  ANALYTICS = 'ANALYTICS',
  CONFIGURATION = 'CONFIGURATION',
  PROFILE = 'PROFILE', // New User Profile View
}