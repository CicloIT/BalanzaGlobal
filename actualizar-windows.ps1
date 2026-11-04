# Actualiza el servidor Windows: git pull, dependencias, build del frontend y reinicio del servicio.
# Uso (PowerShell COMO ADMINISTRADOR, desde la carpeta del repo):
#   powershell -ExecutionPolicy Bypass -File .\actualizar-windows.ps1
# Las migraciones .sql NO se corren solas: si el pull trae una nueva, correrla con psql antes.

param([string]$Servicio = 'balanza')

$ErrorActionPreference = 'Stop'
$Root     = $PSScriptRoot
$Backend  = Join-Path $Root 'Backend'
$Frontend = Join-Path $Root 'Frontend'

function Paso($t) { Write-Host "`n> $t" -ForegroundColor Cyan }
function Falla($t) { Write-Host "ERROR: $t" -ForegroundColor Red; exit 1 }

# Servicios que dependen de este (ej. caddy -> balanza) y que se detuvieron para poder pararlo:
# Windows no deja detener un servicio con dependientes corriendo (sc stop -> error 1051).
$script:Dependientes = @()

# Detiene el servicio; si a los 20 s sigue trabado (STOP_PENDING), mata el proceso (nssm + node).
function Detener-Servicio($nombre) {
  $svc = Get-Service -Name $nombre -ErrorAction SilentlyContinue
  if (-not $svc -or $svc.Status -eq 'Stopped') { return }
  foreach ($d in ($svc.DependentServices | Where-Object Status -ne 'Stopped')) {
    Write-Host "  Deteniendo $($d.Name) (depende de $nombre)"
    Detener-Servicio $d.Name
    if ($script:Dependientes -notcontains $d.Name) { $script:Dependientes += $d.Name }
  }
  sc.exe stop $nombre | Out-Null
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if ((Get-Service -Name $nombre).Status -eq 'Stopped') { return }
  }
  $procId = (Get-CimInstance Win32_Service -Filter "Name='$nombre'").ProcessId
  if ($procId) {
    Write-Host "  $nombre no se detuvo en 20 s: matando PID $procId" -ForegroundColor Yellow
    taskkill /PID $procId /T /F | Out-Null
  }
  for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    if ((Get-Service -Name $nombre).Status -eq 'Stopped') { return }
  }
  Write-Host "  No se pudo detener $nombre" -ForegroundColor Red; exit 1
}

# Vuelve a arrancar los dependientes que Detener-Servicio paro (ej. caddy)
function Arrancar-Dependientes {
  foreach ($d in $script:Dependientes) {
    Write-Host "  Arrancando $d"
    try { Start-Service $d -ErrorAction Stop } catch { Write-Host "  No arranco $d : $($_.Exception.Message)" -ForegroundColor Yellow }
  }
  $script:Dependientes = @()
}

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Falla 'Abrir PowerShell como administrador.' }
if (-not (Get-Service -Name $Servicio -ErrorAction SilentlyContinue)) { Falla "No existe el servicio $Servicio. Correr primero .\servicio-windows.ps1" }

Push-Location $Root
$antes = (git rev-parse HEAD).Trim()
Paso 'git pull'
git pull --ff-only
if ($LASTEXITCODE -ne 0) { Pop-Location; Falla 'git pull fallo (cambios locales?). Ver git status.' }
$despues = (git rev-parse HEAD).Trim()
if ($antes -eq $despues) { Write-Host 'Sin cambios nuevos.'; Pop-Location; exit 0 }
$cambios = git diff --name-only $antes $despues
Pop-Location

$cambiaBack  = $cambios | Where-Object { $_ -like 'Backend/*' }
$cambiaFront = $cambios | Where-Object { $_ -like 'Frontend/*' }
$migraciones = $cambios | Where-Object { $_ -like '*.sql' }
if ($migraciones) {
  Write-Host "AVISO: cambiaron estos .sql, revisar si hay que aplicarlos:`n  $($migraciones -join "`n  ")" -ForegroundColor Yellow
}

if ($cambiaFront) {
  Paso 'Compilando frontend'
  Push-Location $Frontend
  if ($cambios -contains 'Frontend/package-lock.json') { npm ci; if ($LASTEXITCODE -ne 0) { Pop-Location; Falla 'npm ci del frontend fallo' } }
  npm run build; $rc = $LASTEXITCODE
  Pop-Location
  if ($rc -ne 0) { Falla 'Fallo el build del frontend (el servicio sigue con la version anterior).' }
}

if ($cambiaBack) {
  if ($cambios -contains 'Backend/package-lock.json') {
    Paso 'npm ci en Backend'
    Detener-Servicio $Servicio   # npm ci borra node_modules: en Windows no se borran archivos en uso
    Push-Location $Backend; npm ci; $rc = $LASTEXITCODE; Pop-Location
    if ($rc -ne 0) { Start-Service $Servicio; Arrancar-Dependientes; Falla 'npm ci del backend fallo' }
  }
  Paso "Reiniciando $Servicio"
  Detener-Servicio $Servicio
  Start-Service $Servicio
  Start-Sleep -Seconds 4
  Arrancar-Dependientes
} else {
  Write-Host 'Backend sin cambios: no hace falta reiniciar (el frontend nuevo se sirve directo de dist).'
}

$puerto = 3000
$lineaPort = Select-String -Path (Join-Path $Backend '.env') -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
if ($lineaPort) { $puerto = [int]$lineaPort.Matches[0].Groups[1].Value }
try {
  $r = Invoke-WebRequest "http://127.0.0.1:$puerto/api/health" -UseBasicParsing -TimeoutSec 10
  Write-Host "OK: /api/health -> $($r.StatusCode). En el navegador: Ctrl+Shift+R." -ForegroundColor Green
} catch {
  Write-Host "No responde. Log: $(Join-Path $Backend 'logs\balanza.log')" -ForegroundColor Yellow
}
