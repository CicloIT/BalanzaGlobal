# 10 — Instalación local por sitio

Alternativa al servidor central (Daytona o VPS, doc 06): **una PC por localidad** con todo el sistema
adentro. Cada sitio funciona solo, sin internet, pero **los datos no se comparten**.

No requiere cambios de código: `LOCALIDAD_ID` en el `.env` limita el servidor a las balanzas de
esa localidad, y balanza y NVR se conectan en modo **directo** (están en la misma LAN).

```
El Mirador (PC local)         Quines (PC local)            La Sarita (PC local)
 Postgres + backend + front    Postgres + backend + front   Postgres + backend + front
 LOCALIDAD_ID=1                LOCALIDAD_ID=2               LOCALIDAD_ID=3
   │ LAN                         │ LAN                        │ LAN
 balanza + NVR                 balanza + NVR                balanza + NVR
```

## Antes de decidir

| Se gana | Se pierde / hay que cuidar |
|---|---|
| Funciona sin internet ni Daytona | **Logística no ve todo junto**: cada sitio tiene sus datos; para ver uno hay que entrar a esa PC |
| No hace falta el agente ni tokens | **Respaldos**: todo queda en un solo disco por sitio (ver [Respaldos](#7-respaldos)) |
| Balanza y NVR por LAN, sin VPN | La PC tiene que estar **siempre prendida** (conviene UPS) y no usarse para otra cosa pesada |
| | **Cada actualización se despliega 3 veces**, una por PC |
| | Volver a centralizar después requiere unir bases (ver [Rangos de IDs](#4-rangos-de-ids-obligatorio)) |

## Requisitos de la PC

- Windows 10/11 (o Linux), 4 GB de RAM mínimo (8 GB recomendado), 20 GB libres.
- **IP fija en la LAN** (reserva DHCP en el router o IP manual), para que las otras PCs del sitio entren siempre a la misma dirección.
- Que llegue por red al conversor de la balanza (ej. `192.168.52.102:6000`) y al NVR.
- Software: [Node.js 22 LTS](https://nodejs.org), [PostgreSQL](https://www.postgresql.org/download/windows/) (misma versión mayor en todos los sitios), [Git](https://git-scm.com).

## Pasos (en cada PC)

### 1. Código

```powershell
cd C:\
git clone <url-del-repo> Balanza
cd C:\Balanza\Frontend; npm ci; npm run build
cd C:\Balanza\Backend;  npm ci
```

### 2. Base de datos

Se parte de un **dump de la base actual** (central) y se deja solo la localidad del sitio. Así se
conservan empresa, provincias, usuarios, dispositivos y catálogos ya cargados.

En el central:
```bash
pg_dump -Fc --no-owner --no-privileges -d balanzaglobal -f balanza.dump
```

En la PC del sitio (PowerShell; ajustar la ruta a la versión instalada de PostgreSQL):
```powershell
$pg = "C:\Program Files\PostgreSQL\18\bin"
& "$pg\createdb.exe" -U postgres balanzaglobal
& "$pg\pg_restore.exe" -U postgres --no-owner --no-privileges -d balanzaglobal balanza.dump
```

Si se arranca con base vacía: `schema.sql` + datos iniciales (doc 02).

### 3. Dejar solo la localidad del sitio

Guardar como `solo_localidad.sql` y correrlo con el id del sitio (`-v loc=1` para El Mirador,
`2` Quines, `3` La Sarita; ver `SELECT id, nombre FROM localidad`):

```sql
\set ON_ERROR_STOP 1
BEGIN;
-- Operaciones y pesadas de otras localidades (pesada cae por ON DELETE CASCADE)
DELETE FROM ticket_operacion WHERE operacion_id IN (SELECT id FROM operacion_pesaje WHERE localidad_id <> :loc);
DELETE FROM ticket_old WHERE pesada_id IN (SELECT p.id FROM pesada p JOIN operacion_pesaje o ON o.id = p.operacion_id WHERE o.localidad_id <> :loc);
DELETE FROM operacion_pesaje WHERE localidad_id <> :loc;
DELETE FROM ticket  WHERE localidad_id <> :loc;
DELETE FROM reporte WHERE localidad_id <> :loc;
-- Catálogos y dispositivos de otras localidades
DELETE FROM chofer     WHERE localidad_id <> :loc;
DELETE FROM vehiculo   WHERE localidad_id <> :loc;
DELETE FROM producto   WHERE localidad_id <> :loc;
DELETE FROM productor  WHERE localidad_id <> :loc;
DELETE FROM transporte WHERE localidad_id <> :loc;
DELETE FROM configuracion_dispositivos WHERE localidad_id <> :loc;
-- Usuarios de otras localidades: desactivar (superadmin y logística quedan)
UPDATE usuario SET activo = false WHERE localidad_id IS NOT NULL AND localidad_id <> :loc;
COMMIT;
```
```powershell
& "$pg\psql.exe" -U postgres -d balanzaglobal -v loc=1 -f solo_localidad.sql
```
Las filas de `localidad` de los otros sitios se pueden dejar (no molestan).

### 4. Rangos de IDs (obligatorio)

Cada base numera sus registros por su cuenta: dos sitios generarían la pesada `id = 1`, `2`, ...
Si algún día se vuelve a un central, unir bases con IDs repetidos es muy trabajoso. Se evita
**una sola vez, al crear la base**, dando a cada sitio su rango:

| Sitio | `inicio` |
|---|---|
| El Mirador (1) | 1000000 |
| Quines (2) | 2000000 |
| La Sarita (3) | 3000000 |

```sql
-- correr con: psql -U postgres -d balanzaglobal -v inicio=1000000 -f rangos_ids.sql
\set ON_ERROR_STOP 1
SELECT setval('chofer_id_seq',           GREATEST(:inicio, (SELECT COALESCE(max(id), 0) + 1 FROM chofer)), false);
SELECT setval('vehiculo_id_seq',         GREATEST(:inicio, (SELECT COALESCE(max(id), 0) + 1 FROM vehiculo)), false);
SELECT setval('producto_id_seq',         GREATEST(:inicio, (SELECT COALESCE(max(id), 0) + 1 FROM producto)), false);
SELECT setval('productor_id_seq',        GREATEST(:inicio, (SELECT COALESCE(max(id), 0) + 1 FROM productor)), false);
SELECT setval('transporte_id_seq',       GREATEST(:inicio, (SELECT COALESCE(max(id), 0) + 1 FROM transporte)), false);
SELECT setval('operacion_pesaje_id_seq', GREATEST(:inicio, (SELECT COALESCE(max(id), 0) + 1 FROM operacion_pesaje)), false);
SELECT setval('pesada_id_seq',           GREATEST(:inicio, (SELECT COALESCE(max(id), 0) + 1 FROM pesada)), false);
SELECT setval('reporte_id_seq',          GREATEST(:inicio, (SELECT COALESCE(max(id), 0) + 1 FROM reporte)), false);
```
Empresa, provincia, localidad, usuario y dispositivos **no** se tocan: son los mismos en todos los
sitios (vienen del dump). Si se crea un usuario nuevo en un sitio, crearlo también en los demás
con el mismo nombre, o tenerlo en cuenta al unir.

### 5. `Backend/.env`

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=balanzaglobal
DB_USER=postgres
DB_PASSWORD=<la del Postgres de esta PC>
PORT=3000
LOCALIDAD_ID=1                 # el id de ESTE sitio
SESSION_SECRET=<64 caracteres hex, distinto en cada sitio>
PG_DUMP_PATH=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe
```
Generar `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### 6. Dispositivos y arranque

1. Arrancar a mano la primera vez: `cd C:\Balanza\Backend; node src/server.js`.
2. Entrar con superadmin a `http://localhost:3000` → *Configuración → Dispositivos*:
   - Balanza: modo **directo**, IP y puerto del conversor en la LAN (ej. `192.168.52.102` / `6000`).
   - Grabadora: IP del NVR en la LAN; *Probar cámaras*.
   - Si el sitio tiene cámaras: activar el módulo de cámaras de la localidad.
3. Si había un agente corriendo en esa PC o en otra del sitio, **detenerlo**: el conversor acepta un solo cliente TCP.
4. Dejar el backend como **servicio de Windows** (arranca con la PC, sin iniciar sesión), con [NSSM](https://nssm.cc):
   ```powershell
   nssm install balanza "C:\Program Files\nodejs\node.exe" src\server.js
   nssm set balanza AppDirectory C:\Balanza\Backend
   nssm set balanza AppStdout C:\Balanza\Backend\logs\balanza.log
   nssm set balanza AppStderr C:\Balanza\Backend\logs\balanza.log
   nssm start balanza
   ```
   PostgreSQL ya queda como servicio al instalarlo.
5. Abrir el puerto en el firewall de Windows para la LAN:
   ```powershell
   New-NetFirewallRule -DisplayName "Balanza 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Domain
   ```
6. Desde otra PC del sitio: `http://<IP fija>:3000`.

Comprobar: `node scripts/smoke_scope.mjs http://localhost:3000` (con usuarios de prueba) o hacer una pesada de prueba.

### 7. Respaldos

Con una sola PC por sitio, **un disco roto = datos perdidos**. Mínimo:

- **Diario automático** con el Programador de tareas de Windows, a una carpeta que se copie fuera
  de la PC (pendrive, NAS, carpeta sincronizada con la nube):
  ```powershell
  # respaldo.ps1
  $env:PGPASSWORD = "<password>"
  $f = "D:\respaldos\balanza_$(Get-Date -Format yyyyMMdd).dump"
  & "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -Fc -d balanzaglobal -f $f
  Get-ChildItem D:\respaldos\*.dump | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item
  ```
- Copiar también `Backend\capturas\` (fotos) y `Backend\src\documentos\` (PDF): no están en la base.
- El respaldo desde la app (*Respaldos*, solo superadmin) sigue funcionando, pero es manual.

## Actualizar un sitio

```powershell
cd C:\Balanza
git pull
cd Frontend; npm ci; npm run build      # si cambió el frontend
cd ..\Backend; npm ci                   # si cambió package.json
# si hay migración nueva: & "$pg\psql.exe" -U postgres -d balanzaglobal -f ..\migration_xxx.sql
nssm restart balanza
```
Repetir en los tres sitios. Antes del `git pull`, respaldar `Backend\src\documentos\` (doc 06).

## Volver a un central más adelante

Con los rangos de IDs del paso 4, las pesadas, operaciones y catálogos de cada sitio no chocan:
se pueden exportar de cada base (`pg_dump --data-only -t ...` filtrando por localidad) y cargar
en el central. Los usuarios y dispositivos ya son los mismos en todas. Después, cada sitio vuelve
a modo agente (doc 04) y se apagan los backends locales.
