# PASO 2 (despues de 1-instalar-app.ps1; orden: SCRIPTS.md).
# Instala Caddy como servicio de Windows (NSSM) delante del backend: HTTPS con certificado
# automatico de Let's Encrypt para el dominio, WebSocket incluido (agentes por wss://DOMINIO/agent).
#
# Uso (PowerShell COMO ADMINISTRADOR, desde la carpeta del repo):
#   1) Preparar (baja Caddy, escribe el Caddyfile, crea el servicio SIN arrancarlo):
#        powershell -ExecutionPolicy Bypass -File .\2-instalar-https.ps1
#   2) Cuando el router ya mande 80 y 443 a este equipo y el DNS resuelva:
#        powershell -ExecutionPolicy Bypass -File .\2-instalar-https.ps1 -Iniciar
#      (abre 80/443 en el firewall de Windows, deja el servicio automatico y lo arranca)
#
# Reconfigurar con Caddy corriendo: se puede, vuelve a quedar corriendo aunque falte -Iniciar.
# Los parametros quedan en tools\caddy\parametros.json: lo que no se pase se toma de ahi.
# Instalacion anterior a ese archivo: la primera vez hay que pasar -AcmeDominio y -PuertoHttps
# (sin DNS-01, desde una consola PowerShell, no con -File: .\2-instalar-https.ps1 -AcmeDominio '' -PuertoHttps 443).
#
# Caddy NO depende del servicio balanza: reiniciar el backend no corta el HTTPS (502 unos segundos).
#
# Opciones:
#   -Dominio x.y.z   dominio (por defecto balanza.cicloit.com)
#   -Email a@b.com   email para Let's Encrypt (opcional)
#   -Desinstalar     detiene y borra el servicio caddy (no toca el servicio balanza)
#
# Router SIN 80/443 publicos (NAT en puertos altos, ej. 63443 -> 443): Let's Encrypt no puede
# validar por HTTP, se usa DNS-01 con deSEC (desec.io):
#   -AcmeDominio x.y.z  zona en deSEC donde Caddy escribe el TXT (ej. acme.cicloit.com, delegada
#                       con NS a deSEC; en el DNS principal: CNAME _acme-challenge.DOMINIO -> esa zona)
#   -PuertoHttps N      puerto PUBLICO de HTTPS (ej. 63443): la redireccion http->https apunta ahi
#   El token de deSEC se pide por teclado (no queda en el historial) y se guarda solo en el servicio.
#   Ej: .\2-instalar-https.ps1 -AcmeDominio acme.cicloit.com -PuertoHttps 63443
#
# No arrancarlo antes de abrir los puertos: Let's Encrypt limita los intentos fallidos.

param(
  [string]$Dominio = 'balanza.cicloit.com',
  [string]$Email = '',
  [string]$AcmeDominio = '',
  [int]$PuertoHttps = 443,
  [switch]$Iniciar,
  [switch]$Desinstalar,
  [string]$Servicio = 'caddy'
)

$ErrorActionPreference = 'Stop'
$Root     = $PSScriptRoot
$CaddyDir = Join-Path $Root 'tools\caddy'
$CaddyExe = Join-Path $CaddyDir 'caddy.exe'
$Caddyfile = Join-Path $CaddyDir 'Caddyfile'
$DataDir  = Join-Path $CaddyDir 'data'     # certificados (no se versiona: tools/ esta en .gitignore)
$Logs     = Join-Path $CaddyDir 'logs'
$NssmExe  = Join-Path $Root 'tools\nssm\nssm.exe'
$ParametrosFile = Join-Path $CaddyDir 'parametros.json'
. (Join-Path $Root 'funciones-comunes.ps1')

Exigir-Admin

# --- NSSM (lo baja 1-instalar-app.ps1) ---
$nssm = $null
$cmd = Get-Command nssm -ErrorAction SilentlyContinue
if ($cmd) { $nssm = $cmd.Source } elseif (Test-Path $NssmExe) { $nssm = $NssmExe }
if (-not $nssm) { Falla 'No se encuentra NSSM. Correr primero .\1-instalar-app.ps1' }

# --- Desinstalar ---
if ($Desinstalar) {
  if (Get-Service -Name $Servicio -ErrorAction SilentlyContinue) {
    Paso "Borrando servicio $Servicio"
    Detener-Servicio $Servicio
    & $nssm remove $Servicio confirm
  } else { Write-Host "No existe el servicio $Servicio" }
  exit 0
}

