# Instala (o reinstala) el backend como servicio de Windows con NSSM.
# El servicio arranca con el equipo (sin iniciar sesion), se reinicia solo si se cae
# y sirve frontend + API + WebSocket en un solo puerto (PORT de Backend\.env, 3000 por defecto).
#
# Uso (PowerShell COMO ADMINISTRADOR, desde la carpeta del repo):
#   powershell -ExecutionPolicy Bypass -File .\servicio-windows.ps1
# Opciones:
#   -SinBuild        no recompila el frontend
#   -AbrirPuerto     ademas abre el puerto en el firewall de Windows (por defecto NO lo toca)
#   -Desinstalar     detiene y borra el servicio (no toca la base ni los archivos)

param(
  [switch]$SinBuild,
  [switch]$AbrirPuerto,
  [switch]$Desinstalar,
  [string]$Servicio = 'balanza'
)

$ErrorActionPreference = 'Stop'
$Root     = $PSScriptRoot
$Backend  = Join-Path $Root 'Backend'
$Frontend = Join-Path $Root 'Frontend'
$Logs     = Join-Path $Backend 'logs'
$NssmDir  = Join-Path $Root 'tools\nssm'

function Paso($t) { Write-Host "`n> $t" -ForegroundColor Cyan }
function Falla($t) { Write-Host "ERROR: $t" -ForegroundColor Red; exit 1 }

# --- Administrador ---
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Falla 'Abrir PowerShell como administrador (clic derecho > Ejecutar como administrador).' }

# --- NSSM: PATH, o tools\nssm, o descargarlo ---
function Get-Nssm {
  $cmd = Get-Command nssm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $local = Join-Path $NssmDir 'nssm.exe'
  if (Test-Path $local) { return $local }

  Paso 'Descargando NSSM...'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $zip = Join-Path $env:TEMP 'nssm.zip'
  $tmp = Join-Path $env:TEMP 'nssm_extract'
  # 2.24-101 corrige el error de arranque de 2.24 en Windows 10/Server 2016+
  $urls = @('https://nssm.cc/ci/nssm-2.24-101-g897c7ad.zip', 'https://nssm.cc/release/nssm-2.24.zip')
  $ok = $false
  foreach ($u in $urls) {
    try { Invoke-WebRequest -Uri $u -OutFile $zip -UseBasicParsing; $ok = $true; break }
    catch { Write-Host "  no se pudo bajar $u" -ForegroundColor Yellow }
  }
  if (-not $ok) {
    Falla "No se pudo descargar NSSM. Bajarlo a mano de https://nssm.cc/download y copiar win64\nssm.exe en $NssmDir"
  }
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive $zip -DestinationPath $tmp -Force
  $exe = Get-ChildItem $tmp -Recurse -Filter nssm.exe | Where-Object { $_.FullName -match '\\win64\\' } | Select-Object -First 1
  if (-not $exe) { Falla 'El zip de NSSM no trae win64\nssm.exe' }
  New-Item -ItemType Directory -Force $NssmDir | Out-Null
  Copy-Item $exe.FullName $local -Force
  Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
  return $local
}

$nssm = Get-Nssm
Write-Host "NSSM: $nssm"

function Existe-Servicio { [bool](Get-Service -Name $Servicio -ErrorAction SilentlyContinue) }

# --- Desinstalar ---
if ($Desinstalar) {
  if (Existe-Servicio) {
    Paso "Borrando servicio $Servicio"
    & $nssm stop $Servicio | Out-Null
    & $nssm remove $Servicio confirm
  } else { Write-Host "No existe el servicio $Servicio" }
  exit 0
}

# --- Requisitos ---
Paso 'Revisando requisitos'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Falla 'No se encuentra node.exe. Instalar Node.js LTS y abrir una consola nueva.' }
Write-Host "Node: $node ($(& $node --version))"
$envFile = Join-Path $Backend '.env'
if (-not (Test-Path $envFile)) { Falla "Falta $envFile (ver doc 06, paso 4)." }

$puerto = 3000
$lineaPort = Select-String -Path $envFile -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
if ($lineaPort) { $puerto = [int]$lineaPort.Matches[0].Groups[1].Value }
Write-Host "Puerto: $puerto"

