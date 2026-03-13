/* ============================================
   VOY — API de Envío de Emails (Vercel Serverless)
   Soporta múltiples templates + notificaciones admin
   ============================================ */

const ADMINS = ['guillermogonzalezleon@gmail.com', 'sergiogaryf@gmail.com'];

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    to, template, name, baseUrl,
    workerName, clientName, service, price, bookingId,
    // Quotation fields
    laborTotal, materialsTotal, subtotal, commission, grandTotal, quoteId,
  } = req.body;

  if (!to || !template) {
    return res.status(400).json({ error: 'Missing required fields: to, template' });
  }

  const siteUrl = baseUrl || 'https://voy-app-2.vercel.app';
  const emailData = buildEmail(template, {
    to, name, siteUrl, workerName, clientName, service, price, bookingId,
    laborTotal, materialsTotal, subtotal, commission, grandTotal, quoteId,
  });

  if (!emailData) {
    return res.status(400).json({ error: `Unknown template: ${template}` });
  }

  // Determine recipients: admin templates go to admins too
  let recipients = [to];
  if (template.startsWith('admin_') || template === 'new_quotation' || template === 'quotation_accepted' || template === 'quotation_rejected') {
    recipients = [...new Set([to, ...ADMINS])];
  }

  try {
    // Use Resend API
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('[send-email] No RESEND_API_KEY, simulating send to:', recipients);
      return res.status(200).json({ success: true, simulated: true, recipients });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'VOY <noreply@voy.cl>',
        to: recipients,
        subject: emailData.subject,
        html: emailData.html,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('[send-email] Resend error:', result);
      return res.status(500).json({ error: 'Email send failed', detail: result });
    }

    return res.status(200).json({ success: true, id: result.id, recipients });
  } catch (err) {
    console.error('[send-email] Error:', err);
    return res.status(500).json({ error: err.message });
  }
};