# --- Estado actual y parametros guardados ---
$previo = Get-Service -Name $Servicio -ErrorAction SilentlyContinue
$estabaCorriendo = [bool]($previo -and $previo.Status -eq 'Running')
if (Test-Path $ParametrosFile) {
  $guardados = Get-Content $ParametrosFile -Raw | ConvertFrom-Json
  if (-not $PSBoundParameters.ContainsKey('Dominio'))     { $Dominio = $guardados.Dominio }
  if (-not $PSBoundParameters.ContainsKey('Email'))       { $Email = $guardados.Email }
  if (-not $PSBoundParameters.ContainsKey('AcmeDominio')) { $AcmeDominio = $guardados.AcmeDominio }
  if (-not $PSBoundParameters.ContainsKey('PuertoHttps')) { $PuertoHttps = [int]$guardados.PuertoHttps }
} elseif ($previo -and -not ($PSBoundParameters.ContainsKey('AcmeDominio') -and $PSBoundParameters.ContainsKey('PuertoHttps'))) {
  # Sin esto, los valores por defecto borrarian DNS-01, el token de deSEC y el puerto publico.
  Falla "El servicio $Servicio ya existe y no hay $ParametrosFile. Pasar -AcmeDominio y -PuertoHttps (y -Email) esta vez; quedan guardados."
}
if ($estabaCorriendo) { Marcar-PorArrancar $Servicio }   # si algo falla despues de detenerlo, no queda apagado

# --- Puerto del backend ---
$puerto = Leer-Puerto (Join-Path $Root 'Backend')

# --- Descargar Caddy ---
New-Item -ItemType Directory -Force $CaddyDir, $DataDir, $Logs | Out-Null
$usarDns = [bool]$AcmeDominio
if ($usarDns) {
  # Caddy oficial no trae el plugin DNS de deSEC: se baja un build con el modulo incluido
  $tiene = (Test-Path $CaddyExe) -and ((& $CaddyExe list-modules) -match 'dns\.providers\.desec')
  if (-not $tiene) {
    Paso 'Descargando Caddy con plugin dns.providers.desec'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    # Se baja y verifica aparte: una descarga fallida no pisa el caddy.exe que esta andando
    $CaddyNuevo = Join-Path $CaddyDir 'caddy.nuevo.exe'
    $url = 'https://caddyserver.com/api/download?os=windows&arch=amd64&p=github.com%2Fcaddy-dns%2Fdesec'
    try { Invoke-WebRequest $url -OutFile $CaddyNuevo -UseBasicParsing }
    catch { Falla "No se pudo bajar Caddy con deSEC. Bajarlo a mano de https://caddyserver.com/download (Windows amd64 + dns.providers.desec) y dejar caddy.exe en $CaddyDir" }
    if (-not ((& $CaddyNuevo list-modules) -match 'dns\.providers\.desec')) { Falla 'El caddy.exe bajado no tiene dns.providers.desec' }
    Detener-Servicio $Servicio
    Move-Item $CaddyNuevo $CaddyExe -Force
  }
}
if (-not (Test-Path $CaddyExe)) {
  Paso 'Descargando Caddy'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $ok = $false
  try {
    $rel = Invoke-RestMethod 'https://api.github.com/repos/caddyserver/caddy/releases/latest' -UseBasicParsing
    $asset = $rel.assets | Where-Object { $_.name -match '_windows_amd64\.zip$' } | Select-Object -First 1
    if ($asset) {
      $zip = Join-Path $env:TEMP 'caddy.zip'
      $tmp = Join-Path $env:TEMP 'caddy_extract'
      Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing
      if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
      Expand-Archive $zip -DestinationPath $tmp -Force
      Copy-Item (Join-Path $tmp 'caddy.exe') $CaddyExe -Force
      Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
      Write-Host "Caddy $($rel.tag_name) (GitHub)"
      $ok = $true
    }
  } catch { Write-Host '  GitHub no disponible, probando caddyserver.com' -ForegroundColor Yellow }
  if (-not $ok) {
    try {
      Invoke-WebRequest 'https://caddyserver.com/api/download?os=windows&arch=amd64' -OutFile $CaddyExe -UseBasicParsing
      $ok = $true
    } catch { }
  }
  if (-not $ok) { Falla "No se pudo descargar Caddy. Bajar caddy_*_windows_amd64.zip de https://github.com/caddyserver/caddy/releases y dejar caddy.exe en $CaddyDir" }
}
Write-Host (& $CaddyExe version)

