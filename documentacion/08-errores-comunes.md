# 08 — Errores comunes y cómo solucionarlos

Los mensajes están escritos tal cual aparecen en pantalla o en los logs, así que se pueden buscar
con Ctrl+F. Dónde mirar los logs:

| Componente | Log |
|---|---|
| Backend (Daytona/VPS) | `pm2 logs balanza --lines 100` |
| Agente (PC del sitio) | La consola donde corre `node src/index.js ...`, o `pm2 logs agente` si corre como servicio |
| Navegador | F12 → pestaña *Console* y *Network* |

---

## 1. Login y sesión

| Mensaje / síntoma | Causa | Solución |
|---|---|---|
| `Usuario o contraseña incorrectos` | Contraseña mal, usuario inexistente o desactivado | Revisar mayúsculas y espacios. Resetear desde el servidor: `node scripts/usuario_password.mjs <usuario> <nueva>` |
| `No se pudo conectar con el servidor` | El backend no responde | `pm2 status` en el servidor; si está caído, `pm2 restart balanza` y mirar `pm2 logs balanza` |
| La app vuelve sola al login | Sesión vencida (12 h), usuario desactivado o se cambió el `SESSION_SECRET` | Volver a entrar. Si pasa cada vez que se reinicia el backend, falta `SESSION_SECRET` en `Backend/.env` |
| `Sesión inválida o vencida. Vuelva a iniciar sesión.` (401) | Igual que el anterior | Cerrar sesión y volver a entrar |
| `No autorizado. Se requiere autenticación.` (401) | El request llegó sin cookie de sesión. Pasa con scripts viejos que mandan `x-user-id`, o con el frontend servido desde otro dominio | Scripts: loguearse y mandar la cookie (ver `smoke_scope.mjs`). Frontend: servirlo desde el mismo dominio que la API |
| En el log del backend: `⚠️ SESSION_SECRET no definido en .env` | Falta la variable | Agregarla (ver doc 02) y `pm2 restart balanza --update-env` |
| `La contraseña debe tener al menos 6 caracteres` | Contraseña nueva muy corta | Usar 6 caracteres o más |
| `La contraseña actual no es correcta` | Al cambiar la propia contraseña se puso mal la actual | Reintentar o pedir un reset al superadmin |

## 2. Permisos

| Mensaje / síntoma | Causa | Solución |
|---|---|---|
| `No tiene permiso para realizar esta acción. Se requiere: <permiso>` (403) | El rol no tiene ese permiso | Ver la tabla de roles (doc 03). Si el rol debería tenerlo, cambiar **los dos** `rolesConfig.js` (backend y frontend) |
| Falta una pestaña del menú | El menú se arma con `Frontend/src/config/rolesConfig.js` | Igual que arriba; si se cambió el permiso, recompilar el frontend |
| `Solo disponible para administradores globales` (403) en Respaldos | El usuario tiene localidad asignada | Los respaldos son solo para el superadmin |
| `No tiene permiso para cargar peso manualmente.` | El rol del usuario no tiene `pesaje:manual` | Capturar el peso de la balanza, o que lo cargue el balancero o el superadmin |
| `Rol inválido: <rol>` | Se quiso crear un usuario con un rol que ya no existe (admin, gerente, subalancero) | Usar `superadmin`, `logistica` o `balancero` |
| `Solo un superadmin puede asignar el rol superadmin` | — | Solo un superadmin crea superadmins |

## 3. Pesadas

| Mensaje / síntoma | Causa | Solución |
|---|---|---|
| `La balanza no marcó X kg en los últimos 60 s. Vuelva a capturar el peso o cárguelo como manual.` (409) | El peso enviado no coincide con lo que leyó la balanza: se capturó hace más de 60 s, el camión se movió, o la balanza se desconectó | Esperar "PESO ESTABLE", tocar **Capturar peso** y registrar enseguida. Si la balanza está fuera de servicio, que un usuario con peso manual lo cargue a mano |
| No se puede registrar: pantalla dice "Agente desconectado" | El agente del sitio no está conectado al central | Ver la sección 4 |
| `dispositivo_id es requerido (balanza de la localidad)` | No hay balanza elegida, o la localidad no tiene balanza | Usuario global: elegir localidad y balanza. Si no hay, crearla en *Dispositivos* |
| `La balanza indicada no pertenece a su localidad` | El usuario intentó pesar con una balanza de otra localidad | Usar un usuario de esa localidad o elegir la balanza correcta |
| `El chofer/productor/producto/transporte no pertenece a la localidad de la balanza` | Se eligió un catálogo de otra localidad | Elegir uno de la localidad (o crearlo ahí) |
| `Faltan campos requeridos (patente, sentido, peso)` | Formulario incompleto | Completar patente, sentido y peso |
| `El peso debe ser positivo` | Peso 0 o negativo | Capturar con el camión arriba de la balanza |
| `Esta operación ya tiene ambas pesadas registradas` | La patente ya tiene BRUTO y TARA y la operación no se cerró | Revisar la operación en *Pesadas*. Si quedó abierta por error, borrarla y volver a pesar |
| La segunda pesada crea otra operación en vez de completar la primera | La patente se escribió distinto (espacios, guion) o fue en otra localidad | Escribir la patente igual que en la primera pesada |
| Error al borrar una pesada | La operación es de otra localidad, o ya se borró | Refrescar la lista |
| `No se envió ningún archivo PDF` / `Error subiendo el PDF` | No se eligió un archivo o no es PDF | Solo se aceptan PDF |
| `Nro de contenedor es obligatorio` | Datos de contenedor sin número | Completar el número |

