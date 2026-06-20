import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { Resend } from "npm:resend"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, fullName, roleId, jobTitle, companyCode, specialties, tenantId } = await req.json()

    console.log("=== CREATE USER START ===");
    console.log("Payload:", JSON.stringify({ email, fullName, roleId, jobTitle, companyCode, tenantId }));

    if (!email || !fullName || !roleId) {
      throw new Error('Faltan campos requeridos: email, fullName, roleId');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const generatedPassword = 'CF-' + Math.random().toString(36).slice(-6).toUpperCase();

    let userId;
    let isExistingUser = false;

    // 1. Crear o recuperar el usuario en Auth
    // El trigger on_auth_user_created crea un perfil básico automáticamente
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role_id: roleId,
        job_title: jobTitle || '',
        company_code: companyCode || '',
        specialties: specialties || [],
        tenant_id: tenantId || 'primary'
      }
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        console.log(`User ${email} already exists in auth. Fetching user info...`);
        // Find existing user id from profiles or auth.users list
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile) {
          userId = existingProfile.id;
          isExistingUser = true;
        } else {
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (!listError && listData && listData.users) {
            const foundUser = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (foundUser) {
              userId = foundUser.id;
              isExistingUser = true;
            }
          }
        }

        if (userId) {
          console.log(`Found existing user ID: ${userId}. Updating user metadata and password...`);
          // Update password and metadata for existing user to allow login/access
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: generatedPassword,
            user_metadata: {
              full_name: fullName,
              role_id: roleId,
              job_title: jobTitle || '',
              company_code: companyCode || '',
              specialties: specialties || [],
              tenant_id: tenantId || 'primary'
            }
          });
          if (updateError) {
            console.error("Failed to update existing auth user metadata:", updateError.message);
          }
        }
      }

      if (!userId) {
        console.error("Auth error:", authError.message);
        throw new Error("AUTH_ERROR: " + authError.message);
      }
    } else {
      userId = authData.user.id;
      console.log("Auth user created:", userId);
    }

    // 2. Esperar 500ms para que el trigger DB complete el INSERT inicial
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Usar RPC update_user_profile para actualizar el perfil sin conflictos de constraints
    // Esta función hace un UPDATE directo por id, evitando problemas con UNIQUE en email
    console.log("Calling RPC update_user_profile...");
    const { data: rpcData, error: rpcError } = await supabaseAdmin
      .rpc('update_user_profile', {
        p_user_id:                userId,
        p_full_name:              fullName,
        p_role_id:                roleId,
        p_job_title:              jobTitle || '',
        p_company_code:           companyCode || '',
        p_specialties:            specialties || [],
        p_tenant_id:              tenantId || 'primary',
        p_status:                 'ACTIVE',
        p_requires_password_change: true
      });

    if (rpcError) {
      console.error("RPC error:", JSON.stringify(rpcError));
      // Fallback: intentar upsert directo con onConflict explícito
      console.log("Trying direct upsert fallback...");
      const { data: upsertData, error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id:                     userId,
          email:                  email,
          full_name:              fullName,
          role_id:                roleId,
          job_title:              jobTitle || '',
          company_code:           companyCode || '',
          specialties:            specialties || [],
          tenant_id:              tenantId || 'primary',
          status:                 'ACTIVE',
          requires_password_change: true
        }, { onConflict: 'id' })
        .select();

      if (upsertError) {
        console.error("Upsert fallback failed:", JSON.stringify(upsertError));
        throw new Error("PROFILE_ERROR: " + upsertError.message + " | code: " + upsertError.code);
      }
      console.log("Profile saved via upsert fallback:", JSON.stringify(upsertData));
    } else {
      console.log("Profile updated via RPC:", JSON.stringify(rpcData));
    }

    // 4. Enviar correo con Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const resend = new Resend(resendKey);
      const { error: emailError } = await resend.emails.send({
        from: 'CoreFlow <notificaciones@ravicaribeinc.com>',
        to: email,
        subject: 'Bienvenido a CoreFlow Maintenance Cloud',
        html: `<div style="font-family: sans-serif; padding: 20px; background-color: #f8fafc;">
                <h2 style="color: #1d4ed8;">CoreFlow Maintenance Cloud</h2>
                <p>Hola ${fullName}, has sido invitado a la plataforma.</p>
                <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                  <p><strong>Correo:</strong> ${email}</p>
                  <p><strong>Clave Provisional:</strong> ${generatedPassword}</p>
                </div>
                <p><small>Por seguridad, el sistema te pedirá cambiar esta clave al iniciar sesión por primera vez.</small></p>
               </div>`
      });

      if (emailError) {
        console.error("Email error (non-fatal):", emailError);
        return new Response(
          JSON.stringify({ success: true, emailSent: false, warning: emailError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    console.log("=== CREATE USER SUCCESS ===");
    return new Response(
      JSON.stringify({ success: true, emailSent: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error("=== CREATE USER ERROR ===", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
