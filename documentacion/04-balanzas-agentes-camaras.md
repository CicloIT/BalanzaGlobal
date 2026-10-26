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

Datos: IP, usuario, contraseña y marca.

- `hikvision`: `http://<ip>/ISAPI/Streaming/channels/<canal>/picture`
- otra marca (Dahua y compatibles): `https://<ip>/cgi-bin/snapshot.cgi?channel=<canal>`
- Autenticación Digest. Los canales activos se detectan solos y se guardan en caché.
- Al pesar, la app pide `capturar-todo`: una foto por canal, guardada en
  `Backend/capturas/<localidad>/<patente>/<patente>_cam<canal>_<fecha>.jpg`.

Hoy **el central se conecta directo al NVR**: tiene que poder llegar a su IP. Con el central en
internet y el NVR en la LAN del sitio, las fotos no funcionan hasta que el agente también haga de
puente para las cámaras (pendiente, doc 07).
