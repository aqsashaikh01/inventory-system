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

  const generateInvoice = () => {
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Georgia', serif; color: #1a1a1a; background: #fff; }
          
          .page { width: 794px; min-height: 1123px; margin: 0 auto; padding: 60px; position: relative; }
          
          /* Header */
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; padding-bottom: 32px; border-bottom: 2px solid #1a4a2e; }
          .company-name { font-size: 22px; font-weight: 700; color: #1a4a2e; letter-spacing: 1px; margin-bottom: 4px; }
          .company-sub { font-size: 11px; color: #c17f3a; letter-spacing: 2px; margin-bottom: 12px; }
          .company-details { font-size: 11px; color: #666; line-height: 1.8; }
          .invoice-label { text-align: right; }
          .invoice-title { font-size: 32px; font-weight: 700; color: #1a4a2e; letter-spacing: 3px; margin-bottom: 8px; }
          .invoice-number { font-size: 13px; color: #666; margin-bottom: 4px; }
          .invoice-date { font-size: 13px; color: #666; }
          
          /* Bill To */
          .bill-section { display: flex; justify-content: space-between; margin-bottom: 48px; }
          .bill-to { flex: 1; }
          .bill-to-label { font-size: 10px; letter-spacing: 2px; color: #c17f3a; font-weight: 700; margin-bottom: 10px; }
          .bill-to-name { font-size: 16px; font-weight: 700; color: #1a4a2e; margin-bottom: 4px; }
          .bill-to-phone { font-size: 13px; color: #666; }
          .payment-box { background: #f5f5f0; border-left: 3px solid #c17f3a; padding: 16px 20px; }
          .payment-label { font-size: 10px; letter-spacing: 2px; color: #888; font-weight: 700; margin-bottom: 6px; }
          .payment-value { font-size: 14px; font-weight: 700; color: #1a4a2e; text-transform: uppercase; }
          
          /* Table */
          .table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
          .table thead tr { background: #1a4a2e; }
          .table thead th { padding: 14px 16px; text-align: left; font-size: 10px; letter-spacing: 2px; color: #fff; font-weight: 700; }
          .table thead th:last-child { text-align: right; }
          .table tbody tr { border-bottom: 1px solid #e8e8e0; }
          .table tbody tr:last-child { border-bottom: none; }
          .table tbody td { padding: 18px 16px; font-size: 13px; color: #1a1a1a; vertical-align: top; }
          .table tbody td:last-child { text-align: right; font-weight: 700; color: #1a4a2e; }
          .product-name { font-weight: 700; color: #1a4a2e; margin-bottom: 4px; font-size: 14px; }
          .product-unit { font-size: 11px; color: #888; letter-spacing: 0.5px; }
          
          /* Totals */
          .totals { display: flex; justify-content: flex-end; margin-bottom: 48px; }
          .totals-box { width: 280px; }
          .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e8e8e0; font-size: 13px; }
          .total-row:last-child { border-bottom: none; border-top: 2px solid #1a4a2e; margin-top: 4px; padding-top: 14px; }
          .total-row:last-child span { font-size: 16px; font-weight: 700; color: #1a4a2e; }
          .total-label { color: #666; }
          .total-value { font-weight: 600; color: #1a1a1a; }
          
          /* Footer */
          .footer { position: absolute; bottom: 60px; left: 60px; right: 60px; }
          .footer-divider { height: 1px; background: #e8e8e0; margin-bottom: 20px; }
          .footer-content { display: flex; justify-content: space-between; align-items: flex-end; }
          .thank-you { font-size: 13px; color: #666; font-style: italic; }
          .sold-by { text-align: right; font-size: 11px; color: #888; line-height: 1.8; }
          .accent-bar { height: 4px; background: linear-gradient(to right, #1a4a2e, #c17f3a); margin-bottom: 0; border-radius: 2px; }
          
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { padding: 40px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <!-- Print button — hidden when printing -->
        <div class="no-print" style="background:#1a4a2e;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#fff;font-family:Georgia,serif;font-size:13px;letter-spacing:1px;">RDE INVOICE — ${invoice.invoiceNumber}</span>
          <div style="display:flex;gap:12px;">
            <button onclick="window.print()" style="background:#c17f3a;color:#fff;border:none;padding:8px 20px;font-family:Georgia,serif;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;border-radius:2px;">🖨 PRINT / SAVE PDF</button>
            <button onclick="window.close()" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.3);padding:8px 20px;font-family:Georgia,serif;font-size:12px;cursor:pointer;border-radius:2px;">CLOSE</button>
          </div>
        </div>

        <div class="page">
          <!-- Accent bar top -->
          <div class="accent-bar" style="margin-bottom:40px;"></div>
          
          <!-- Header -->
          <div class="header">
            <div>
              <div class="company-name">RELIABLE DAIRY EQUIPMENTS</div>
              <div class="company-sub">PUNE, MAHARASHTRA</div>
              <div class="company-details">
                Factory & Showroom, Pune<br>
                contact@rdepune.com<br>
                +91 XXXXXXXXXX
              </div>
            </div>
            <div class="invoice-label">
              <div class="invoice-title">INVOICE</div>
              <div class="invoice-number"># ${invoice.invoiceNumber}</div>
              <div class="invoice-date">${new Date(invoice.soldAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>

          <!-- Bill To -->
          <div class="bill-section">
            <div class="bill-to">
              <div class="bill-to-label">BILL TO</div>
              <div class="bill-to-name">${invoice.clientName || 'Walk-in Customer'}</div>
              ${invoice.clientPhone ? `<div class="bill-to-phone">+91 ${invoice.clientPhone}</div>` : ''}
            </div>
            <div class="payment-box">
              <div class="payment-label">PAYMENT METHOD</div>
              <div class="payment-value">${invoice.paymentMethod || 'Cash'}</div>
            </div>
          </div>

          <!-- Table -->
          <table class="table">
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th>UNIT CODE</th>
                <th>QTY</th>
                <th>UNIT PRICE</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="product-name">${invoice.productName}</div>
                  <div class="product-unit">Dairy Equipment</div>
                </td>
                <td style="font-size:11px;color:#888;letter-spacing:0.5px;">${invoice.unitCode}</td>
                <td>1</td>
                <td>₹${Number(invoice.sellingPrice).toLocaleString('en-IN')}</td>
                <td>₹${Number(invoice.sellingPrice).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals">
            <div class="totals-box">
              <div class="total-row">
                <span class="total-label">Subtotal</span>
                <span class="total-value">₹${Number(invoice.sellingPrice).toLocaleString('en-IN')}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Tax (GST)</span>
                <span class="total-value">Inclusive</span>
              </div>
              <div class="total-row">
                <span>TOTAL</span>
                <span>₹${Number(invoice.sellingPrice).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-divider"></div>
            <div class="footer-content">
              <div class="thank-you">Thank you for your business!</div>
              <div class="sold-by">
                Sold by: ${invoice.soldBy}<br>
                ${invoice.location}<br>
                ${new Date(invoice.soldAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <!-- Bottom accent -->
          <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(to right,#1a4a2e,#c17f3a);"></div>
        </div>
      </body>
      </html>
    `;

    const invoiceWindow = window.open('', '_blank');
    invoiceWindow.document.write(invoiceHTML);
    invoiceWindow.document.close();
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
            <button onClick={() => {
              generateInvoice();
              setTimeout(() => sendWhatsApp(), 500);
            }} style={{
              ...actionBtn('#25d366'),
              marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
              📱 Send WhatsApp
            </button>
          )}

          <button onClick={generateInvoice} style={{
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