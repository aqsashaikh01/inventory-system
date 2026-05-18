import { useEffect, useRef } from 'react';
import jsQR from 'jsqr';

export default function QRScanner({ onResult, active = true }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const lastRef = useRef({ code: '', time: 0 });

  useEffect(() => {
    if (!active) return;

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
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (code) {
            const now = Date.now();
            if (code.data !== lastRef.current.code || now - lastRef.current.time > 2000) {
              lastRef.current = { code: code.data, time: now };
              onResult(code.data);
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
    };
  }, [active]);

  return (
    <div style={{ position: 'relative', background: '#000', borderRadius: 10, overflow: 'hidden' }}>
      <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block', maxHeight: 220, objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 140, height: 140,
        border: '2px solid #22c55e', borderRadius: 8,
        pointerEvents: 'none',
      }} />
    </div>
  );
}
