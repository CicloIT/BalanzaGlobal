/**
 * usePesadasInfinite
 *
 * Hook para cargar pesadas agrupadas con paginación progresiva (infinite scroll).
 * Carga PAGE_SIZE registros inicialmente y agrega más cuando el usuario llega
 * al final de la lista.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = '';
const STORAGE_KEY  = 'balanza_user';
const PAGE_SIZE    = 50; // Aumentamos a 50 para que llene mejor la pantalla inicialmente

function getAuthHeaders() {
  const headers = {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const u = JSON.parse(stored);
      if (u?.id)       headers['x-user-id']  = u.id.toString();
      if (u?.username) headers['x-username'] = u.username;
    }
  } catch { /* ignore */ }
  return headers;
}

export function usePesadasInfinite(enabled = true, refreshTrigger = 0, sentidoFilter = null, fechaFilter = null, mesFilter = null, anioFilter = null) {
  const [items,   setItems]   = useState([]);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,   setError]   = useState(null);
  const [total,   setTotal]   = useState(0);

  // Prevent duplicate fetches
  const fetchingRef = useRef(false);

  const fetchPage = useCallback(async (pageNum, append = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (append) setLoadingMore(true);
    else        setLoading(true);

    setError(null);

    try {
      let url = `${API_BASE_URL}/api/pesadas/agrupadas?page=${pageNum}&limit=${PAGE_SIZE}`;
      if (sentidoFilter) url += `&sentido=${encodeURIComponent(sentidoFilter)}`;
      if (anioFilter) url += `&anio=${encodeURIComponent(anioFilter)}`;
      if (mesFilter) url += `&mes=${encodeURIComponent(mesFilter)}`;
      if (!anioFilter && fechaFilter) url += `&fecha=${encodeURIComponent(fechaFilter)}`;
      const res = await fetch(url, { headers: getAuthHeaders() });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }

      const json = await res.json();
      const newItems = json.data ?? [];
      
      console.log(`[usePesadasInfinite] Recibidas ${newItems.length} pesadas (Page ${pageNum}). Total en BD: ${json.total}`);

      const totalCalculado = json.total ?? 0;
      const hasMoreServer  = json.hasMore ?? false;

      setItems(prev => {
        if (!append) return newItems;
        const existingIds = new Set(prev.map(i => i.id));
        const filteredNew = newItems.filter(i => !existingIds.has(i.id));
        return [...prev, ...filteredNew];
      });
      
      setTotal(totalCalculado);
      setHasMore(hasMoreServer);
      setPage(pageNum);
    } catch (e) {
      setError(e.message);
      setHasMore(false); 
      console.error('[usePesadasInfinite] Error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [sentidoFilter, fechaFilter, mesFilter, anioFilter]);

  // Control de tiempo y duplicados
  const lastFetchRef   = useRef(0);
  const loadedPagesRef = useRef(new Set());

  // Initial load
  useEffect(() => {
    if (enabled && items.length === 0 && !loading && !fetchingRef.current && hasMore) {
      loadedPagesRef.current.clear();
      loadedPagesRef.current.add(1);
      fetchPage(1, false);
    }
  }, [enabled, fetchPage, items.length, loading, hasMore]);

  // Refresh when trigger or sentidoFilter changes
  useEffect(() => {
    if (enabled && refreshTrigger > 0) {
      setItems([]);
      setPage(1);
      setHasMore(true);
      setError(null);
      loadedPagesRef.current.clear();
      loadedPagesRef.current.add(1);
      fetchPage(1, false);
    }
  }, [enabled, refreshTrigger, fetchPage]);

  // Reset when any filter changes
  const prevSentidoRef = useRef(sentidoFilter);
  const prevFechaRef = useRef(fechaFilter);
  const prevMesRef = useRef(mesFilter);
  const prevAnioRef = useRef(anioFilter);
  useEffect(() => {
    if (
      prevSentidoRef.current !== sentidoFilter ||
      prevFechaRef.current !== fechaFilter ||
      prevMesRef.current !== mesFilter ||
      prevAnioRef.current !== anioFilter
    ) {
      prevSentidoRef.current = sentidoFilter;
      prevFechaRef.current = fechaFilter;
      prevMesRef.current = mesFilter;
      prevAnioRef.current = anioFilter;
      setItems([]);
      setPage(1);
      setHasMore(true);
      setError(null);
      loadedPagesRef.current.clear();
      loadedPagesRef.current.add(1);
      if (enabled) fetchPage(1, false);
    }
  }, [enabled, sentidoFilter, fechaFilter, mesFilter, anioFilter, fetchPage]);

  // Load next page
  const loadMore = useCallback(() => {
    const now = Date.now();
    const nextPage = page + 1;

    // Throttle y redundancia
    if (now - lastFetchRef.current < 500) return;
    if (loadedPagesRef.current.has(nextPage)) return;
    if (!hasMore || fetchingRef.current || loadingMore || loading) return;
    
    // Safety caps
    if (items.length > 3000) {
      setHasMore(false);
      return;
    }

    if (total > 0 && items.length >= total) {
      setHasMore(false);
      return;
    }
    
    lastFetchRef.current = now;
    loadedPagesRef.current.add(nextPage);
    fetchPage(nextPage, true);
  }, [hasMore, loadingMore, loading, page, fetchPage, total, items.length]);

  // Hard refresh (e.g. after PDF upload)
  const refresh = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, false);
  }, [fetchPage]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    total,
    error,
    loadMore,
    refresh,
    // Compatibility shims so GestionApp doesn't need major changes
    modal: { abierto: false, item: null },
    formData: {},
    success: null,
    abrirModal: () => {},
    cerrarModal: () => {},
    guardarItem: async () => {},
    eliminarItem: async () => {},
    toggleEstado: async () => {},
    handleFormChange: () => {},
  };
}
