import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL.replace('/api', '');

const G = {
  green: '#1B6B45',
  greenDark: '#1a4a2e',
  greenLight: '#E8F5EE',
  greenMid: '#166534',
  orange: '#c17f3a',
  orangeLight: '#FEF3E2',
  orangeBorder: '#F6D09E',
  bg: '#F5F5F2',
  surface: '#FFFFFF',
  surfaceSecondary: '#EFEFEB',
  border: 'rgba(0,0,0,0.08)',
  borderSoft: 'rgba(0,0,0,0.05)',
  borderMed: 'rgba(0,0,0,0.12)',
  textPrimary: '#111110',
  textSecondary: '#6B6B68',
  textTertiary: '#9A9A96',
  red: '#991B1B',
  redLight: '#FEF2F2',
  redBorder: '#FECACA',
};

const font = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

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
          description: r.data.description || '',
          marathiName: r.data.marathiName || '',    
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
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const printWin = window.open(url, '_blank');
      if (printWin) {
        printWin.addEventListener('load', () => printWin.print());
      }
      // Keep URL alive long enough for the window to load it
      setTimeout(() => window.URL.revokeObjectURL(url), 120000);
      setShowGenerateQR(false);
    } catch (err) {
      alert('Error generating stickers');
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
      formData.append('marathiName', form.marathiName);
      if (newPhoto) formData.append('photo', newPhoto);

      const res = await api.put(`/products/${id}`, formData);
      setCacheBust('?t=' + Date.now());
      setProduct(res.data);
      setForm({
        name: res.data.name,
        category: res.data.category || '',
        sellingPrice: res.data.sellingPrice,
        description: res.data.description || '',
        marathiName: res.data.marathiName || '',
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
  if (product?.photo) {
    const p = product.photo;
    return p.startsWith('http') ? p : `${API_BASE}${p}${cacheBust}`;
  }
  return null;
};

  if (!product) return (
    <div style={{ textAlign: 'center', padding: 60, color: G.textSecondary, fontFamily: font, fontSize: 14 }}>
      Loading...
    </div>
  );

  const imgSrc = getImageSrc();

  return (
    <div style={{ fontFamily: font, background: G.bg, minHeight: '100vh', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Back nav */}
        <button onClick={() => navigate('/products')} style={{
          background: 'none', border: 'none', color: G.textSecondary,
          cursor: 'pointer', fontSize: 13, padding: '0 0 1.5rem',
          display: 'flex', alignItems: 'center', gap: 6, fontFamily: font,
          fontWeight: 500,
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> Back to Products
        </button>

        {/* Main card */}
        <div style={{
          background: G.surface,
          border: `0.5px solid ${G.border}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}>

          {/* Top header bar */}
          <div style={{
            padding: '16px 24px',
            borderBottom: `0.5px solid ${G.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: G.surfaceSecondary,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.7px',
                textTransform: 'uppercase', color: G.orange,
                background: G.orangeLight, border: `1px solid ${G.orangeBorder}`,
                padding: '3px 10px', borderRadius: 20,
              }}>
                {product.sku}
              </span>
              {product.category && (
                <span style={{
                  fontSize: 11, fontWeight: 500, color: G.textSecondary,
                  background: G.surfaceSecondary, border: `0.5px solid ${G.border}`,
                  padding: '3px 10px', borderRadius: 20,
                }}>
                  {product.category}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: G.textTertiary }}>
              Updated {new Date(product.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* Body: image + details */}
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 0 }}>

            {/* LEFT — Image panel */}
            <div style={{
              borderRight: `0.5px solid ${G.border}`,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>

              {/* Image box */}
              <div style={{
                width: '100%', aspectRatio: '1/1',
                background: G.bg, borderRadius: 12,
                border: `0.5px solid ${G.border}`,
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {imgSrc ? (
                  <img key={imgSrc} src={imgSrc} alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: 64 }}>📦</span>
                )}
              </div>

              {/* Change photo in edit mode */}
              {editing && (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px', cursor: 'pointer', borderRadius: 10,
                  border: `1px dashed ${G.border}`, background: G.bg,
                  color: G.green, fontSize: 12, fontWeight: 600,
                  letterSpacing: '0.4px',
                }}>
                  <span>📷</span> Change Photo
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </label>
              )}

              {/* Generate QR button */}
              <button onClick={() => setShowGenerateQR(true)} style={{
                width: '100%', padding: '11px',
                background: G.greenLight, color: G.green,
                border: `1px solid rgba(27,107,69,0.2)`,
                borderRadius: 10, fontSize: 12, fontWeight: 600,
                letterSpacing: '0.3px', cursor: 'pointer', fontFamily: font,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <span>▊</span> Generate Unit Barcodes
              </button>

              {/* Meta dates at bottom */}
              <div style={{
                marginTop: 'auto',
                paddingTop: 12,
                borderTop: `0.5px solid ${G.borderSoft}`,
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              }}>
                <div>
                  <div style={metaLabelStyle}>Created</div>
                  <div style={metaValueStyle}>
                    {new Date(product.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div>
                  <div style={metaLabelStyle}>Last Updated</div>
                  <div style={metaValueStyle}>
                    {new Date(product.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — Details panel */}
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column' }}>

              {/* Product name */}
              {editing ? (
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  style={{ ...inputStyle, fontSize: 22, fontWeight: 600, marginBottom: 20 }}
                />
              ) : (
                <h2 style={{
                  color: G.textPrimary, margin: '0 0 20px',
                  fontSize: 24, fontWeight: 700, lineHeight: 1.25,
                  letterSpacing: '-0.4px',
                }}>
                  {product.name}
                </h2>
              )}

              <div style={{ marginBottom: 20 }}>
                <div style={fieldLabel}>Marathi Name</div>
                {editing ? (
                  <input
                    value={form.marathiName}
                    onChange={e => setForm(p => ({ ...p, marathiName: e.target.value }))}
                    placeholder="उत्पादनाचे नाव"
                    style={inputStyle}
                  />
                ) : (
                  <div style={{ fontSize: 16, fontWeight: 500, color: G.textPrimary }}>
                    {product.marathiName || <span style={{ color: G.textTertiary }}>—</span>}
                  </div>
                )}
              </div>

              {/* Price + Category row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ ...fieldBox }}>
                  <div style={fieldLabel}>Selling Price</div>
                  {editing ? (
                    <input
                      type="number"
                      value={form.sellingPrice}
                      onChange={e => setForm(p => ({ ...p, sellingPrice: e.target.value }))}
                      style={inputStyle}
                    />
                  ) : (
                    <div style={{ fontSize: 24, fontWeight: 700, color: G.green, letterSpacing: '-0.5px' }}>
                      ₹{Number(product.sellingPrice).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
                <div style={{ ...fieldBox }}>
                  <div style={fieldLabel}>Category</div>
                  {editing ? (
                    <input
                      value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      style={inputStyle}
                    />
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 500, color: G.textPrimary }}>
                      {product.category || <span style={{ color: G.textTertiary }}>—</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 24 }}>
                <div style={fieldLabel}>Description</div>
                {editing ? (
                  <textarea
                    value={form.description}
                    rows={5}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder="Product description, specs, notes..."
                  />
                ) : (
                  <div style={{
                    fontSize: 14, color: product.description ? G.textSecondary : G.textTertiary,
                    lineHeight: 1.7,
                  }}>
                    {product.description || 'No description added.'}
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }} />

              {/* Divider */}
              <div style={{ height: '0.5px', background: G.border, marginBottom: 20 }} />

              {/* Action buttons */}
              {!editing ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditing(true)} style={{
                    flex: 1, padding: '12px',
                    background: G.green, color: '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: font,
                    letterSpacing: '0.1px',
                  }}>
                    Edit Product
                  </button>
                  <button onClick={handleDelete} style={{
                    flex: 1, padding: '12px',
                    background: G.redLight, color: G.red,
                    border: `1px solid ${G.redBorder}`, borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: font,
                  }}>
                    Delete Product
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSave} disabled={loading} style={{
                    flex: 1, padding: '12px',
                    background: G.green, color: '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: font,
                    opacity: loading ? 0.7 : 1,
                  }}>
                    {loading ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button onClick={() => {
                    setEditing(false);
                    setPreview(null);
                    setNewPhoto(null);
                  }} style={{
                    flex: 1, padding: '12px',
                    background: G.surfaceSecondary, color: G.textSecondary,
                    border: `0.5px solid ${G.border}`, borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: font,
                  }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR Image Modal */}
      {qrImage && (
        <Modal onClose={() => setQrImage(null)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.7px', color: G.textTertiary, marginBottom: 4,
            }}>QR Code</div>
            <h3 style={{ color: G.textPrimary, margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>
              {product.name}
            </h3>
            <span style={{
              fontSize: 11, fontWeight: 600, color: G.orange,
              background: G.orangeLight, border: `1px solid ${G.orangeBorder}`,
              padding: '2px 10px', borderRadius: 20, display: 'inline-block', marginBottom: 20,
            }}>
              {product.sku}
            </span>
            <div style={{
              background: G.bg, border: `0.5px solid ${G.border}`,
              borderRadius: 12, padding: 16, display: 'inline-block', marginBottom: 16,
            }}>
              <img src={qrImage} style={{ width: 180, height: 180, display: 'block' }} />
            </div>
            <p style={{ color: G.textTertiary, fontSize: 12, marginBottom: 20 }}>
              Print and stick on product box
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={qrImage} download={`QR-${product.sku}.png`} style={{
                flex: 1, padding: '11px', background: G.green, color: '#fff',
                borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600,
                textAlign: 'center', fontFamily: font,
              }}>
                ⬇ Download
              </a>
              <button onClick={() => setQrImage(null)} style={{
                flex: 1, padding: '11px', background: G.surfaceSecondary,
                color: G.textSecondary, border: `0.5px solid ${G.border}`,
                borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: font, fontWeight: 600,
              }}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Generate QR Modal */}
      {showGenerateQR && (
        <Modal onClose={() => setShowGenerateQR(false)}>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.7px', color: G.textTertiary, marginBottom: 4,
          }}>Generate Barcodes</div>
          <h3 style={{ color: G.textPrimary, margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>
            {product.name}
          </h3>
          <span style={{
            fontSize: 11, fontWeight: 600, color: G.orange,
            background: G.orangeLight, border: `1px solid ${G.orangeBorder}`,
            padding: '2px 10px', borderRadius: 20, display: 'inline-block', marginBottom: 20,
          }}>
            {product.sku}
          </span>

          <div style={{ marginBottom: 16 }}>
            <div style={fieldLabel}>Number of Units</div>
            <input
              type="number" min="1" max="500" value={genQty}
              onChange={e => setGenQty(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <p style={{ color: G.textSecondary, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            <strong>{genQty}</strong> sticker{genQty !== 1 ? 's' : ''} will open as a PDF. A print dialog will appear — select your <strong>Dcode 421 Pro</strong> and print.
          </p>

          <button onClick={handleGenerateQR} disabled={genLoading} style={{
            width: '100%', padding: '12px',
            background: G.green, color: '#fff',
            border: 'none', borderRadius: 10,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: font, marginBottom: 8,
            opacity: genLoading ? 0.7 : 1,
          }}>
            {genLoading ? 'Generating…' : `Generate & Print ${genQty} Sticker${genQty !== 1 ? 's' : ''}`}
          </button>
          <button onClick={() => setShowGenerateQR(false)} style={{
            width: '100%', padding: '12px',
            background: G.surfaceSecondary, color: G.textSecondary,
            border: `0.5px solid ${G.border}`, borderRadius: 10,
            fontSize: 13, cursor: 'pointer', fontFamily: font, fontWeight: 600,
          }}>
            Cancel
          </button>
        </Modal>
      )}
    </div>
  );
}

/* ── Shared Modal wrapper ── */
function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.3)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 16, padding: 28,
          maxWidth: 380, width: '100%',
          border: '0.5px solid rgba(0,0,0,0.08)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          fontFamily: "'DM Sans', -apple-system, sans-serif",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Shared styles ── */
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: '#F5F5F2',
  border: '0.5px solid rgba(0,0,0,0.12)',
  borderRadius: 8,
  color: '#111110',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'DM Sans', -apple-system, sans-serif",
};

const fieldLabel = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  color: '#9A9A96',
  marginBottom: 8,
};

const fieldBox = {
  background: '#F5F5F2',
  borderRadius: 10,
  padding: '14px 16px',
};

const metaLabelStyle = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: '#9A9A96',
  marginBottom: 4,
};

const metaValueStyle = {
  fontSize: 12,
  color: '#6B6B68',
  fontWeight: 500,
};