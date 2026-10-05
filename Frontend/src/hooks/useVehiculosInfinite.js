
import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = '';
const STORAGE_KEY  = 'balanza_user';
const PAGE_SIZE    = 50; 

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
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

export function useVehiculosInfinite(config, enabled = true, search = '') {
  const [items,   setItems]   = useState([]);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(null);
  const [total,   setTotal]   = useState(0);

  // Modal and form states to maintain compatibility with useGestionAPI
  const [modal, setModal] = useState({ abierto: false, item: null });
  const [formData, setFormData] = useState({});

  const fetchingRef = useRef(false);

  const fetchPage = useCallback(async (pageNum, append = false, searchTerm = '') => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (append) setLoadingMore(true);
    else        setLoading(true);

    setError(null);

    try {
      const params = new URLSearchParams({ page: pageNum, limit: PAGE_SIZE });
      if (searchTerm) params.set('search', searchTerm);
      const url = `${API_BASE_URL}${config.endpoint}?${params}`;
      const res = await fetch(url, { headers: getAuthHeaders() });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }

      const json = await res.json();
      const newItems = json.data ?? [];
      
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
      console.error('[useVehiculosInfinite] Error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [config.endpoint]);

  const lastFetchRef   = useRef(0);
  const loadedPagesRef = useRef(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      fetchingRef.current = false;
      initializedRef.current = false;
      setItems([]);
      setPage(1);
      setHasMore(true);
      setTotal(0);
      loadedPagesRef.current.clear();
      lastFetchRef.current = 0;
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled && !initializedRef.current && !fetchingRef.current) {
      initializedRef.current = true;
      loadedPagesRef.current.clear();
      loadedPagesRef.current.add(1);
      fetchPage(1, false, search);
    }
  }, [enabled, fetchPage]);

  const searchRef = useRef(search);
  useEffect(() => {
    if (!enabled) return;
    const currentSearch = searchRef.current;
    searchRef.current = search;
    if (currentSearch === search) return;

    fetchingRef.current = false;
    initializedRef.current = true;
    setLoading(false);
    setLoadingMore(false);
    setItems([]);
    setPage(1);
    setHasMore(true);
    loadedPagesRef.current.clear();
    loadedPagesRef.current.add(1);
    lastFetchRef.current = 0;
    fetchPage(1, false, search);
  }, [search, enabled, fetchPage]);

  const loadMore = useCallback(() => {
    const now = Date.now();
    const nextPage = page + 1;

    if (now - lastFetchRef.current < 500) return;
    if (loadedPagesRef.current.has(nextPage)) return;
    if (!hasMore || fetchingRef.current || loadingMore || loading) return;
    
    if (total > 0 && items.length >= total) {
      setHasMore(false);
      return;
    }
    
    lastFetchRef.current = now;
    loadedPagesRef.current.add(nextPage);
    fetchPage(nextPage, true, search);
  }, [hasMore, loadingMore, loading, page, fetchPage, total, items.length, search]);

  const reset = useCallback(() => {
    fetchingRef.current = false;
    initializedRef.current = false;
    setItems([]);
    setPage(1);
    setHasMore(true);
    setTotal(0);
    loadedPagesRef.current.clear();
    lastFetchRef.current = 0;
  }, []);

  const loadAll = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: 1, limit: 9999 });
      const url = `${API_BASE_URL}${config.endpoint}?${params}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      setItems(json.data ?? []);
      setHasMore(false);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [config.endpoint]);

  const abrirModal = useCallback((item = null) => {
    setModal({ abierto: true, item });
    if (item) setFormData(item);
    else setFormData({});
    setError(null);
    setSuccess(null);
  }, []);

  const cerrarModal = useCallback(() => {
    setModal({ abierto: false, item: null });
    setFormData({});
    setError(null);
    setSuccess(null);
  }, []);

  const guardarItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const method = modal.item ? 'PUT' : 'POST';
      const url = modal.item 
        ? `${API_BASE_URL}${config.endpoint}/${modal.item.id}`
        : `${API_BASE_URL}${config.endpoint}`;

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (modal.item) {
        setItems(prev => prev.map(item => item.id === modal.item.id ? result.data : item));
        setSuccess('Vehículo actualizado correctamente');
      } else {
        setItems(prev => [result.data, ...prev]);
        setSuccess('Vehículo creado correctamente');
      }
      
      setTimeout(() => cerrarModal(), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [modal.item, config.endpoint, formData, cerrarModal]);

  const eliminarItem = useCallback(async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este vehículo?')) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}${config.endpoint}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) { 
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.statusText}`);
      }

      setItems(prev => prev.filter(item => item.id !== id));
      setSuccess('Vehículo eliminado correctamente');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint]);

  const toggleEstado = useCallback(async (id) => {
    setItems(currentItems => {
      const item = currentItems.find(i => i.id === id);
      if (!item) return currentItems;

      (async () => {
        setLoading(true);
        setError(null);
        try {
          const nuevoEstado = !item.activo;
          const response = await fetch(`${API_BASE_URL}${config.endpoint}/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ ...item, activo: nuevoEstado }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error: ${response.statusText}`);
          }

          const result = await response.json();
          setItems(prev => prev.map(i => i.id === id ? result.data : i));
          setSuccess(`Vehículo ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      })();
      return currentItems;
    });
  }, [config.endpoint]);

  const handleFormChange = useCallback((campo, valor) => {
    setFormData(prev => ({ ...prev, [campo]: valor }));
  }, []);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    total,
    error,
    success,
    modal,
    formData,
    loadMore,
    loadAll,
    reset,
    abrirModal,
    cerrarModal,
    guardarItem,
    eliminarItem,
    toggleEstado,
    handleFormChange,
  };
}
