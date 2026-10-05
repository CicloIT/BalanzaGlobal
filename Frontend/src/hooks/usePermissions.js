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
  canWrite,
  canEditModule,
  getRolePermissions,
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
   * Verifica si el usuario puede realizar acciones de escritura en un módulo
   */
  const checkCanWrite = useCallback((modulePrefix) => {
    return canWrite(rol, modulePrefix);
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

  /**
   * Verifica si el usuario puede ver el módulo de pesaje
   */
  const canViewPesaje = useCallback(() => {
    return hasPermission(rol, PERMISSIONS.PESAJE_VIEW);
  }, [rol]);

  /**
   * Verifica si el usuario puede crear pesadas
   */
  const canCreatePesada = useCallback(() => {
    return hasPermission(rol, PERMISSIONS.PESAJE_CREATE);
  }, [rol]);

  /**
   * Obtiene todos los permisos del rol actual
   */
  const getCurrentPermissions = useCallback(() => {
    return getRolePermissions(rol);
  }, [rol]);

  /**
   * Verifica si el usuario es admin
   */
  const isAdmin = useCallback(() => {
    return rol?.toLowerCase() === 'admin';
  }, [rol]);

  /**
   * Verifica si el usuario es balancero o subalancero
   */
  const isBalancero = useCallback(() => {
    const lowerRol = rol?.toLowerCase();
    return lowerRol === 'balancero' || lowerRol === 'subalancero';
  }, [rol]);

  /**
   * Verifica si el usuario es subalancero
   */
  const isSubalancero = useCallback(() => {
    return rol?.toLowerCase() === 'subalancero';
  }, [rol]);

  /**
   * Verifica si el usuario es gerente
   */
  const isGerente = useCallback(() => {
    return rol?.toLowerCase() === 'gerente';
  }, [rol]);

  /**
   * Verifica si el usuario tiene rol de restricción
   */
  const isRestriccion = useCallback(() => {
    return rol?.toLowerCase() === 'restriccion';
  }, [rol]);

  /**
   * Filtra un array de tabs según los permisos del usuario
   */
  const filterTabsByPermission = useCallback((tabs) => {
    if (!tabs || !Array.isArray(tabs)) return [];

    return tabs.filter(tab => {
      const moduleId = tab.id;

      // Tabs especiales que no requieren permisos específicos
      if (moduleId === 'dashboard') {
        return hasModuleAccess(rol, MODULES.DASHBOARD);
      }

      // Verificar acceso al módulo
      return hasModuleAccess(rol, moduleId);
    });
  }, [rol]);

  return {
    // Estado
    rol,
    isAuthenticated: !!user,

    // Funciones de verificación
    hasPermission: checkPermission,
    hasModuleAccess: checkModuleAccess,
    hasPermissions: checkPermissions,
    canWrite: checkCanWrite,
    canEditModule: checkCanEditModule,

    // Funciones específicas
    canEnterManualWeight,
    canViewPesaje,
    canCreatePesada,

    // Helpers de rol
    isAdmin,
    isBalancero,
    isSubalancero,
    isGerente,
    isRestriccion,

    // Utilidades
    getCurrentPermissions,
    filterTabsByPermission,

    // Constantes
    PERMISSIONS,
    MODULES,
  };
}

export default usePermissions;
