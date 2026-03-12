/* ============================================
   VOY — Build script
   Copia todo a /public y genera js/config.js
   Variables requeridas en Vercel:
     VOY_AIRTABLE_TOKEN
     VOY_AIRTABLE_BASE
     VOY_ADMIN_PASSWORD  (opcional, default: voy2026)
   ============================================ */

const fs   = require('fs');
const path = require('path');

const token    = process.env.VOY_AIRTABLE_TOKEN;
const baseId   = process.env.VOY_AIRTABLE_BASE;
const adminPwd = process.env.VOY_ADMIN_PASSWORD || 'voy2026';

if (!token || !baseId) {
  console.error('❌ Faltan variables de entorno: VOY_AIRTABLE_TOKEN y VOY_AIRTABLE_BASE');
  process.exit(1);
}

// Limpiar y crear directorio public/
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  fs.rmSync(publicDir, { recursive: true });
}
fs.mkdirSync(publicDir);

// Copiar directorios y archivos al output
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

const items = ['admin', 'client', 'css', 'js', 'login', 'worker', 'index.html'];
for (const item of items) {
  const src = path.join(__dirname, item);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(publicDir, item));
    console.log(`✅ Copiado: ${item}`);
  }
}

// Generar public/js/config.js (sobreescribe la copia vacía)
const config = `/* Generado automáticamente por build.js — no editar */
const VOY_CONFIG = {
  airtable: {
    token:  '${token}',
    baseId: '${baseId}',
  },
  admin: {
    email:    'admin@voy.cl',
    password: '${adminPwd}',
  },
};
`;

fs.mkdirSync(path.join(publicDir, 'js'), { recursive: true });
fs.writeFileSync(path.join(publicDir, 'js', 'config.js'), config);
console.log('✅ js/config.js generado con credenciales');

// Generar public/js/build-info.js con metadata del deploy
const { execSync } = require('child_process');
function git(cmd) { try { return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim(); } catch { return ''; } }

const buildInfo = {
  commit:    git('rev-parse --short HEAD'),
  branch:    process.env.VERCEL_GIT_COMMIT_REF || git('rev-parse --abbrev-ref HEAD'),
  author:    process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME || git('log -1 --format=%an'),
  message:   process.env.VERCEL_GIT_COMMIT_MESSAGE || git('log -1 --format=%s'),
  date:      new Date().toISOString(),
  env:       process.env.VERCEL_ENV || 'local',
  url:       process.env.VERCEL_URL || 'localhost',
  repo:      'sergiogaryf/voy',
};

fs.writeFileSync(
  path.join(publicDir, 'js', 'build-info.js'),
  `/* Generado por build.js — no editar */\nconst VOY_BUILD = ${JSON.stringify(buildInfo, null, 2)};\n`
);
console.log('✅ js/build-info.js generado con metadata del deploy');
console.log('✅ Build completado → directorio public/');
