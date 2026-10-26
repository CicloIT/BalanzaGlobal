# 03 — Usuarios, roles y alcance

Cada usuario tiene un **rol** (qué puede hacer) y un **alcance** (qué datos ve), dado por
`empresa_id` y `localidad_id`.

## Alcance

| Usuario | `empresa_id` | `localidad_id` | Ve |
|---|---|---|---|
| Superadmin de plataforma | vacío | vacío | Todas las empresas |
| Global de empresa (admin, logística) | E | vacío | Todas las localidades de la empresa E |
| Local | E | L | Solo la localidad L |

- Un usuario global puede acotar las listas con `?localidad_id=` (la app lo hace con el selector
  de localidad). Al crear un catálogo, un usuario global **tiene que elegir la localidad**.
- Un usuario local no puede tocar datos de otra localidad: las consultas devuelven 404 y los
  intentos de escribir en otra localidad se fuerzan a la suya o se rechazan.
- Todo esto vive en `Backend/src/utils/scope.js`. **Cualquier controller nuevo tiene que usarlo**
  (`scopeSql`, `resolveLocalidadForWrite`, `userForRead`).

## Roles

| Rol | Alcance típico | Puede |
|---|---|---|
| `superadmin` | Plataforma | Todo, incluido administrar empresas |
| `admin` | Empresa o localidad | Todo menos empresas: catálogos, pesajes (incluido manual), reportes, usuarios, respaldos, **dispositivos y tokens** |
| `logistica` | Empresa (global) | Solo lectura: pesajes, reportes, dashboard, usuarios |
| `gerente` | Localidad | Catálogos completos, ver pesajes, reportes, dashboard, cámaras. No pesa ni configura |
| `balancero` | Localidad | Pesar con la balanza (sin peso manual), editar pesajes, ver catálogos, crear reportes, cámaras |
| `subalancero` | Localidad | Lo mismo que balancero, más **peso manual** y **respaldos** |

Notas:
- *Dispositivos* (ip/puerto, generar y revocar tokens) es solo para admin y superadmin.
- Los permisos están en `Backend/src/config/rolesConfig.js` (la fuente de verdad) y copiados en
  `Frontend/src/config/rolesConfig.js` para armar el menú. **Si se cambia uno, cambiar el otro.**
- Un admin de localidad no puede crear usuarios globales.

## Gestión de usuarios

Todavía no hay pantalla de usuarios: la API existe (`/api/usuarios`) pero el alta se hace por
SQL o con `seed_usuarios.sql`. La columna `password_hash` guarda hoy la contraseña **en texto
plano** (ver doc 07).
