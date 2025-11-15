// NOTE: no diacritics in comments
import { getToken } from './api.js';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Query backend /foods/search (protected)
 * returns [{ label, kcal_100g, protein_100g, carbs_100g, fat_100g }, ...]
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

  // backend items are expected to have: name, kcal_100g, protein_100g, carbs_100g, fat_100g
  return items.map(i => ({
    label: i.name,
    kcal_100g: i.kcal_100g,
    protein_100g: i.protein_100g ?? null,
    carbs_100g: i.carbs_100g ?? null,
    fat_100g: i.fat_100g ?? null,
  }));
}
