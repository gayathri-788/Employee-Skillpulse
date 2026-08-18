import { API_BASE_URL, ApiError } from './api';

export async function downloadFile(endpoint: string, filename: string, token: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${API_BASE_URL}${cleanEndpoint}`, { headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Download failed' }));
    throw new ApiError(err.detail || 'Download failed', response.status);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
