// NOTE: no diacritics in comments
import { getToken } from './api.js';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Query backend /foods/search (protected)
 * returns [{ name, kcal_100g }, ...]
 */
export async function searchFoods(query, { limit = 10, onlyGeneric = true } = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const url = new URL(`${API}/foods/search`);
  url.searchParams.set('query', q);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('onlyGeneric', onlyGeneric ? 'true' : 'false');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('foods/search error:', data);
    return [];
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  // normalize to { label, kcal_100g } like before
  return items.map(i => ({ label: i.name, kcal_100g: i.kcal_100g }));
}
