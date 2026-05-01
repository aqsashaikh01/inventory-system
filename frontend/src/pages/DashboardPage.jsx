import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const [daily, setDaily] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [tab, setTab] = useState('sales');
  const [loading, setLoading] = useState(true);

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
    generated:  '🏷 Generated',
    in_factory: '🏭 In Factory',
    dispatched: '🚚 Dispatched',
    in_shop:    '🏪 In Shop',
    sold:       '💰 Sold'
  }[status] || status);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#888', fontFamily: 'Georgia, serif' }}>
      Loading...
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 20, fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#1a4a2e', marginBottom: 4, fontSize: 22 }}>Dashboard</h2>
      <div style={{ width: 32, height: 2, background: '#c17f3a', marginBottom: 8 }} />
      <p style={{ color: '#888', fontSize: 13, marginBottom: 28 }}>{new Date().toDateString()}</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {['sales', 'inventory', 'activity'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 4,
            border: tab === t ? '1px solid #1a4a2e' : '1px solid #e8e8e0',
            cursor: 'pointer',
            background: tab === t ? '#1a4a2e' : '#ffffff',
            color: tab === t ? '#fff' : '#888',
            fontWeight: 700, fontSize: 11, letterSpacing: 1.5,
            fontFamily: 'Georgia, serif'
          }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* SALES TAB */}
      {tab === 'sales' && daily && (
        <div>
          <p style={{ color: '#888', fontSize: 11, letterSpacing: 1.5, fontWeight: 700, marginBottom: 16 }}>
            TODAY'S SALES BY OUTLET
          </p>
          {Object.keys(daily.byLocation).length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#888' }}>No sales recorded today yet.</p>
            </div>
          ) : (
            Object.entries(daily.byLocation).map(([loc, data]) => (
              <div key={loc} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h4 style={{ color: '#1a4a2e', margin: 0, fontSize: 16 }}>{loc}</h4>
                    <p style={{ color: '#888', fontSize: 12, margin: '2px 0 0' }}>{data.totalUnits} unit{data.totalUnits !== 1 ? 's' : ''} sold</p>
                  </div>
                  <span style={{ color: '#1a4a2e', fontWeight: 700, fontSize: 20 }}>
                    ₹{data.totalRevenue.toLocaleString('en-IN')}
                  </span>
                </div>
                {data.sales.map(s => (
                  <div key={s._id} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '10px 0', borderTop: '1px solid #e8e8e0',
                    alignItems: 'center'
                  }}>
                    <div>
                      <p style={{ color: '#1a1a1a', fontSize: 14, margin: 0, fontWeight: 600 }}>
                        {s.product?.name}
                      </p>
                      <p style={{ color: '#888', fontSize: 11, margin: '2px 0 0' }}>
                        {s.unitCode}
                        {s.clientName ? ` · ${s.clientName}` : ''}
                        {s.paymentMethod ? ` · ${s.paymentMethod.toUpperCase()}` : ''}
                      </p>
                    </div>
                    <span style={{ color: '#1a4a2e', fontWeight: 700, fontSize: 14 }}>
                      ₹{s.product?.sellingPrice?.toLocaleString('en-IN')}
                    </span>
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
          <p style={{ color: '#888', fontSize: 11, letterSpacing: 1.5, fontWeight: 700, marginBottom: 16 }}>
            CURRENT STOCK — ALL LOCATIONS
          </p>
          {inventory.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#888' }}>No stock currently in system.</p>
            </div>
          ) : (
            inventory.map((inv, i) => (
              <div key={i} style={{
                ...cardStyle,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <p style={{ color: '#1a4a2e', margin: '0 0 3px', fontWeight: 700, fontSize: 15 }}>
                    {inv.product?.name}
                  </p>
                  <p style={{ color: '#888', fontSize: 11, margin: 0, letterSpacing: 0.5 }}>
                    {inv.location?.name} · SKU: {inv.product?.sku}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    background: inv.quantity < 3 ? '#fef2f2' : '#f0fdf4',
                    color: inv.quantity < 3 ? '#991b1b' : '#166534',
                    padding: '4px 14px', borderRadius: 20,
                    fontWeight: 700, fontSize: 16,
                    border: `1px solid ${inv.quantity < 3 ? '#fecaca' : '#bbf7d0'}`
                  }}>
                    {inv.quantity}
                  </span>
                  <p style={{ color: '#888', fontSize: 10, margin: '4px 0 0', letterSpacing: 0.5 }}>
                    {inv.location?.type === 'factory' ? 'FACTORY' : 'SHOP'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ACTIVITY TAB */}
      {tab === 'activity' && (
        <div>
          <p style={{ color: '#888', fontSize: 11, letterSpacing: 1.5, fontWeight: 700, marginBottom: 16 }}>
            RECENT UNIT ACTIVITY
          </p>
          {movements.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#888' }}>No activity yet.</p>
            </div>
          ) : (
            movements.map(m => (
              <div key={m._id} style={{ ...cardStyle, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ color: '#1a1a1a', margin: '0 0 3px', fontSize: 14, fontWeight: 600 }}>
                      {statusLabel(m.status)} — {m.product?.name}
                    </p>
                    <p style={{ color: '#888', fontSize: 11, margin: 0 }}>
                      {m.unitCode}
                      {m.currentLocation ? ` · ${m.currentLocation.name}` : ''}
                      {m.scannedBy ? ` · by ${m.scannedBy.name}` : ''}
                    </p>
                  </div>
                  <p style={{ color: '#aaa', fontSize: 11, margin: 0, flexShrink: 0, marginLeft: 12 }}>
                    {new Date(m.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: '#ffffff', border: '1px solid #e8e8e0',
  borderRadius: 4, padding: '16px 20px', marginBottom: 12,
  boxShadow: '0 1px 4px rgba(26,74,46,0.04)'
};