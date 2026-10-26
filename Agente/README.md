# Agente local de balanzas

> Despliegue en VPS, configuración de los conversores y prueba con hardware: ver [DESPLIEGUE.md](DESPLIEGUE.md).

Servicio Node que corre en la PC de cada sitio: lee la balanza (conversor RS232→TCP) por la LAN
y publica el peso al backend central por una conexión **WSS saliente** (`/agent`).
El sitio no necesita IP pública ni puertos abiertos.

## Cómo funciona
- Un **token por balanza**. El central identifica la balanza (y su localidad) solo por el token:
  el agente no puede publicar en la balanza de otro sitio.
- La `ip/puerto` de la balanza se cargan **solo** en *Configuración de Dispositivos* (DB del central,
  una config por localidad). Al conectar, el central la manda en `WELCOME` y, si se edita, en `CONFIG`
  (el agente reconecta en vivo). Si el archivo del sitio trae `ip/puerto`, se ignoran con un aviso.
- El agente calcula si el peso está **estable** (sin variación durante 1,5 s) y lo envía junto al peso.
- Sin internet (nivel 1): sigue leyendo la balanza, descarta pesos y reconecta solo (backoff 1→30 s).
  La pantalla muestra "Agente desconectado" y no se puede registrar pesada automática.
- Dos agentes con el mismo token: el último reemplaza al anterior (cierre 4409).

## Alta de un sitio
1. En *Configuración → Dispositivos* (admin de la localidad o admin global): cargar IP/puerto de la
   balanza y **Generar token** (se muestra una sola vez, con el JSON listo para el sitio).
   Regenerar desconecta al agente con el token viejo; *Pasar a modo directo* lo revoca.
   Alternativa por consola en el servidor central:
   ```
   cd Backend
   node scripts/agente_token.mjs --listar
   node scripts/agente_token.mjs <idBalanza>      # imprime el token una sola vez
   ```
   Para volver a modo directo: `node scripts/agente_token.mjs <idBalanza> --directo` y reiniciar el backend.
2. En la PC del sitio (Node 18+):
   ```
   cd Agente
   npm install
   copy sitios\ejemplo.json sitios\mi-sitio.json   # completar central y token
   node src/index.js sitios\mi-sitio.json
   ```
   `central` es `wss://<dominio>/agent` (o `ws://localhost:3000/agent` en desarrollo).
   `headers` permite agregar cabeceras extra (p. ej. `x-daytona-preview-token` si el sandbox es privado).

Las configs de `sitios/` tienen tokens: no se versionan (salvo `ejemplo.json`).

## Prueba local con varios sitios
```
node Backend/scripts/sim_balanzas.mjs 4101:1000:camion 4102:5000:camion
node Agente/src/index.js Agente/sitios/mirador-local.json
node Agente/src/index.js Agente/sitios/quines-local.json
node Backend/scripts/smoke_agentes.mjs <baseUrl> <tokenElMirador> <tokenQuines>
```
Los `*-local.json` apuntan a `ws://localhost:<puerto>/agent`: el puerto tiene que ser el del backend local.
El modo `camion` del simulador sube, queda estable ~8 s en el peso base y baja, en ciclo.
