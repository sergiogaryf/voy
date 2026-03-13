/* ============================================
   VOY — API: Upload de avatar/archivos
   Proxy server-side para Airtable Content API
   (evita problemas de CORS desde el navegador)
   ============================================ */

const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  const AIRTABLE_TOKEN = (process.env.VOY_AIRTABLE_TOKEN || '').trim();
  const BASE_ID = (process.env.VOY_AIRTABLE_BASE || '').trim();

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return res.status(500).json({ error: 'Variables de Airtable no configuradas' });
  }

  try {
    const { table, recordId, fieldId, fileName, fileBase64 } = req.body;

    if (!table || !recordId || !fieldId || !fileBase64) {
      return res.status(400).json({ error: 'Faltan campos: table, recordId, fieldId, fileBase64' });
    }

    // Convertir base64 a buffer
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Detectar content type
    const contentType = fileBase64.match(/^data:([^;]+);/)?.[1] || 'image/jpeg';
    const name = fileName || 'avatar.jpg';

    // Construir multipart form manualmente
    const boundary = '----VoyUpload' + Date.now();
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${contentType}\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    // Upload a Airtable Content API
    const uploadUrl = `/v0/${BASE_ID}/${recordId}/${fieldId}/uploadAttachment`;

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'content.airtable.com',
        path: uploadUrl,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      };

      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', c => data += c);
        response.on('end', () => {
          try {
            resolve({ status: response.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: response.statusCode, data: { raw: data } });
          }
        });
      });

      request.on('error', reject);
      request.write(body);
      request.end();
    });

    if (result.status !== 200) {
      return res.status(result.status).json({
        error: 'Airtable upload failed',
        detail: result.data,
      });
    }

    // Obtener URL del attachment
    const attachments = result.data.attachments || [];
    const avatarUrl = attachments[0]?.thumbnails?.large?.url || attachments[0]?.url || null;

    // Guardar URL en campo Avatar del registro
    if (avatarUrl) {
      const patchUrl = `https://api.airtable.com/v0/${BASE_ID}/${table}/${recordId}`;
      await new Promise((resolve, reject) => {
        const patchBody = JSON.stringify({ fields: { Avatar: avatarUrl } });
        const patchOpts = {
          hostname: 'api.airtable.com',
          path: `/v0/${BASE_ID}/${table}/${recordId}`,
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(patchBody),
          },
        };
        const r = https.request(patchOpts, (response) => {
          let d = '';
          response.on('data', c => d += c);
          response.on('end', () => resolve(d));
        });
        r.on('error', reject);
        r.write(patchBody);
        r.end();
      });
    }

    return res.status(200).json({ success: true, url: avatarUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
