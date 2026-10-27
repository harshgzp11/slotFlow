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

  const response = await fetch(`/api/v1${endpoint}`, {
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
