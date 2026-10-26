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

// Headers con el usuario logueado. contentType = null para GET o multipart (FormData)
export const getAuthHeaders = (contentType = 'application/json') => {
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;

  const user = getStoredUser();
  if (user?.id) headers['x-user-id'] = user.id.toString();
  if (user?.username) headers['x-username'] = user.username;

  return headers;
};
