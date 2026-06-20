CREATE OR REPLACE FUNCTION "public"."coreflow_is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text;
  v_is_sys boolean;
  v_role_name text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  IF v_role = 'ADMIN_SOLICITANTE' THEN
    RETURN true;
  END IF;

  BEGIN
    SELECT is_system, name INTO v_is_sys, v_role_name 
    FROM public.app_roles 
    WHERE id = v_role::uuid;
    
    -- Alinear backend con el AuthContext del Frontend:
    -- Considerar admin si es system, o el nombre contiene Admin, Manager, o Gerente.
    IF v_is_sys OR (v_role_name ILIKE '%Admin%') OR (v_role_name ILIKE '%Manager%') OR (v_role_name ILIKE '%Gerente%') THEN
      RETURN true;
    END IF;
  EXCEPTION 
    WHEN invalid_text_representation THEN
      RETURN false;
  END;

  RETURN false;
END;
$$;
