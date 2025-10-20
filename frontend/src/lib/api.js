// NOTE: no diacritics in comments
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function register({ name, email, password }) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Register failed');
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify({ id: data.id, name: data.name, email: data.email }));
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
  localStorage.setItem('user', JSON.stringify({ id: data.id, name: data.name, email: data.email }));
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
  const raw = localStorage.getItem('user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
