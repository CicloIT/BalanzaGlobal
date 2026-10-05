import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getRolePermissions, hasPermission } from '../config/rolesConfig';

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'balanza_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Obtener permisos del usuario basado en su rol
  const userPermissions = user?.rol ? getRolePermissions(user.rol) : [];

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  const checkPermission = useCallback((permission) => {
    if (!user?.rol) return false;
    return hasPermission(user.rol, permission);
  }, [user?.rol]);

  const login = async (username, password) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/usuarios/login`, {
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
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setError('');
  };

  const value = {
    user,
    login,
    logout,
    loading,
    error,
    setError,
    rol: user?.rol,
    localidad_id: user?.localidad_id ?? null,
    localidad_nombre: user?.localidad_nombre ?? null,
    isGlobal: !user?.localidad_id,
    isLogistica: user?.rol?.toLowerCase() === 'logistica',
    permissions: userPermissions,
    hasPermission: checkPermission,
    isAdmin: user?.rol?.toLowerCase() === 'admin',
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
