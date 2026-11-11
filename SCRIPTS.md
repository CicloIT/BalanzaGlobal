# Scripts de Windows: cuál correr y en qué orden

Todos se corren en PowerShell **como administrador**, desde su carpeta, y se pueden correr con el
servicio andando o trabado: lo detienen (o lo matan) y lo vuelven a levantar.

```powershell
powershell -ExecutionPolicy Bypass -File .\<script>.ps1
```

## Servidor (carpeta del repo)

**Instalación desde cero, en este orden:**

| Paso | Script | Qué hace |
|---|---|---|
| 1 | `1-instalar-app.ps1` | Compila el frontend, crea el servicio `balanza` y lo arranca. Necesita `Backend\.env` y la base lista (doc 06) |
| 2 | `2-instalar-https.ps1 ... -Iniciar` | Instala Caddy (servicio `caddy`) con HTTPS. Parámetros en doc 06, sección 6b; después quedan guardados |

**Día a día:**

| Para qué | Script |
|---|---|
| Traer una versión nueva | `actualizar-app.ps1`. Si falla, corregir y repetir: retoma lo pendiente |
| Reiniciar el backend sin actualizar | `reiniciar-app.ps1` |
| Reiniciar HTTPS | `reiniciar-app.ps1 -Servicio caddy` |
| Cambiar la configuración de un servicio | Volver a correr `1-instalar-app.ps1 -SinBuild` o `2-instalar-https.ps1` |

`funciones-comunes.ps1` no se ejecuta: lo usan los demás.

## PC de cada sitio (carpeta `Agente`)

Requiere `sitios\<sitio>.json` (ver `Agente\DESPLIEGUE.md`).

| Para qué | Script |
|---|---|
| Instalar o reconfigurar | `instalar-agente.ps1 -Sitio <sitio>` |
| Reiniciar, o destrabar si quedó en "Deteniendo" | `reiniciar-agente.ps1` |
| Detener y dejarlo detenido | `reiniciar-agente.ps1 -SoloDetener` |
| Actualizar | `actualizar-agente.ps1`: baja la última versión de GitHub, conserva `sitios\*.json`, reinicia. `-Volver` vuelve a la anterior; `-Zip <archivo>` si la PC no llega a GitHub |

`funciones-agente.ps1` no se ejecuta, pero tiene que estar en la misma carpeta.

Evitar `nssm restart`, `Restart-Service` y la consola de Servicios: si el servicio se traba quedan
colgados en "Deteniendo". Los scripts lo matan a los pocos segundos.
