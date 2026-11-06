# Reinicia un servicio sin actualizar nada. Si estaba detenido, lo arranca.
# Uso (PowerShell COMO ADMINISTRADOR, desde la carpeta del repo):
#   powershell -ExecutionPolicy Bypass -File .\reiniciar-app.ps1                  (backend)
#   powershell -ExecutionPolicy Bypass -File .\reiniciar-app.ps1 -Servicio caddy  (HTTPS)

param(
  [ValidateSet('balanza', 'caddy')]
  [string]$Servicio = 'balanza'
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
. (Join-Path $Root 'funciones-comunes.ps1')

Exigir-Admin
if (-not (Get-Service -Name $Servicio -ErrorAction SilentlyContinue)) { Falla "No existe el servicio $Servicio." }

Paso "Reiniciando $Servicio"
if ($Servicio -eq 'balanza') {
  $Backend = Join-Path $Root 'Backend'
  $puerto = Leer-Puerto $Backend
  Reiniciar-Backend $Servicio $puerto
  if (-not (Esperar-Health $puerto)) { Falla "/api/health no responde. Log: $(Join-Path $Backend 'logs\balanza.log')" }
  Write-Host "OK: /api/health responde en el puerto $puerto." -ForegroundColor Green
} else {
  Detener-Servicio $Servicio
  Arrancar-Servicio $Servicio
  Start-Sleep -Seconds 3
  $estado = (Get-Service -Name $Servicio).Status
  if ($estado -ne 'Running') { Falla "$Servicio quedo $estado. Log: $(Join-Path $Root 'tools\caddy\logs\caddy.log')" }
  Write-Host "OK: $Servicio corriendo." -ForegroundColor Green
}
Avisar-Caddy
