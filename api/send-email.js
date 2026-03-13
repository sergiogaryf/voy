/* ============================================
   VOY — API: Envío de emails
   Usa Resend SDK — gratis 100 emails/día
   Env var requerida: VOY_RESEND_KEY
   ============================================ */

const { Resend } = require('resend');

/* ── Layout base para todos los emails ─── */
function emailLayout(content, accentColor) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

  <!-- Header con logo -->
  <tr>
    <td style="padding:32px 40px 24px;border-bottom:3px solid ${accentColor};">
      <table width="100%"><tr>
        <td>
          <div style="display:inline-block;background:${accentColor};color:white;font-size:28px;font-weight:900;padding:8px 20px;border-radius:10px;letter-spacing:2px;">VOY</div>
        </td>
        <td align="right" style="font-size:12px;color:#9ca3af;">
          Quinta Región, Chile
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- Contenido -->
  <tr>
    <td style="padding:32px 40px;">
      ${content}
    </td>
  </tr>

  <!-- Despedida -->
  <tr>
    <td style="padding:0 40px 32px;">
      <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
        Atento,<br>
        <strong style="color:#111827;">Equipo Soporte VOY</strong>
      </p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#111827;padding:24px 40px;border-radius:0 0 16px 16px;">
      <table width="100%"><tr>
        <td>
          <div style="display:inline-block;background:${accentColor};color:white;font-size:16px;font-weight:900;padding:4px 12px;border-radius:6px;letter-spacing:1px;">VOY</div>
          <span style="color:#9ca3af;font-size:12px;margin-left:12px;">Servicios a un VOY de distancia</span>
        </td>
      </tr>
      <tr>
        <td style="padding-top:12px;">
          <span style="color:#6b7280;font-size:11px;">© 2026 VOY SpA · Quinta Región, Chile</span>
          <span style="float:right;">
            <a href="https://voy-app-2.vercel.app" style="color:${accentColor};font-size:11px;text-decoration:none;">voy-app.cl</a>
          </span>
        </td>
      </tr></table>
    </td>
  </tr>

</table>
</td></tr></table>
</body></html>`;
}

function makeButton(text, url, color) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="background:${color};color:white;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">${text}</a>
  </div>`;
}

