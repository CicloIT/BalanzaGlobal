# Actualiza el servidor Windows: git pull, dependencias, build del frontend y reinicio del servicio.
# Uso (PowerShell COMO ADMINISTRADOR, desde la carpeta del repo):
#   powershell -ExecutionPolicy Bypass -File .\actualizar-app.ps1
# Opciones:
#   -MigracionesAplicadas   no pregunta por los .sql nuevos (ya se aplicaron con psql)
#
# Se puede correr de nuevo si falla: compara contra el ultimo commit desplegado con exito
# (tools\ultimo-deploy.txt), no contra lo que trajo este pull, y retoma lo que quedo pendiente.
# Si el servicio esta detenido lo arranca aunque no haya cambios.

param(
  [string]$Servicio = 'balanza',
  [switch]$MigracionesAplicadas
)

$ErrorActionPreference = 'Stop'
$Root     = $PSScriptRoot
$Backend  = Join-Path $Root 'Backend'
$Frontend = Join-Path $Root 'Frontend'
$Estado   = Join-Path $Root 'tools\ultimo-deploy.txt'
. (Join-Path $Root 'funciones-comunes.ps1')

Exigir-Admin
if (-not (Get-Service -Name $Servicio -ErrorAction SilentlyContinue)) { Falla "No existe el servicio $Servicio. Correr primero .\1-instalar-app.ps1" }

Push-Location $Root
$antes = (git rev-parse HEAD).Trim()
Paso 'git pull'
git pull --ff-only
if ($LASTEXITCODE -ne 0) { Pop-Location; Falla 'git pull fallo (cambios locales?). Ver git status.' }
$despues = (git rev-parse HEAD).Trim()

# Base de comparacion: ultimo deploy exitoso. Sin registro (o si el commit ya no existe): lo previo al pull.
$base = $antes
if (Test-Path $Estado) {
  $guardado = "$(Get-Content $Estado -TotalCount 1)".Trim()
  if ($guardado -match '^[0-9a-f]{40}$') {
    git rev-parse --verify --quiet "${guardado}^{commit}" | Out-Null
    if ($LASTEXITCODE -eq 0) { $base = $guardado }
  }
}
$cambios = @()
if ($base -ne $despues) { $cambios = @(git diff --name-only $base $despues) }
Pop-Location

if (-not $cambios) { Write-Host 'Sin cambios para desplegar.' }

$cambiaBack  = $cambios | Where-Object { $_ -like 'Backend/*' }
$cambiaFront = $cambios | Where-Object { $_ -like 'Frontend/*' }
$migraciones = $cambios | Where-Object { $_ -like '*.sql' }

# Antes de tocar el servicio: el backend nuevo puede necesitar la migracion para funcionar.
if ($migraciones -and -not $MigracionesAplicadas) {
  Write-Host "`nCambiaron estos .sql; si hay migraciones, aplicarlas con psql ANTES de seguir:`n  $($migraciones -join "`n  ")" -ForegroundColor Yellow
  $respuesta = Read-Host 'Escribir SI para seguir (otra cosa cancela; el servicio sigue con la version anterior)'
  if ($respuesta -ne 'SI') { Falla 'Cancelado. Aplicar las migraciones y volver a correr este script.' }
}

if ($cambiaFront) {
  Paso 'Compilando frontend'
  Push-Location $Frontend
  if ($cambios -contains 'Frontend/package-lock.json') { npm ci; if ($LASTEXITCODE -ne 0) { Pop-Location; Falla 'npm ci del frontend fallo' } }
  npm run build; $rc = $LASTEXITCODE
  Pop-Location
  if ($rc -ne 0) { Falla 'Fallo el build del frontend (el backend sigue con la version anterior). Corregir y volver a correr este script.' }
}

$puerto = Leer-Puerto $Backend
if ($cambios -contains 'Backend/package-lock.json') {
  Paso 'npm ci en Backend'
  Detener-Servicio $Servicio   # npm ci borra node_modules: en Windows no se borran archivos en uso
  Push-Location $Backend; npm ci; $rc = $LASTEXITCODE; Pop-Location
  if ($rc -ne 0) {
    Marcar-PorArrancar $Servicio
    Falla 'npm ci del backend fallo. Corregir y volver a correr este script.'
  }
}

$detenido = (Get-Service -Name $Servicio).Status -ne 'Running'
if ($cambiaBack -or $detenido) {
  Paso "Reiniciando $Servicio"
  Reiniciar-Backend $Servicio $puerto
} else {
  Write-Host 'Backend sin cambios: no hace falta reiniciar (el frontend nuevo se sirve directo de dist).'
}

if (-not (Esperar-Health $puerto)) {
  Falla "/api/health no responde. Log: $(Join-Path $Backend 'logs\balanza.log'). Corregir y volver a correr este script."
}

# Recien aca: si algo fallo antes, la proxima corrida retoma desde el deploy anterior.
New-Item -ItemType Directory -Force (Split-Path $Estado) | Out-Null
Set-Content -Path $Estado -Value $despues -Encoding Ascii

Avisar-Caddy
Write-Host "OK: /api/health responde. Desplegado $($despues.Substring(0, 7)). En el navegador: Ctrl+Shift+R." -ForegroundColor Green
