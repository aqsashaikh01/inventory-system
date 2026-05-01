import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QRScanner from '../components/QRScanner';
import api from '../utils/api';

export default function ScanPage() {
  const { user } = useAuth();
  const { sku: urlCode } = useParams();

  const [step, setStep] = useState('scan');
  const [unitData, setUnitData] = useState(null);
  const [action, setAction] = useState(null);
  const [shopLocations, setShopLocations] = useState([]);
  const [toLocationId, setToLocationId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);

  // Sell form fields
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  useEffect(() => {
    if (urlCode) handleScan(urlCode);
  }, [urlCode]);

  const handleScan = async (code) => {
    setError('');
    try {
      const unitCode = code.includes('/unit/') ? code.split('/unit/')[1] : code;
      const res = await api.get(`/units/scan/${unitCode}`);
      const { unit, availableAction } = res.data;
      setUnitData({ unit, availableAction });

      if (!availableAction) {
        setError(getStatusMessage(unit.status));
        setStep('scan');
        return;
      }

      if (availableAction === 'stock_in') {
        await api.post(`/units/stock-in/${unit.unitCode}`);
        setMessage(`✅ ${unit.unitCode} added to factory inventory`);
        setStep('done');
        return;
      }

      if (availableAction === 'dispatch') {
        const locsRes = await api.get('/locations');
        setShopLocations(locsRes.data.filter(l => l.type === 'shop'));
      }

      setAction(availableAction);
      setStep('action');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid QR code');
      setStep('scan');
    }
  };

  const getStatusMessage = (status) => {
    const messages = {
      in_factory: '⚠️ Already in factory inventory',
      dispatched: '⚠️ Already dispatched to a shop',
      in_shop: '⚠️ Already in shop inventory',
      sold: '❌ This unit has already been sold',
      generated: '⚠️ Not yet processed'
    };
    return messages[status] || '❌ Cannot process this unit';
  };

  const handleConfirm = async () => {
    setLoading(true);
    const unitCode = unitData.unit.unitCode;
    try {
      if (action === 'dispatch') {
        await api.post(`/units/dispatch/${unitCode}`, { toLocationId });
        const shop = shopLocations.find(l => l._id === toLocationId);
        setMessage(`✅ ${unitCode} dispatched to ${shop?.name}`);
        setStep('done');
      } else if (action === 'receive') {
        await api.post(`/units/receive/${unitCode}`);
        setMessage(`✅ ${unitCode} received into shop inventory`);
        setStep('done');
      } else if (action === 'sell') {
        const res = await api.post(`/units/sell/${unitCode}`, {
          clientName, clientPhone, paymentMethod
        });
        setInvoice(res.data.invoice);
        setStep('invoice');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
      setStep('action');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('scan');
    setUnitData(null);
    setAction(null);
    setToLocationId('');
    setMessage('');
    setError('');
    setLoading(false);
    setInvoice(null);
    setClientName('');
    setClientPhone('');
    setPaymentMethod('cash');
  };

  const sendWhatsApp = () => {
    if (!invoice?.clientPhone) return;
    const msg = `Dear ${invoice.clientName},\n\nThank you for your purchase!\n\nInvoice: ${invoice.invoiceNumber}\nProduct: ${invoice.productName}\nUnit: ${invoice.unitCode}\nAmount: ₹${Number(invoice.sellingPrice).toLocaleString('en-IN')}\nPayment: ${invoice.paymentMethod.toUpperCase()}\nDate: ${new Date(invoice.soldAt).toLocaleDateString('en-IN')}\n\nReliable Dairy Equipments, Pune`;
    window.open(`https://wa.me/91${invoice.clientPhone}?text=${encodeURIComponent(msg)}`);
  };

  const { unit } = unitData || {};

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 20, fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#1a4a2e', marginBottom: 4 }}>Scan Unit</h2>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
        📍 {user?.location?.name} · {user?.role?.replace('_', ' ')}
      </p>

      {error && (
        <div style={{
          background: '#fef2f2', color: '#991b1b', padding: 12,
          borderRadius: 4, marginBottom: 16, fontSize: 14,
          border: '1px solid #fecaca',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          {error}
          <button onClick={() => { setError(''); setStep('scan'); }} style={{
            background: 'none', border: 'none', color: '#991b1b',
            cursor: 'pointer', fontSize: 18
          }}>×</button>
        </div>
      )}

      {/* STEP 1 — Camera */}
      {step === 'scan' && (
        <div>
          <p style={{ color: '#888', marginBottom: 16, fontSize: 14 }}>
            Point camera at the unit QR sticker
          </p>
          <QRScanner onResult={handleScan} />
          <p style={{ color: '#aaa', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            Each sticker has a unique QR code
          </p>
        </div>
      )}

      {/* STEP 2 — Action */}
      {step === 'action' && unit && (
        <div>
          <div style={cardStyle}>
            <p style={{ color: '#c17f3a', fontSize: 11, letterSpacing: 1, margin: '0 0 4px' }}>
              SCANNED UNIT
            </p>
            <h3 style={{ color: '#1a4a2e', margin: '0 0 4px', fontSize: 18 }}>
              {unit.product?.name}
            </h3>
            <p style={{ color: '#888', fontSize: 12, margin: 0 }}>
              Unit: {unit.unitCode}
            </p>
          </div>

          {/* DISPATCH */}
          {action === 'dispatch' && (
            <>
              <label style={labelStyle}>SELECT SHOP TO DISPATCH TO</label>
              <select value={toLocationId} onChange={e => setToLocationId(e.target.value)}
                style={{ ...inputStyle, marginBottom: 16 }}>
                <option value="">-- Select outlet --</option>
                {shopLocations.map(l => (
                  <option key={l._id} value={l._id}>{l.name}</option>
                ))}
              </select>
              <button onClick={handleConfirm} disabled={!toLocationId || loading}
                style={{ ...actionBtn('#c17f3a'), opacity: !toLocationId ? 0.5 : 1 }}>
                {loading ? 'Processing...' : '🚚 Confirm Dispatch'}
              </button>
            </>
          )}

          {/* RECEIVE */}
          {action === 'receive' && (
            <>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: 14, marginBottom: 16 }}>
                <p style={{ color: '#166534', margin: 0, fontSize: 14 }}>
                  📦 This unit was dispatched to your shop. Confirm receipt?
                </p>
              </div>
              <button onClick={handleConfirm} disabled={loading} style={actionBtn('#1a4a2e')}>
                {loading ? 'Processing...' : '📦 Confirm Receive'}
              </button>
            </>
          )}

          {/* SELL */}
          {action === 'sell' && (
            <>
              {/* Product summary */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: 14, marginBottom: 20 }}>
                <p style={{ color: '#92400e', margin: '0 0 2px', fontSize: 15, fontWeight: 700 }}>
                  {unit.product?.name}
                </p>
                <p style={{ color: '#92400e', margin: 0, fontSize: 13 }}>
                  {unit.unitCode} · ₹{Number(unit.product?.sellingPrice).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Customer details */}
              <label style={labelStyle}>CUSTOMER NAME</label>
              <input
                placeholder="e.g. Rahul Patil"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                style={{ ...inputStyle, marginBottom: 14 }}
              />

              <label style={labelStyle}>WHATSAPP NUMBER</label>
              <input
                placeholder="e.g. 9876543210"
                type="tel"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                style={{ ...inputStyle, marginBottom: 14 }}
              />

              <label style={labelStyle}>PAYMENT METHOD</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {['cash', 'upi', 'card', 'credit'].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)} style={{
                    padding: '10px', borderRadius: 4, cursor: 'pointer',
                    border: paymentMethod === m ? '2px solid #1a4a2e' : '1px solid #d4d4c8',
                    background: paymentMethod === m ? '#f0fdf4' : '#fafaf7',
                    color: paymentMethod === m ? '#1a4a2e' : '#666',
                    fontWeight: paymentMethod === m ? 700 : 400,
                    fontSize: 12, textTransform: 'uppercase', letterSpacing: 1,
                    fontFamily: 'Georgia, serif'
                  }}>
                    {m === 'cash' ? '💵 Cash' :
                     m === 'upi' ? '📱 UPI' :
                     m === 'card' ? '💳 Card' : '📒 Credit'}
                  </button>
                ))}
              </div>

              <button onClick={handleConfirm} disabled={loading} style={actionBtn('#1a4a2e')}>
                {loading ? 'Processing...' : '💰 Confirm Sale'}
              </button>
            </>
          )}

          <button onClick={reset} style={{
            marginTop: 12, color: '#888', background: 'none',
            border: 'none', cursor: 'pointer', fontSize: 13, display: 'block'
          }}>
            ← Scan again
          </button>
        </div>
      )}

      {/* STEP 3 — Invoice */}
      {step === 'invoice' && invoice && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <h3 style={{ color: '#1a4a2e', margin: 0 }}>Sale Complete</h3>
          </div>

          {/* Invoice card */}
          <div style={{
            background: '#fff', border: '1px solid #e8e8e0',
            borderRadius: 4, overflow: 'hidden', marginBottom: 16
          }}>
            {/* Invoice header */}
            <div style={{ background: '#1a4a2e', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: '#fff', margin: 0, fontWeight: 700, fontSize: 14 }}>
                    RELIABLE DAIRY EQUIPMENTS
                  </p>
                  <p style={{ color: '#a3c4a8', margin: '2px 0 0', fontSize: 11, letterSpacing: 1 }}>
                    PUNE
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: '#c17f3a', margin: 0, fontSize: 11, letterSpacing: 1 }}>INVOICE</p>
                  <p style={{ color: '#fff', margin: '2px 0 0', fontSize: 11 }}>{invoice.invoiceNumber}</p>
                </div>
              </div>
            </div>

            {/* Invoice body */}
            <div style={{ padding: '20px' }}>
              {/* Customer */}
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8e8e0' }}>
                <p style={invoiceLabelStyle}>CUSTOMER</p>
                <p style={invoiceValueStyle}>{invoice.clientName || '—'}</p>
                {invoice.clientPhone && (
                  <p style={{ color: '#888', fontSize: 12, margin: '2px 0 0' }}>
                    +91 {invoice.clientPhone}
                  </p>
                )}
              </div>

              {/* Product */}
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8e8e0' }}>
                <p style={invoiceLabelStyle}>PRODUCT</p>
                <p style={invoiceValueStyle}>{invoice.productName}</p>
                <p style={{ color: '#888', fontSize: 11, margin: '2px 0 0', letterSpacing: 0.5 }}>
                  Unit: {invoice.unitCode}
                </p>
              </div>

              {/* Amount + Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8e8e0' }}>
                <div>
                  <p style={invoiceLabelStyle}>AMOUNT</p>
                  <p style={{ color: '#1a4a2e', fontSize: 20, fontWeight: 700, margin: 0 }}>
                    ₹{Number(invoice.sellingPrice).toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p style={invoiceLabelStyle}>PAYMENT</p>
                  <p style={invoiceValueStyle}>{invoice.paymentMethod?.toUpperCase()}</p>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={invoiceLabelStyle}>DATE</p>
                  <p style={invoiceValueStyle}>
                    {new Date(invoice.soldAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <p style={invoiceLabelStyle}>SOLD BY</p>
                  <p style={invoiceValueStyle}>{invoice.soldBy}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          {invoice.clientPhone && (
            <button onClick={sendWhatsApp} style={{
              ...actionBtn('#25d366'),
              marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
              📱 Send Invoice on WhatsApp
            </button>
          )}

          <button onClick={() => window.print()} style={{
            ...actionBtn('#c17f3a'), marginBottom: 8
          }}>
            🖨 Print Invoice
          </button>

          <button onClick={reset} style={{
            width: '100%', padding: '13px', background: '#f5f5f0', color: '#666',
            border: '1px solid #e8e8e0', borderRadius: 4, fontSize: 11,
            fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
            fontFamily: 'Georgia, serif'
          }}>
            Scan Next Unit
          </button>
        </div>
      )}

      {/* STEP 3 — Done (for non-sell actions) */}
      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <p style={{ color: '#1a4a2e', fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
            {message}
          </p>
          <button onClick={reset} style={actionBtn('#1a4a2e')}>
            Scan Next Unit
          </button>
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: '#ffffff', border: '1px solid #e8e8e0',
  borderRadius: 4, padding: '14px 16px', marginBottom: 20,
  boxShadow: '0 1px 4px rgba(26,74,46,0.05)'
};
const actionBtn = (color) => ({
  width: '100%', padding: '14px', background: color, color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700,
  cursor: 'pointer', letterSpacing: 1, fontFamily: 'Georgia, serif'
});
const inputStyle = {
  width: '100%', padding: '11px 14px', background: '#fafaf7',
  border: '1px solid #d4d4c8', borderRadius: 4, color: '#1a1a1a',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif'
};
const labelStyle = {
  color: '#888', fontSize: 10, letterSpacing: 1.5,
  display: 'block', marginBottom: 8, fontWeight: 700
};
const invoiceLabelStyle = {
  color: '#888', fontSize: 10, letterSpacing: 1.5,
  margin: '0 0 4px', fontWeight: 700
};
const invoiceValueStyle = {
  color: '#1a1a1a', fontSize: 14, margin: 0, fontWeight: 600
};