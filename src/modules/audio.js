let ctx;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

function beep({ frequency = 440, duration = 0.12, type = 'square', volume = 0.06 }) {
  const audioCtx = getCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioCtx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration + 0.01);
}

export function playAttackSfx() {
  beep({ frequency: 280, duration: 0.1, type: 'sawtooth', volume: 0.05 });
  setTimeout(() => beep({ frequency: 180, duration: 0.08, type: 'triangle', volume: 0.04 }), 36);
}

export function playGuardSfx() {
  beep({ frequency: 520, duration: 0.12, type: 'triangle', volume: 0.05 });
}

export function playVictorySfx() {
  beep({ frequency: 600, duration: 0.12, type: 'triangle', volume: 0.05 });
  setTimeout(() => beep({ frequency: 760, duration: 0.13, type: 'triangle', volume: 0.05 }), 120);
}

export function playDefeatSfx() {
  beep({ frequency: 220, duration: 0.16, type: 'square', volume: 0.045 });
  setTimeout(() => beep({ frequency: 160, duration: 0.18, type: 'square', volume: 0.045 }), 160);
}
