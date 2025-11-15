// NOTE: no diacritics in comments
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header.jsx';
import { getDay } from '../lib/day.js';
import { getToken } from '../lib/api.js';
import { saveNote, deleteNote } from '../lib/notes.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Make JS week start on Monday (0..6 -> Mon..Sun)
function jsDayToMonFirst(jsDay) {
  // JS: 0 Sun .. 6 Sat
  // We want: 0 Mon .. 6 Sun
  return (jsDay + 6) % 7;
}

// helper: compute macros per entry from *_100g columns
function withMacrosFrom100g(raw) {
  const {
    protein_100g = null,
    carbs_100g = null,
    fat_100g = null,
    grams,
    ...rest
  } = raw || {};
  const g = Number(grams);

  let protein = null;
  let carbs = null;
  let fat = null;

  if (protein_100g != null && Number.isFinite(g) && g > 0) {
    protein = Number(((Number(protein_100g) / 100) * g).toFixed(1));
  }
  if (carbs_100g != null && Number.isFinite(g) && g > 0) {
    carbs = Number(((Number(carbs_100g) / 100) * g).toFixed(1));
  }
  if (fat_100g != null && Number.isFinite(g) && g > 0) {
    fat = Number(((Number(fat_100g) / 100) * g).toFixed(1));
  }

  return {
    ...rest,
    grams: g,
    protein_100g: protein_100g != null ? Number(protein_100g) : null,
    carbs_100g: carbs_100g != null ? Number(carbs_100g) : null,
    fat_100g: fat_100g != null ? Number(fat_100g) : null,
    protein,
    carbs,
    fat,
  };
}

