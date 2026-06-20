import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configuración de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Manejo de preflight request (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Solo procesar tickets nuevos (evitar envíos duplicados al actualizar el ticket)
    if (payload.type && payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Ignored non-INSERT event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const record = payload.record;

    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: 'No record found in payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Inicializar Supabase Admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Extraer Asunto y buscar el primer mensaje (con un ligero delay para evitar race conditions si el insert del front toma milisegundos extra)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const { data: messages } = await supabaseAdmin
      .from('helpdesk_messages')
      .select('body_text')
      .eq('ticket_id', record.id)
      .eq('author_type', 'usuario')
      .order('created_at', { ascending: true })
      .limit(1);

    const description = messages && messages.length > 0 ? messages[0].body_text : 'Sin descripción detallada';
    const userContext = `Asunto: ${record.subject}\nDescripción: ${description}`;

    let respuestaIA = "Hemos recibido tu solicitud y el equipo técnico ya está evaluando el caso. Te contactaremos a la brevedad.";

    // 2. Lógica de Inteligencia Artificial (OpenAI)
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (openAiApiKey) {
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 150,
            messages: [
              {
                role: 'system',
                content: 'Eres el asistente de soporte técnico nivel 1 de CoreFlow. Analiza el ticket del usuario en máximo 3 oraciones en español. Sugiere una causa breve si es evidente, usa un tono profesional y amable, y confirma siempre que el equipo técnico ya fue notificado y está trabajando en el caso. No inventes soluciones que requieran tocar maquinaria.'
              },
              {
                role: 'user',
                content: userContext
              }
            ]
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.choices && aiData.choices.length > 0) {
            respuestaIA = aiData.choices[0].message.content.trim();
          }
        } else {
          console.error("Error from OpenAI API:", await aiResponse.text());
        }
      } catch (aiErr) {
        console.error("OpenAI Execution Error:", aiErr);
      }
    } else {
      console.warn("No OPENAI_API_KEY found, skipping AI triage.");
    }

    // 3. Guardar en el Hilo de Conversación
    const { error: insertError } = await supabaseAdmin
      .from('helpdesk_messages')
      .insert({
        ticket_id: record.id,
        author_type: 'ia',
        visibility: 'publico',
        source: 'ai',
        body_text: respuestaIA
      });

    if (insertError) {
      console.error("Error inserting AI message:", insertError);
    }

    // 4. Envío de Correo (Resend)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey && record.requester_email) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CoreFlow Soporte <notificaciones@ravicaribeinc.com>',
            reply_to: `soporte@soporte.ravicaribeinc.com`,
            to: [record.requester_email],
            subject: `Soporte CoreFlow - Ticket Recibido [TKT-${record.id}]`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
                <h2 style="color: #0f172a;">Soporte Técnico CoreFlow</h2>
                <p>Hemos recibido tu reporte sobre: <b>${record.subject}</b>.</p>
                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
                  <p style="margin-top: 0;"><b>Respuesta preliminar de nuestro asistente IA:</b></p>
                  <i style="color: #475569;">${respuestaIA}</i>
                </div>
                <p>Puedes ver el estado de tu ticket y responder a este hilo directamente desde la plataforma de CoreFlow.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">CoreFlow Maintenance Cloud - Secure Industrial Gateway</p>
              </div>
            `
          }),
        });
        
        if (!emailResponse.ok) {
          console.error("Resend API Error:", await emailResponse.text());
        }
      } catch (emailErr) {
        console.error("Resend Execution Error:", emailErr);
      }
    } else {
      console.warn("No RESEND_API_KEY found or missing requester_email, skipping Email.");
    }

    return new Response(JSON.stringify({ success: true, ai_response: respuestaIA }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
