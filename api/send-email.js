/* ============================================
   VOY — API: Envío de emails
   Usa Resend (resend.com) — gratis 100 emails/día
   Env var requerida: VOY_RESEND_KEY
   ============================================ */

const https = require('https');

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

  try {
    const { to, type, name } = req.body;

    if (!to || !type) {
      return res.status(400).json({ error: 'Faltan campos: to, type' });
    }

    const templates = {
      welcome: {
        subject: '¡Bienvenido a VOY! 🎉',
        html: `
          <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);padding:40px 30px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:32px;">VOY</h1>
              <p style="color:#ddd6fe;margin:8px 0 0;font-size:14px;">Servicios locales · Quinta Región</p>
            </div>
            <div style="padding:30px;">
              <h2 style="color:#111827;margin:0 0 16px;">¡Hola ${name || ''}! 👋</h2>
              <p style="color:#4b5563;line-height:1.6;font-size:15px;">
                Tu cuenta en <strong>VOY</strong> ha sido creada exitosamente.
                Ya puedes acceder a la plataforma y conectarte con los mejores profesionales de tu ciudad.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="https://voy-app-2.vercel.app/login"
                   style="background:#7c3aed;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
                  Ingresar a VOY
                </a>
              </div>
              <div style="background:#ede9fe;border-radius:10px;padding:16px;margin-top:20px;">
                <p style="margin:0;font-size:13px;color:#5b21b6;font-weight:600;">Tu cuenta:</p>
                <p style="margin:4px 0 0;font-size:13px;color:#4b5563;">📧 ${to}</p>
              </div>
            </div>
            <div style="padding:20px 30px;background:#f3f4f6;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                VOY — Servicios a un VOY de distancia<br>Quinta Región, Chile
              </p>
            </div>
          </div>`,
      },
      booking_confirmed: {
        subject: 'Reserva confirmada en VOY ✅',
        html: `
          <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#059669,#047857);padding:30px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:28px;">VOY</h1>
            </div>
            <div style="padding:30px;">
              <h2 style="color:#111827;">¡Reserva confirmada! ✅</h2>
              <p style="color:#4b5563;line-height:1.6;">
                Hola <strong>${name || ''}</strong>, tu servicio ha sido confirmado.
                Revisa los detalles en tu panel de VOY.
              </p>
              <div style="text-align:center;margin:24px 0;">
                <a href="https://voy-app-2.vercel.app/client"
                   style="background:#059669;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">
                  Ver mis servicios
                </a>
              </div>
            </div>
          </div>`,
      },
      new_request: {
        subject: 'Nueva solicitud de servicio en VOY 📋',
        html: `
          <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#0EA5E9,#0284c7);padding:30px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:28px;">VOY</h1>
            </div>
            <div style="padding:30px;">
              <h2 style="color:#111827;">Nueva solicitud 📋</h2>
              <p style="color:#4b5563;line-height:1.6;">
                Hola <strong>${name || ''}</strong>, tienes una nueva solicitud de servicio.
                Revisa y responde desde tu panel.
              </p>
              <div style="text-align:center;margin:24px 0;">
                <a href="https://voy-app-2.vercel.app/worker"
                   style="background:#0EA5E9;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">
                  Ver solicitudes
                </a>
              </div>
            </div>
          </div>`,
      },
    };

    const template = templates[type];
    if (!template) {
      return res.status(400).json({ error: `Tipo de email no válido: ${type}. Usa: ${Object.keys(templates).join(', ')}` });
    }

    // Enviar via Resend API
    const emailBody = JSON.stringify({
      from: 'VOY <onboarding@resend.dev>',
      to: [to],
      subject: template.subject,
      html: template.html,
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(emailBody),
        },
      };

      const r = https.request(options, (response) => {
        let data = '';
        response.on('data', c => data += c);
        response.on('end', () => {
          try { resolve({ status: response.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: response.statusCode, data: { raw: data } }); }
        });
      });
      r.on('error', reject);
      r.write(emailBody);
      r.end();
    });

    if (result.status >= 400) {
      return res.status(result.status).json({ error: 'Resend error', detail: result.data });
    }

    return res.status(200).json({ success: true, id: result.data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
