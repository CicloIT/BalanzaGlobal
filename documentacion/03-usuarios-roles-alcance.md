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
| `admin` | Empresa o localidad | Todo menos empresas: catálogos, pesajes (incluido manual), reportes, usuarios, **dispositivos y tokens**; respaldos solo si es global |
| `logistica` | Empresa (global) | Solo lectura: pesajes, reportes, dashboard, usuarios |
| `gerente` | Localidad | Catálogos completos, ver pesajes, reportes, dashboard, cámaras. No pesa ni configura |
| `balancero` | Localidad | Pesar con la balanza (sin peso manual), editar pesajes, ver catálogos, crear reportes, cámaras |
| `subalancero` | Localidad | Lo mismo que balancero, más **peso manual** |

Notas:
- *Dispositivos* (ip/puerto, generar y revocar tokens) es solo para admin y superadmin.
- *Respaldos* es solo para **admin global** (sin localidad) y superadmin, porque el respaldo
  incluye la base completa. Un admin de localidad no los ve.
- Los permisos están en `Backend/src/config/rolesConfig.js` (la fuente de verdad) y copiados en
  `Frontend/src/config/rolesConfig.js` para armar el menú. **Si se cambia uno, cambiar el otro.**
- Un admin de localidad no puede crear usuarios globales.

## Gestión de usuarios y contraseñas

Todavía no hay pantalla de usuarios: la API existe.

| Acción | Cómo |
|---|---|
| Alta | `POST /api/usuarios` con `username`, `password` (mín. 6), `rol`, `localidad_id` |
| Reset por un admin | `PUT /api/usuarios/:id` con `password` |
| Cambio propio | `PUT /api/usuarios/me/password` con `actual` y `nueva` |
| Desde la consola del servidor | `node Backend/scripts/usuario_password.mjs <usuario> <nueva>` |
| Desactivar | `DELETE /api/usuarios/:id` (pierde el acceso de inmediato) |

Las contraseñas se guardan con hash (scrypt) en `usuario.password_hash`. Si se inserta una en
texto plano por SQL, funciona y se hashea sola en el primer login; o correr
`node Backend/scripts/hashear_passwords.mjs`.
