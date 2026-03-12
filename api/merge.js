/* ============================================
   VOY — API Serverless: Fusión de PRs
   Merge open PRs to main via GitHub API
   ============================================ */

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  const GITHUB_TOKEN = process.env.VOY_GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'VOY_GITHUB_TOKEN no configurado' });
  }

  const REPO = 'sergiogaryf/voy';
  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'VOY-Dev-Panel',
  };

  const log = [];

  try {
    // 1. Obtener PRs abiertos
    log.push('Buscando PRs abiertos...');
    const prsRes = await fetch(`https://api.github.com/repos/${REPO}/pulls?state=open`, { headers });
    const prs = await prsRes.json();

    if (!Array.isArray(prs) || prs.length === 0) {
      log.push('No hay PRs abiertos para fusionar');
      return res.status(200).json({ success: true, merged: 0, log });
    }

    log.push(`Encontrados ${prs.length} PR(s) abiertos`);
    let merged = 0;
    const results = [];

    // 2. Intentar merge de cada PR
    for (const pr of prs) {
      log.push(`Fusionando PR #${pr.number}: ${pr.title}...`);
      try {
        const mergeRes = await fetch(
          `https://api.github.com/repos/${REPO}/pulls/${pr.number}/merge`,
          {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              commit_title: `Merge PR #${pr.number}: ${pr.title}`,
              merge_method: 'merge',
            }),
          }
        );
        const mergeData = await mergeRes.json();

        if (mergeRes.ok) {
          merged++;
          log.push(`PR #${pr.number} fusionado OK`);
          results.push({ pr: pr.number, title: pr.title, status: 'merged', sha: mergeData.sha });
        } else {
          log.push(`PR #${pr.number} error: ${mergeData.message || 'desconocido'}`);
          results.push({ pr: pr.number, title: pr.title, status: 'error', message: mergeData.message });
        }
      } catch (e) {
        log.push(`PR #${pr.number} excepcion: ${e.message}`);
        results.push({ pr: pr.number, title: pr.title, status: 'error', message: e.message });
      }
    }

    // 3. Trigger redeploy de voy-app-3 si hay deploy hook
    const DEPLOY_HOOK = process.env.VOY_DEPLOY_HOOK;
    if (DEPLOY_HOOK && merged > 0) {
      log.push('Triggering redeploy de voy-app-3...');
      try {
        const hookRes = await fetch(DEPLOY_HOOK, { method: 'POST' });
        if (hookRes.ok) {
          log.push('Redeploy iniciado');
        } else {
          log.push('Error al trigger redeploy');
        }
      } catch (e) {
        log.push(`Error redeploy: ${e.message}`);
      }
    }

    return res.status(200).json({ success: true, merged, total: prs.length, results, log });
  } catch (e) {
    log.push(`Error general: ${e.message}`);
    return res.status(500).json({ error: e.message, log });
  }
};
