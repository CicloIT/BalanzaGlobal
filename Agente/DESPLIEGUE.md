# Despliegue: central en VPS + agentes locales por sitio

Cómo queda Balanza cuando la app corre en un VPS (o Daytona) y cada sitio tiene su PC con el
agente y los conversores RS232→TCP, en redes distintas y sin IP pública.

## Arquitectura

```
 SITIO (LAN propia, sin IP pública)                         VPS / Daytona (internet)
┌───────────────────────────────────────────┐            ┌──────────────────────────────┐
│ Balanza ──RS232──> Conversor (TCP Server) │            │ nginx :443 (TLS)             │
│                    192.168.x.y:6000       │            │   └─> Backend :3000          │
│                         ▲                 │   WSS      │        ├─ /       (Frontend) │
│                         │ TCP (LAN)       │  saliente  │        ├─ /ws     (browsers) │
│                    PC del sitio: Agente ──┼───443────> │        └─ /agent  (agentes)  │
└───────────────────────────────────────────┘            │      PostgreSQL              │
                                                         └──────────────────────────────┘
```

- **El conversor nunca apunta al VPS.** Solo habla con el agente dentro de la LAN del sitio.
- **El agente solo hace conexiones salientes**: TCP al conversor (LAN) y WSS al central (443).
  El sitio no necesita IP pública, port forwarding ni VPN.
- **Un token por balanza.** El central identifica balanza y localidad solo por el token, así que
  un agente no puede publicar en la balanza de otro sitio.
- Si se corta internet, el agente sigue leyendo la balanza, descarta pesos y reconecta solo
  (backoff 1→30 s). En pantalla se ve "Agente desconectado".

## 1. Central (VPS)

### Requisitos
- Node 18+, PostgreSQL, pm2.
- Un **dominio con HTTPS** (p. ej. `balanza.empresa.com`). El agente usa `wss://<dominio>/agent`.
- Puertos abiertos al exterior: **443** (y 80 para el certificado). El 3000 del backend no se expone.

### Migración
```bash
psql "$DATABASE_URL" -f migration_agente.sql     # idempotente
```

### nginx (proxy con WebSocket)
`/agent` y `/ws` son WebSocket: el proxy tiene que pasar el `Upgrade` y no cortar conexiones
inactivas antes del heartbeat (el central hace ping cada 15 s; el agente se da por desconectado
si pasan 45 s sin nada).

```nginx
server {
    listen 443 ssl;
    server_name balanza.empresa.com;
    # ssl_certificate / ssl_certificate_key (certbot)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }
}
```

> Con Cloudflare delante: activar **WebSockets** en el dominio. Funciona igual con un túnel
> (`cloudflared`) si el VPS no tiene IP pública.

### Alta de cada balanza
En *Configuración de Dispositivos*, crear la balanza en su localidad (IP/puerto del conversor
en la LAN del sitio: es lo que el central le manda al agente en el `WELCOME`) y apretar
**Generar token** (solo admin de la localidad o admin global). Por consola:

```bash
cd Backend
node scripts/agente_token.mjs --listar          # id, localidad, modo, última conexión
node scripts/agente_token.mjs <idBalanza>       # pasa a modo agente e imprime el token (una sola vez)
```

- Guardar el token: no se puede volver a ver. Si se pierde, se genera otro (invalida el anterior).
- Para volver a lectura directa: *Pasar a modo directo* en la vista (o `node scripts/agente_token.mjs <id> --directo` y reiniciar el backend).

## 2. Conversor RS232→TCP (en cada sitio)

Configuración en el panel web del conversor (`http://<ip>`, usuario y clave del equipo):

| Campo | Valor |
|---|---|
| Work mode | **TCP Server** (no TCP Client) |
| Local port | **6000** |
| Remote IP / port | no se usan |
| Baud / bits / paridad / stop | **los de la balanza** (en las pruebas: 115200 8N1) |
| Flow control | **None** |
| Interfaz (si es seleccionable) | RS232 |

