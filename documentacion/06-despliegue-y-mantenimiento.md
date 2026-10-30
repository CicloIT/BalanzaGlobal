# 06 — Despliegue y mantenimiento

## Servidor actual (Daytona)

- URL: `https://3000-0aa84ebe-d5e1-4f41-831c-2ab887d976f2.proxy.daytona.works/`
- Repo en `/root/BalanzaGlobal`, backend en pm2 con el nombre `balanza`.
- `Backend/.env` con `LOCALIDAD_ID=` vacío.
- Acceso por consola: SSH con token generado en Daytona (revocarlo después de usarlo).
- **Después de reiniciar el container:** `cd /root/BalanzaGlobal && ./arrancar.sh` (doc 11). Para el build sin quedarse sin RAM, ver doc 11.

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

## Mudanza a un VPS

No hay que tocar código: el frontend usa el mismo origen (`API_BASE_URL` vacío), el WebSocket
del navegador se arma con `window.location.host`, el backend escucha en `0.0.0.0:$PORT` y la
cookie de sesión solo se marca `secure` si la petición llega por HTTPS. Cambian `.env`, base,
archivos y la URL `central` de cada agente.

Hay dos variantes según lo que dé el VPS:

| | **A. IP + puerto** (sin dominio) | **B. Dominio + HTTPS** (recomendada) |
|---|---|---|
| URL de la app | `http://IP:PUERTO` | `https://balanza.empresa.com` |
| `central` del agente | `ws://IP:PUERTO/agent` | `wss://balanza.empresa.com/agent` |
| Puerto abierto | el del backend (`PORT`) | 443 y 80 (el 3000 queda cerrado) |
| nginx | no hace falta | sí, con WebSocket ([DESPLIEGUE.md](../Agente/DESPLIEGUE.md#1-central-vps)) |
| Cifrado | **ninguno** | TLS |

> **Variante A solo para pruebas.** Sin TLS, la contraseña del login, la cookie de sesión, los
> tokens Bearer de los agentes y los pesos viajan en texto plano. Para producción usar B: alcanza
> con un dominio gratuito (DuckDNS o similar) + certbot. Pasar de A a B después solo cambia
> `ws://` por `wss://` en los `sitios/*.json`.

### 1. En Daytona: respaldar todo

```bash
cd /root/BalanzaGlobal
B=~/mudanza_$(date +%Y%m%d_%H%M%S); mkdir -p $B
pg_dump -Fc --no-owner --no-privileges -h 127.0.0.1 -U postgres -d <DB_NAME> -f $B/balanza.dump
cp -a Backend/src/documentos $B/documentos   # PDFs (no versionados)
cp -a Backend/capturas $B/capturas           # fotos del NVR (no versionadas)
cp Backend/.env $B/env.daytona               # referencia: SESSION_SECRET, VALIDAR_PESO_*, etc.
tar czf ~/mudanza.tgz -C $B .
```
Bajar `mudanza.tgz` y subirlo al VPS (scp).

### 2. En el VPS: instalar

```bash
# Node 18+, PostgreSQL, git, pm2 (npm i -g pm2)
git clone <repo> /opt/balanza && cd /opt/balanza
cd Backend && npm ci && cd ../Frontend && npm ci && npm run build && cd ..

mkdir -p ~/mudanza && tar xzf ~/mudanza.tgz -C ~/mudanza
cp -a ~/mudanza/documentos Backend/src/documentos
cp -a ~/mudanza/capturas   Backend/capturas
```

### 3. Base de datos

```bash
createdb balanzaglobal
pg_restore --no-owner --no-privileges -d balanzaglobal ~/mudanza/balanza.dump
# Las migraciones son idempotentes: correrlas por si el dump es anterior a alguna
psql -v ON_ERROR_STOP=1 -d balanzaglobal -f migration_localidad_maestros.sql
psql -v ON_ERROR_STOP=1 -d balanzaglobal -f migration_empresa_scope.sql
psql -v ON_ERROR_STOP=1 -d balanzaglobal -f migration_agente.sql
```
Si en vez de migrar se arranca con base vacía: `schema.sql` + datos iniciales (doc 02), y los
**tokens de agente hay que generarlos de nuevo** (paso 6).

### 4. `Backend/.env`

Partir de `~/mudanza/env.daytona` y ajustar:
```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=balanzaglobal
DB_USER=...
DB_PASSWORD=...
PORT=3000            # variante A: el puerto que da el VPS
LOCALIDAD_ID=        # vacío en el central
SESSION_SECRET=...   # copiar el de Daytona o generar uno nuevo (cierra las sesiones abiertas)
```

### 5. Arrancar y abrir el puerto

```bash
cd /opt/balanza/Backend
pm2 start src/server.js --name balanza --cwd /opt/balanza/Backend
pm2 save && pm2 startup
```
- **Variante A:** abrir `PORT` en el firewall del VPS (`ufw allow <PORT>/tcp` y el panel del proveedor).
- **Variante B:** nginx + certbot según [DESPLIEGUE.md](../Agente/DESPLIEGUE.md#1-central-vps), abrir 80/443.

Comprobar: `curl http://127.0.0.1:<PORT>/api/health` y `node scripts/smoke_scope.mjs <url>`.

### 6. Agentes de cada sitio

En la PC de cada sitio, editar su `Agente/sitios/<sitio>.json`:
```json
"central": "ws://IP:PUERTO/agent"
```
(o `wss://<dominio>/agent` en la variante B). Quitar `headers` si tenía el `x-daytona-preview-token`.
Reiniciar el agente y verificar en *Dispositivos* / `GET /api/health` que la balanza figure `agente_online`.

- Con la base migrada, los tokens siguen valiendo.
- Con base nueva: *Dispositivos → Generar token* para cada balanza y pegarlo en el json.
- En *Dispositivos*, el texto de ejemplo para el agente ya sale con el host nuevo.

### 7. Lo que no se muda solo

- **Cámaras/NVR:** el central se conecta directo a la IP del NVR. Desde el VPS no llega a la LAN
  del sitio, así que las fotos quedan vacías hasta que el agente haga de puente (pendiente, doc 07)
  o se agregue VPN / port forwarding al NVR.
- **Respaldos programados y `PG_DUMP_PATH`:** revisar que `pg_dump` del VPS sea de la misma versión
  mayor que PostgreSQL.
- Actualizar la URL de la sección *Servidor actual* de este documento y apagar Daytona cuando
  todo funcione.

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
