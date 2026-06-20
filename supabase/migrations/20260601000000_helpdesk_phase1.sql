-- Migration: Help Desk Phase 1
-- Creates the core tables for the Help Desk module, including strict RLS.

CREATE TABLE IF NOT EXISTS "public"."helpdesk_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "public_code" "text",
    "tenant_id" "text" DEFAULT 'primary',
    "created_by" "uuid" REFERENCES "auth"."users"("id"),
    "requester_name" "text",
    "requester_email" "text",
    "category" "text" CHECK ("category" IN ('Nueva Funcionalidad', 'Corrección', 'Error Funcionalidad', 'Error General', 'Sugerencia')),
    "subject" "text",
    "status" "text" DEFAULT 'nuevo' CHECK ("status" IN ('nuevo', 'triage', 'abierto', 'esperando_usuario', 'en_progreso', 'resuelto', 'cerrado', 'reabierto')),
    "priority" "text",
    "module_key" "text",
    "related_asset_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."helpdesk_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "ticket_id" "uuid" REFERENCES "public"."helpdesk_tickets"("id") ON DELETE CASCADE,
    "author_type" "text" CHECK ("author_type" IN ('usuario', 'agente', 'admin', 'ia', 'sistema')),
    "visibility" "text" DEFAULT 'publico' CHECK ("visibility" IN ('publico', 'interno')),
    "source" "text" CHECK ("source" IN ('widget', 'portal', 'admin', 'email_inbound', 'ai', 'system')),
    "body_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."helpdesk_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "ticket_id" "uuid" REFERENCES "public"."helpdesk_tickets"("id") ON DELETE CASCADE,
    "message_id" "uuid" REFERENCES "public"."helpdesk_messages"("id") ON DELETE CASCADE,
    "bucket" "text",
    "path" "text",
    "original_filename" "text",
    "mime_type" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."helpdesk_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "ticket_id" "uuid" REFERENCES "public"."helpdesk_tickets"("id") ON DELETE CASCADE,
    "title" "text",
    "description" "text",
    "task_type" "text" CHECK ("task_type" IN ('bugfix', 'mejora_mantenimiento', 'nueva_funcionalidad', 'cambio_profundo', 'investigacion')),
    "billing_classification" "text" CHECK ("billing_classification" IN ('incluido_mantenimiento_mensual', 'cobrar_aparte', 'pendiente_cotizacion', 'interno_no_facturable')),
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

-- Triggers for updated_at
CREATE TRIGGER update_helpdesk_tickets_updated_at BEFORE UPDATE ON "public"."helpdesk_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

-- Enable RLS
ALTER TABLE "public"."helpdesk_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."helpdesk_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."helpdesk_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."helpdesk_tasks" ENABLE ROW LEVEL SECURITY;

-- Tickets Policies
CREATE POLICY "Users can create their own tickets" ON "public"."helpdesk_tickets" FOR INSERT WITH CHECK ("auth"."uid"() = "created_by" OR "public"."coreflow_is_admin"());
CREATE POLICY "Users can view their own tickets" ON "public"."helpdesk_tickets" FOR SELECT USING ("auth"."uid"() = "created_by" OR "public"."coreflow_is_admin"());
CREATE POLICY "Users can update their own tickets" ON "public"."helpdesk_tickets" FOR UPDATE USING ("auth"."uid"() = "created_by" OR "public"."coreflow_is_admin"());
CREATE POLICY "Admins can delete any ticket" ON "public"."helpdesk_tickets" FOR DELETE USING ("public"."coreflow_is_admin"());

-- Messages Policies
CREATE POLICY "Users can insert messages to their tickets" ON "public"."helpdesk_messages" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "public"."helpdesk_tickets" t WHERE t.id = ticket_id AND (t.created_by = "auth"."uid"() OR "public"."coreflow_is_admin"()))
);
CREATE POLICY "Users can view public messages on their tickets" ON "public"."helpdesk_messages" FOR SELECT USING (
  (EXISTS (SELECT 1 FROM "public"."helpdesk_tickets" t WHERE t.id = ticket_id AND t.created_by = "auth"."uid"()) AND visibility = 'publico')
  OR "public"."coreflow_is_admin"()
);

-- Attachments Policies
CREATE POLICY "Users can insert attachments to their tickets" ON "public"."helpdesk_attachments" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "public"."helpdesk_tickets" t WHERE t.id = ticket_id AND (t.created_by = "auth"."uid"() OR "public"."coreflow_is_admin"()))
);
CREATE POLICY "Users can view attachments on their tickets" ON "public"."helpdesk_attachments" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "public"."helpdesk_tickets" t WHERE t.id = ticket_id AND t.created_by = "auth"."uid"())
  OR "public"."coreflow_is_admin"()
);

-- Tasks Policies
CREATE POLICY "Tasks only viewable and modifiable by admins" ON "public"."helpdesk_tasks" FOR ALL USING ("public"."coreflow_is_admin"()) WITH CHECK ("public"."coreflow_is_admin"());

-- Storage Bucket setup
INSERT INTO storage.buckets (id, name, public) 
VALUES ('helpdesk-attachments', 'helpdesk-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS setup
CREATE POLICY "Users can view their ticket attachments in storage" ON storage.objects FOR SELECT USING (
  bucket_id = 'helpdesk-attachments' AND (
    "public"."coreflow_is_admin"() OR
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id::text = (string_to_array(name, '/'))[1]
      AND t.created_by = auth.uid()
    )
  )
);
CREATE POLICY "Users can upload their ticket attachments to storage" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'helpdesk-attachments' AND (
    "public"."coreflow_is_admin"() OR
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id::text = (string_to_array(name, '/'))[1]
      AND t.created_by = auth.uid()
    )
  )
);
