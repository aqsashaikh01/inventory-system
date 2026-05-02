import { useEffect, useState } from 'react';
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
};

const font = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [editWorker, setEditWorker] = useState(null);
  const [tab, setTab] = useState('workers');
  const [loading, setLoading] = useState(false);

  const [workerForm, setWorkerForm] = useState({
    name: '', phone: '', password: '', role: 'shop_worker', locationId: ''
  });
  const [outletForm, setOutletForm] = useState({
    name: '', type: 'shop', address: ''
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = () => {
    api.get('/workers').then(r => setWorkers(r.data));
    api.get('/locations').then(r => setLocations(r.data));
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/workers', workerForm);
      setWorkers(prev => [res.data, ...prev]);
      setShowAddWorker(false);
      setWorkerForm({ name: '', phone: '', password: '', role: 'shop_worker', locationId: '' });
    } catch (err) {
  const msg = err.response?.data?.error 
    || err.response?.data?.message 
    || JSON.stringify(err.response?.data) 
    || 'Error adding worker';
  alert(msg);
} finally {
      setLoading(false);
    }
  };

  const handleAddOutlet = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/locations', outletForm);
      setLocations(prev => [...prev, res.data]);
      setShowAddOutlet(false);
      setOutletForm({ name: '', type: 'shop', address: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Error adding outlet');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWorker = async (id, data) => {
    try {
      const res = await api.put(`/workers/${id}`, data);
      setWorkers(prev => prev.map(w => w._id === id ? res.data : w));
      setEditWorker(null);
    } catch (err) {
      alert('Error updating worker');
    }
  };

  const handleDeleteWorker = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await api.delete(`/workers/${id}`);
      setWorkers(prev => prev.filter(w => w._id !== id));
    } catch (err) {
      alert('Error deleting worker');
    }
  };

  const handleDeleteOutlet = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await api.delete(`/locations/${id}`);
      setLocations(prev => prev.filter(l => l._id !== id));
    } catch (err) {
      alert('Error deleting outlet');
    }
  };

  return (
    <div style={{ fontFamily: font, background: G.bg, minHeight: '100vh', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: G.textPrimary, letterSpacing: '-0.3px', margin: 0 }}>
            Workers & Outlets
          </h2>
          <button
            onClick={() => tab === 'workers' ? setShowAddWorker(true) : setShowAddOutlet(true)}
            style={btnPrimary}>
            + Add {tab === 'workers' ? 'Worker' : 'Outlet'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: '1.5rem', borderBottom: `1px solid ${G.border}` }}>
          {['workers', 'outlets'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', border: 'none',
              borderBottom: tab === t ? `2px solid ${G.green}` : '2px solid transparent',
              marginBottom: -1, background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: font,
              color: tab === t ? G.green : G.textSecondary,
              textTransform: 'capitalize',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* WORKERS TAB */}
        {tab === 'workers' && (
          <div>
            <div style={sectionLabelStyle}>All Workers ({workers.length})</div>
            {workers.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
                <p style={{ color: G.textSecondary, fontSize: 14 }}>No workers yet.</p>
              </div>
            ) : workers.map(w => (
              <div key={w._id} style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: 8 }}>
                {editWorker?._id === w._id ? (
                  <div style={{ padding: '14px 16px' }}>
                    <input value={editWorker.name}
                      onChange={e => setEditWorker(p => ({ ...p, name: e.target.value }))}
                      style={{ ...inputStyle, marginBottom: 8 }} placeholder="Name" />
                    <select value={editWorker.locationId}
                      onChange={e => setEditWorker(p => ({ ...p, locationId: e.target.value }))}
                      style={{ ...inputStyle, marginBottom: 12 }}>
                      <option value="">-- Select location --</option>
                      {locations.map(l => (
                        <option key={l._id} value={l._id}>{l.name} ({l.type})</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleUpdateWorker(w._id, {
                        name: editWorker.name, locationId: editWorker.locationId
                      })} style={btnPrimary}>Save</button>
                      <button onClick={() => setEditWorker(null)} style={btnOutline}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: G.textPrimary, marginBottom: 3 }}>
                        {w.name}
                        {!w.isActive && (
                          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: G.redLight, color: G.red }}>
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: G.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>📱 {w.phone}</span>
                        <span style={dotStyle} />
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: G.greenLight, color: G.green }}>
                          {w.role?.replace('_', ' ').toUpperCase()}
                        </span>
                        <span style={dotStyle} />
                        <span>{w.location?.name || '—'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditWorker({
                        _id: w._id, name: w.name, locationId: w.location?._id
                      })} style={btnOutline}>Edit</button>
                      <button onClick={() => handleDeleteWorker(w._id, w.name)} style={{
                        ...btnOutline, color: G.red, borderColor: G.redBorder
                      }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* OUTLETS TAB */}
        {tab === 'outlets' && (
          <div>
            <div style={sectionLabelStyle}>All Outlets ({locations.length})</div>
            {locations.map(l => (
              <div key={l._id} style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: G.textPrimary, marginBottom: 3 }}>
                      {l.name}
                    </div>
                    <div style={{ fontSize: 12, color: G.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: l.type === 'factory' ? '#FEF3C7' : G.greenLight, color: l.type === 'factory' ? '#92400E' : G.green }}>
                        {l.type === 'factory' ? '🏭 FACTORY' : '🏪 SHOP'}
                      </span>
                      {l.address && <><span style={dotStyle} /><span>{l.address}</span></>}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteOutlet(l._id, l.name)} style={{
                    ...btnOutline, color: G.red, borderColor: G.redBorder
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADD WORKER MODAL */}
        {showAddWorker && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ color: G.textPrimary, margin: 0, fontSize: 16, fontWeight: 600 }}>Add New Worker</h3>
                <button onClick={() => setShowAddWorker(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: G.textSecondary }}>×</button>
              </div>
              <form onSubmit={handleAddWorker}>
                {[
                  { label: 'FULL NAME', key: 'name', type: 'text', placeholder: 'e.g. Rahul Patil' },
                  { label: 'PHONE NUMBER', key: 'phone', type: 'tel', placeholder: 'e.g. 9876543210' },
                  { label: 'PASSWORD', key: 'password', type: 'password', placeholder: 'Set a password' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>{f.label}</label>
                    <input required type={f.type} placeholder={f.placeholder}
                      value={workerForm[f.key]}
                      onChange={e => setWorkerForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={inputStyle} />
                  </div>
                ))}

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>ROLE</label>
                  <select value={workerForm.role}
                    onChange={e => setWorkerForm(p => ({ ...p, role: e.target.value }))}
                    style={inputStyle}>
                    <option value="shop_worker">Shop Worker</option>
                    <option value="factory_worker">Factory Worker</option>
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>ASSIGN TO OUTLET</label>
                  <select required value={workerForm.locationId}
                    onChange={e => setWorkerForm(p => ({ ...p, locationId: e.target.value }))}
                    style={inputStyle}>
                    <option value="">-- Select location --</option>
                    {locations.map(l => (
                      <option key={l._id} value={l._id}>{l.name} ({l.type})</option>
                    ))}
                  </select>
                </div>

                <button type="submit" disabled={loading} style={{ ...btnPrimary, width: '100%', padding: '11px', fontSize: 13 }}>
                  {loading ? 'Adding...' : 'Add Worker'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ADD OUTLET MODAL */}
        {showAddOutlet && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ color: G.textPrimary, margin: 0, fontSize: 16, fontWeight: 600 }}>Add New Outlet</h3>
                <button onClick={() => setShowAddOutlet(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: G.textSecondary }}>×</button>
              </div>
              <form onSubmit={handleAddOutlet}>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>OUTLET NAME</label>
                  <input required value={outletForm.name}
                    onChange={e => setOutletForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Outlet 3 - Mumbai" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>TYPE</label>
                  <select value={outletForm.type}
                    onChange={e => setOutletForm(p => ({ ...p, type: e.target.value }))}
                    style={inputStyle}>
                    <option value="shop">Shop</option>
                    <option value="factory">Factory</option>
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>ADDRESS</label>
                  <input value={outletForm.address}
                    onChange={e => setOutletForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="Full address" style={inputStyle} />
                </div>
                <button type="submit" disabled={loading} style={{ ...btnPrimary, width: '100%', padding: '11px', fontSize: 13 }}>
                  {loading ? 'Adding...' : 'Add Outlet'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: '#FFFFFF', border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12, padding: '14px 16px', marginBottom: 8,
};
const inputStyle = {
  width: '100%', padding: '9px 12px', background: '#FAFAF8',
  border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8,
  color: '#111110', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: font,
};
const labelStyle = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.6px', color: '#9A9A96', display: 'block', marginBottom: 6,
};
const btnPrimary = {
  padding: '8px 14px', background: G.green, color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13,
  fontWeight: 500, cursor: 'pointer', fontFamily: font,
};
const btnOutline = {
  padding: '7px 14px', background: '#fff', color: G.green,
  border: `1px solid ${G.green}`, borderRadius: 8, fontSize: 12,
  fontWeight: 500, cursor: 'pointer', fontFamily: font,
};
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.3)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
};
const modalStyle = {
  background: '#fff', borderRadius: 16, padding: 28,
  maxWidth: 420, width: '100%', maxHeight: '90vh',
  overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};
const dotStyle = {
  display: 'inline-block', width: 3, height: 3, borderRadius: '50%',
  background: 'rgba(0,0,0,0.2)', flexShrink: 0,
};
const sectionLabelStyle = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.7px', color: '#9A9A96', marginBottom: 10,
};