- **IP fija** para el conversor (estática o reservada en el DHCP del router del sitio).
- El conversor **acepta un solo cliente TCP**: si otro programa está conectado al 6000, el agente
  queda afuera (`ECONNRESET`). No dejar monitores ni terminales TCP abiertos.
- Trama esperada (una por línea, terminada en `\n`; `\r`, STX y ETX se ignoran):
  `:00|6893|001500|000000|001500|12` → peso = 3er campo = 1500 kg.

## 3. Agente (PC de cada sitio)

### Requisitos
- Windows o Linux, Node 18+, en la **misma LAN** que los conversores.
- Salida a internet por 443. No necesita puertos abiertos.
- PC que quede prendida (es la que mantiene viva la balanza en el sistema).

### Instalación
```bash
cd Agente
npm ci
copy sitios\ejemplo.json sitios\<sitio>.json     # Linux: cp
```

`sitios/<sitio>.json` (no se versiona, tiene tokens):
```json
{
  "sitio": "Quines",
  "central": "wss://balanza.empresa.com/agent",
  "headers": {},
  "balanzas": [
    { "nombre": "Balanza camiones", "token": "<token>" }
  ]
}
```
- Varias balanzas en el mismo sitio → varias entradas en `balanzas`, cada una con su token.
- La `ip`/`puerto` del conversor no van en el archivo: se cargan en *Configuración de Dispositivos*
  de la localidad y el central se las manda al agente (si se editan, el agente reconecta solo).
- `headers`: solo si hace falta pasar un proxy (p. ej. `x-daytona-preview-token` en un sandbox privado).

```bash
node src/index.js sitios/<sitio>.json
```

### Dejarlo como servicio
Para que arranque solo con la PC (pendiente de definir cuál usamos):
- **Windows**: `pm2` + `pm2-windows-startup`, o NSSM (`nssm install BalanzaAgente node src\index.js sitios\<sitio>.json`).
- **Linux**: `pm2 start src/index.js --name agente -- sitios/<sitio>.json && pm2 save && pm2 startup`.

Un solo agente por token: si se levantan dos con el mismo token, el último reemplaza al
anterior (cierre `4409`).

## 4. Diagnóstico

| Síntoma en el log del agente | Causa | Qué hacer |
|---|---|---|
| `error balanza: ECONNREFUSED` | Conversor no está en TCP Server o puerto mal | Panel del conversor: TCP Server, puerto 6000 |
| `error balanza: ECONNRESET` en loop | Otro cliente conectado al conversor | Cerrar el otro programa |
| `sin tramas de la balanza hace 5 s` | Conectado pero no llegan tramas válidas | Balanza apagada, cable, baud, flow control |
| Llegan solo bytes `0x00` | Baud/flow control distinto o mala señal (GND) | Igualar 115200 8N1 sin flow control; revisar cable |
| `respondió HTTP 4xx al abrir el WebSocket` | URL o proxy | Revisar `central`, `/agent`, headers del proxy, WebSockets en nginx/Cloudflare |
| cierre `4401` | Token inválido o balanza no está en modo agente | Regenerar token en la vista (o `agente_token.mjs <id>`) |
| cierre `4403` | Balanza no habilitada en ese servidor | Revisar que la balanza esté activa |
| cierre `4409` | Otro agente usa el mismo token | Dejar un solo agente por token |
| `NVR …: 0/N canal(es) OK` | El agente no llega al NVR o credenciales mal | Desde la PC del agente abrir `http://<ip-nvr>`; revisar usuario/contraseña/marca en la vista |
| App: "Agente desactualizado" al sacar fotos | Agente < 0.2.0 | Actualizar el agente del sitio (`git pull` + reiniciar) |

