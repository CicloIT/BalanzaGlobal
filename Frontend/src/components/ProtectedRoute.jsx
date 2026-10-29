import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import EmptyState from './ui/EmptyState';

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
      <EmptyState
        icon={ShieldAlert}
        title="Acceso denegado"
        description="No tenés permisos para acceder a esta sección. Si creés que es un error, consultá con un administrador."
      />
    );
  }

  return <>{children}</>;
}
