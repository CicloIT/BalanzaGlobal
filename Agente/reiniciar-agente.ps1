# Reinicia el agente: despues de cambiar el JSON, o si quedo trabado en "Deteniendo".
# Si estaba detenido, lo arranca. Mata el proceso si no para en 10 s.
# Usar esto en lugar de "nssm restart" o de la consola de Servicios, que pueden quedar colgados.
#
# Uso (PowerShell COMO ADMINISTRADOR, desde la carpeta del agente):
#   powershell -ExecutionPolicy Bypass -File .\reiniciar-agente.ps1
# Opciones:
#   -SoloDetener     lo detiene y lo deja detenido (ej. para reemplazar archivos)
#   -Servicio <n>    nombre del servicio (por defecto BalanzaAgente)

param(
  [switch]$SoloDetener,
  [string]$Servicio = 'BalanzaAgente'
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$log  = Join-Path $Root 'logs\agente.log'
. (Join-Path $Root 'funciones-agente.ps1')

Exigir-Admin
if (-not (Get-Service -Name $Servicio -ErrorAction SilentlyContinue)) { Falla "No existe el servicio $Servicio. Correr primero .\instalar-agente.ps1" }

Paso "Deteniendo $Servicio"
Detener-Agente $Servicio
if ($SoloDetener) {
  Write-Host "Listo: $Servicio detenido. Para arrancarlo: .\reiniciar-agente.ps1" -ForegroundColor Green
  exit 0
}

Paso "Arrancando $Servicio"
Arrancar-Agente $Servicio $log
Write-Host "Listo: $Servicio corriendo. Log: $log" -ForegroundColor Green
