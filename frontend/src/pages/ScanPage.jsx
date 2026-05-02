import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QRScanner from '../components/QRScanner';
import api from '../utils/api';

const G = {
  green: '#1B6B45',
  greenLight: '#E8F5EE',
  greenBorder: '#BBF7D0',
  greenText: '#166534',
  orange: '#C17F3A',
  orangeLight: '#FFF7ED',
  orangeBorder: '#FED7AA',
  orangeText: '#9A3412',
  bg: '#F5F5F2',
  surface: '#FFFFFF',
  surfaceSecondary: '#EFEFEB',
  border: 'rgba(0,0,0,0.08)',
  borderSoft: 'rgba(0,0,0,0.05)',
  textPrimary: '#111110',
  textSecondary: '#6B6B68',
  textTertiary: '#9A9A96',
  red: '#991B1B',
  redLight: '#FEF2F2',
  redBorder: '#FECACA',
  whatsapp: '#1B6B45',
};

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
        setMessage(`${unit.unitCode} added to factory inventory`);
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
      in_factory: 'Already in factory inventory',
      dispatched: 'Already dispatched to a shop',
      in_shop: 'Already in shop inventory',
      sold: 'This unit has already been sold',
      generated: 'Not yet processed',
    };
    return messages[status] || 'Cannot process this unit';
  };

  const handleConfirm = async () => {
    setLoading(true);
    const unitCode = unitData.unit.unitCode;
    try {
      if (action === 'dispatch') {
        await api.post(`/units/dispatch/${unitCode}`, { toLocationId });
        const shop = shopLocations.find(l => l._id === toLocationId);
        setMessage(`${unitCode} dispatched to ${shop?.name}`);
        setStep('done');
      } else if (action === 'receive') {
        await api.post(`/units/receive/${unitCode}`);
        setMessage(`${unitCode} received into shop inventory`);
        setStep('done');
      } else if (action === 'sell') {
        const res = await api.post(`/units/sell/${unitCode}`, {
          clientName, clientPhone, paymentMethod,
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
    <title>INVOICE ${invoice.invoiceNumber}</title>

    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">

    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Inter', sans-serif;
        background: #f3f4f6;
        color: #111827;
      }

      .page {
        width: 794px;
        min-height: 1123px;
        margin: 0 auto;
        background: #ffffff;
        padding: 56px;
      }

      .top-bar {
        background: #111827;
        padding: 10px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      @media print {
        .top-bar { display: none !important; }
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 48px;
      }

      /* 🔥 Bigger but clean logo */
      .logo {
        height: 75px;
        margin-bottom: 14px;
        object-fit: contain;
      }

      .company-name {
        font-size: 15px;
        font-weight: 600;
      }

      .company-details {
        font-size: 13px;
        color: #6b7280;
        margin-top: 4px;
        line-height: 1.5;
      }

      .invoice-title {
        font-size: 26px;
        font-weight: 600;
        text-align: right;
        margin-bottom: 8px;
      }

      .invoice-meta {
        font-size: 13px;
        color: #6b7280;
        text-align: right;
        line-height: 1.6;
      }

      .invoice-meta span {
        font-weight: 500;
        color: #111827;
      }

      .bill-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 36px;
      }

      .bill-label {
        font-size: 11px;
        color: #9ca3af;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .bill-name {
        font-size: 15px;
        font-weight: 600;
      }

      .bill-phone {
        font-size: 13px;
        color: #6b7280;
        margin-top: 2px;
      }

      .payment-box {
        text-align: right;
      }

      .payment-value {
        font-size: 14px;
        font-weight: 500;
        margin-top: 4px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      thead {
        background: #f9fafb;
      }

      thead th {
        text-align: left;
        padding: 12px;
        font-size: 12px;
        font-weight: 500;
        color: #6b7280;
      }

      tbody td {
        padding: 14px 12px;
        font-size: 14px;
        border-bottom: 1px solid #e5e7eb;
      }

      tbody td:last-child {
        text-align: right;
        font-weight: 500;
      }

      .product-name {
        font-weight: 500;
      }

      .product-sub {
        font-size: 12px;
        color: #9ca3af;
        margin-top: 2px;
      }

      .totals {
        margin-top: 28px;
        display: flex;
        justify-content: flex-end;
      }

      .totals-box {
        width: 260px;
      }

      .row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        font-size: 14px;
      }

      .row.total {
        border-top: 1.5px solid #111827;
        margin-top: 8px;
        padding-top: 10px;
        font-weight: 600;
        font-size: 15px;
      }

      .footer {
        margin-top: 60px;
        font-size: 13px;
        color: #6b7280;
        display: flex;
        justify-content: space-between;
      }

      .btn {
        padding: 7px 14px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }

    </style>
  </head>

  <body>

    <div class="top-bar">
      <span style="color:#fff;font-size:13px;">Invoice — ${invoice.invoiceNumber}</span>
      <div>
        <button onclick="window.print()" class="btn" style="background:#2563eb;color:#fff;border:none;">Print</button>
        <button onclick="window.close()" class="btn" style="margin-left:8px;background:transparent;color:#fff;border:1px solid #6b7280;">Close</button>
      </div>
    </div>

    <div class="page">

      <div class="header">
        <div>
          <img src="${window.location.origin}/logo.png" class="logo" />
          <div class="company-name">Reliable Dairy Equipments</div>
          <div class="company-details">
            Pune, Maharashtra<br>
            reliablepnq@gmail.com · +91 9175857346
          </div>
        </div>

        <div>
          <div class="invoice-title">INVOICE</div>
          <div class="invoice-meta">
            No: <span>${invoice.invoiceNumber}</span><br>
            Date: <span>${new Date(invoice.soldAt).toLocaleDateString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div class="bill-section">
        <div>
          <div class="bill-label">Bill To</div>
          <div class="bill-name">${invoice.clientName || 'Walk-in Customer'}</div>
          ${invoice.clientPhone ? `<div class="bill-phone">+91 ${invoice.clientPhone}</div>` : ''}
        </div>

        <div class="payment-box">
          <div class="bill-label">Payment</div>
          <div class="payment-value">${invoice.paymentMethod || 'Cash'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Unit</th>
            <th>Qty</th>
            <th>Price</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              <div class="product-name">${invoice.productName}</div>
              <div class="product-sub">Dairy Equipment</div>
            </td>
            <td>${invoice.unitCode}</td>
            <td>1</td>
            <td>₹${Number(invoice.sellingPrice).toLocaleString('en-IN')}</td>
            <td>₹${Number(invoice.sellingPrice).toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="row">
            <span>Subtotal</span>
            <span>₹${Number(invoice.sellingPrice).toLocaleString('en-IN')}</span>
          </div>

          <div class="row">
            <span>GST</span>
            <span>Included</span>
          </div>

          <div class="row total">
            <span>Total</span>
            <span>₹${Number(invoice.sellingPrice).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <div>Thank you for your business.</div>
        <div>Authorized Signature</div>
      </div>

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
    <div style={{ fontFamily: font, background: G.bg, minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: G.textPrimary, letterSpacing: '-0.3px', margin: '0 0 4px' }}>
            Scan Unit
          </h2>
          <span style={{ fontSize: 13, color: G.textTertiary }}>
            {user?.location?.name} &nbsp;·&nbsp; {user?.role?.replace('_', ' ')}
          </span>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: G.redLight, color: G.red, padding: '12px 14px',
            borderRadius: 10, marginBottom: 16, fontSize: 13,
            border: `0.5px solid ${G.redBorder}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{error}</span>
            <button onClick={() => { setError(''); setStep('scan'); }} style={{
              background: 'none', border: 'none', color: G.red,
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0,
            }}>×</button>
          </div>
        )}

        {/* STEP 1 — Camera */}
        {step === 'scan' && (
          <div>
            <div style={sectionLabelStyle}>Point camera at QR sticker</div>
            <QRScanner onResult={handleScan} />
            <p style={{ fontSize: 12, color: G.textTertiary, textAlign: 'center', marginTop: 10 }}>
              Each sticker has a unique QR code
            </p>
          </div>
        )}

        {/* STEP 2 — Action */}
        {step === 'action' && unit && (
          <div>
            {/* Scanned unit card */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={sectionLabelStyle}>Scanned unit</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: G.textPrimary, margin: '0 0 2px' }}>
                    {unit.product?.name}
                  </p>
                  <p style={{ fontSize: 12, color: G.textSecondary, margin: 0 }}>
                    {unit.unitCode}
                  </p>
                </div>
                <span style={badge('green')}>{unit.status?.replace('_', ' ')}</span>
              </div>
            </div>

            {/* DISPATCH */}
            {action === 'dispatch' && (
              <>
                <p style={sectionLabelStyle}>Select shop to dispatch to</p>
                <select
                  value={toLocationId}
                  onChange={e => setToLocationId(e.target.value)}
                  style={{ ...selectStyle, marginBottom: 16 }}
                >
                  <option value="">— Select outlet —</option>
                  {shopLocations.map(l => (
                    <option key={l._id} value={l._id}>{l.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleConfirm}
                  disabled={!toLocationId || loading}
                  style={{ ...btn(G.orange), opacity: !toLocationId ? 0.45 : 1 }}
                >
                  {loading ? 'Processing…' : 'Confirm dispatch'}
                </button>
              </>
            )}

            {/* RECEIVE */}
            {action === 'receive' && (
              <>
                <div style={{
                  background: G.greenLight, border: `0.5px solid ${G.greenBorder}`,
                  borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                }}>
                  <p style={{ color: G.greenText, margin: 0, fontSize: 14 }}>
                    This unit was dispatched to your shop. Confirm receipt?
                  </p>
                </div>
                <button onClick={handleConfirm} disabled={loading} style={btn(G.green)}>
                  {loading ? 'Processing…' : 'Confirm receive'}
                </button>
              </>
            )}

            {/* SELL */}
            {action === 'sell' && (
              <>
                {/* Price summary strip */}
                <div style={{
                  background: G.surfaceSecondary, borderRadius: 10,
                  padding: '12px 14px', marginBottom: 20,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: G.textPrimary, margin: '0 0 2px' }}>
                      {unit.product?.name}
                    </p>
                    <p style={{ fontSize: 12, color: G.textSecondary, margin: 0 }}>{unit.unitCode}</p>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: G.green, margin: 0 }}>
                    ₹{Number(unit.product?.sellingPrice).toLocaleString('en-IN')}
                  </p>
                </div>

                <p style={sectionLabelStyle}>Customer name</p>
                <input
                  placeholder="e.g. Rahul Patil"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 14 }}
                />

                <p style={sectionLabelStyle}>WhatsApp number</p>
                <input
                  placeholder="e.g. 9876543210"
                  type="tel"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 14 }}
                />

                <p style={sectionLabelStyle}>Payment method</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                  {[
                    { key: 'cash', label: 'Cash' },
                    { key: 'upi', label: 'UPI' },
                    { key: 'card', label: 'Card' },
                    { key: 'credit', label: 'Credit' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setPaymentMethod(key)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: paymentMethod === key
                          ? `1.5px solid ${G.green}`
                          : `0.5px solid rgba(0,0,0,0.12)`,
                        background: paymentMethod === key ? G.greenLight : G.surface,
                        color: paymentMethod === key ? G.greenText : G.textSecondary,
                        fontWeight: paymentMethod === key ? 600 : 400,
                        fontSize: 13,
                        fontFamily: font,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button onClick={handleConfirm} disabled={loading} style={btn(G.green)}>
                  {loading ? 'Processing…' : `Confirm sale${unit.product?.sellingPrice ? ` — ₹${Number(unit.product.sellingPrice).toLocaleString('en-IN')}` : ''}`}
                </button>
              </>
            )}

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={reset} style={{
                background: 'none', border: 'none', color: G.textTertiary,
                cursor: 'pointer', fontSize: 13, fontFamily: font,
              }}>
                ← Scan again
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Invoice */}
        {step === 'invoice' && invoice && (
          <div>
            {/* Success state */}
            <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: G.greenLight, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L19 7" stroke={G.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ fontSize: 17, fontWeight: 600, color: G.textPrimary, margin: '0 0 2px' }}>Sale complete</p>
              <p style={{ fontSize: 13, color: G.textTertiary }}>{invoice.invoiceNumber}</p>
            </div>

            {/* Invoice card */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: 12 }}>
              {/* Header strip */}
              <div style={{
                background: G.green, padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>
                    Reliable Dairy Equipments
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, letterSpacing: '0.5px', margin: 0 }}>
                    PUNE
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: G.orange, fontSize: 10, fontWeight: 600, letterSpacing: '1px', margin: '0 0 2px' }}>
                    INVOICE
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, margin: 0 }}>
                    {invoice.invoiceNumber}
                  </p>
                </div>
              </div>

              <div style={{ padding: '16px' }}>
                {/* Customer */}
                <div style={invoiceRowStyle}>
                  <p style={sectionLabelStyle}>Customer</p>
                  <p style={invoiceValueStyle}>{invoice.clientName || '—'}</p>
                  {invoice.clientPhone && (
                    <p style={{ color: G.textSecondary, fontSize: 12, margin: '2px 0 0' }}>
                      +91 {invoice.clientPhone}
                    </p>
                  )}
                </div>

                {/* Product */}
                <div style={invoiceRowStyle}>
                  <p style={sectionLabelStyle}>Product</p>
                  <p style={invoiceValueStyle}>{invoice.productName}</p>
                  <p style={{ color: G.textTertiary, fontSize: 11, margin: '2px 0 0', letterSpacing: '0.3px' }}>
                    Unit: {invoice.unitCode}
                  </p>
                </div>

                {/* Amount + Payment */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...invoiceRowStyle }}>
                  <div>
                    <p style={sectionLabelStyle}>Amount</p>
                    <p style={{ fontSize: 20, fontWeight: 600, color: G.green, margin: 0 }}>
                      ₹{Number(invoice.sellingPrice).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p style={sectionLabelStyle}>Payment</p>
                    <span style={badge('green')}>{invoice.paymentMethod?.toUpperCase()}</span>
                  </div>
                </div>

                {/* Date + Sold by */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <p style={sectionLabelStyle}>Date</p>
                    <p style={invoiceValueStyle}>
                      {new Date(invoice.soldAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <p style={sectionLabelStyle}>Sold by</p>
                    <p style={invoiceValueStyle}>{invoice.soldBy}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            {invoice.clientPhone && (
              <button
                onClick={() => { generateInvoice(); setTimeout(() => sendWhatsApp(), 500); }}
                style={{ ...btn(G.whatsapp), marginBottom: 8 }}
              >
                Send WhatsApp
              </button>
            )}
            <button onClick={generateInvoice} style={{ ...btn(G.orange), marginBottom: 8 }}>
              Print invoice
            </button>
            <button onClick={reset} style={btnGhost}>
              Scan next unit
            </button>
          </div>
        )}

        {/* STEP 3 — Done (non-sell) */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: G.greenLight, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L19 7" stroke={G.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: G.textPrimary, marginBottom: 6 }}>Done</p>
            <p style={{ fontSize: 14, color: G.textSecondary, marginBottom: 28 }}>{message}</p>
            <button onClick={reset} style={btn(G.green)}>
              Scan next unit
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── Style helpers ───────────────────────────────────────── */

const font = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

const cardStyle = {
  background: '#FFFFFF',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
  padding: '14px 16px',
  marginBottom: 10,
};

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  color: '#9A9A96',
  margin: '0 0 8px',
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  background: '#FAFAF7',
  border: '0.5px solid rgba(0,0,0,0.12)',
  borderRadius: 8,
  color: '#111110',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: font,
};

const selectStyle = {
  width: '100%',
  padding: '10px 14px',
  background: '#FFFFFF',
  border: '0.5px solid rgba(0,0,0,0.12)',
  borderRadius: 8,
  color: '#111110',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
  fontFamily: font,
};

const btn = (color) => ({
  width: '100%',
  padding: '13px',
  background: color,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: font,
  letterSpacing: '0.2px',
  marginBottom: 8,
});

const btnGhost = {
  width: '100%',
  padding: '13px',
  background: '#EFEFEB',
  color: '#6B6B68',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: font,
};

const badge = (type) => ({
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 20,
  letterSpacing: '0.4px',
  ...(type === 'green'
    ? { background: '#E8F5EE', color: '#166534', border: '1px solid #BBF7D0' }
    : { background: '#FFF7ED', color: '#9A3412', border: '1px solid #FED7AA' }),
});

const invoiceRowStyle = {
  marginBottom: 14,
  paddingBottom: 14,
  borderBottom: '0.5px solid rgba(0,0,0,0.06)',
};

const invoiceValueStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: '#111110',
  margin: 0,
};