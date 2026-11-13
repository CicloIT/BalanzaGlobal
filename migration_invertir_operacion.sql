-- Invertir una operación cargada con el sentido equivocado (neto negativo).
-- Invertir intercambia BRUTO <-> TARA entre las dos pesadas de la operación; con la restricción
-- UNIQUE (operacion_id, tipo) no diferible ese intercambio falla en un solo UPDATE.
-- Se la vuelve DEFERRABLE INITIALLY IMMEDIATE: todo sigue igual (se valida en cada sentencia)
-- salvo en la transacción de invertir, que la difiere con SET CONSTRAINTS ... DEFERRED.
-- Idempotente.
BEGIN;

ALTER TABLE pesada DROP CONSTRAINT IF EXISTS unica_pesada_por_tipo;
ALTER TABLE pesada
  ADD CONSTRAINT unica_pesada_por_tipo UNIQUE (operacion_id, tipo) DEFERRABLE INITIALLY IMMEDIATE;

COMMIT;
