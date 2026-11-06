# Funciones de los scripts del agente. No se corre solo: lo cargan instalar-agente.ps1 y
# reiniciar-agente.ps1. Tiene que quedar en la misma carpeta que ellos.

# Limite de parada: NSSM usa hasta 5 s (ver AppStopMethod* en instalar-agente.ps1).
$script:EsperaParada = 10
# Si algo falla con el agente detenido, se intenta dejarlo corriendo otra vez.
$script:RearrancarAlFallar = $null

function Paso($t) { Write-Host "`n> $t" -ForegroundColor Cyan }

function Falla($t) {
  Write-Host "ERROR: $t" -ForegroundColor Red
  if ($script:RearrancarAlFallar) {
    $nombre = $script:RearrancarAlFallar
    $script:RearrancarAlFallar = $null
    Write-Host "  Intentando volver a arrancar $nombre"
    try { Start-Service $nombre -ErrorAction Stop }
    catch { Write-Host "  No arranco $nombre : $($_.Exception.Message)" -ForegroundColor Yellow }
  }
  exit 1
}

function Exigir-Admin {
  $identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
  $admin = ([Security.Principal.WindowsPrincipal]$identidad).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $admin) { Falla 'Abrir PowerShell como administrador (clic derecho > Ejecutar como administrador).' }
}

# Nombre del JSON con el que esta configurado el servicio (ej. quines), o $null.
function Sitio-DelServicio($nombre) {
  $reg = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\$nombre\Parameters" -ErrorAction SilentlyContinue
  if ($reg -and $reg.AppParameters -match 'sitios[\\/]([^\\/\s"]+)\.json') { return $Matches[1] }
  return $null
}

function Pid-DelServicio($nombre) {
  $svc = Get-CimInstance Win32_Service -Filter "Name='$nombre'"
  if ($svc -and $svc.ProcessId) { return [int]$svc.ProcessId }
  return 0
}

# Procesos node de este agente: hijos del nssm del servicio, o lanzados con el mismo JSON (huerfanos
# de una parada anterior o abiertos a mano). No toca agentes de otros sitios ni otros programas node.
function Procesos-Agente($nombre, [string[]]$sitios) {
  $padre = Pid-DelServicio $nombre
  $patrones = @($sitios | Where-Object { $_ } | ForEach-Object { 'index\.js"?\s+"?(.*[\\/])?' + [regex]::Escape($_) + '\.json' })
  @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $proc = $_
    ($padre -and $proc.ParentProcessId -eq $padre) -or
    (@($patrones | Where-Object { $proc.CommandLine -match $_ }).Count -gt 0)
  })
}

# Detiene el agente y garantiza que no quede ningun proceso. Si el servicio se traba en "Deteniendo"
# (STOP_PENDING) mata nssm y node a los 10 s. No espera a nadie mas: el agente no guarda estado.
function Detener-Agente($nombre, [string]$sitioExtra = '') {
  $sitios = @((Sitio-DelServicio $nombre), $sitioExtra)
  $svc = Get-Service -Name $nombre -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -ne 'Stopped') {
    sc.exe stop $nombre | Out-Null
    $parado = $false
    for ($i = 0; $i -lt $script:EsperaParada -and -not $parado; $i++) {
      Start-Sleep -Seconds 1
      $parado = (Get-Service -Name $nombre).Status -eq 'Stopped'
    }
    if (-not $parado) {
      $vivos = @(Procesos-Agente $nombre $sitios)
      # Este dato dice que parte se traba: si ya no hay node, el problema es NSSM y no el agente.
      $causa = if ($vivos) { "node sigue vivo (PID $($vivos.ProcessId -join ', '))" } else { 'node ya termino, se trabo NSSM' }
      $procId = Pid-DelServicio $nombre
      Write-Host "  $nombre no se detuvo en $($script:EsperaParada) s ($causa): matando nssm PID $procId" -ForegroundColor Yellow
      if ($procId) { taskkill /PID $procId /T /F | Out-Null }
      for ($i = 0; $i -lt 15 -and -not $parado; $i++) {
        Start-Sleep -Seconds 1
        $parado = (Get-Service -Name $nombre).Status -eq 'Stopped'
      }
      if (-not $parado) { Falla "$nombre sigue en $((Get-Service -Name $nombre).Status) despues de matar el proceso. Reiniciar la PC." }
    }
  }
  # Sueltos: quedan si alguna vez se mato nssm solo, o si hay uno abierto en una consola.
  # Dos agentes con el mismo token se echan entre si (cierre 4409).
  for ($i = 0; $i -lt 5; $i++) {
    $sueltos = @(Procesos-Agente $nombre $sitios)
    if (-not $sueltos) { return }
    foreach ($p in $sueltos) {
      Write-Host "  Matando agente suelto PID $($p.ProcessId): $($p.CommandLine)" -ForegroundColor Yellow
      taskkill /PID $p.ProcessId /T /F | Out-Null
    }
    Start-Sleep -Seconds 1
  }
  Falla "No se pudieron terminar los procesos del agente: $(@(Procesos-Agente $nombre $sitios).ProcessId -join ', ')"
}

# Arranca y comprueba que siga vivo: un agente con config mala arranca y se cae en bucle.
function Arrancar-Agente($nombre, $log) {
  try { Start-Service $nombre -ErrorAction Stop }
  catch { Falla "No arranco $nombre : $($_.Exception.Message). Log: $log" }
  $script:RearrancarAlFallar = $null
  Start-Sleep -Seconds 8
  $estado = (Get-Service -Name $nombre).Status
  $vivos = @(Procesos-Agente $nombre @())
  if ($estado -ne 'Running' -or -not $vivos) {
    if (Test-Path $log) { Get-Content $log -Tail 20 }
    Falla "$nombre no quedo andando (estado $estado). Ver el log: $log"
  }
  Get-Service -Name $nombre | Format-Table Name, Status, StartType -AutoSize
  if (Test-Path $log) { Get-Content $log -Tail 10 }
}