## 4. Balanza y agente

Primero mirar **Configuración → Dispositivos** (estado del agente) y el log del agente.

| Mensaje en el log del agente | Causa | Solución |
|---|---|---|
| `📴 desconectado del central (4401 ...)` / `Token de agente inválido` | Token mal copiado, regenerado o revocado | Generar un token nuevo en *Dispositivos*, pegarlo en `sitios/<sitio>.json` y reiniciar el agente |
| `📴 desconectado del central (4403 ...)` / `Balanza no habilitada en este servidor` | Balanza inactiva, o el central tiene `LOCALIDAD_ID` con otra localidad | Activar la balanza; en el central dejar `LOCALIDAD_ID=` vacío |
| `📴 desconectado del central (4409 ...)` en loop | **Dos agentes con el mismo token** (por ejemplo, dos archivos de sitio iguales o el agente corriendo dos veces) | Dejar uno solo. Revisar con `pm2 list` / el Administrador de tareas que no haya otro `node` corriendo |
| `❌ el central respondió HTTP 4xx al abrir el WebSocket` | URL `central` mal, falta `/agent`, o el proxy no deja pasar WebSocket | Revisar `"central": "wss://<dominio>/agent"`. Con nginx/Cloudflare, habilitar WebSocket (DESPLIEGUE.md) |
| `↻ reintentando conexión al central en N s` | Sin internet o central caído | Esperar; reconecta solo. Si sigue, revisar internet del sitio y `pm2 status` en el central |
| `No se pudo leer la config sitios/x.json` | Ruta mal o JSON con error de sintaxis | Revisar el nombre del archivo y validar el JSON (comas, comillas) |
| `⚠️ balanzas[0]: "ip"/"puerto" se ignoran...` | El JSON del sitio todavía tiene ip/puerto | Es solo un aviso. Sacar esos campos; la IP se carga en *Dispositivos* |

| Mensaje en el log del agente (lado balanza) | Causa | Solución |
|---|---|---|
| `error balanza: ECONNREFUSED` | El conversor no está en TCP Server, puerto equivocado, o IP mal en *Dispositivos* | Panel del conversor: TCP Server, puerto 6000. Revisar IP/puerto en *Dispositivos* |
| `error balanza: ECONNRESET` repetido | Otro programa está conectado al conversor (acepta un solo cliente) | Cerrar PuTTY, monitores TCP u otro agente |
| `error balanza: ETIMEDOUT` / `EHOSTUNREACH` | La PC no llega a la IP del conversor | Misma red, IP fija del conversor, `ping <ip>` desde la PC del sitio |
| `⚠️ sin tramas de la balanza hace 5 s` | Conectado al conversor pero no llegan datos válidos | Balanza apagada, cable RS232, baudios o flow control distintos (115200 8N1, sin flow control) |
| Llegan solo bytes `0x00` | Configuración serie distinta o mala señal | Igualar parámetros serie; revisar cable y masa (GND) |
| El peso se ve pero nunca dice "PESO ESTABLE" | El peso varía constantemente (viento, camión en movimiento, balanza sin calibrar) | Esperar a que el camión quede quieto; revisar la balanza |

| En el log del backend | Causa | Solución |
|---|---|---|
| `❌ [balanza N · loc L] error de conexión: connect ECONNREFUSED 127.0.0.x:80` en loop | Balanza en **modo directo** con una IP que el central no alcanza (o de prueba) | Pasarla a modo agente, desactivarla, o corregir la IP |
| `🛰️ [balanza N] en modo agente; esperando conexión del agente` | Normal: el central espera al agente | Arrancar el agente en el sitio |

## 5. Dispositivos

