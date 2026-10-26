# Documentación — Sistema de Balanzas (Balanza Pro)

Sistema de pesaje de camiones para varias empresas y localidades. Cada sitio tiene una o más
balanzas; un servidor central guarda las pesadas y sirve la aplicación web.

## Índice

| Documento | Para qué |
|---|---|
| [01 — Arquitectura](01-arquitectura.md) | Componentes, cómo viaja el peso, estructura del repo y de la base |
| [02 — Instalación y configuración](02-instalacion-y-configuracion.md) | Requisitos, `.env`, base de datos, correr en desarrollo y producción |
| [03 — Usuarios, roles y alcance](03-usuarios-roles-alcance.md) | Quién ve y puede hacer qué |
| [04 — Balanzas, agentes y cámaras](04-balanzas-agentes-camaras.md) | Configurar dispositivos, tokens, agente local, NVR |
| [05 — Operación diaria](05-operacion-diaria.md) | Pesadas, reportes, dashboard, respaldos |
| [06 — Despliegue y mantenimiento](06-despliegue-y-mantenimiento.md) | Actualizar Daytona/VPS, scripts, pruebas, diagnóstico |
| [07 — Pendientes y seguridad](07-pendientes-y-seguridad.md) | Lo que falta antes de producción |
| [Agente/DESPLIEGUE.md](../Agente/DESPLIEGUE.md) | Guía detallada de VPS + nginx + conversores + agente |

## Resumen en una página

**Componentes**
- **Backend** (`Backend/`): Node + Express + WebSocket. Expone la API, sirve el frontend compilado,
  habla con PostgreSQL, lee balanzas en modo directo y recibe a los agentes en `/agent`.
- **Frontend** (`Frontend/`): React + Vite. Se compila a `Frontend/dist` y lo sirve el backend.
- **Agente** (`Agente/`): programa Node que corre en una PC de cada sitio, lee el conversor
  RS232→TCP de la balanza por la LAN y manda el peso al central por WSS saliente.
- **PostgreSQL**: base `balanzaglobal`.

**Lo que hay que tener siempre en cuenta**
1. **La IP/puerto de cada balanza se cargan solo en la app** (*Configuración → Dispositivos*).
   El agente no los lleva en su archivo: se los manda el central.
2. **Un token por balanza y un solo agente por token.** Dos agentes con el mismo token se echan
   entre sí (cierre `4409`). El token se ve una sola vez al generarlo.
3. **El conversor acepta un solo cliente TCP.** Si otro programa está conectado al puerto 6000,
   el agente no puede leer.
4. **Catálogos por localidad.** Choferes, vehículos, productos, productores y transportes
   pertenecen a una localidad; una pesada solo puede usar los de su localidad.
5. **Pesada automática = peso que marcó la balanza.** El backend rechaza (409) un peso que la
   balanza no marcó en los últimos 60 s. Para cargar a mano hace falta el permiso de peso manual.
6. **Los PDF subidos (`Backend/src/documentos/`) y las fotos (`Backend/capturas/`) no están en git.**
   Hay que respaldarlos aparte. Ojo al hacer `git pull` sobre una copia vieja (ver doc 06).
7. **En el central, `LOCALIDAD_ID` va vacío.** Con un valor, el servidor solo atiende las balanzas
   de esa localidad (pensado para instalaciones de un solo sitio).
8. **Después de cambiar el frontend hay que compilar** (`npm run build`) y recargar con Ctrl+Shift+R.
9. **Seguridad todavía no es de producción**: contraseñas en texto plano y la API confía en el
   header `x-user-id`. Ver doc 07.
