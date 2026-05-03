import { useEffect, useState } from 'react';
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

export default function WorkerProductsPage() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/products').then(r => setProducts(r.data));
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: G.font, background: G.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: G.textPrimary, letterSpacing: '-0.3px', margin: 0 }}>Products</h2>
        <input
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '8px 14px', background: G.surface,
            border: `0.5px solid ${G.borderMed}`, borderRadius: 8,
            fontSize: 13, outline: 'none', fontFamily: G.font,
            color: G.textPrimary, width: 200
          }}
        />
      </div>

      {/* Product Grid — same as admin */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: G.textSecondary }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>▣</div>
          <p style={{ fontSize: 14 }}>No products found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map(p => (
            <ProductCard
              key={p._id}
              product={p}
              onClick={() => setSelected(p)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <ProductDetailModal
          product={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ─── Product Card — identical to admin ────────────────────────────────────────
function ProductCard({ product, onClick }) {
  const imgSrc = product.photo
    ? product.photo.startsWith('http') ? product.photo : `${API_BASE}${product.photo}`
    : null;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: G.surface,
        border: `0.5px solid ${hovered ? 'rgba(0,0,0,0.16)' : G.border}`,
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
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
        <span style={{ fontSize: 15, fontWeight: 600, color: G.green }}>
          ₹{Number(product.sellingPrice).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  );
}

// ─── Product Detail Modal — same as admin but no edit/delete ──────────────────
function ProductDetailModal({ product, onClose }) {
  const imgSrc = product.photo
    ? product.photo.startsWith('http') ? product.photo : `${API_BASE}${product.photo}`
    : null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.35)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16
    }}>
      <div style={{
        background: G.surface, borderRadius: 14,
        width: '100%', maxWidth: 800,
        maxHeight: '90vh', overflow: 'auto',
        border: `0.5px solid ${G.border}`,
        fontFamily: G.font,
      }}>
        {/* Horizontal layout — image left, details right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

          {/* LEFT — Image */}
          <div style={{
            background: G.surfaceSecondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 340, position: 'relative', overflow: 'hidden',
            borderRadius: '14px 0 0 14px'
          }}>
            {imgSrc
              ? <img src={imgSrc} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 24, boxSizing: 'border-box' }} />
              : <div style={{ fontSize: 60, opacity: 0.15 }}>▣</div>
            }
          </div>

          {/* RIGHT — Details */}
          <div style={{ padding: 32 }}>
            {/* Close button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={onClose} style={{
                background: G.surfaceSecondary, border: 'none',
                borderRadius: '50%', width: 32, height: 32,
                cursor: 'pointer', fontSize: 14, color: G.textSecondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
            </div>

            {/* SKU + Category */}
            <p style={{ color: G.textTertiary, fontSize: 11, letterSpacing: 1.5, margin: '0 0 6px', textTransform: 'uppercase' }}>
              {product.sku}{product.category ? ` · ${product.category}` : ''}
            </p>

            {/* Name */}
            <h3 style={{ color: G.textPrimary, fontSize: 22, fontWeight: 600, margin: '0 0 20px', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              {product.name}
            </h3>

            <div style={{ width: '100%', height: 1, background: G.border, marginBottom: 20 }} />

            {/* Price */}
            <div style={{ marginBottom: 20 }}>
              <p style={labelStyle}>SELLING PRICE</p>
              <p style={{ color: G.green, fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
                ₹{Number(product.sellingPrice).toLocaleString('en-IN')}
              </p>
            </div>

            {/* Category */}
            <div style={{ marginBottom: 20 }}>
              <p style={labelStyle}>CATEGORY</p>
              <p style={{ color: G.textPrimary, fontSize: 14, margin: 0 }}>{product.category || '—'}</p>
            </div>

            {/* Description */}
            {product.description && (
              <div style={{ marginBottom: 20 }}>
                <p style={labelStyle}>DESCRIPTION</p>
                <p style={{ color: G.textSecondary, fontSize: 14, margin: 0, lineHeight: 1.7 }}>
                  {product.description}
                </p>
              </div>
            )}

            <div style={{ width: '100%', height: 1, background: G.border, marginBottom: 20 }} />

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={labelStyle}>ADDED</p>
                <p style={{ color: G.textSecondary, fontSize: 12, margin: 0 }}>
                  {new Date(product.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p style={labelStyle}>SKU</p>
                <p style={{ color: G.textSecondary, fontSize: 12, margin: 0 }}>{product.sku}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  color: '#9A9A96', fontSize: 10, letterSpacing: 1.5,
  margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase'
};