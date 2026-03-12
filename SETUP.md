# VOY — Setup y Configuración

## Equipo

| Dev | GitHub | Deploy |
|---|---|---|
| Sergio | `sergiogaryf/voy` (repo principal) | `voy-app1.vercel.app` |
| Guillermo | Colaborador en el mismo repo | `voy-app-2.vercel.app` |

## Repositorios y servicios

- **GitHub (repo principal):** https://github.com/sergiogaryf/voy
- **Vercel Guillermo:** https://vercel.com/gglpro/voy-app
- **Airtable Base:** https://airtable.com/app6BzCBjniZqtXmd

## Clonar el proyecto

```bash
git clone https://github.com/sergiogaryf/voy.git voy-app
cd voy-app
```

## Variables de entorno en Vercel

El build script (`build.js`) requiere estas variables para generar `js/config.js` y copiar los archivos a `/public`:

| Variable | Descripción | Requerida |
|---|---|---|
| `VOY_AIRTABLE_TOKEN` | Token de API de Airtable (empieza con `pat...`) | Sí |
| `VOY_AIRTABLE_BASE` | ID de la base de Airtable (`app6BzCBjniZqtXmd`) | Sí |
| `VOY_ADMIN_PASSWORD` | Contraseña del panel admin (default: `voy2026`) | No |

### Cómo generar el token de Airtable

1. Ir a https://airtable.com/create/tokens
2. Crear nuevo token con scopes: `data.records:read`, `data.records:write`, `schema.bases:read`
3. Dar acceso a la base `app6BzCBjniZqtXmd`
4. Copiar el token generado

### Configurar en Vercel

1. Ir al proyecto en Vercel → **Settings** → **Environment Variables**
2. Agregar las 3 variables listadas arriba
3. Hacer **Redeploy** desde **Deployments** → menú del último deploy → **Redeploy**

## Cuentas de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Cliente | `sofia.mendoza@gmail.com` | `demo1234` |
| Profesional | `carlos.munoz@gmail.com` | `demo1234` |
| Admin | `admin@voy.cl` | `voy2026` |

## Flujo de desarrollo

### Ramas
```
main                         ← producción (no pushear directo)
├── guillermo/mi-feature     ← features de Guillermo
├── sergio/otra-feature      ← features de Sergio
```

### Proceso
1. Crear rama desde main: `git checkout -b guillermo/mi-feature origin/main`
2. Hacer cambios y commits
3. Push: `git push origin guillermo/mi-feature`
4. Crear Pull Request en GitHub
5. El otro dev revisa y aprueba
6. Merge a `main` → Vercel despliega automáticamente

### Panel de desarrollador
- Botón morado flotante (esquina inferior derecha) en todas las páginas
- Muestra: versión actual, autor, fecha, entorno
- Historial de versiones con changelog visual
- Acciones rápidas: navegar entre vistas, limpiar caché
- Al agregar features, actualizar el array `versions` en `js/dev-panel.js`

## Herramientas CLI configuradas

```bash
# Vercel (deploy)
vercel --prod --scope gglpro --yes

# GitHub (ya autenticado con token clásico)
git push origin mi-rama

# Servidor local
npx serve . -p 3000
```

## Dominios .cl disponibles (no registrados)

- `govoy.cl`
- `voypro.cl`
- `voyhome.cl`
- `voymarket.cl`
- `voy-app.cl`
- `voychile.cl`
- `voyservicios.cl`
- `miserviciovoy.cl`

Registrar en https://www.nic.cl (~$12.000 CLP/año)

## Protección de marca

1. **INAPI** — Registrar marca "VOY" (https://www.inapi.cl) — prioridad alta
2. **SpA** — Constituir sociedad en https://www.registrodeempresasysociedades.cl
3. **NIC Chile** — Registrar dominio .cl

## Estado actual

- Deploy en producción funcionando (2026-03-12)
- Stack: HTML/CSS/JS vanilla + Leaflet.js + Airtable como backend
- Build: `node build.js` copia archivos a `/public` y genera config con credenciales
- Panel de desarrollador activo
- Autocompletado en buscadores de cliente y admin
