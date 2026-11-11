# Actualiza el agente a la ultima version de GitHub sin tocar la configuracion del sitio.
# Baja el zip del repo, toma solo la carpeta Agente y reemplaza el codigo. Conserva sitios\*.json,
# tools\ (NSSM), logs\ y node_modules (npm ci solo si cambio package-lock.json).
# Deja una copia de la version anterior en respaldo-anterior\ por si hay que volver atras.
# No necesita la app ni el servicio balanza: en la PC del sitio solo esta esta carpeta.
#
# Uso (PowerShell COMO ADMINISTRADOR, desde la carpeta del agente):
#   powershell -ExecutionPolicy Bypass -File .\actualizar-agente.ps1
# Opciones:
#   -Zip <archivo>   usa un zip ya descargado del repo (PC sin acceso a GitHub)
#   -Rama <nombre>   rama de GitHub (por defecto master)
#   -Volver          vuelve a la version guardada en respaldo-anterior\
#   -Servicio <n>    nombre del servicio (por defecto BalanzaAgente)

param(
  [string]$Zip,
  [string]$Rama = 'master',
  [switch]$Volver,
  [string]$Servicio = 'BalanzaAgente'
)

$ErrorActionPreference = 'Stop'
$Root     = $PSScriptRoot
$Repo     = 'CicloIT/BalanzaGlobal'
$Respaldo = Join-Path $Root 'respaldo-anterior'
$log      = Join-Path $Root 'logs\agente.log'
. (Join-Path $Root 'funciones-agente.ps1')

# Lo que es codigo del agente (se reemplaza). Todo lo demas de la carpeta queda como esta.
$Carpetas = @('src')
$Archivos = @('package.json', 'package-lock.json', '*.ps1', '*.md', '.gitignore', 'sitios\ejemplo.json')

function Version-De($dir) {
  $pkg = Join-Path $dir 'package.json'
  if (Test-Path $pkg) { return (Get-Content $pkg -Raw | ConvertFrom-Json).version }
  return '?'
}

function Hash-De($archivo) {
  if (Test-Path $archivo) { return (Get-FileHash $archivo -Algorithm SHA256).Hash }
  return ''
}

# Copia el codigo del agente de $origen a $destino (src se reemplaza entero: no quedan archivos viejos).
function Copiar-Codigo($origen, $destino) {
  foreach ($c in $Carpetas) {
    $o = Join-Path $origen $c
    if (-not (Test-Path $o)) { continue }
    $d = Join-Path $destino $c
    if (Test-Path $d) { Remove-Item $d -Recurse -Force }
    Copy-Item $o $d -Recurse -Force
  }
  foreach ($patron in $Archivos) {
    $dirRel = Split-Path $patron -Parent
    foreach ($f in @(Get-ChildItem (Join-Path $origen $patron) -File -Force -ErrorAction SilentlyContinue)) {
      $d = if ($dirRel) { Join-Path $destino $dirRel } else { $destino }
      New-Item -ItemType Directory -Force $d | Out-Null
      Copy-Item $f.FullName (Join-Path $d $f.Name) -Force
    }
  }
}

Exigir-Admin
if (-not (Get-Service -Name $Servicio -ErrorAction SilentlyContinue)) {
  Falla "No existe el servicio $Servicio. Instalar primero con .\instalar-agente.ps1 -Sitio <sitio>"
}
$versionActual = Version-De $Root
$tmp = Join-Path $env:TEMP 'balanza_agente_update'

# --- Origen: zip de GitHub, zip local o respaldo ---
if ($Volver) {
  if (-not (Test-Path (Join-Path $Respaldo 'src\index.js'))) { Falla "No hay version anterior en $Respaldo" }
  $nuevo = $Respaldo
  Paso "Volviendo a la version anterior ($(Version-De $nuevo))"
} else {
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  New-Item -ItemType Directory -Force $tmp | Out-Null
  if ($Zip) {
    if (-not (Test-Path $Zip)) { Falla "No existe $Zip" }
    $zipFile = (Resolve-Path $Zip).Path
  } else {
    Paso "Descargando $Repo (rama $Rama) de GitHub"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $zipFile = Join-Path $tmp 'repo.zip'
    $url = "https://github.com/$Repo/archive/refs/heads/$Rama.zip"
    try { Invoke-WebRequest -Uri $url -OutFile $zipFile -UseBasicParsing }
    catch { Falla "No se pudo descargar $url : $($_.Exception.Message). Sin internet: bajar el zip en otra PC y usar -Zip <archivo>" }
  }
  Paso 'Descomprimiendo'
  $extraido = Join-Path $tmp 'extraido'
  Expand-Archive $zipFile -DestinationPath $extraido -Force
  # El zip trae una carpeta raiz (BalanzaGlobal-master\...); se busca la carpeta Agente con su index.js
  $indice = Get-ChildItem $extraido -Recurse -Filter index.js |
    Where-Object { $_.FullName -match '\\Agente\\src\\index\.js$' } | Select-Object -First 1
  if (-not $indice) { Falla 'El zip no trae Agente\src\index.js. Es el zip correcto del repo?' }
  $nuevo = Split-Path (Split-Path $indice.FullName -Parent) -Parent
}

$versionNueva = Version-De $nuevo
Write-Host "Version actual: $versionActual -> nueva: $versionNueva"
$cambioLock = (Hash-De (Join-Path $Root 'package-lock.json')) -ne (Hash-De (Join-Path $nuevo 'package-lock.json'))

# --- Respaldo de la version actual (no al volver: pisaria el respaldo que se esta usando) ---
if (-not $Volver) {
  Paso "Guardando version actual en respaldo-anterior\"
  if (Test-Path $Respaldo) { Remove-Item $Respaldo -Recurse -Force }
  New-Item -ItemType Directory -Force $Respaldo | Out-Null
  Copiar-Codigo $Root $Respaldo
}

# --- Detener, reemplazar, dependencias, arrancar ---
Paso "Deteniendo $Servicio"
if ((Get-Service -Name $Servicio).Status -eq 'Running') { $script:RearrancarAlFallar = $Servicio }
Detener-Agente $Servicio

Paso 'Reemplazando archivos del agente (sitios\*.json, tools\ y logs\ no se tocan)'
try { Copiar-Codigo $nuevo $Root }
catch {
  Write-Host "  Fallo la copia: $($_.Exception.Message)" -ForegroundColor Yellow
  if (-not $Volver) {
    Write-Host '  Restaurando la version anterior'
    Copiar-Codigo $Respaldo $Root
  }
  Falla 'No se pudo actualizar. Quedo la version anterior.'
}

if ($cambioLock -or -not (Test-Path (Join-Path $Root 'node_modules\ws'))) {
  Paso 'Cambiaron las dependencias: npm ci'
  Push-Location $Root; npm ci; $rc = $LASTEXITCODE; Pop-Location
  if ($rc -ne 0) { Falla 'npm ci fallo. Para volver atras: .\actualizar-agente.ps1 -Volver' }
}

Paso "Arrancando $Servicio"
Arrancar-Agente $Servicio $log
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
Write-Host "`nListo: agente $versionActual -> $versionNueva. Log: $log" -ForegroundColor Green
if (-not $Volver) { Write-Host 'Si algo anda mal: .\actualizar-agente.ps1 -Volver' }
