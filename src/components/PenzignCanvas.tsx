import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Move, 
  Eraser, 
  Pencil, 
  Undo, 
  Redo, 
  Save, 
  MessageSquarePlus, 
  Sparkles, 
  Maximize2,
  Minimize2,
  X,
  Send,
  Loader2,
  Pin
} from 'lucide-react';
import { TaskItem, DrawingLayer, Stroke, Point, CommentPin } from '../types';

interface PenzignCanvasProps {
  activeTask: TaskItem | null;
  layers: DrawingLayer[];
  activeLayerId: string;
  currentColor: string;
  brushSize: number;
  brushMode: 'draw' | 'erase' | 'pencil' | 'marker' | 'airbrush';
  opacity: number;
  pressureMultiplier: number;
  comments: CommentPin[];
  onUpdateLayers: (layers: DrawingLayer[]) => void;
  onSaveCanvas: (dataUrl: string, strokesJson: string) => void;
  onAddCommentPin: (text: string, x: number, y: number) => void;
}

export const PenzignCanvas: React.FC<PenzignCanvasProps> = ({
  activeTask,
  layers,
  activeLayerId,
  currentColor,
  brushSize,
  brushMode,
  opacity,
  pressureMultiplier,
  comments,
  onUpdateLayers,
  onSaveCanvas,
  onAddCommentPin
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Pan & Zoom state
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const strokeHistoryRef = useRef<DrawingLayer[][]>([]);
  const historyIndexRef = useRef<number>(-1);

  // S Pen Hover Cursor state
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [lastPressure, setLastPressure] = useState<number>(0.5);

  // Pin Comment Mode state
  const [isPinMode, setIsPinMode] = useState(false);
  const [pendingPinPos, setPendingPinPos] = useState<{ x: number; y: number } | null>(null);
  const [pinCommentText, setPinCommentText] = useState('');

  // Active Comment Popover
  const [selectedComment, setSelectedComment] = useState<CommentPin | null>(null);

  // Save Indicator
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Canvas Dimensions
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 800 });

  // Handle ResizeObserver for dynamic canvas sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasDimensions({
            width: Math.max(800, Math.floor(width)),
            height: Math.max(600, Math.floor(height))
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Save current state into history stack
  const pushHistory = useCallback((newLayers: DrawingLayer[]) => {
    const history = strokeHistoryRef.current.slice(0, historyIndexRef.current + 1);
    history.push(JSON.parse(JSON.stringify(newLayers)));
    strokeHistoryRef.current = history;
    historyIndexRef.current = history.length - 1;
  }, []);

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prev = strokeHistoryRef.current[historyIndexRef.current];
      onUpdateLayers(JSON.parse(JSON.stringify(prev)));
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < strokeHistoryRef.current.length - 1) {
      historyIndexRef.current += 1;
      const next = strokeHistoryRef.current[historyIndexRef.current];
      onUpdateLayers(JSON.parse(JSON.stringify(next)));
    }
  };

  // Render Canvas Layers & Strokes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background fill (Dark Studio Grid canvas)
    ctx.fillStyle = '#0F121E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Render Layers in order
    layers.forEach(layer => {
      if (!layer.visible) return;

      layer.strokes.forEach(stroke => {
        if (stroke.points.length === 0) return;

        ctx.save();
        ctx.globalAlpha = layer.opacity;

        if (stroke.mode === 'erase') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = stroke.color;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.mode === 'pencil') {
          ctx.globalAlpha = layer.opacity * 0.7;
        } else if (stroke.mode === 'marker') {
          ctx.globalAlpha = layer.opacity * 0.4;
          ctx.lineCap = 'square';
        } else if (stroke.mode === 'airbrush') {
          ctx.globalAlpha = layer.opacity * 0.2;
        }

        // Draw points with pressure variable width
        for (let i = 0; i < stroke.points.length - 1; i++) {
          const p1 = stroke.points[i];
          const p2 = stroke.points[i + 1];

          const pWidth = Math.max(1, stroke.width * (p1.pressure || 0.5) * pressureMultiplier);

          ctx.beginPath();
          ctx.lineWidth = pWidth;
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }

        ctx.restore();
      });
    });
  }, [layers, pressureMultiplier]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Handle Pointer Down (Drawing & S Pen pressure)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // If Pan mode or right click, handle pan
    if (isPanMode || e.button === 1 || e.button === 2) {
      setIsDraggingPan(!0);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    // If Pin mode, place a pin comment
    if (isPinMode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rawX = (e.clientX - rect.left) / scale;
      const rawY = (e.clientY - rect.top) / scale;
      const xPct = Math.round((rawX / canvasDimensions.width) * 100);
      const yPct = Math.round((rawY / canvasDimensions.height) * 100);
      setPendingPinPos({ x: xPct, y: yPct });
      return;
    }

    // Otherwise, start drawing stroke
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate canvas relative coords
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    setIsDrawing(true);
    setLastPressure(pressure);

    const newPoint: Point = { x, y, pressure, timestamp: Date.now() };
    const newStroke: Stroke = {
      points: [newPoint],
      color: brushMode === 'erase' ? '#000000' : currentColor,
      width: brushSize,
      mode: brushMode
    };

    currentStrokeRef.current = newStroke;
  };

  // Handle Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setHoverPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        visible: true
      });
    }

    if (isDraggingPan) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (!isDrawing || !currentStrokeRef.current || !rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    setLastPressure(pressure);

    currentStrokeRef.current.points.push({ x, y, pressure, timestamp: Date.now() });

    // Live update layer strokes in real time
    const updatedLayers = layers.map(layer => {
      if (layer.id === activeLayerId) {
        return {
          ...layer,
          strokes: [...layer.strokes.slice(0, -1), currentStrokeRef.current!]
        };
      }
      return layer;
    });

    onUpdateLayers(updatedLayers);
  };

  // Handle Pointer Up / Leave
  const handlePointerUp = () => {
    if (isDraggingPan) {
      setIsDraggingPan(false);
      return;
    }

    if (isDrawing && currentStrokeRef.current) {
      setIsDrawing(false);
      const finishedStroke = currentStrokeRef.current;
      currentStrokeRef.current = null;

      // Add stroke permanently to active layer
      const updatedLayers = layers.map(layer => {
        if (layer.id === activeLayerId) {
          return {
            ...layer,
            strokes: [...layer.strokes, finishedStroke]
          };
        }
        return layer;
      });

      onUpdateLayers(updatedLayers);
      pushHistory(updatedLayers);
    }
  };

  // Save Canvas Action
  const triggerSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    const dataUrl = canvas.toDataURL('image/png');
    const strokesJson = JSON.stringify(layers);
    onSaveCanvas(dataUrl, strokesJson);
    setTimeout(() => {
      setIsSaving(false);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 600);
  };

  // Create Pin Comment Submit
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPinPos || !pinCommentText.trim()) return;
    onAddCommentPin(pinCommentText.trim(), pendingPinPos.x, pendingPinPos.y);
    setPinCommentText('');
    setPendingPinPos(null);
    setIsPinMode(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#06080D] relative overflow-hidden select-none" ref={containerRef}>
      {/* Canvas Studio Header Bar */}
      <div className="h-12 border-b border-white/10 bg-[#080A12] px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#610061] animate-ping" />
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-100">
              {activeTask ? activeTask.taskName : 'Penzign Task Studio Canvas'}
            </h3>
          </div>
          {activeTask && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#007aff]/20 text-[#007aff] border border-[#007aff]/30 uppercase font-bold">
              {activeTask.status}
            </span>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.15))}
              className="p-1 hover:bg-white/10 text-zinc-400 hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] font-mono text-zinc-300 w-10 text-center font-bold">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(3.0, s + 0.15))}
              className="p-1 hover:bg-white/10 text-zinc-400 hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => { setScale(1); setPanOffset({ x: 0, y: 0 }); }}
              className="text-[9px] font-mono px-1.5 py-0.5 text-zinc-500 hover:text-zinc-300"
              title="Reset View"
            >
              Reset
            </button>
          </div>

          {/* Pan Toggle */}
          <button
            onClick={() => setIsPanMode(!isPanMode)}
            className={`p-2 rounded-xl border text-xs transition-all ${
              isPanMode 
                ? 'bg-[#007aff] text-white border-[#007aff]' 
                : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
            }`}
            title="Pan View Tool"
          >
            <Move size={14} />
          </button>

          {/* Pin Comment Mode Toggle */}
          <button
            onClick={() => setIsPinMode(!isPinMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
              isPinMode 
                ? 'bg-[#ff0000] text-white border-[#ff0000] animate-pulse' 
                : 'bg-zinc-900 text-zinc-300 border-white/10 hover:text-white'
            }`}
            title="Toggle Pin Comment Mode"
          >
            <Pin size={14} />
            <span className="hidden sm:inline">Pin Comment</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-white/10 p-1 rounded-xl">
            <button
              onClick={handleUndo}
              className="p-1 text-zinc-400 hover:text-white rounded transition-colors"
              title="Undo Stroke"
            >
              <Undo size={14} />
            </button>
            <button
              onClick={handleRedo}
              className="p-1 text-zinc-400 hover:text-white rounded transition-colors"
              title="Redo Stroke"
            >
              <Redo size={14} />
            </button>
          </div>

          {/* Save Drawing Button */}
          <button
            onClick={triggerSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center cursor-crosshair">
        {/* Transform Container for Pan & Zoom */}
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDraggingPan ? 'none' : 'transform 0.05s ease-out'
          }}
          className="relative shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 rounded-2xl overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              handlePointerUp();
              setHoverPos(h => ({ ...h, visible: false }));
            }}
            className="touch-none bg-[#0F121E] block"
          />

          {/* Comment Pins Rendered directly on Canvas Coordinates */}
          {comments.map(pin => (
            <div
              key={pin.id}
              onClick={() => setSelectedComment(pin)}
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-[0_0_12px_#ff0000] border-2 border-white transform transition-transform hover:scale-125">
                <Pin size={12} className="fill-white" />
              </div>
              <div className="absolute top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-zinc-950 border border-white/20 px-2 py-1 rounded text-[10px] font-sans text-white whitespace-nowrap shadow-xl z-30 pointer-events-none">
                <span className="font-bold text-[#ff0000]">{pin.author}: </span>
                <span>{pin.text}</span>
              </div>
            </div>
          ))}
        </div>

        {/* S Pen Pressure & Hover Cursor Preview */}
        {hoverPos.visible && !isPanMode && (
          <div
            style={{
              left: `${hoverPos.x}px`,
              top: `${hoverPos.y}px`,
              width: `${Math.max(4, brushSize * lastPressure * pressureMultiplier * scale)}px`,
              height: `${Math.max(4, brushSize * lastPressure * pressureMultiplier * scale)}px`,
              borderColor: currentColor,
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed shadow-[0_0_10px_rgba(255,255,255,0.4)] z-30 transition-all duration-75"
          />
        )}

        {/* Pin Comment Creation Modal Popover */}
        {pendingPinPos && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
            <form onSubmit={handlePinSubmit} className="bg-zinc-900 border border-white/20 p-5 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Pin size={16} className="text-[#ff0000]" />
                  <h3 className="text-xs font-extrabold uppercase text-white tracking-wider">
                    Add Pin Comment ({pendingPinPos.x}%, {pendingPinPos.y}%)
                  </h3>
                </div>
                <button type="button" onClick={() => setPendingPinPos(null)} className="text-zinc-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <textarea
                required
                autoFocus
                rows={3}
                value={pinCommentText}
                onChange={(e) => setPinCommentText(e.target.value)}
                placeholder="Type your feedback or design review note..."
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#ff0000]"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingPinPos(null)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#ff0000] hover:bg-red-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow"
                >
                  Drop Pin
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Selected Comment Details Modal */}
        {selectedComment && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/20 p-5 rounded-2xl w-full max-w-sm space-y-3 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Pin size={16} className="text-[#ff0000]" />
                  <span className="text-xs font-extrabold uppercase text-white">
                    {selectedComment.author || 'Reviewer'}
                  </span>
                </div>
                <button onClick={() => setSelectedComment(null)} className="text-zinc-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed font-sans bg-zinc-950 p-3 rounded-xl border border-white/5">
                {selectedComment.text}
              </p>
              <div className="text-[9px] font-mono text-zinc-500 text-right">
                Location: {selectedComment.x}%, {selectedComment.y}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status & S Pen Specs Footer */}
      <div className="h-8 bg-[#080A12] border-t border-white/10 px-4 flex items-center justify-between text-[9px] font-mono text-zinc-400 z-20">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold uppercase">S PEN PRESSURE 0-1 ACTIVE</span>
          <span>•</span>
          <span>S-Pen Tool: {brushMode.toUpperCase()} ({brushSize}px)</span>
          <span>•</span>
          <span>Pressure Read: {(lastPressure * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Pins: {comments.length}</span>
          {lastSavedTime && <span>Saved: {lastSavedTime}</span>}
        </div>
      </div>
    </div>
  );
};
