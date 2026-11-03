# Graph Report - Balanza  (2026-11-03)

## Corpus Check
- 146 files · ~75,026 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 789 nodes · 2029 edges · 44 communities (43 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bde44ccd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- sendScopeError
- balanzaService.js
- server.js
- devDependencies
- cx
- AgenteBalanza
- package.json
- GestionApp.jsx
- usuariosController.js
- PesadaForm.jsx
- useAuth
- UsuariosAdmin.jsx
- Despliegue: central en VPS + agentes locales por sitio
- 06 — Despliegue y mantenimiento
- Pasos (en cada PC)
- TablaItems.jsx
- EnVivo.jsx
- package.json
- backupController.js
- usePermissions.js
- 08 — Errores comunes y cómo solucionarlos
- AppShell.jsx
- smoke_agentes.mjs
- README.md
- sim_nvr.mjs
- dbErrors.js
- 01 — Arquitectura
- Balanza
- 11 — pm2 y reinicio del container (Daytona)
- 05 — Operación diaria
- 09 — Interfaz y sistema de diseño
- getAuthHeaders
- smoke_scope.mjs
- 02 — Instalación y configuración
- 07 — Pendientes y seguridad
- Agente local de balanzas
- 03 — Usuarios, roles y alcance
- Frontend — Sistema de Balanzas
- arrancar.sh
- servicio-windows.ps1

## God Nodes (most connected - your core abstractions)
1. `sendScopeError()` - 87 edges
2. `scopeSql()` - 54 edges
3. `cx()` - 52 edges
4. `userForRead()` - 31 edges
5. `getAuthHeaders()` - 29 edges
6. `pool` - 26 edges
7. `useAuth()` - 21 edges
8. `AgenteBalanza` - 18 edges
9. `requireAuth()` - 18 edges
10. `requirePermission()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `usePesosEnVivo()` --indirect_call--> `conectar()`  [INFERRED]
  Frontend/src/components/EnVivo.jsx → Backend/src/services/balanzaService.js
- `resolverBalanzaWs()` --calls--> `scopeSql()`  [EXTRACTED]
  Backend/src/server.js → Backend/src/utils/scope.js
- `balanzasEnAlcance()` --calls--> `scopeSql()`  [EXTRACTED]
  Backend/src/server.js → Backend/src/utils/scope.js
- `Marca()` --calls--> `cx()`  [EXTRACTED]
  Frontend/src/components/layout/Sidebar.jsx → Frontend/src/lib/cx.js
- `Navegacion()` --calls--> `cx()`  [EXTRACTED]
  Frontend/src/components/layout/Sidebar.jsx → Frontend/src/lib/cx.js

## Import Cycles
- None detected.

## Communities (44 total, 1 thin omitted)

### Community 0 - "sendScopeError"
Cohesion: 0.08
Nodes (71): pool, createChofer(), deleteChofer(), getChoferById(), getChoferes(), updateChofer(), assertGestionLocalidades(), createLocalidad() (+63 more)

### Community 1 - "balanzaService.js"
Cohesion: 0.06
Nodes (74): [arg, flag], listar(), main(), buildSnapshotUrl(), cacheCanalesPorLocalidad, CAPTURA, capturarTodo(), CAPTURAS_DIR (+66 more)

### Community 2 - "server.js"
Cohesion: 0.10
Nodes (42): hasPermission(), PERMISSIONS, ROLE_PERMISSIONS, createEmpresa(), deleteEmpresa(), getConfigEmpresaActual(), getEmpresas(), updateEmpresa() (+34 more)

### Community 3 - "devDependencies"
Cohesion: 0.05
Nodes (42): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, dependencies, lucide-react, react, react-dom (+34 more)

### Community 4 - "cx"
Cohesion: 0.17
Nodes (20): ActividadSemanal(), DIAS, HORAS, Kpi(), BalanzaDisplay, FORM_INICIAL, MESES, SearchableSelect (+12 more)

### Community 5 - "AgenteBalanza"
Cohesion: 0.13
Nodes (15): AgenteBalanza, textoError(), cleanFrame(), createStabilityTracker(), parseFrame(), splitFrames(), agentes, errores (+7 more)

### Community 6 - "package.json"
Cohesion: 0.06
Nodes (32): archiver, author, dependencies, archiver, cors, digest-fetch, dotenv, express (+24 more)

### Community 7 - "GestionApp.jsx"
Cohesion: 0.11
Nodes (18): Configuracion(), Guard(), ModalForm, getFriendlyError(), PesadaForm(), ProtectedRoute(), choferesConfig, empresasConfig (+10 more)

### Community 8 - "usuariosController.js"
Cohesion: 0.13
Nodes (28): [username, nueva], ROLES, authLogin(), authLogout(), cambiarPasswordPropia(), createUsuario(), deleteUsuario(), getSesion() (+20 more)

### Community 9 - "PesadaForm.jsx"
Cohesion: 0.25
Nodes (12): ContenedorModal(), kg(), CONFIG_VACIA, InputField, Alert(), TONOS, Button, Field() (+4 more)

### Community 10 - "useAuth"
Cohesion: 0.33
Nodes (7): App(), AppContent(), LoginPage(), AuthContext, AuthProvider(), useAuth(), getStoredUser()

### Community 11 - "UsuariosAdmin.jsx"
Cohesion: 0.18
Nodes (18): Respaldos(), DispositivosConfig(), ReportesHistorial(), FeedbackProvider(), TONOS, alcanceDe(), pedir(), ResetPassword() (+10 more)

### Community 12 - "Despliegue: central en VPS + agentes locales por sitio"
Cohesion: 0.11
Nodes (18): 1. Central (VPS), 2. Conversor RS232→TCP (en cada sitio), 3. Agente (PC de cada sitio), 4. Diagnóstico, 5. Prueba con hardware sin balanza, 6. Checklist por sitio nuevo, Alta de cada balanza, Arquitectura (+10 more)

### Community 13 - "06 — Despliegue y mantenimiento"
Cohesion: 0.08
Nodes (26): 06 — Despliegue y mantenimiento, 2. Instalar, 2. Instalar, 3. Base de datos, 3. Base de datos, 4. `Backend\.env`, 4. `Backend/.env`, 5. Arrancar como servicio y abrir el puerto (+18 more)

### Community 14 - "Pasos (en cada PC)"
Cohesion: 0.14
Nodes (13): 10 — Instalación local por sitio, 1. Código, 2. Base de datos, 3. Dejar solo la localidad del sitio, 4. Rangos de IDs (obligatorio), 5. `Backend/.env`, 6. Dispositivos y arranque, 7. Respaldos (+5 more)

### Community 15 - "TablaItems.jsx"
Cohesion: 0.14
Nodes (14): DetallePesadaModal(), formatFecha(), kg(), Peso(), AccionesCatalogo(), CardItem, COLUMNAS_PESO, estaActivo() (+6 more)

### Community 16 - "EnVivo.jsx"
Cohesion: 0.24
Nodes (12): COLORES, colorLocalidad(), EnVivo(), esHoy(), hace(), hora(), kg(), LocalidadTag() (+4 more)

### Community 17 - "package.json"
Cohesion: 0.17
Nodes (11): dependencies, ws, description, ws, license, main, name, scripts (+3 more)

### Community 18 - "backupController.js"
Cohesion: 0.20
Nodes (11): BACKUP_DIR, CAPTURAS_DIR, createBackup(), __dirname, DOCUMENTOS_DIR, downloadBackup(), __filename, getPgDumpCommand() (+3 more)

### Community 19 - "usePermissions.js"
Cohesion: 0.32
Nodes (10): canEditModule(), canWrite(), hasModuleAccess(), hasPermission(), hasPermissions(), MODULE_PERMISSIONS, MODULES, PERMISSIONS (+2 more)

### Community 20 - "08 — Errores comunes y cómo solucionarlos"
Cohesion: 0.18
Nodes (10): 08 — Errores comunes y cómo solucionarlos, 1. Login y sesión, 2. Permisos, 3. Pesadas, 4. Balanza y agente, 5. Dispositivos, 6. Catálogos y base de datos, 7. Archivos, fotos y respaldos (+2 more)

### Community 21 - "AppShell.jsx"
Cohesion: 0.16
Nodes (14): AppShell(), leerColapsado(), Marca(), Navegacion(), Sidebar(), iniciales(), Topbar(), NAV_GROUPS (+6 more)

### Community 22 - "smoke_agentes.mjs"
Cohesion: 0.33
Nodes (9): agenteFalso(), api(), [BASE = 'http://localhost:3000', TOKEN_A, TOKEN_B], check(), clienteWs(), esperar(), login(), main() (+1 more)

### Community 23 - "README.md"
Cohesion: 0.36
Nodes (3): Documentación — Sistema de Balanzas (Balanza Pro), Resumen en una página, Índice

### Community 24 - "sim_nvr.mjs"
Cohesion: 0.36
Nodes (7): autorizado(), JPG_BASE, jpgCanal(), md5(), nonces, parseAuth(), [puerto = 8090, canales = 4, usuario = 'admin', password = 'admin']

### Community 25 - "dbErrors.js"
Cohesion: 0.32
Nodes (7): columna(), COLUMNAS, INEXISTENTES, traducirErrorDb(), UNICOS, USOS, valorDuplicado()

### Community 26 - "01 — Arquitectura"
Cohesion: 0.25
Nodes (7): 01 — Arquitectura, Autenticación, Base de datos, Dos formas de leer una balanza, Estructura del repositorio, Recorrido del peso, Vista general

### Community 27 - "Balanza"
Cohesion: 0.25
Nodes (8): 04 — Balanzas, agentes y cámaras, Balanza, Conversor RS232→TCP, Grabadora (NVR / cámaras), Modo agente (lo normal con central en internet), Modo directo, Quién saca las fotos, Validación del peso

### Community 28 - "11 — pm2 y reinicio del container (Daytona)"
Cohesion: 0.25
Nodes (7): 11 — pm2 y reinicio del container (Daytona), Actualizar sin que se caiga el container, Comandos útiles, Después de cada reinicio del container, Opcional: que arranque solo al entrar por ssh, Si el container se **borra** (no solo se para), Una sola vez: pasar al ecosystem

### Community 29 - "05 — Operación diaria"
Cohesion: 0.29
Nodes (6): 05 — Operación diaria, Dashboard, Lista de pesadas, Pesada de un camión, Reportes, Respaldos

### Community 30 - "09 — Interfaz y sistema de diseño"
Cohesion: 0.29
Nodes (6): 09 — Interfaz y sistema de diseño, Componentes base (`src/components/ui/`), Layout, Pantallas, Reglas para pantallas nuevas, Tema y colores

### Community 31 - "getAuthHeaders"
Cohesion: 0.17
Nodes (13): CambiarPasswordModal(), Dashboard(), formatNumero(), formatPeso(), kgCompleto(), Ranking(), ReportePesadas(), ReportePreview() (+5 more)

### Community 32 - "smoke_scope.mjs"
Cohesion: 0.60
Nodes (5): api(), check(), login(), main(), wsMensajes()

### Community 33 - "02 — Instalación y configuración"
Cohesion: 0.33
Nodes (6): 02 — Instalación y configuración, Base de datos, Desarrollo local, Producción (central), Requisitos, Variables de entorno (`Backend/.env`)

### Community 34 - "07 — Pendientes y seguridad"
Cohesion: 0.33
Nodes (5): 07 — Pendientes y seguridad, Funcionalidad, Hecho (2026-10-26), Infraestructura, Seguridad (antes de producción)

### Community 35 - "Agente local de balanzas"
Cohesion: 0.40
Nodes (4): Agente local de balanzas, Alta de un sitio, Cómo funciona, Prueba local con varios sitios

### Community 36 - "03 — Usuarios, roles y alcance"
Cohesion: 0.40
Nodes (4): 03 — Usuarios, roles y alcance, Alcance, Gestión de usuarios y contraseñas, Roles

### Community 37 - "Frontend — Sistema de Balanzas"
Cohesion: 0.40
Nodes (4): Desarrollo, Estructura, Frontend — Sistema de Balanzas, Producción

### Community 42 - "servicio-windows.ps1"
Cohesion: 0.60
Nodes (3): Falla(), Get-Nssm(), Paso()

## Knowledge Gaps
- **221 isolated node(s):** `name`, `version`, `description`, `type`, `main` (+216 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `conectar()` connect `balanzaService.js` to `EnVivo.jsx`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Why does `usePesosEnVivo()` connect `EnVivo.jsx` to `balanzaService.js`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Why does `cx()` connect `cx` to `GestionApp.jsx`, `PesadaForm.jsx`, `UsuariosAdmin.jsx`, `TablaItems.jsx`, `EnVivo.jsx`, `AppShell.jsx`, `getAuthHeaders`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _221 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sendScopeError` be split into smaller, more focused modules?**
  _Cohesion score 0.08372093023255814 - nodes in this community are weakly interconnected._
- **Should `balanzaService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.060828680575962385 - nodes in this community are weakly interconnected._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09701928696668614 - nodes in this community are weakly interconnected._