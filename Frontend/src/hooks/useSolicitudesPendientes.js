import { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';

const INTERVALO_MS = 60000;
const EVENTO_SOLICITUDES = 'solicitudes-borrado:cambio';
const EVENTO_NEGATIVAS = 'operaciones-negativas:cambio';

// Avisar que cambió la bandeja (se aprobó/rechazó algo) para refrescar el contador ya
export const avisarCambioSolicitudes = () => window.dispatchEvent(new Event(EVENTO_SOLICITUDES));
// Avisar que se invirtió una operación para refrescar el contador de negativas
export const avisarCambioNegativas = () => window.dispatchEvent(new Event(EVENTO_NEGATIVAS));

/**
 * Contador para avisos del menú: consulta `endpoint` (responde { success, count }) solo si `activo`.
 * Se refresca cada minuto, al volver a la pestaña y cuando se dispara `evento`.
 */
function useContadorAviso(endpoint, evento, activo) {
  const [count, setCount] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers: getAuthHeaders(null) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setCount(data.count);
    } catch {
      /* sin red: se reintenta en el próximo ciclo */
    }
  }, [endpoint]);

  useEffect(() => {
    if (!activo) return undefined;
    const inicial = setTimeout(cargar, 0);
    const timer = setInterval(cargar, INTERVALO_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(evento, cargar);
    return () => {
      clearTimeout(inicial);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(evento, cargar);
    };
  }, [activo, cargar, evento]);

  return activo ? count : 0;
}

/** Pedidos de borrado pendientes (usuario con pesaje:delete). */
export const useSolicitudesPendientes = (activo) =>
  useContadorAviso('/api/solicitudes-borrado/pendientes/count', EVENTO_SOLICITUDES, activo);

/** Operaciones cerradas con neto negativo, para invertir (usuario con pesaje:invertir). */
export const useOperacionesNegativas = (activo) =>
  useContadorAviso('/api/pesadas/negativas/count', EVENTO_NEGATIVAS, activo);
