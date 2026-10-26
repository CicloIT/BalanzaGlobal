# 01 — Arquitectura

## Vista general

```
 SITIO (LAN propia)                                         CENTRAL (VPS / Daytona)
┌──────────────────────────────────────────┐            ┌─────────────────────────────────┐
│ Balanza ─RS232─> Conversor (TCP Server)  │            │ Backend Node :3000              │
│                  192.168.x.y:6000        │            │  ├─ /          Frontend (dist)  │
│                        ▲ TCP (LAN)       │   WSS      │  ├─ /api/...   API REST         │
│                        │                 │  saliente  │  ├─ /ws        navegadores      │
│            PC del sitio: Agente ─────────┼──────────> │  ├─ /agent     agentes          │
│                                          │            │  ├─ /capturas  fotos NVR        │
│ NVR / grabadora de cámaras  <────────────┼─── HTTP ── │  └─ /documentos PDFs            │
└──────────────────────────────────────────┘            │ PostgreSQL                      │
                                                        └─────────────────────────────────┘
```

## Dos formas de leer una balanza

Cada balanza tiene un `modo_conexion` en `configuracion_dispositivos`:

| Modo | Quién se conecta al conversor | Cuándo usarlo |
|---|---|---|
| `directo` | El backend abre TCP a `ip:puerto` | El backend está en la misma red que el conversor (instalación local) |
| `agente` | El agente del sitio; el backend solo recibe el peso por `/agent` | Central en internet y sitios sin IP pública (caso normal) |

En los dos casos el peso entra a `balanzaService.js`, que calcula si está estable, guarda un
historial corto de lecturas (para validar pesadas) y lo reenvía por `/ws` solo a los navegadores
suscritos a esa balanza.

## Recorrido del peso

1. La balanza manda tramas por RS232: `:00|6893|001500|000000|001500|12` → peso = 3.er campo (1500 kg).
2. El conversor las expone en TCP Server :6000.
3. El agente (o el backend en modo directo) lee y parsea con `balanzaProtocol.js`.
   Hay dos copias idénticas de este archivo (`Backend/src/utils/` y `Agente/src/`): si se cambia una, cambiar la otra.
4. El agente manda `WEIGHT` por WebSocket. El central le había mandado antes `WELCOME` con la
   ip/puerto a leer, y manda `CONFIG` si se editan.
5. El navegador abre `/ws?dispositivoId=<balanza>` (el usuario sale de la cookie) y recibe el peso en vivo.
6. Al registrar la pesada, el backend compara el peso enviado contra lo que la balanza marcó
   en los últimos 60 s.

Mensajes del protocolo del agente: `HELLO`, `STATUS`, `WEIGHT` (agente → central) y `WELCOME`,
`CONFIG` (central → agente). Ping cada 15 s; sin noticias en 45 s se da por desconectado.

## Autenticación

- Contraseñas guardadas con **scrypt** (`Backend/src/utils/password.js`).
- `POST /api/usuarios/login` verifica la contraseña y deja una **cookie de sesión httpOnly**
  (`balanza_sesion`) firmada con `SESSION_SECRET` (`Backend/src/utils/session.js`). Dura
  `SESSION_TTL_HORAS` (12 h por defecto).
- El navegador manda la cookie sola en cada request, en las imágenes y PDF, y en el WebSocket `/ws`.
  JavaScript no la puede leer. El frontend guarda una copia de los datos del usuario en
  `localStorage` solo para mostrar el menú, y al cargar la valida con `GET /api/usuarios/me`.
- Los scripts pueden mandar el mismo token como `Authorization: Bearer <token>`.
- En cada request el backend carga el usuario de la base (`middleware/authMiddleware.js`): si se
  desactiva, pierde el acceso en el acto. Después aplica permisos (`config/rolesConfig.js`) y
  alcance (`utils/scope.js`).
- `/capturas` y `/documentos` exigen sesión.

## Estructura del repositorio

```
Balanza/
├─ Backend/
│  ├─ src/server.js            arranque, WebSockets, estáticos, backup semanal
│  ├─ src/config/              database.js (pool PG), rolesConfig.js (permisos)
│  ├─ src/middleware/          authMiddleware.js (requireAuth, requirePermission, optionalAuth)
│  ├─ src/utils/scope.js       filtro empresa/localidad para TODAS las consultas
│  ├─ src/services/            balanzaService.js (lecturas/estado), agenteGateway.js (/agent)
│  ├─ src/controllers/ routes/ un par por recurso
│  ├─ src/documentos/          PDFs subidos (no versionado)
│  ├─ capturas/                fotos del NVR por localidad/patente (no versionado)
│  ├─ backups/                 respaldos .zip (no versionado)
│  └─ scripts/                 tokens, simulador, smoke tests
├─ Frontend/
│  ├─ src/lib/api.js           URL base y headers de usuario (único lugar)
│  ├─ src/config/*Config.js    definición de cada catálogo (columnas, campos, endpoint)
│  ├─ src/config/rolesConfig.js  copia de permisos para el menú (sincronizar con el backend)
│  ├─ src/components/          pantallas
│  └─ src/hooks/               acceso a datos y permisos
├─ Agente/                     agente local + sitios/*.json + DESPLIEGUE.md
├─ schema.sql                 esquema completo de la base (sin datos)
├─ migration_*.sql seed_*.sql  cambios de base y datos iniciales
└─ documentacion/              esta carpeta
```

## Base de datos

Tablas principales:

| Tabla | Contenido |
|---|---|
| `empresa`, `empresa_config` | Empresas (multi-empresa) |
| `provincia`, `localidad` | Localidades = sitios; cada una pertenece a una empresa |
| `usuario` | Usuarios con `rol`, `empresa_id`, `localidad_id` |
| `chofer`, `vehiculo`, `producto`, `productor`, `transporte` | Catálogos, **por localidad** |
| `configuracion_dispositivos` | Balanzas y grabadoras: ip, puerto, marca, localidad, `modo_conexion`, token del agente (hash) |
| `operacion_pesaje` | Una operación por camión: patente, sentido, localidad, `abierta` |
| `pesada` | Pesadas BRUTO/TARA de la operación, neto, fotos, PDF, contenedor |
| `reporte` | Reportes guardados |

- El trigger `trg_calcular_neto` (función `calcular_neto`) calcula el neto cuando la operación
  tiene BRUTO y TARA, y la **cierra** (`abierta = false`).
- `ticket`, `ticket_old`, `ticket_operacion` son legado: el código ya no las usa.
