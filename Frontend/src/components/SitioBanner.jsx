import React from 'react';
import { CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import Alert from './ui/Alert';
import { haceCuanto } from '../hooks/useSitioEstado';

// Aviso del servidor de sitio: se ve solo si algo no está al día con el central.
// Sin conexión se sigue pesando normal: el aviso es informativo.
export default function SitioBanner({ estado }) {
  if (estado?.modo !== 'sitio') return null;

  if (!estado.listo) {
    return (
      <Alert tone="info" icon={RefreshCw} title="Preparando el servidor de la localidad" className="mb-4">
        Se están bajando los datos del servidor central{estado.bootstrap ? ` (${estado.bootstrap})` : ''}.
        Todavía no se pueden cargar pesadas.
      </Alert>
    );
  }
  if (!estado.conectado) {
    return (
      <Alert tone="warning" icon={CloudOff} title="Sin conexión con el servidor central" className="mb-4">
        Podés seguir pesando normalmente.{' '}
        {estado.pendientes > 0
          ? <>Hay <strong>{estado.pendientes}</strong> cambio{estado.pendientes !== 1 ? 's' : ''} guardado{estado.pendientes !== 1 ? 's' : ''} acá que se envían solos cuando vuelva internet.</>
          : 'Todo lo anterior ya está enviado.'}
        {' '}Cambiar la contraseña requiere conexión.
      </Alert>
    );
  }
  if (estado.ultimo_error && estado.pendientes > 0) {
    return (
      <Alert tone="danger" icon={AlertTriangle} title="El servidor central no aceptó algunos cambios" className="mb-4">
        {estado.pendientes} pendiente{estado.pendientes !== 1 ? 's' : ''} desde {haceCuanto(estado.pendientes_desde)}.
        Avisá a sistemas: <span className="font-mono text-xs">{estado.ultimo_error.mensaje}</span>
      </Alert>
    );
  }
  return null;
}