export default function History() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    // we keep a date anchored to 1st of month
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [dayData, setDayData] = useState(null);

  // note state for selected date
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMsg, setNoteMsg] = useState('');

  // protect route (simple): if no token, backend or router already blocks, but we prevent API calls
  const hasToken = !!getToken();

  const calendarCells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const daysInMonth = last.getDate();
    const padStart = jsDayToMonFirst(first.getDay()); // how many blanks before day 1

    const cells = [];
    for (let i = 0; i < padStart; i++) cells.push(null); // leading blanks
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    // pad end to complete rows of 7
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  useEffect(() => {
    if (!hasToken) return;
    loadDay(toYMD(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDay(ymd) {
    try {
      setLoading(true);
      setErr('');
      const data = await getDay(ymd);

      const mappedItems = Array.isArray(data.items)
        ? data.items.map(withMacrosFrom100g)
        : [];

      setDayData({ ...data, items: mappedItems });
      setNote(data.note || '');
      setNoteMsg('');
    } catch (e) {
      setErr(e.message || 'Failed to load day');
      setDayData(null);
      setNote('');
      setNoteMsg('');
    } finally {
      setLoading(false);
    }
  }

  function prevMonth() {
    setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function selectDate(d) {
    if (!d) return;
    setSelected(d);
    loadDay(toYMD(d));
  }

  async function handleSaveNote() {
    const ymd = toYMD(selected);
    setNoteSaving(true);
    setNoteMsg('');
    try {
      const trimmed = note.trim();
      if (trimmed) {
        await saveNote(ymd, trimmed);
        setNote(trimmed);
        setNoteMsg('Note saved');
      } else {
        await deleteNote(ymd);
        setNote('');
        setNoteMsg('Note cleared');
      }
    } catch (e) {
      setNoteMsg(e.message || 'Failed to save note');
    } finally {
      setNoteSaving(false);
    }
  }

  const todayYMD = toYMD(new Date());
  const selectedYMD = toYMD(selected);

  return (
    <div className="bg-page" style={{ minHeight: '100vh' }}>
      <Header />
      
      {/* Title */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '40px',
          marginBottom: '20px',
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#0f172a',
          }}
        >
          Meal History
        </h1>
        <p style={{ color: '#64748b' }}>
          Select a date below to view your logged meals and notes
        </p>
      </div>

      <main className="container" style={{ flex: 1, padding: '24px 0 64px' }}>
        <div className="history-layout">
          {/* Calendar card */}
          <section className="auth-card history-card">
            <div className="cal-header">
              <button className="cal-nav" onClick={prevMonth} aria-label="Previous month">
                ‹
              </button>
              <div className="cal-title">
                {month.toLocaleString('en-US', { month: 'long' })} {month.getFullYear()}
              </div>
              <button className="cal-nav" onClick={nextMonth} aria-label="Next month">
                ›
              </button>
            </div>

            <div className="cal-week">
              {WEEKDAYS.map((w) => (
                <div key={w} className="cal-weekday">
                  {w}
                </div>
              ))}
            </div>

            <div className="cal-grid">
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={idx} className="cal-cell disabled" />;
                const ymd = toYMD(cell);
                const isToday = ymd === todayYMD;
                const isSelected = ymd === selectedYMD;
                return (
                  <button
                    key={idx}
                    className={`cal-cell${isSelected ? ' selected' : ''}${
                      isToday ? ' today' : ''
                    }`}
                    onClick={() => selectDate(cell)}
                    aria-label={`Select ${ymd}`}
                  >
                    {cell.getDate()}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Day details */}
          <section className="auth-card history-card">
            <h2 className="auth-title" style={{ marginBottom: 6 }}>
              {selectedYMD}
            </h2>

            {loading && <p className="feature-text" style={{ marginTop: 8 }}>Loading…</p>}
            {err && !loading && (
              <div className="form-error" style={{ marginTop: 8 }}>
                {err}
              </div>
            )}

            {!loading && !err && dayData && (
              <>
                {/* summary */}
                <div className="day-summary">
                  <div className="sum-item">
                    <span className="sum-label">Total kcal</span>
                    <span className="sum-value">{dayData.total_kcal}</span>
                  </div>

                  {dayData.user_targets && (
                    <>
                      {dayData.user_targets.min_kcal != null && (
                        <div className="sum-item">
                          <span className="sum-label">Min target</span>
                          <span className="sum-chip min">
                            {dayData.user_targets.min_kcal}
                          </span>
                        </div>
                      )}
                      {dayData.user_targets.max_kcal != null && (
                        <div className="sum-item">
                          <span className="sum-label">Max target</span>
                          <span className="sum-chip max">
                            {dayData.user_targets.max_kcal}
                          </span>
                        </div>
                      )}
                      {dayData.status && (
                        <div className={`sum-badge ${dayData.status}`}>
                          {dayData.status === 'below' && 'Below target'}
                          {dayData.status === 'within' && 'Within target'}
                          {dayData.status === 'above' && 'Above target'}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* list of foods */}
                <div className="day-list" style={{ marginTop: 16 }}>
                  {dayData.items.length === 0 ? (
                    <p className="feature-text" style={{ marginTop: 8 }}>
                      No items for this day.
                    </p>
                  ) : (
                    <ul className="food-list">
                      {dayData.items.map((it) => (
                        <li key={it.id} className="food-row">
                          <div className="food-name">
                            <div style={{ fontWeight: 600 }}>{it.name}</div>
                            {it.protein != null && it.carbs != null && it.fat != null && (
                              <div style={{ marginTop: 4, fontSize: 12 }}>
                                <div style={{ color: '#ef4444' }}>Proteins {it.protein} g</div>
                                <div style={{ color: '#3b82f6' }}>Carbs {it.carbs} g</div>
                                <div style={{ color: '#22c55e' }}>Fats {it.fat} g</div>
                              </div>
                            )}
                          </div>
                          <div className="food-meta">{it.grams} g</div>
                          <div className="food-kcal">{it.kcal}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* note for this day */}
                <div
                  className="auth-card"
                  style={{
                    marginTop: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: '#f8fafc',
                  }}
                >
                  <label
                    htmlFor="history-note"
                    style={{ fontWeight: 600, fontSize: 14 }}
                  >
                    Note for this day
                  </label>
                  <textarea
                    id="history-note"
                    rows={3}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setNoteMsg('');
                    }}
                    className="food-input"
                    style={{ resize: 'vertical', minHeight: 70, background: '#fff' }}
                    placeholder="Write how this day went, cravings, mood, or anything relevant."
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 4,
                    }}
                  >
                    {noteMsg && (
                      <span
                        style={{
                          fontSize: 13,
                          color: noteMsg.includes('Failed') ? '#ef4444' : '#0d9488',
                          fontWeight: 500,
                        }}
                      >
                        {noteMsg}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '8px 18px', fontSize: 14 }}
                      onClick={handleSaveNote}
                      disabled={noteSaving}
                    >
                      {noteSaving ? 'Saving…' : 'Save note'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
