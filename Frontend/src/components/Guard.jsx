import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Guard Component
 * 
 * Envoltorio que renderiza sus hijos solo si el usuario tiene los permisos requeridos.
 * 
 * @param {string|string[]} permissions - Un permiso o array de permisos requeridos.
 * @param {string} operator - 'OR' (al menos uno) o 'AND' (todos). Por defecto 'OR'.
 * @param {React.ReactNode} fallback - Componente opcional a mostrar si no hay permiso.
 * @param {React.ReactNode} children - Contenido a proteger.
 */
export default function Guard({ 
  permissions, 
  operator = 'OR', 
  fallback = null, 
  children 
}) {
  const { hasPermissions } = usePermissions();

  if (!permissions) return <>{children}</>;

  const permsArray = Array.isArray(permissions) ? permissions : [permissions];
  const isAuthorized = hasPermissions(permsArray, operator);

  if (!isAuthorized) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
