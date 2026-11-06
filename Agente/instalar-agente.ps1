# Instala (o reinstala) el agente local como servicio de Windows con NSSM.
# Arranca solo al prender la PC (sin iniciar sesion) y se reinicia si se cae.
# Se puede correr con el agente andando o trabado en "Deteniendo": lo mata y lo vuelve a levantar.
# Para reiniciar nada mas: .\reiniciar-agente.ps1
#
# Uso (PowerShell COMO ADMINISTRADOR, desde la carpeta del agente):
#   powershell -ExecutionPolicy Bypass -File .\instalar-agente.ps1 -Sitio quines
#     (usa sitios\quines.json; si hay un solo JSON distinto de ejemplo.json, -Sitio es opcional)
# Opciones:
#   -Dependencias    corre npm ci aunque ya esten instaladas (si cambio package-lock.json)
#   -Desinstalar     detiene y borra el servicio (no toca archivos)
#   -Servicio <n>    nombre del servicio (por defecto BalanzaAgente)

param(
  [string]$Sitio,
  [switch]$Dependencias,
  [switch]$Desinstalar,
  [string]$Servicio = 'BalanzaAgente'
)

$ErrorActionPreference = 'Stop'
$Root    = $PSScriptRoot
$NssmDir = Join-Path $Root 'tools\nssm'
$Logs    = Join-Path $Root 'logs'
. (Join-Path $Root 'funciones-agente.ps1')

# --- Administrador ---
Exigir-Admin

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
  # 2.24-101 corrige el error de arranque de 2.24 en Windows 10/11
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
$existe = [bool](Get-Service -Name $Servicio -ErrorAction SilentlyContinue)

# --- Desinstalar ---
if ($Desinstalar) {
  if ($existe) {
    Paso "Borrando servicio $Servicio"
    Detener-Agente $Servicio
    & $nssm remove $Servicio confirm
  } else { Write-Host "No existe el servicio $Servicio" }
  exit 0
}

# --- Requisitos ---
Paso 'Revisando requisitos'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Falla 'No se encuentra node.exe. Instalar Node.js LTS y abrir una consola nueva.' }
Write-Host "Node: $node ($(& $node --version))"

$sitiosDir = Join-Path $Root 'sitios'
if ($Sitio) {
  $nombre = [IO.Path]::GetFileNameWithoutExtension($Sitio)
  $json = Join-Path $sitiosDir "$nombre.json"
  if (-not (Test-Path $json)) { Falla "No existe $json" }
} else {
  $candidatos = @(Get-ChildItem $sitiosDir -Filter *.json | Where-Object Name -ne 'ejemplo.json')
  if ($candidatos.Count -ne 1) {
    Falla "Indicar el sitio con -Sitio <nombre>. JSON en sitios\: $(($candidatos.Name) -join ', ')"
  }
  $json = $candidatos[0].FullName
}
try { Get-Content $json -Raw | ConvertFrom-Json | Out-Null } catch { Falla "$json no es JSON valido: $($_.Exception.Message)" }
$relJson = 'sitios\' + (Split-Path $json -Leaf)
Write-Host "Config: $relJson"
$sitioNuevo = [IO.Path]::GetFileNameWithoutExtension($json)

# --- Detener lo que este corriendo (servicio trabado, huerfanos, consola con el mismo JSON) ---
New-Item -ItemType Directory -Force $Logs | Out-Null
if ($existe) {
  Paso "Servicio $Servicio ya existe: deteniendo para reconfigurar"
  if ((Get-Service -Name $Servicio).Status -eq 'Running') { $script:RearrancarAlFallar = $Servicio }
}
Detener-Agente $Servicio $sitioNuevo

# npm ci borra node_modules: va con el agente detenido (en Windows no se borran archivos en uso)
if ($Dependencias -or -not (Test-Path (Join-Path $Root 'node_modules\ws'))) {
  Paso 'npm ci'
  Push-Location $Root; npm ci; $rc = $LASTEXITCODE; Pop-Location
  if ($rc -ne 0) { Falla 'npm ci fallo' }
}

# --- Servicio ---
if (-not $existe) {
  Paso "Creando servicio $Servicio"
  & $nssm install $Servicio $node 'src\index.js' $relJson
  if ($LASTEXITCODE -ne 0) { Falla 'nssm install fallo' }
}

$log = Join-Path $Logs 'agente.log'
& $nssm set $Servicio Application $node                     | Out-Null
& $nssm set $Servicio AppParameters "src\index.js $relJson" | Out-Null
& $nssm set $Servicio AppDirectory $Root                    | Out-Null   # obligatorio: rutas relativas
& $nssm set $Servicio DisplayName 'Balanza - Agente local'  | Out-Null
& $nssm set $Servicio Description "Agente de balanza/NVR. Config: $relJson" | Out-Null
& $nssm set $Servicio Start SERVICE_DELAYED_AUTO_START      | Out-Null   # espera a que haya red
& $nssm set $Servicio AppStdout $log                        | Out-Null
& $nssm set $Servicio AppStderr $log                        | Out-Null
& $nssm set $Servicio AppRotateFiles 1                      | Out-Null
& $nssm set $Servicio AppRotateOnline 1                     | Out-Null
& $nssm set $Servicio AppRotateBytes 10485760               | Out-Null   # rota cada 10 MB
& $nssm set $Servicio AppExit Default Restart               | Out-Null
& $nssm set $Servicio AppRestartDelay 3000                  | Out-Null
& $nssm set $Servicio AppThrottle 5000                      | Out-Null
# Parada con limite: Ctrl+C (el agente sale en menos de 1 s), a los 5 s como maximo lo termina con sus hijos
& $nssm set $Servicio AppStopMethodSkip 0                   | Out-Null
& $nssm set $Servicio AppStopMethodConsole 3000             | Out-Null
& $nssm set $Servicio AppStopMethodWindow 1000              | Out-Null
& $nssm set $Servicio AppStopMethodThreads 1000             | Out-Null
& $nssm set $Servicio AppKillProcessTree 1                  | Out-Null

Paso "Iniciando y verificando $Servicio"
Arrancar-Agente $Servicio $log
Write-Host "`nListo. Arranca solo con Windows. Log: $log" -ForegroundColor Green
Write-Host 'Reiniciar tras cambiar el JSON, o si queda en "Deteniendo": .\reiniciar-agente.ps1'
