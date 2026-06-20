import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle preflight CORS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { action = 'draft', ticketSubject, ticketDescription = '', oldCategory, newCategory, reason, customerName } = payload;

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured on backend.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (action === 'reason') {
      systemPrompt = `Eres el asistente de soporte técnico de CoreFlow. Se está cambiando la categoría de un ticket de soporte.
Tu tarea es redactar la RAZÓN de este cambio de categoría de forma breve (máximo 2 oraciones), lógica y profesional en español.
El texto generado DEBE comenzar exactamente con la frase: "Luego de una revisión y análisis, hemos determinado que el cambio de categoría" (o una variación directa muy similar como "Luego de una revisión y análisis, entendemos que esto") y continuar explicando lógicamente por qué el asunto del ticket y su descripción se ajustan mejor a la nueva categoría "${newCategory}" en lugar de la categoría anterior "${oldCategory || 'Sin categoría'}".
Responde estrictamente solo con el texto de la razón redactada, sin saludos, firmas, ni marcas adicionales.`;

      userPrompt = `Asunto del Ticket: "${ticketSubject}"\nDescripción: "${ticketDescription}"\nCategoría anterior: "${oldCategory || 'Sin categoría'}"\nNueva categoría: "${newCategory}"`;
    } else if (action === 'seguimiento') {
      systemPrompt = `Eres el asistente de soporte técnico de CoreFlow. Tu tarea es redactar un mensaje breve en español para darle seguimiento a una respuesta pendiente por parte del cliente.
El cliente se llama ${customerName || 'Cliente'}.
El tono debe ser profesional, empático y muy amable. Pregúntale si requiere ayuda con el ticket "${ticketSubject}", o si tiene algún comentario sobre la última respuesta que le enviamos. Indícale que estamos ready para continuar con su caso o proceder al cierre si el tema ya ha sido solucionado.
Responde estrictamente solo con el texto del mensaje redactado, sin saludos de inicio excesivos (como 'Estimado...'), sin firmas ni etiquetas de marcado markdown adicionales.`;

      userPrompt = `Asunto del Ticket: "${ticketSubject}"\nDescripción: "${ticketDescription}"\nNombre del cliente: "${customerName || 'Cliente'}"`;
    } else if (action === 'update') {
      systemPrompt = `Eres el asistente de soporte técnico de CoreFlow. Tu tarea es redactar un mensaje de actualización (update) breve en español para el cliente.
El cliente se llama ${customerName || 'Cliente'}.
El tono debe ser sumamente profesional y proactivo. Comunícale de manera amable que nuestro equipo de desarrollo está trabajando activamente en la resolución de su ticket "${ticketSubject}". Dile que seguimos avanzando y que nos pondremos en contacto tan pronto como tengamos novedades o una solución.
Responde estrictamente solo con el texto del mensaje redactado, sin saludos de inicio excesivos (como 'Estimado...'), sin firmas ni etiquetas de marcado markdown adicionales.`;

      userPrompt = `Asunto del Ticket: "${ticketSubject}"\nDescripción: "${ticketDescription}"\nNombre del cliente: "${customerName || 'Cliente'}"`;
    } else if (action === 'cierre') {
      systemPrompt = `Eres el asistente de soporte técnico de CoreFlow. Tu tarea es redactar un mensaje breve de cierre de ticket en español.
El cliente se llama ${customerName || 'Cliente'}.
El tono debe ser cortés y atento. Notifica al cliente que se ha resuelto el problema de su ticket "${ticketSubject}" y que procederemos a cerrarlo. Explícale que si el problema persiste o si tiene cualquier otra duda sobre este tema, puede reabrir el ticket simplemente respondiendo a este mensaje o desde el portal de soporte. Agradécele su paciencia y colaboración.
Responde estrictamente solo con el texto del mensaje redactado, sin saludos de inicio excesivos (como 'Estimado...'), sin firmas ni etiquetas de marcado markdown adicionales.`;

      userPrompt = `Asunto del Ticket: "${ticketSubject}"\nDescripción: "${ticketDescription}"\nNombre del cliente: "${customerName || 'Cliente'}"`;
    } else if (action === 'solicitar_info') {
      systemPrompt = `Eres el asistente de soporte técnico de CoreFlow. Tu tarea es redactar un mensaje breve en español solicitando información adicional al cliente.
El cliente se llama ${customerName || 'Cliente'}.
El tono debe ser muy atento y colaborador. Explícale que para poder diagnosticar e investigar a fondo el problema del ticket "${ticketSubject}", necesitamos detalles adicionales. Pídele amablemente si puede proporcionarnos pasos específicos para reproducir el fallo, capturas de pantalla, o videos que ilustren la situación.
Responde estrictamente solo con el texto del mensaje redactado, sin saludos de inicio excesivos (como 'Estimado...'), sin firmas ni etiquetas de marcado markdown adicionales.`;

      userPrompt = `Asunto del Ticket: "${ticketSubject}"\nDescripción: "${ticketDescription}"\nNombre del cliente: "${customerName || 'Cliente'}"`;
    } else if (action === 'investigacion') {
      systemPrompt = `Eres el asistente de soporte técnico de CoreFlow. Tu tarea es redactar un mensaje breve en español informando al cliente que su caso está bajo investigación técnica.
El cliente se llama ${customerName || 'Cliente'}.
El tono debe ser formal y profesional. Infórmale que su caso en relación al ticket "${ticketSubject}" ha sido escalado y actualmente se encuentra bajo investigación profunda por parte de nuestro equipo de ingeniería. Dile que estamos analizando todos los detalles técnicos para darle un diagnóstico exacto y que nos comunicaremos lo antes posible.
Responde estrictamente solo con el texto del mensaje redactado, sin saludos de inicio excesivos (como 'Estimado...'), sin firmas ni etiquetas de marcado markdown adicionales.`;

      userPrompt = `Asunto del Ticket: "${ticketSubject}"\nDescripción: "${ticketDescription}"\nNombre del cliente: "${customerName || 'Cliente'}"`;
    } else {
      systemPrompt = `Eres el asistente de soporte técnico de CoreFlow. Se está cambiando la categoría de un ticket de soporte de "${oldCategory || 'Sin categoría'}" a "${newCategory}" por la siguiente razón: "${reason || 'Reclasificación de ticket'}".

Genera un borrador de mensaje para el solicitante del ticket (debe ser amable, empático y profesional). El mensaje debe explicar brevemente que se está cambiando la categoría del ticket a "${newCategory}" y explicar la razón de forma resumida y clara en español. No inventes soluciones técnicas ni des explicaciones muy extensas. El mensaje debe terminar indicando que seguimos trabajando en su caso. Responde estrictamente solo con el texto del mensaje redactado, sin saludos de inicio excesivos, sin firmas ni etiquetas de marcado markdown adicionales.`;

      userPrompt = `Asunto del Ticket: "${ticketSubject}"\nCategoría anterior: "${oldCategory || 'Sin categoría'}"\nNueva categoría: "${newCategory}"\nRazón: "${reason || ''}"`;
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: action === 'reason' ? 150 : 250,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI API Error:", errorText);
      return new Response(JSON.stringify({ error: `Error from OpenAI: ${errorText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const aiData = await aiResponse.json();
    const resultText = aiData.choices?.[0]?.message?.content?.trim() || '';

    if (action === 'reason') {
      return new Response(JSON.stringify({ success: true, reason: resultText }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ success: true, draft: resultText }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
