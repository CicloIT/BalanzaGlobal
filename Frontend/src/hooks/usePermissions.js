/**
 * Hook usePermissions
 *
 * Proporciona funciones para verificar permisos del usuario actual
 * basado en el rol almacenado en el AuthContext.
 */

import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  hasPermission,
  hasModuleAccess,
  hasPermissions,
  canEditModule,
  PERMISSIONS,
  MODULES,
} from '../config/rolesConfig';

export function usePermissions() {
  const { user } = useAuth();
  const rol = user?.rol;

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  const checkPermission = useCallback((permission) => {
    return hasPermission(rol, permission);
  }, [rol]);

  /**
   * Verifica si el usuario tiene acceso a un módulo
   */
  const checkModuleAccess = useCallback((moduleId) => {
    return hasModuleAccess(rol, moduleId);
  }, [rol]);

  /**
   * Verifica si el usuario tiene múltiples permisos
   */
  const checkPermissions = useCallback((permissions, operator = 'OR') => {
    return hasPermissions(rol, permissions, operator);
  }, [rol]);

  /**
   * Verifica si el usuario puede editar un módulo específico
   */
  const checkCanEditModule = useCallback((moduleId) => {
    return canEditModule(rol, moduleId);
  }, [rol]);

  /**
   * Verifica si el usuario puede cargar peso manualmente
   */
  const canEnterManualWeight = useCallback(() => {
    return hasPermission(rol, PERMISSIONS.PESAJE_MANUAL);
  }, [rol]);

  return {
    isAuthenticated: !!user,
    hasPermission: checkPermission,
    hasModuleAccess: checkModuleAccess,
    hasPermissions: checkPermissions,
    canEditModule: checkCanEditModule,
    canEnterManualWeight,
    PERMISSIONS,
    MODULES,
  };
}
