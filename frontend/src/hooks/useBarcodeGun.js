import { useEffect, useRef } from 'react';

// A barcode gun is just a keyboard: it types the code far faster than a person
// can and normally presses Enter afterwards. So a run of characters where every
// gap is under GAP_MS is a scan, not typing — 17 characters at that rate would
// be well over 200wpm. Guns configured without an Enter suffix are caught by
// the silence timer instead.
const GAP_MS = 60;      // longest gap allowed between characters of one scan
const FLUSH_MS = 90;    // silence that ends a scan when the gun sends no Enter
const MIN_LENGTH = 4;   // shorter than any unit code — ignore stray keypresses

export default function useBarcodeGun(onScan, active = true) {
  const bufferRef = useRef('');
  const lastKeyRef = useRef(0);
  const flushRef = useRef(null);
  const onScanRef = useRef(onScan);

  // Keep the latest callback without re-binding the listener on every render
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!active) return;

    const submit = () => {
      const code = bufferRef.current.trim();
      bufferRef.current = '';
      if (code.length >= MIN_LENGTH) onScanRef.current(code);
    };

    const handleKey = (e) => {
      // Never swallow real typing, in this page or any field that gains focus
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
                 el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      clearTimeout(flushRef.current);

      // Terminator: submit whatever the gun typed, however long it waited to
      // send the suffix. Only claim the keypress if there's a real code behind
      // it, so a person pressing Enter or Tab on the page is unaffected.
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (bufferRef.current.trim().length >= MIN_LENGTH) e.preventDefault();
        lastKeyRef.current = now;
        submit();
        return;
      }

      // A slow gap means a new burst started — drop whatever came before
      if (now - lastKeyRef.current > GAP_MS) bufferRef.current = '';
      lastKeyRef.current = now;

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        flushRef.current = setTimeout(submit, FLUSH_MS);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      clearTimeout(flushRef.current);
      bufferRef.current = '';
    };
  }, [active]);
}
