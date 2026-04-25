import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QRScanner from '../components/QRScanner';
import api from '../utils/api';

export default function ScanPage() {
  const { user } = useAuth();
  const { sku: urlSku } = useParams();

  const [step, setStep] = useState('scan');
  const [product, setProduct] = useState(null);
  const [action, setAction] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [shopLocations, setShopLocations] = useState([]);
  const [toLocationId, setToLocationId] = useState('');
  const [pendingQty, setPendingQty] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isFactory = user?.location?.type === 'factory' || user?.role === 'admin';
  const isShop = user?.location?.type === 'shop';

  useEffect(() => {
    if (urlSku) fetchProduct(urlSku);
  }, [urlSku]);

  const fetchProduct = async (sku) => {
    try {
      const res = await api.get(`/products/sku/${sku}`);
      const p = res.data;
      setProduct(p);

      if (isFactory) {
        const locsRes = await api.get('/locations');
        setShopLocations(locsRes.data.filter(l => l.type === 'shop'));
      }

      if (isShop) {
        // Check if there's pending stock to receive
        const pendingRes = await api.get(`/movements/pending/${p._id}`);
        setPendingQty(pendingRes.data.totalPending);
      }

      setStep('action');
    } catch (err) {
      setError('Product not found. Try again.');
      setStep('scan');
    }
  };

  const handleScan = (sku) => fetchProduct(sku);

  const selectAction = (selectedAction) => {
    setAction(selectedAction);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (action === 'stock_in') {
        await api.post('/movements/stock-in', { productId: product._id, quantity });
        setMessage(`✅ ${quantity} units added to inventory`);

      } else if (action === 'dispatch') {
        await api.post('/movements/dispatch', { productId: product._id, quantity, toLocationId });
        const shop = shopLocations.find(l => l._id === toLocationId);
        setMessage(`✅ ${quantity} units dispatched to ${shop?.name}`);

      } else if (action === 'receive') {
        const res = await api.post('/movements/receive', { productId: product._id });
        setMessage(`✅ ${res.data.quantity} units received into shop inventory`);

      } else if (action === 'sell') {
        const res = await api.post('/movements/sell', {
          productId: product._id, quantity, paymentMethod: 'cash'
        });
        setMessage(`✅ Sold ${quantity}x ${product.name} · Remaining stock: ${res.data.remainingStock}`);
      }

      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
      setStep('action');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('scan');
    setProduct(null);
    setAction(null);
    setQuantity(1);
    setToLocationId('');
    setPendingQty(0);
    setMessage('');
    setError('');
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#1a4a2e', marginBottom: 4, fontFamily: 'Georgia, serif' }}>Scan Product</h2>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
        📍 {user?.location?.name} · {user?.role?.replace('_', ' ')}
      </p>

      {error && (
        <div style={{
          background: '#450a0a', color: '#fca5a5', padding: 12,
          borderRadius: 8, marginBottom: 16, fontSize: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          {error}
          <button onClick={() => setError('')} style={{
            background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 18
          }}>×</button>
        </div>
      )}

      {/* STEP 1 — Camera */}
      {step === 'scan' && (
        <div>
          <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>
            Point camera at the product QR sticker
          </p>
          <QRScanner onResult={handleScan} />
          <p style={{ color: '#475569', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            Make sure the QR code is well-lit
          </p>
        </div>
      )}

      {/* STEP 2 — Choose Action */}
      {step === 'action' && product && (
        <div>
          <div style={cardStyle}>
            <p style={{ color: '#666', fontSize: 12, margin: '0 0 4px' }}>SCANNED PRODUCT</p>
            <h3 style={{ color: '#1a1a1a', margin: '0 0 4px', fontSize: 20 }}>{product.name}</h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 4px' }}>
              SKU: {product.sku}
            </p>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
              Stock here: <strong style={{ color: '#22c55e' }}>{product.stockAtMyLocation}</strong>
              {pendingQty > 0 && (
                <span style={{ color: '#f59e0b', marginLeft: 8 }}>
                  · {pendingQty} units pending receipt
                </span>
              )}
            </p>
          </div>

          <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>What do you want to do?</p>

          {isFactory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => selectAction('stock_in')} style={actionBtn('#1a4a2e')}>
                📥 Add to Inventory
              </button>
              <button onClick={() => selectAction('dispatch')} style={actionBtn('#c17f3a')}>
                🚚 Dispatch to Shop
              </button>
            </div>
          )}

          {isShop && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingQty > 0 && (
                <button onClick={() => selectAction('receive')} style={actionBtn('#1a4a2e')}>
                  📦 Receive Stock ({pendingQty} units incoming)
                </button>
              )}
              {product.stockAtMyLocation > 0 && (
                <button onClick={() => selectAction('sell')} style={actionBtn('#c17f3a')}>
                  💰 Sell (stock: {product.stockAtMyLocation})
                </button>
              )}
            </div>
          )}

          <button onClick={reset} style={{
            marginTop: 16, color: '#475569', background: 'none',
            border: 'none', cursor: 'pointer', fontSize: 14
          }}>
            ← Scan again
          </button>
        </div>
      )}

      {/* STEP 3 — Confirm */}
      {step === 'confirm' && product && (
        <div>
          <div style={cardStyle}>
            <p style={{ color: '#666', fontSize: 12, margin: '0 0 4px' }}>
              {action === 'stock_in' ? '📥 ADDING TO INVENTORY' :
               action === 'dispatch' ? '🚚 DISPATCHING TO SHOP' :
               action === 'receive' ? '📦 RECEIVING STOCK' : '💰 SELLING'}
            </p>
            <h3 style={{ color: '#1a1a1a', margin: '0 0 4px' }}>{product.name}</h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>SKU: {product.sku}</p>
          </div>

          {/* Receive shows auto quantity — no manual input needed */}
          {action === 'receive' && (
            <div style={{
              background: '#1a2e1a', border: '1px solid #22c55e',
              borderRadius: 8, padding: 16, marginBottom: 16
            }}>
              <p style={{ color: '#22c55e', margin: 0, fontSize: 15 }}>
                📦 <strong>{pendingQty} units</strong> will be added to your shop inventory
              </p>
              <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0' }}>
                Quantity is set automatically based on what was dispatched
              </p>
            </div>
          )}

          {/* Stock in and sell need manual quantity */}
          {(action === 'stock_in' || action === 'sell') && (
            <>
              <label style={{ color: '#666', fontSize: 13, display: 'block', marginBottom: 6 }}>
                Quantity
              </label>
              <input
                type="number" min="1"
                max={action === 'sell' ? product.stockAtMyLocation : undefined}
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                style={{ ...inputStyle, marginBottom: 16 }}
              />
              {action === 'sell' && (
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16, marginTop: -10 }}>
                  Max available: {product.stockAtMyLocation}
                </p>
              )}
            </>
          )}

          {/* Dispatch needs quantity + shop selection */}
          {action === 'dispatch' && (
            <>
              <label style={{ color: '#666', fontSize: 13, display: 'block', marginBottom: 6 }}>
                Quantity
              </label>
              <input
                type="number" min="1" value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                style={{ ...inputStyle, marginBottom: 16 }}
              />
              <label style={{ color: '#666', fontSize: 13, display: 'block', marginBottom: 6 }}>
                Select Shop
              </label>
              <select
                value={toLocationId}
                onChange={e => setToLocationId(e.target.value)}
                style={{ ...inputStyle, marginBottom: 16 }}
              >
                <option value="">-- Select outlet --</option>
                {shopLocations.map(l => (
                  <option key={l._id} value={l._id}>{l.name}</option>
                ))}
              </select>
            </>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading || (action === 'dispatch' && !toLocationId)}
            style={{
              ...actionBtn('#22c55e'),
              opacity: (loading || (action === 'dispatch' && !toLocationId)) ? 0.6 : 1
            }}
          >
            {loading ? 'Processing...' : 'Confirm ✓'}
          </button>

          <button onClick={() => setStep('action')} style={{
            marginTop: 10, color: '#475569', background: 'none',
            border: 'none', cursor: 'pointer', fontSize: 14, display: 'block'
          }}>
            ← Go back
          </button>
        </div>
      )}

      {/* STEP 4 — Done */}
      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <p style={{ color: '#22c55e', fontSize: 18, fontWeight: 600, marginBottom: 24 }}>
            {message}
          </p>
          <button onClick={reset} style={actionBtn('#22c55e')}>
            Scan Another Product
          </button>
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: '#ffffff', border: '1px solid #e8e8e0',
  borderRadius: 4, padding: '16px', marginBottom: 20,
  boxShadow: '0 1px 4px rgba(26,74,46,0.06)'
};
const actionBtn = (color) => ({
  width: '100%', padding: '14px', background: color, color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700,
  cursor: 'pointer', letterSpacing: 1.5, fontFamily: 'Georgia, serif'
});
const inputStyle = {
  width: '100%', padding: '12px 14px', background: '#fafaf7',
  border: '1px solid #d4d4c8', borderRadius: 4, color: '#1a1a1a',
  fontSize: 15, outline: 'none', boxSizing: 'border-box'
};