# 07 — Pendientes y seguridad

## Seguridad (antes de producción)

| Tema | Estado hoy | Qué hacer |
|---|---|---|
| Contraseñas | Guardadas y comparadas **en texto plano** (`usuario.password_hash`) | Hash con bcrypt/argon2 y migrar las existentes |
| Sesión | La API confía en el header `x-user-id`: cualquiera que lo conozca puede hacerse pasar por otro usuario | Token firmado (JWT o sesión) emitido en el login |
| Usuarios del seed | Todos con `123456` | Cambiarlas |
| `/capturas` y `/documentos` | Se sirven sin login | Servirlos detrás de autenticación |
| CORS | Abierto a cualquier origen | Limitar al dominio propio |
| TLS | `NODE_TLS_REJECT_UNAUTHORIZED=0` en `server.js` (para NVR con certificado propio) desactiva la verificación TLS de todo el proceso | Limitarlo a las llamadas al NVR |
| Respaldos | Un usuario global de empresa descarga la base completa | Filtrar el dump por empresa |

## Infraestructura

- VPS con dominio + HTTPS + nginx con WebSocket (hoy en Daytona).
- Agente como servicio en cada PC de sitio (pm2 o NSSM).
- Esquema completo de la base en el repo (`pg_dump --schema-only`) para poder instalar de cero.
- Respaldo periódico de `Backend/src/documentos/` y `Backend/capturas/` fuera del servidor.

## Funcionalidad

- Cámaras/NVR a través del agente (hoy el central tiene que llegar directo al NVR).
- Cola offline en el agente (nivel 2): guardar pesadas si se corta internet.
- Pantalla de usuarios (la API ya existe).
- Conversor de La Sarita (.102): pasarlo a TCP Server :6000.
- Borrar las tablas legado `ticket`, `ticket_old`, `ticket_operacion` cuando se confirme que no
  hacen falta.
