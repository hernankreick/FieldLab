import { useState, useRef, useCallback } from 'react';

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

  const loadVideo = useCallback((file) => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setTakeoffTime(null);
    setLandingTime(null);
    setCurrentTime(0);
    setIsReady(false);
    setDuration(0);
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
    const newTime = Math.max(0, Math.min(video.duration, video.currentTime + direction / 30));
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const seekTo = useCallback((time) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
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

  const reset = useCallback(() => {
    setTakeoffTime(null);
    setLandingTime(null);
  }, []);

  const clearVideo = useCallback(() => {
    setVideoSrc(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setTakeoffTime(null);
    setLandingTime(null);
    setIsReady(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const result = (() => {
    if (takeoffTime === null || landingTime === null) return null;
    const flightMs = Math.abs(landingTime - takeoffTime) * 1000;
    if (flightMs < 150 || flightMs > 1000) return null;
    const height = Math.round((G * (flightMs / 1000) ** 2 / 8) * 100);
    return { height, flightMs: Math.round(flightMs) };
  })();

  return {
    videoRef, videoSrc, fps, duration,
    currentTime, takeoffTime, landingTime,
    isReady, result,
    loadVideo, onVideoLoad, onVideoTimeUpdate,
    stepFrame, seekTo, markTakeoff, markLanding,
    reset, clearVideo,
  };
}
