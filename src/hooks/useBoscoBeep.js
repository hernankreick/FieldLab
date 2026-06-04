import { useRef } from 'react';

export function useBoscoBeep() {
  const audioCtxRef = useRef(null);

  function playBeep(freq = 880, durationSec = 0.12) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type            = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + durationSec);
    } catch { /* ignorar */ }
  }

  // Llamar DENTRO del handler de tap del usuario — iOS requiere AudioContext en gesto
  async function initAndCountdown(onComplete) {
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      await audioCtxRef.current.resume();
    } catch {
      setTimeout(onComplete, 3000);
      return;
    }
    playBeep(880, 0.12);
    setTimeout(() => playBeep(880, 0.12),  1000);
    setTimeout(() => playBeep(880, 0.12),  2000);
    setTimeout(() => { playBeep(1200, 0.4); onComplete(); }, 3000);
  }

  function beepJump() { playBeep(660, 0.08); }
  function beepEnd()  { playBeep(440, 0.5);  }

  return { initAndCountdown, beepJump, beepEnd };
}
