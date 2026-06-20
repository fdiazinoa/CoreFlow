import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@3.2.0";

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
    const { ticketId, ticketSubject, recipientEmail, recipientName, messageBody, senderName } = payload;

    if (!ticketId || !recipientEmail || !messageBody) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: ticketId, recipientEmail, messageBody' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured on the backend.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const resend = new Resend(resendApiKey);

    // Subject must contain [TKT-ticketId] for the inbound email parser to match it back to the ticket!
    const subject = `[TKT-${ticketId}] Re: ${ticketSubject || 'Soporte CoreFlow'}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f1115; margin: 0; padding: 20px; color: #e2e8f0; }
          .container { max-width: 600px; background-color: #111318; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); border: 1px solid #1f2937; }
          .header { background-color: #1d4ed8; padding: 24px; text-align: center; border-bottom: 1px solid #1e3a8a; }
          .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
          .content { padding: 32px; }
          .message-box { background-color: #1a1d24; border: 1px solid #374151; border-radius: 8px; padding: 20px; color: #f3f4f6; font-size: 15px; line-height: 1.6; margin-bottom: 24px; white-space: pre-wrap; }
          .agent-info { font-size: 13px; color: #9ca3af; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
          .agent-badge { background-color: #2563eb; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; text-transform: uppercase; }
          .footer { background-color: #0f1115; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937; }
          .footer a { color: #3b82f6; text-decoration: none; }
          .footer-note { margin-top: 12px; padding: 8px; background-color: #1e1b4b; border-radius: 6px; color: #818cf8; font-weight: 500; border: 1px dashed #312e81; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>COREFLOW HELP DESK</h1>
          </div>
          <div class="content">
            <div class="agent-info">
              <span class="agent-badge">Agente</span>
              <span><strong>${senderName || 'Soporte'}</strong> ha respondido a tu ticket:</span>
            </div>
            
            <div class="message-box">${messageBody}</div>
            
            <p style="font-size: 13px; color: #9ca3af; margin-top: 20px; line-height: 1.5;">
              Si tienes dudas adicionales, puedes responder directamente a este correo electrónico o acceder a tu portal.
            </p>
          </div>
          <div class="footer">
            <div class="footer-note">
              Para agregar nuevos comentarios a este ticket, simplemente responde a este correo manteniendo el código de asunto intacto.
            </div>
            <p style="margin-top: 16px; margin-bottom: 0;">© 2026 CoreFlow Industrial Systems. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'CoreFlow Help Desk <soporte@soporte.ravicaribe.com>',
      to: [recipientEmail],
      subject,
      html,
    });

    if (emailError) throw emailError;

    console.log(`Email sent successfully to ${recipientEmail}. ID: ${emailData?.id}`);

    return new Response(JSON.stringify({ success: true, emailId: emailData?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Error in helpdesk-send-email function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
