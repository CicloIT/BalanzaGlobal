import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL, STORAGE_KEY, getStoredUser } from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificando, setVerificando] = useState(() => !!getStoredUser());

  // Al cargar, confirmar que la cookie de sesión sigue siendo válida (y refrescar datos del usuario)
  useEffect(() => {
    if (!getStoredUser()) return;
    fetch(`${API_BASE_URL}/api/usuarios/me`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.success) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
          setUser(data.user);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
        }
      })
      .catch(() => { /* sin red: se mantiene el estado y fallarán los requests */ })
      .finally(() => setVerificando(false));
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/usuarios/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
        setUser(data.user);
        return true;
      } else {
        setError(data.error || 'Error al iniciar sesión');
        return false;
      }
    } catch {
      setError('No se pudo conectar con el servidor');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    fetch(`${API_BASE_URL}/api/usuarios/logout`, { method: 'POST' }).catch(() => {});
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setError('');
  };

  const value = {
    user,
    verificando,
    login,
    logout,
    loading,
    error,
    setError,
    localidad_nombre: user?.localidad_nombre ?? null,
    empresa_nombre: user?.empresa_nombre ?? null,
    // Global = sin localidad fija (admin/logística de empresa o superadmin)
    isGlobal: !user?.localidad_id,
    isSuperadmin: user?.rol?.toLowerCase() === 'superadmin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
