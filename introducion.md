# Adaptación del Sistema de Balanzas Multi-Localidad

## Objetivo

Adaptar el sistema actual para soportar múltiples balanzas distribuidas en distintas localidades, utilizando una única base de datos centralizada y manteniendo separación lógica de datos, usuarios y permisos.

---

# Escenario

Actualmente el sistema trabaja con una única balanza y una única lógica de pesaje.

Ahora el sistema deberá soportar múltiples localidades y múltiples balanzas conectadas simultáneamente.

---

# Localidades previstas

- El Mirador
- Quines
- La Sarita
- Salta
  - San José
  - San Sebastián

---

# Arquitectura de conexión

Cada balanza contará con:

- Indicador conectado por RS232
- Conversor RS232 → TCP/IP
- Conexión hacia una IP pública donde estará alojado el sistema web

El sistema deberá poder identificar automáticamente desde qué balanza/localidad proviene cada conexión.

---

# Problemas a resolver

## 1. Identificación de localidad/balanza

Actualmente la base de datos no distingue el origen de cada pesada.

Se necesita:

- Identificar desde qué balanza llega la información
- Asociar cada pesada a:
  - localidad
  - sucursal/sub-balanza
  - dispositivo físico

---

## 2. Separación de datos

Las pesadas NO deben mezclarse entre localidades.

Ejemplo:

- Usuarios de Quines solo deben ver pesadas de Quines
- Usuarios de La Sarita solo deben ver sus propias pesadas

---

## 3. Roles y permisos

Se necesitan distintos niveles de acceso.

### Operador Local

Puede:

- Ver pesadas de su localidad
- Crear operaciones
- Gestionar información propia

NO puede:

- Ver otras localidades

---

### Supervisor / Administrador

Puede:

- Administrar usuarios
- Configurar balanzas
- Ver múltiples localidades

---

### Logística

Puede:

- Ver todas las pesadas
- Consultar históricos
- Generar reportes
co
NO puede:

- Crear registros
- Editar registros
- Eliminar registros

Acceso completamente de solo lectura.

---