| Mensaje | Causa | Solución |
|---|---|---|
| `IP inválida (formato IPv4, ej: 192.168.1.50)` | IP mal escrita | Formato `192.168.x.y`, sin `http://` ni puerto |
| `Puerto inválido (1-65535)` | Puerto vacío o fuera de rango | Normalmente `6000` |
| `Debe indicar localidad_id` | Usuario global sin localidad elegida | Elegir la localidad arriba de la pantalla |
| Se perdió el token y no se puede volver a ver | Se muestra una sola vez | **Generar token** de nuevo y actualizar el JSON del sitio (el viejo deja de servir) |

## 6. Catálogos y base de datos

Estos errores salen como texto de PostgreSQL:

| Mensaje | Causa | Solución |
|---|---|---|
| `llave duplicada viola restricción de unicidad «uq_<tabla>_codigo_loc»` / `«uq_<tabla>_nombre_loc»` | Ya existe ese código o nombre en la localidad. **También cuenta si el registro está desactivado** | Usar otro código/nombre, o reactivar el existente (los borrados son lógicos) |
| `llave duplicada ... «uq_vehiculo_patente_loc»` | Patente ya cargada en la localidad | Buscarla en *Vehículos* (también entre inactivos) |
| `la sintaxis de entrada no es válida para el enum tipo_vehiculo_enum` | Tipo de vehículo que no existe | Usar uno de la lista: CHASIS, SEMI_REMOLQUE, FURGON, CAMION_TANQUE, CHASIS_ACOPLADO, JAULA_DOBLE, BATEA, OTRO |
| `viola la llave foránea «fk_operacion_vehiculo_loc»` | Se pesó una patente que no está dada de alta como vehículo en esa localidad | Crear el vehículo primero (el formulario de pesada normalmente lo hace solo) |
| `Patente y tipo_vehiculo son requeridos` | Alta de vehículo incompleta | Completar ambos |
| `Debe indicar localidad_id` al crear un catálogo | Los catálogos son por localidad | Elegir la localidad antes de crear |

## 7. Archivos, fotos y respaldos

| Mensaje / síntoma | Causa | Solución |
|---|---|---|
| PDF o foto da 401 | Sesión vencida | Volver a iniciar sesión |
| PDF da 404 después de un `git pull` | El pull borró `Backend/src/documentos/` (copia vieja del repo) | Restaurar del respaldo `~/documentos_backup_*` o de un `.zip` de respaldo (carpeta `documentos/`) |
| Fotos vacías / `sin_camaras` | El central no llega a la IP del NVR, o usuario/clave/marca mal | Revisar *Dispositivos → Grabadora*. Con el central en internet y el NVR en la LAN, las fotos no funcionan todavía (pendiente) |
| `Error al exportar base de datos` al hacer respaldo | `pg_dump` no encontrado o credenciales mal | Definir `PG_DUMP_PATH` en `.env`; revisar `DB_*` |
| `Nombre de archivo inválido` al descargar respaldo | Nombre con `..` o `/` | Descargar desde la lista de la vista |

## 8. Servidor y despliegue

| Mensaje / síntoma | Causa | Solución |
|---|---|---|
| La app no muestra los cambios nuevos | Falta compilar el frontend o el navegador usa la versión en caché | `cd Frontend && npm run build`, después Ctrl+Shift+R |
| `Frontend no disponible` | No existe `Frontend/dist` | `cd Frontend && npm run build` |
| `Ruta no encontrada` (404) en `/api/...` | Endpoint que no existe (o se eliminó, ej. `/api/tickets`) | Revisar la ruta |
| `Error interno del servidor` (500) | Error no previsto | Ver `pm2 logs balanza` para el detalle |
| `git pull` dice `Your local changes would be overwritten` | Hay cambios hechos a mano en el servidor | `git status` para ver qué es. Si es `Frontend/package-lock.json`, `git checkout -- Frontend/package-lock.json` y repetir el pull |
| `Error: Cannot find module ...` al arrancar | Faltan dependencias después de un cambio de `package.json` | `cd Backend && npm ci` (o `Frontend`), después reiniciar |
| `EADDRINUSE: address already in use :::3000` | Ya hay otro backend en ese puerto | `pm2 list`; no arrancar `node src/server.js` a mano si pm2 ya lo corre |
| `password authentication failed for user` / `ECONNREFUSED 127.0.0.1:5432` | Datos de la base mal o PostgreSQL apagado | Revisar `DB_*` en `.env`; arrancar PostgreSQL |
| `psql: invalid command \restrict` al cargar `schema.sql` | psql viejo con un dump de pg_dump 18 | Borrar las líneas `\restrict` / `\unrestrict` del archivo |

## Si nada de esto aplica

1. `GET /api/health` (en el navegador: `https://<dominio>/api/health`): muestra si la base responde y
   el estado de cada balanza (`agente_online`, `lastWeight`, `error`).
2. `pm2 logs balanza --lines 200` en el central.
3. El log del agente en el sitio.
4. F12 en el navegador → *Network*: el request que falla y su respuesta.
