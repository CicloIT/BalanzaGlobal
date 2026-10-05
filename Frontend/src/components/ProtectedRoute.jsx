import React from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ShieldAlert } from 'lucide-react';

/**
 * ProtectedRoute Component
 * 
 * Protege una sección completa o ruta. Verifica autenticación y permisos.
 * 
 * @param {string|string[]} permissions - Permisos requeridos para acceder.
 * @param {string} operator - 'OR' o 'AND'.
 * @param {React.ReactNode} children - Contenido protegido.
 */
export default function ProtectedRoute({ 
  permissions, 
  operator = 'OR', 
  children 
}) {
  const { user } = useAuth();
  const { hasPermissions, isAuthenticated } = usePermissions();

  // Si no está autenticado, no debería estar aquí (App.jsx maneja el login)
  if (!isAuthenticated) {
    return null;
  }

  // Si no hay permisos requeridos, pasar
  if (!permissions) return <>{children}</>;

  const permsArray = Array.isArray(permissions) ? permissions : [permissions];
  const isAuthorized = hasPermissions(permsArray, operator);

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center animate-fadeIn">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <ShieldAlert size={40} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white"> Acceso Denegado</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          No tienes los permisos necesarios para acceder a esta sección. 
          Contacta con un administrador si crees que esto es un error.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