Herramientas:
- `node scripts/agente_token.mjs --listar` (central): modo y última conexión de cada balanza.
- `node Backend/scripts/smoke_agentes.mjs <baseUrl> <token1> <token2>`: prueba punta a punta.
- `node Backend/scripts/sim_balanzas.mjs 4101:1000:camion`: simula conversores sin hardware.
- `node Backend/scripts/sim_nvr.mjs 8090 4 admin admin`: simula un NVR (Digest) sin hardware.

## 5. Prueba con hardware sin balanza

Para probar un conversor real sin la balanza, se simula la balanza mandando tramas por el
serial desde otra PC (Linux) conectada al conversor con un adaptador USB-RS232.

1. Cerrar cualquier programa que tenga el puerto serie abierto (PuTTY, GtkTerm).
2. Identificar el puerto: `ls -l /dev/ttyUSB*`. Para saber cuál va a qué conversor, mandar un
   texto con PuTTY (Serial, 115200, *Flow control: None*) y ver dónde llega.
3. Mandar un "camión" (sube, queda estable en 12.340 kg ~8 s, baja; 3 veces):
   ```bash
   sudo bash -c 'stty -F /dev/ttyUSB1 115200 cs8 -cstopb -parenb -ixon -crtscts raw; for c in 1 2 3; do for p in 0 2000 5000 9000 12000 12340 12340 12340 12340 12340 12340 12340 12340 12340 12340 12340 12340 12340 12340 12340 12340 8000 3000 0 0 0; do printf ":00|6893|%06d|000000|%06d|12\r\n" $p $p > /dev/ttyUSB1; sleep 0.4; done; done'
   ```
   El `sudo bash -c '...'` es necesario: con `sudo printf ... > /dev/ttyUSB1` la redirección
   corre sin permisos y da *Permission denied*.
4. Con el agente corriendo, en la app (usuario de la localidad de esa balanza) la pantalla de
   pesada muestra el peso en vivo y "estable" en la meseta.

Lecciones de la primera prueba:
- **GtkTerm** mandaba todo como bytes `0x00`; PuTTY y `printf` funcionan. Ante ceros, sospechar
  primero de la configuración del programa que envía (baud, flow control).
- En PuTTY el flow control viene en **XON/XOFF** por defecto: cambiarlo a *None*.
- El campo *Serial line* de PuTTY no tiene que tener espacios (`' /dev/ttyUSB1'` → *No such file*).
- El puerto **1501** que aparece abierto en los conversores es interno: no transmite datos.

### Estado al 2026-10-23
| Componente | Estado |
|---|---|
| Conversor .103 (Quines) | TCP Server :6000, 115200 8N1 — **probado punta a punta** |
| Conversor .102 (LaSarita) | Todavía en TCP Client — falta pasarlo a TCP Server :6000 |
| Agente | Probado desde la PC 192.168.52.20 con `sitios/quines-fisico.json` (balanza 24, Quines) |
| Central | Daytona (`wss://3000-<sandbox>.proxy.daytona.works/agent`) — falta VPS con dominio |

Pendientes antes de producción: VPS con dominio + HTTPS + nginx WebSocket, agente como servicio
en cada PC de sitio, cambiar las contraseñas de los usuarios del seed (`123456`) y guardar las
contraseñas con hash (hoy se comparan en texto plano en el login).

## 6. Checklist por sitio nuevo

1. [ ] Balanza creada en *Configuración de Dispositivos* con su localidad.
2. [ ] IP/puerto del conversor cargados y token generado en la vista (o `agente_token.mjs <id>`), guardado.
3. [ ] Conversor con IP fija, TCP Server :6000, parámetros serie de la balanza.
4. [ ] PC del sitio con Node 18+, `npm ci`, `sitios/<sitio>.json` completo.
5. [ ] Agente corriendo como servicio.
6. [ ] En la app: la balanza muestra peso en vivo y "estable" al quedar quieta.
7. [ ] Prueba de corte: desenchufar internet → "Agente desconectado"; reconectar → vuelve solo.
8. [ ] Grabadora cargada en *Dispositivos → Grabadora* y **Probar cámaras** lista los canales.
