-- 1. Modificar Tablas Existentes

-- Tabla: helpdesk_tickets
ALTER TABLE "public"."helpdesk_tickets" 
  -- En caso de que tenant_id exista como tipo text, y queramos usar uuid, se podría requerir un cambio de tipo, 
  -- pero para evitar romper la data actual, intentaremos agregar las nuevas.
  ADD COLUMN IF NOT EXISTS "ticket_number" SERIAL,
  ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'APP',
  ADD COLUMN IF NOT EXISTS "customer_name" text,
  ADD COLUMN IF NOT EXISTS "customer_email" text,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;

-- Actualizamos constraint del status actual o lo dejamos libre si es tipo text. 
-- Asumiendo que es tipo text y las reglas se manejan desde la app o type en Typescript.
-- Si hubiese un CHECK, se debería hacer un DROP y añadir uno nuevo. Por defecto en Supabase suele ser TEXT sin check estricto si no se especificó.

-- Tabla: helpdesk_messages
ALTER TABLE "public"."helpdesk_messages"
  ADD COLUMN IF NOT EXISTS "sender_type" text,
  ADD COLUMN IF NOT EXISTS "sender_name" text,
  ADD COLUMN IF NOT EXISTS "sender_email" text,
  ADD COLUMN IF NOT EXISTS "attachments_meta" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;

-- 2. Crear Nuevas Tablas

-- Tabla: requested_improvements
CREATE TABLE IF NOT EXISTS "public"."requested_improvements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "tenant_id" "text" DEFAULT 'primary',
    "ticket_id" "uuid" REFERENCES "public"."helpdesk_tickets"("id") ON DELETE CASCADE,
    "title" "text" NOT NULL,
    "affected_module" "text",
    "customer_request" "text",
    "operational_impact" "text",
    "priority" "text",
    "status" "text" CHECK ("status" IN ('Nueva', 'En evaluación', 'Aprobada', 'En desarrollo', 'Implementada', 'Rechazada')) DEFAULT 'Nueva',
    "created_by" "uuid" REFERENCES "auth"."users"("id"),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "implemented_at" timestamp with time zone,
    "metadata" jsonb DEFAULT '{}'::jsonb
);

-- Tabla: support_feedback
CREATE TABLE IF NOT EXISTS "public"."support_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "ticket_id" "uuid" REFERENCES "public"."helpdesk_tickets"("id") ON DELETE CASCADE,
    "tenant_id" "text" DEFAULT 'primary',
    "rating" smallint CHECK ("rating" >= 1 AND "rating" <= 5),
    "comment" "text",
    "action" "text" CHECK ("action" IN ('close', 'reopen')),
    "created_at" timestamp with time zone DEFAULT "now"()
);

-- 3. Actualizar Políticas RLS

-- Habilitar RLS
ALTER TABLE "public"."requested_improvements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."support_feedback" ENABLE ROW LEVEL SECURITY;

-- Políticas para requested_improvements
-- Usuarios ven las mejoras de sus tickets, admins ven todas.
CREATE POLICY "Users view own improvements" ON "public"."requested_improvements" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "public"."helpdesk_tickets" t WHERE t.id = ticket_id AND t.created_by = "auth"."uid"())
  OR "public"."coreflow_is_admin"()
);

CREATE POLICY "Admins insert improvements" ON "public"."requested_improvements" FOR INSERT WITH CHECK (
  "public"."coreflow_is_admin"()
);

CREATE POLICY "Admins update improvements" ON "public"."requested_improvements" FOR UPDATE USING (
  "public"."coreflow_is_admin"()
);

-- Políticas para support_feedback
-- Usuarios pueden insertar feedback para sus propios tickets
CREATE POLICY "Users insert own feedback" ON "public"."support_feedback" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "public"."helpdesk_tickets" t WHERE t.id = ticket_id AND t.created_by = "auth"."uid"())
);

-- Usuarios ven feedback de sus tickets, admins ven todos
CREATE POLICY "Users view own feedback" ON "public"."support_feedback" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "public"."helpdesk_tickets" t WHERE t.id = ticket_id AND t.created_by = "auth"."uid"())
  OR "public"."coreflow_is_admin"()
);


-- 4. Triggers (Automatización DB)

-- Función para actualizar updated_at en helpdesk_tickets
CREATE OR REPLACE FUNCTION "public"."trigger_update_ticket_timestamp"() RETURNS trigger AS $$
BEGIN
  UPDATE "public"."helpdesk_tickets"
  SET updated_at = "now"()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar la función al insertar un nuevo mensaje
DROP TRIGGER IF EXISTS "update_ticket_timestamp_on_message" ON "public"."helpdesk_messages";
CREATE TRIGGER "update_ticket_timestamp_on_message"
AFTER INSERT ON "public"."helpdesk_messages"
FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_ticket_timestamp"();
