// Short tones for gun scans — the operator is watching the goods, not the
// screen. Synthesised with WebAudio so there are no asset files to ship.
// Note the gun's own beep only means it read the label; these say whether the
// server accepted the unit.
let ctx = null;

const tone = (frequency, durationMs, type) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    // The gun's keypress is the user gesture browsers demand before audio
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    // Ramp down rather than cut, which would click
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Sound is a nicety — never let it break a scan
  }
};

export const beepOk = () => tone(950, 90, 'sine');
export const beepFail = () => tone(200, 320, 'square');
