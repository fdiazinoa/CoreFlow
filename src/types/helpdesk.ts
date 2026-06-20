export type TicketCategory =
  | 'Nueva Funcionalidad'
  | 'Corrección'
  | 'Error Funcionalidad'
  | 'Error General'
  | 'Sugerencia';

export type TicketStatus =
  | 'nuevo'
  | 'triage'
  | 'abierto'
  | 'Abierto'
  | 'esperando_usuario'
  | 'en_progreso'
  | 'En proceso'
  | 'resuelto'
  | 'Resuelto'
  | 'cerrado'
  | 'Cerrado'
  | 'reabierto';

export type MessageAuthorType = 'usuario' | 'agente' | 'admin' | 'ia' | 'sistema';
export type MessageVisibility = 'publico' | 'interno';
export type MessageSource = 'widget' | 'portal' | 'admin' | 'email_inbound' | 'ai' | 'system';

export type TaskType =
  | 'bugfix'
  | 'mejora_mantenimiento'
  | 'nueva_funcionalidad'
  | 'cambio_profundo'
  | 'investigacion';

export type TaskBillingClassification =
  | 'incluido_mantenimiento_mensual'
  | 'cobrar_aparte'
  | 'pendiente_cotizacion'
  | 'interno_no_facturable';

export interface HelpDeskTicket {
  id: string;
  public_code: string | null;
  tenant_id: string;
  ticket_number?: number;
  source?: string;
  customer_name?: string | null;
  customer_email?: string | null;
  metadata?: Record<string, any>;
  created_by: string | null;
  requester_name: string | null;
  requester_email: string | null;
  category: TicketCategory | null;
  subject: string | null;
  status: TicketStatus;
  priority: string | null;
  module_key: string | null;
  related_asset_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
}

export interface HelpDeskMessage {
  id: string;
  ticket_id: string | null;
  author_type: MessageAuthorType | null;
  visibility: MessageVisibility;
  source: MessageSource | null;
  body_text: string | null;
  sender_type?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  attachments_meta?: Record<string, any> | any[];
  metadata?: Record<string, any>;
  created_at: string;
}

export interface HelpDeskAttachment {
  id: string;
  ticket_id: string | null;
  message_id: string | null;
  bucket: string | null;
  path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  source: string | null;
  created_at: string;
}

export interface HelpDeskTask {
  id: string;
  ticket_id: string | null;
  title: string | null;
  description: string | null;
  task_type: TaskType | null;
  billing_classification: TaskBillingClassification | null;
  status: string | null;
  created_at: string;
}

export type ImprovementStatus = 
  | 'Nueva' 
  | 'En evaluación' 
  | 'Aprobada' 
  | 'En desarrollo' 
  | 'Implementada' 
  | 'Rechazada';

export interface RequestedImprovement {
  id: string;
  tenant_id: string;
  ticket_id: string | null;
  title: string;
  affected_module: string | null;
  customer_request: string | null;
  operational_impact: string | null;
  priority: string | null;
  status: ImprovementStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  implemented_at: string | null;
  metadata?: Record<string, any>;
}

export interface SupportFeedback {
  id: string;
  ticket_id: string | null;
  tenant_id: string;
  rating: number | null;
  comment: string | null;
  action: 'close' | 'reopen' | null;
  created_at: string;
}
