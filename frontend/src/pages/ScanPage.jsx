import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QRScanner from '../components/QRScanner';
import api from '../utils/api';

const G = {
  green: '#1B6B45', greenLight: '#E8F5EE', greenBorder: '#BBF7D0', greenText: '#166534',
  orange: '#C17F3A', orangeLight: '#FFF7ED', orangeBorder: '#FED7AA', orangeText: '#9A3412',
  bg: '#F5F5F2', surface: '#FFFFFF', surfaceSecondary: '#EFEFEB',
  border: 'rgba(0,0,0,0.08)', borderSoft: 'rgba(0,0,0,0.05)',
  textPrimary: '#111110', textSecondary: '#6B6B68', textTertiary: '#9A9A96',
  red: '#991B1B', redLight: '#FEF2F2', redBorder: '#FECACA',
};
const font = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

const STATUS_MSG = {
  in_factory: 'Already in factory', dispatched: 'Already dispatched',
  in_shop: 'Already in shop', sold: 'Already sold', generated: 'Not yet stocked',
};

export default function ScanPage() {
  const { user } = useAuth();
  const { sku: urlCode } = useParams();

  // queue items: { unitCode, unit, availableAction, status: 'loading'|'ready'|'error'|'done', error, message }
  const [queue, setQueue] = useState([]);
  const [batchAction, setBatchAction] = useState(null); // first action type seen
  const [shopLocations, setShopLocations] = useState([]);
  const [step, setStep] = useState('scanning'); // 'scanning' | 'confirming' | 'processing' | 'results'
  const [results, setResults] = useState([]);

  // form fields
  const [toLocationId, setToLocationId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const scannedRef = useRef(new Set());
  const batchActionRef = useRef(null);
  const shopLocationsRef = useRef([]);

  useEffect(() => { shopLocationsRef.current = shopLocations; }, [shopLocations]);
  useEffect(() => { batchActionRef.current = batchAction; }, [batchAction]);

  const handleScan = useCallback((rawCode) => {
    const unitCode = rawCode.includes('/unit/') ? rawCode.split('/unit/')[1]
      : rawCode.includes('/scan/') ? rawCode.split('/scan/')[1]
      : rawCode;

    if (scannedRef.current.has(unitCode)) return;
    scannedRef.current.add(unitCode);

    setQueue(prev => [...prev, { unitCode, unit: null, availableAction: null, status: 'loading', error: null, message: null }]);

    api.get(`/units/scan/${unitCode}`)
      .then(res => {
        const { unit, availableAction } = res.data;

        if (!availableAction) {
          setQueue(prev => prev.map(q => q.unitCode === unitCode
            ? { ...q, unit, status: 'error', error: STATUS_MSG[unit.status] || 'Cannot process' }
            : q));
          return;
        }

        // stock_in: auto-process immediately, no batch needed
        if (availableAction === 'stock_in') {
          api.post(`/units/stock-in/${unitCode}`)
            .then(() => setQueue(prev => prev.map(q => q.unitCode === unitCode
              ? { ...q, unit, availableAction, status: 'done', message: 'Added to factory' }
              : q)))
            .catch(err => setQueue(prev => prev.map(q => q.unitCode === unitCode
              ? { ...q, unit, status: 'error', error: err.response?.data?.error || 'Failed' }
              : q)));
          return;
        }

        // Mismatch with already-determined batch action
        if (batchActionRef.current && availableAction !== batchActionRef.current) {
          setQueue(prev => prev.map(q => q.unitCode === unitCode
            ? { ...q, unit, status: 'error', error: `Expected ${batchActionRef.current}, got ${availableAction}` }
            : q));
          return;
        }

        setQueue(prev => prev.map(q => q.unitCode === unitCode
          ? { ...q, unit, availableAction, status: 'ready' }
          : q));

        if (!batchActionRef.current) {
          batchActionRef.current = availableAction;
          setBatchAction(availableAction);
          if (availableAction === 'dispatch' && shopLocationsRef.current.length === 0) {
            api.get('/locations').then(r => {
              const shops = r.data.filter(l => l.type === 'shop');
              shopLocationsRef.current = shops;
              setShopLocations(shops);
            });
          }
        }
      })
      .catch(err => {
        setQueue(prev => prev.map(q => q.unitCode === unitCode
          ? { ...q, status: 'error', error: err.response?.data?.error || 'Invalid QR' }
          : q));
      });
  }, []);

  // Handle deep-link URL code
  useEffect(() => { if (urlCode) handleScan(urlCode); }, [urlCode]);

  const readyItems = queue.filter(q => q.status === 'ready');

  const handleProcessAll = async () => {
    if (!readyItems.length) return;
    setStep('processing');

    const settled = await Promise.allSettled(readyItems.map(item => {
      const uc = item.unitCode;
      if (batchAction === 'dispatch') return api.post(`/units/dispatch/${uc}`, { toLocationId });
      if (batchAction === 'receive') return api.post(`/units/receive/${uc}`);
      if (batchAction === 'sell') return api.post(`/units/sell/${uc}`, { clientName, clientPhone, paymentMethod });
    }));

    const res = readyItems.map((item, i) => ({
      unitCode: item.unitCode,
      productName: item.unit?.product?.name,
      price: item.unit?.product?.sellingPrice,
      success: settled[i].status === 'fulfilled',
      invoice: settled[i].value?.data?.invoice || null,
      error: settled[i].reason?.response?.data?.error || null,
    }));

    setResults(res);
    setStep('results');
  };

  const reset = () => {
    setQueue([]);
    setBatchAction(null);
    setStep('scanning');
    setResults([]);
    setToLocationId('');
    setClientName('');
    setClientPhone('');
    setPaymentMethod('cash');
    scannedRef.current = new Set();
    batchActionRef.current = null;
  };

  const actionLabel = { dispatch: 'Dispatch', receive: 'Receive', sell: 'Sell' };
  const actionColor = { dispatch: G.orange, receive: G.green, sell: G.green };

  // ── RESULTS step ──────────────────────────────────────────────
  if (step === 'results') {
    const successCount = results.filter(r => r.success).length;
    const totalRevenue = results.filter(r => r.success && batchAction === 'sell')
      .reduce((s, r) => s + (r.price || 0), 0);
    return (
      <div style={{ fontFamily: font, background: G.bg, minHeight: '100vh', padding: '24px 20px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: G.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke={G.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: G.textPrimary, margin: '0 0 2px' }}>
              {successCount} of {results.length} processed
            </p>
            {batchAction === 'sell' && totalRevenue > 0 && (
              <p style={{ fontSize: 14, color: G.green, fontWeight: 600, margin: '4px 0 0' }}>
                ₹{totalRevenue.toLocaleString('en-IN')} total
              </p>
            )}
          </div>

          {results.map(r => (
            <div key={r.unitCode} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: G.textPrimary, margin: '0 0 2px' }}>{r.productName}</p>
                <p style={{ fontSize: 11, color: G.textTertiary, margin: 0 }}>{r.unitCode}</p>
                {r.error && <p style={{ fontSize: 11, color: G.red, margin: '2px 0 0' }}>{r.error}</p>}
              </div>
              {r.success
                ? <span style={pillStyle(G.green, G.greenLight, G.greenBorder)}>Done</span>
                : <span style={pillStyle(G.red, G.redLight, G.redBorder)}>Failed</span>}
            </div>
          ))}

          <button onClick={reset} style={{ ...btnStyle(G.green), marginTop: 16 }}>Scan more</button>
        </div>
      </div>
    );
  }

  // ── PROCESSING step ───────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div style={{ fontFamily: font, background: G.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: G.textSecondary, fontSize: 14 }}>Processing {readyItems.length} items…</p>
      </div>
    );
  }

  // ── CONFIRMING step ───────────────────────────────────────────
  if (step === 'confirming') {
    return (
      <div style={{ fontFamily: font, background: G.bg, minHeight: '100vh', padding: '24px 20px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <button onClick={() => setStep('scanning')} style={backBtn}>← Back to scanning</button>

          <h3 style={{ fontSize: 17, fontWeight: 600, color: G.textPrimary, margin: '0 0 4px' }}>
            {actionLabel[batchAction]} {readyItems.length} unit{readyItems.length !== 1 ? 's' : ''}
          </h3>
          <p style={{ fontSize: 13, color: G.textTertiary, margin: '0 0 20px' }}>
            {readyItems.map(i => i.unit?.product?.name || i.unitCode).join(', ')}
          </p>

          {batchAction === 'dispatch' && (
            <>
              <p style={labelStyle}>Select shop</p>
              <select value={toLocationId} onChange={e => setToLocationId(e.target.value)} style={{ ...selectStyle, marginBottom: 20 }}>
                <option value="">— Select outlet —</option>
                {shopLocations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
              </select>
              <button onClick={handleProcessAll} disabled={!toLocationId} style={{ ...btnStyle(G.orange), opacity: !toLocationId ? 0.5 : 1 }}>
                Confirm dispatch
              </button>
            </>
          )}

          {batchAction === 'receive' && (
            <>
              <div style={{ background: G.greenLight, border: `0.5px solid ${G.greenBorder}`, borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                <p style={{ color: G.greenText, margin: 0, fontSize: 14 }}>Confirm receipt of {readyItems.length} unit{readyItems.length !== 1 ? 's' : ''}?</p>
              </div>
              <button onClick={handleProcessAll} style={btnStyle(G.green)}>Confirm receive</button>
            </>
          )}

          {batchAction === 'sell' && (
            <>
              <p style={labelStyle}>Customer name</p>
              <input placeholder="e.g. Rahul Patil" value={clientName} onChange={e => setClientName(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
              <p style={labelStyle}>WhatsApp number</p>
              <input placeholder="e.g. 9876543210" type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
              <p style={labelStyle}>Payment method</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {[{ key: 'cash', label: 'Cash' }, { key: 'upi', label: 'UPI' }, { key: 'card', label: 'Card' }, { key: 'credit', label: 'Credit' }].map(({ key, label }) => (
                  <button key={key} onClick={() => setPaymentMethod(key)} style={{
                    padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontFamily: font, fontSize: 13,
                    border: paymentMethod === key ? `1.5px solid ${G.green}` : `0.5px solid rgba(0,0,0,0.12)`,
                    background: paymentMethod === key ? G.greenLight : G.surface,
                    color: paymentMethod === key ? G.greenText : G.textSecondary,
                    fontWeight: paymentMethod === key ? 600 : 400,
                  }}>{label}</button>
                ))}
              </div>
              <button onClick={handleProcessAll} style={btnStyle(G.green)}>
                Confirm sale — ₹{readyItems.reduce((s, i) => s + (i.unit?.product?.sellingPrice || 0), 0).toLocaleString('en-IN')}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── SCANNING step ─────────────────────────────────────────────
  return (
    <div style={{ fontFamily: font, background: G.bg, minHeight: '100vh', padding: '20px 16px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>

        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: G.textPrimary, margin: '0 0 2px' }}>Scan Units</h2>
          <span style={{ fontSize: 12, color: G.textTertiary }}>{user?.location?.name} · {user?.role?.replace('_', ' ')}</span>
        </div>

        {/* Camera — always visible while scanning */}
        <div style={{ marginBottom: 14 }}>
          <QRScanner onResult={handleScan} active={step === 'scanning'} />
          <p style={{ fontSize: 11, color: G.textTertiary, textAlign: 'center', marginTop: 6 }}>
            Keep scanning — units queue up below
          </p>
        </div>

        {/* Queue list */}
        {queue.length > 0 && (
          <div style={{ marginBottom: readyItems.length ? 80 : 0 }}>
            <p style={labelStyle}>{queue.length} scanned</p>
            {queue.map(item => (
              <div key={item.unitCode} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: G.textPrimary, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.unit?.product?.name || item.unitCode}
                  </p>
                  <p style={{ fontSize: 11, color: G.textTertiary, margin: 0 }}>{item.unitCode}</p>
                  {item.error && <p style={{ fontSize: 11, color: G.red, margin: '2px 0 0' }}>{item.error}</p>}
                  {item.message && <p style={{ fontSize: 11, color: G.green, margin: '2px 0 0' }}>{item.message}</p>}
                </div>
                <div style={{ flexShrink: 0, marginLeft: 10 }}>
                  {item.status === 'loading' && <span style={{ fontSize: 12, color: G.textTertiary }}>…</span>}
                  {item.status === 'ready' && <span style={pillStyle(G.green, G.greenLight, G.greenBorder)}>{actionLabel[item.availableAction]}</span>}
                  {item.status === 'error' && <span style={pillStyle(G.red, G.redLight, G.redBorder)}>Skip</span>}
                  {item.status === 'done' && <span style={pillStyle(G.green, G.greenLight, G.greenBorder)}>Done</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sticky action button */}
        {readyItems.length > 0 && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: G.surface, borderTop: `0.5px solid ${G.border}` }}>
            <div style={{ maxWidth: 420, margin: '0 auto' }}>
              <button onClick={() => setStep('confirming')} style={btnStyle(actionColor[batchAction] || G.green)}>
                {actionLabel[batchAction] || 'Process'} {readyItems.length} unit{readyItems.length !== 1 ? 's' : ''} →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ── Styles ── */
const cardStyle = { background: '#FFFFFF', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 };
const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#9A9A96', margin: '0 0 8px' };
const inputStyle = { width: '100%', padding: '10px 14px', background: '#FAFAF7', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, color: '#111110', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: font };
const selectStyle = { width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, color: '#111110', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: font };
const btnStyle = (color) => ({ width: '100%', padding: '13px', background: color, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font });
const backBtn = { background: 'none', border: 'none', color: '#9A9A96', cursor: 'pointer', fontSize: 13, fontFamily: font, padding: '0 0 16px', display: 'block' };
const pillStyle = (color, bg, border) => ({ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: bg, color, border: `1px solid ${border}` });