# --- Caddyfile ---
Paso "Escribiendo Caddyfile para $Dominio -> 127.0.0.1:$puerto"
# grace_period: por defecto Caddy espera para siempre a que cierren las conexiones al
# detenerse (WebSocket de agentes/navegadores), y el servicio queda en StopPending.
$opciones = @("`tgrace_period 10s")
if ($Email) { $opciones += "`temail $Email" }
# Con HTTPS en un puerto publico distinto de 443, la redireccion automatica de Caddy
# mandaria a https://DOMINIO (443 publico = otro equipo): se desactiva y se hace a mano.
if ($PuertoHttps -ne 443) { $opciones += "`tauto_https disable_redirects" }
$global = if ($opciones) { "{`r`n" + ($opciones -join "`r`n") + "`r`n}`r`n`r`n" } else { '' }
$tls = ''
if ($usarDns) {
  $tls = @"
	tls {
		dns desec {
			token {env.DESEC_TOKEN}
		}
		dns_challenge_override_domain $AcmeDominio
		# deSEC tarda en replicar el TXT a todos sus servidores (anycast); Let's Encrypt
		# valida desde varias regiones y falla "During secondary validation" si no espera.
		# Medido 2026-11-04: ns2.desec.org tarda mas de 10 min en tener el TXT.
		propagation_delay 15m
		propagation_timeout 30m
	}

"@
}
$redir = ''
if ($PuertoHttps -ne 443) {
  $redir = @"


http://$Dominio {
	redir https://${Dominio}:$PuertoHttps{uri} permanent
}
"@
}
$contenido = @"
$global$Dominio {
$tls	encode gzip
	reverse_proxy 127.0.0.1:$puerto
	log {
		output file "$($Logs -replace '\\','/')/acceso.log" {
			roll_size 10MiB
			roll_keep 5
		}
	}
}$redir
"@
# Se escribe aparte y reemplaza al real solo si valida: un error no pisa la configuracion que anda.
# Sin BOM: Caddy no lo acepta
$CaddyfileNuevo = "$Caddyfile.nuevo"
[IO.File]::WriteAllText($CaddyfileNuevo, $contenido, (New-Object Text.UTF8Encoding $false))
Get-Content $CaddyfileNuevo

$env:XDG_DATA_HOME = $DataDir
$token = ''
if ($usarDns) {
  $seguro = Read-Host 'Token de API de deSEC (Enter = mantener el que ya tiene el servicio)' -AsSecureString
  $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro))
  if (-not $token -and (Get-Service -Name $Servicio -ErrorAction SilentlyContinue)) {
    # nssm responde en UTF-16: PowerShell 5.1 lo lee con NUL entre letras, hay que limpiarlos
    $entornoActual = ((& $nssm get $Servicio AppEnvironmentExtra) -join "`n") -replace "`0", ''
    if ($entornoActual -match '(?m)DESEC_TOKEN=(\S+)') { $token = $Matches[1] }
  }
  if (-not $token) { Falla 'Falta el token de deSEC' }
  $env:DESEC_TOKEN = $token
}
& $CaddyExe validate --config $CaddyfileNuevo --adapter caddyfile
if ($LASTEXITCODE -ne 0) { Falla "El Caddyfile nuevo no es valido (no se aplico): $CaddyfileNuevo" }
Move-Item $CaddyfileNuevo $Caddyfile -Force

