import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await import('../utils/api').then(m =>
        m.default.post('/auth/login', { phone, password })
      );
      localStorage.setItem('token', res.data.token);
      const role = res.data.user.role;
      await login(phone, password);
      if (role === 'admin') navigate('/dashboard');
      else navigate('/scan');
    } catch (err) {
      setError('Invalid phone or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background image with low opacity */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/farm-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.95,
        zIndex: 0
      }} />

      {/* Soft overlay to keep it warm and muted */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(245,245,240,0.7) 0%, rgba(26,74,46,0.15) 100%)',
        zIndex: 1
      }} />

      {/* Login card */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        background: 'rgba(255,255,255,0.92)',
        padding: '48px 40px',
        borderRadius: 4,
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 8px 40px rgba(26,74,46,0.18)',
        border: '1px solid rgba(232,232,224,0.8)',
        backdropFilter: 'blur(8px)'
      }}>

        {/* Logo + brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="RDE Logo" style={{ height: 90, marginBottom: 16 }} />
          <h1 style={{
            color: '#1a4a2e', margin: '0 0 4px',
            fontSize: 20, fontWeight: 700, letterSpacing: 1
          }}>
            RELIABLE DAIRY EQUIPMENTS
          </h1>
          <p style={{ color: '#c17f3a', margin: 0, fontSize: 12, letterSpacing: 2 }}>
            INVENTORY SYSTEM
          </p>
        </div>

        <div style={{ width: 40, height: 2, background: '#c17f3a', margin: '0 auto 32px' }} />

        {error && (
          <div style={{
            background: '#fef2f2', color: '#991b1b', padding: '10px 14px',
            borderRadius: 4, marginBottom: 20, fontSize: 13,
            border: '1px solid #fecaca'
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{
            color: '#555', fontSize: 13, display: 'block',
            marginBottom: 6, fontWeight: 400
          }}>
            Phone Number
          </label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="9876543210" required style={inputStyle}
          />

          <label style={{
            color: '#555', fontSize: 13, display: 'block',
            margin: '20px 0 6px', fontWeight: 400
          }}>
            Password
          </label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required style={inputStyle}
          />

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', background: '#fafaf7',
  border: '1px solid #d4d4c8', borderRadius: 4, color: '#1a1a1a',
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'Georgia, serif'
};

const btnStyle = {
  width: '100%', marginTop: 28, padding: '14px',
  background: '#1a4a2e', color: '#fff', border: 'none',
  borderRadius: 4, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', letterSpacing: 0.5, fontFamily: 'Georgia, serif'
};