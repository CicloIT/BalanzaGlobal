# 04 — Balanzas, agentes y cámaras

Todo se configura en **Configuración → Dispositivos**. Un usuario global elige primero la
localidad. Solo admin y superadmin entran a esta pantalla.

## Balanza

Datos por balanza: **IP y puerto del conversor dentro de la LAN del sitio** y modo de conexión.

### Modo agente (lo normal con central en internet)

1. En la vista, cargar IP/puerto del conversor (ej. `192.168.52.103:6000`) y **Generar token**.
   - El token se muestra **una sola vez** junto con el JSON listo para el sitio. Guardarlo.
   - **Regenerar** invalida el anterior y desconecta al agente que lo usaba.
   - **Pasar a modo directo** revoca el token.
2. En la PC del sitio, crear `Agente/sitios/<sitio>.json`:
   ```json
   {
     "sitio": "Quines",
     "central": "wss://<dominio>/agent",
     "headers": {},
     "balanzas": [ { "nombre": "Balanza camiones", "token": "<token>" } ]
   }
   ```
   Varias balanzas en el mismo sitio = varias entradas, cada una con su token.
3. Arrancar: `node src/index.js sitios/<sitio>.json` (como servicio: ver DESPLIEGUE.md).
4. En la vista debe aparecer *Agente: conectado* y en *Nueva Pesada* el peso en vivo.

Por consola en el central (alternativa):
```bash
cd Backend
node scripts/agente_token.mjs --listar            # balanzas, modo y última conexión
node scripts/agente_token.mjs <idBalanza>         # genera token (modo agente)
node scripts/agente_token.mjs <idBalanza> --directo   # vuelve a directo (reiniciar backend)
```

Reglas:
- **Un agente por token.** Si dos usan el mismo, se reemplazan entre sí (cierre `4409`) cada minuto.
- La ip/puerto **no** van en el JSON del sitio (si están, se ignoran con un aviso).
- Si se edita ip/puerto en la vista, el agente reconecta solo, sin reiniciarlo.
- Sin internet, el agente sigue leyendo y reconecta solo; la app muestra "Agente desconectado"
  y no deja registrar pesada automática.

### Modo directo

El backend se conecta él mismo a `ip:puerto`. Solo sirve si el servidor está en la misma red
que el conversor. Reintenta cada 5 s si no conecta.

### Conversor RS232→TCP

| Campo | Valor |
|---|---|
| Work mode | **TCP Server** |
| Local port | **6000** |
| Serie | La de la balanza (en las pruebas 115200 8N1) |
| Flow control | **None** |

- IP fija para el conversor.
- **Acepta un solo cliente**: cerrar PuTTY, monitores, etc.
- Detalle y diagnóstico: [Agente/DESPLIEGUE.md](../Agente/DESPLIEGUE.md).

### Validación del peso

Cuando se registra una pesada **no manual**, el backend exige que esa balanza haya marcado ese
peso en los últimos `PESO_MAX_EDAD_MS` (60 s), con tolerancia `PESO_TOLERANCIA_KG` (0). Si no,
responde **409** ("Vuelva a capturar el peso o cárguelo como manual"). Se desactiva con
`VALIDAR_PESO_BALANZA=false` (no recomendado).

## Grabadora (NVR / cámaras)

> **Módulo por plan.** Las cámaras se habilitan por localidad (`localidad.modulo_camaras`,
> `migration_modulo_camaras.sql`, apagado por defecto). Solo el **superadmin** lo prende o apaga
> desde *Configuración de Dispositivos → Grabadora* (`PUT /api/localidades/:id/modulos`
> `{ camaras: true|false }`). Apagado: la tarjeta Grabadora y el panel de cámaras de la pesada se
> ven bloqueados, `/api/camaras/*` responde `MODULO_CAMARAS_DESHABILITADO` y la pesada se registra
> sin fotos.

Una grabadora por localidad, en la **misma LAN que su balanza**. Se configura en
*Configuración de Dispositivos → Grabadora*: IP, puerto HTTP (vacío = 80), usuario, contraseña y
marca. Si la localidad todavía no tenía grabadora, se crea al guardar.

- `hikvision`: `http://<ip>[:puerto]/ISAPI/Streaming/channels/<canal>01/picture` (101 = cámara 1)
- `dahua` (y compatibles): `http://<ip>[:puerto]/cgi-bin/snapshot.cgi?channel=<canal>`
- Autenticación Digest (o Basic si el equipo la pide).
- **Canales para fotos** (columna `canales integer[]`, `migration_nvr_canales.sql`): lista como
  `1,2,5-8` (hasta el 64). Se saca una foto de cada uno en cada pesada, sin consultar antes al NVR.
  Vacío = automático: los que devuelven imagen entre 1 y 16 (caché 1 minuto, se limpia al guardar).
- Pedidos al NVR de a 8 canales a la vez (central y agente).
- Al pesar, la app pide `capturar-todo`: una foto por canal, guardada en
  `Backend/capturas/<localidad>/<patente>/<patente>_cam<canal>_<fecha>.jpg`.
- Botón **Probar cámaras** en la tarjeta: escanea los canales 1 a 32, muestra cuáles devuelven
  imagen y permite cargarlos como canales para fotos (después *Guardar*).

### Quién saca las fotos

La grabadora **sigue el modo de la balanza de su localidad**:

| Balanza | Fotos |
|---|---|
| `agente` | El central le pide las fotos al agente del sitio por el mismo WS `/agent`; el agente las saca del NVR de su LAN y las devuelve. No hace falta token ni config extra. |
| `directo` | El central se conecta directo al NVR (tiene que llegar a su IP). |

Mensajes (agente ≥ 0.2.0):

```
central → agente: { type:'NVR_SNAPSHOTS', req_id, nvr:{ ip, puerto, usuario, password, marca }, canales, timeout_ms, min_bytes }
agente → central: { type:'NVR_RESULT', req_id, resultados:[{ canal, ok, jpg (base64), bytes, error }] }
```

Las credenciales del NVR salen siempre de la DB y viajan en cada pedido; el agente no las guarda.
Si el agente está desconectado o es viejo (< 0.2.0), la captura vuelve `sin_camaras` con el motivo
y la pesada se registra igual, sin fotos.

Prueba sin hardware: `node Backend/scripts/sim_nvr.mjs 8090 4 admin admin` (NVR simulado con
Digest) y cargar la grabadora como `127.0.0.1`, puerto `8090`.
