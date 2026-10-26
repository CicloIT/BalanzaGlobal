// Base de la API (vacío = mismo origen; en dev lo resuelve el proxy de Vite)
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
export const STORAGE_KEY = 'balanza_user';

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

// Headers de los requests a la API. contentType = null para GET o multipart (FormData).
// La sesión viaja sola en la cookie httpOnly que pone el login (mismo origen).
export const getAuthHeaders = (contentType = 'application/json') => {
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
};
