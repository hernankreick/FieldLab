import { useState, useRef, useCallback, useEffect } from 'react';

const G = 9.81;

export function useVideoAnalysis() {
  const videoRef      = useRef(null);
  const [videoSrc,    setVideoSrc]    = useState(null);
  const [fps,         setFps]         = useState(30);
  const [duration,    setDuration]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [takeoffTime, setTakeoffTime] = useState(null);
  const [landingTime, setLandingTime] = useState(null);
  const [isReady,     setIsReady]     = useState(false);
  const [result,      setResult]      = useState(null);

  const loadVideo = useCallback((file) => {
    if (!file) return;
    setIsReady(false);
    setTakeoffTime(null);
    setLandingTime(null);
    setCurrentTime(0);
    setDuration(0);
    // FileReader genera un data URL (base64) que iOS Safari siempre puede reproducir,
    // a diferencia de createObjectURL que falla silenciosamente en algunos contextos.
    const reader = new FileReader();
    reader.onload = (e) => {
      setVideoSrc(e.target.result);
      // Esperar a que React actualice el src antes de llamar load()
      setTimeout(() => { videoRef.current?.load(); }, 50);
    };
    reader.readAsDataURL(file);
  }, []);

  const onVideoLoad = useCallback((e) => {
    setDuration(e.target.duration);
    setFps(30);
    setIsReady(true);
  }, []);

  const onVideoTimeUpdate = useCallback((e) => {
    setCurrentTime(e.target.currentTime);
  }, []);

  const stepFrame = useCallback((direction) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const newTime = Math.max(0, Math.min(video.duration, video.currentTime + direction / 30));
    video.currentTime = newTime;
    video.addEventListener('seeked', () => setCurrentTime(video.currentTime), { once: true });
  }, []);

  const seekTo = useCallback((time) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = time;
    video.addEventListener('seeked', () => setCurrentTime(video.currentTime), { once: true });
  }, []);

  // Permite forzar isReady desde fuera (ej. overlay de play en iOS)
  const forceReady = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setIsReady(true);
  }, []);

  const markTakeoff = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setTakeoffTime(video.currentTime);
  }, []);

  const markLanding = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setLandingTime(video.currentTime);
  }, []);

  const resetMarkers = useCallback(() => {
    setTakeoffTime(null);
    setLandingTime(null);
    setResult(null);
    console.log('[useVideoAnalysis] resetMarkers called');
  }, []);

  const clearVideo = useCallback(() => {
    setVideoSrc(null);
    setTakeoffTime(null);
    setLandingTime(null);
    setResult(null);
    setIsReady(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const resetAll = useCallback(() => {
    setVideoSrc(null);
    setTakeoffTime(null);
    setLandingTime(null);
    setResult(null);
    setIsReady(false);
    setCurrentTime(0);
    setDuration(0);
    const v = videoRef.current;
    if (v) { v.pause(); v.src = ''; v.load(); }
  }, []);

  useEffect(() => {
    if (takeoffTime === null || landingTime === null) {
      setResult(null);
      return;
    }
    const flightMs = Math.abs(landingTime - takeoffTime) * 1000;
    if (flightMs < 150 || flightMs > 1000) {
      setResult(null);
      return;
    }
    const height = Math.round((G * (flightMs / 1000) ** 2 / 8) * 100);
    setResult({ height, flightMs: Math.round(flightMs) });
  }, [takeoffTime, landingTime]);

  return {
    videoRef, videoSrc, fps, duration,
    currentTime, takeoffTime, landingTime,
    isReady, result,
    loadVideo, onVideoLoad, onVideoTimeUpdate,
    stepFrame, seekTo, markTakeoff, markLanding,
    resetMarkers, clearVideo, resetAll, forceReady,
  };
}
