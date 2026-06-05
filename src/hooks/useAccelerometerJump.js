import { useState, useRef, useCallback, useEffect } from 'react';

const G = 9.81;
const MIN_FLIGHT_MS      = 200;
const MAX_FLIGHT_MS      = 800;
const MIN_CONTACT_MS     = 50;
const MAX_CONTACT_MS     = 400;
const FREEFALL_THRESHOLD = 3.0;
const LANDING_THRESHOLD  = FREEFALL_THRESHOLD * 2;
const COOLDOWN_MS        = 400; // ignorar lecturas durante 400ms post-aterrizaje

export function flightToHeight(flightMs) {
  const t = flightMs / 1000;
  return Math.round((G * t * t / 8) * 100); // cm
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

const STATE = {
  IDLE:     'idle',
  AIRBORNE: 'airborne',
  CONTACT:  'contact',
};

export function useAccelerometerJump({ maxJumps = 5, testType = 'CMJ' } = {}) {
  const [jumps,       setJumps]       = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [state,       setState]       = useState(STATE.IDLE);
  const [error,       setError]       = useState(null);
  const [permitted,   setPermitted]   = useState(false);

  const stateRef       = useRef(STATE.IDLE);
  const airborneStart  = useRef(null);
  const contactStart   = useRef(null);
  const cooldownUntil  = useRef(0);
  const isDetRef       = useRef(false);
  const jumpsRef       = useRef([]);
  const maxJumpsRef    = useRef(maxJumps);
  const testTypeRef    = useRef(testType);

  useEffect(() => { maxJumpsRef.current  = maxJumps;  }, [maxJumps]);
  useEffect(() => { testTypeRef.current  = testType;  }, [testType]);

  const requestPermission = useCallback(async () => {
    setError(null);
    if (typeof DeviceMotionEvent === 'undefined') {
      setError('Tu dispositivo no soporta el acelerómetro.');
      return false;
    }
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') {
          setError('Permiso denegado. Habilitalo en Ajustes → Safari → Movimiento.');
          return false;
        }
      } catch (e) {
        setError(`Error al pedir permiso: ${e.message}`);
        return false;
      }
    }
    setPermitted(true);
    return true;
  }, []);

  const handleMotion = useCallback((e) => {
    if (!isDetRef.current) return;
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;

    const mag = Math.sqrt(
      (acc.x ?? 0) ** 2 +
      (acc.y ?? 0) ** 2 +
      (acc.z ?? 0) ** 2
    );

    const now = Date.now();

    // Ignorar lecturas durante el cooldown post-aterrizaje (vibración del impacto)
    if (now < cooldownUntil.current) return;

    const cur = stateRef.current;

    if (cur === STATE.CONTACT || cur === STATE.IDLE) {
      if (mag < FREEFALL_THRESHOLD) {
        // Despegue detectado
        if (testTypeRef.current === 'DropJump' && contactStart.current !== null) {
          const contactMs = now - contactStart.current;
          if (contactMs >= MIN_CONTACT_MS && contactMs <= MAX_CONTACT_MS) {
            jumpsRef.current = jumpsRef.current.map((j, i) =>
              i === jumpsRef.current.length - 1 ? { ...j, contactMs } : j
            );
            setJumps([...jumpsRef.current]);
          }
        }
        stateRef.current  = STATE.AIRBORNE;
        setState(STATE.AIRBORNE);
        airborneStart.current = now;
        contactStart.current  = null;
      }
    } else if (cur === STATE.AIRBORNE) {
      if (mag > LANDING_THRESHOLD) {
        // Aterrizaje detectado
        const flightMs = now - airborneStart.current;
        stateRef.current     = STATE.CONTACT;
        setState(STATE.CONTACT);
        contactStart.current  = now;
        cooldownUntil.current = now + COOLDOWN_MS;

        if (flightMs >= MIN_FLIGHT_MS && flightMs <= MAX_FLIGHT_MS) {
          const height  = flightToHeight(flightMs);
          const newJump = { height, flightMs };
          jumpsRef.current = [...jumpsRef.current, newJump];
          setJumps([...jumpsRef.current]);

          if (jumpsRef.current.length >= maxJumpsRef.current) {
            isDetRef.current = false;
            setIsDetecting(false);
            window.removeEventListener('devicemotion', handleMotion);
          }
        }
      }
    }
  }, []);

  const startDetection = useCallback(() => {
    jumpsRef.current      = [];
    setJumps([]);
    contactStart.current  = null;
    airborneStart.current = null;
    cooldownUntil.current = 0;
    stateRef.current      = STATE.CONTACT;
    setState(STATE.CONTACT);
    isDetRef.current = true;
    setIsDetecting(true);
    window.addEventListener('devicemotion', handleMotion, { passive: true });
  }, [handleMotion]);

  const stopDetection = useCallback(() => {
    isDetRef.current = false;
    setIsDetecting(false);
    stateRef.current = STATE.IDLE;
    setState(STATE.IDLE);
    window.removeEventListener('devicemotion', handleMotion);
  }, [handleMotion]);

  const reset = useCallback(() => {
    stopDetection();
    jumpsRef.current = [];
    setJumps([]);
    setError(null);
  }, [stopDetection]);

  useEffect(() => {
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [handleMotion]);

  const heights = jumps.map(j => j.height);
  const stats = heights.length > 0 ? {
    best:  Math.max(...heights),
    avg:   Math.round(heights.reduce((a, b) => a + b, 0) / heights.length),
    worst: Math.min(...heights),
  } : null;

  return {
    jumps, stats, state,
    isDetecting, error, permitted,
    requestPermission, startDetection,
    stopDetection, reset,
  };
}
