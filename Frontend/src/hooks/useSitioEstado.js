import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';

const INTERVALO_MS = 15000;

/**
 * Estado de la sincronización (v2 local-first), de GET /api/sitio/estado.
 *  - servidor de sitio: { modo:'sitio', conectado, listo, pendientes, ultima_sync, ultimo_error, bootstrap }
 *  - central:           { modo:'central', sitios:[{ localidad_id, nombre, sitio_activo, conectado, … }] }
 * null mientras carga o si el backend es anterior a la v2.
 */
export function useSitioEstado(activo = true) {
  const [estado, setEstado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sitio/estado`, { headers: getAuthHeaders(null) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setEstado(data.data);
    } catch {
      /* sin red con el propio servidor: se reintenta */
    }
  }, []);

  useEffect(() => {
    if (!activo) return undefined;
    const inicial = setTimeout(cargar, 0);
    const timer = setInterval(cargar, INTERVALO_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(inicial);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activo, cargar]);

  return { estado, recargar: cargar };
}

export const haceCuanto = (fecha) => {
  if (!fecha) return 'nunca';
  const seg = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 1000));
  if (seg < 60) return 'hace instantes';
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
};
