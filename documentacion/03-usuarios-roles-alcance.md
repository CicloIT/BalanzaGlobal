# 03 — Usuarios, roles y alcance

Cada usuario tiene un **rol** (qué puede hacer) y un **alcance** (qué datos ve), dado por
`empresa_id` y `localidad_id`.

## Alcance

| Usuario | `empresa_id` | `localidad_id` | Ve |
|---|---|---|---|
| Superadmin de plataforma | vacío | vacío | Todas las empresas |
| Global de empresa (logística) | E | vacío | Todas las localidades de la empresa E |
| Local | E | L | Solo la localidad L |

- Un usuario global puede acotar las listas con `?localidad_id=` (la app lo hace con el selector
  de localidad). Al crear un catálogo, un usuario global **tiene que elegir la localidad**.
- Un usuario local no puede tocar datos de otra localidad: las consultas devuelven 404 y los
  intentos de escribir en otra localidad se fuerzan a la suya o se rechazan.
- Todo esto vive en `Backend/src/utils/scope.js`. **Cualquier controller nuevo tiene que usarlo**
  (`scopeSql`, `resolveLocalidadForWrite`, `userForRead`).

## Roles

Hay tres roles (desde 2026-10-29, `migration_roles_simplificados.sql`):

| Rol | Alcance | Puede |
|---|---|---|
| `superadmin` | Plataforma | **Único administrador.** Todo: empresas, localidades, usuarios, catálogos, pesajes, reportes, dispositivos y tokens, módulo de cámaras, respaldos, corregir el peso de una pesada registrada |
| `logistica` | Empresa (global) | **Solo el Dashboard**, con las métricas de todas las localidades de su empresa (total o filtrado por una localidad). No ve pesadas, catálogos ni configuración |
| `balancero` | Una localidad | Pesar con la balanza de su localidad, **incluido peso manual** (queda marcado como manual), ver el historial, adjuntar carta de porte, datos de contenedor, generar reportes, cámaras. Puede **dar de alta** choferes, transportes, productores, productos y vehículos desde la pesada, pero no editarlos ni borrarlos |

Notas:
- Los valores `admin`, `gerente` y `subalancero` siguen en el enum `rol_enum` de la base, pero en el
  código no tienen permisos y esos usuarios quedaron **desactivados** (conservan su historial).
  La API rechaza crear usuarios con esos roles.
- Las pantallas de catálogos solo aparecen a quien puede **editarlos** (hoy, el superadmin).
- `pesaje:manual` (cargar el peso a mano al pesar) es distinto de `pesaje:editar_peso` (cambiar el
  peso de una pesada ya registrada, `PUT /api/pesadas/:id`): este último es solo superadmin.
- Los permisos están en `Backend/src/config/rolesConfig.js` (la fuente de verdad) y copiados en
  `Frontend/src/config/rolesConfig.js` para armar el menú. **Si se cambia uno, cambiar el otro.**

## Gestión de usuarios y contraseñas

Todavía no hay pantalla de usuarios (alta, baja, reset): la API existe. Cada usuario sí puede cambiar
su propia contraseña desde la app: **menú de usuario (arriba a la derecha) → Cambiar contraseña**.

| Acción | Cómo |
|---|---|
| Alta | `POST /api/usuarios` con `username`, `password` (mín. 6), `rol` (`superadmin`, `logistica` o `balancero`), `localidad_id` (balancero) o `empresa_id` (logística) |
| Reset por el superadmin | `PUT /api/usuarios/:id` con `password` |
| Cambio propio | Menú de usuario → *Cambiar contraseña* (usa `PUT /api/usuarios/me/password` con `actual` y `nueva`) |
| Desde la consola del servidor | `node Backend/scripts/usuario_password.mjs <usuario> <nueva>` |
| Desactivar | `DELETE /api/usuarios/:id` (pierde el acceso de inmediato) |

Las contraseñas se guardan con hash (scrypt) en `usuario.password_hash`. Si se inserta una en
texto plano por SQL, funciona y se hashea sola en el primer login; o correr
`node Backend/scripts/hashear_passwords.mjs`.
