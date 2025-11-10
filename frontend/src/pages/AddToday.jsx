// NOTE: no diacritics in comments
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { getCurrentUser } from '../lib/api.js';
import { getDay, addFood, updateFood, deleteFood } from '../lib/day.js';
import { searchFoods } from '../lib/foods.js';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AddToday() {
  const navigate = useNavigate();
  const [date] = useState(todayStr());

  const [items, setItems] = useState([]);             // list for today
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(null);         // below | within | above | null
  const [loading, setLoading] = useState(true);

  // form (single row below the list)
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);     // {label, kcal_100g}
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [grams, setGrams] = useState('');
  const [adding, setAdding] = useState(false);

  // inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editGrams, setEditGrams] = useState('');

  const kcal = useMemo(() => {
    const g = Number(grams);
    if (!selected || !Number.isFinite(g) || g <= 0) return 0;
    return Number(((selected.kcal_100g / 100) * g).toFixed(1));
  }, [grams, selected]);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { navigate('/auth/signin'); return; }
    (async () => {
      try {
        const d = await getDay(date);
        setItems(Array.isArray(d.items) ? d.items : []);
        setTotal(Number(d.total_kcal || 0));
        setStatus(d.status || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function totalColor() {
    if (loading) return '#0d9488';
    if (status === 'below') return '#f59e0b';
    if (status === 'above') return '#ef4444';
    if (status === 'within') return '#10b981';
    return '#0d9488';
  }

  async function refreshTotals() {
    const d = await getDay(date);
    setTotal(Number(d.total_kcal || 0));
    setStatus(d.status || null);
  }

  // search debounce
  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
      const res = await searchFoods(query.trim(), { limit: 10, onlyGeneric: true });
      setSuggestions(res);
      setOpen(res.length > 0);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function pick(item) {
    setSelected(item);
    setQuery(item.label);
    setOpen(false);
  }

  async function handleAdd() {
    if (!selected || !grams) return;
    setAdding(true);
    try {
      const payload = {
        date,
        name: selected.label,
        grams: Number(grams),
        kcal_100g: Number(selected.kcal_100g),
      };
      const res = await addFood(payload); // { id, kcal }

      const newItem = { id: res.id, name: payload.name, grams: payload.grams, kcal: Number(res.kcal) };
      setItems(prev => [newItem, ...prev]);
      await refreshTotals();
      setGrams('');
    } finally {
      setAdding(false);
    }
  }

  // ---- Inline edit helpers ----
  function startEdit(item) {
    setEditingId(item.id);
    setEditGrams(String(item.grams));
  }
  function cancelEdit() {
    setEditingId(null);
    setEditGrams('');
  }
  function kcal100FromItem(item) {
    if (!item || !item.grams) return 0;
    return (Number(item.kcal) * 100) / Number(item.grams);
  }
  function previewKcal(item, gramsVal) {
    const per100 = kcal100FromItem(item);
    const g = Number(gramsVal);
    if (!Number.isFinite(per100) || !Number.isFinite(g) || g <= 0) return item.kcal;
    return Number(((per100 / 100) * g).toFixed(1));
  }

  async function saveEdit(item) {
    const g = Number(editGrams);
    if (!Number.isFinite(g) || g <= 0) return;
    const kcal_100g = Number(kcal100FromItem(item).toFixed(6)); // stable per item
    const res = await updateFood({ id: item.id, grams: g, kcal_100g }); // { kcal }
    // update local list
    setItems(prev =>
      prev.map(it => it.id === item.id ? { ...it, grams: g, kcal: Number(res.kcal) } : it)
    );
    setEditingId(null);
    setEditGrams('');
    await refreshTotals();
  }

  async function removeItem(item) {
    await deleteFood(item.id);
    setItems(prev => prev.filter(it => it.id !== item.id));
    await refreshTotals();
  }

  return (
    <div className="bg-page" style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      <Header />

      <div className="container" style={{ paddingTop: 18, paddingBottom: 24 }}>
        {/* total left under header */}
        <div style={{
          display:'inline-flex', alignItems:'baseline', gap:10,
          background:'#fff', border:'1px solid rgba(2,6,23,.06)', borderRadius:12,
          padding:'12px 16px', boxShadow:'var(--shadow-sm)'
        }}>
          <span style={{ fontWeight:700, color:'#0f172a' }}>Total {date}:</span>
          <span style={{ fontSize:22, fontWeight:800, color: totalColor() }}>
            {loading ? '…' : `${total} kcal`}
          </span>
        </div>

        {/* --------- LIST: Already added today --------- */}
        <section style={{ marginTop: 16 }}>
          <h3 style={{ margin: '6px 0 10px', fontSize: 16, color:'#0f172a' }}>Today’s foods</h3>

          {loading ? (
            <div className="auth-card">Loading…</div>
          ) : items.length === 0 ? (
            <div className="auth-card" style={{ color:'#64748b' }}>
              Nothing added yet. Use the form below to add your first food.
            </div>
          ) : (
            <div style={{ display:'grid', gap:10 }}>
              {items.map(item => {
                const isEditing = editingId === item.id;
                const nextKcal = isEditing ? previewKcal(item, editGrams) : item.kcal;

                return (
                  <div
                    key={item.id}
                    className="auth-card"
                    style={{ display:'grid', gridTemplateColumns:'1fr 140px 120px 80px 80px', gap:10, alignItems:'center' }}
                  >
                    <div style={{ fontWeight:600 }}>{item.name}</div>

                    {/* grams cell */}
                    {!isEditing ? (
                      <div style={{ color:'#334155' }}>{item.grams} g</div>
                    ) : (
                      <input
                        className="food-input"
                        type="number"
                        min="1"
                        step="1"
                        value={editGrams}
                        onChange={e => setEditGrams(e.target.value)}
                      />
                    )}

                    {/* kcal cell */}
                    <div style={{ fontWeight:700 }}>{nextKcal} kcal</div>

                    {/* actions */}
                    {!isEditing ? (
                      <>
                        <button className="icon-btn" title="Edit" onClick={() => startEdit(item)}>
                          <Pencil width={16} height={16} />
                        </button>
                        <button className="icon-btn" title="Delete" onClick={() => removeItem(item)}>
                          <Trash2 width={16} height={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="icon-btn" title="Save" onClick={() => saveEdit(item)}>
                          <Check width={16} height={16} />
                        </button>
                        <button className="icon-btn" title="Cancel" onClick={cancelEdit}>
                          <X width={16} height={16} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* --------- FORM: Add food (below the list) --------- */}
        <section style={{ marginTop: 18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div className="brand-badge" style={{ height:32, width:32, borderRadius:8, boxShadow:'var(--shadow-sm)' }}>
              <Plus width={18} height={18} />
            </div>
            <h3 style={{ margin:0, fontSize:16 }}>Add food for today</h3>
          </div>

          <div
            className="auth-card"
            style={{ display:'grid', gridTemplateColumns:'1.8fr 120px 140px 120px', gap:10, alignItems:'center' }}
          >
            {/* food input with suggestions */}
            <div style={{ position:'relative' }}>
              <input
                type="text"
                placeholder="Type a food (e.g., chicken)"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                className="food-input"
              />
              {open && suggestions.length > 0 && (
                <div className="suggest-box">
                  {suggestions.map((s, i) => (
                    <button key={i} className="suggest-item" onClick={() => pick(s)}>
                      <span>{s.label}</span>
                      <span className="suggest-kcal">{s.kcal_100g} kcal/100g</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* grams */}
            <input
              type="number"
              min="1"
              step="1"
              placeholder="grams"
              value={grams}
              onChange={(e)=>setGrams(e.target.value)}
              className="food-input"
            />

            {/* kcal computed */}
            <div style={{
              background:'#f8fafc', border:'1px solid rgba(2,6,23,.06)', borderRadius:10,
              height:44, display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:700, color:'#0f172a'
            }}>
              {kcal} kcal
            </div>

            {/* add button */}
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !selected || !grams}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
