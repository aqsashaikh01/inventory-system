import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const G = {
  green: '#1B6B45',
  greenLight: '#E8F5EE',
  bg: '#F5F5F2',
  surface: '#FFFFFF',
  surfaceSecondary: '#EFEFEB',
  border: 'rgba(0,0,0,0.08)',
  borderSoft: 'rgba(0,0,0,0.05)',
  textPrimary: '#111110',
  textSecondary: '#6B6B68',
  textTertiary: '#9A9A96',
  red: '#991B1B',
  redLight: '#FEF2F2',
  redBorder: '#FECACA',
  greenStock: '#166534',
  greenStockLight: '#F0FDF4',
  greenStockBorder: '#BBF7D0',
};

const font = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

// Returns YYYY-MM-DD in local time (avoids UTC offset bugs)
const toLocalDate = (d) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getPresetRange = (preset) => {
  const now = new Date();
  const today = toLocalDate(now);
  if (preset === 'today') return { start: today, end: today };
  if (preset === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const s = toLocalDate(y);
    return { start: s, end: s };
  }
  if (preset === 'week') {
    const w = new Date(now); w.setDate(w.getDate() - 6);
    return { start: toLocalDate(w), end: today };
  }
  if (preset === 'month') {
    const m = new Date(now); m.setDate(m.getDate() - 29);
    return { start: toLocalDate(m), end: today };
  }
  return { start: today, end: today };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [daily, setDaily] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [tab, setTab] = useState('sales');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, inv: null, qty: '1', password: '', error: '', deleting: false });

  // Date filter state
  const [preset, setPreset] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // Outlet filter
  const [outletFilter, setOutletFilter] = useState('all');

  const fetchSales = useCallback((startDate, endDate) => {
    setSalesLoading(true);
    api.get('/dashboard/daily', { params: { startDate, endDate } })
      .then(r => setDaily(r.data))
      .catch(() => setDaily(null))
      .finally(() => setSalesLoading(false));
  }, []);

  // Initial load
  useEffect(() => {
    if (user?.role === 'admin') {
      const { start, end } = getPresetRange('today');
      Promise.allSettled([
        api.get('/dashboard/daily', { params: { startDate: start, endDate: end } }),
        api.get('/dashboard/inventory'),
        api.get('/dashboard/movements'),
      ]).then(([d, inv, mov]) => {
        if (d.status === 'fulfilled') setDaily(d.value.data);
        if (inv.status === 'fulfilled') setInventory(inv.value.data);
        if (mov.status === 'fulfilled') setMovements(mov.value.data);
      }).finally(() => setLoading(false));
    }
  }, [user]);

  // Re-fetch sales on filter change
  useEffect(() => {
    if (!user || user.role !== 'admin' || loading) return;
    if (isCustom) {
      if (customStart && customEnd && customStart <= customEnd) {
        fetchSales(customStart, customEnd);
      }
    } else {
      const { start, end } = getPresetRange(preset);
      fetchSales(start, end);
    }
    setOutletFilter('all');
  }, [preset, isCustom, customStart, customEnd, user, loading, fetchSales]);

  const handlePreset = (p) => {
    setPreset(p);
    setIsCustom(false);
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) { alert('Start date cannot be after end date'); return; }
    setIsCustom(true);
  };

  const handleClearCustom = () => {
    setIsCustom(false);
    setCustomStart('');
    setCustomEnd('');
    setPreset('today');
  };

  const activeDateLabel = isCustom
    ? `${customStart}  →  ${customEnd}`
    : { today: "Today's", yesterday: "Yesterday's", week: 'Last 7 Days', month: 'Last 30 Days' }[preset];

  const statusLabel = (status) => ({
    generated:  'Generated',
    in_factory: 'In Factory',
    dispatched: 'Dispatched',
    in_shop:    'In Shop',
    sold:       'Sold',
  }[status] || status);

  const statusDot = (status) => ({
    generated:  '#9A9A96',
    in_factory: '#B45309',
    dispatched: '#1D4ED8',
    in_shop:    '#7C3AED',
    sold:       G.green,
  }[status] || '#9A9A96');

  const filteredLocations = daily
    ? Object.entries(daily.byLocation).filter(([loc]) =>
        outletFilter === 'all' || loc === outletFilter
      )
    : [];

  const summaryTotal = filteredLocations.reduce((sum, [, d]) => sum + d.totalRevenue, 0);
  const summaryUnits = filteredLocations.reduce((sum, [, d]) => sum + d.totalUnits, 0);
  const summaryAvg = summaryUnits ? Math.round(summaryTotal / summaryUnits) : 0;
  const outletOptions = daily ? Object.keys(daily.byLocation) : [];

  const openDeleteModal = (inv) =>
    setDeleteModal({ open: true, inv, qty: '1', password: '', error: '', deleting: false });

  const closeDeleteModal = () =>
    setDeleteModal({ open: false, inv: null, qty: '1', password: '', error: '', deleting: false });

  const availableQty = deleteModal.inv?.quantity ?? 0;

  // Returns an error string for the typed quantity, or '' when it's valid
  const validateQty = (raw) => {
    const value = String(raw).trim();
    if (!value) return 'Enter a quantity.';
    if (!/^\d+$/.test(value)) return 'Enter a whole number — no decimals or symbols.';
    const n = Number(value);
    if (n < 1) return 'Quantity must be at least 1.';
    if (n > availableQty) return `Only ${availableQty} unit${availableQty !== 1 ? 's' : ''} in stock here.`;
    return '';
  };

  const qtyError = validateQty(deleteModal.qty);
  const confirmDisabled = deleteModal.deleting || !deleteModal.password || !!qtyError;

  const handleDeleteConfirm = async () => {
    if (qtyError) {
      setDeleteModal(m => ({ ...m, error: qtyError }));
      return;
    }
    if (deleteModal.password !== 'admin123') {
      setDeleteModal(m => ({ ...m, error: 'Incorrect password. Please try again.' }));
      return;
    }
    const productId = deleteModal.inv?.product?._id;
    const locationId = deleteModal.inv?.location?._id;
    if (!productId || !locationId) {
      setDeleteModal(m => ({ ...m, error: 'Product reference is missing. Refresh the page.' }));
      return;
    }
    setDeleteModal(m => ({ ...m, deleting: true, error: '' }));
    try {
      const { data } = await api.post('/units/remove-stock', {
        productId,
        locationId,
        quantity: Number(deleteModal.qty),
      });
      setInventory(prev => prev
        .map(i => (i.product?._id === productId && i.location?._id === locationId)
          ? { ...i, quantity: i.quantity - data.removed }
          : i)
        .filter(i => i.quantity > 0));
      closeDeleteModal();
    } catch (err) {
      setDeleteModal(m => ({
        ...m,
        deleting: false,
        error: err.response?.data?.error || 'Failed to remove stock. Please try again.',
      }));
    }
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: G.textSecondary, fontFamily: font, fontSize: 14 }}>
      Loading...
    </div>
  );

  return (
    <div style={{ fontFamily: font, background: G.bg, minHeight: '100vh', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: G.textPrimary, letterSpacing: '-0.3px', margin: 0 }}>
            Dashboard
          </h2>
          <span style={{ fontSize: 13, color: G.textSecondary }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' })}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: '1.5rem', borderBottom: `1px solid ${G.border}` }}>
          {['sales', 'inventory', 'activity'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${G.green}` : '2px solid transparent',
              marginBottom: -1,
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: font,
              color: tab === t ? G.green : G.textSecondary,
              transition: 'color 0.15s',
              textTransform: 'capitalize',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* SALES TAB */}
        {tab === 'sales' && (
          <div>
            {/* Summary Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Sales', value: `₹${summaryTotal.toLocaleString('en-IN')}`, sub: activeDateLabel },
                { label: 'Units Sold', value: summaryUnits, sub: outletFilter === 'all' ? 'All outlets' : outletFilter },
                { label: 'Avg. Per Unit', value: `₹${summaryAvg.toLocaleString('en-IN')}`, sub: 'Per transaction' },
              ].map(m => (
                <div key={m.label} style={{ background: G.surfaceSecondary, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: G.textTertiary, marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: G.textPrimary, letterSpacing: '-0.5px' }}>{m.value}</div>
                  <div style={{ fontSize: 12, color: G.textSecondary, marginTop: 3 }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Filter Panel */}
            <div style={{ background: G.surface, border: `0.5px solid ${G.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: '1.25rem' }}>

              {/* Preset pills */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'week', label: 'Last 7 Days' },
                  { key: 'month', label: 'Last 30 Days' },
                ].map(p => (
                  <button key={p.key} onClick={() => handlePreset(p.key)} style={{
                    padding: '5px 13px',
                    border: `1px solid ${!isCustom && preset === p.key ? G.green : G.border}`,
                    borderRadius: 20,
                    background: !isCustom && preset === p.key ? G.greenLight : G.surface,
                    color: !isCustom && preset === p.key ? G.green : G.textSecondary,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: font,
                    transition: 'all 0.15s',
                  }}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom date range + outlet filter row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: G.textTertiary, fontWeight: 500 }}>Custom</span>
                <input
                  type="date"
                  value={customStart}
                  max={toLocalDate(new Date())}
                  onChange={e => { setCustomStart(e.target.value); setIsCustom(false); }}
                  style={dateInputStyle}
                />
                <span style={{ fontSize: 12, color: G.textTertiary }}>to</span>
                <input
                  type="date"
                  value={customEnd}
                  max={toLocalDate(new Date())}
                  onChange={e => { setCustomEnd(e.target.value); setIsCustom(false); }}
                  style={dateInputStyle}
                />
                <button onClick={handleCustomApply} disabled={!customStart || !customEnd} style={{
                  padding: '6px 14px', background: customStart && customEnd ? G.green : G.surfaceSecondary,
                  color: customStart && customEnd ? '#fff' : G.textTertiary,
                  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  cursor: customStart && customEnd ? 'pointer' : 'default', fontFamily: font,
                }}>
                  Apply
                </button>
                {isCustom && (
                  <button onClick={handleClearCustom} style={{
                    padding: '6px 12px', background: 'none', color: G.textSecondary,
                    border: `1px solid ${G.border}`, borderRadius: 8, fontSize: 12,
                    cursor: 'pointer', fontFamily: font,
                  }}>
                    Clear
                  </button>
                )}

                {/* Outlet filter pushed to right */}
                <div style={{ marginLeft: 'auto' }}>
                  <select value={outletFilter} onChange={e => setOutletFilter(e.target.value)} style={selectStyle}>
                    <option value="all">All Outlets</option>
                    {outletOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section Label */}
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: G.textTertiary, marginBottom: 10 }}>
              {activeDateLabel} · Sales by Outlet
            </div>

            {/* Results */}
            {salesLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: G.textSecondary, fontSize: 14 }}>
                Loading sales...
              </div>
            ) : filteredLocations.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
                <p style={{ color: G.textSecondary, fontSize: 14 }}>No sales recorded for this period.</p>
              </div>
            ) : (
              filteredLocations.map(([loc, data]) => (
                <div key={loc} style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `0.5px solid ${G.borderSoft}` }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: G.textPrimary }}>{loc}</div>
                      <div style={{ fontSize: 12, color: G.textSecondary, marginTop: 2 }}>
                        {data.totalUnits} unit{data.totalUnits !== 1 ? 's' : ''} sold
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: G.green }}>
                      ₹{data.totalRevenue.toLocaleString('en-IN')}
                    </div>
                  </div>
                  {data.sales.map(s => (
                    <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderTop: `0.5px solid ${G.borderSoft}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: G.textPrimary }}>{s.product?.name}</div>
                        <div style={{ fontSize: 12, color: G.textSecondary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{s.unitCode}</span>
                          {s.clientName && <><span style={dotStyle} /><span>{s.clientName}</span></>}
                          {s.paymentMethod && (
                            <><span style={dotStyle} />
                            <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: G.greenLight, color: G.green }}>
                              {s.paymentMethod.toUpperCase()}
                            </span></>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: G.textPrimary }}>
                        ₹{s.product?.sellingPrice?.toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* INVENTORY TAB */}
        {tab === 'inventory' && (
          <div>
            <div style={sectionLabelStyle}>Current Stock — All Locations</div>
            {inventory.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
                <p style={{ color: G.textSecondary, fontSize: 14 }}>No stock currently in system.</p>
              </div>
            ) : (
              inventory.map((inv, i) => (
                <div key={i} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: G.textPrimary, marginBottom: 3 }}>
                      {inv.product?.name}
                    </div>
                    <div style={{ fontSize: 12, color: G.textSecondary }}>
                      {inv.location?.name} · SKU: {inv.product?.sku}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        background: inv.quantity < 3 ? G.redLight : G.greenStockLight,
                        color: inv.quantity < 3 ? G.red : G.greenStock,
                        border: `1px solid ${inv.quantity < 3 ? G.redBorder : G.greenStockBorder}`,
                        padding: '4px 14px', borderRadius: 20,
                        fontWeight: 600, fontSize: 15,
                      }}>
                        {inv.quantity}
                      </span>
                      <div style={{ fontSize: 10, color: G.textTertiary, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {inv.location?.type === 'factory' ? 'Factory' : 'Shop'}
                      </div>
                    </div>
                    <button
                      onClick={() => openDeleteModal(inv)}
                      style={{
                        background: G.redLight,
                        color: G.red,
                        border: `1px solid ${G.redBorder}`,
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: font,
                        flexShrink: 0,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ACTIVITY TAB */}
        {tab === 'activity' && (
          <div>
            <div style={sectionLabelStyle}>Recent Unit Activity</div>
            {movements.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
                <p style={{ color: G.textSecondary, fontSize: 14 }}>No activity yet.</p>
              </div>
            ) : (
              movements.map(m => (
                <div key={m._id} style={{ ...cardStyle, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusDot(m.status), flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: G.textPrimary }}>
                          {statusLabel(m.status)} — {m.product?.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: G.textSecondary, paddingLeft: 16 }}>
                        {m.unitCode}
                        {m.currentLocation ? ` · ${m.currentLocation.name}` : ''}
                        {m.scannedBy ? ` · by ${m.scannedBy.name}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: G.textTertiary, flexShrink: 0, marginLeft: 12 }}>
                      {new Date(m.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={closeDeleteModal}
        >
          <div style={{
            background: G.surface, borderRadius: 16, padding: '28px 24px',
            width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: font,
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: G.textPrimary, marginBottom: 6 }}>
              Remove Stock
            </div>
            <div style={{ fontSize: 13, color: G.textSecondary, marginBottom: 16 }}>
              How many units of <strong>{deleteModal.inv?.product?.name}</strong> should be removed
              from <strong>{deleteModal.inv?.location?.name}</strong>? This cannot be undone.
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: G.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 14,
            }}>
              <span style={{ fontSize: 12, color: G.textSecondary }}>Currently in stock</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: G.textPrimary }}>
                {availableQty} unit{availableQty !== 1 ? 's' : ''}
              </span>
            </div>

            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.6px', color: G.textTertiary, marginBottom: 6,
            }}>
              Quantity to remove
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: qtyError ? 6 : 14 }}>
              <input
                type="text"
                inputMode="numeric"
                placeholder={`1 – ${availableQty}`}
                value={deleteModal.qty}
                autoFocus
                onChange={e => setDeleteModal(m => ({ ...m, qty: e.target.value, error: '' }))}
                onKeyDown={e => e.key === 'Enter' && handleDeleteConfirm()}
                style={{
                  flex: 1, minWidth: 0, boxSizing: 'border-box',
                  padding: '10px 12px', fontSize: 14,
                  border: `1px solid ${qtyError ? G.red : G.border}`,
                  borderRadius: 8, fontFamily: font, outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setDeleteModal(m => ({ ...m, qty: String(availableQty), error: '' }))}
                style={{
                  padding: '0 14px', border: `1px solid ${G.border}`, borderRadius: 8,
                  background: G.surface, color: G.textSecondary, fontSize: 12,
                  fontWeight: 500, cursor: 'pointer', fontFamily: font, flexShrink: 0,
                }}
              >
                All
              </button>
            </div>
            {qtyError && (
              <div style={{ fontSize: 12, color: G.red, marginBottom: 14 }}>
                {qtyError}
              </div>
            )}

            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.6px', color: G.textTertiary, marginBottom: 6,
            }}>
              Admin password
            </label>
            <input
              type="password"
              placeholder="Enter password"
              value={deleteModal.password}
              onChange={e => setDeleteModal(m => ({ ...m, password: e.target.value, error: '' }))}
              onKeyDown={e => e.key === 'Enter' && handleDeleteConfirm()}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', fontSize: 14,
                border: `1px solid ${deleteModal.error ? G.red : G.border}`,
                borderRadius: 8, fontFamily: font, outline: 'none',
                marginBottom: deleteModal.error ? 8 : 20,
              }}
            />

            {deleteModal.error && (
              <div style={{ fontSize: 12, color: G.red, marginBottom: 16 }}>
                {deleteModal.error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={closeDeleteModal} style={{
                flex: 1, padding: '10px', border: `1px solid ${G.border}`,
                borderRadius: 8, background: G.surface, color: G.textSecondary,
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: font,
              }}>
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteModal.deleting || !deleteModal.password || !!qtyError}
                style={{
                  flex: 1, padding: '10px',
                  border: 'none', borderRadius: 8,
                  background: confirmDisabled ? G.redLight : G.red,
                  color: confirmDisabled ? '#f87171' : '#fff',
                  fontSize: 13, fontWeight: 600, cursor: confirmDisabled ? 'default' : 'pointer',
                  fontFamily: font,
                }}
              >
                {deleteModal.deleting ? 'Removing…' : `Remove${qtyError ? '' : ` ${Number(deleteModal.qty)}`}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const cardStyle = {
  background: '#FFFFFF',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
  padding: '14px 16px',
  marginBottom: 10,
};

const selectStyle = {
  fontSize: 13,
  padding: '6px 10px',
  border: '0.5px solid rgba(0,0,0,0.15)',
  borderRadius: 8,
  background: '#FFFFFF',
  color: '#111110',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
};

const dateInputStyle = {
  fontSize: 12,
  padding: '6px 10px',
  border: '0.5px solid rgba(0,0,0,0.15)',
  borderRadius: 8,
  background: '#FFFFFF',
  color: '#111110',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
};

const dotStyle = {
  display: 'inline-block',
  width: 3,
  height: 3,
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.2)',
  flexShrink: 0,
};

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  color: '#9A9A96',
  marginBottom: 10,
};