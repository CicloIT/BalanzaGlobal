# 05 — Operación diaria

## Pesada de un camión

Una **operación** agrupa las dos pesadas de un camión (BRUTO y TARA) en una localidad.

1. *Pesajes → Nueva Pesada*. Si el usuario es global, elegir la balanza.
2. Cargar patente, chofer, transporte, producto, productor (obligatorios) y remito.
   Si un chofer, vehículo, etc. no existe, el formulario lo da de alta en la localidad.
3. Elegir **INGRESO** (entra cargado) o **SALIDA** (sale cargado).
4. **Capturar peso** cuando la pantalla muestre "PESO ESTABLE", y registrar.
   - El balancero y el superadmin también pueden escribir el peso a mano; la pesada queda marcada como manual.
5. Opcional: adjuntar la Carta de Porte (PDF) y marcar "Es contenedor".

Cómo se arma la operación:
- Primera pesada de una patente sin operación abierta → crea la operación.
  INGRESO registra **BRUTO**; SALIDA registra **TARA**.
- Segunda pesada de la misma patente en la misma localidad → completa el tipo que falta.
- Con BRUTO y TARA, la base calcula el **neto** y **cierra** la operación (trigger `calcular_neto`).
- Mientras está abierta, la pantalla la muestra como "en playa" y al escribir la patente se
  recupera la operación activa.

## Lista de pesadas

*Pesajes → Pesadas*: operaciones agrupadas, con filtros por localidad (usuarios globales),
sentido, fecha, mes y año, y carga infinita. Desde cada fila:
- Ver detalle (pesadas, fotos, PDF).
- Subir o reemplazar el PDF.
- Cargar datos de contenedor (nro., VGM, tara, bultos, proforma, permiso de embarque).
- Eliminar una operación o varias seleccionadas.

### Operación con el sentido al revés (neto negativo)

Si el balancero eligió INGRESO cuando el camión salía cargado (o al revés), la primera pesada
queda con el tipo equivocado y el neto da **negativo**. Al superadmin le llega un aviso al
entrar y un contador en *Historial de pesadas* (se actualiza cada minuto). En el historial,
el botón **Neto negativo** filtra esas operaciones y cada fila tiene **Invertir**
(`POST /api/pesadas/operacion/:id/invertir`, permiso `pesaje:invertir`, solo superadmin), que:
- cambia el sentido (INGRESO ↔ SALIDA),
- intercambia BRUTO ↔ TARA entre las dos pesadas (cada una conserva peso, fecha y fotos),
- recalcula el neto.

Solo aplica a operaciones cerradas con neto negativo. Los reportes ya generados con esa
operación guardan los valores viejos: regenerarlos si hace falta. Requiere
`migration_invertir_operacion.sql` (vuelve diferible la restricción `unica_pesada_por_tipo`).

## Reportes

*Pesajes → Reportes*: desde la lista se genera un reporte de las pesadas seleccionadas; queda
guardado en el historial, se puede volver a abrir o borrar.

El balancero también ve el menú *Reportes* (solo los de su localidad): puede abrir y reimprimir
un reporte ya generado sin crearlo de nuevo. Borrar reportes queda solo para el superadmin.

## Dashboard

Pesadas y neto de hoy, operaciones abiertas en playa, semana, mapa de calor por hora,
rankings (transportes, productores, productos, choferes), uso de flota y promedios del mes.
Respeta el alcance del usuario.

## Respaldos

*Configuración → Respaldos* (solo **superadmin**):
- **Respaldo manual**: genera un `.zip` con `database.sql` (pg_dump de la base completa),
  `capturas/` (fotos) y `documentos/` (PDF).
- **Automático**: no hay; se generan solo a mano (para no llenar el disco).
- Se guardan en `Backend/backups/` y se descargan desde la misma vista.
- Conviene bajar una copia fuera del servidor cada tanto.
