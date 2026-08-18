import { useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  MultiFormatReader, BarcodeFormat, DecodeHintType,
  RGBLuminanceSource, BinaryBitmap, HybridBinarizer,
} from '@zxing/library';

// Old stickers carry a QR code (a /unit/<code> URL), new ones a Code128 barcode
// (the bare unit code). Both have to keep scanning, so every frame is tried as
// a QR first — cheap and proven — and only falls through to the 1D decoder.
const oneDHints = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
  [DecodeHintType.TRY_HARDER, true],
]);

// RGBLuminanceSource wants one luminance byte per pixel, not RGBA.
const toLuminance = ({ data, width, height }) => {
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; j < lum.length; i += 4, j++) {
    lum[j] = (data[i] * 306 + data[i + 1] * 601 + data[i + 2] * 117) >> 10;
  }
  return lum;
};

export default function CodeScanner({ onResult, active = true }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const lastRef = useRef({ code: '', time: 0 });
  const readerRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const reader = new MultiFormatReader();
    reader.setHints(oneDHints);
    readerRef.current = reader;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    }).then(stream => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      tick();
    }).catch(console.error);

    function decodeBarcode(imageData) {
      const { width, height } = imageData;
      const source = new RGBLuminanceSource(toLuminance(imageData), width, height);
      const bitmap = new BinaryBitmap(new HybridBinarizer(source));
      try {
        return readerRef.current.decode(bitmap).getText();
      } catch {
        return null; // no barcode in this frame
      } finally {
        readerRef.current.reset();
      }
    }

    function tick() {
      timerRef.current = setTimeout(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);

          const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          const text = qr ? qr.data : decodeBarcode(img);

          if (text) {
            const now = Date.now();
            if (text !== lastRef.current.code || now - lastRef.current.time > 2000) {
              lastRef.current = { code: text, time: now };
              onResult(text);
            }
          }
        }
        tick();
      }, 250);
    }

    return () => {
      clearTimeout(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      readerRef.current = null;
    };
  }, [active]);

  return (
    <div style={{ position: 'relative', background: '#000', borderRadius: 10, overflow: 'hidden' }}>
      <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block', maxHeight: 220, objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {/* Wide guide box — a 1D barcode only decodes when its bars run across the frame */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '70%', maxWidth: 260, height: 120,
        border: '2px solid #22c55e', borderRadius: 8,
        pointerEvents: 'none',
      }} />
    </div>
  );
}
