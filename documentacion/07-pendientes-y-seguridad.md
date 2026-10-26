# 07 — Pendientes y seguridad

## Seguridad (antes de producción)

| Tema | Estado hoy | Qué hacer |
|---|---|---|
| Usuarios del seed | Todos con `123456` | Cambiarlas (`usuario_password.mjs` o `PUT /api/usuarios/me/password`) |
| Archivos | `/capturas` y `/documentos` exigen sesión, pero cualquier usuario logueado puede abrir un archivo de otra localidad si conoce el nombre | Validar la localidad del archivo |
| Intentos de login | Sin límite | Limitar intentos por IP/usuario |
| CORS | Abierto a cualquier origen | Limitar al dominio propio |
| TLS | `NODE_TLS_REJECT_UNAUTHORIZED=0` en `server.js` (para NVR con certificado propio) desactiva la verificación TLS de todo el proceso | Limitarlo a las llamadas al NVR |

## Infraestructura

- VPS con dominio + HTTPS + nginx con WebSocket (hoy en Daytona).
- Agente como servicio en cada PC de sitio (pm2 o NSSM).
- Respaldo periódico de `Backend/src/documentos/` y `Backend/capturas/` fuera del servidor.

## Funcionalidad

- Cámaras/NVR a través del agente (hoy el central tiene que llegar directo al NVR).
- Cola offline en el agente (nivel 2): guardar pesadas si se corta internet.
- Pantalla de usuarios y de cambio de contraseña (la API ya existe).
- Conversor de La Sarita (.102): pasarlo a TCP Server :6000.
- Borrar las tablas legado `ticket`, `ticket_old`, `ticket_operacion` cuando se confirme que no
  hacen falta.

## Hecho (2026-10-26)

- Contraseñas con hash scrypt; migración transparente (`hashear_passwords.mjs`).
- Sesión firmada en cookie httpOnly; la API ya no acepta `x-user-id`.
- `/ws`, `/capturas` y `/documentos` exigen sesión.
- Respaldos solo para admin global y superadmin.
- `schema.sql` con el esquema completo.
