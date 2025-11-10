// NOTE: no diacritics in comments
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/* ------------------ Auth ------------------ */
export async function register({ name, email, password, min_kcal, max_kcal }) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, min_kcal, max_kcal }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Register failed');

  // save auth locally
  localStorage.setItem('token', data.token);
  localStorage.setItem(
    'user',
    JSON.stringify({
      id: data.id,
      name: data.name,
      email: data.email,
      min_kcal: data.min_kcal ?? null,
      max_kcal: data.max_kcal ?? null,
    })
  );
  return data;
}

export async function login({ email, password }) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Login failed');

  localStorage.setItem('token', data.token);
  localStorage.setItem(
    'user',
    JSON.stringify({
      id: data.id,
      name: data.name,
      email: data.email,
      min_kcal: data.min_kcal ?? null,
      max_kcal: data.max_kcal ?? null,
    })
  );
  return data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ------------------ Profile (/me) ------------------ */
export async function getMe() {
  const token = getToken();
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to load profile');

  // keep local cache in sync
  localStorage.setItem('user', JSON.stringify(data));
  return data; // { id, name, email, min_kcal, max_kcal }
}

export async function updateMe({ name, min_kcal, max_kcal }) {
  const token = getToken();
  const res = await fetch(`${API}/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, min_kcal, max_kcal }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to update profile');

  localStorage.setItem('user', JSON.stringify(data));
  return data;
}

