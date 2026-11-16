# 12 — Servidor propio por localidad (v2, pesa sin internet)

Cada localidad puede tener **su propio servidor** (backend + PostgreSQL + frontend) en la PC donde
antes corría el agente. Los balanceros trabajan **siempre** contra ese servidor, en la LAN: si se
corta internet se sigue pesando igual. Todo lo que se carga se **replica al central** cuando hay
conexión, y el central sigue siendo el lugar para superadmin y logística (todas las localidades,
reportes, administración).

A diferencia del doc 10 (sitios aislados), acá los datos **sí** llegan al central.

```
            Central (MODO=central)  ←── superadmin / logística
              ▲ wss://…/sitio  (saliente desde cada sitio, token por localidad)
     ┌────────┴─────────┬──────────────────┐
 Quines (MODO=sitio)  La Sarita (sitio)   El Mirador (sin servidor propio:
  Postgres+backend     Postgres+backend    sigue contra el central, con o sin agente)
   │ LAN               │ LAN
 balanza + NVR       balanza + NVR
```

Se puede pasar de a una localidad: las que no tienen servidor propio funcionan exactamente como antes.

## Quién manda sobre cada dato

| Dueño | Datos | Viaja |
|---|---|---|
| **Sitio** | operaciones, pesadas, choferes, vehículos, productos, productores, transportes, reportes, pedidos de borrado, capturas y PDF | sitio → central |
| **Central** | provincias, empresa, localidades, usuarios (con su contraseña), dispositivos | central → sitio |

- Cada dato se escribe en **un solo lugar**: no hay conflictos que resolver.
- En el sitio no se administran usuarios, localidades ni dispositivos (responde *"Esto se administra
  desde el servidor central"*). Los cambios hechos en el central llegan al sitio en segundos.
- **Superadmin desde el central** (aprobar un borrado, invertir una operación, editar un catálogo de
  una localidad con servidor propio): el central **reenvía** el pedido al sitio, que lo ejecuta y
  devuelve el cambio. Si el sitio está sin conexión responde *"El servidor de la localidad está sin
  conexión; reintente cuando vuelva"* (no se encola).
- El central **no carga pesadas** de una localidad con servidor propio (el peso lo valida la balanza
  del sitio).
- **Cambiar la contraseña** desde el sitio requiere conexión (se hace en el central).

## Cómo funciona (técnico)

- `MODO=sitio` en `Backend/.env` (ver `Backend/src/config/modo.js`). Sin `MODO`, el servidor es central.
- **Subida**: un trigger guarda cada cambio de las tablas del sitio en `sync_outbox`; el sitio los
  manda en orden por `/sitio` y el central los aplica (upsert/borrado idempotente, solo filas de esa
  localidad). Con el ACK se borran del outbox. Capturas y PDF se copian según lo que referencian las pesadas.
- **Bajada**: al conectar, y cada vez que cambia algo, el central manda un *snapshot* de sus tablas
  para esa localidad. Así el login funciona sin internet.
- **IDs**: los ids que genera un sitio están en el rango `localidad_id × 10.000.000` (Quines = 2 →
  20.000.000 a 29.999.999). El central queda limitado a 9.999.999. No hay choques entre sitios.
- **Numeración de reportes**: por localidad (cada una arranca de su último número).
- **Peso en vivo**: el sitio reenvía su balanza al central; el dashboard de logística la sigue viendo.
- **Primera conexión**: el sitio baja solo todos los datos de su localidad (bootstrap), activa su
  outbox y avisa al central. Desde ese momento el central marca la localidad con servidor propio.

Archivos: `Backend/src/services/sitioGateway.js` (central), `sitioSync.js` (sitio),
`services/sync/` (canal, réplica, RPC), `middleware/sitio.js`, `migration_v2_sitio.sql`.

## Instalar el servidor de una localidad

Requisitos en la PC del sitio: Windows, Node.js LTS, PostgreSQL, git (o el zip del repo).
La PC tiene que llegar a la balanza y al NVR por la LAN (ya pasaba con el agente).

1. **Central actualizado** con esta versión y `migration_v2_sitio.sql` aplicada con psql
   (`actualizar-app.ps1` avisa que cambió ese `.sql`; aplicarla antes de seguir).
2. **Token**: en el central, superadmin → Administración → Localidades → *Servidores propios* →
   **Generar token** en la localidad. Se muestra una sola vez junto con las líneas del `.env`.
   (Alternativa por consola en el central: `node scripts/sitio_token.mjs <localidadId>`.)
3. **Base del sitio**, vacía, con el esquema completo:
   ```
   psql -U postgres -c "CREATE DATABASE balanzaglobal"
   psql -U postgres -d balanzaglobal -f schema.sql
   ```
4. **`Backend\.env`** del sitio: como el del central (DB_*, PORT, `SESSION_SECRET` propio), y
   `1-instalar-app.ps1` agrega lo del sitio:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\1-instalar-app.ps1 -LocalidadId 2 -Central wss://<central>/sitio
   ```
   Pide el token por teclado y escribe `MODO=sitio`, `LOCALIDAD_ID`, `CENTRAL_URL`, `SITIO_TOKEN`.
   Usar la misma URL que usaban los agentes, cambiando `/agent` por `/sitio`.
5. Al arrancar, el servicio se conecta y **baja los datos** de la localidad. En el central la
   localidad pasa a *Servidor propio · conectado*.
6. **Agente**: ya no hace falta en esa PC. Desinstalarlo:
   `powershell -ExecutionPolicy Bypass -File .\Agente\instalar-agente.ps1 -Desinstalar`.
   La balanza en el sitio se conecta directo (ip/puerto de la vista Dispositivos del central).
7. Los balanceros entran a `http://<IP-de-la-PC-del-sitio>:<PORT>` desde la LAN.

Actualizar un sitio: igual que el central (`actualizar-app.ps1`). **Central y sitios tienen que
tener la misma versión de sincronización**: si no, el central rechaza la conexión con
*"Versión de sincronización incompatible"* y el sitio sigue pesando hasta que se actualice.

## Estado y problemas

| Dónde | Qué se ve |
|---|---|
| Sitio, arriba de todo | *Sin conexión con el servidor central* + cantidad de cambios guardados. Informativo: se sigue pesando |
| Sitio | *El servidor central no aceptó algunos cambios*: el central rechazó un lote (ver mensaje). El outbox queda frenado en ese cambio hasta corregirlo |
| Central → Localidades | Por localidad: conectado / sin conexión, última sincronización, versión y nombre de la PC |
| API | `GET /api/sitio/estado` (en sitio: pendientes, último error; en central: estado de cada sitio) |

- **Token rechazado** (log del sitio *"Token de sitio rechazado"*): se regeneró o revocó; cargar el nuevo en `SITIO_TOKEN` y reiniciar.
- **"El token es de la localidad X pero LOCALIDAD_ID=Y"**: el `.env` no coincide; la sincronización se detiene hasta corregirlo.
- **Volver una localidad al central**: Localidades → *Volver al central*. Lo que el sitio no haya
  enviado queda solo en el sitio: antes, verificar que no tenga pendientes.

## Pruebas

`Backend/scripts/smoke_sitio.mjs` levanta central y sitio en la PC de desarrollo y prueba bootstrap,
pesadas con y sin internet, reportes, reenvío desde el central, borrado aprobado, inversión, usuario
nuevo, sitio caído y reenvíos duplicados (instrucciones en el encabezado del script).
