# 02 — Instalación y configuración

## Requisitos

- Node 18 o superior.
- PostgreSQL (desarrollo con la 18). `pg_dump` accesible para los respaldos.
- pm2 en el servidor central (`npm i -g pm2`).

## Variables de entorno (`Backend/.env`)

| Variable | Obligatoria | Qué hace |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Sí | Conexión a PostgreSQL |
| `SESSION_SECRET` | **Sí** | Clave que firma las sesiones (ver abajo cómo generarla). Si falta, se genera una al arrancar y cada reinicio cierra todas las sesiones. Cambiarla también cierra todas |
| `SESSION_TTL_HORAS` | No (12) | Duración de la sesión |
| `PORT` | No (3000) | Puerto del backend |
| `LOCALIDAD_ID` | No | **Vacío en el central.** Con un id, el servidor solo conecta las balanzas de esa localidad |
| `VALIDAR_PESO_BALANZA` | No (`true`) | `false` desactiva la validación del peso contra la balanza |
| `PESO_MAX_EDAD_MS` | No (60000) | Antigüedad máxima de la lectura que respalda una pesada automática |
| `PESO_TOLERANCIA_KG` | No (0) | Diferencia permitida entre el peso enviado y el leído |
| `PG_DUMP_PATH` | No | Ruta de `pg_dump` si no se encuentra sola |

Ejemplo:
```env
DB_USER=postgres
DB_PASSWORD=...
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=balanzaglobal
PORT=3000
LOCALIDAD_ID=
SESSION_SECRET=<64 caracteres hex>
```

Generar `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

El frontend acepta `VITE_API_URL` al compilar (vacío = mismo origen, que es lo normal).

## Base de datos

**Instalación nueva:** `schema.sql` (raíz del repo) tiene el esquema completo actual, sin datos.
```bash
createdb balanzaglobal
psql -v ON_ERROR_STOP=1 -d balanzaglobal -f schema.sql
```
Después cargar empresa, localidades y usuarios (o restaurar un `database.sql` de un respaldo).

Al agregar una migración nueva, **regenerar `schema.sql`**:
```bash
pg_dump --schema-only --no-owner --no-privileges -d balanzaglobal -f schema.sql
```
y borrar las líneas `\restrict` / `\unrestrict` que agrega pg_dump 18 (un psql más viejo no las entiende).

**Base existente:** aplicar las migraciones en este orden (todas son idempotentes):
```bash
psql -v ON_ERROR_STOP=1 -d balanzaglobal -f migration_localidad_maestros.sql
psql -v ON_ERROR_STOP=1 -d balanzaglobal -f migration_empresa_scope.sql
psql -v ON_ERROR_STOP=1 -d balanzaglobal -f migration_agente.sql
```

Datos iniciales (opcionales):
- `seed_localidades.sql`: localidades de ejemplo.
- `seed_usuarios.sql`: un usuario por rol y localidad, **todos con contraseña `123456`**.
  Las inserta en texto plano; después correr `node Backend/scripts/hashear_passwords.mjs`
  (igual se hashean solas en el primer login). Cambiarlas antes de usar en serio.

## Desarrollo local

```bash
# Backend
cd Backend
npm install
node src/server.js                 # o: LOCALIDAD_ID= node src/server.js

# Frontend (otra consola)
cd Frontend
npm install
npm run dev                        # http://localhost:5173, proxy de /api, /ws, /capturas, /documentos a :3000
```

Sin balanza física: `node Backend/scripts/sim_balanzas.mjs 4101:1000:camion` y cargar la balanza
en *Dispositivos* como `127.0.0.1:4101` (modo directo). Ver doc 06.

## Producción (central)

```bash
cd Frontend && npm ci && npm run build        # genera Frontend/dist, lo sirve el backend
cd ../Backend && npm ci
pm2 start src/server.js --name balanza --cwd /ruta/Balanza/Backend
pm2 save && pm2 startup
```

- El backend sirve todo en un solo puerto (frontend, API, WebSockets, archivos).
- Detrás de nginx con HTTPS y soporte WebSocket: configuración en
  [Agente/DESPLIEGUE.md](../Agente/DESPLIEGUE.md#nginx-proxy-con-websocket).
- Exponer solo 443 (y 80 para el certificado), no el 3000.
