// In-memory auth token store (avoids persisting sensitive tokens in localStorage)
let inMemoryAdminToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryAdminToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryAdminToken;
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryAdminToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAdminToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function uploadImageFile(file: File): Promise<{ url: string; filename: string }> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WEBP image files are supported.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image size must be 5 MB or less.');
  }
  const formData = new FormData();
  formData.append('image', file);
  return apiRequest<{ url: string; filename: string }>('/api/admin/upload', {
    method: 'POST',
    body: formData,
  });
}
