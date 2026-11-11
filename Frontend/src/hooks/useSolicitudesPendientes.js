import { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';

const INTERVALO_MS = 60000;
const EVENTO = 'solicitudes-borrado:cambio';

// Avisar que cambió la bandeja (se aprobó/rechazó algo) para refrescar el contador ya
export const avisarCambioSolicitudes = () => window.dispatchEvent(new Event(EVENTO));

/**
 * Cantidad de pedidos de borrado pendientes (para el contador del menú).
 * Solo consulta si `activo` (usuario con pesaje:delete). Se refresca cada minuto,
 * al volver a la pestaña y cuando la bandeja avisa un cambio.
 */
export function useSolicitudesPendientes(activo) {
  const [count, setCount] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/solicitudes-borrado/pendientes/count`, {
        headers: getAuthHeaders(null),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setCount(data.count);
    } catch {
      /* sin red: se reintenta en el próximo ciclo */
    }
  }, []);

  useEffect(() => {
    if (!activo) return undefined;
    const inicial = setTimeout(cargar, 0);
    const timer = setInterval(cargar, INTERVALO_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(EVENTO, cargar);
    return () => {
      clearTimeout(inicial);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(EVENTO, cargar);
    };
  }, [activo, cargar]);

  return activo ? count : 0;
}
