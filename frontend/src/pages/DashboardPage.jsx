import { useEffect, useState } from 'react';
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

export default function DashboardPage() {
  const { user } = useAuth();
  const [daily, setDaily] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [tab, setTab] = useState('sales');
  const [loading, setLoading] = useState(true);

  // Sales filters
  const [dateFilter, setDateFilter] = useState('today');
  const [outletFilter, setOutletFilter] = useState('all');

  useEffect(() => {
    if (user?.role === 'admin') {
      Promise.all([
        api.get('/dashboard/daily'),
        api.get('/dashboard/inventory'),
        api.get('/dashboard/movements')
      ]).then(([d, inv, mov]) => {
        setDaily(d.data);
        setInventory(inv.data);
        setMovements(mov.data);
      }).finally(() => setLoading(false));
    }
  }, [user]);

  const statusLabel = (status) => ({
    generated:  'Generated',
    in_factory: 'In Factory',
    dispatched: 'Dispatched',
    in_shop:    'In Shop',
    sold:       'Sold'
  }[status] || status);

  const statusDot = (status) => ({
    generated:  '#9A9A96',
    in_factory: '#B45309',
    dispatched: '#1D4ED8',
    in_shop:    '#7C3AED',
    sold:       G.green,
  }[status] || '#9A9A96');

  const dateLabel = { today: "Today's", week: "This Week's", month: "This Month's" };

  const filteredLocations = daily
    ? Object.entries(daily.byLocation).filter(([loc]) =>
        outletFilter === 'all' || loc === outletFilter
      )
    : [];

  const summaryTotal = filteredLocations.reduce((sum, [, d]) => sum + d.totalRevenue, 0);
  const summaryUnits = filteredLocations.reduce((sum, [, d]) => sum + d.totalUnits, 0);
  const summaryAvg = summaryUnits ? Math.round(summaryTotal / summaryUnits) : 0;

  const outletOptions = daily ? Object.keys(daily.byLocation) : [];

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
        {tab === 'sales' && daily && (
          <div>
            {/* Summary Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Sales', value: `₹${summaryTotal.toLocaleString('en-IN')}`, sub: dateLabel[dateFilter] },
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

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: G.textSecondary }}>Filter by</span>
              <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={selectStyle}>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <select value={outletFilter} onChange={e => setOutletFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Outlets</option>
                {outletOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Section Label */}
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: G.textTertiary, marginBottom: 10 }}>
              {dateLabel[dateFilter]} Sales by Outlet
            </div>

            {/* Outlet Cards */}
            {filteredLocations.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
                <p style={{ color: G.textSecondary, fontSize: 14 }}>No sales recorded yet.</p>
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