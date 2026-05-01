import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL.replace('/api', '');

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [newPhoto, setNewPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cacheBust, setCacheBust] = useState('');
  const [showGenerateQR, setShowGenerateQR] = useState(false);
const [genQty, setGenQty] = useState(1);
const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    api.get(`/products/id/${id}`)
      .then(r => {
        setProduct(r.data);
        setForm({
          name: r.data.name,
          category: r.data.category || '',
          sellingPrice: r.data.sellingPrice,
          description: r.data.description || ''
        });
      })
      .catch(() => {
        api.get('/products').then(r => {
          const found = r.data.find(p => p._id === id);
          if (found) {
            setProduct(found);
            setForm({
              name: found.name,
              category: found.category || '',
              sellingPrice: found.sellingPrice,
              description: found.description || ''
            });
          }
        });
      });
  }, [id]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) { setNewPhoto(file); setPreview(URL.createObjectURL(file)); }
  };

  const handleGenerateQR = async () => {
  setGenLoading(true);
  try {
    const res = await api.post('/units/generate',
      { productId: id, quantity: genQty },
      { responseType: 'blob' }
    );
    // Auto download the ZIP
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR-${product.sku}-${genQty}units.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
    setShowGenerateQR(false);
  } catch (err) {
    alert('Error generating QR codes');
  } finally {
    setGenLoading(false);
  }
};

  const handleSave = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('category', form.category);
      formData.append('sellingPrice', form.sellingPrice);
      formData.append('description', form.description);
      if (newPhoto) formData.append('photo', newPhoto);

      const res = await api.put(`/products/${id}`, formData);
      setCacheBust('?t=' + Date.now());
      setProduct(res.data);
      setForm({
        name: res.data.name,
        category: res.data.category || '',
        sellingPrice: res.data.sellingPrice,
        description: res.data.description || ''
      });
      setEditing(false);
      setNewPhoto(null);
      setPreview(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Error saving');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"? This cannot be undone.`)) return;
    try {
        await api.delete(`/products/${id}`);
        navigate('/products');
    } catch (err) {
        alert('Error deleting product');
    }
    };

  const handleViewQR = async () => {
    try {
      const res = await api.get(`/products/qr/${product.sku}`);
      setQrImage(res.data.qrDataUrl);
    } catch (err) {
      alert('Could not load QR');
    }
  };

  const getImageSrc = () => {
    if (preview) return preview;
    if (product?.photo) return `${API_BASE}${product.photo}${cacheBust}`;
    return null;
  };

  if (!product) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#888', fontFamily: 'Georgia, serif' }}>
      Loading...
    </div>
  );

  const imgSrc = getImageSrc();

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 40px', fontFamily: 'Georgia, serif' }}>

      {/* Back */}
      <button onClick={() => navigate('/products')} style={{
        background: 'none', border: 'none', color: '#888', cursor: 'pointer',
        fontSize: 13, padding: '16px 0', display: 'flex', alignItems: 'center', gap: 6
      }}>
        ← Back to Products
      </button>

      {/* Main horizontal layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>

        {/* LEFT — Image */}
        <div>
          <div style={{
            width: '100%', aspectRatio: '1/1', background: '#f5f5f0',
            borderRadius: 4, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #e8e8e0', position: 'relative'
          }}>
            {imgSrc ? (
              <img key={imgSrc} src={imgSrc} alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 80 }}>📦</span>
            )}
          </div>

          {/* Change photo — only in edit mode */}
          {editing && (
            <label style={{
              display: 'block', marginTop: 10, textAlign: 'center',
              background: '#f5f5f0', border: '1px dashed #d4d4c8',
              borderRadius: 4, padding: '10px', cursor: 'pointer',
              color: '#1a4a2e', fontSize: 11, fontWeight: 700, letterSpacing: 1
            }}>
              📷 CHANGE PHOTO
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
          )}

          {/* QR Code preview below image */}
           <button onClick={() => setShowGenerateQR(true)} style={{
              display: 'block', width: '100%', marginTop: 10,
            padding: '10px', background: '#fff', color: '#1a4a2e',
            border: '1.5px solid #1a4a2e', borderRadius: 4,
            fontSize: 11, fontWeight: 700, letterSpacing: 1.5, cursor: 'pointer'
            }}>
              GENERATE UNIT QR CODES
            </button>
        </div>

        {/* RIGHT — Details */}
        <div>
          {/* SKU + Category tag */}
          <p style={{ color: '#c17f3a', fontSize: 11, letterSpacing: 2, margin: '0 0 8px' }}>
            {product.sku}{product.category ? ` · ${product.category}` : ''}
          </p>

          {/* Product name */}
          {editing ? (
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={{ ...inputStyle, fontSize: 22, fontWeight: 700, marginBottom: 16 }} />
          ) : (
            <h2 style={{ color: '#1a4a2e', margin: '0 0 16px', fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
              {product.name}
            </h2>
          )}

          <div style={{ width: 32, height: 2, background: '#c17f3a', marginBottom: 24 }} />

          {/* Price */}
          <div style={{ marginBottom: 20 }}>
            <p style={labelStyle}>SELLING PRICE</p>
            {editing ? (
              <input type="number" value={form.sellingPrice}
                onChange={e => setForm(p => ({ ...p, sellingPrice: e.target.value }))}
                style={inputStyle} />
            ) : (
              <p style={{ color: '#1a4a2e', fontSize: 28, fontWeight: 700, margin: 0 }}>
                ₹{Number(product.sellingPrice).toLocaleString('en-IN')}
              </p>
            )}
          </div>

          {/* Category */}
          <div style={{ marginBottom: 20 }}>
            <p style={labelStyle}>CATEGORY</p>
            {editing ? (
              <input value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={inputStyle} />
            ) : (
              <p style={{ color: '#444', fontSize: 14, margin: 0 }}>{product.category || '—'}</p>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: 24 }}>
            <p style={labelStyle}>DESCRIPTION</p>
            {editing ? (
              <textarea value={form.description} rows={4}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Product description, specs, notes..." />
            ) : (
              <p style={{ color: '#444', fontSize: 14, margin: 0, lineHeight: 1.8 }}>
                {product.description || '—'}
              </p>
            )}
          </div>

          <div style={{ width: '100%', height: 1, background: '#e8e8e0', marginBottom: 20 }} />

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div>
              <p style={labelStyle}>CREATED</p>
              <p style={{ color: '#888', fontSize: 12, margin: 0 }}>
                {new Date(product.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            </div>
            <div>
              <p style={labelStyle}>LAST UPDATED</p>
              <p style={{ color: '#888', fontSize: 12, margin: 0 }}>
                {new Date(product.updatedAt).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          {!editing ? (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <button onClick={() => setEditing(true)} style={{
      width: '100%', padding: '13px',
      background: '#1a4a2e', color: '#fff',
      border: 'none', borderRadius: 4,
      fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: 'pointer'
    }}>
      EDIT PRODUCT
    </button>
   
    <button onClick={handleDelete} style={{
      width: '100%', padding: '13px',
      background: '#fff', color: '#991b1b',
      border: '1.5px solid #fecaca', borderRadius: 4,
      fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: 'pointer'
    }}>
      DELETE PRODUCT
    </button>
  </div>
) : (
  <div style={{ display: 'flex', gap: 8 }}>
    <button onClick={handleSave} disabled={loading} style={{
      flex: 1, padding: '13px', background: '#1a4a2e', color: '#fff',
      border: 'none', borderRadius: 4, fontSize: 11,
      fontWeight: 700, letterSpacing: 1, cursor: 'pointer'
    }}>
      {loading ? 'SAVING...' : 'SAVE CHANGES'}
    </button>
    <button onClick={() => {
      setEditing(false);
      setPreview(null);
      setNewPhoto(null);
    }} style={{
      flex: 1, padding: '13px', background: '#f5f5f0', color: '#666',
      border: '1px solid #e8e8e0', borderRadius: 4,
      fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: 'pointer'
    }}>
      CANCEL
    </button>
  </div>
)}
        </div>
      </div>

      {/* QR Modal */}
      {qrImage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(26,74,46,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 4, padding: 40,
            textAlign: 'center', maxWidth: 300, width: '90%',
            border: '1px solid #e8e8e0', boxShadow: '0 8px 40px rgba(26,74,46,0.2)'
          }}>
            <img src="/logo.png" alt="RDE" style={{ height: 48, marginBottom: 16 }} />
            <h3 style={{ color: '#1a4a2e', margin: '0 0 2px' }}>{product.name}</h3>
            <p style={{ color: '#c17f3a', fontSize: 11, letterSpacing: 1, margin: '0 0 20px' }}>
              SKU: {product.sku}
            </p>
            <div style={{ width: 32, height: 2, background: '#c17f3a', margin: '0 auto 20px' }} />
            <div style={{
              background: '#fff', padding: 12, border: '1px solid #e8e8e0',
              display: 'inline-block', marginBottom: 16
            }}>
              <img src={qrImage} style={{ width: 180, height: 180, display: 'block' }} />
            </div>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 20 }}>
              Print and stick on product box
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <a href={qrImage} download={`QR-${product.sku}.png`} style={{
                padding: '9px 16px', background: '#1a4a2e', color: '#fff',
                borderRadius: 4, textDecoration: 'none', fontSize: 11, fontWeight: 700
              }}>⬇ DOWNLOAD</a>
              <button onClick={() => setQrImage(null)} style={{
                padding: '9px 16px', background: '#f5f5f0', color: '#666',
                border: '1px solid #e8e8e0', borderRadius: 4, fontSize: 11, cursor: 'pointer'
              }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
      {showGenerateQR && (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(26,74,46,0.4)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000
  }}>
    <div style={{
      background: '#fff', borderRadius: 4, padding: 40,
      maxWidth: 360, width: '90%', border: '1px solid #e8e8e0'
    }}>
      <h3 style={{ color: '#1a4a2e', margin: '0 0 4px' }}>Generate Unit QR Codes</h3>
      <p style={{ color: '#888', fontSize: 13, margin: '0 0 24px' }}>
        {product.name}
      </p>
      <label style={{ color: '#888', fontSize: 10, letterSpacing: 1.5, display: 'block', marginBottom: 8, fontWeight: 700 }}>
        HOW MANY UNITS?
      </label>
      <input
        type="number" min="1" max="500" value={genQty}
        onChange={e => setGenQty(Number(e.target.value))}
        style={{ ...inputStyle, marginBottom: 20 }}
      />
      <p style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
        A ZIP file with {genQty} unique QR code images will be downloaded. Print and stick one on each unit.
      </p>
      <button onClick={handleGenerateQR} disabled={genLoading} style={{
        width: '100%', padding: '13px', background: '#1a4a2e', color: '#fff',
        border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700,
        letterSpacing: 2, cursor: 'pointer', marginBottom: 8
      }}>
        {genLoading ? 'GENERATING...' : `GENERATE & DOWNLOAD ${genQty} QR CODES`}
      </button>
      <button onClick={() => setShowGenerateQR(false)} style={{
        width: '100%', padding: '13px', background: '#f5f5f0', color: '#666',
        border: '1px solid #e8e8e0', borderRadius: 4, fontSize: 11, cursor: 'pointer'
      }}>
        CANCEL
      </button>
    </div>
  </div>
)}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', background: '#fafaf7',
  border: '1px solid #d4d4c8', borderRadius: 4, color: '#1a1a1a',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif'
};
const labelStyle = {
  color: '#888', fontSize: 10, letterSpacing: 1.5, margin: '0 0 8px', fontWeight: 700
};