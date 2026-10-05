import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = '';
const STORAGE_KEY = 'balanza_user';

// Helper para obtener headers con información del usuario
const getAuthHeaders = (contentType = 'application/json') => {
  const headers = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  // Obtener usuario del localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      if (user?.id) {
        headers['x-user-id'] = user.id.toString();
      }
      if (user?.username) {
        headers['x-username'] = user.username;
      }
    }
  } catch {
    // Ignorar errores de parsing
  }

  return headers;
};

export function useGestionAPI(config, enabled = true) {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState({ abierto: false, item: null });
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const cargarItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}${config.endpoint}`, {
        headers: getAuthHeaders(null), // Sin Content-Type para GET
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.statusText}`);
      }
      const result = await response.json();
      setItems(result.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint]);

  // Cargar datos al montar el componente (solo si está habilitado)
  useEffect(() => {
    if (enabled) {
      cargarItems();
    }
  }, [cargarItems, enabled]);

  const abrirModal = useCallback((item = null) => {
    setModal({ abierto: true, item });
    if (item) {
      setFormData(item);
    } else {
      setFormData({});
    }
    setError(null);
    setSuccess(null);
  }, []);

  const cerrarModal = useCallback(() => {
    setModal({ abierto: false, item: null });
    setFormData({});
    setError(null);
    setSuccess(null);
  }, []);

  const handleFormChange = useCallback((campo, valor) => {
    setFormData(prev => ({ ...prev, [campo]: valor }));
  }, []);

  const guardarItem = async () => {
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
        // Editar
        setItems(items => items.map(item => 
          item.id === modal.item.id 
            ? result.data
            : item
        ));
        setSuccess('Elemento actualizado correctamente');
      } else {
        // Crear
        setItems(items => [...items, result.data]);
        setSuccess('Elemento creado correctamente');
      }
      
      setTimeout(() => {
        cerrarModal();
      }, 800);
    } catch (err) {
      setError(err.message);
      console.error('Error guardando item:', err);
    } finally {
      setLoading(false);
    }
  };

  const eliminarItem = useCallback(async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este elemento?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}${config.endpoint}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(null),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.statusText}`);
      }

      setItems(items => items.filter(item => item.id !== id));
      setSuccess('Elemento eliminado correctamente');
    } catch (err) {
      setError(err.message);
      console.error('Error eliminando item:', err);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint]);

  const toggleEstado = useCallback(async (id) => {
    // Necesitamos el item actual. Lo buscamos en la función de actualización de estado para evitar refrescos circulares
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
          setItems(items => items.map(i => i.id === id ? result.data : i));
          setSuccess(`Elemento ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`);
        } catch (err) {
          setError(err.message);
          console.error('Error cambiando estado:', err);
        } finally {
          setLoading(false);
        }
      })();
      
      return currentItems;
    });
  }, [config.endpoint]);

  return {
    items,
    modal,
    formData,
    loading,
    error,
    success,
    abrirModal,
    cerrarModal,
    guardarItem,
    eliminarItem,
    toggleEstado,
    handleFormChange,
    fetchItems: cargarItems,
  };
}