# --- Dependencias y build ---
if (-not (Test-Path (Join-Path $Backend 'node_modules'))) {
  Paso 'npm ci en Backend'
  Push-Location $Backend; npm ci; $rc = $LASTEXITCODE; Pop-Location
  if ($rc -ne 0) { Falla 'npm ci del backend fallo' }
}
if (-not $SinBuild) {
  Paso 'Compilando frontend (npm ci + npm run build)'
  Push-Location $Frontend
  npm ci;        $rc1 = $LASTEXITCODE
  npm run build; $rc2 = $LASTEXITCODE
  Pop-Location
  if ($rc1 -ne 0 -or $rc2 -ne 0) { Falla 'Fallo el build del frontend' }
}
if (-not (Test-Path (Join-Path $Frontend 'dist\index.html'))) { Falla 'No existe Frontend\dist\index.html (correr sin -SinBuild).' }

# --- Servicio ---
New-Item -ItemType Directory -Force $Logs | Out-Null
if (Existe-Servicio) {
  Paso "Servicio $Servicio ya existe: deteniendo para reconfigurar"
  & $nssm stop $Servicio | Out-Null
} else {
  Paso "Creando servicio $Servicio"
  & $nssm install $Servicio $node 'src\server.js'
  if ($LASTEXITCODE -ne 0) { Falla 'nssm install fallo' }
}

$log = Join-Path $Logs 'balanza.log'
& $nssm set $Servicio Application $node                 | Out-Null
& $nssm set $Servicio AppParameters 'src\server.js'     | Out-Null
& $nssm set $Servicio AppDirectory $Backend             | Out-Null   # dotenv lee .env del directorio actual
& $nssm set $Servicio DisplayName 'Balanza (backend + frontend)' | Out-Null
& $nssm set $Servicio Description "Sistema de balanzas. Puerto $puerto. Repo: $Root" | Out-Null
& $nssm set $Servicio Start SERVICE_AUTO_START          | Out-Null
& $nssm set $Servicio AppStdout $log                    | Out-Null
& $nssm set $Servicio AppStderr $log                    | Out-Null
& $nssm set $Servicio AppRotateFiles 1                  | Out-Null
& $nssm set $Servicio AppRotateOnline 1                 | Out-Null
& $nssm set $Servicio AppRotateBytes 10485760           | Out-Null   # rota cada 10 MB
& $nssm set $Servicio AppExit Default Restart           | Out-Null
& $nssm set $Servicio AppRestartDelay 3000              | Out-Null
& $nssm set $Servicio AppThrottle 5000                  | Out-Null
& $nssm set $Servicio AppStopMethodConsole 5000         | Out-Null
# Si PostgreSQL es servicio local, esperar a que arranque antes que el backend
$pg = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pg) {
  & $nssm set $Servicio DependOnService $pg.Name | Out-Null
  Write-Host "Depende de: $($pg.Name)"
}

Paso "Iniciando $Servicio"
& $nssm start $Servicio
Start-Sleep -Seconds 4

# --- Firewall ---
if ($AbrirPuerto) {
  $regla = "Balanza $puerto"
  if (-not (Get-NetFirewallRule -DisplayName $regla -ErrorAction SilentlyContinue)) {
    Paso "Abriendo puerto $puerto en el firewall de Windows"
    New-NetFirewallRule -DisplayName $regla -Direction Inbound -Protocol TCP -LocalPort $puerto -Action Allow | Out-Null
  } else { Write-Host "Regla de firewall '$regla' ya existe" }
  $pgRegla = Get-NetFirewallPortFilter -ErrorAction SilentlyContinue | Where-Object LocalPort -eq 5432 | Get-NetFirewallRule -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' }
  if ($pgRegla) {
    Write-Host "AVISO: hay reglas que abren el 5432 (PostgreSQL): $($pgRegla.DisplayName -join ', '). Deshabilitarlas si no hacen falta." -ForegroundColor Yellow
  }
}

# --- Verificacion ---
Paso 'Verificando'
Get-Service $Servicio | Format-Table Name, Status, StartType -AutoSize
try {
  $r = Invoke-WebRequest "http://127.0.0.1:$puerto/api/health" -UseBasicParsing -TimeoutSec 10
  Write-Host "OK: http://127.0.0.1:$puerto/api/health -> $($r.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "El backend no responde todavia. Ver el log: $log" -ForegroundColor Yellow
  if (Test-Path $log) { Get-Content $log -Tail 30 }
}
if ($AbrirPuerto) {
  Write-Host "`nListo. Falta (si se entra desde afuera) redirigir en el router IP_PUBLICA:$puerto -> IP_LAN_DE_ESTE_EQUIPO:$puerto."
} else {
  Write-Host "`nListo. Puerto NO abierto en el firewall: entrar desde este equipo con http://127.0.0.1:$puerto"
  Write-Host "Para abrirlo despues: .\servicio-windows.ps1 -SinBuild -AbrirPuerto"
}
