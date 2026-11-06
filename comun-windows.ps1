# Funciones compartidas por los scripts de servicio de Windows.
# No se corre solo: lo cargan servicio-windows.ps1, actualizar-windows.ps1, reiniciar-windows.ps1
# y caddy-windows.ps1 con ". (Join-Path $PSScriptRoot 'comun-windows.ps1')".

# Servicios que el script detuvo y que hay que volver a arrancar, incluso si algo falla despues.
$script:PorArrancar = @()

function Paso($t) { Write-Host "`n> $t" -ForegroundColor Cyan }

# Corta el script con error, sin dejar apagado lo que el script haya detenido.
function Falla($t) {
  Write-Host "ERROR: $t" -ForegroundColor Red
  Arrancar-Pendientes
  exit 1
}

function Exigir-Admin {
  $identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
  $admin = ([Security.Principal.WindowsPrincipal]$identidad).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $admin) { Falla 'Abrir PowerShell como administrador (clic derecho > Ejecutar como administrador).' }
}

function Marcar-PorArrancar($nombre) {
  if ($script:PorArrancar -notcontains $nombre) { $script:PorArrancar += $nombre }
}

# Vuelve a arrancar lo que se detuvo. Un fallo aca se avisa pero no corta el script.
function Arrancar-Pendientes {
  $lista = $script:PorArrancar
  $script:PorArrancar = @()
  foreach ($d in $lista) {
    Write-Host "  Arrancando $d"
    try { Start-Service $d -ErrorAction Stop }
    catch { Write-Host "  No arranco $d : $($_.Exception.Message)" -ForegroundColor Yellow }
  }
}

function Esperar-Detenido($nombre, [int]$segundos) {
  for ($i = 0; $i -lt $segundos; $i++) {
    Start-Sleep -Seconds 1
    if ((Get-Service -Name $nombre).Status -eq 'Stopped') { return $true }
  }
  return $false
}

# Detiene el servicio; si a los 30 s sigue trabado (STOP_PENDING), mata el proceso (nssm + hijos).
# Si tiene dependientes corriendo los para antes (Windows no deja: sc stop -> error 1051) y los
# marca para volver a arrancarlos.
function Detener-Servicio($nombre) {
  $svc = Get-Service -Name $nombre -ErrorAction SilentlyContinue
  if (-not $svc -or $svc.Status -eq 'Stopped') { return }
  foreach ($d in ($svc.DependentServices | Where-Object Status -ne 'Stopped')) {
    Write-Host "  Deteniendo $($d.Name) (depende de $nombre)"
    Detener-Servicio $d.Name
    Marcar-PorArrancar $d.Name
  }
  sc.exe stop $nombre | Out-Null
  if (Esperar-Detenido $nombre 30) { return }
  $procId = (Get-CimInstance Win32_Service -Filter "Name='$nombre'").ProcessId
  if ($procId) {
    Write-Host "  $nombre no se detuvo en 30 s: matando PID $procId" -ForegroundColor Yellow
    taskkill /PID $procId /T /F | Out-Null
  }
  if (Esperar-Detenido $nombre 10) { return }
  Falla "No se pudo detener $nombre"
}

function Arrancar-Servicio($nombre) {
  try { Start-Service $nombre -ErrorAction Stop }
  catch { Falla "No arranco $nombre : $($_.Exception.Message)" }
}

# Espera a que el puerto quede libre. Si lo ocupa un backend huerfano (node src\server.js sin
# servicio) lo mata; si lo ocupa otra cosa no la toca y corta con error.
function Liberar-Puerto([int]$puerto) {
  for ($i = 0; $i -lt 10; $i++) {
    $conexiones = Get-NetTCPConnection -State Listen -LocalPort $puerto -ErrorAction SilentlyContinue
    if (-not $conexiones) { return }
    foreach ($id in ($conexiones | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)) {
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$id"
      if ($proc -and $proc.Name -eq 'node.exe' -and $proc.CommandLine -match 'src\\server\.js') {
        Write-Host "  Backend huerfano en el puerto $puerto : matando PID $id" -ForegroundColor Yellow
        taskkill /PID $id /T /F | Out-Null
      } else {
        Falla "El puerto $puerto lo usa otro proceso: $($proc.Name) (PID $id)"
      }
    }
    Start-Sleep -Seconds 1
  }
  Falla "El puerto $puerto sigue ocupado"
}

function Leer-Puerto($backend) {
  $envFile = Join-Path $backend '.env'
  if (Test-Path $envFile) {
    $linea = Select-String -Path $envFile -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
    if ($linea) { return [int]$linea.Matches[0].Groups[1].Value }
  }
  return 3000
}

# $true si /api/health responde 200 dentro del plazo (el 500 de base caida cuenta como fallo).
function Esperar-Health([int]$puerto, [int]$segundos = 30) {
  $limite = (Get-Date).AddSeconds($segundos)
  do {
    try {
      $r = Invoke-WebRequest "http://127.0.0.1:$puerto/api/health" -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) { return $true }
    } catch { }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $limite)
  return $false
}

# Detiene y arranca el backend. Vuelve a arrancar tambien lo que se haya detenido por dependencia.
function Reiniciar-Backend($nombre, [int]$puerto) {
  Detener-Servicio $nombre
  Liberar-Puerto $puerto
  Arrancar-Servicio $nombre
  Arrancar-Pendientes
}

# Avisa si Caddy esta instalado y no corre: HTTPS y agentes por wss quedan sin servicio.
function Avisar-Caddy {
  $caddy = Get-Service -Name 'caddy' -ErrorAction SilentlyContinue
  if ($caddy -and $caddy.Status -ne 'Running') {
    Write-Host "AVISO: el servicio caddy esta $($caddy.Status). Arrancarlo: .\reiniciar-windows.ps1 -Servicio caddy" -ForegroundColor Yellow
  }
}
