const API_BASE_URL = (import.meta.env.VITE_API_URL || '')
  .replace(/\/+$/, '')
  .replace(/\/api\/v1$/, '');

/**
 * Standard API request wrapper for SlotFlow
 * @param {string} endpoint
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const activeBusinessId = localStorage.getItem('activeBusinessId');

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (activeBusinessId) {
    headers.set('x-business-id', activeBusinessId);
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${API_BASE_URL}/api/v1${cleanEndpoint}`, {
    ...options,
    headers,
    credentials: 'include' // Send session cookie
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = data?.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
