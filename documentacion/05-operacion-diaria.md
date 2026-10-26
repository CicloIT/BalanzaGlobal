# 05 — Operación diaria

## Pesada de un camión

Una **operación** agrupa las dos pesadas de un camión (BRUTO y TARA) en una localidad.

1. *Pesajes → Nueva Pesada*. Si el usuario es global, elegir la balanza.
2. Cargar patente, chofer, transporte, producto, productor (obligatorios) y remito.
   Si un chofer, vehículo, etc. no existe, el formulario lo da de alta en la localidad.
3. Elegir **INGRESO** (entra cargado) o **SALIDA** (sale cargado).
4. **Capturar peso** cuando la pantalla muestre "PESO ESTABLE", y registrar.
   - Si el usuario tiene permiso de peso manual (subalancero, admin), puede escribir el peso.
5. Opcional: adjuntar la Carta de Porte (PDF) y marcar "Es contenedor".

Cómo se arma la operación:
- Primera pesada de una patente sin operación abierta → crea la operación.
  INGRESO registra **BRUTO**; SALIDA registra **TARA**.
- Segunda pesada de la misma patente en la misma localidad → completa el tipo que falta.
- Con BRUTO y TARA, la base calcula el **neto** y **cierra** la operación (trigger `calcular_neto`).
- Mientras está abierta, la pantalla la muestra como "en playa" y al escribir la patente se
  recupera la operación activa.

## Lista de pesadas

*Pesajes → Pesadas*: operaciones agrupadas, con filtros por sentido, fecha, mes y año, y carga
infinita. Desde cada fila:
- Ver detalle (pesadas, fotos, PDF).
- Subir o reemplazar el PDF.
- Cargar datos de contenedor (nro., VGM, tara, bultos, proforma, permiso de embarque).
- Eliminar una operación o varias seleccionadas.

## Reportes

*Pesajes → Reportes*: desde la lista se genera un reporte de las pesadas seleccionadas; queda
guardado en el historial, se puede volver a abrir o borrar.

## Dashboard

Pesadas y neto de hoy, operaciones abiertas en playa, semana, mapa de calor por hora,
rankings (transportes, productores, productos, choferes), uso de flota y promedios del mes.
Respeta el alcance del usuario.

## Respaldos

*Configuración → Respaldos* (solo **admin global** y superadmin):
- **Respaldo manual**: genera un `.zip` con `database.sql` (pg_dump de la base completa),
  `capturas/` (fotos) y `documentos/` (PDF).
- **Automático**: los domingos a las 3 AM.
- Se guardan en `Backend/backups/` y se descargan desde la misma vista.
- Conviene bajar una copia fuera del servidor cada tanto.