/* ── Template builder ─────────────────────── */
function buildEmail(template, data) {
  const { siteUrl, name, workerName, clientName, service, price, bookingId,
          laborTotal, materialsTotal, subtotal, commission, grandTotal, quoteId } = data;
  const templates = {

    // ── Welcome ──────────────────────────
    welcome: {
      subject: '¡Bienvenido a VOY!',
      html: wrapEmail('¡Bienvenido a VOY!', '#2563eb', `
        <h2 style="color:#1e293b;margin:0 0 8px;">¡Hola ${name || 'Usuario'}!</h2>
        <p style="color:#64748b;font-size:15px;">Tu cuenta ha sido creada exitosamente. Ya puedes empezar a usar VOY para conectar con servicios locales en la Quinta Región.</p>
        <a href="${siteUrl}/login/" style="display:inline-block;padding:12px 28px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-weight:700;margin-top:16px;">Ingresar a VOY</a>
      `),
    },

    // ── Admin: Nueva reserva ─────────────
    admin_new_booking: {
      subject: `[VOY] Nueva reserva: ${service || 'Servicio'}`,
      html: wrapEmail('Nueva Reserva', '#2563eb', `
        <h2 style="color:#1e293b;margin:0 0 8px;">Nueva Reserva Creada</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Cliente</td><td style="padding:8px;font-weight:600;">${clientName || '-'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Profesional</td><td style="padding:8px;font-weight:600;">${workerName || '-'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Servicio</td><td style="padding:8px;font-weight:600;">${service || '-'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Precio</td><td style="padding:8px;font-weight:600;">${formatCLP(price)}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Ref.</td><td style="padding:8px;font-weight:600;">${bookingId || '-'}</td></tr>
        </table>
        <a href="${siteUrl}/admin/" style="display:inline-block;padding:12px 28px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-weight:700;">Ver en Admin</a>
      `),
    },

    // ── Admin: Solicitud aceptada ────────
    admin_request_accepted: {
      subject: `[VOY] Solicitud aceptada: ${service || 'Servicio'}`,
      html: wrapEmail('Solicitud Aceptada', '#059669', `
        <h2 style="color:#059669;margin:0 0 8px;">Solicitud Aceptada</h2>
        <p style="color:#64748b;font-size:15px;"><strong>${workerName || 'Profesional'}</strong> aceptó la solicitud de <strong>${clientName || 'Cliente'}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Servicio</td><td style="padding:8px;font-weight:600;">${service || '-'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Precio</td><td style="padding:8px;font-weight:600;">${formatCLP(price)}</td></tr>
        </table>
        <a href="${siteUrl}/admin/" style="display:inline-block;padding:12px 28px;background:#059669;color:white;text-decoration:none;border-radius:8px;font-weight:700;">Ver en Admin</a>
      `),
    },

    // ── Admin: Solicitud rechazada ───────
    admin_request_rejected: {
      subject: `[VOY] Solicitud rechazada: ${service || 'Servicio'}`,
      html: wrapEmail('Solicitud Rechazada', '#dc2626', `
        <h2 style="color:#dc2626;margin:0 0 8px;">Solicitud Rechazada</h2>
        <p style="color:#64748b;font-size:15px;"><strong>${workerName || 'Profesional'}</strong> rechazó la solicitud de <strong>${clientName || 'Cliente'}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Servicio</td><td style="padding:8px;font-weight:600;">${service || '-'}</td></tr>
        </table>
      `),
    },

    // ── Admin: Trabajo completado ────────
    admin_job_completed: {
      subject: `[VOY] Trabajo completado: ${service || 'Servicio'}`,
      html: wrapEmail('Trabajo Completado', '#059669', `
        <h2 style="color:#059669;margin:0 0 8px;">Trabajo Completado</h2>
        <p style="color:#64748b;font-size:15px;"><strong>${workerName || 'Profesional'}</strong> completó el trabajo para <strong>${clientName || 'Cliente'}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Servicio</td><td style="padding:8px;font-weight:600;">${service || '-'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Precio</td><td style="padding:8px;font-weight:600;">${formatCLP(price)}</td></tr>
        </table>
        <a href="${siteUrl}/admin/" style="display:inline-block;padding:12px 28px;background:#059669;color:white;text-decoration:none;border-radius:8px;font-weight:700;">Ver en Admin</a>
      `),
    },

    // ── Admin: Reserva cancelada ─────────
    admin_booking_cancelled: {
      subject: `[VOY] Reserva cancelada: ${service || 'Servicio'}`,
      html: wrapEmail('Reserva Cancelada', '#dc2626', `
        <h2 style="color:#dc2626;margin:0 0 8px;">Reserva Cancelada</h2>
        <p style="color:#64748b;font-size:15px;"><strong>${clientName || 'Cliente'}</strong> canceló la reserva.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Servicio</td><td style="padding:8px;font-weight:600;">${service || '-'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Profesional</td><td style="padding:8px;font-weight:600;">${workerName || '-'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Ref.</td><td style="padding:8px;font-weight:600;">${bookingId || '-'}</td></tr>
        </table>
      `),
    },

    // ── Cotización: Nueva ────────────────
    new_quotation: {
      subject: `[VOY] Nueva cotización de ${workerName || 'Profesional'}`,
      html: wrapEmail('Nueva Cotización', '#4f46e5', `
        <h2 style="color:#4f46e5;margin:0 0 8px;">Nueva Cotización Recibida</h2>
        <p style="color:#64748b;font-size:15px;"><strong>${workerName || 'Profesional'}</strong> te ha enviado una cotización para <strong>${service || 'servicio'}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Mano de obra</td><td style="padding:8px;font-weight:600;">${formatCLP(laborTotal)}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Materiales</td><td style="padding:8px;font-weight:600;">${formatCLP(materialsTotal)}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Subtotal</td><td style="padding:8px;font-weight:600;">${formatCLP(subtotal)}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Comisión VOY</td><td style="padding:8px;font-weight:600;">${formatCLP(commission)}</td></tr>
          <tr style="background:#f0f0ff;"><td style="padding:10px;color:#4f46e5;font-weight:700;">TOTAL</td><td style="padding:10px;font-weight:800;color:#4f46e5;font-size:18px;">${formatCLP(grandTotal)}</td></tr>
        </table>
        <a href="${siteUrl}/client/" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:700;">Ver Cotización</a>
      `),
    },

    // ── Cotización: Aceptada ─────────────
    quotation_accepted: {
      subject: `[VOY] Cotización aceptada: ${service || 'Servicio'}`,
      html: wrapEmail('Cotización Aceptada', '#059669', `
        <h2 style="color:#059669;margin:0 0 8px;">Cotización Aceptada</h2>
        <p style="color:#64748b;font-size:15px;"><strong>${clientName || 'Cliente'}</strong> aceptó la cotización de <strong>${workerName || 'Profesional'}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Servicio</td><td style="padding:8px;font-weight:600;">${service || '-'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Total</td><td style="padding:8px;font-weight:600;">${formatCLP(grandTotal)}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Ref.</td><td style="padding:8px;font-weight:600;">${quoteId || '-'}</td></tr>
        </table>
        <a href="${siteUrl}/worker/" style="display:inline-block;padding:12px 28px;background:#059669;color:white;text-decoration:none;border-radius:8px;font-weight:700;">Ver en Panel</a>
      `),
    },

    // ── Cotización: Rechazada ────────────
    quotation_rejected: {
      subject: `[VOY] Cotización rechazada: ${service || 'Servicio'}`,
      html: wrapEmail('Cotización Rechazada', '#dc2626', `
        <h2 style="color:#dc2626;margin:0 0 8px;">Cotización Rechazada</h2>
        <p style="color:#64748b;font-size:15px;"><strong>${clientName || 'Cliente'}</strong> rechazó la cotización de <strong>${workerName || 'Profesional'}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Servicio</td><td style="padding:8px;font-weight:600;">${service || '-'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Ref.</td><td style="padding:8px;font-weight:600;">${quoteId || '-'}</td></tr>
        </table>
      `),
    },
  };

  return templates[template] || null;
}

/* ── Email wrapper ────────────────────────── */
function wrapEmail(title, accentColor, bodyHtml) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <div style="background:${accentColor};padding:24px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:900;letter-spacing:-0.5px;">VOY</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">${title}</p>
    </div>
    <div style="padding:32px;">
      ${bodyHtml}
    </div>
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">VOY SpA — Quinta Región, Chile</p>
    </div>
  </div>
</body></html>`;
}

function formatCLP(amount) {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
}
