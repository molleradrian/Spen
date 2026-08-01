import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Timer, 
  Activity, 
  Route, 
  RotateCcw, 
  Pause, 
  Play, 
  ChevronDown, 
  Zap, 
  Sparkles, 
  Layers, 
  Percent, 
  Maximize2, 
  Minimize2
} from 'lucide-react';
import { Point, Stroke, DrawingLayer } from '../types';

// CSS density factor assuming ~96 DPI screen
// 1 px = approx 0.264583 mm
const PX_TO_MM = 0.264583;

interface CanvasStatsProps {
  layers: DrawingLayer[];
  currentStroke: Point[];
  isDrawing: boolean;
  workspaceSessionId: string;
}

export default function CanvasStats({ 
  layers, 
  currentStroke, 
  isDrawing, 
  workspaceSessionId 
}: CanvasStatsProps) {
  // Session UI State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [customElapsedSeconds, setCustomElapsedSeconds] = useState(0);

  // Auto-reset elapsed seconds when workspace session ID rotates
  useEffect(() => {
    setCustomElapsedSeconds(0);
    setIsTimerPaused(false);
  }, [workspaceSessionId]);

  // Workspace Time Spent timer ticking
  useEffect(() => {
    if (isTimerPaused) return;

    const timer = setInterval(() => {
      setCustomElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerPaused]);

  // Utility to format elapsed time (e.g. 05:22 or 01:14:02)
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  // 1. Calculate Stroke Statistics
  const stats = useMemo(() => {
    let strokeCount = 0;
    let totalDistancePx = 0;
    let totalActiveDrawingMs = 0;
    let maxPressure = 0;

    // Helper to calculate total distance of a point array
    const calcDistance = (pts: Point[]) => {
      if (pts.length < 2) return 0;
      let dist = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        const dy = pts[i + 1].y - pts[i].y;
        dist += Math.sqrt(dx * dx + dy * dy);
      }
      return dist;
    };

    // Helpler to calculate active drawing duration for speed metrics
    const calcDurationMs = (pts: Point[]) => {
      if (pts.length < 2) return 0;
      const start = pts[0].timestamp;
      const end = pts[pts.length - 1].timestamp;
      return Math.max(0, end - start);
    };

    // Helpler to track peak pressure
    const checkMaxPressure = (pts: Point[]) => {
      let peak = 0;
      pts.forEach(p => {
        if (p.pressure > peak) peak = p.pressure;
      });
      return peak;
    };

    // Accumulate metrics for saved layers
    layers.forEach(layer => {
      strokeCount += layer.strokes.length;
      layer.strokes.forEach(stroke => {
        totalDistancePx += calcDistance(stroke.points);
        totalActiveDrawingMs += calcDurationMs(stroke.points);
        const strokePeak = checkMaxPressure(stroke.points);
        if (strokePeak > maxPressure) maxPressure = strokePeak;
      });
    });

    // Accumulate the current in-flight stroke
    if (currentStroke.length > 0) {
      strokeCount += 1;
      totalDistancePx += calcDistance(currentStroke);
      totalActiveDrawingMs += calcDurationMs(currentStroke);
      const strokePeak = checkMaxPressure(currentStroke);
      if (strokePeak > maxPressure) maxPressure = strokePeak;
    }

    // Convert pixel distance to real world measurements
    const distanceMm = totalDistancePx * PX_TO_MM;
    const distanceMeters = distanceMm / 1000;
    const distanceFeet = distanceMm / 304.8; // mm to feet

    // Drawing Speed (Active Drawing Time vs Distance)
    const activeDrawingSeconds = totalActiveDrawingMs / 1000;
    const avgDrawingSpeed = activeDrawingSeconds > 0.1 
      ? (totalDistancePx / activeDrawingSeconds) 
      : 0;

    // Average Stroke Length
    const avgStrokeLengthPx = strokeCount > 0 ? (totalDistancePx / strokeCount) : 0;

    return {
      strokeCount,
      distancePx: Math.round(totalDistancePx),
      distanceMeters,
      distanceFeet,
      maxPressure,
      avgDrawingSpeed: Math.round(avgDrawingSpeed),
      avgStrokeLengthPx: Math.round(avgStrokeLengthPx),
      activeSecs: activeDrawingSeconds
    };
  }, [layers, currentStroke, isDrawing]);

  // Handle manual statistics reset trigger (allows starting fresh counts if desired)
  const handleResetTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Reset elapsed time counter for this segment?')) {
      setCustomElapsedSeconds(0);
    }
  };

  const handleTogglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTimerPaused(prev => !prev);
  };

  return (
    <div className="absolute bottom-8 left-8 z-[80] pointer-events-auto">
      <AnimatePresence initial={false}>
        {!isExpanded ? (
          // COLLAPSED: Floating capsule bar with minimal core indicators
          <motion.button
            key="collapsed-stats"
            layoutId="stats-card"
            drag
            dragMomentum={false}
            dragElastic={0.05}
            onClick={() => setIsExpanded(true)}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3.5 px-4.5 py-2.5 bg-white/90 backdrop-blur-xl border border-black/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.08)] cursor-grab active:cursor-grabbing select-none text-zinc-800 transition-shadow hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
            title="Examine detailed canvas canvas stats (Drag to move)"
          >
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 border-r border-black/5 pr-2.5 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${isTimerPaused ? 'bg-zinc-400' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="font-mono text-[10px] font-bold tracking-tight text-zinc-900 leading-none">
                {formatTime(customElapsedSeconds)}
              </span>
            </div>

            {/* Strokes Count overview */}
            <div className="flex items-center gap-1 text-zinc-500 shrink-0">
              <Activity size={10.5} className="opacity-75" />
              <span className="text-[10px] font-mono font-bold text-zinc-700">{stats.strokeCount}</span>
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 scale-[0.85] origin-left -ml-0.5">Strokes</span>
            </div>

            {/* Travel Distance overview */}
            <div className="flex items-center gap-1 text-zinc-500 shrink-0 pr-1">
              <Route size={10.5} className="opacity-75" />
              <span className="text-[10px] font-mono font-bold text-zinc-700">
                {stats.distanceMeters >= 1 
                  ? `${stats.distanceMeters.toFixed(1)}m` 
                  : `${Math.round(stats.distanceMeters * 100)}cm`}
              </span>
            </div>

            <ChevronDown size={12} className="text-zinc-400 -ml-0.5" />
          </motion.button>
        ) : (
          // EXPANDED: Premium HUD widget with visual progress bars and drawing metrics
          <motion.div
            key="expanded-stats"
            layoutId="stats-card"
            drag
            dragMomentum={false}
            dragElastic={0.05}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-72 bg-white/95 backdrop-blur-xl border border-black/10 rounded-[28px] shadow-[0_15px_50px_rgba(0,0,0,0.12)] p-5.5 flex flex-col gap-4 text-zinc-800 cursor-grab active:cursor-grabbing select-none"
          >
            {/* Grab Drag handle indicator bar */}
            <div className="w-8 h-1 bg-zinc-400/35 rounded-full mx-auto -mt-2 mb-1 shrink-0" />

            {/* Header with toggle and title */}
            <div className="flex items-center justify-between pb-2 border-b border-black/5" onPointerDown={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <div className="p-1 px-1.5 rounded-lg bg-zinc-100 text-zinc-650 flex items-center justify-center font-mono text-[8px] uppercase tracking-wider leading-none">
                  Live
                </div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900">Canvas Analytics</h3>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1 hover:bg-black/5 text-zinc-405 hover:text-zinc-650 rounded-lg transition-colors cursor-pointer"
                title="Minimize Stats Card"
              >
                <Minimize2 size={12} />
              </button>
            </div>

            {/* 1. Timer / Duration Active HUD Section */}
            <div className="bg-zinc-50 border border-black/5 rounded-2xl p-3 flex items-center justify-between shadow-sm" onPointerDown={e => e.stopPropagation()}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl flex items-center justify-center ${isTimerPaused ? 'bg-zinc-200 text-zinc-500' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Timer size={15} className={isTimerPaused ? '' : 'animate-spin-slow'} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-zinc-400">Duration Active</span>
                  <span className="text-sm font-mono font-extrabold text-zinc-950 tracking-tight -mt-0.5 leading-none">
                    {formatTime(customElapsedSeconds)}
                  </span>
                </div>
              </div>

              {/* Timer Control Buttons */}
              <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                <button
                  onClick={handleTogglePause}
                  className={`p-1.5 rounded-lg border transition-all ${
                    isTimerPaused 
                      ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200/50 text-zinc-650' 
                      : 'bg-white hover:bg-zinc-50 border-black/5 text-zinc-550'
                  }`}
                  title={isTimerPaused ? "Resume tracking time" : "Pause tracking time"}
                >
                  {isTimerPaused ? <Play size={10} fill="currentColor" /> : <Pause size={10} fill="currentColor" />}
                </button>
                <button
                  onClick={handleResetTimer}
                  className="p-1.5 bg-white hover:bg-zinc-50 border border-black/5 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
                  title="Reset Segment Timer"
                >
                  <RotateCcw size={10} />
                </button>
              </div>
            </div>

            {/* 2. core grid details: Strokes & Distance */}
            <div className="grid grid-cols-2 gap-2.5" onPointerDown={e => e.stopPropagation()}>
              {/* Strokes Card */}
              <div className="bg-zinc-50/50 border border-black/5 rounded-2xl p-3 text-left">
                <span className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-zinc-400 flex items-center gap-1">
                  <Activity size={9} /> Total Strokes
                </span>
                <span className="text-lg font-mono font-extrabold text-zinc-900 block tracking-tight pt-0.5 leading-none">
                  {stats.strokeCount}
                </span>
                <span className="text-[8px] text-zinc-400 font-mono tracking-tight leading-none">
                  across {layers.length} {layers.length === 1 ? 'layer' : 'layers'}
                </span>
              </div>

              {/* Distance Card */}
              <div className="bg-zinc-50/50 border border-black/5 rounded-2xl p-3 text-left">
                <span className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-zinc-400 flex items-center gap-1">
                  <Route size={9} /> Pen Distance
                </span>
                <span className="text-lg font-mono font-extrabold text-zinc-900 block tracking-tight pt-0.5 leading-none">
                  {stats.distanceMeters >= 100 
                    ? `${stats.distanceMeters.toFixed(0)}m`
                    : stats.distanceMeters >= 1
                    ? `${stats.distanceMeters.toFixed(1)}m` 
                    : `${Math.round(stats.distanceMeters * 100)}cm`}
                </span>
                <span className="text-[8px] text-zinc-400 font-mono tracking-tight leading-none truncate block">
                  {stats.distancePx.toLocaleString()} px
                </span>
              </div>
            </div>

            {/* 3. Dynamic Pen performance analytics */}
            <div className="space-y-2 text-left pt-1" onPointerDown={e => e.stopPropagation()}>
              <span className="text-[8px] font-mono uppercase tracking-wider font-black text-zinc-400 block px-1">Performance Dynamics</span>
              
              <div className="space-y-2 border border-black/5 bg-zinc-50/20 p-2.5 rounded-2xl" onPointerDown={(e) => e.stopPropagation()}>
                {/* Active drawing speed */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                    <Zap size={11} className="text-amber-500" /> Active Draw Speed:
                  </span>
                  <span className="font-mono font-bold text-zinc-800">
                    {stats.avgDrawingSpeed > 0 ? `${stats.avgDrawingSpeed} px/s` : '0 px/s'}
                  </span>
                </div>

                {/* Average line length */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-550 font-medium flex items-center gap-1.5">
                    <Sparkles size={11} className="text-blue-500" /> Avg Stroke Length:
                  </span>
                  <span className="font-mono font-bold text-zinc-800">
                    {stats.avgStrokeLengthPx} px
                  </span>
                </div>

                {/* Pen Pressure Registered Peak */}
                <div className="space-y-1 pt-1.5 border-t border-black/5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-505 font-medium flex items-center gap-1.2">
                      <Percent size={11} className="text-purple-500" /> Peak Pen Pressure:
                    </span>
                    <span className="font-mono font-extrabold text-zinc-800 leading-none">
                      {Math.round(stats.maxPressure * 100)}%
                    </span>
                  </div>
                  
                  {/* Dynamic graphic gauge bar */}
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden w-full relative">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-teal-400 to-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.maxPressure * 100}%` }}
                      transition={{ type: 'spring', damping: 15 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Workspace Info */}
            <div className="text-[8.5px] text-zinc-400 font-mono text-center select-none pt-1" onPointerDown={e => e.stopPropagation()}>
              Stats resets automatically upon workspace changes.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