function infoBox(bgColor, borderColor, label, value) {
  return `<div style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:16px;margin:20px 0;">
    <p style="margin:0 0 4px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">${label}</p>
    <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${value}</p>
  </div>`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  const RESEND_KEY = (process.env.VOY_RESEND_KEY || '').trim();
  if (!RESEND_KEY) {
    return res.status(500).json({ error: 'VOY_RESEND_KEY no configurado' });
  }

  const resend = new Resend(RESEND_KEY);

  try {
    const { to, type, name, specialty, description, clientEmail } = req.body;

    if (!to || !type) {
      return res.status(400).json({ error: 'Faltan campos: to, type' });
    }

    const GREEN  = '#059669';
    const PURPLE = '#7c3aed';
    const BLUE   = '#0EA5E9';
    const AMBER  = '#D97706';
    const VIOLET = '#8B5CF6';

    const templates = {

      welcome: {
        subject: '¡Bienvenido a VOY! 🎉',
        color: GREEN,
        html: emailLayout(`
          <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">¡Hola ${name || ''}! 👋</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Tu cuenta ha sido creada exitosamente.</p>

          <p style="font-size:15px;color:#374151;line-height:1.7;">
            Ya eres parte de <strong>VOY</strong>, la plataforma de servicios locales de la Quinta Región.
            Conecta con los mejores especialistas cerca de ti.
          </p>

          ${infoBox('#ecfdf5', '#a7f3d0', 'Tu cuenta', `📧 ${to}`)}

          ${makeButton('Ingresar a VOY', 'https://voy-app-2.vercel.app/login', GREEN)}

          <p style="font-size:13px;color:#9ca3af;text-align:center;">
            Si no creaste esta cuenta, puedes ignorar este email.
          </p>
        `, GREEN),
      },

      booking_confirmed: {
        subject: '✅ ¡Reserva confirmada en VOY!',
        color: GREEN,
        html: emailLayout(`
          <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">¡Reserva confirmada! ✅</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Tu servicio ha sido agendado exitosamente.</p>

          <p style="font-size:15px;color:#374151;line-height:1.7;">
            Hola <strong>${name || ''}</strong>, tu especialista ya fue notificado y confirmó tu solicitud.
            Revisa los detalles en tu panel.
          </p>

          ${infoBox('#ecfdf5', '#a7f3d0', 'Estado', '🟢 Confirmado — El especialista está en camino')}

          ${makeButton('Ver mis servicios', 'https://voy-app-2.vercel.app/client', GREEN)}
        `, GREEN),
      },

      new_request: {
        subject: '📋 Nueva solicitud de servicio en VOY',
        color: BLUE,
        html: emailLayout(`
          <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Nueva solicitud 📋</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Tienes una nueva solicitud de servicio.</p>

          <p style="font-size:15px;color:#374151;line-height:1.7;">
            Hola <strong>${name || ''}</strong>, un cliente cercano necesita tus servicios.
            Revisa y responde desde tu panel de especialista.
          </p>

          ${infoBox('#e0f2fe', '#7dd3fc', 'Acción requerida', '⏳ Acepta o rechaza la solicitud')}

          ${makeButton('Ver solicitudes', 'https://voy-app-2.vercel.app/worker', BLUE)}
        `, BLUE),
      },

      specialty_request: {
        subject: '🔍 Solicitud de nueva especialidad en VOY',
        color: AMBER,
        html: emailLayout(`
          <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Nueva solicitud de especialidad</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Un cliente busca un especialista que no existe en la plataforma.</p>

          ${infoBox('#fef3c7', '#fde68a', 'Especialidad solicitada', `🔍 ${specialty || 'No especificada'}`)}

          ${description ? `<div style="background:#f9fafb;border-radius:10px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 4px;font-weight:600;font-size:12px;text-transform:uppercase;color:#6b7280;">Descripción</p>
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${description}</p>
          </div>` : ''}

          <table width="100%" style="margin:16px 0;font-size:14px;color:#374151;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;"><strong>Cliente:</strong></td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${name || 'Anónimo'}</td></tr>
            <tr><td style="padding:8px 0;"><strong>Email:</strong></td><td style="padding:8px 0;">${clientEmail || 'No proporcionado'}</td></tr>
          </table>

          ${makeButton('Ir al panel admin', 'https://voy-app-2.vercel.app/admin', AMBER)}
        `, AMBER),
      },

      new_specialty: {
        subject: '🆕 Nuevo especialista con categoría personalizada',
        color: VIOLET,
        html: emailLayout(`
          <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Nuevo especialista registrado</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Se registró con una categoría que no existe en la plataforma.</p>

          ${infoBox('#ede9fe', '#c4b5fd', 'Especialidad sugerida', `🆕 ${specialty || 'Otro'}`)}

          <table width="100%" style="margin:16px 0;font-size:14px;color:#374151;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;"><strong>Especialista:</strong></td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${name || ''}</td></tr>
            <tr><td style="padding:8px 0;"><strong>Email:</strong></td><td style="padding:8px 0;">${clientEmail || 'No proporcionado'}</td></tr>
          </table>

          ${makeButton('Revisar en admin', 'https://voy-app-2.vercel.app/admin', VIOLET)}
        `, VIOLET),
      },
    };

    const template = templates[type];
    if (!template) {
      return res.status(400).json({ error: `Tipo no válido: ${type}. Usa: ${Object.keys(templates).join(', ')}` });
    }

    const recipients = ['specialty_request', 'new_specialty'].includes(type)
      ? [to, 'sergiogaryf@gmail.com'].filter(Boolean)
      : [to];

    const { data, error } = await resend.emails.send({
      from: 'VOY <onboarding@resend.dev>',
      to: recipients,
      subject: template.subject,
      html: template.html,
    });

    if (error) {
      return res.status(400).json({ error: 'Resend error', detail: error });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
