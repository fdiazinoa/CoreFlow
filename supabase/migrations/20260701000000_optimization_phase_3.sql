-- ==========================================
-- Fase 3: Optimización Supabase - Consistencia y Normalización
-- ==========================================

-- -----------------------------------------------------------------------------
-- 1. Tablas Maestras
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.part_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.part_companies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.part_suppliers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.part_locations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.machine_brands (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.machine_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Poblar Tablas Maestras con Datos Existentes
-- -----------------------------------------------------------------------------
INSERT INTO public.part_categories (name)
SELECT DISTINCT category FROM public.spare_parts WHERE category IS NOT NULL AND category <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.part_companies (name)
SELECT DISTINCT company FROM public.spare_parts WHERE company IS NOT NULL AND company <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.part_suppliers (name)
SELECT DISTINCT supplier FROM public.spare_parts WHERE supplier IS NOT NULL AND supplier <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.part_locations (name)
SELECT DISTINCT location_code FROM public.spare_parts WHERE location_code IS NOT NULL AND location_code <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.machine_brands (name)
SELECT DISTINCT brand FROM public.machines WHERE brand IS NOT NULL AND brand <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.machine_types (name)
SELECT DISTINCT type FROM public.machines WHERE type IS NOT NULL AND type <> ''
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Agregar Columnas de FK
-- -----------------------------------------------------------------------------
ALTER TABLE public.spare_parts
ADD COLUMN IF NOT EXISTS category_id uuid,
ADD COLUMN IF NOT EXISTS company_id uuid,
ADD COLUMN IF NOT EXISTS supplier_id uuid,
ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS brand_id uuid,
ADD COLUMN IF NOT EXISTS type_id uuid;

-- -----------------------------------------------------------------------------
-- 4. Actualizar las Nuevas Columnas (Migración de IDs)
-- -----------------------------------------------------------------------------
UPDATE public.spare_parts sp
SET category_id = pc.id
FROM public.part_categories pc
WHERE sp.category = pc.name AND sp.category_id IS NULL;

UPDATE public.spare_parts sp
SET company_id = pc.id
FROM public.part_companies pc
WHERE sp.company = pc.name AND sp.company_id IS NULL;

UPDATE public.spare_parts sp
SET supplier_id = ps.id
FROM public.part_suppliers ps
WHERE sp.supplier = ps.name AND sp.supplier_id IS NULL;

UPDATE public.spare_parts sp
SET location_id = pl.id
FROM public.part_locations pl
WHERE sp.location_code = pl.name AND sp.location_id IS NULL;

UPDATE public.machines m
SET brand_id = mb.id
FROM public.machine_brands mb
WHERE m.brand = mb.name AND m.brand_id IS NULL;

UPDATE public.machines m
SET type_id = mt.id
FROM public.machine_types mt
WHERE m.type = mt.name AND m.type_id IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Restricciones de Llave Foránea
-- -----------------------------------------------------------------------------
ALTER TABLE public.spare_parts
ADD CONSTRAINT spare_parts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.part_categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
ADD CONSTRAINT spare_parts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.part_companies(id) ON UPDATE CASCADE ON DELETE SET NULL,
ADD CONSTRAINT spare_parts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.part_suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL,
ADD CONSTRAINT spare_parts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.part_locations(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.machines
ADD CONSTRAINT machines_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.machine_brands(id) ON UPDATE CASCADE ON DELETE SET NULL,
ADD CONSTRAINT machines_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.machine_types(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 6. Conversión de machine_hour_logs.machine_id a UUID
-- -----------------------------------------------------------------------------
-- First cast valid UUIDs, ignore invalid ones or just cast
-- Since it might fail if invalid text exists, we just use a safe cast or force it.
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.machine_hour_logs ALTER COLUMN machine_id TYPE uuid USING (NULLIF(machine_id, '')::uuid);
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not cast machine_id directly. Please check data validity.';
    END;
END $$;

ALTER TABLE public.machine_hour_logs
ADD CONSTRAINT machine_hour_logs_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 7. Nueva Tabla: purchase_request_items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  part_id text REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  tenant_id uuid DEFAULT auth.uid() NOT NULL
);

-- Migrar items desde JSONB a la nueva tabla
INSERT INTO public.purchase_request_items (purchase_request_id, part_id, quantity, tenant_id)
SELECT 
    pr.id, 
    (item->>'partId')::text, 
    COALESCE(NULLIF(item->>'quantity', ''), '0')::numeric,
    pr.tenant_id
FROM public.purchase_requests pr, jsonb_array_elements(pr.items) as item
WHERE pr.items IS NOT NULL AND jsonb_typeof(pr.items) = 'array'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. RPC log_machine_hours (Atómica)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_machine_hours(
  p_machine_id uuid,
  p_hours numeric,
  p_logged_by text,
  p_notes text DEFAULT NULL,
  p_unit text DEFAULT 'h'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_hours numeric;
  v_log_id uuid;
BEGIN
  -- 1. Bloquear la fila de la máquina para actualizaciones concurrentes
  SELECT running_hours INTO v_current_hours
  FROM public.machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Machine with ID % not found', p_machine_id;
  END IF;

  -- 2. Insertar el log
  INSERT INTO public.machine_hour_logs (
    machine_id, date, hours_logged, operator, comments, unit
  ) VALUES (
    p_machine_id, CURRENT_DATE, p_hours, p_logged_by::text, p_notes, p_unit
  ) RETURNING id INTO v_log_id;

  -- 3. Actualizar la máquina sumando horas (si aplica, usualmente se suman)
  -- NOTA: Asumimos que hours_logged es un acumulado total o se suma, 
  -- por seguridad incrementaremos, o bien actualizaremos si el input es absoluto.
  -- Usaremos incremento asumiendo p_hours es un delta. 
  UPDATE public.machines
  SET running_hours = COALESCE(running_hours, 0) + p_hours,
      updated_at = now()
  WHERE id = p_machine_id;

  RETURN json_build_object(
    'success', true,
    'log_id', v_log_id,
    'new_total_hours', COALESCE(v_current_hours, 0) + p_hours
  );
EXCEPTION WHEN OTHERS THEN
  -- El rollback es automático en PL/pgSQL
  RAISE;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Políticas RLS
-- -----------------------------------------------------------------------------
-- Habilitar RLS
ALTER TABLE public.part_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;

-- Políticas Maestras (Lectura pública a autenticados, Escritura solo admin)
CREATE POLICY "Public Read part_categories" ON public.part_categories FOR SELECT USING (true);
CREATE POLICY "Admin Write part_categories" ON public.part_categories FOR ALL USING (public.coreflow_is_admin());

CREATE POLICY "Public Read part_companies" ON public.part_companies FOR SELECT USING (true);
CREATE POLICY "Admin Write part_companies" ON public.part_companies FOR ALL USING (public.coreflow_is_admin());

CREATE POLICY "Public Read part_suppliers" ON public.part_suppliers FOR SELECT USING (true);
CREATE POLICY "Admin Write part_suppliers" ON public.part_suppliers FOR ALL USING (public.coreflow_is_admin());

CREATE POLICY "Public Read part_locations" ON public.part_locations FOR SELECT USING (true);
CREATE POLICY "Admin Write part_locations" ON public.part_locations FOR ALL USING (public.coreflow_is_admin());

CREATE POLICY "Public Read machine_brands" ON public.machine_brands FOR SELECT USING (true);
CREATE POLICY "Admin Write machine_brands" ON public.machine_brands FOR ALL USING (public.coreflow_is_admin());

CREATE POLICY "Public Read machine_types" ON public.machine_types FOR SELECT USING (true);
CREATE POLICY "Admin Write machine_types" ON public.machine_types FOR ALL USING (public.coreflow_is_admin());

-- Política para purchase_request_items
CREATE POLICY "Tenant Isolation purchase_request_items" ON public.purchase_request_items FOR ALL USING (tenant_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 10. Índices
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_spare_parts_category_id ON public.spare_parts(category_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_company_id ON public.spare_parts(company_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_supplier_id ON public.spare_parts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_location_id ON public.spare_parts(location_id);
CREATE INDEX IF NOT EXISTS idx_machines_brand_id ON public.machines(brand_id);
CREATE INDEX IF NOT EXISTS idx_machines_type_id ON public.machines(type_id);

CREATE INDEX IF NOT EXISTS idx_purchase_request_items_request_id ON public.purchase_request_items(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_part_id ON public.purchase_request_items(part_id);
