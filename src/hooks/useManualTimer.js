import { useState, useRef, useCallback } from 'react';

const G = 9.81;

export function flightToHeight(flightMs) {
  const t = flightMs / 1000;
  return Math.round((G * t * t / 8) * 100);
}

export function heightToSayers(heightCm, bodyMassKg) {
  return Math.round(60.7 * heightCm + 45.3 * bodyMassKg - 2055);
}

export function calcRSI(heightCm, contactMs) {
  return ((heightCm / 100) / (contactMs / 1000)).toFixed(2);
}

export function calcElasticEfficiency(cmjHeight, sjHeight) {
  if (!sjHeight || sjHeight === 0) return null;
  return Math.round(((cmjHeight - sjHeight) / sjHeight) * 100);
}

export function useManualTimer({ maxJumps = 5 } = {}) {
  const [jumps,   setJumps]   = useState([]);
  const [phase,   setPhase]   = useState('idle'); // 'idle' | 'airborne'
  const [lastTap, setLastTap] = useState(null);

  const takeoffRef = useRef(null);
  const jumpsRef   = useRef([]);

  const tap = useCallback(() => {
    const now = Date.now();
    if (phase === 'idle') {
      takeoffRef.current = now;
      setPhase('airborne');
      setLastTap(now);
    } else {
      const flightMs = now - takeoffRef.current;
      if (flightMs >= 150 && flightMs <= 1000) {
        const height     = flightToHeight(flightMs);
        const newJump    = { height, flightMs };
        jumpsRef.current = [...jumpsRef.current, newJump];
        setJumps([...jumpsRef.current]);
      }
      setPhase('idle');
      setLastTap(now);
      takeoffRef.current = null;
    }
  }, [phase]);

  const reset = useCallback(() => {
    jumpsRef.current = [];
    setJumps([]);
    setPhase('idle');
    takeoffRef.current = null;
  }, []);

  const heights = jumps.map(j => j.height);
  const stats   = heights.length > 0 ? {
    best:  Math.max(...heights),
    avg:   Math.round(heights.reduce((a, b) => a + b, 0) / heights.length),
    worst: Math.min(...heights),
  } : null;

  return { jumps, stats, phase, lastTap, tap, reset, isComplete: jumps.length >= maxJumps };
}
