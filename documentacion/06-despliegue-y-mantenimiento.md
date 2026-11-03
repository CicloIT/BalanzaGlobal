# 06 — Despliegue y mantenimiento

## Servidor actual (Daytona, en mudanza)

> Se está pasando a un servidor propio con Windows Server e IP pública (también se documenta la
> opción VPS): ver [Mudanza del servidor central](#mudanza-del-servidor-central).
> Los comandos de esta sección y de *Actualizar el servidor* son los de Daytona (Linux).

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

## Mudanza del servidor central

El central puede correr en dos tipos de máquina. Los pasos comunes están una sola vez y los
propios de cada opción, por separado:

| | **Servidor propio** | **VPS** |
|---|---|---|
| Qué es | Equipo nuestro con **Windows Server**, detrás de nuestro router, con IP pública | Máquina alquilada a un proveedor, normalmente **Linux** (Ubuntu/Debian) |
| Servicio del backend | NSSM (servicio de Windows) | pm2 |
| Dónde se abren los puertos | Firewall de Windows **y** redirección en el router | Firewall del sistema (`ufw`) **y** el panel del proveedor (firewall/security group) |
| HTTPS | Caddy (recomendado) o IIS + win-acme | nginx + certbot, o Caddy |
| Pasos | [Opción 1](#opción-1-servidor-propio-windows-server) | [Opción 2](#opción-2-vps-linux) |

No hay que tocar código en ninguno de los dos casos: el frontend usa el mismo origen
(`API_BASE_URL` vacío), el WebSocket del navegador se arma con `window.location.host`, el backend
escucha en `0.0.0.0:$PORT` y la cookie de sesión se marca `secure` cuando la petición llega por
HTTPS (directo o con `X-Forwarded-Proto: https` desde un proxy).

Las dos opciones pasan por las mismas dos etapas:

| | **A. IP pública + puerto** (arranque) | **B. Dominio + HTTPS** (producción) |
|---|---|---|
| URL de la app | `http://IP_PUBLICA:3000` | `https://balanza.empresa.com` |
| `central` del agente | `ws://IP_PUBLICA:3000/agent` | `wss://balanza.empresa.com/agent` |
| Puertos abiertos a internet | 3000 | 443 y 80 (el 3000 se cierra) |
| Proxy delante del backend | no | sí, con WebSocket |
| Cifrado | **ninguno** | TLS |

> **La etapa A es solo para pruebas.** Sin TLS, la contraseña del login, la cookie de sesión, los
> tokens Bearer de los agentes y los pesos viajan en texto plano. Pasar de A a B solo cambia
> `ws://` por `wss://` en los `sitios/*.json`.
>
> **El dominio o subdominio tiene que ser un registro A** (o CNAME) que apunte a la IP pública. Si
> es una *redirección HTTP* del proveedor de DNS, el navegador la sigue pero **el agente no**: se
> queda sin conectar. Mientras tanto, usar la IP pública directa.

### Puertos y firewall

**Servidor central** (igual en las dos opciones):

| Puerto | ¿Abrir a internet? | Para qué |
|---|---|---|
| `PORT` del backend (3000) | **Sí en la etapa A**, no en la B | Web, API, WebSocket del navegador (`/ws`) y de los agentes (`/agent`): todo por el mismo puerto |
| 443 | Sí en la etapa B | HTTPS/WSS a través del proxy |
| 80 | Sí en la etapa B | Validación y renovación del certificado (Let's Encrypt) |
| 5432 (PostgreSQL) | **Nunca** | Lo usa solo el backend en la misma máquina |
| Acceso remoto (3389 RDP en Windows, 22 SSH en Linux) | Solo lo necesario | RDP: no abierto a todo internet (limitar a IPs conocidas o VPN). SSH: con clave, sin contraseña |

**Dónde se abren:**

- **Servidor propio:** en el firewall de Windows y en el router (ver [Opción 1, paso 5](#5-arrancar-como-servicio-y-abrir-el-puerto)).
  El servidor necesita **IP fija en la LAN** (o reserva DHCP) para que la redirección no se rompa.
- **VPS:** en `ufw` y en el firewall del panel del proveedor (ver [Opción 2, paso 5](#5-arrancar-con-pm2-y-abrir-el-puerto)).
  No hay router: la IP pública es de la máquina.

Comprobar desde **afuera** de la red del servidor (datos del celular, por ejemplo):
`http://IP_PUBLICA:3000/api/health` → 200. En un servidor propio, desde adentro de su misma LAN
puede fallar aunque esté bien (muchos routers no hacen *NAT loopback*): ahí probar con la IP de la LAN.

**Sitios (El Mirador, Quines, …):** no se abre **nada** entrante, sea cual sea el central. El agente
inicia la conexión hacia el central; solo necesita salida a internet hacia el puerto del central
(3000 en la etapa A, 443 en la B). El conversor de la balanza (TCP 6000) y el NVR (HTTP 80 o el
puerto configurado) quedan solo en la LAN del sitio: los usa el agente.

> Si una balanza quedara en modo **directo** desde el central, el central tendría que llegar al
> conversor de ese sitio, lo que obliga a un port forward en el sitio o a una VPN. Evitarlo:
> en el central, todas las balanzas en modo **agente**.

### Paso 1 (las dos opciones): respaldar Daytona

Desde la app (*Respaldos*) o por consola:
```bash
cd /root/BalanzaGlobal
B=~/mudanza_$(date +%Y%m%d_%H%M%S); mkdir -p $B
pg_dump --no-owner --no-privileges -h 127.0.0.1 -U postgres -d <DB_NAME> -f $B/balanza.sql
cp -a Backend/src/documentos $B/documentos   # PDFs (no versionados)
cp -a Backend/capturas $B/capturas           # fotos del NVR (no versionadas)
cp Backend/.env $B/env.daytona               # referencia: VALIDAR_PESO_*, etc.
tar czf ~/mudanza.tgz -C $B .
```
Bajar `mudanza.tgz` y copiarlo al servidor nuevo (escritorio remoto en Windows, `scp` en un VPS).

## Opción 1: servidor propio (Windows Server)

### 2. Instalar

- [Node.js 22 LTS](https://nodejs.org), [PostgreSQL](https://www.postgresql.org/download/windows/),
  [Git](https://git-scm.com).
- Clonar y compilar:
  ```powershell
  git clone <repo> C:\Balanza
  cd C:\Balanza\Backend;  npm ci
  cd C:\Balanza\Frontend; npm ci; npm run build
  ```
- Descomprimir el respaldo y copiar `documentos\` a `C:\Balanza\Backend\src\documentos\` y
  `capturas\` a `C:\Balanza\Backend\capturas\`.

### 3. Base de datos

En CMD (`psql` está en `C:\Program Files\PostgreSQL\<versión>\bin\`):
```bat
createdb -U postgres balanzaglobal
psql -U postgres -v ON_ERROR_STOP=1 -d balanzaglobal -f balanza.sql
```
Las migraciones son idempotentes: si el respaldo es anterior a alguna, correrlas igual
(`psql ... -f migration_xxx.sql` desde la raíz del repo).
Si se arranca con base vacía: `schema.sql` + datos iniciales (doc 02), y los **tokens de agente hay
que generarlos de nuevo** ([Agentes](#agentes-de-cada-sitio-las-dos-opciones)).

### 4. `Backend\.env`

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=balanzaglobal
DB_USER=postgres
DB_PASSWORD=...
PORT=3000
LOCALIDAD_ID=                  # vacío en el central
SESSION_SECRET=...             # 64 hex; uno nuevo cierra las sesiones abiertas
PG_DUMP_PATH=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe
```
Generar `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### 5. Arrancar como servicio y abrir el puerto

Primero a mano, para ver errores: `cd C:\Balanza\Backend; node src\server.js`.
Después como **servicio de Windows** con [NSSM](https://nssm.cc) (arranca con el equipo, sin iniciar
sesión, se reinicia solo si se cae). En Windows no se usa pm2: no arranca solo con el equipo.
Cerrar antes las terminales de `node` / `vite` (el puerto tiene que estar libre) y, en PowerShell
**como administrador**:
```powershell
cd C:\Balanza
powershell -ExecutionPolicy Bypass -File .\servicio-windows.ps1
```
El script baja NSSM a `tools\nssm\` si no está, compila el frontend, crea/reconfigura el servicio
`balanza` (log en `Backend\logs\balanza.log`, rota cada 10 MB; depende del servicio de PostgreSQL),
y prueba `/api/health`. **No abre el puerto**: queda accesible solo desde el propio equipo
(`http://127.0.0.1:3000`). Para abrirlo en el firewall de Windows cuando haga falta:
`.\servicio-windows.ps1 -SinBuild -AbrirPuerto`. Se puede correr de nuevo sin problema.
Opciones: `-SinBuild`, `-AbrirPuerto`, `-Desinstalar`.

Manejo diario: `Restart-Service balanza`, `Stop-Service balanza`, `Get-Service balanza`,
`Get-Content C:\Balanza\Backend\logs\balanza.log -Tail 50 -Wait`.
Actualizar a una versión nueva: `.\actualizar-windows.ps1` (git pull + build si cambió el
frontend + reinicio si cambió el backend; las migraciones `.sql` se aplican a mano).

Abrir el puerto en **dos lugares**:

1. **Firewall de Windows** (PowerShell como administrador):
   ```powershell
   # Etapa A
   New-NetFirewallRule -DisplayName "Balanza 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   # Etapa B (después cerrar el 3000)
   New-NetFirewallRule -DisplayName "Balanza HTTPS" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow
   Remove-NetFirewallRule -DisplayName "Balanza 3000"
   ```
2. **Router:** redirección de puertos (port forwarding / NAT)
   `IP_PUBLICA:3000 → IP_LAN_DEL_SERVIDOR:3000` (en la etapa B, 80 y 443).

PostgreSQL: el instalador de Windows deja `pg_hba.conf` aceptando solo `127.0.0.1`, pero puede
crear una regla de firewall para el 5432. Revisar y borrarla si existe, y **no** redirigir el 5432
en el router:
```powershell
Get-NetFirewallPortFilter | Where-Object LocalPort -eq 5432 | Get-NetFirewallRule | Select DisplayName, Enabled, Direction
```

Comprobar: `http://127.0.0.1:3000/api/health`, después desde afuera con la IP pública, y
`node scripts/smoke_scope.mjs <url>`. Log: `C:\Balanza\Backend\logs\balanza.log`.

### 6. Etapa B: dominio + HTTPS con Caddy

[Caddy](https://caddyserver.com) es un solo `.exe`: saca y renueva el certificado de Let's Encrypt
solo, pasa WebSocket sin configuración extra y manda `X-Forwarded-Proto` (la cookie de sesión
queda `secure`).

1. El dominio como **registro A** → IP pública. Verificar con `nslookup balanza.empresa.com`.
2. Abrir 80 y 443 (firewall de Windows + router).
3. `C:\Caddy\Caddyfile`:
   ```
   balanza.empresa.com {
       reverse_proxy 127.0.0.1:3000
   }
   ```
4. Con script (recomendado), en PowerShell como administrador desde la carpeta del repo:
   - `.\caddy-windows.ps1` baja Caddy a `tools\caddy\`, escribe el `Caddyfile` (dominio por defecto
     `balanza.cicloit.com`, cambiar con `-Dominio`) y crea el servicio `caddy` **sin arrancarlo**.
   - Cuando el router ya mande 80 y 443 a este equipo: `.\caddy-windows.ps1 -Iniciar` (abre 80/443
     en el firewall de Windows, servicio automático, arranca y saca el certificado).
   - No usar `-Iniciar` antes de abrir los puertos: Let's Encrypt limita los intentos fallidos.
   - Log: `tools\caddy\logs\caddy.log`; certificados en `tools\caddy\data\`.
5. Entrar a `https://balanza.empresa.com`, pasar los agentes a `wss://balanza.empresa.com/agent`
   y **cerrar el 3000** (firewall y router).

Alternativa: IIS + ARR + win-acme. Funciona, pero hay que activar el *WebSocket Protocol* de IIS y
mandar `X-Forwarded-Proto: https` a mano; Caddy lo trae resuelto.

### 7. Respaldos

Programar un respaldo diario con el Programador de tareas (script en doc 10, *Respaldos*) y copiar
también `capturas\` y `documentos\` **fuera del servidor**: si se rompe el disco, se pierde todo.

## Opción 2: VPS (Linux)

### 2. Instalar

```bash
# Node 18+, PostgreSQL, git, pm2 (npm i -g pm2)
git clone <repo> /opt/balanza && cd /opt/balanza
cd Backend && npm ci && cd ../Frontend && npm ci && npm run build && cd ..

mkdir -p ~/mudanza && tar xzf ~/mudanza.tgz -C ~/mudanza
cp -a ~/mudanza/documentos Backend/src/documentos
cp -a ~/mudanza/capturas   Backend/capturas
```
Si el VPS tiene poca RAM (1 GB) y el `npm run build` se corta, compilar con
`NODE_OPTIONS=--max-old-space-size=512 npm run build`, o compilar en otra máquina y subir `Frontend/dist`.

### 3. Base de datos

```bash
sudo -u postgres createdb balanzaglobal
sudo -u postgres psql -v ON_ERROR_STOP=1 -d balanzaglobal -f ~/mudanza/balanza.sql
# Las migraciones son idempotentes: correrlas por si el respaldo es anterior a alguna
sudo -u postgres psql -v ON_ERROR_STOP=1 -d balanzaglobal -f migration_xxx.sql
```
Si se arranca con base vacía: `schema.sql` + datos iniciales (doc 02), y los **tokens de agente hay
que generarlos de nuevo** ([Agentes](#agentes-de-cada-sitio-las-dos-opciones)).

### 4. `Backend/.env`

Igual que en la opción 1 (partir de `~/mudanza/env.daytona`), salvo `PG_DUMP_PATH`, que en
Linux suele no hacer falta (`/usr/bin/pg_dump`).

### 5. Arrancar con pm2 y abrir el puerto

```bash
cd /opt/balanza/Backend
pm2 start src/server.js --name balanza --cwd /opt/balanza/Backend
pm2 save && pm2 startup
```

Abrir el puerto en **dos lugares**:

1. **Firewall del sistema:**
   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 3000/tcp          # etapa A
   # etapa B:
   sudo ufw allow 80,443/tcp && sudo ufw delete allow 3000/tcp
   sudo ufw enable && sudo ufw status
   ```
2. **Panel del proveedor:** si tiene firewall propio (security group, "Firewall" de la cuenta),
   agregar las mismas reglas. Si no se abre ahí, el puerto queda cerrado aunque `ufw` lo permita.

PostgreSQL en Linux escucha solo en `localhost` por defecto: no abrir el 5432.

Comprobar: `curl http://127.0.0.1:3000/api/health`, después desde afuera con la IP pública, y
`node scripts/smoke_scope.mjs <url>`. Log: `pm2 logs balanza`.

### 6. Etapa B: dominio + HTTPS

nginx + certbot según [DESPLIEGUE.md](../Agente/DESPLIEGUE.md#1-central-vps) (la config ya pasa
WebSocket y `X-Forwarded-Proto`), o Caddy con el mismo `Caddyfile` de la opción 1
(`sudo apt install caddy`, archivo en `/etc/caddy/Caddyfile`). Después pasar los agentes a
`wss://` y cerrar el 3000.

### 7. Respaldos

Igual que en la opción 1: `pg_dump` diario con `cron` y copiar `capturas/` y `documentos/` fuera
del VPS. `pg_dump` tiene que ser de la misma versión mayor que PostgreSQL.

## Agentes de cada sitio (las dos opciones)

En la PC de cada sitio, editar su `Agente/sitios/<sitio>.json`:
```json
"central": "ws://IP_PUBLICA:3000/agent"
```
(o `wss://<dominio>/agent` en la etapa B). Quitar `headers` si tenía el `x-daytona-preview-token`.
Reiniciar el agente y verificar en *Dispositivos* / `GET /api/health` que la balanza figure `agente_online`.

- Con la base migrada, los tokens siguen valiendo.
- Con base nueva: *Dispositivos → Generar token* para cada balanza y pegarlo en el json.
- El agente necesita la versión 0.2.0 o mayor para las cámaras (NVR por el agente).

Cuando todo funcione: actualizar la sección *Servidor actual* de este documento y **apagar Daytona**.

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
| Fotos vacías | Módulo de cámaras apagado en la localidad, agente < 0.2.0, el agente no llega a la IP del NVR, o credenciales/marca mal |
| `pg_dump` falla en respaldo | Definir `PG_DUMP_PATH` |

Más casos del agente y conversor: [Agente/DESPLIEGUE.md](../Agente/DESPLIEGUE.md#4-diagnóstico).
