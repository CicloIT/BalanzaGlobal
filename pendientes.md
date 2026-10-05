# Cambios Pendientes — Sistema Multi-Localidad

## Crítico (rompe funcionalidad actual)

### 1. `PesadaForm.jsx` — enviar `dispositivo_id`
La columna `pesada.dispositivo_id` es `NOT NULL`. Sin este campo, `createPesada` falla.

**Solución:** Al cargar el formulario, hacer `GET /api/config` para obtener el dispositivo activo de la localidad del usuario. Enviar `dispositivo_id` en el body del POST.

---

### 2. `balanzaService.js` — asignar `dispositivo_id` al registrar pesada automática
Cuando la balanza envía peso por TCP, el service crea la pesada. Necesita conocer el `dispositivo_id` correspondiente.

**Solución:** Al inicializar el service, buscar el `configuracion_dispositivos.id` de tipo `balanza` para la localidad activa y usarlo en el INSERT.

---

### 3. `getOperacionAbiertaByPatente` + `getPesadaActivaByPatente` — sin filtro de localidad
Exponen operaciones/pesadas de otras localidades al buscar por patente.

**Archivo:** `operacionesController.js:15`, `pesadasController.js:487`

**Solución:** Agregar `AND ($2::int IS NULL OR localidad_id = $2)` / filtro via cd.

---

## Importante (permisos/datos incorrectos)

### 4. `getUsuarios` — admin local ve todos los usuarios
Admin de El Mirador puede ver usuarios de Salta.

**Archivo:** `usuariosController.js:3`

**Solución:**
```js
const localidadId = req.user?.localidad_id ?? null;
// WHERE u.activo = true AND ($1::int IS NULL OR u.localidad_id = $1)
```

### 5. `createUsuario` — admin local puede crear usuarios en cualquier localidad
**Archivo:** `usuariosController.js:39`

**Solución:** Si `req.user.localidad_id` no es null, forzar `localidad_id = req.user.localidad_id` ignorando el del body.

---

### 6. Frontend — botones de escritura visibles para `logistica`
`logistica` solo tiene permisos `*:view` en `rolesConfig` pero no se verificó que todos los botones (Crear, Editar, Eliminar) respetan eso en `TablaItems`, `GestionApp`, etc.

**Verificar:** `Guard.jsx`, `TablaItems.jsx`, `GestionApp.jsx` — que usen `hasPermission` o `canWrite` antes de mostrar botones de acción.

---

## Menor / Operativo

### 7. Hashear passwords
Todos los usuarios tienen `password_hash = '123456'` en texto plano.

**Solución:** Implementar bcrypt en `authLogin` (compare) y `createUsuario` (hash antes de INSERT).

---

### 8. Cargar `configuracion_dispositivos` con IPs/puertos reales
Sin esto, el filtro por `cd.localidad_id` en pesadas devuelve vacío para todas las localidades con dispositivos sin configurar.

**Tabla:** `configuracion_dispositivos` — necesita 1 fila tipo `balanza` por localidad con IP real.

---

### 9. WebSocket — broadcast a todos los clientes sin filtro de localidad
`server.js` hace `broadcast` del estado de la balanza a todos los sockets conectados, sin importar qué localidad están mirando.

**Solución futura:** Agregar `localidad_id` al handshake del WebSocket y filtrar el broadcast.

---

### 10. `seed_usuarios.sql` — actualizar con nuevos roles
El archivo ya fue actualizado con `logistica` y gerentes, pero en `balanzaglobal` los usuarios ya existen. El seed es para instancias nuevas.

**Estado:** OK para nuevas instalaciones. No correr sobre DB existente.

---

## Resumen por prioridad

| # | Item | Impacto si no se hace |
|---|------|----------------------|
| 1 | `dispositivo_id` en PesadaForm | Crear pesada falla con error DB |
| 2 | `balanzaService` con `dispositivo_id` | Pesada automática falla |
| 3 | Filtro patente en operaciones/pesadas | Leak de datos entre localidades |
| 4 | Filtro usuarios por localidad | Admin local ve usuarios de otras |
| 5 | Forzar localidad en createUsuario | Admin local crea usuarios globales |
| 6 | Botones UI para logistica | Logistica ve botones que no debería |
| 7 | Hashear passwords | Seguridad crítica para producción |
| 8 | Config dispositivos reales | Sistema no conecta a balanzas reales |
| 9 | WebSocket por localidad | UI muestra estado de balanza incorrecta |
