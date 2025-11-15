// NOTE: no diacritics in comments
import { getToken } from './api.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function getNote(date) {
  const res = await fetch(`${API}/notes?date=${encodeURIComponent(date)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to load note');

  // backend may return {id, date, note} or {date, note:null}
  return data.note ?? null;
}

export async function saveNote(date, note) {
  const res = await fetch(`${API}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ date, note }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to save note');
  return data;
}

export async function deleteNote(date) {
  const res = await fetch(`${API}/notes?date=${encodeURIComponent(date)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to delete note');
  return data;
}
