import { useEffect, useRef } from 'react';
import { BrowserQRCodeReader } from '@zxing/library';

export default function QRScanner({ onResult }) {
  const videoRef = useRef();
  const hasScanned = useRef(false);
  const readerRef = useRef();

  useEffect(() => {
    hasScanned.current = false;
    readerRef.current = new BrowserQRCodeReader();

    readerRef.current.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
      if (result && !hasScanned.current) {
        hasScanned.current = true;

        // Stop camera immediately
        if (readerRef.current) {
          readerRef.current.reset();
        }

        const text = result.getText();
        const sku = text.includes('/scan/') ? text.split('/scan/')[1] : text;
        onResult(sku);
      }
    });

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      maxWidth: 360,
      margin: '0 auto',
      borderRadius: 12,
      overflow: 'hidden',
      border: '2px solid #22c55e',
      position: 'relative',
      background: '#000'
    }}>
      <video ref={videoRef} style={{ width: '100%', display: 'block' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 180, height: 180,
        border: '2px solid #22c55e',
        borderRadius: 8,
        pointerEvents: 'none'
      }} />
    </div>
  );
}