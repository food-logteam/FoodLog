// NOTE: no diacritics in comments
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header.jsx';
import { getCurrentUser } from '../lib/api.js';
import { getDay, addFood, updateFood, deleteFood } from '../lib/day.js';
import { searchFoods } from '../lib/foods.js';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function jsDayToMonFirst(jsDay) { return (jsDay + 6) % 7; }

export default function Future() {
  // calendar state
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => new Date());

  // day data
  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // add form
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState(null); // { label, kcal_100g }
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [grams, setGrams] = useState('');
  const [adding, setAdding] = useState(false);

  // inline edit
  const [editingId, setEditingId] = useState(null);
  const [editGrams, setEditGrams] = useState('');

  // calendar build (same as History)
  const calendarCells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const padStart = jsDayToMonFirst(first.getDay());

    const cells = [];
    for (let i = 0; i < padStart; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  // load day when page starts
  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      setLoading(false);
      return;
    }
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDay(d = selected) {
    try {
      setLoading(true);
      setErr('');
      const ymd = toYMD(d);
      const data = await getDay(ymd);
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total_kcal || 0));
      setStatus(data.status || null);
    } catch (e) {
      setErr(e.message || 'Failed to load day');
      setItems([]); setTotal(0); setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  function prevMonth(){ setMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1)); }
  function nextMonth(){ setMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1)); }
  function pickDate(d){ if (!d) return; setSelected(d); loadDay(d); }

  function totalColor() {
    if (loading) return '#0d9488';
    if (status === 'below') return '#f59e0b';
    if (status === 'above') return '#ef4444';
    if (status === 'within') return '#10b981';
    return '#0d9488';
  }

  async function refreshTotals() { await loadDay(selected); }

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

  function pickFood(item){
    setSelectedFood(item);
    setQuery(item.label);
    setOpen(false);
  }

  const kcalPreview = useMemo(() => {
    const g = Number(grams);
    if (!selectedFood || !Number.isFinite(g) || g <= 0) return 0;
    return Number(((selectedFood.kcal_100g / 100) * g).toFixed(1));
  }, [grams, selectedFood]);

  async function handleAdd(){
    if (!selectedFood || !grams) return;
    setAdding(true);
    try{
      const payload = {
        date: toYMD(selected),
        name: selectedFood.label,
        grams: Number(grams),
        kcal_100g: Number(selectedFood.kcal_100g),
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

  // edit helpers
  function startEdit(item){ setEditingId(item.id); setEditGrams(String(item.grams)); }
  function cancelEdit(){ setEditingId(null); setEditGrams(''); }
  function kcal100FromItem(item){
    if (!item || !item.grams) return 0;
    return (Number(item.kcal) * 100) / Number(item.grams);
  }
  function previewKcal(item, gramsVal){
    const per100 = kcal100FromItem(item);
    const g = Number(gramsVal);
    if (!Number.isFinite(per100) || !Number.isFinite(g) || g <= 0) return item.kcal;
    return Number(((per100 / 100) * g).toFixed(1));
  }
  async function saveEdit(item){
    const g = Number(editGrams);
    if (!Number.isFinite(g) || g <= 0) return;
    const kcal_100g = Number(kcal100FromItem(item).toFixed(6));
    const res = await updateFood({ id: item.id, grams: g, kcal_100g });
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, grams: g, kcal: Number(res.kcal) } : it));
    setEditingId(null); setEditGrams('');
    await refreshTotals();
  }
  async function removeItem(item){
    await deleteFood(item.id);
    setItems(prev => prev.filter(it => it.id !== item.id));
    await refreshTotals();
  }

  const todayYMD = toYMD(new Date());
  const selectedYMD = toYMD(selected);

  return (
    <div className="bg-page" style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      <Header />

      <div className="container" style={{ paddingTop: 18, paddingBottom: 24 }}>
        {/* Title */}
        <div style={{ textAlign:'center', margin:'8px 0 18px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Plan Meals</h1>
          <p style={{ color:'#64748b', marginTop: 6 }}>Pick a date, then add foods just like for today</p>
        </div>

        {/* two columns: calendar + day panel */}
        <div className="history-layout">
          {/* Calendar */}
          <section className="auth-card history-card">
            <div className="cal-header">
              <button className="cal-nav" onClick={prevMonth} aria-label="Previous month">‹</button>
              <div className="cal-title">
                {month.toLocaleString('en-US', { month: 'long' })} {month.getFullYear()}
              </div>
              <button className="cal-nav" onClick={nextMonth} aria-label="Next month">›</button>
            </div>

            <div className="cal-week">
              {WEEKDAYS.map((w) => (
                <div key={w} className="cal-weekday">{w}</div>
              ))}
            </div>

            <div className="cal-grid">
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={idx} className="cal-cell disabled" />;
                const ymd = toYMD(cell);
                const isToday    = ymd === todayYMD;
                const isSelected = ymd === selectedYMD;
                return (
                  <button
                    key={idx}
                    className={`cal-cell${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                    onClick={() => pickDate(cell)}
                  >
                    {cell.getDate()}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Day details + add form */}
          <section className="auth-card history-card">
            {/* total bar */}
            <div style={{
              display:'inline-flex', alignItems:'baseline', gap:10,
              background:'#fff', border:'1px solid rgba(2,6,23,.06)', borderRadius:12,
              padding:'10px 14px', boxShadow:'var(--shadow-sm)'
            }}>
              <span style={{ fontWeight:700, color:'#0f172a' }}>Total {selectedYMD}:</span>
              <span style={{ fontSize:20, fontWeight:800, color: totalColor() }}>
                {loading ? '…' : `${total} kcal`}
              </span>
            </div>

            {/* list */}
            <section style={{ marginTop: 12 }}>
              <h3 style={{ margin: '6px 0 10px', fontSize: 16, color:'#0f172a' }}>Planned foods</h3>

              {loading ? (
                <div className="auth-card">Loading…</div>
              ) : items.length === 0 ? (
                <div className="auth-card" style={{ color:'#64748b' }}>
                  No foods planned yet for this date.
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
                        style={{
                          display:'grid',
                          gridTemplateColumns:'2.5fr 90px 120px 80px 80px',  // widened name, compact grams
                          gap:10,
                          alignItems:'center'
                        }}
                      >
                        <div style={{ fontWeight:600 }}>{item.name}</div>

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

                        <div style={{ fontWeight:700 }}>{nextKcal} kcal</div>

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

            {/* add form */}
            <section style={{ marginTop: 16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div className="brand-badge" style={{ height:32, width:32, borderRadius:8, boxShadow:'var(--shadow-sm)' }}>
                  <Plus width={18} height={18} />
                </div>
                <h3 style={{ margin:0, fontSize:16 }}>Add food for {selectedYMD}</h3>
              </div>

              <div
                className="auth-card"
                style={{
                  display:'grid',
                  gridTemplateColumns:'2.5fr 90px 120px 120px',   // wider name, smaller grams
                  gap:10,
                  alignItems:'center'
                }}
              >
                {/* food with suggestions */}
                <div style={{ position:'relative' }}>
                  <input
                    type="text"
                    placeholder="Type a food (e.g., chicken)"
                    value={query}
                    onChange={(e)=>{ setQuery(e.target.value); setSelectedFood(null); }}
                    className="food-input"
                  />
                  {open && suggestions.length > 0 && (
                    <div className="suggest-box">
                      {suggestions.map((s, i) => (
                        <button key={i} className="suggest-item" onClick={() => pickFood(s)}>
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
                  {kcalPreview} kcal
                </div>

                {/* add */}
                <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !selectedFood || !grams}>
                  {adding ? 'Adding…' : 'Add'}
                </button>
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  );
}
