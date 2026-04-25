import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL.replace('/api', '');

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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px', fontFamily: 'Georgia, serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h2 style={{ color: '#1a4a2e', margin: '0 0 4px', fontSize: 22 }}>Products</h2>
          <div style={{ width: 32, height: 2, background: '#c17f3a' }} />
        </div>
        <button onClick={() => setShowAddModal(true)} style={{
          padding: '7px 14px', background: '#1a4a2e', color: '#fff',
          border: 'none', borderRadius: 4, fontSize: 10,
          fontWeight: 700, letterSpacing: 1.5, cursor: 'pointer',
          fontFamily: 'Georgia, serif'
        }}>
          + ADD
        </button>
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
          <p style={{ fontSize: 48, margin: '0 0 12px' }}>📦</p>
          <p>No products yet. Add your first product.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16
        }}>
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

      {/* Add Product Modal */}
      {showAddModal && (
        <ProductModal
          title="ADD NEW PRODUCT"
          onSubmit={handleCreate}
          onClose={() => setShowAddModal(false)}
          loading={loading}
        />
      )}

      {/* QR Modal */}
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

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, apiBase, onClick, onQR }) {
  const imgSrc = product.photo ? `${apiBase}${product.photo}` : null;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #e8e8e0', borderRadius: 4,
        overflow: 'hidden', cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(26,74,46,0.05)',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,74,46,0.12)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(26,74,46,0.05)'}
    >
      {/* Product Image */}
      <div style={{
        height: 180, background: '#f5f5f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden'
      }}>
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 48 }}>📦</span>
        )}
      </div>

      {/* Product Info */}
      <div style={{ padding: '14px 16px' }}>
        <p style={{ color: '#1a4a2e', fontWeight: 700, margin: '0 0 4px', fontSize: 14 }}>
          {product.name}
        </p>
        <p style={{ color: '#888', fontSize: 11, margin: '0 0 10px', letterSpacing: 0.5 }}>
          {product.category || 'Uncategorised'} · {product.sku}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#1a4a2e', fontWeight: 700, fontSize: 15 }}>
            ₹{Number(product.sellingPrice).toLocaleString('en-IN')}
          </span>
          <button
            onClick={onQR}
            style={{
              padding: '4px 12px', background: '#fff', color: '#1a4a2e',
              border: '1.5px solid #1a4a2e', borderRadius: 4,
              fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer'
            }}
          >
            QR
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Detail Modal ──────────────────────────────────────────────────────
function ProductDetailModal({ product, apiBase, onUpdate, onQR, onClose, loading }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: product.name,
    category: product.category || '',
    sellingPrice: product.sellingPrice,
    description: product.description || ''
  });
  const [newPhoto, setNewPhoto] = useState(null);
  const [preview, setPreview] = useState(null);

  const imgSrc = preview || (product.photo ? `${apiBase}${product.photo}` : null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewPhoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('category', form.category);
    formData.append('sellingPrice', form.sellingPrice);
    formData.append('description', form.description);
    if (newPhoto) formData.append('photo', newPhoto);
    onUpdate(formData);
    setEditing(false);
  };

  return (
    <div style={overlayStyle}>
      <div style={{
        background: '#fff', borderRadius: 4, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflow: 'auto',
        border: '1px solid #e8e8e0', boxShadow: '0 8px 40px rgba(26,74,46,0.15)'
      }}>
        {/* Product Image */}
        <div style={{
          height: 260, background: '#f5f5f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden'
        }}>
          {imgSrc ? (
            <img src={imgSrc} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: 80 }}>📦</span>
          )}

          {/* Close button */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,255,255,0.9)', border: 'none',
            borderRadius: '50%', width: 32, height: 32,
            cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#1a4a2e'
          }}>×</button>

          {/* Change photo button when editing */}
          {editing && (
            <label style={{
              position: 'absolute', bottom: 12, right: 12,
              background: '#1a4a2e', color: '#fff', padding: '6px 14px',
              borderRadius: 4, fontSize: 11, fontWeight: 700,
              letterSpacing: 1, cursor: 'pointer'
            }}>
              CHANGE PHOTO
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <p style={{ color: '#c17f3a', fontSize: 10, letterSpacing: 2, margin: '0 0 4px' }}>
                {product.sku} · {product.category}
              </p>
              {editing ? (
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  style={{ ...inputStyle, fontSize: 18, fontWeight: 700, marginBottom: 0 }}
                />
              ) : (
                <h3 style={{ color: '#1a4a2e', margin: 0, fontSize: 20 }}>{product.name}</h3>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onQR} style={{
                padding: '6px 14px', background: '#fff', color: '#1a4a2e',
                border: '1.5px solid #1a4a2e', borderRadius: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer'
              }}>QR</button>
              {!editing && (
                <button onClick={() => setEditing(true)} style={{
                  padding: '6px 14px', background: '#1a4a2e', color: '#fff',
                  border: 'none', borderRadius: 4,
                  fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer'
                }}>EDIT</button>
              )}
            </div>
          </div>

          <div style={{ width: '100%', height: 1, background: '#e8e8e0', marginBottom: 20 }} />

          {/* Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <p style={labelStyle}>CATEGORY</p>
              {editing ? (
                <input value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  style={inputStyle} />
              ) : (
                <p style={valueStyle}>{product.category || '—'}</p>
              )}
            </div>
            <div>
              <p style={labelStyle}>SELLING PRICE</p>
              {editing ? (
                <input type="number" value={form.sellingPrice}
                  onChange={e => setForm(p => ({ ...p, sellingPrice: e.target.value }))}
                  style={inputStyle} />
              ) : (
                <p style={{ ...valueStyle, color: '#1a4a2e', fontWeight: 700, fontSize: 18 }}>
                  ₹{Number(product.sellingPrice).toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <p style={labelStyle}>DESCRIPTION</p>
            {editing ? (
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Product description, specs, notes..."
              />
            ) : (
              <p style={{ ...valueStyle, lineHeight: 1.6 }}>
                {product.description || '—'}
              </p>
            )}
          </div>

          {editing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} disabled={loading} style={{ ...btnPrimary, flex: 1 }}>
                {loading ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
              <button onClick={() => { setEditing(false); setPreview(null); setNewPhoto(null); }} style={{
                flex: 1, padding: '12px', background: '#f5f5f0', color: '#666',
                border: '1px solid #e8e8e0', borderRadius: 4,
                fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: 'pointer'
              }}>
                CANCEL
              </button>
            </div>
          )}
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
      <div style={{
        background: '#fff', borderRadius: 4, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflow: 'auto',
        border: '1px solid #e8e8e0', boxShadow: '0 8px 40px rgba(26,74,46,0.15)'
      }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e8e8e0', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: '#1a4a2e', fontWeight: 700, letterSpacing: 1.5, fontSize: 12, margin: 0 }}>{title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 28 }}>
          {/* Photo Upload */}
          <label style={{
            display: 'block', height: 160, background: '#f5f5f0',
            border: '2px dashed #d4d4c8', borderRadius: 4,
            cursor: 'pointer', marginBottom: 20, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {preview ? (
              <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>📷</p>
                <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Click to upload product photo</p>
              </div>
            )}
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

          <button type="submit" disabled={loading} style={btnPrimary}>
            {loading ? 'CREATING...' : 'CREATE & GENERATE QR'}
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
      <div style={{
        background: '#fff', borderRadius: 4, padding: 40,
        textAlign: 'center', maxWidth: 320, width: '90%',
        border: '1px solid #e8e8e0', boxShadow: '0 8px 40px rgba(26,74,46,0.2)'
      }}>
        <img src="/logo.png" alt="RDE" style={{ height: 48, marginBottom: 16 }} />
        <h3 style={{ color: '#1a4a2e', margin: '0 0 2px', fontSize: 16 }}>{product.name}</h3>
        <p style={{ color: '#c17f3a', fontSize: 11, letterSpacing: 1, margin: '0 0 20px' }}>SKU: {product.sku}</p>
        <div style={{ width: 32, height: 2, background: '#c17f3a', margin: '0 auto 20px' }} />
        <div style={{ background: '#fff', padding: 12, borderRadius: 4, display: 'inline-block', marginBottom: 16, border: '1px solid #e8e8e0' }}>
          <img src={qrImage} alt="QR" style={{ width: 180, height: 180, display: 'block' }} />
        </div>
        <p style={{ color: '#888', fontSize: 11, marginBottom: 24 }}>Print and stick on the product box</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <a href={qrImage} download={`QR-${product.sku}.png`} style={{
            padding: '10px 18px', background: '#1a4a2e', color: '#fff',
            borderRadius: 4, textDecoration: 'none', fontSize: 11, fontWeight: 700, letterSpacing: 1
          }}>⬇ DOWNLOAD</a>
          <button onClick={() => window.print()} style={{
            padding: '10px 18px', background: '#c17f3a', color: '#fff',
            border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: 'pointer'
          }}>🖨 PRINT</button>
          <button onClick={onClose} style={{
            padding: '10px 18px', background: '#f5f5f0', color: '#666',
            border: '1px solid #e8e8e0', borderRadius: 4, fontSize: 11, cursor: 'pointer'
          }}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Styles ─────────────────────────────────────────────────────────────
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(26,74,46,0.4)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
};
const inputStyle = {
  width: '100%', padding: '11px 14px', background: '#fafaf7',
  border: '1px solid #d4d4c8', borderRadius: 4, color: '#1a1a1a',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif'
};
const btnPrimary = {
  width: '100%', padding: '13px', background: '#1a4a2e', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700,
  cursor: 'pointer', letterSpacing: 2, fontFamily: 'Georgia, serif'
};
const labelStyle = {
  color: '#888', fontSize: 10, letterSpacing: 1.5, margin: '0 0 6px', fontWeight: 700
};
const valueStyle = {
  color: '#1a1a1a', fontSize: 14, margin: 0
};