# --- Servicio ---
if (Get-Service -Name $Servicio -ErrorAction SilentlyContinue) {
  Paso "Servicio $Servicio ya existe: reconfigurando"
  Detener-Servicio $Servicio
} else {
  Paso "Creando servicio $Servicio"
  & $nssm install $Servicio $CaddyExe | Out-Null
  if ($LASTEXITCODE -ne 0) { Falla 'nssm install fallo' }
  & $nssm set $Servicio Start SERVICE_DEMAND_START | Out-Null   # manual hasta correr con -Iniciar
}
$log = Join-Path $Logs 'caddy.log'
& $nssm set $Servicio Application $CaddyExe | Out-Null
& $nssm set $Servicio AppParameters "run --config `"$Caddyfile`" --adapter caddyfile" | Out-Null
& $nssm set $Servicio AppDirectory $CaddyDir | Out-Null
$entorno = @("XDG_DATA_HOME=$DataDir", "XDG_CONFIG_HOME=$DataDir")
if ($usarDns) { $entorno += "DESEC_TOKEN=$token" }
& $nssm set $Servicio AppEnvironmentExtra @entorno | Out-Null
& $nssm set $Servicio DisplayName "Caddy (HTTPS $Dominio)" | Out-Null
& $nssm set $Servicio Description "Proxy HTTPS de $Dominio hacia 127.0.0.1:$puerto (balanza)" | Out-Null
& $nssm set $Servicio AppStdout $log | Out-Null
& $nssm set $Servicio AppStderr $log | Out-Null
& $nssm set $Servicio AppRotateFiles 1 | Out-Null
& $nssm set $Servicio AppRotateOnline 1 | Out-Null
& $nssm set $Servicio AppRotateBytes 10485760 | Out-Null
& $nssm set $Servicio AppExit Default Restart | Out-Null
& $nssm set $Servicio AppRestartDelay 5000 | Out-Null
# Al detener: Ctrl+C y hasta 15 s para cerrar (grace_period 10s), despues lo mata con sus hijos
& $nssm set $Servicio AppStopMethodSkip 0 | Out-Null
& $nssm set $Servicio AppStopMethodConsole 15000 | Out-Null
& $nssm set $Servicio AppStopMethodWindow 2000 | Out-Null
& $nssm set $Servicio AppStopMethodThreads 2000 | Out-Null
& $nssm set $Servicio AppKillProcessTree 1 | Out-Null
# Sin dependencias (quita la vieja caddy -> balanza): Caddy sobrevive a los reinicios del backend
sc.exe config $Servicio depend= / | Out-Null
if ($LASTEXITCODE -ne 0) { Falla "No se pudo quitar la dependencia de $Servicio" }

# Configuracion aplicada: queda para las proximas corridas (el token NO se guarda aca)
@{ Dominio = $Dominio; Email = $Email; AcmeDominio = $AcmeDominio; PuertoHttps = $PuertoHttps } |
  ConvertTo-Json | Set-Content -Path $ParametrosFile -Encoding Ascii

# Algo mas ocupando 80/443 en este equipo (IIS, otro servidor web)?
$ocupados = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 80, 443 }
foreach ($o in $ocupados) {
  $p = Get-Process -Id $o.OwningProcess -ErrorAction SilentlyContinue
  if ($p -and $p.ProcessName -ne 'caddy') {
    Write-Host "AVISO: el puerto $($o.LocalPort) ya lo usa '$($p.ProcessName)' (PID $($o.OwningProcess)). Caddy no va a poder arrancar hasta liberarlo (IIS: 'iisreset /stop' o detener 'W3SVC')." -ForegroundColor Yellow
  }
}

# Sin -Iniciar solo queda apagado si ya estaba apagado: una reconfiguracion no corta el HTTPS.
if (-not $Iniciar -and -not $estabaCorriendo) {
  Write-Host "`nListo: Caddy configurado pero SIN arrancar." -ForegroundColor Green
  Write-Host 'Cuando el router mande los puertos a este equipo y el DNS resuelva, arrancarlo con:'
  Write-Host '  powershell -ExecutionPolicy Bypass -File .\2-instalar-https.ps1 -Iniciar'
  exit 0
}

# --- Iniciar ---
Paso 'Abriendo 80 y 443 en el firewall de Windows'
if (-not (Get-NetFirewallRule -DisplayName 'Balanza HTTPS' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'Balanza HTTPS' -Direction Inbound -Protocol TCP -LocalPort 80, 443 -Action Allow | Out-Null
} else { Write-Host "Regla 'Balanza HTTPS' ya existe" }

& $nssm set $Servicio Start SERVICE_AUTO_START | Out-Null
Paso "Iniciando $Servicio (el primer certificado tarda unos segundos)"
Arrancar-Servicio $Servicio
$script:PorArrancar = @()
Start-Sleep -Seconds 15
Get-Service $Servicio | Format-Table Name, Status, StartType -AutoSize
Write-Host "Ultimas lineas de $log :"
if (Test-Path $log) { Get-Content $log -Tail 15 }
if ((Get-Service -Name $Servicio).Status -ne 'Running') { Falla "$Servicio no quedo corriendo. Ver $log" }
$pub = if ($PuertoHttps -ne 443) { "${Dominio}:$PuertoHttps" } else { $Dominio }
Write-Host "`nProbar desde afuera: https://$pub  (buscar 'certificate obtained successfully' en el log)"
Write-Host "Despues: agentes a wss://$pub/agent y cerrar el 3000 (router + regla 'Balanza $puerto')."
