// NOTE: no diacritics in comments
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header.jsx';
import { getDay } from '../lib/day.js';
import { getToken } from '../lib/api.js';

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

  // protect route (simple): if no token, backend or router already blocks, dar verificam ca sa nu mai apelam API
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
    // optionally pad end to complete rows of 7 (looks nicer)
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  useEffect(() => {
    // load today's data initially
    if (!hasToken) return;
    loadDay(toYMD(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDay(ymd) {
    try {
      setLoading(true);
      setErr('');
      const data = await getDay(ymd);
      setDayData(data);
    } catch (e) {
      setErr(e.message || 'Failed to load day');
      setDayData(null);
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

  const todayYMD = toYMD(new Date());
  const selectedYMD = toYMD(selected);

  return (
    <div className="bg-page" style={{ minHeight: '100vh' }}>
      <Header />
      
      {/* Title */}
      <div style={{
        textAlign: 'center',
        marginTop: '40px',
        marginBottom: '20px',
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 700,
          color: '#0f172a',
        }}>
          Meal History
        </h1>
        <p style={{ color: '#64748b' }}>
          Select a date below to view your logged meals
        </p>
      </div>

      <main className="container" style={{ flex: 1, padding: '24px 0 64px' }}>
        <div className="history-layout">
          {/* Calendar card */}
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
                const isToday = ymd === todayYMD;
                const isSelected = ymd === selectedYMD;
                return (
                  <button
                    key={idx}
                    className={`cal-cell${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
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
              {toYMD(selected)}
            </h2>

            {loading && <p className="feature-text" style={{ marginTop: 8 }}>Loading…</p>}
            {err && !loading && <div className="form-error" style={{ marginTop: 8 }}>{err}</div>}

            {!loading && !err && dayData && (
              <>
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
                          <span className="sum-chip min">{dayData.user_targets.min_kcal}</span>
                        </div>
                      )}
                      {dayData.user_targets.max_kcal != null && (
                        <div className="sum-item">
                          <span className="sum-label">Max target</span>
                          <span className="sum-chip max">{dayData.user_targets.max_kcal}</span>
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

                <div className="day-list">
                  {dayData.items.length === 0 ? (
                    <p className="feature-text" style={{ marginTop: 8 }}>No items for this day.</p>
                  ) : (
                    <ul className="food-list">
                      {dayData.items.map((it) => (
                        <li key={it.id} className="food-row">
                          <div className="food-name">{it.name}</div>
                          <div className="food-meta">{it.grams} g</div>
                          <div className="food-kcal">{it.kcal}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
