import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL.replace('/api', '');

const G = {
  green: '#1B6B45',
  greenLight: '#E8F5EE',
  bg: '#F5F5F2',
  surface: '#FFFFFF',
  surfaceSecondary: '#EFEFEB',
  border: 'rgba(0,0,0,0.08)',
  borderMed: 'rgba(0,0,0,0.12)',
  borderDash: '#D4D4C8',
  textPrimary: '#111110',
  textSecondary: '#6B6B68',
  textTertiary: '#9A9A96',
  font: "'DM Sans', -apple-system, sans-serif",
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [qrImage, setQrImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/products').then(r => setProducts(r.data));
  }, []);

  const handleCreate = async (formData) => {
    setLoading(true);
    try {
      const res = await api.post('/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProducts(prev => [res.data.product, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating product');
    } finally {
      setLoading(false);
    }
  };

  const handleViewQR = async (product, e) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/products/qr/${product.sku}`);
      setQrImage({ dataUrl: res.data.qrDataUrl, product });
    } catch (err) {
      alert('Could not load QR');
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: G.font, background: G.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: G.textPrimary, letterSpacing: '-0.3px', margin: 0 }}>Products</h2>
        <button onClick={() => setShowAddModal(true)} style={btnPrimary}>
          + Add Product
        </button>
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: G.textSecondary }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>▣</div>
          <p style={{ fontSize: 14 }}>No products yet. Add your first product.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {products.map(p => (
            <ProductCard
              key={p._id}
              product={p}
              apiBase={API_BASE}
              onClick={() => navigate(`/products/${p._id}`)}
              onQR={(e) => handleViewQR(p, e)}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <ProductModal
          title="Add New Product"
          onSubmit={handleCreate}
          onClose={() => setShowAddModal(false)}
          loading={loading}
        />
      )}

      {qrImage && (
        <QRModal
          qrImage={qrImage.dataUrl}
          product={qrImage.product}
          onClose={() => setQrImage(null)}
        />
      )}
    </div>
  );
}

// ─── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product, apiBase, onClick, onQR }) {
  const imgSrc = product.photo
  ? product.photo.startsWith('http') ? product.photo : `${apiBase}${product.photo}`
  : null;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: `0.5px solid ${hovered ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{
        height: 180, background: G.surfaceSecondary,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
      }}>
        {imgSrc
          ? <img src={imgSrc} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ fontSize: 36, opacity: 0.2 }}>▣</div>
        }
      </div>

      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: G.textPrimary, margin: '0 0 3px' }}>
          {product.name}
        </p>
        <p style={{ fontSize: 12, color: G.textSecondary, margin: '0 0 12px' }}>
          {product.category || 'Uncategorised'} · {product.sku}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: G.green }}>
            ₹{Number(product.sellingPrice).toLocaleString('en-IN')}
          </span>
          {/* <button
            onClick={onQR}
            style={{
              padding: '4px 12px', background: G.greenLight, color: G.green,
              border: 'none', borderRadius: 20,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: G.font
            }}
          >
            QR
          </button> */}
        </div>
      </div>
    </div>
  );
}

// ─── Add Product Modal ─────────────────────────────────────────────────────────
function ProductModal({ title, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({ name: '', category: '', sellingPrice: '', description: '' });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) { setPhoto(file); setPreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('category', form.category);
    formData.append('sellingPrice', form.sellingPrice);
    formData.append('description', form.description);
    if (photo) formData.append('photo', photo);
    onSubmit(formData);
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ padding: '20px 24px', borderBottom: `0.5px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: G.textPrimary }}>{title}</span>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <label style={{
            display: 'flex', height: 150, background: G.surfaceSecondary,
            border: `1.5px dashed ${G.borderDash}`, borderRadius: 10,
            cursor: 'pointer', marginBottom: 20, overflow: 'hidden',
            alignItems: 'center', justifyContent: 'center'
          }}>
            {preview
              ? <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, opacity: 0.25, marginBottom: 8 }}>⬆</div>
                  <p style={{ color: G.textSecondary, fontSize: 13, margin: 0 }}>Upload product photo</p>
                </div>
            }
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </label>

          <input placeholder="Product name *" required value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            style={{ ...inputStyle, marginBottom: 12 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input placeholder="Category" value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              style={inputStyle} />
            <input placeholder="Selling price (₹) *" type="number" required value={form.sellingPrice}
              onChange={e => setForm(p => ({ ...p, sellingPrice: e.target.value }))}
              style={inputStyle} />
          </div>

          <textarea placeholder="Description / specs / notes" rows={3} value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            style={{ ...inputStyle, resize: 'vertical', marginBottom: 20 }} />

          <button type="submit" disabled={loading} style={{ ...btnPrimary, width: '100%', padding: '12px' }}>
            {loading ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── QR Modal ──────────────────────────────────────────────────────────────────
function QRModal({ qrImage, product, onClose }) {
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 320, padding: 32, textAlign: 'center' }}>
        <img src="/logo.png" alt="Logo" style={{ height: 40, marginBottom: 16 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: G.textPrimary, margin: '0 0 2px' }}>{product.name}</p>
        <p style={{ fontSize: 12, color: G.textSecondary, margin: '0 0 20px' }}>SKU: {product.sku}</p>
        <div style={{ background: G.surfaceSecondary, padding: 12, borderRadius: 10, display: 'inline-block', marginBottom: 16 }}>
          <img src={qrImage} alt="QR" style={{ width: 180, height: 180, display: 'block' }} />
        </div>
        <p style={{ color: G.textSecondary, fontSize: 12, marginBottom: 20 }}>Print and stick on the product box</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <a href={qrImage} download={`QR-${product.sku}.png`} style={{ ...btnPrimary, textDecoration: 'none', padding: '9px 18px', fontSize: 13 }}>
            ↓ Download
          </a>
          <button onClick={() => window.print()} style={{ ...btnSecondary, padding: '9px 18px', fontSize: 13 }}>
            Print
          </button>
          <button onClick={onClose} style={{ ...btnSecondary, padding: '9px 18px', fontSize: 13 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Styles ─────────────────────────────────────────────────────────────
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.35)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
};
const modalStyle = {
  background: '#FFFFFF', borderRadius: 14, width: '100%', maxWidth: 480,
  maxHeight: '90vh', overflow: 'auto',
  border: '0.5px solid rgba(0,0,0,0.08)',
  fontFamily: "'DM Sans', -apple-system, sans-serif",
};
const inputStyle = {
  width: '100%', padding: '10px 13px',
  background: '#F5F5F2', border: '0.5px solid rgba(0,0,0,0.12)',
  borderRadius: 8, color: '#111110',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  fontFamily: "'DM Sans', -apple-system, sans-serif",
};
const btnPrimary = {
  display: 'inline-block', padding: '8px 16px',
  background: '#1B6B45', color: '#fff',
  border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
  fontFamily: "'DM Sans', -apple-system, sans-serif",
};
const btnSecondary = {
  padding: '8px 16px', background: '#EFEFEB', color: '#6B6B68',
  border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
  fontFamily: "'DM Sans', -apple-system, sans-serif",
};
const closeBtn = {
  background: 'none', border: 'none', fontSize: 16,
  cursor: 'pointer', color: '#9A9A96', padding: 4,
};