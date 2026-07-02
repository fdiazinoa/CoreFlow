-- Migration for Supabase Optimization Phase 1

-- 1. RPC para Entrega de Repuestos Transaccional
CREATE OR REPLACE FUNCTION public.deliver_parts_bulk(
    p_request_id uuid,
    p_items jsonb,
    p_delivered_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    v_part_id uuid;
    v_quantity numeric;
    v_current_stock numeric;
    v_part_name text;
    v_processed_count int := 0;
    v_all_delivered boolean := true;
    v_any_delivered boolean := false;
    v_request_item record;
    v_new_delivered numeric;
BEGIN
    -- Iterar sobre cada ítem a entregar
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_part_id := (item->>'partId')::uuid;
        v_quantity := (item->>'quantity')::numeric;

        -- 1. Validar y bloquear el repuesto
        SELECT current_stock, name INTO v_current_stock, v_part_name
        FROM public.spare_parts
        WHERE id = v_part_id
        FOR UPDATE; -- Bloqueo de fila para evitar condiciones de carrera

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Repuesto con ID % no encontrado', v_part_id;
        END IF;

        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para %. Disponible: %, Solicitado: %', v_part_name, COALESCE(v_current_stock, 0), v_quantity;
        END IF;

        -- 2. Restar del stock
        UPDATE public.spare_parts
        SET current_stock = COALESCE(current_stock, 0) - v_quantity
        WHERE id = v_part_id;

        -- 3. Actualizar la cantidad entregada en los items de la solicitud
        SELECT id, COALESCE(quantity_delivered, 0) as qty_delivered 
        INTO v_request_item
        FROM public.spare_part_request_items
        WHERE request_id = p_request_id AND part_id = v_part_id
        LIMIT 1;

        IF FOUND THEN
            v_new_delivered := v_request_item.qty_delivered + v_quantity;
            UPDATE public.spare_part_request_items
            SET quantity_delivered = v_new_delivered
            WHERE id = v_request_item.id;
        END IF;

        -- 4. Insertar transacción de inventario
        INSERT INTO public.inventory_transactions (
            part_id, transaction_type, quantity, reference_id, notes, delivered_to
        ) VALUES (
            v_part_id, 'OUTBOUND', v_quantity, p_request_id::text, 'Entrega para solicitud ' || p_request_id::text, p_delivered_by::text
        );

        v_processed_count := v_processed_count + 1;
    END LOOP;

    -- 5. Actualizar estado de la solicitud principal
    FOR v_request_item IN (SELECT quantity_requested, quantity_delivered FROM public.spare_part_request_items WHERE request_id = p_request_id)
    LOOP
        IF COALESCE(v_request_item.quantity_delivered, 0) < COALESCE(v_request_item.quantity_requested, 0) THEN
            v_all_delivered := false;
        END IF;
        IF COALESCE(v_request_item.quantity_delivered, 0) > 0 THEN
            v_any_delivered := true;
        END IF;
    END LOOP;

    IF v_all_delivered THEN
        UPDATE public.spare_part_requests SET status = 'CLOSED', delivered_to = p_delivered_by::text WHERE id = p_request_id;
    ELSIF v_any_delivered THEN
        UPDATE public.spare_part_requests SET status = 'PARTIAL', delivered_to = p_delivered_by::text WHERE id = p_request_id;
    END IF;

    RETURN json_build_object(
        'success', true,
        'processed', v_processed_count
    )::jsonb;
EXCEPTION WHEN OTHERS THEN
    -- El rollback es automático al lanzar la excepción
    RAISE;
END;
$$;


-- 2. RPC para actualización en bulk de preferencias de notificación
CREATE OR REPLACE FUNCTION public.update_notification_preferences_bulk(
    p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    v_user_id uuid;
    v_preferences jsonb;
    v_processed_count int := 0;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_payload)
    LOOP
        v_user_id := (item->>'userId')::uuid;
        v_preferences := item->'preferences';

        -- Actualizar preferencias sin modificar otras columnas
        UPDATE public.profiles
        SET notification_preferences = v_preferences
        WHERE id = v_user_id;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'processed', v_processed_count
    )::jsonb;
END;
$$;


-- 3. Vistas para listas únicas (Selectores)
CREATE OR REPLACE VIEW public.v_unique_part_companies AS
SELECT DISTINCT company 
FROM public.spare_parts 
WHERE company IS NOT NULL AND company != ''
ORDER BY company;

CREATE OR REPLACE VIEW public.v_unique_part_categories AS
SELECT DISTINCT category 
FROM public.spare_parts 
WHERE category IS NOT NULL AND category != ''
ORDER BY category;

CREATE OR REPLACE VIEW public.v_unique_part_locations AS
SELECT DISTINCT location_code as location 
FROM public.spare_parts 
WHERE location_code IS NOT NULL AND location_code != ''
ORDER BY location_code;

CREATE OR REPLACE VIEW public.v_unique_part_suppliers AS
SELECT DISTINCT supplier 
FROM public.spare_parts 
WHERE supplier IS NOT NULL AND supplier != ''
ORDER BY supplier;

CREATE OR REPLACE VIEW public.v_unique_machine_brands AS
SELECT DISTINCT brand 
FROM public.machines 
WHERE brand IS NOT NULL AND brand != ''
ORDER BY brand;

CREATE OR REPLACE VIEW public.v_unique_machine_types AS
SELECT DISTINCT type 
FROM public.machines 
WHERE type IS NOT NULL AND type != ''
ORDER BY type;

-- Grant access to authenticated users for the new views
GRANT SELECT ON public.v_unique_part_companies TO authenticated, anon, service_role;
GRANT SELECT ON public.v_unique_part_categories TO authenticated, anon, service_role;
GRANT SELECT ON public.v_unique_part_locations TO authenticated, anon, service_role;
GRANT SELECT ON public.v_unique_part_suppliers TO authenticated, anon, service_role;
GRANT SELECT ON public.v_unique_machine_brands TO authenticated, anon, service_role;
GRANT SELECT ON public.v_unique_machine_types TO authenticated, anon, service_role;
