// NOTE: no diacritics in comments
import { getToken } from './api.js';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function getDay(date) {
  const res = await fetch(`${API}/day?date=${date}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to load day');
  // backend now returns:
  // { date, items:[{ id, name, grams, kcal, protein_100g, carbs_100g, fat_100g }...],
  //   total_kcal, user_targets, status, note }
  return data;
}

// payload can include optional macros per 100g
export async function addFood(payload) {
  const res = await fetch(`${API}/day`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Add failed');
  return data; // { id, kcal }
}

export async function updateFood({ id, grams, kcal_100g }) {
  const res = await fetch(`${API}/day/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ grams, kcal_100g }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Update failed');
  return data; // { ok:true, updated:1, kcal }
}

export async function deleteFood(id) {
  const res = await fetch(`${API}/day/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Delete failed');
  return data; // { ok:true, deleted:1 }
}
