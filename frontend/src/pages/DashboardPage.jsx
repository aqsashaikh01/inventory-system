import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const [daily, setDaily] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [tab, setTab] = useState('sales');

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/dashboard/daily').then(r => setDaily(r.data));
      api.get('/dashboard/inventory').then(r => setInventory(r.data));
      api.get('/dashboard/movements').then(r => setMovements(r.data));
    }
  }, [user]);

  const movementLabel = (type) => ({
    stock_in: '📥 Stock In',
    dispatch: '🚚 Dispatched',
    receive: '📦 Received',
    sold: '💰 Sold'
  }[type] || type);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#f1f5f9', marginBottom: 4 }}>Dashboard</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
        {new Date().toDateString()}
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['sales', 'inventory', 'activity'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 4,
            border: tab === t ? '1px solid #1a4a2e' : '1px solid #e8e8e0',
            cursor: 'pointer',
            background: tab === t ? '#1a4a2e' : '#ffffff',
            color: tab === t ? '#fff' : '#888',
            fontWeight: 700, fontSize: 11, letterSpacing: 1.5
          }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Daily Sales */}
      {tab === 'sales' && daily && (
        <div>
          <h3 style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>TODAY'S SALES BY OUTLET</h3>
          {Object.entries(daily.byLocation).map(([loc, data]) => (
            <div key={loc} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ color: '#f1f5f9', margin: 0 }}>{loc}</h4>
                <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 18 }}>
                  ₹{data.totalRevenue}
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 12px' }}>
                {data.totalUnits} units sold
              </p>
              {data.sales.map(s => (
                <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #1e293b' }}>
                  <span style={{ color: '#cbd5e1', fontSize: 14 }}>{s.product.name}</span>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>×{s.quantity} — ₹{s.quantity * s.sellingPrice}</span>
                </div>
              ))}
            </div>
          ))}
          {Object.keys(daily.byLocation).length === 0 && (
            <p style={{ color: '#475569' }}>No sales recorded today yet.</p>
          )}
        </div>
      )}

      {/* Inventory */}
      {tab === 'inventory' && (
        <div>
          <h3 style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>CURRENT STOCK — ALL LOCATIONS</h3>
          {inventory.map(inv => (
            <div key={inv._id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: '#f1f5f9', margin: '0 0 2px', fontWeight: 600 }}>{inv.product.name}</p>
                <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
                  {inv.location.name} · SKU: {inv.product.sku}
                </p>
              </div>
              <span style={{
                background: inv.quantity < 5 ? '#450a0a' : '#052e16',
                color: inv.quantity < 5 ? '#fca5a5' : '#22c55e',
                padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 16
              }}>
                {inv.quantity}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Activity Log */}
      {tab === 'activity' && (
        <div>
          <h3 style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>RECENT SCAN ACTIVITY</h3>
          {movements.map(m => (
            <div key={m._id} style={{ ...cardStyle, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: '#f1f5f9', margin: '0 0 2px', fontSize: 15 }}>
                    {movementLabel(m.type)} — {m.product?.name}
                  </p>
                  <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
                    {m.fromLocation?.name ? `${m.fromLocation.name} → ` : ''}
                    {m.toLocation?.name || (m.type === 'sold' ? 'Customer' : '')}
                    {' · '}by {m.scannedBy?.name}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>×{m.quantity}</span>
                  <p style={{ color: '#475569', fontSize: 11, margin: '2px 0 0' }}>
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: '#ffffff', border: '1px solid #e8e8e0',
  borderRadius: 4, padding: '16px', marginBottom: 12,
  boxShadow: '0 1px 4px rgba(26,74,46,0.06)'
};