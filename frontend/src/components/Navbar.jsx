import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const loc = useLocation();

  const navItem = (to, label) => (
    <Link to={to} style={{
      color: loc.pathname === to ? '#1a4a2e' : '#2a2a2a',
      textDecoration: 'none', fontSize: 13, fontWeight: 500,
      letterSpacing: 1.7, borderBottom: loc.pathname === to ? '2px solid #c17f3a' : '2px solid transparent',
      paddingBottom: 4
    }}>{label}</Link>
  );

  return (
    <nav style={{
      background: '#ffffff', borderBottom: '1px solid #e8e8e0',
      padding: '0 24px', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', height: 64, position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 1px 8px rgba(26,74,46,0.06)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="RDE" style={{ height: 40 }} />
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#1a4a2e', letterSpacing: 1 }}>
            RELIABLE DAIRY EQUIPMENTS
          </p>
          <p style={{ margin: 0, fontSize: 10, color: '#c17f3a', letterSpacing: 1 }}>
            PUNE
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        {navItem('/scan', 'SCAN')}
        {user?.role !== 'admin' && navItem('/catalogue', 'PRODUCTS')}
        {user?.role === 'admin' && navItem('/dashboard', 'DASHBOARD')}
        {user?.role === 'admin' && navItem('/products', 'PRODUCTS')}
        {user?.role === 'admin' && navItem('/workers', 'WORKERS')}
        <div style={{ width: 1, height: 20, background: '#e8e8e0' }} />
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#1a4a2e', fontWeight: 600 }}>{user?.name}</p>
          <p style={{ margin: 0, fontSize: 10, color: '#c17f3a', letterSpacing: 0.5 }}>{user?.location?.name}</p>
        </div>
        <button onClick={logout} style={{
          background: 'none', border: '1px solid #1a4a2e', color: '#1a4a2e',
          padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
          fontSize: 10, fontWeight: 700, letterSpacing: 1
        }}>LOGOUT</button>
      </div>
    </nav>
  );
}