# 06 — Despliegue y mantenimiento

## Servidor actual (Daytona)

- URL: `https://3000-0aa84ebe-d5e1-4f41-831c-2ab887d976f2.proxy.daytona.works/`
- Repo en `/root/BalanzaGlobal`, backend en pm2 con el nombre `balanza`.
- `Backend/.env` con `LOCALIDAD_ID=` vacío.
- Acceso por consola: SSH con token generado en Daytona (revocarlo después de usarlo).

## Actualizar el servidor

```bash
cd /root/BalanzaGlobal

# 1. Respaldar los PDF (no están en git)
B=~/documentos_backup_$(date +%Y%m%d_%H%M%S)
cp -a Backend/src/documentos $B

# 2. Traer cambios
git status                 # si hay cambios locales inesperados, revisar antes
git pull --ff-only

# 3. Verificar los PDF (restaurar si faltan)
mkdir -p Backend/src/documentos && cp -an $B/. Backend/src/documentos/

# 4. Si cambió el frontend
cd Frontend && npm run build && cd ..

# 5. Si cambió el backend (o package.json: antes `cd Backend && npm ci`)
pm2 restart balanza --update-env
pm2 logs balanza --lines 30 --nostream

# 6. Si hay migración nueva: correrla con psql (son idempotentes)
```

En el navegador: **Ctrl+Shift+R** para no quedarse con el frontend viejo en caché.

### Una sola vez: actualización de seguridad (sesiones y contraseñas)

Al desplegar por primera vez la versión con sesión en cookie:
```bash
cd /root/BalanzaGlobal/Backend
# 1. Clave de sesiones (si no existe)
grep -q '^SESSION_SECRET=' .env || echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
# 2. Hashear las contraseñas existentes (los usuarios siguen entrando igual)
node scripts/hashear_passwords.mjs
# 3. Build del frontend + reinicio
cd ../Frontend && npm run build && pm2 restart balanza --update-env
```
Todos los usuarios tienen que volver a iniciar sesión una vez.

> **Por qué el respaldo de PDF:** `Backend/src/documentos/` antes estaba versionado. En una copia
> del repo anterior a ese cambio, `git pull` borra esos archivos. Hoy ya están fuera de git y
> no debería volver a pasar, pero el respaldo es barato.

## Scripts (`Backend/scripts/`)

| Script | Uso |
|---|---|
| `agente_token.mjs` | `--listar`, generar token de una balanza, `--directo` |
| `hashear_passwords.mjs` | Pasa a hash las contraseñas en texto plano (idempotente) |
| `usuario_password.mjs` | `node scripts/usuario_password.mjs <usuario> <nueva>` |
| `sim_balanzas.mjs` | Simula conversores: `node scripts/sim_balanzas.mjs 4101:1000:camion 4102:5000:camion` (puerto:peso:modo; `camion` sube, queda estable ~8 s y baja) |
| `smoke_scope.mjs` | Prueba alcance, permisos, sesión y respaldos: `node scripts/smoke_scope.mjs [baseUrl]` (usa los usuarios del seed con `123456`) |
| `smoke_agentes.mjs` | Prueba dos agentes aislados: `node scripts/smoke_agentes.mjs <baseUrl> <tokenA> <tokenB>` |

## Probar sin hardware

```bash
node Backend/scripts/sim_balanzas.mjs 4101:1000:camion 4102:5000:camion
cd Backend && PORT=3100 LOCALIDAD_ID= node src/server.js
node Agente/src/index.js Agente/sitios/quines-local.json   # central: ws://localhost:3100/agent
```
En *Dispositivos*, la balanza en modo directo apunta a `127.0.0.1:4101`, o en modo agente con
ip/puerto `127.0.0.1:4102`.

## Qué revisar después de un cambio

1. `GET /api/health` → 200 y estado de cada balanza (`agente_online`, `lastWeight`).
2. `node Backend/scripts/smoke_scope.mjs <url>` → "Todo OK".
3. En la app: login, peso en vivo en *Nueva Pesada*, registrar una pesada, abrir el detalle,
   subir PDF, borrar una pesada de prueba, generar reporte, dashboard.
4. `pm2 logs balanza` sin errores nuevos.

## Diagnóstico rápido

| Síntoma | Dónde mirar |
|---|---|
| "Agente desconectado" | Log del agente en la PC del sitio; cierres `4401` token inválido, `4403` balanza inactiva, `4409` token duplicado |
| Agente conectado pero sin peso | `ECONNREFUSED` (conversor no en TCP Server :6000), `ECONNRESET` (otro cliente conectado), "sin tramas" (balanza, cable, baud) |
| 409 al registrar pesada | La balanza no marcó ese peso en los últimos 60 s: capturar de nuevo |
| 401 en la app / vuelve al login | Sesión vencida (12 h), backend reiniciado sin `SESSION_SECRET`, o usuario desactivado: volver a entrar |
| La app no muestra cambios | Falta `npm run build` o Ctrl+Shift+R |
| Fotos vacías | El central no llega a la IP del NVR, o credenciales/marca mal |
| `pg_dump` falla en respaldo | Definir `PG_DUMP_PATH` |

Más casos del agente y conversor: [Agente/DESPLIEGUE.md](../Agente/DESPLIEGUE.md#4-diagnóstico).
